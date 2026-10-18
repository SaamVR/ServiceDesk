# R41 CORE-D — recurring-service RPC receipt integrity

SQL `servicedesk_materialize_due_recurrences` returns one saved occurrence descriptor per actually created request. Previously client `flatMap` silently discarded malformed descriptors and still returned original materializedCount as success. The hardened adapter accepts the receipt only if count and bounded dense array agree, every row has exact shape, valid UUIDs/sequence/calendar/timestamp, and no repeated occurrence or request IDs. Failure reports a safe machine error, not an incorrect completed automation.

This is a post-RPC readback/contract safeguard; it cannot reverse a transaction the database already committed. Production materialization, tenant authorization, capacity allocation and real customer scheduling still require separate operator acceptance. No migration or provider sends in this PR.
