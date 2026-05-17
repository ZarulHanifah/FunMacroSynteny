import { State, Sample, Block, Chrom } from '../types.js';
export declare class Store {
    state: State;
    constructor();
    setSamples(samples: Sample[], groupToIndex: Map<string, Block[]>): void;
    updateColoring(colors: Record<string, string>): void;
    toggleHiddenGenome(id: string): void;
    toggleFocusChrom(id: string): void;
    setRefGenome(id: string): void;
    setMinSyntenySize(size: number): void;
    setColorMode(mode: string): void;
    setDraggedSample(sample: Sample | null): void;
    setDraggedChrom(chrom: Chrom | null): void;
    renameGenome(id: string, name: string): void;
    updateGroupColor(groupId: string, color: string): void;
}
