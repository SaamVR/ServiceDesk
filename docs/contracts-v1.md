# ServiceDesk AI V1 frozen contracts

Status: **FROZEN FOR BATCH 0 WORKERS**. Shared changes require Chat 1 integrator review.

## Context and command envelope
- `ActorContext { userId?, visitorSessionId?, workspaceId, role }`
- `CommandMeta { idempotencyKey, expectedVersion?, now }`
- `Result<T> = { ok:true,value:T } | { ok:false,code,message }`

## DTOs
`RequestDTO`, `QuoteDTO`, `SlotDTO`, `VisitDTO`, `InvoiceDTO`, `ConversationDTO`, `IntegrationStatusDTO`, `AttentionItemDTO` are exported from `src/contracts/index.ts`.

Money is represented in integer minor units. Date-times cross the contract boundary as ISO-8601 strings. Workspace ID is explicit on tenant-owned DTOs.

## Core facade
`ServiceDeskFacade` defines createRequest, updateRequest, calculateQuote, sendQuote, findSlots, holdSlot, applyVerifiedPayment, transitionVisit and readWorkspaceSnapshot.

Providers and UI call the facade/API boundary; they do not write business tables directly.

## Frozen pricing proof
Move-out fixture: base $180 / 120m + $30 / 20m per bedroom + $20 / 15m per bathroom + oven $30 / 30m. For 3 bedrooms, 2 bathrooms and oven: total $340, deposit $85, balance $255, service duration 240m plus 30m buffer.
