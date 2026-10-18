/** Renders test/integration/rbac-matrix.ts as docs/rbac-matrix.md.  npx ts-node --transpile-only scripts/gen-rbac-doc.ts */
import * as fs from 'fs';
import * as path from 'path';
import { MATRIX } from '../test/integration/rbac-matrix';
import { ACTORS } from '../test/integration/rbac-world';

const actors = ACTORS.filter((a) => a !== 'anon');
const rows = Object.entries(MATRIX).sort(([a], [b]) => a.localeCompare(b));
const cell = (rule: (typeof rows)[number][1], a: string) =>
  rule.public ? '·' : rule.allow.includes(a as never) ? '✅' : (rule.either ?? []).includes(a as never) ? '◻︎' : '⛔';
const out = [
  '# RBAC matrix',
  '',
  'Generated from `backend/test/integration/rbac-matrix.ts` (`npx ts-node --transpile-only scripts/gen-rbac-doc.ts`).',
  'The integration suite sends every route as every actor below against a real database: ⛔ cells must answer 401/403/404, ✅ cells must not be blocked.',
  '',
  '✅ allowed · ⛔ refused · ◻︎ not asserted (system admin writes depend on a support grant) · · public (no login)',
  '',
  `| Route | ${actors.join(' | ')} |`,
  `|---|${actors.map(() => ':---:').join('|')}|`,
  ...rows.map(([route, rule]) => `| \`${route.replace('/api', '')}\`${rule.skip ? ' (skipped: ' + rule.skip + ')' : ''} | ${actors.map((a) => cell(rule, a)).join(' | ')} |`),
  '',
  `${rows.length} routes × ${actors.length + 1} actors (anonymous is refused everywhere except the public routes).`,
  '',
];
fs.writeFileSync(path.resolve(__dirname, '../../docs/rbac-matrix.md'), out.join('\n'));
console.log(`wrote docs/rbac-matrix.md (${rows.length} routes)`);
