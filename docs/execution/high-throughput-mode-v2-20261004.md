# ServiceDesk AI — High-Throughput Execution Mode v2

Date: 2026-10-04
Coordinator: GPT-5.6 Sol High
Workers: GPT-5.5 High
Status: ACTIVE from Cycle 5

## Goal

Maximize useful implementation per worker invocation. Each worker batch is sized for roughly 20–30 minutes of active implementation work when the model/runtime permits. This is a workload target, not a wall-clock guarantee.

The previous failure mode was excessive per-run overhead:
- repeated DNS/package probes;
- rereading long coordination documents;
- one narrow defect per run;
- one commit per micro-change;
- long narrative receipts;
- waiting for all three lanes before issuing more work.

This protocol replaces that workflow.

## Worker fast start

Every worker run must:
1. Read `AGENTS.md`.
2. Read `docs/execution/runtime-outage-mode-20261004.md`.
3. Read this document.
4. Read only its assigned batch packet.
5. Verify the current worker branch HEAD and preserve legitimate newer commits.
6. Make exactly one short normal-runtime recovery probe.
7. If canonical package access is still blocked, immediately enter Runtime Outage Mode.

Workers do not reread the long coordinator packet unless the assigned batch explicitly says a shared rule changed.

## Batch sizing

A normal batch contains:
- 5–8 substantive READY slices;
- 2–4 independent FALLBACK slices;
- one combined package-free Runtime harness where practical;
- canonical regression tests authored for every changed behavior;
- no more than 3 implementation commits plus one receipt commit.

A worker must not return merely because one slice or one harness passed.

Return is permitted only when one of these is true:
- at least 5 substantive slices are complete;
- every READY and FALLBACK slice in the packet is complete;
- a genuine blocker prevents every remaining authorized slice;
- the runtime/model invocation ends externally.

If the primary queue finishes early, start the FALLBACK queue automatically. Do not ask the coordinator for another task inside the same run.

## Slice execution

For each slice:
- read exact current source;
- reproduce or establish the invariant;
- make the smallest owned change;
- extend canonical tests;
- add the case to the combined outage harness when package-free execution is possible;
- continue immediately to the next READY slice.

Workers should group closely related slices into 2–3 reviewable commits rather than committing each assertion separately.

## Runtime outage mode

During the current DNS/package outage:
- connected GitHub access is the source/read/write transport;
- GPT Runtime `/mnt/data` is the executable scratch machine;
- global Node/TypeScript/ts-node are used for package-free pure logic;
- React/Next/browser/DB/live-provider work remains gated when those dependencies are required.

Outage harness PASS supports `IMPLEMENTED`, not `CONTRACT_TESTED`, `PROVIDER_VERIFIED`, or `OPERATIONS_VERIFIED`.

## Compact receipts

Receipts should be concise, preferably <= 80 lines.

Required fields:
- WORKER / CYCLE
- START_SHA
- IMPLEMENTATION_SHA
- FINAL_SHA
- STATE
- CANONICAL_GATE
- CHANGED_FILES
- COMPLETED_SLICES
- OUTAGE_HARNESS command + result
- CANONICAL_COMMANDS executed/not executed
- BLOCKERS
- READY_NEXT

Do not restate whole source files, whole packet text, or lengthy static inventories.

## Coordinator behavior

The GPT-5.6 coordinator maintains:
- one exact active batch per lane;
- one exact backup batch per lane;
- a thematic 10-run horizon.

When any worker returns:
1. verify its current branch head and receipt;
2. compare only the assigned start→final range;
3. inspect risky semantics and ownership;
4. reproduce/inspect the outage harness evidence when required;
5. integrate that worker immediately without waiting for the other two;
6. update ledger/taskboard;
7. promote the lane's backup batch to active;
8. materialize the next backup from the 10-run horizon;
9. return the next worker prompt immediately.

There is no all-workers barrier.

## Coordinator integration efficiency

Prefer:
- compare range once;
- blob-match exact accepted files;
- Git tree commits for multi-file integration;
- minimal evidence-backed dependency closures;
- one integration commit per coherent worker range when possible.

Avoid:
- copying whole divergent worker histories;
- one GitHub write per test assertion;
- repeating canonical probes already known blocked in the same worker run;
- re-auditing unchanged source.

## Ten-run horizon rule

Cycles 5–14 are preplanned thematically. Only the active cycle and one backup cycle are fully source-derived/spec'd at a time. The horizon is a queue, not authorization to skip current proof or ownership rules.

## Throughput health metrics

Coordinator ledger tracks per lane:
- substantive slices completed per run;
- implementation files changed;
- executable outage cases run;
- setup/probe-only runs;
- receipt-only runs;
- integration latency in coordinator turns.

Target:
- zero receipt-only runs while package-free owned work exists;
- >=5 substantive slices per worker run where authorized work exists;
- immediate lane-specific integration and next-batch issue.
