import {
  loadOperationalStaffSnapshot,
  type OperationalStaffSnapshot,
} from "@/features/operations/operational-product-runtime";
import { trustedQuoteInstant } from "@/features/operations/quote-validity-clock";

type Loader = typeof loadOperationalStaffSnapshot;
export interface F02DispatchDependencies {
  loadSnapshot?: Loader;
  now?: () => number;
  signal?: AbortSignal;
}
export type F02DispatchDenial =
  | "F02_DISPATCH_INPUT_INVALID"
  | "F02_DISPATCH_AUTH_REQUIRED"
  | "F02_DISPATCH_SOURCE_UNAVAILABLE"
  | "F02_DISPATCH_SOURCE_INCOMPLETE"
  | "F02_DISPATCH_SOURCE_CHANGED"
  | "F02_DISPATCH_CANCELLED";

export interface F02CapacitySuggestion {
  visitId: string;
  visitVersion: number;
  branchId: string;
  availableSlotCandidates: Array<{
    crewId: string;
    capacitySlotId: string;
    fit: "SAVED_CAPACITY_FIT_SKILLS_UNVERIFIED";
    crewSkillCheckRequired: true;
    ownerOrDispatcherApprovalRequired: true;
    assignmentPerformed: false;
  }>;
  reviewReasonCodes: Array<
    "NO_CURRENT_SAVED_SLOT" | "SCHEDULE_OVERLAP" | "CAPACITY_INSUFFICIENT" |
    "SAVED_HOLD_CONFLICT" | "SLOT_WINDOW_MISMATCH" | "CREW_NOT_ACTIVE" |
    "SLOT_AMBIGUITY"
  >;
  assignmentPerformed: false;
}
export type F02DispatchResult =
  | { ok: false; code: F02DispatchDenial }
  | { ok: true; value: {
      state: "PERSISTED_CAPACITY_ADVISORY_STAFF_APPROVAL_REQUIRED";
      source: "DOUBLE_READ_AUTHORIZED_OPERATIONAL_SNAPSHOT";
      workspaceId: string;
      sourceClock: string;
      proposals: F02CapacitySuggestion[];
      staffApprovalRequired: true;
      skillAvailabilityConfirmed: false;
      statusMutated: false;
      customerNotified: false;
      modelInvoked: false;
    } };

const id = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9:_-]{3,128}$/.test(v);
const dense = (v: unknown, max: number): v is Record<string, unknown>[] =>
  Array.isArray(v) && Object.getPrototypeOf(v) === Array.prototype &&
  v.length < max && Reflect.ownKeys(v).length === v.length + 1 &&
  v.every(x => !!x && typeof x === "object" &&
    !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype);
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const stamp = (v: unknown): number | null => trustedQuoteInstant(v);
const denial = (code: F02DispatchDenial): F02DispatchResult => ({ ok: false, code });

