import { operationalDatabaseMode } from "./operational-preview-mode";
import { ownerRegistrationMode } from "./owner-registration-readiness";

/**
 * Additional write authority for shared-database QA fixtures.
 * Being an allowed QA registrant never authorizes injecting demo customers
 * or requests into a primary ServiceDesk database by itself.
 *
 * Enable only after reviewed membership RLS and the target workspace have
 * been accepted, and only for intentionally synthetic QA business records.
 */
export function qaFixtureWritesAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SERVICEDESK_QA_FIXTURE_WRITES_APPROVED === "true" &&
    env.SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED === "true" &&
    ownerRegistrationMode(env) === "QA_ONLY" &&
    operationalDatabaseMode(env) === "QA_SESSION_RLS";
}
