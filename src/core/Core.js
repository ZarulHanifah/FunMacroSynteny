/**
 * Core.js - The main entry point and event coordinator.
 */
import { Store } from './Store.js';
import { Engine } from './Engine.js';
import { TrackRenderer } from '../renderers/TrackRenderer.js';
import { LinkRenderer } from '../renderers/LinkRenderer.js';
import { Tooltip } from '../renderers/Tooltip.js';
import { Parsers } from '../utils/Parsers.js';
import { ColorPalettes } from '../utils/ColorPalettes.js';

export class SyntenyViz {
    constructor(selector, config = {}) {
        this.container = d3.select(selector);
        const node = this.container.node();
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
                scale: 0.0001,
                startX: 200,
                startY: 100,
                showLabels: true,
                zoom: 1.0
            },
            ...config
        };

        this.tooltip = new Tooltip();
        this.trackRenderer = new TrackRenderer(this);
        this.linkRenderer = new LinkRenderer(this);

        this.listeners = new Map();
        this._initResizeHandler();
    }

    // --- EVENT SYSTEM ---
    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
        return this;
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }

    use(plugin) {
        plugin.install(this);
        return this;
    }

    // --- DATA LOADING ---
    async loadTSV(file) {
        const text = await file.text();
        this.setData(text);
    }

    setData(tsvText) {
        const { samplesMap, groupToIndex } = Parsers.parseTSV(tsvText);
        
        const samples = [];
        let slot = 0;
        samplesMap.forEach((sInfo, id) => {
            const chroms = Array.from(sInfo.chroms.values()).map((c, i) => ({ ...c, x_index: i }));
            samples.push({ id, name: id, slot: slot++, chroms });
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
        let colors;
        if (this.state.colorMode === "ref") {
            colors = ColorPalettes.applyReferenceColoring(this.state);
        } else {
            colors = ColorPalettes.applyGlobalColoring(this.state);
        }
        this.store.updateColoring(colors);
        this.emit('colorChanged', colors);
        this.render(false);
    }

    autoScaleToFit() {
        const container = this.container.node();
        const parent = container ? container.parentNode : null;
        
        if (container) {
            this.config.width = container.clientWidth - 64;
        }

        // IMPORTANT: Use the scrollable PARENT (main) height for the fit calculation
        const viewHeight = parent ? parent.clientHeight : 800;
        
        if (viewHeight > 0) {
            this.config.height = viewHeight - 64;
        }

        this.config.scale = Engine.autoScaleToFit(this.state, this.config);
        this.config.trackSpacing = Engine.autoScaleVertical(this.state, this.config, viewHeight);
        
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
            let start = null;
            const step = (timestamp) => {
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
        this.config.height = Math.max(800, neededHeight);
        
        this.svg.attr("width", this.config.width);
        this.svg.attr("height", this.config.height);

        this.trackRenderer.render(this.sceneGraph.visibleSamples, animate);
        this.linkRenderer.render(this.sceneGraph.visibleSamples);
        
        this.emit('afterRender', this.sceneGraph);
    }

    renderLinks() {
        const scene = this.sceneGraph || Engine.calculateScene(this.state, this.config);
        this.linkRenderer.render(scene.visibleSamples);
    }

    showToast(msg) {
        this.emit('toast', msg);
    }

    _initResizeHandler() {
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === this.container.node()) {
                    // contentRect.width is the inner content area (no padding/border)
                    this.config.width = entry.contentRect.width;
                    this.autoScaleToFit();
                }
            }
        });
        observer.observe(this.container.node());
    }
}
