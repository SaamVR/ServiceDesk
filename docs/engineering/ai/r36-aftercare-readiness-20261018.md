# R36 C12 — truthful consent-aware aftercare review summary

Adds a real owner-relevant review digest to the persisted completion/consent batch planner: reviewSuggested and oldestReadyAt are computed only from sorted eligible, saved completion records. They are not provider schedule times, sent messages, or automatic customer outreach. Fail closed on impossible/uncivil source clock and sparse/accessor arrays even when the queue is empty (previously could claim zero work with unverified time). No consent bypass, payment or message action.

Source-level tests cover positive, empty, invalid timestamp and model/connector poisoned array cases. Signed-in merchant owner QA and WhatsApp/email provider receipts remain separate gates.
