# CRITIC-01 R31 — durable event completion must require a real internal receipt

Independent test review of CORE-B [PR #639](https://github.com/SaamVR/ServiceDesk/pull/639). The worker currently may mark an event SUCCEEDED when a bridge returns `ok:true` and `providerMessagesSent:0`, even if the bridge's actual state is not `PERSISTED_INTERNAL_QUOTE_ACCEPTED_AUTOMATION` or counter values are impossible.

This adversarial test injects a purported success with a fabricated state and a negative new-rule count. Neither must become a journal ACK. It expects retryable `QUOTE_SOURCE_PROVIDER_RESULT_INVALID` and `completed=0`.

**Critic verdict pending:** tests must be confirmed RED on the previous source, then the core lane should harden the worker's runtime receipt guard and prove GREEN. No live provider, client data, staging/production writes or reviewer self-certification.
