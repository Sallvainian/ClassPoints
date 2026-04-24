#!/usr/bin/env node
// Bundle DCE assertion for NFR4 — prod bundle must not contain react-query-devtools.
// Runs after `vite build`. Two independent checks:
//   1. No chunk filename matches /devtools/i (Rollup would emit a devtools-named
//      chunk if `lazy(() => import('@tanstack/react-query-devtools'))` leaked to
//      module scope).
//   2. No emitted .js (excluding .map) references the package string or the
//      ReactQueryDevtools identifier (defense against side-effectful top-level
//      code that survives JSX dead-coding).
// The devtools DCE pattern lives in src/main.tsx — see docs/adr/ADR-005.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const ASSETS = join(DIST, 'assets');
const FORBIDDEN_PATTERNS = ['react-query-devtools', 'ReactQueryDevtools'];

if (!existsSync(ASSETS)) {
  console.error(`FAIL: ${ASSETS}/ does not exist — run \`vite build\` first.`);
  process.exit(1);
}

const failures = [];
const files = readdirSync(ASSETS);

const devtoolsChunks = files.filter((f) => /devtools/i.test(f));
if (devtoolsChunks.length > 0) {
  failures.push(
    `chunk filename(s) match /devtools/i: ${devtoolsChunks.join(', ')} ` +
      `— devtools leaked out of the DEV-gated dynamic import`
  );
}

const jsFiles = files.filter((f) => f.endsWith('.js') && !f.endsWith('.map'));
for (const file of jsFiles) {
  const full = join(ASSETS, file);
  const content = readFileSync(full, 'utf8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (content.includes(pattern)) {
      failures.push(`${full} contains "${pattern}"`);
    }
  }
}

if (failures.length > 0) {
  console.error('\nBundle DCE check FAILED:\n');
  for (const f of failures) console.error('  - ' + f);
  console.error('\nFix: verify src/main.tsx keeps the useEffect-gated dynamic import pattern.');
  console.error('See docs/adr/ADR-005-queryclient-defaults.md § Devtools DCE pattern.\n');
  process.exit(1);
}

console.log(
  `Bundle DCE check passed: scanned ${jsFiles.length} JS files and ${files.length} total assets; no devtools leakage.`
);
