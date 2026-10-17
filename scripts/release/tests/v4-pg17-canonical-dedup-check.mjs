import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("canonical PG17 retains real SQL/worker proof and delegates only duplicate full build",()=>{
  const worker=readFileSync(".github/workflows/v4-quote-recovery-integrated-pg17.yml","utf8");
  const source=readFileSync(".github/workflows/v4-reconciled-full-rc.yml","utf8");

  assert.match(worker,/pg17-journal-and-concurrency:/);
  assert.match(worker,/pg17-two-tenant-crash-recovery:/);
  assert.match(worker,/private-http-worker-and-source-rc:/);
  assert.match(worker,/v4-quote-source-pg17-concurrency\.sh/);
  assert.match(worker,/v4-quote-source-pg17-two-tenant-resilience\.sql/);
  assert.match(worker,/v4-quote-source-protected-worker-http\.test\.ts/);
  assert.match(worker,/run: pnpm check:rc/);
  assert.match(worker,/if: github\.event_name != 'push' \|\| github\.ref != 'refs\/heads\/feat\/servicedesk-v4-reconciled-qa-shell-20261012'/);
  assert.match(worker,/if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/feat\/servicedesk-v4-reconciled-qa-shell-20261012'/);

  // Canonical exact-source RC still independently builds and exercises the
  // real browser before any isolated Render review promotion is accepted.
  assert.match(source,/feat\/servicedesk-v4-reconciled-qa-shell-20261012/);
  assert.match(source,/run: pnpm check:rc/);
  assert.match(source,/Real Chrome public responsive proof/);
  assert.match(source,/Real Chrome synthetic operations journey/);
});
