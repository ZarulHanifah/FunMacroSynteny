import { Store } from './Store.js';
import { Engine } from './Engine.js';
import { TrackRenderer } from '../renderers/TrackRenderer.js';
import { LinkRenderer } from '../renderers/LinkRenderer.js';
import { Tooltip } from '../renderers/Tooltip.js';
import { Parsers } from '../utils/Parsers.js';
import { ColorPalettes } from '../utils/ColorPalettes.js';
import { State, Config, Sample, Chrom } from '../types.js';

export class SyntenyViz {
    public container: d3.Selection<any, any, any, any>;
    public svg: d3.Selection<any, any, any, any>;
    public linkLayer: d3.Selection<any, any, any, any>;
    public trackLayer: d3.Selection<any, any, any, any>;
    public store: Store;
    public state: State;
    public config: Config;
    public tooltip: Tooltip;
    public trackRenderer: TrackRenderer;
    public linkRenderer: LinkRenderer;
    public sceneGraph: { visibleSamples: Sample[] } = { visibleSamples: [] };
    
    private listeners: Map<string, Array<(data?: any) => void>>;

    constructor(selector: string, config: Partial<Config> = {}) {
        this.container = d3.select(selector);
        const node = this.container.node() as HTMLElement | null;
        const initialWidth = node ? node.clientWidth - 64 : 800;
        const initialHeight = node ? node.clientHeight - 64 : 600;

        this.svg = this.container.select("svg").empty() ? this.container.append("svg") : this.container.select("svg");
        this.svg.attr("width", initialWidth).attr("height", initialHeight);

        // Setup layers
        this.linkLayer = this.svg.select(".links").empty() ? this.svg.append("g").attr("class", "links") : this.svg.select(".links");
        this.trackLayer = this.svg.select(".tracks").empty() ? this.svg.append("g").attr("class", "tracks") : this.svg.select(".tracks");

        this.store = new Store();
        this.state = this.store.state; // Convenience alias

        this.config = {
            ...{
                width: initialWidth,
                height: initialHeight,
                trackSpacing: 180,
                chromHeight: 25,
                chromMargin: 20,
                labelSize: 11,
                chromStrokeWidth: 1,
                scale: 0.0001,
                startX: 200,
                startY: 100,
                showLabels: true,
                zoom: 1.0
            },
            ...config
        } as Config;

        this.tooltip = new Tooltip();
        this.trackRenderer = new TrackRenderer(this);
        this.linkRenderer = new LinkRenderer(this);

        this.listeners = new Map();
        this._initResizeHandler();
    }

