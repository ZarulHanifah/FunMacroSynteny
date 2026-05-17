import { State, Config, Sample, Block } from '../types.js';

export class Engine {
    /**
     * Calculates the scene graph based on the current state and configuration.
     */
    static calculateScene(state: State, config: Config): { visibleSamples: Sample[] } {
        let visibleSamples = state.samples.filter(s => !state.hiddenGenomes.has(s.id));
        const weights = this.calculateWeights(state.groupToIndex);

        visibleSamples.forEach(s => {
            s.visualChroms = s.chroms.filter(c => {
                if (state.focusChroms.size === 0) {
                    if (state.minSyntenySize === 0) return true;
                    return state.samples.some(s2 => {
                        if (s.id === s2.id) return false;
                        return s2.chroms.some(c2 => {
                            const w = weights.get([c.id, c2.id].sort().join("||"));
                            return w !== undefined && w >= state.minSyntenySize;
                        });
                    });
                }
                if (state.focusChroms.has(c.id)) return true;
                return Array.from(state.focusChroms).some(fId => {
                    const w = weights.get([c.id, fId].sort().join("||"));
                    return w !== undefined && w >= state.minSyntenySize;
                });
            });
        });

        visibleSamples = visibleSamples.filter(s => s.visualChroms.length > 0);
        visibleSamples.sort((a,b) => a.slot - b.slot).forEach((s, i) => s.visualSlot = i);

        visibleSamples.forEach(sample => {
            let currentX = 0;
            sample.visualChroms.sort((a,b) => (a.x_index ?? 0) - (b.x_index ?? 0)).forEach(c => {
                c.absX = currentX;
                currentX += (c.size * config.scale) + config.chromMargin;
            });
        });

        return { visibleSamples };
    }

    /**
     * Compiles weights for genome pairs based on link data.
     */
    static calculateWeights(groupToIndex: Map<string, Block[]>): Map<string, number> {
        const weights = new Map<string, number>();
        groupToIndex.forEach((members) => {
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

    /**
     * Determines optimal scale to fit current data.
     */
    static autoScaleToFit(state: State, config: Config): number {
        if (!state.samples.length) return config.scale;

        const scene = this.calculateScene(state, config);
        const availableWidth = config.width - config.startX - 100;
        if (scene.visibleSamples.length === 0) return config.scale;

        let bestScale = 0.0001;
        let scaleAssigned = false;

        scene.visibleSamples.forEach(s => {
            const seqSize = d3.sum(s.visualChroms, c => c.size);
            const marginSize = Math.max(0, s.visualChroms.length - 1) * config.chromMargin;

            if (seqSize > 0) {
                const scl = Math.max(0, availableWidth - marginSize) / seqSize;
                if (!scaleAssigned || scl < bestScale) {
                    bestScale = scl;
                    scaleAssigned = true;
                }
            }
        });

        return scaleAssigned ? Math.max(1e-10, bestScale) : config.scale;
    }

    /**
     * Determines optimal track spacing to fit all genomes in view.
     */
    static autoScaleVertical(state: State, config: Config, viewHeight?: number): number {
        const scene = this.calculateScene(state, config);
        const count = scene.visibleSamples.length;
        if (count <= 1) return config.trackSpacing;

        const effectiveHeight = viewHeight || config.height;
        const availableHeight = effectiveHeight - config.startY - 100;
        const idealSpacing = availableHeight / (count - 1);

        // Clamp between 60px (dense) and 200px (default sparse)
        return Math.max(60, Math.min(200, idealSpacing));
    }
}
