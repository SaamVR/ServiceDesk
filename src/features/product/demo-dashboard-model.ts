import {
  sandboxStages, type SandboxStage, type SandboxAction,
  type SandboxState,
} from "@/features/sandbox/sandbox-engine";

/** Pure portfolio UX mapping. Business truth is owned by sandbox-engine, not this module. */
export type DashboardModule = "overview" | "inbox" | "requests" | "schedule" | "crew" | "finance" | "ai" | "automations" | "activity";

export const dashboardModules: readonly {
  id: DashboardModule; label: string; short: string; icon: string;
}[] = [
  { id: "overview", label: "Overview", short: "Your business at a glance", icon: "house" },
  { id: "inbox", label: "Shared inbox", short: "Customer context and replies", icon: "inbox" },
  { id: "requests", label: "Requests & quotes", short: "Structured intake and approvals", icon: "file-text" },
  { id: "schedule", label: "Schedule", short: "Holds, capacity and assignments", icon: "calendar-check" },
  { id: "crew", label: "Crew & quality", short: "Checklist and field decisions", icon: "clipboard-check" },
  { id: "finance", label: "Finance", short: "Quote, deposit and invoice", icon: "receipt" },
  { id: "ai", label: "AI co-pilot", short: "Safe draft and human approval", icon: "brain-circuit" },
  { id: "automations", label: "Automation rules", short: "Real 27-rule source catalogue", icon: "workflow" },
  { id: "activity", label: "Audit activity", short: "Inspect each synthetic action", icon: "shield-check" },
] as const;

export const dashboardGuide: readonly {
  module: DashboardModule; title: string; explanation: string; instruction: string;
}[] = [
  { module: "overview", title: "Welcome to the operations desk", explanation: "Everything in this workspace is fictional and stored only in your browser. This overview is derived from the same deterministic workflow as the standalone sandbox.", instruction: "Use the highlighted Next step or choose a workspace section." },
  { module: "inbox", title: "Start with the customer conversation", explanation: "This is a sample enquiry, not a real WhatsApp or email conversation. Draft replies require human review and do not send messages.", instruction: "Inspect the message, then continue to Requests." },
  { module: "requests", title: "Prepare an accountable quote", explanation: "The sample quote uses ServiceDesk's real pricing calculation. Only the local demo advances when you press a permitted next action.", instruction: "Prepare the quote and simulate customer acceptance when prompted." },
  { module: "schedule", title: "Keep scheduling realistic", explanation: "A simulated capacity hold and a crew assignment are different events. No Google Calendar booking is created.", instruction: "Advance through the slot hold, sample deposit and crew assignment in order." },
  { module: "crew", title: "Connect the field team to quality", explanation: "Crew progress and quality review use synthetic events. No real employee or customer is involved.", instruction: "Start and complete the sample visit." },
  { module: "finance", title: "Reconcile the real sample quote", explanation: "Amounts come from the sandbox pricing function; simulated deposit and balance do not charge a card.", instruction: "Review the invoice and outstanding sample balance." },
  { module: "ai", title: "AI suggests; people decide", explanation: "Select a scripted suggestion, edit it, and accept or reject it locally. This is not a live LLM connection.", instruction: "Try both decisions before leaving the AI panel." },
  { module: "automations", title: "Inspect the actual rule library", explanation: "These 27 source-defined starters only describe internal attention tasks. Selection cannot publish or execute a real rule.", instruction: "Choose a rule and inspect its trigger and safe action." },
  { module: "activity", title: "Verify every sample handoff", explanation: "The audit trail contains only the actions you took here. A simulated transport acceptance is never displayed as customer-delivered.", instruction: "Review the trail or reset the demo to start a new session." },
] as const;

const moduleIndex = new Map(dashboardModules.map(entry => [entry.id, entry]));

export function dashboardScreenFor(id: DashboardModule) {
  return moduleIndex.get(id) ?? dashboardModules[0];
}

export function dashboardStageView(stage: SandboxStage): DashboardModule {
  switch(stage) {
    case "ENQUIRY": return "inbox";
    case "QUOTED":
    case "ACCEPTED": return "requests";
    case "HELD": return "schedule";
    case "DEPOSIT_PAID": return "finance";
    case "ASSIGNED":
    case "IN_PROGRESS":
    case "COMPLETED": return "crew";
    case "BALANCE_PAID": return "finance";
  }
}

export function dashboardNextAction(state: SandboxState): {
  action: Exclude<SandboxAction, "RESET">;
  label: string;
  detail: string;
  module: DashboardModule;
} | null {
  const index = sandboxStages.findIndex(item => item.id === state.stage);
  const next = sandboxStages[index + 1];
  if (!next?.action) return null;
  return {
    action: next.action,
    label: next.label,
    detail: next.description,
    module: dashboardStageView(next.id),
  };
}

export function dashboardProgress(state: SandboxState) {
  const index = sandboxStages.findIndex(item => item.id === state.stage);
  const completed = Math.max(0, index);
  const total = sandboxStages.length - 1;
  return { completed, total, percent: Math.round((completed / total) * 100) };
}

export function dashboardStatus(state: SandboxState) {
  const { completed, total } = dashboardProgress(state);
  return {
    stage: sandboxStages[completed]?.label ?? "New enquiry",
    stepLabel: "Step " + (completed + 1) + " of " + (total + 1),
    claim: "SAMPLE ONLY" as const,
    complete: completed === total,
    delivery: state.delivery === "SIMULATED_PROVIDER_ACCEPTED" ? "Mock transport accepted — not delivered" :
      state.delivery === "FAILED" ? "Mock delivery failed" :
      state.delivery === "QUEUED" ? "Queued locally — not sent" : "No message queued",
  };
}
