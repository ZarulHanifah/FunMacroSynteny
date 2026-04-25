/**
 * SyntenyViz - A modular, event-driven macrosynteny visualization engine.
 */
class SyntenyViz {
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
        
        this.state = {
            samples: [],
            colors: {},
            hiddenGenomes: new Set(),
            refGenomeId: null,
            focusChroms: new Set(),
            minSyntenySize: 0,
            colorMode: "ref",
            draggedSample: null,
            draggedChrom: null,
            sceneGraph: null
        };

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
                showLabels: true
            },
            ...config
        };

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

    // --- DATA PROCESSING ---
    async loadTSV(file) {
        const text = await file.text();
        const rows = d3.tsvParse(text);
        this.setData(rows);
    }

    setData(rows) {
        const samplesMap = new Map();
        const groupToIndex = new Map(); // Optimization: block_id -> array of block references

        rows.forEach(row => {
            const b1 = row.bin_id;
            const b2 = row.bin_id2;
            const s1 = row.seq_id;
            const seq2 = row.seq_id2;
            const gid = row.block_id;
            const hasLink = (b2 && b2 !== "null" && seq2 && seq2 !== "null");

            const touch = (bin, seq, st, en, block) => {
                if (!bin || bin === "null") return null;
                if (!samplesMap.has(bin)) samplesMap.set(bin, { id: bin, name: bin, chroms: new Map() });
                const sample = samplesMap.get(bin);
                if (!sample.chroms.has(seq)) sample.chroms.set(seq, { id: seq, name: seq, size: 0, blocks: [] });
                const chrom = sample.chroms.get(seq);
                
                const startRaw = parseInt(st);
                const endRaw = parseInt(en);
                const blockObj = {
                    group: block,
                    start: Math.min(startRaw, endRaw),
                    end: Math.max(startRaw, endRaw),
                    tsvStart: startRaw,
                    tsvEnd: endRaw,
                    inverted: (startRaw > endRaw),
                    linked: hasLink,
                    sampleId: bin,
                    chromId: seq
                };
                
                chrom.size = Math.max(chrom.size, blockObj.end);
                chrom.blocks.push(blockObj);

                // Indexing for O(n) link rendering
                if (hasLink) {
                    if (!groupToIndex.has(block)) groupToIndex.set(block, []);
                    groupToIndex.get(block).push(blockObj);
                }
                return blockObj;
            };

            touch(b1, s1, row.start, row.end, gid);
            if (hasLink) touch(b2, seq2, row.start2, row.end2, gid);
        });

        const samples = [];
        let slot = 0;
        samplesMap.forEach((sInfo, id) => {
            const chroms = Array.from(sInfo.chroms.values()).map((c, i) => ({ ...c, x_index: i }));
            samples.push({ id, name: id, slot: slot++, chroms });
        });

        this.state.samples = samples;
        this.state.groupToIndex = groupToIndex; // Store for renderer
        
        this.emit('dataLoaded', samples);
        
        // Initial Defaults
        if (samples.length > 0) {
            this.state.refGenomeId = samples[0].id;
            this.applyColoring();
            this.autoScaleToFit();
        }
        this.render();
    }

    // --- LAYOUT ENGINE (Scene Graph) ---
    calculateScene() {
        const { state, config } = this;
        let visibleSamples = state.samples.filter(s => !state.hiddenGenomes.has(s.id));
        
        // 1. Filter Visual Chromosomes based on focus and weights
        const weights = this._calculateWeights();

        visibleSamples.forEach(s => {
            s.visualChroms = s.chroms.filter(c => {
                if (state.focusChroms.size === 0) {
                    if (state.minSyntenySize === 0) return true;
                    // Global filter logic
                    return state.samples.some(s2 => {
                        if (s.id === s2.id) return false;
                        return s2.chroms.some(c2 => {
                            const w = weights.get([c.id, c2.id].sort().join("||"));
                            return w !== undefined && w >= state.minSyntenySize;
                        });
                    });
                }
                // Focus mode logic
                if (state.focusChroms.has(c.id)) return true;
                return Array.from(state.focusChroms).some(fId => {
                    const w = weights.get([c.id, fId].sort().join("||"));
                    return w !== undefined && w >= state.minSyntenySize;
                });
            });
        });

        // 2. Remove empty samples and set slots
        visibleSamples = visibleSamples.filter(s => s.visualChroms.length > 0);
        visibleSamples.sort((a,b) => a.slot - b.slot).forEach((s, i) => s.visualSlot = i);

        // 3. Absolute positioning
        visibleSamples.forEach(sample => {
            let currentX = 0;
            sample.visualChroms.sort((a,b) => a.x_index - b.x_index).forEach(c => {
                c.absX = currentX;
                currentX += (c.size * config.scale) + config.chromMargin;
            });
        });

        this.state.sceneGraph = { visibleSamples };
        return this.state.sceneGraph;
    }

    _calculateWeights() {
        const weights = new Map();
        this.state.groupToIndex.forEach((members) => {
            for (let i = 0; i < members.length; i++) {
                for (let j = i + 1; j < members.length; j++) {
                    const m1 = members[i];
                    const m2 = members[j];
                    if (m1.chromId === m2.chromId) continue;
                    const key = [m1.chromId, m2.chromId].sort().join("||");
                    weights.set(key, (weights.get(key) || 0) + (m1.end - m1.start)); 
                }
            }
        });
        return weights;
    }

    // --- RENDERERS ---
    render(animate = true) {
        const scene = this.calculateScene();
        this.emit('beforeRender', scene);

        // Transition sync for edges
        if (animate) {
            let start = null;
            const step = (timestamp) => {
                if (!start) start = timestamp;
                const progress = timestamp - start;
                this._renderLinks(scene.visibleSamples);
                if (progress < 400) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }

        // Dynamic Sizing adjustment
        const neededHeight = this.config.startY + scene.visibleSamples.length * this.config.trackSpacing + 100;
        if (neededHeight > this.config.height) {
            this.config.height = neededHeight;
            this.svg.attr("height", this.config.height);
        }

        this._renderTracks(scene.visibleSamples, animate);
        this._renderLinks(scene.visibleSamples);
        
        this.emit('afterRender', scene);
    }

    _renderTracks(visibleSamples, animate) {
        const { config, state, trackLayer } = this;
        const duration = animate ? 300 : 0;

        const tracks = trackLayer.selectAll(".track-group").data(visibleSamples, d => d.id);
        tracks.exit().remove();

        const tracksEnter = tracks.enter().append("g").attr("class", "track-group")
            .attr("id", d => `track-${d.id}`);

        // Handles for drag
        tracksEnter.append("rect")
            .attr("x", -config.startX).attr("y", 0)
            .attr("width", config.startX).attr("height", config.chromHeight)
            .attr("fill", "transparent").style("cursor", "ns-resize");
        
        tracksEnter.append("text").attr("class", "track-label")
            .attr("x", -10).attr("y", config.chromHeight/2)
            .attr("text-anchor", "end").attr("dominant-baseline", "middle")
            .style("pointer-events", "none");

        const tracksMerged = tracks.merge(tracksEnter);
        const self = this;
        
        tracksMerged.call(d3.drag()
            .on("start", function(e, d) {
                state.draggedSample = d;
                const [mx, my] = d3.pointer(e, trackLayer.node());
                d.dragOffsetY = my - (config.startY + d.visualSlot * config.trackSpacing);
                d3.select(this).raise();
            })
            .on("drag", function(e, d) {
                const [mx, my] = d3.pointer(e, trackLayer.node());
                d.currentDragY = my - d.dragOffsetY;
                d3.select(this).attr("transform", `translate(${config.startX}, ${d.currentDragY})`);
                
                state.samples.forEach(other => {
                    if (other === d) return;
                    const otherY = config.startY + other.visualSlot * config.trackSpacing;
                    if ((d.slot < other.slot && d.currentDragY > otherY - 40) || 
                        (d.slot > other.slot && d.currentDragY < otherY + 40)) {
                        const tmp = d.slot; d.slot = other.slot; other.slot = tmp;
                        self.render(true);
                    }
                });
                self._renderLinks(); 
            })
            .on("end", function(e, d) {
                state.draggedSample = null;
                self.render();
            })
        );

        tracksMerged.select(".track-label").text(d => d.name);
        
        tracksMerged.filter(d => d !== state.draggedSample)
            .transition().duration(duration)
            .attr("transform", d => `translate(${config.startX}, ${config.startY + d.visualSlot * config.trackSpacing})`);
        
        tracksMerged.filter(d => d === state.draggedSample)
            .attr("transform", d => `translate(${config.startX}, ${d.currentDragY})`);

        tracksMerged.each((d, i, nodes) => {
            this._renderChromosomes(d3.select(nodes[i]), d, animate);
        });
    }

    _renderChromosomes(container, sample, animate) {
        const { config, state } = this;
        const duration = animate ? 300 : 0;
        const self = this;

        const chroms = container.selectAll(".chrom-group").data(sample.visualChroms, d => `${sample.id}-${d.id}`);
        chroms.exit().remove();

        const chromsEnter = chroms.enter().append("g").attr("class", "chrom-group")
            .on("dblclick", (e, d) => {
                e.stopPropagation();
                d.inverted = !d.inverted;
                self.render();
            })
            .on("contextmenu", (e, d) => {
                e.preventDefault();
                if (state.focusChroms.has(d.id)) state.focusChroms.delete(d.id);
                else state.focusChroms.add(d.id);
                self.autoScaleToFit();
                self.render();
            })
            .call(d3.drag()
                .on("start", function(e, d) {
                    state.draggedChrom = d;
                    const [mx] = d3.pointer(e, container.node());
                    d.dragOffsetX = mx - d.absX;
                    d3.select(this).raise();
                })
                .on("drag", function(e, d) {
                    const [mx] = d3.pointer(e, container.node());
                    d.currentDragX = mx - d.dragOffsetX;
                    d3.select(this).attr("transform", `translate(${d.currentDragX}, 0)`);
                    
                    const center = d.currentDragX + (d.size * config.scale) / 2;
                    sample.visualChroms.forEach(other => {
                        if (other === d) return;
                        const otherCenter = other.absX + (other.size * config.scale) / 2;
                        if ((d.x_index < other.x_index && center > otherCenter) || 
                            (d.x_index > other.x_index && center < otherCenter)) {
                            const tmp = d.x_index; d.x_index = other.x_index; other.x_index = tmp;
                            self.render(true);
                        }
                    });
                    self._renderLinks(self.state.sceneGraph.visibleSamples);
                })
                .on("end", function(e, d) {
                    state.draggedChrom = null;
                    self.render();
                })
            );

        chromsEnter.append("rect").attr("class", "chrom-bar")
            .attr("height", config.chromHeight).attr("rx", 4)
            .style("cursor", "pointer")
            .on("mouseover", (e, d) => {
                const tooltip = d3.select("#tooltip");
                tooltip.style("display", "block")
                    .html(`<strong>${d.name}</strong><br>Size: ${d3.format(",")(d.size)} bp`);
            })
            .on("mousemove", (e) => {
                const tooltip = d3.select("#tooltip");
                const [mx, my] = d3.pointer(e, document.body);
                const node = tooltip.node();
                const tw = node.offsetWidth;
                let tx = mx + 15;
                let ty = my + 15;
                if (tx + tw > window.innerWidth - 20) tx = mx - tw - 15;
                tooltip.style("left", tx + "px").style("top", ty + "px");
            })
            .on("mouseout", () => d3.select("#tooltip").style("display", "none"));

        chromsEnter.append("text").attr("class", "chrom-name").attr("y", config.chromHeight + 15);

        const chromsMerged = chroms.merge(chromsEnter);
        
        chromsMerged.filter(d => d !== state.draggedChrom)
            .transition().duration(duration)
            .attr("transform", d => `translate(${d.absX}, 0)`);

        chromsMerged.filter(d => d === state.draggedChrom)
            .attr("transform", d => `translate(${d.currentDragX}, 0)`);

        chromsMerged.select(".chrom-bar")
            .attr("width", d => d.size * config.scale);
        
        chromsMerged.select(".chrom-name")
            .attr("x", d => (d.size * config.scale) / 2)
            .text(d => d.name + (d.inverted ? " (rev)" : ""))
            .attr("opacity", config.showLabels ? 1 : 0);

        this._renderBlocks(chromsMerged);
    }

    _renderBlocks(chromsContainer) {
        const { config, state } = this;
        const blocks = chromsContainer.selectAll(".block-rect").data(d => d.blocks);
        blocks.exit().remove();
        
        blocks.enter().append("rect").attr("class", "block-rect").attr("height", config.chromHeight)
            .on("mouseover", (e, b) => this._showTooltip(e, b))
            .on("mousemove", (e) => this._moveTooltip(e))
            .on("mouseout", () => this._hideTooltip())
            .merge(blocks)
            .attr("x", (b, i, nodes) => {
                const chrom = d3.select(nodes[i].parentNode).datum();
                return chrom.inverted ? (chrom.size - b.end) * config.scale : b.start * config.scale;
            })
            .attr("width", b => (b.end - b.start) * config.scale)
            .attr("fill", b => b.linked ? (state.colors[b.group] || "#e2e8f0") : "#cbd5e1");
    }

    _renderLinks(visibleSamples) {
        const { state, config, linkLayer } = this;
        const linksData = [];
        
        const getTrackY = (sampleId) => {
            const node = document.getElementById(`track-${sampleId}`);
            if (node) {
                const transform = d3.select(node).attr("transform");
                if (transform) {
                    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                    if (match) return parseFloat(match[2]);
                }
            }
            const s = state.samples.find(sample => sample.id === sampleId);
            return config.startY + (s ? s.visualSlot : 0) * config.trackSpacing;
        };

        const getChromX = (sampleId, chromId) => {
            const node = document.getElementById(`chrom-${sampleId}-${chromId}`);
            if (node) {
                const transform = d3.select(node).attr("transform");
                if (transform) {
                    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                    if (match) return parseFloat(match[1]);
                }
            }
            const s = state.samples.find(sample => sample.id === sampleId);
            const c = s ? s.chroms.find(ch => ch.id === chromId) : null;
            return c ? c.absX : 0;
        };

        // O(n) Link Generation
        for (let i = 0; i < visibleSamples.length - 1; i++) {
            const s1 = visibleSamples[i];
            const s2 = visibleSamples[i+1];
            
            s1.visualChroms.forEach(c1 => {
                c1.blocks.forEach(b1 => {
                    if (!b1.linked) return;
                    const partners = this.state.groupToIndex.get(b1.group).filter(p => p.sampleId === s2.id);
                    partners.forEach(b2 => {
                        const c2 = s2.visualChroms.find(vc => vc.id === b2.chromId);
                        if (!c2) return;

                        const y1 = getTrackY(s1.id) + config.chromHeight;
                        const y2 = getTrackY(s2.id);
                        
                        const x1_offset = getChromX(s1.id, c1.id);
                        const x2_offset = getChromX(s2.id, c2.id);

                        const getX = (chrom, offset, bp) => {
                            const base = config.startX + offset;
                            return chrom.inverted ? base + (chrom.size - bp) * config.scale : base + bp * config.scale;
                        };

                        linksData.push({
                            group: b1.group,
                            path: [
                                [getX(c1, x1_offset, b1.tsvStart), y1],
                                [getX(c1, x1_offset, b1.tsvEnd), y1],
                                [getX(c2, x2_offset, b2.tsvEnd), y2],
                                [getX(c2, x2_offset, b2.tsvStart), y2]
                            ]
                        });
                    });
                });
            });
        }

        const paths = linkLayer.selectAll(".connector").data(linksData);
        paths.exit().remove();
        paths.enter().append("path").attr("class", "connector")
            .merge(paths)
            .attr("fill", d => state.colors[d.group])
            .attr("opacity", 0.3)
            .attr("d", d => {
                const p = d3.path();
                p.moveTo(d.path[0][0], d.path[0][1]);
                p.lineTo(d.path[1][0], d.path[1][1]);
                p.lineTo(d.path[2][0], d.path[2][1]);
                p.lineTo(d.path[3][0], d.path[3][1]);
                p.closePath();
                return p.toString();
            });
    }

    // --- INTERACTION HELPERS ---
    _setupDragSample() {
        const self = this;
        return d3.drag()
            .on("start", function(e, d) {
                self.state.draggedSample = d;
                d.startY = self.config.startY + d.slot * self.config.trackSpacing;
                d.offsetY = e.y - d.startY;
                d3.select(this).raise();
            })
            .on("drag", function(e, d) {
                d.currentDragY = e.y - d.offsetY;
                d3.select(this).attr("transform", `translate(${self.config.startX}, ${d.currentDragY})`);
                
                self.state.samples.forEach(other => {
                    if (other === d) return;
                    const otherY = self.config.startY + other.slot * self.config.trackSpacing;
                    if (Math.abs(d.currentDragY - otherY) < 40) {
                        const tmp = d.slot; d.slot = other.slot; other.slot = tmp;
                        self.render(true);
                    }
                });
                self._renderLinks(self.state.sceneGraph.visibleSamples);
            })
            .on("end", () => { self.state.draggedSample = null; self.render(); });
    }

    _setupDragChrom() {
        const self = this;
        return d3.drag()
            .on("start", function(e, d) {
                self.state.draggedChrom = d;
                d.offsetX = e.x - d.absX;
                d3.select(this).raise();
            })
            .on("drag", function(e, d) {
                d.currentDragX = e.x - d.offsetX;
                d3.select(this).attr("transform", `translate(${d.currentDragX}, 0)`);

                const sample = self.state.samples.find(s => s.chroms.some(c => c.id === d.id));
                sample.visualChroms.forEach(other => {
                    if (other === d) return;
                    const dCenter = d.currentDragX + (d.size * self.config.scale) / 2;
                    const otherCenter = other.absX + (other.size * self.config.scale) / 2;
                    if ( (d.x_index < other.x_index && dCenter > otherCenter) || (d.x_index > other.x_index && dCenter < otherCenter) ) {
                        const tmp = d.x_index; d.x_index = other.x_index; other.x_index = tmp;
                        self.render(true);
                    }
                });
                self._renderLinks(self.state.sceneGraph.visibleSamples);
            })
            .on("end", () => { self.state.draggedChrom = null; self.render(); });
    }

    // --- TOOLTIP ---
    _showTooltip(e, b) {
        d3.select("#tooltip").style("opacity", 1)
            .html(`<strong>Block: ${b.group}</strong><br>Start: ${b.start.toLocaleString()}<br>End: ${b.end.toLocaleString()}<br>Inverted: ${b.inverted}`)
            .style("left", (e.pageX + 10) + "px").style("top", (e.pageY - 20) + "px");
    }
    _moveTooltip(e) { d3.select("#tooltip").style("left", (e.pageX + 10) + "px").style("top", (e.pageY - 20) + "px"); }
    _hideTooltip() { d3.select("#tooltip").style("opacity", 0); }

    // --- STATE COMMANDS ---
    applyColoring() {
        const { state } = this;
        if (state.colorMode === "ref") {
            const ref = state.samples.find(s => s.id === state.refGenomeId);
            if (!ref) return;
            const palette = d3.schemeCategory10.concat(d3.schemeAccent);
            state.colors = {};
            ref.chroms.forEach((c, i) => {
                const color = palette[i % palette.length];
                c.blocks.forEach(b => { if (b.linked) state.colors[b.group] = color; });
            });
        } else {
            const palette = d3.schemeTableau10;
            let pIdx = 0; state.colors = {};
            state.samples.forEach(s => s.chroms.forEach(c => c.blocks.forEach(b => {
                if (b.linked && !state.colors[b.group]) state.colors[b.group] = palette[pIdx++ % palette.length];
            })));
        }
        this.emit('colorChanged', state.colors);
        this.render(false);
    }

    autoScaleToFit() {
        if (!this.state.samples.length) return;
        
        // Use a virtual scene calculation to find the fit scale
        const scene = this.calculateScene();
        const availableWidth = this.config.width - this.config.startX - 100;
        if (scene.visibleSamples.length === 0) return;

        let bestScale = 0.0001;
        let scaleAssigned = false;

        scene.visibleSamples.forEach(s => {
            const seqSize = d3.sum(s.visualChroms, c => c.size);
            const marginSize = Math.max(0, s.visualChroms.length - 1) * this.config.chromMargin;
            
            if (seqSize > 0) {
                // availableWidth = (seqSize * scale) + marginSize
                const scl = Math.max(0, availableWidth - marginSize) / seqSize;
                if (!scaleAssigned || scl < bestScale) {
                    bestScale = scl;
                    scaleAssigned = true;
                }
            }
        });

        if (scaleAssigned) {
            this.state.baseScale = Math.max(1e-10, bestScale);
            this.config.zoom = 1.0;
            this.config.scale = this.state.baseScale * this.config.zoom;
            this.emit('scaleChanged', this.config.scale);
        }
    }

    _initResizeHandler() {
        window.addEventListener('resize', () => {
            const main = document.getElementById('main');
            if (main) {
                this.config.width = main.clientWidth - 64;
                this.config.height = main.clientHeight - 64;
                this.svg.attr("width", this.config.width).attr("height", this.config.height);
                this.render();
            }
        });
    }
}
