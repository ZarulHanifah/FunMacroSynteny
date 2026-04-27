/**
 * TrackRenderer.js - Renders genomes, chromosomes, and handle drag interactions.
 */

export class TrackRenderer {
    constructor(viz) {
        this.viz = viz;
        this.trackLayer = viz.trackLayer;
    }

    render(visibleSamples, animate) {
        const { config, state } = this.viz;
        const duration = animate ? 300 : 0;

        const tracks = this.trackLayer.selectAll(".track-group").data(visibleSamples, d => d.id);
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

        // --- Track Dragging Logic ---
        tracksMerged.call(d3.drag()
            .on("start", (e, d) => {
                state.draggedSample = d;
                const [mx, my] = d3.pointer(e, this.trackLayer.node());
                d.dragOffsetY = my - (config.startY + d.visualSlot * config.trackSpacing);
                d3.select(e.sourceEvent.target.parentNode).raise();
            })
            .on("drag", (e, d) => {
                const [mx, my] = d3.pointer(e, this.trackLayer.node());
                d.currentDragY = my - d.dragOffsetY;
                d3.select(document.getElementById(`track-${d.id}`)).attr("transform", `translate(${config.startX}, ${d.currentDragY})`);

                state.samples.forEach(other => {
                    if (other === d) return;
                    const otherY = config.startY + other.visualSlot * config.trackSpacing;
                    if ((d.slot < other.slot && d.currentDragY > otherY - 40) || 
                        (d.slot > other.slot && d.currentDragY < otherY + 40)) {
                        const tmp = d.slot; d.slot = other.slot; other.slot = tmp;
                        this.viz.render(true);
                    }
                });
                this.viz.renderLinks(); 
            })
            .on("end", (e, d) => {
                state.draggedSample = null;
                this.viz.render();
            })
        );

        tracksMerged.select(".track-label").text(d => d.name);

        let selection = tracksMerged.filter(d => d !== state.draggedSample);
        if (animate) {
            selection.transition().duration(300)
                .attr("transform", d => `translate(${config.startX}, ${config.startY + d.visualSlot * config.trackSpacing})`);
        } else {
            selection.attr("transform", d => `translate(${config.startX}, ${config.startY + d.visualSlot * config.trackSpacing})`);
        }

        tracksMerged.filter(d => d === state.draggedSample)
            .attr("transform", d => `translate(${config.startX}, ${d.currentDragY})`);

        tracksMerged.each((d, i, nodes) => {
            this._renderChromosomes(d3.select(nodes[i]), d, animate);
        });
    }

