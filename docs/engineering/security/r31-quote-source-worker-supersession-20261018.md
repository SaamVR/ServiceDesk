# R31 CORE-B — durable quote source lease and supersession truth

The recovery worker checks the saved quote after claiming a durable 0063 `QUOTE_ACCEPTED` event. Previously it accepted only `status=ACCEPTED`, potentially creating new internal work for a quote replaced after the original acceptance.

New source behavior:
- Check exact accepted milestone `accepted_at`, saved `workspace_id`, exact quote/request identity and non-malformed supersession.
- A **genuinely superseded accepted** quote is acknowledged **SKIPPED**, never successful and never replayed to create a fresh workflow. This prevents an endless retry/dead-letter for a terminal obsolete source while preserving truthful event history.
- Accepted-looking rows missing a persisted acceptance milestone or carrying malformed supersession are transient failures and retain retry/dead-letter handling rather than silently passing.
- Revalidate the `event_type=QUOTE_ACCEPTED` from the independent live lease read, not just the initial claim snapshot. A changed/forged source type blocks all internal action.

Regression tests prove positive/current source, skipped supersession, missing fact failures, event-type drift, failed lease and remaining default-off behavior.

Only core worker files changed. Still SOURCE/CONTRACT tested, not a claim of connected 0063 installation, real owner authorization, production scheduling, provider sends or merchant UAT. No connected writes or device use.
