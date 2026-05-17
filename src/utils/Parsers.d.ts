import { Block, Chrom } from "../types.js";
interface ParsedSampleInfo {
    id: string;
    name: string;
    chroms: Map<string, Chrom>;
}
export declare class Parsers {
    /**
     * Parses a TSV string into samples and blocks.
     * @param {string} tsvText - The raw TSV data.
     * @returns {Object} { samplesMap, groupToIndex, detectedStrandColumn, hasInvertedBlocks }
     */
    static parseTSV(tsvText: string): {
        samplesMap: Map<string, ParsedSampleInfo>;
        groupToIndex: Map<string, Block[]>;
        detectedStrandColumn: boolean;
        hasInvertedBlocks: boolean;
    };
}
export {};
