# CRITIC-01 R31 — saved attention proof must survive interrupted worker and replay

This critic works independently of CORE-C [PR #641](https://github.com/SaamVR/ServiceDesk/pull/641). Its post-write check applies only when an attention action is newly attempted.

**Fault:** A replay of an already `SUCCEEDED` CREATE_ATTENTION action can treat the saved action row alone as proof even after the linked attention record has disappeared or been replaced with an unrelated row. The worker then reports a successful persisted internal follow-up that no longer has a visible saved attention record. This compromises the portfolio workflow inspector's truthfulness.

**Adversarial acceptance:** replay a duplicate LIVE execution with completed action and (a) missing attention item, (b) wrong execution resource ID or (c) wrong attention type. No fresh action should be executed, and all cases must fail `QUOTE_AUTOMATION_ATTENTION_UNVERIFIED` rather than ACK. The legitimate positive replay remains reusable.

The core owner should add a bounded, same-workspace final attention readback even for previously succeeded actions. This proves at least one linked saved attention for the execution; without an action→attention FK it does not prove one distinct attention per action. Require combined CI before merge. Synthetic tests are not merchant UAT.
