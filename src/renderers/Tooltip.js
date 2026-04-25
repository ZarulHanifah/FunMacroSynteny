/**
 * Tooltip.js - Logic for showing/hiding tooltips.
 */

export class Tooltip {
    constructor(selector = "#tooltip") {
        this.el = d3.select(selector).empty() ? 
            d3.select("body").append("div").attr("id", "tooltip").attr("class", "tooltip") : 
            d3.select(selector);
    }

    show(e, content) {
        this.el.style("display", "block")
            .style("opacity", 1)
            .html(content)
            .style("left", (e.pageX + 15) + "px")
            .style("top", (e.pageY + 15) + "px");
    }

    move(e) {
        const node = this.el.node();
        const tw = node.offsetWidth;
        let tx = e.pageX + 15;
        let ty = e.pageY + 15;
        
        if (tx + tw > window.innerWidth - 20) tx = e.pageX - tw - 15;
        
        this.el.style("left", tx + "px").style("top", ty + "px");
    }

    hide() {
        this.el.style("display", "none").style("opacity", 0);
    }
}
