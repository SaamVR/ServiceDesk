# SONIC R36 AI-C — unverified customer reply becomes human review

A model-generated response can be stored/displayed as a draft even when its *text* claims a paid invoice, confirmed crew, scheduled booking, or price never verified by saved records. This lane adds a bounded customer reply safety screen before the owner-facing guarded assistant plan is returned. Unsafe text is discarded and replaced with an explicit staff review message, and a requestHumanReview proposal is added. Safe questions remain actionable drafts.

No external message is sent, no quote or payment changed. The screen cannot establish actual booking/price truth: commercial assertions require verified saved business state and an approved template, separately integrated. Covers claim, attack URL, bidi, and oversized payload negatives.
