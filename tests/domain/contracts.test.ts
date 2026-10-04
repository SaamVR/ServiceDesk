import { describe, expect, it } from "vitest";
import {
  ActorContextSchema, CommandMetaSchema, RequestDTOSchema, QuoteDTOSchema, SlotDTOSchema,
  VisitDTOSchema, InvoiceDTOSchema, ConversationDTOSchema, IntegrationStatusDTOSchema, AttentionItemDTOSchema,
} from "../../src/contracts";
import type { ActorContext, CommandMeta, Result } from "../../src/contracts";
import type { ServiceDeskFacade } from "../../src/server/core/facade";

describe("frozen V1 contracts", () => {
  it("validates actor context and command metadata", () => {
    const ctx: ActorContext = ActorContextSchema.parse({workspaceId:"ws_1",role:"OWNER"});
    const meta: CommandMeta = CommandMetaSchema.parse({idempotencyKey:"idem-1",expectedVersion:2,now:"2026-10-04T05:00:00.000Z"});
    expect(ctx.role).toBe("OWNER");
    expect(meta.expectedVersion).toBe(2);
  });

  it("exports every frozen DTO runtime schema", () => {
    for (const schema of [RequestDTOSchema,QuoteDTOSchema,SlotDTOSchema,VisitDTOSchema,InvoiceDTOSchema,ConversationDTOSchema,IntegrationStatusDTOSchema,AttentionItemDTOSchema]) {
      expect(schema).toBeDefined();
    }
  });

  it("keeps Result and facade available to all lanes", () => {
    const result: Result<{id:string}> = {ok:true,value:{id:"x"}};
    expect(result.ok).toBe(true);
    const compileOnly: ServiceDeskFacade | undefined = undefined;
    expect(compileOnly).toBeUndefined();
  });
});
