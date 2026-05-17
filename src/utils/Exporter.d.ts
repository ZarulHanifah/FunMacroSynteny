import type { SyntenyViz } from '../core/Core.js';
/**
 * Exporter.ts - FULL FIDELITY Standalone version in TypeScript.
 */
export declare class Exporter {
    static exportSVG(svgNode: SVGElement): void;
    static exportPNG(svgNode: SVGElement): void;
    static exportHTML(viz: SyntenyViz): Promise<void>;
    static _inlineStyles(svgNode: SVGElement): void;
    static _download(url: string, filename: string): void;
}