    // --- EVENT SYSTEM ---
    on(event: string, callback: (data?: any) => void) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event)!.push(callback);
        return this;
    }

    emit(event: string, data?: any) {
        if (this.listeners.has(event)) {
            this.listeners.get(event)!.forEach(cb => cb(data));
        }
    }

    use(plugin: { install: (viz: SyntenyViz) => void }) {
        plugin.install(this);
        return this;
    }

    // --- DATA LOADING ---
    async loadTSV(file: File) {
        const text = await file.text();
        this.setData(text);
    }

    setData(tsvText: string) {
        const { samplesMap, groupToIndex } = Parsers.parseTSV(tsvText);

        const samples: Sample[] = [];
        let slot = 0;
        samplesMap.forEach((sInfo, id) => {
            const chroms: Chrom[] = Array.from(sInfo.chroms.values()).map((c, i) => ({ ...c, x_index: i }));
            samples.push({ id, name: id, slot: slot++, chroms, visualChroms: [] });
        });

        this.store.setSamples(samples, groupToIndex);
        this.emit('dataLoaded', samples);

        if (samples.length > 0) {
            this.applyColoring();
            // Wait for DOM to settle
            requestAnimationFrame(() => {
                this.autoScaleToFit();
            });
        }
    }

    // --- COMMANDS ---
    applyColoring() {
        let colors: Record<string, string>;
        if (this.state.colorMode === "ref") {
            colors = ColorPalettes.applyReferenceColoring(this.state);
        } else {
            colors = ColorPalettes.applyGlobalColoring(this.state);
        }

        // Apply user overrides
        Object.keys(this.state.userColors).forEach(groupId => {
            colors[groupId] = this.state.userColors[groupId];
        });

        this.store.updateColoring(colors);
        this.emit('colorChanged', colors);
        this.render(false);
    }

    updateGroupColor(groupId: string, color: string) {
        this.store.updateGroupColor(groupId, color);
        this.render(false);
    }

    autoScaleToFit() {
        const container = this.container.node() as HTMLElement | null;
        const parent = container ? container.parentNode as HTMLElement | null : null;

        if (container) {
            this.config.width = container.clientWidth - 64;
        }

        // IMPORTANT: Use the scrollable PARENT (main) height for the fit calculation
        const viewHeight = parent ? parent.clientHeight : 800;

        if (viewHeight > 0) {
            this.config.height = viewHeight - 64;
        }

        const fitScale = Engine.autoScaleToFit(this.state, this.config);
        this.config.trackSpacing = Engine.autoScaleVertical(this.state, this.config, viewHeight);

        // Update the base "Perfect Fit" scale
        this.state.baseScale = fitScale;

        // Apply current zoom multiplier to the base scale
        this.config.scale = this.state.baseScale * (this.config.zoom || 1.0);

        this.emit('scaleChanged', this.config.scale);
        this.emit('spacingChanged', this.config.trackSpacing);
        this.render();
    }

    render(animate = true) {
        this.sceneGraph = Engine.calculateScene(this.state, this.config);

        // Hard limit check
        if (this.sceneGraph.visibleSamples.length > 15) {
            this.trackLayer.selectAll("*").remove();
            this.linkLayer.selectAll("*").remove();
            this.svg.append("text")
                .attr("class", "error-msg")
                .attr("x", this.config.width / 2)
                .attr("y", 200)
                .attr("text-anchor", "middle")
                .style("font-size", "24px")
                .style("fill", "#ef4444")
                .text("No, this is more than 15, this will not render");
            return;
        }
        this.svg.selectAll(".error-msg").remove();

        this.emit('beforeRender', this.sceneGraph);

        // Transition sync for edges
        if (animate) {
            let start: number | null = null;
            const step = (timestamp: number) => {
                if (!start) start = timestamp;
                const progress = timestamp - start;
                this.renderLinks();
                if (progress < 400) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }

        // Dynamic Sizing adjustment - Ensure we fit content
        const spacingTotal = Math.max(0, this.sceneGraph.visibleSamples.length - 1) * this.config.trackSpacing;
        const neededHeight = this.config.startY + spacingTotal + 100;

        // Calculate max horizontal content width
        const maxTrackWidth = d3.max(this.sceneGraph.visibleSamples, (s: Sample) => {
            if (!s.visualChroms.length) return 0;
            const last = s.visualChroms[s.visualChroms.length - 1];
            return (last.absX ?? 0) + (last.size * this.config.scale) + this.config.startX + 100;
        }) || this.config.width;

        this.config.height = Math.max(800, neededHeight);

        this.svg.attr("width", Math.max(this.config.width, maxTrackWidth));
        this.svg.attr("height", this.config.height);

        this.linkRenderer.render(this.sceneGraph.visibleSamples);
        this.trackRenderer.render(this.sceneGraph.visibleSamples, animate);

        this.emit('afterRender', this.sceneGraph);
    }

    renderLinks() {
        const scene = this.sceneGraph || Engine.calculateScene(this.state, this.config);
        this.linkRenderer.render(scene.visibleSamples);
    }

    renameGenome(id: string, name: string) {
        this.store.renameGenome(id, name);
        this.emit('genomeRenamed', { id, name });
        this.render(false);
    }

    /**
     * Rearranges chromosomes of a target genome to align with a neighbor.
     */
    sortChromosomesByNeighbor(targetId: string, neighborId: string) {
        const targetSample = this.store.state.samples.find(s => s.id === targetId);
        const neighborSample = this.store.state.samples.find(s => s.id === neighborId);
        
        if (!targetSample || !neighborSample) {
            console.error("Samples not found", { targetId, neighborId });
            return;
        }

        // neighborSample.chroms is an array of chromosome objects
        const neighborChroms = [...neighborSample.chroms];
        neighborChroms.sort((a, b) => (a.x_index || 0) - (b.x_index || 0));

        const neighborOffsets = new Map<string, number>();
        let currentX = 0;
        neighborChroms.forEach(c => {
            neighborOffsets.set(c.id, currentX);
            currentX += c.size * this.config.scale + this.config.chromMargin;
        });

        const chromScores: Array<{ chrom: Chrom, score: number }> = [];
        targetSample.chroms.forEach(chrom => {
            const positions: number[] = [];
            chrom.blocks.forEach(block => {
                if (!block.linked) return;
                const group = this.store.state.groupToIndex.get(block.group);
                if (!group) return;

                const neighborBlock = group.find(b => b.sampleId === neighborId);
                if (neighborBlock) {
                    const offset = neighborOffsets.get(neighborBlock.chromId);
                    if (offset !== undefined) {
                        const pos = offset + (neighborBlock.start * this.config.scale);
                        positions.push(pos);
                    }
                }
            });

            if (positions.length > 0) {
                positions.sort((a, b) => a - b);
                const median = positions[Math.floor(positions.length / 2)];
                chromScores.push({ chrom, score: median });
            } else {
                chromScores.push({ chrom, score: Infinity });
            }
        });

        chromScores.sort((a, b) => a.score - b.score);
        chromScores.forEach((item, index) => {
            item.chrom.x_index = index;
        });

        this.showToast(`Rearranged ${targetSample.name} to align with ${neighborSample.name}`);
        this.render(true);
    }

    showToast(msg: string) {
        this.emit('toast', msg);
    }

    _initResizeHandler() {
        const node = this.container.node() as HTMLElement | null;
        if (!node) return;
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === node) {
                    // contentRect.width is the inner content area (no padding/border)
                    this.config.width = entry.contentRect.width;
                    this.autoScaleToFit();
                }
            }
        });
        observer.observe(node);
    }
}
