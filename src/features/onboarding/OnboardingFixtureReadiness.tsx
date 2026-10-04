import type { IntegrationStatusDTO, OwnerSettingsSnapshotDTO } from "@/contracts";
import { OnboardingReadiness } from "./OnboardingReadiness";
const settings: OwnerSettingsSnapshotDTO = { workspaceId: "ws_showcase", services: [{ code: "MOVE_OUT", label: "Move-out clean", enabled: true }], members: [{ userId: "owner_1", role: "OWNER", active: true }], invitations: [] };
const integrations: IntegrationStatusDTO[] = [{ workspaceId: "ws_showcase", provider: "PAYMENT", status: "BLOCKED", mode: "SANDBOX", message: "Stripe sandbox is not live readiness." }];
export function OnboardingFixtureReadiness() { return <OnboardingReadiness settings={settings} integrations={integrations} />; }
