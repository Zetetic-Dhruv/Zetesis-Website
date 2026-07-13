import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const samplePath = resolve(process.argv[2] || 'test/fixtures/confidence-human-sample.json');
const dhruv = read(process.argv[3]);
const gopika = read(process.argv[4]);
if (dhruv.reviewer !== 'dhruv' || gopika.reviewer !== 'gopika') throw new Error('Expected independent Dhruv and Gopika label exports.');
const sample = readFile(samplePath);
sample.reviewers = { dhruv: dhruv.reviewer, gopika: gopika.reviewer };
const byReviewer = { dhruv: new Map(dhruv.cases.map((item) => [item.caseId, item])), gopika: new Map(gopika.cases.map((item) => [item.caseId, item])) };
for (const item of sample.cases) {
  for (const reviewer of ['dhruv', 'gopika']) {
    const label = byReviewer[reviewer].get(item.caseId);
    if (!label?.band) throw new Error(`Missing ${reviewer} label for ${item.caseId}.`);
    item[reviewer] = { band: label.band, notes: label.notes || '' };
  }
}
writeFileSync(samplePath, `${JSON.stringify(sample, null, 2)}\n`);
console.log('Merged independent human labels into the stratified sample.');

function read(path) {
  if (!path) throw new Error('Usage: node scripts/merge-human-labels.mjs sample.json dhruv.json gopika.json');
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}
