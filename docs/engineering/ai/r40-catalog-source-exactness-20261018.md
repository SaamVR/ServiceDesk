# R40 AI-C: exact saved service catalog authority

ServiceDesk AI uses active tenant service_catalog rows as its only non-fixture catalog knowledge. The previous loader rejected duplicate row IDs but could still emit competing "approved" citations for two distinct IDs using the same service code. It also accepted JavaScript-normalized impossible timestamps and hidden or accessor-backed row properties.

This lane refuses ambiguous active service codes, invalid civil timestamps/offsets, and untrusted row shape or invisible instruction-shaping text. It preserves the original no-fallback, no-pricing, no-booking-authority contract. Tests verify retrieval for genuine saved services and negative cases. No new provider entitlement, message sends, configuration, or production writes.
