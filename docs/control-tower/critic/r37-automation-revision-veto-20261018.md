# R37 independent critic — workflow revision authority and duplicate-send veto

An AI-suggested draft with unexpected privileged metadata (such as
`permissionGranted`) must not be treated as ordinary reviewed source merely
because the diff only compares allowed fields. Also duplicated identical
SEND_EMAIL_TEMPLATE actions could create redundant customer-outreach approval
requests after publication. Require exact version schema allowlist and reject
duplicate equivalent actions. This review function never publishes rules or
sends messages; critic tests are synthetic-only.
