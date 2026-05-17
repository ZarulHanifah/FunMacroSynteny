import { State } from '../types.js';
export declare class ColorPalettes {
    /**
     * Applies color mapping based on the reference genome.
     */
    static applyReferenceColoring(state: State): Record<string, string>;
    /**
     * Applies global color mapping for all linked blocks.
     */
    static applyGlobalColoring(state: State): Record<string, string>;
}
