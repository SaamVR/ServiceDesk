/**
 * SOURCE contract for an explicitly approved, private P02 TWO-owner Chrome UAT.
 * Neither this validator nor its offline tests contact Supabase or sign in.
 */
const SHA = /^[0-9a-f]{40}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PROJECT_ORIGIN = "https://cpmmgivhlkfbiwzhlcey.supabase.co";
export const LOCAL_ORIGIN = "http://127.0.0.1:3000";
export const VERIFIED_STATUS =
  "Email confirmed. Owner, workspace and active default branch verified against the database.";
export const DENIED_STATUS =
  "Workspace verification could not be completed. Your account has not been changed.";

function deny(code) { throw Error("P02_BROWSER_BLOCKED_" + code); }
export function validateTwoOwnerBrowserConfig(env) {
  if (env.SD_P02_BROWSER_APPROVAL !== "TWO_OWNER_READ_ONLY")
    deny("NO_EXPLICIT_READ_ONLY_APPROVAL");
  if (!SHA.test(env.GITHUB_SHA ?? "") ||
      env.SD_P02_BROWSER_APPROVED_SHA !== env.GITHUB_SHA)
    deny("EXACT_SHA_NOT_APPROVED");
  if (env.NEXT_PUBLIC_SUPABASE_URL !== PROJECT_ORIGIN ||
      env.V4_AUTH_TEST_ORIGIN !== LOCAL_ORIGIN)
    deny("TARGET_SCOPE");
  if (!/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
  ) || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY)
    deny("NONPRIVILEGED_PUBLISHABLE_KEY");
  if (!env.V4_P02_BROWSER_CHROME || !env.V4_P02_BROWSER_OUTPUT)
    deny("PRIVATE_BROWSER_RUNTIME");
  const owners = ["A","B"].map(tag => {
    const email = env["V4_P02_OWNER_" + tag + "_EMAIL"];
    const password = env["V4_P02_OWNER_" + tag + "_PASSWORD"];
    const slug = env["V4_P02_OWNER_" + tag + "_WORKSPACE"];
    if (typeof email !== "string" || email.length > 254 ||
        email !== email.trim() || !EMAIL.test(email) ||
        email.includes("..") || typeof password !== "string" ||
        password.length < 8 || password.length > 512 ||
        /[\r\n\0]/.test(password) || typeof slug !== "string" ||
        slug.length < 3 || slug.length > 40 || !SLUG.test(slug))
      deny("OWNER_" + tag + "_CONFIG");
    return { tag, email, password, slug };
  });
  if (owners[0].email.toLowerCase() === owners[1].email.toLowerCase() ||
      owners[0].slug === owners[1].slug)
    deny("OWNERS_AND_WORKSPACES_MUST_DIFFER");
  return owners;
}


/**
 * A fully rendered, cross-tenant owner-ready page is an immediate privacy
 * failure, not an eventual-consistency state worth polling for 40 seconds.
 * Require the saved foreign slug to match the requested URL: this deliberately
 * ignores stale own-page DOM while Chromium is still navigating.
 */
export function hasForeignReadyDisclosure(snapshot, ownerSlug, requestedSlug) {
  return Boolean(snapshot && typeof snapshot === "object" &&
    snapshot.path === "/onboarding/verified" &&
    snapshot.queryWorkspace === requestedSlug &&
    requestedSlug !== ownerSlug &&
    snapshot.heading === "Your business workspace is ready." &&
    snapshot.readyStatus === VERIFIED_STATUS &&
    snapshot.verifiedDetails === true &&
    snapshot.savedWorkspaceSlug === requestedSlug);
}

/** Pure independent critic: never decide acceptance from URL or status alone. */
export function assertBrowserReadback(snapshot, ownerSlug, requestedSlug, phase) {
  if (!snapshot || typeof snapshot !== "object" ||
      snapshot.path !== "/onboarding/verified" ||
      snapshot.queryWorkspace !== requestedSlug ||
      snapshot.signInEntry || snapshot.nextErrorOverlay)
    deny("UNVERIFIED_BROWSER_ROUTE");
  if (phase === "OWN") {
    if (requestedSlug !== ownerSlug ||
        snapshot.heading !== "Your business workspace is ready." ||
        snapshot.readyStatus !== VERIFIED_STATUS ||
        snapshot.savedWorkspaceSlug !== ownerSlug ||
        !snapshot.verifiedDetails || snapshot.denialAlert ||
        snapshot.qaMutationControl)
      deny("SAVED_OWNER_BRANCH_NOT_VERIFIED");
    return true;
  }
  if (phase === "FOREIGN_DENIED") {
    if (requestedSlug === ownerSlug ||
        snapshot.heading !== "We could not verify this workspace" ||
        snapshot.denialAlert !== DENIED_STATUS ||
        snapshot.readyStatus || snapshot.verifiedDetails ||
        snapshot.savedWorkspaceSlug || snapshot.qaMutationControl)
      deny("FOREIGN_WORKSPACE_BROWSER_NOT_DENIED");
    return true;
  }
  deny("UNKNOWN_PHASE");
}
