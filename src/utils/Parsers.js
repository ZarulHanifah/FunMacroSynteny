/**
 * Parsers.js - Logic for converting raw bioinformatics data into internal structures.
 */

export class Parsers {
    /**
     * Parses a TSV string into samples and blocks.
     * @param {string} tsvText - The raw TSV data.
     * @returns {Object} { samplesMap, groupToIndex }
     */
    static parseTSV(tsvText) {
        const rows = d3.tsvParse(tsvText);
        const samplesMap = new Map();
        const groupToIndex = new Map();

        rows.forEach(row => {
            const b1 = row.bin_id;
            const b2 = row.bin_id2;
            const s1 = row.seq_id;
            const seq2 = row.seq_id2;
            const gid = row.block_id;
            const hasLink = (b2 && b2 !== "null" && seq2 && seq2 !== "null");

            const touch = (bin, seq, st, en, block) => {
                if (!bin || bin === "null") return null;
                if (!samplesMap.has(bin)) samplesMap.set(bin, { id: bin, name: bin, chroms: new Map() });
                const sample = samplesMap.get(bin);
                if (!sample.chroms.has(seq)) sample.chroms.set(seq, { id: seq, name: seq, size: 0, blocks: [], sampleId: bin });
                const chrom = sample.chroms.get(seq);
                
                const startRaw = parseInt(st);
                const endRaw = parseInt(en);
                const blockObj = {
                    group: block,
                    start: Math.min(startRaw, endRaw),
                    end: Math.max(startRaw, endRaw),
                    tsvStart: startRaw,
                    tsvEnd: endRaw,
                    inverted: (startRaw > endRaw),
                    linked: hasLink,
                    sampleId: bin,
                    chromId: seq
                };
                
                chrom.size = Math.max(chrom.size, blockObj.end);
                chrom.blocks.push(blockObj);

                if (hasLink) {
                    if (!groupToIndex.has(block)) groupToIndex.set(block, []);
                    groupToIndex.get(block).push(blockObj);
                }
                return blockObj;
            };

            touch(b1, s1, row.start, row.end, gid);
            if (hasLink) touch(b2, seq2, row.start2, row.end2, gid);
        });

        return { samplesMap, groupToIndex };
    }
}
