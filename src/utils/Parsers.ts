import { Block, Chrom } from '../types.js';

interface ParsedSampleInfo {
    id: string;
    name: string;
    chroms: Map<string, Chrom>;
}

export class Parsers {
    /**
     * Parses a TSV string into samples and blocks.
     * @param {string} tsvText - The raw TSV data.
     * @returns {Object} { samplesMap, groupToIndex }
     */
    static parseTSV(tsvText: string): { samplesMap: Map<string, ParsedSampleInfo>, groupToIndex: Map<string, Block[]> } {
        const rows = d3.tsvParse(tsvText);
        const samplesMap = new Map<string, ParsedSampleInfo>();
        const groupToIndex = new Map<string, Block[]>();

        rows.forEach(row => {
            const b1 = row.bin_id;
            const b2 = row.bin_id2;
            const s1 = row.seq_id;
            const seq2 = row.seq_id2;
            const gid = row.block_id;
            if (!b1 || !s1 || !gid) return;

            const hasLink = !!(b2 && b2 !== "null" && seq2 && seq2 !== "null");

            const touch = (bin: string, seq: string, st: string, en: string, block: string) => {
                if (!bin || bin === "null") return null;
                if (!samplesMap.has(bin)) {
                    samplesMap.set(bin, { id: bin, name: bin, chroms: new Map<string, Chrom>() });
                }
                const sample = samplesMap.get(bin)!;
                const chromId = `${bin}||${seq}`;
                if (!sample.chroms.has(seq)) {
                    sample.chroms.set(seq, { id: chromId, name: seq, size: 0, blocks: [], sampleId: bin, x_index: 0, absX: 0 });
                }
                const chrom = sample.chroms.get(seq)!;
                
                const startRaw = parseInt(st);
                const endRaw = parseInt(en);
                const blockObj: Block = {
                    group: block,
                    start: Math.min(startRaw, endRaw),
                    end: Math.max(startRaw, endRaw),
                    tsvStart: startRaw,
                    tsvEnd: endRaw,
                    inverted: (startRaw > endRaw),
                    linked: hasLink,
                    sampleId: bin,
                    chromId: chromId
                };
                
                chrom.size = Math.max(chrom.size, blockObj.end);
                chrom.blocks.push(blockObj);

                if (hasLink) {
                    if (!groupToIndex.has(block)) groupToIndex.set(block, []);
                    groupToIndex.get(block)!.push(blockObj);
                }
                return blockObj;
            };

            touch(b1, s1, row.start || "0", row.end || "0", gid);
            if (hasLink && b2 && seq2) {
                touch(b2, seq2, row.start2 || "0", row.end2 || "0", gid);
            }
        });

        return { samplesMap, groupToIndex };
    }
}
