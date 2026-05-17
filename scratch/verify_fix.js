
import { Parsers } from './src/utils/Parsers.js';
import { Engine } from './src/core/Engine.js';

const tsvData = `block_id	bin_id	seq_id	start	end	bin_id2	seq_id2	start2	end2
1	GenomeA	Chr1	0	1000	GenomeB	Chr1	0	1000
2	GenomeA	Chr2	0	1000	GenomeB	Chr2	0	1000
`;

const { samplesMap, groupToIndex } = Parsers.parseTSV(tsvData);

console.log("Samples Map Keys:", Array.from(samplesMap.keys()));

const sampleA = samplesMap.get("GenomeA");
const sampleB = samplesMap.get("GenomeB");

console.log("GenomeA Chroms IDs:", Array.from(sampleA.chroms.values()).map(c => c.id));
console.log("GenomeB Chroms IDs:", Array.from(sampleB.chroms.values()).map(c => c.id));

const chromA1 = sampleA.chroms.get("Chr1");
const chromB1 = sampleB.chroms.get("Chr1");

if (chromA1.id === chromB1.id) {
    console.error("FAIL: Chromosome IDs are not unique across genomes!");
} else {
    console.log("PASS: Chromosome IDs are unique across genomes.");
}

// Test weights
const weights = Engine.calculateWeights(groupToIndex);
const key = [chromA1.id, chromB1.id].sort().join("||");
if (weights.has(key)) {
    console.log("PASS: Weights correctly use unique IDs.");
} else {
    console.error("FAIL: Weights missing for unique ID key!");
}
