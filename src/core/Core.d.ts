import { Store } from './Store.js';
import { TrackRenderer } from '../renderers/TrackRenderer.js';
import { LinkRenderer } from '../renderers/LinkRenderer.js';
import { Tooltip } from '../renderers/Tooltip.js';
import { State, Config, Sample } from '../types.js';
export declare class SyntenyViz {
    container: d3.Selection<any, any, any, any>;
    svg: d3.Selection<any, any, any, any>;
    linkLayer: d3.Selection<any, any, any, any>;
    trackLayer: d3.Selection<any, any, any, any>;
    store: Store;
    state: State;
    config: Config;
    tooltip: Tooltip;
    trackRenderer: TrackRenderer;
    linkRenderer: LinkRenderer;
    sceneGraph: {
        visibleSamples: Sample[];
    };
    private listeners;
    constructor(selector: string, config?: Partial<Config>);
    on(event: string, callback: (data?: any) => void): this;
    emit(event: string, data?: any): void;
    use(plugin: {
        install: (viz: SyntenyViz) => void;
    }): this;
    loadTSV(file: File): Promise<void>;
    setData(tsvText: string): Promise<void>;
    applyColoring(): void;
    updateGroupColor(groupId: string, color: string): void;
    autoScaleToFit(): void;
    render(animate?: boolean): void;
    renderLinks(): void;
    renameGenome(id: string, name: string): void;
    /**
     * Rearranges chromosomes of a target genome to align with a neighbor.
     */
    sortChromosomesByNeighbor(targetId: string, neighborId: string): void;
    showToast(msg: string): void;
    showDisclaimer(title: string, message: string): Promise<void>;
    _initResizeHandler(): void;
}
