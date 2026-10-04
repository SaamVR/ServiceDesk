import { z } from "zod";

export const ActorRoleSchema = z.enum(["OWNER","DISPATCHER","CREW","CUSTOMER","VISITOR","PLATFORM_OPERATOR"]);
export const ActorContextSchema = z.object({
  userId: z.string().min(1).optional(),
  visitorSessionId: z.string().min(1).optional(),
  workspaceId: z.string().min(1),
  role: ActorRoleSchema,
}).strict();

export const CommandMetaSchema = z.object({
  idempotencyKey: z.string().min(1),
  expectedVersion: z.number().int().nonnegative().optional(),
  now: z.string().datetime({ offset: true }),
}).strict();

export const RequestDTOSchema = z.object({
  id:z.string(), workspaceId:z.string(), customerId:z.string().optional(), propertyId:z.string().optional(), serviceCode:z.string().optional(),
  status:z.enum(["NEW","COLLECTING","READY","NEEDS_REVIEW","QUOTED","BOOKED","LOST","CLOSED"]),
  bedrooms:z.number().int().min(0).max(10).optional(), bathrooms:z.number().int().min(0).max(10).optional(),
  requestedStartAt:z.string().datetime({offset:true}).optional(), version:z.number().int().nonnegative(),
  createdAt:z.string().datetime({offset:true}), updatedAt:z.string().datetime({offset:true}),
}).strict();

export const QuoteDTOSchema = z.object({
  id:z.string(), workspaceId:z.string(), requestId:z.string(), version:z.number().int().positive(),
  status:z.enum(["DRAFT","PENDING_APPROVAL","APPROVED","SENT","ACCEPTED","DECLINED","EXPIRED","SUPERSEDED"]),
  currency:z.string().length(3), subtotalMinor:z.number().int().nonnegative(), taxMinor:z.number().int().nonnegative(),
  totalMinor:z.number().int().nonnegative(), depositMinor:z.number().int().nonnegative(), balanceMinor:z.number().int(),
  durationMinutes:z.number().int().positive(), bufferMinutes:z.number().int().nonnegative(), rateVersion:z.string().min(1),
  validUntil:z.string().datetime({offset:true}),
}).strict();

export const SlotDTOSchema = z.object({
  id:z.string(), workspaceId:z.string(), crewId:z.string(),
  startAt:z.string().datetime({offset:true}), endAt:z.string().datetime({offset:true}),
  serviceMinutes:z.number().int().positive(), bufferMinutes:z.number().int().nonnegative(), availabilityFresh:z.boolean(),
}).strict();

export const VisitDTOSchema = z.object({
  id:z.string(), workspaceId:z.string(), requestId:z.string(), quoteId:z.string(), crewId:z.string().optional(),
  status:z.enum(["AWAITING_PAYMENT","CONFIRMED","ASSIGNED","EN_ROUTE","IN_PROGRESS","PENDING_REVIEW","COMPLETED","CANCELLED","PAYMENT_REVIEW"]),
  startAt:z.string().datetime({offset:true}), serviceMinutes:z.number().int().positive(), bufferMinutes:z.number().int().nonnegative(),
  version:z.number().int().nonnegative(),
}).strict();

export const InvoiceDTOSchema = z.object({
  id:z.string(), workspaceId:z.string(), visitId:z.string().optional(),
  status:z.enum(["DRAFT","ISSUED","PARTIALLY_PAID","PAID","VOID"]), currency:z.string().length(3),
  totalMinor:z.number().int().nonnegative(), allocatedMinor:z.number().int().nonnegative(),
  refundedMinor:z.number().int().nonnegative(), balanceMinor:z.number().int(),
}).strict();

export const ConversationDTOSchema = z.object({
  id:z.string(), workspaceId:z.string(), requestId:z.string().optional(), customerId:z.string().optional(),
  channel:z.enum(["WEB","WHATSAPP","EMAIL"]), assignedUserId:z.string().optional(), handoverActive:z.boolean(),
  version:z.number().int().nonnegative(), lastMessageAt:z.string().datetime({offset:true}).optional(),
}).strict();

export const IntegrationStatusDTOSchema = z.object({
  workspaceId:z.string(), provider:z.enum(["WHATSAPP","GOOGLE_CALENDAR","PAYMENT","EMAIL","WEBHOOK","AI"]),
  status:z.enum(["NOT_CONFIGURED","CONNECTED","DEGRADED","REAUTH_REQUIRED","BLOCKED"]),
  mode:z.enum(["FIXTURE","SANDBOX","LIVE"]).optional(), lastSuccessfulAt:z.string().datetime({offset:true}).optional(),
  lastErrorAt:z.string().datetime({offset:true}).optional(), message:z.string().optional(),
}).strict();

export const AttentionItemDTOSchema = z.object({
  id:z.string(), workspaceId:z.string(), type:z.string(), severity:z.enum(["INFO","WARNING","CRITICAL"]),
  status:z.enum(["OPEN","ACKNOWLEDGED","RESOLVED"]), resourceType:z.string(), resourceId:z.string(),
  ownerUserId:z.string().optional(), dueAt:z.string().datetime({offset:true}).optional(), summary:z.string(),
}).strict();
