# R31 CORE-C — exact persisted attention resource post-write readback

The trusted QUOTE_ACCEPTED bridge previously checked only the returned `attention_items.id` and `workspace_id` after a successful attention-action RPC. An unrelated saved attention item in the same business would satisfy that check, making a false workflow outcome possible.

The readback now requires the exact saved row's `id`, `workspace_id`, `resource_type='workflow_execution'`, `resource_id` equal to the **specific persisted workflow execution**, and `type='WORKFLOW_RULE'`. Wrong resource, wrong attention type or wrong resource category fails closed. This aligns the runtime guard with the independent merchant SQL causal-chain verifier introduced in R29.

Tests exercise all three adversarial same-tenant impostors. This is contract/source verification only; no connected workflow history currently exists and no service-role action, provider send, payment or deployment was performed.
