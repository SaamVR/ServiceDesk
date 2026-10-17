# SONIC R33 L07 — evidence-bound Field QA assistant input

Adds a bounded server-side field-quality assessment for already saved visit, evidence and checklist DTOs. Owners/dispatchers can receive a truthful, redacted checklist of missing before/after references, incomplete checklists, and incident review without any model hallucinating photo contents or marking a job clean/paid/approved. Validates exact workspace/visit for all rows, duplicate rows, bounded list sizes and proof of photo reference; never returns raw reference, media, customer or crew identifiers. Even an empty findings list is HUMAN_QA_REVIEW_REQUIRED, not automatic QA pass.

This is a callable planning function. It assumes an authorized server loaded real records; integration into real saved visit server read, Studio UI and owner QA command is a separate lane/acceptance. Not an actual generated AI summary or LIVE approved workflow.
