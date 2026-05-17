import type { SyntenyViz } from '../core/Core.js';
import { Sample, Chrom, Block } from '../types.js';
export declare class TrackRenderer {
    private viz;
    private trackLayer;
    private static canvas;
    constructor(viz: SyntenyViz);
    render(visibleSamples: Sample[], animate: boolean): void;
    _renderChromosomes(container: d3.Selection<any, any, any, any>, sample: Sample, animate: boolean): void;
    _renderBlocks(chromsContainer: d3.Selection<any, any, any, any>): void;
    _showRenameInput(event: MouseEvent, sample: Sample): void;
    _showChromContextMenu(event: MouseEvent, d: Chrom, b?: Block | null): void;
    static measureText(text: string, font: string): number;
}