function validActor(s: OperationalStaffSnapshot, slug: string, now: number): boolean {
  const branch = s.branchScope;
  const at = stamp(s.loadedAt);
  return s.workspace?.slug === slug && id(s.workspace.id) &&
    s.actor?.workspaceId === s.workspace.id && id(s.actor.userId) &&
    (s.actor.role === "OWNER" || s.actor.role === "DISPATCHER") &&
    branch !== undefined && (branch.mode === "ALL" || branch.mode === "BRANCH") &&
    (s.actor.role !== "DISPATCHER" || branch.mode === "BRANCH") &&
    (branch.mode !== "BRANCH" || id(branch.selectedBranchId)) &&
    Array.isArray(branch.branches) && branch.branches.length > 0 &&
    branch.branches.every(b => id(b.id)) &&
    at !== null && Number.isFinite(now) && at >= now - 300_000 && at <= now + 60_000;
}
function checkedSource(s: OperationalStaffSnapshot): string | null {
  if (!dense(s.visits, 300) || !dense(s.crews, 100) ||
      !dense(s.capacitySlots, 300) || !dense(s.slotHolds, 300)) return null;
  const branch = s.branchScope!;
  const branches = new Set(branch.branches.map(b => b.id));
  if (branches.size !== branch.branches.length) return null;
  const ids = [new Set<string>(),new Set<string>(),new Set<string>(),new Set<string>()];
  const arrays = [s.visits,s.crews,s.capacitySlots,s.slotHolds];
  for (const [i,rows] of arrays.entries()) {
    for (const row of rows) {
      if (!id(row.id) || ids[i].has(row.id)) return null;
      ids[i].add(row.id);
    }
  }
  for (const v of s.visits) {
    if (v.workspaceId !== s.workspace.id || !id(v.branchId) ||
        !branches.has(v.branchId) ||
        (branch.mode === "BRANCH" && v.branchId !== branch.selectedBranchId) ||
        !integer(v.version,1,1_000_000_000) ||
        !["AWAITING_PAYMENT","CONFIRMED","ASSIGNED","EN_ROUTE","IN_PROGRESS",
          "PENDING_REVIEW","COMPLETED","CANCELLED","PAYMENT_REVIEW"].includes(v.status) ||
        !integer(v.serviceMinutes,1,1440) || !integer(v.bufferMinutes,0,1440) ||
        v.serviceMinutes + v.bufferMinutes > 1440 || stamp(v.startAt) === null ||
        (v.crewId !== undefined && !id(v.crewId))) return null;
  }
  for (const c of s.crews) {
    if (!id(c.branchId) || !branches.has(c.branchId) ||
        (branch.mode === "BRANCH" && c.branchId !== branch.selectedBranchId) ||
        typeof c.active !== "boolean") return null;
  }
  for (const slot of s.capacitySlots) {
    const start = stamp(slot.startAt), end = stamp(slot.endAt);
    if (!id(slot.branchId) || !branches.has(slot.branchId) ||
        (branch.mode === "BRANCH" && slot.branchId !== branch.selectedBranchId) ||
        !ids[1].has(slot.crewId) ||
        s.crews.find(c => c.id === slot.crewId)?.branchId !== slot.branchId ||
        start === null || end === null || start >= end ||
        !integer(slot.capacityMinutes,1,1440) ||
        slot.capacityMinutes > (end-start)/60_000) return null;
  }
  for (const hold of s.slotHolds) {
    if (!ids[2].has(hold.slotId) || !id(hold.quoteId) ||
        !["HELD","CONFIRMED","CONSUMED","RELEASED","EXPIRED","CANCELLED"].includes(hold.status) ||
        stamp(hold.expiresAt) === null) return null;
  }
  for (const visit of s.visits) {
    if (visit.crewId && !s.crews.some(c => c.id === visit.crewId && c.branchId === visit.branchId))
      return null;
  }
  // Prove identical persisted scheduling facts without serializing customer,
  // crew names, notes, payment data or free-form attacker-authored summaries.
  const tuple = (rows: readonly Record<string, unknown>[], keys: string[]) =>
    rows.map(row => keys.map(k => row[k] ?? null))
      .sort((a,b) => String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify({
    scope: [branch.mode,branch.selectedBranchId ?? null,[...branches].sort()],
    visits: tuple(s.visits,["id","workspaceId","branchId","status","version","crewId","startAt","serviceMinutes","bufferMinutes"]),
    crews: tuple(s.crews,["id","branchId","active"]),
    capacity: tuple(s.capacitySlots,["id","branchId","crewId","startAt","endAt","capacityMinutes"]),
    holds: tuple(s.slotHolds,["id","slotId","quoteId","status","expiresAt"]),
  });
}

/** No autonomous scheduling: computes a bounded candidate shortlist from
 * twice-read authenticated saved rows. Existing business command must still
 * atomically revalidate capacity, hold and visit revision when staff approves.
 */
export async function proposeSavedCapacityDispatch(
  workspaceSlug: string, deps: F02DispatchDependencies = {},
): Promise<F02DispatchResult> {
  if (typeof workspaceSlug !== "string" || workspaceSlug.length > 40 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug))
    return denial("F02_DISPATCH_INPUT_INVALID");
  if (deps.signal?.aborted) return denial("F02_DISPATCH_CANCELLED");
  const read = deps.loadSnapshot ?? loadOperationalStaffSnapshot;
  const now = deps.now ?? Date.now;
  let first: Awaited<ReturnType<Loader>>;
  try { first = await read(workspaceSlug); }
  catch { return denial("F02_DISPATCH_SOURCE_UNAVAILABLE"); }
  if (!first.ok || !validActor(first.value,workspaceSlug,now()))
    return denial("F02_DISPATCH_AUTH_REQUIRED");
  const fingerprint = checkedSource(first.value);
  if (fingerprint === null) return denial("F02_DISPATCH_SOURCE_INCOMPLETE");
  if (deps.signal?.aborted) return denial("F02_DISPATCH_CANCELLED");
  let next: Awaited<ReturnType<Loader>>;
  try { next = await read(workspaceSlug); }
  catch { return denial("F02_DISPATCH_SOURCE_UNAVAILABLE"); }
  if (!next.ok || !validActor(next.value,workspaceSlug,now()) ||
      first.value.actor.userId !== next.value.actor.userId ||
      first.value.actor.role !== next.value.actor.role ||
      first.value.workspace.id !== next.value.workspace.id ||
      checkedSource(next.value) !== fingerprint)
    return denial("F02_DISPATCH_SOURCE_CHANGED");
  if (deps.signal?.aborted) return denial("F02_DISPATCH_CANCELLED");

  const s = next.value, asOf = stamp(s.loadedAt)!;
  const active = s.visits.filter(v => !v.crewId && v.status === "CONFIRMED");
  const proposals: F02CapacitySuggestion[] = [];
  for (const visit of active) {
    const start = stamp(visit.startAt)!;
    const end = start + (visit.serviceMinutes + visit.bufferMinutes) * 60_000;
    const fits: F02CapacitySuggestion["availableSlotCandidates"] = [];
    const problems = new Set<F02CapacitySuggestion["reviewReasonCodes"][number]>();
    for (const crew of s.crews.filter(c => c.branchId === visit.branchId)) {
      if (!crew.active) { problems.add("CREW_NOT_ACTIVE"); continue; }
      const slots = s.capacitySlots.filter(slot => slot.crewId === crew.id &&
        slot.branchId === visit.branchId && stamp(slot.startAt)! <= start &&
        stamp(slot.endAt)! >= end);
      if (!slots.length) { problems.add("NO_CURRENT_SAVED_SLOT"); continue; }
      if (slots.length !== 1) { problems.add("SLOT_AMBIGUITY"); continue; }
      const slot=slots[0];
      if (slot.capacityMinutes < visit.serviceMinutes + visit.bufferMinutes) {
        problems.add("CAPACITY_INSUFFICIENT");continue;
      }
      const overlap = s.visits.some(other => other.id !== visit.id &&
        other.crewId === crew.id && other.status !== "CANCELLED" &&
        start < stamp(other.startAt)! + (other.serviceMinutes+other.bufferMinutes)*60_000 &&
        stamp(other.startAt)! < end);
      if (overlap) { problems.add("SCHEDULE_OVERLAP");continue; }
      // Unknown statuses are already source-invalid; a live hold for this
      // slot cannot be treated as spare capacity even if quote ID matches.
      if (s.slotHolds.some(h => h.slotId === slot.id &&
        !["RELEASED","EXPIRED","CANCELLED"].includes(h.status) &&
        stamp(h.expiresAt)! > asOf)) {
        problems.add("SAVED_HOLD_CONFLICT"); continue;
      }
      fits.push({crewId:crew.id,capacitySlotId:slot.id,
        fit:"SAVED_CAPACITY_FIT_SKILLS_UNVERIFIED",
        crewSkillCheckRequired:true,ownerOrDispatcherApprovalRequired:true,
        assignmentPerformed:false});
    }
    if (!fits.length && problems.size === 0) problems.add("NO_CURRENT_SAVED_SLOT");
    proposals.push({
      visitId:visit.id,visitVersion:visit.version,branchId:visit.branchId!,
      availableSlotCandidates:fits.sort((a,b)=>a.crewId.localeCompare(b.crewId)),
      reviewReasonCodes:[...problems].sort(),assignmentPerformed:false,
    });
  }
  return {ok:true,value:{
    state:"PERSISTED_CAPACITY_ADVISORY_STAFF_APPROVAL_REQUIRED",
    source:"DOUBLE_READ_AUTHORIZED_OPERATIONAL_SNAPSHOT",
    workspaceId:s.workspace.id,sourceClock:s.loadedAt,proposals,
    staffApprovalRequired:true,skillAvailabilityConfirmed:false,statusMutated:false,
    customerNotified:false,modelInvoked:false,
  }};
}
