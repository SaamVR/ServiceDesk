# R36 AI-B — Bound AI knowledge citations, fail closed on provenance

Changes the operational model-response citation boundary: a model may not inject arbitrary/hidden/prototype citation fields, synthetic excessive metadata, duplicate references or cite trusted knowledge when no knowledge results were loaded. Reply drafts must be bounded and visible before citation adjudication. This is **metadata validation only**: matching document IDs/versions to actually approved persisted tenant knowledge remains mandatory in the knowledge retrieval path. Model output is never evidence of provider send, payment or verified reply.

Four source tests cover valid, missing, forged and adversarial citation cases. No DB, provider or production changes.
