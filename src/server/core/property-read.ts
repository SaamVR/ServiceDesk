import type { ActorContext, PropertyDTO, Result } from "../../contracts";
import { requireActiveStaffContext, requireRole } from "./auth";
import type { PropertyRepository } from "./property-repository";

export type PropertyReadRepository = Pick<PropertyRepository, "listActiveByCustomer">;

function authorizePropertyRead(ctx: ActorContext): Result<true> {
  const staff = requireActiveStaffContext(ctx);
  if (staff.ok === false) return staff;
  return requireRole(ctx, ["OWNER", "DISPATCHER"]);
}

function failClosed(): Result<never> {
  return { ok: false, code: "PROPERTY_SCOPE_MISMATCH", message: "Property row was outside the requested workspace or customer scope." };
}

export async function readPropertySnapshot(
  ctx: ActorContext,
  customerId: string,
  repository: PropertyReadRepository,
): Promise<Result<PropertyDTO[]>> {
  const authorized = authorizePropertyRead(ctx);
  if (authorized.ok === false) return authorized;

  const properties = await repository.listActiveByCustomer(ctx.workspaceId, customerId);
  if (properties.ok === false) return properties;
  if (properties.value.some((property) => property.workspaceId !== ctx.workspaceId || property.customerId !== customerId)) {
    return failClosed();
  }
  return properties;
}

export function createPropertyReadMethods(repository: PropertyReadRepository) {
  return {
    readPropertySnapshot: (ctx: ActorContext, customerId: string) => readPropertySnapshot(ctx, customerId, repository),
  };
}