    _renderChromosomes(container, sample, animate) {
        const { config, state } = this.viz;
        const duration = animate ? 300 : 0;

        const chroms = container.selectAll(".chrom-group").data(sample.visualChroms, d => `${sample.id}-${d.id}`);
        chroms.exit().remove();

        const chromsEnter = chroms.enter().append("g").attr("class", "chrom-group")
            .attr("id", d => `chrom-${sample.id}-${d.id}`)
            .on("dblclick", (e, d) => {
                e.stopPropagation();
                d.inverted = !d.inverted;
                this.viz.render();
            })
            .on("contextmenu", (e, d) => {
                e.preventDefault();
                if (d.sampleId !== state.refGenomeId) {
                    this.viz.showToast(`Your ref genome is ${state.refGenomeId}, pick chroms from ${state.refGenomeId}`);
                    return;
                }
                const focused = !state.focusChroms.has(d.id);
                if (focused) state.focusChroms.add(d.id);
                else state.focusChroms.delete(d.id);

                this.viz.showToast(focused ? `Focused on ${d.name}` : `Focus removed for ${d.name}`);
                this.viz.emit('focusChanged');
                this.viz.autoScaleToFit();
            })
            .call(d3.drag()
                .on("start", function(e, d) {
                    state.draggedChrom = d;
                    const [mx] = d3.pointer(e, container.node());
                    d.dragOffsetX = mx - d.absX;
                    d3.select(this).raise();
                })
                .on("drag", (e, d) => {
                    const [mx] = d3.pointer(e, container.node());
                    d.currentDragX = mx - d.dragOffsetX;
                    d3.select(document.getElementById(`chrom-${sample.id}-${d.id}`)).attr("transform", `translate(${d.currentDragX}, 0)`);

                    const center = d.currentDragX + (d.size * config.scale) / 2;
                    sample.visualChroms.forEach(other => {
                        if (other === d) return;
                        const otherCenter = other.absX + (other.size * config.scale) / 2;
                        if ((d.x_index < other.x_index && center > otherCenter) || 
                            (d.x_index > other.x_index && center < otherCenter)) {
                            const tmp = d.x_index; d.x_index = other.x_index; other.x_index = tmp;
                            this.viz.render(true);
                        }
                    });
                    this.viz.renderLinks();
                })
                .on("end", (e, d) => {
                    state.draggedChrom = null;
                    this.viz.render();
                })
            );

        chromsEnter.append("rect").attr("class", "chrom-bar")
            .attr("height", config.chromHeight).attr("rx", 4)
            .style("cursor", "pointer")
            .on("mouseover", (e, d) => {
                this.viz.tooltip.show(e, `<strong>${d.name}</strong><br>Total Size: ${d3.format(",")(d.size)} bp`);
            })
            .on("mousemove", (e, d) => {
                const [mx] = d3.pointer(e);
                let pos = Math.round(mx / config.scale);
                if (d.inverted) pos = d.size - pos;
                pos = Math.max(0, Math.min(d.size, pos));

                // Find the gap range
                const sorted = [...d.blocks].sort((a,b) => a.start - b.start);
                let start = 0, end = d.size;
                for (const b of sorted) {
                    if (b.end <= pos) start = Math.max(start, b.end + 1); // Zarul edited here
                    if (b.start > pos) {
                        end = b.start - 1 ; // Zarul edited here
                        break;
                    }
                }

                this.viz.tooltip.show(e, `
                    <strong>${d.name} (Non-syntenic)</strong><br>
                    Start: ${start.toLocaleString()}<br>
                    End: ${end.toLocaleString()}<br>
                    Size: ${(end - start).toLocaleString()} bp
                `);
            })
            .on("mouseout", () => this.viz.tooltip.hide());

        chromsEnter.append("text").attr("class", "chrom-name").attr("y", config.chromHeight + 15);

        const chromsMerged = chroms.merge(chromsEnter);
        
        const chromsT = animate ? chromsMerged.transition().duration(duration) : chromsMerged;

        chromsT.filter(d => d !== state.draggedChrom)
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
        const { config, state, tooltip } = this.viz;
        const blocks = chromsContainer.selectAll(".block-rect").data(d => d.blocks);
        blocks.exit().remove();
        
        blocks.enter().append("rect").attr("class", "block-rect").attr("height", config.chromHeight)
            .on("mouseover", (e, b) => {
                e.stopPropagation();
                const size = (b.end - b.start).toLocaleString();
                tooltip.show(e, `<strong>Block: ${b.group}</strong><br>Start: ${b.start.toLocaleString()}<br>End: ${b.end.toLocaleString()}<br>Size: ${size} bp<br>Inverted: ${b.inverted}`);
            })
            .on("click", (e, b) => {
                e.stopPropagation();
                const size = (b.end - b.start).toLocaleString();
                this.viz.showToast(`Block ${b.group}: ${b.start.toLocaleString()} - ${b.end.toLocaleString()} (${size} bp)`);
            })
            .on("mouseout", (e) => {
                e.stopPropagation();
                tooltip.hide();
            })
            .merge(blocks)
            .attr("x", (b, i, nodes) => {
                const chrom = d3.select(nodes[i].parentNode).datum();
                return chrom.inverted ? (chrom.size - b.end) * config.scale : b.start * config.scale;
            })
            .attr("width", b => (b.end - b.start) * config.scale)
            .attr("fill", b => b.linked ? (state.colors[b.group] || "#e2e8f0") : "#cbd5e1");
    }
}
