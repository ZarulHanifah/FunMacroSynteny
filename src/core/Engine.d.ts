import { State, Config, Sample, Block } from '../types.js';
export declare class Engine {
    /**
     * Calculates the scene graph based on the current state and configuration.
     */
    static calculateScene(state: State, config: Config): {
        visibleSamples: Sample[];
    };
    /**
     * Compiles weights for genome pairs based on link data.
     */
    static calculateWeights(groupToIndex: Map<string, Block[]>): Map<string, number>;
    /**
     * Determines optimal scale to fit current data.
     */
    static autoScaleToFit(state: State, config: Config): number;
    /**
     * Determines optimal track spacing to fit all genomes in view.
     */
    static autoScaleVertical(state: State, config: Config, viewHeight?: number): number;
}
