import type { IntegrationStatusDTO, OwnerSettingsSnapshotDTO } from "@/contracts";
import { OwnerSettingsPreview } from "./OwnerSettingsPreview";

const fixtureSettings: OwnerSettingsSnapshotDTO = { workspaceId: "ws_showcase", services: [ { code: "MOVE_OUT", label: "Move-out clean", enabled: true }, { code: "DEEP", label: "Deep clean", enabled: false } ], members: [ { userId: "owner_1", role: "OWNER", active: true }, { userId: "crew_1", role: "CREW", active: true } ], invitations: [ { id: "invite_dispatcher_1", role: "DISPATCHER", state: "PENDING", createdAt: "2026-10-04T06:00:00.000Z" } ] };
const fixtureIntegrations: IntegrationStatusDTO[] = [ { workspaceId: "ws_showcase", provider: "PAYMENT", status: "BLOCKED", mode: "SANDBOX", message: "Stripe sandbox cannot be shown as live." }, { workspaceId: "ws_showcase", provider: "GOOGLE_CALENDAR", status: "DEGRADED", mode: "FIXTURE", message: "Calendar requires owner setup." } ];
export function OwnerSettingsFixturePreview({ embedded = false }: { embedded?: boolean }) { return <OwnerSettingsPreview embedded={embedded} snapshot={fixtureSettings} integrations={fixtureIntegrations} sourceLabel="FIXTURE_UI_ONLY" />; }
