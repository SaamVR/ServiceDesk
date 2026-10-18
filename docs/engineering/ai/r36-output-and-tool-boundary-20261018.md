# R36 L-A — AI extraction and tool-call safety

Real source feature: closes silent schema widening in the central AI extraction guard, enforces bounded redacted text/lists, rejects hidden/prototype/accessor fields, validates nested tool proposal arguments, and converts >8 tool calls into **one mandatory human review** rather than accepting the first eight and hiding the ninth. This protects AI-assisted intake and tool suggestions, not the final facade authorization (which remains mandatory).

Adversarial tests include hidden payment permissions, invalid PII fields, overflow and nested payloads. No provider credentials, messages, bookings, price or ledger effects. Signed-in end-to-end Studio evidence remains separate.
