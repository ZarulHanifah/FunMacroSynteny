export declare class Tooltip {
    private el;
    constructor(selector?: string);
    show(e: MouseEvent, content: string): void;
    move(e: MouseEvent): void;
    hide(): void;
}
