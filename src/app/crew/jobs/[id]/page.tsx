import { redirect } from "next/navigation";
import { CrewFieldError, CrewJobDetailV2 } from "@/features/crew/CrewFieldAppV2";
import {
  addCrewFieldNote,
  loadCrewJob,
  transitionCrewJob,
  updateCrewChecklistItem,
  type CrewProductActionResult,
} from "@/features/crew/crew-product-runtime";

function actionRedirect(
  visitId: string,
  workspace: string | undefined,
  result: CrewProductActionResult,
): never {
  const query = new URLSearchParams();
  if (workspace) query.set("workspace", workspace);
  query.set(result.ok ? "notice" : "error", result.message);
  redirect("/crew/jobs/" + encodeURIComponent(visitId) + "?" + query.toString());
}

export default async function CrewJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ workspace?: string; notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const result = await loadCrewJob(id, query.workspace);

  if (!result.ok) {
    return (
      <CrewFieldError
        title={
          result.kind === "authentication"
            ? "Crew sign-in required"
            : result.kind === "not_found"
              ? "Job not available"
              : "Crew job unavailable"
        }
        message={result.message}
      />
    );
  }

  async function transitionAction(formData: FormData) {
    "use server";
    const action = String(formData.get("action") ?? "");
    if (action !== "EN_ROUTE" && action !== "START" && action !== "SUBMIT_REVIEW") {
      actionRedirect(id, query.workspace, { ok: false, message: "This job action is no longer available." });
    }
    const actionResult = await transitionCrewJob(
      query.workspace,
      id,
      action,
      Number(formData.get("expectedVersion") ?? 0),
    );
    actionRedirect(id, query.workspace, actionResult);
  }

  async function checklistAction(formData: FormData) {
    "use server";
    const actionResult = await updateCrewChecklistItem(
      query.workspace,
      id,
      String(formData.get("itemKey") ?? ""),
      String(formData.get("completed")) === "true",
      Number(formData.get("expectedVersion") ?? 0),
    );
    actionRedirect(id, query.workspace, actionResult);
  }

  async function noteAction(formData: FormData) {
    "use server";
    const kind = String(formData.get("kind") ?? "");
    if (kind !== "TIME_MATERIAL_NOTE" && kind !== "INCIDENT_NOTE") {
      actionRedirect(id, query.workspace, { ok: false, message: "Choose a valid note type." });
    }
    const actionResult = await addCrewFieldNote(
      query.workspace,
      id,
      kind,
      String(formData.get("note") ?? ""),
      Number(formData.get("expectedVersion") ?? 0),
    );
    actionRedirect(id, query.workspace, actionResult);
  }

  return (
    <CrewJobDetailV2
      job={result.value.job}
      timeZone={result.value.workspace.timeZone}
      workspaceName={result.value.workspace.name}
      transitionAction={transitionAction}
      checklistAction={checklistAction}
      noteAction={noteAction}
      notice={query.notice}
      error={query.error}
    />
  );
}
