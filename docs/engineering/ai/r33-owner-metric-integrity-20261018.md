# L05 R33 — Owner metrics are facts, not AI inventions

Strengthens the existing owner intelligence entrypoint `explainOwnerMetric`. This function serves read-only source-derived explanations, not a generative model. It now rejects malformed/untrusted provenance, invalid/reversed/overwide windows, unrecognized metric keys and NaN/negative/oversized values before producing owner-visible text. Exact saved count/amount values remain from CORE_METRICS, never model inferred. The check is owner- and tenant-scoped; no new provider call or business mutation.

Evidence levels: contract only until a connected owner source is available. No new event types or application screen claimed.
