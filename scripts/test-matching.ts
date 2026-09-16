// Sanity tests for Rule B. Run: npm run test:matching
import { computeMatches, type PickRow } from '../lib/matching';

const T = (x: string, y: string) => 'tok_' + [x, y].sort().join('-');
let failed = 0;

function check(label: string, got: string[], expect: string[]) {
  const g = got.map((t) => t.replace('tok_', '')).sort().join(',');
  const e = [...expect].sort().join(',');
  const ok = g === e;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS ✅' : 'FAIL ❌'}  ${label}  => [${g}] ${ok ? '' : 'expected [' + e + ']'}`);
}

// A-B(1,2) B-C(1,2) C-D(1,1) -> A-B, C-D (two couples)
check(
  'ABCD chain',
  computeMatches([
    { group_id: 'A', rank: 1, token: T('A', 'B') },
    { group_id: 'B', rank: 2, token: T('A', 'B') },
    { group_id: 'B', rank: 1, token: T('B', 'C') },
    { group_id: 'C', rank: 2, token: T('B', 'C') },
    { group_id: 'C', rank: 1, token: T('C', 'D') },
    { group_id: 'D', rank: 1, token: T('C', 'D') },
  ] as PickRow[]),
  ['A-B', 'C-D'],
);

check(
  'simple mutual',
  computeMatches([
    { group_id: 'A', rank: 1, token: T('A', 'B') },
    { group_id: 'B', rank: 1, token: T('A', 'B') },
  ]),
  ['A-B'],
);

check('one-sided', computeMatches([{ group_id: 'A', rank: 1, token: T('A', 'B') }]), []);

// A-B(1,1) contested by B-C(2,1) -> A-B only, C falls through
check(
  'contested top',
  computeMatches([
    { group_id: 'A', rank: 1, token: T('A', 'B') },
    { group_id: 'B', rank: 1, token: T('A', 'B') },
    { group_id: 'B', rank: 2, token: T('B', 'C') },
    { group_id: 'C', rank: 1, token: T('B', 'C') },
  ]),
  ['A-B'],
);

console.log(failed === 0 ? '\nAll matching tests passed.' : `\n${failed} test(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
