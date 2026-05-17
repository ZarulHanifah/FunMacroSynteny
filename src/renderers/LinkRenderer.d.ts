import type { SyntenyViz } from '../core/Core.js';
import { Sample } from '../types.js';
export declare class LinkRenderer {
    private viz;
    private linkLayer;
    constructor(viz: SyntenyViz);
    render(visibleSamples: Sample[]): void;
}
