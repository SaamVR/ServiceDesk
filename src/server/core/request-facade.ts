import type { ActorContext, CommandMeta, RequestDTO, Result } from "../../contracts";
import type { CreateRequestInput, ServiceDeskFacade } from "./facade";
import {
  createRequestWithRepository,
  updateRequestWithRepository,
  type RequestPatch,
  type RequestRecord,
  type RequestRepository,
} from "./requests";

export interface RequestFacadeDependencies {
  requestRepository: RequestRepository;
  nextRequestId(): string;
}

export function requestRecordToDTO(record: RequestRecord): RequestDTO {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    customerId: record.customerId,
    propertyId: record.propertyId,
    serviceCode: record.serviceCode,
    status: record.status,
    bedrooms: record.bedrooms,
    bathrooms: record.bathrooms,
    requestedStartAt: record.requestedStartAt,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function requestPatchFromDTO(patch: Partial<RequestDTO>): RequestPatch {
  const normalized: RequestPatch = {};
  if (patch.propertyId !== undefined) normalized.propertyId = patch.propertyId;
  if (patch.serviceCode !== undefined) normalized.serviceCode = patch.serviceCode;
  if (patch.bedrooms !== undefined) normalized.bedrooms = patch.bedrooms;
  if (patch.bathrooms !== undefined) normalized.bathrooms = patch.bathrooms;
  if (patch.requestedStartAt !== undefined) normalized.requestedStartAt = patch.requestedStartAt;
  if (patch.status !== undefined) normalized.status = patch.status;
  return normalized;
}

export function createRequestFacadeMethods(deps: RequestFacadeDependencies): Pick<ServiceDeskFacade, "createRequest" | "updateRequest"> {
  return {
    async createRequest(ctx: ActorContext, input: CreateRequestInput, meta: CommandMeta): Promise<Result<RequestDTO>> {
      const created = await createRequestWithRepository(ctx, {
        workspaceId: ctx.workspaceId,
        customerId: input.customerId,
        propertyId: input.propertyId,
        serviceCode: input.serviceCode,
        visitorSessionId: ctx.role === "VISITOR" ? ctx.visitorSessionId : undefined,
      }, meta, deps.requestRepository, () => deps.nextRequestId());
      if (created.ok === false) return created;
      return { ok: true, value: requestRecordToDTO(created.value) };
    },

    async updateRequest(ctx: ActorContext, id: string, patch: Partial<RequestDTO>, meta: CommandMeta): Promise<Result<RequestDTO>> {
      const updated = await updateRequestWithRepository(ctx, id, requestPatchFromDTO(patch), meta, deps.requestRepository);
      if (updated.ok === false) return updated;
      return { ok: true, value: requestRecordToDTO(updated.value) };
    },
  };
}
