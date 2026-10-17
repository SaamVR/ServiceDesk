# SONIC R34 / L07 saved field quality identity

The existing quality UI model accepted a quality case joined to the wrong visit/workspace, counted cross-tenant attentions by resource ID only and displayed invalid customer feedback as /5. It now fails closed for mismatched saved identity, redacts case text and owner, counts only matching unresolved workspace attention, bounds feedback to 1–5 integer and does not claim fixture previews permit real review requests. This is product-source hardening; no outbound review action is sent and signed-in tenant acceptance is separate.
