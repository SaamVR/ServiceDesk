# R41 CRITIC — one attention cannot prove two action completions

The RPC may return the same linked attention UUID for two distinct CREATE_ATTENTION action rows within one workflow execution. Exact execution linking is not a one-to-one action receipt. An owner-facing "completed 2" count must fail closed when two pending action executions share the same persisted attention. This adversarial test intentionally fails until CORE-A tracks per-execution attention identity uniqueness. No provider send or DB mutation in fixtures.
