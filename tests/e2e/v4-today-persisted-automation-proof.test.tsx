import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AiOperationsStatus } from "../../src/features/operations/AiOperationsStatus";
import type {
  OperationalWorkflowExecution, OperationalWorkflowActionExecution,
} from "../../src/features/operations/operational-product-runtime";

vi.mock("@/server/ai/runtime-config", () => ({
  readConfiguredAiRuntimeConfig: () => ({ ok: false }),
}));

const live: OperationalWorkflowExecution = {
  id: "live-proof", branchId: "branch-a", ruleId: "rule-1", ruleVersionId: "version-1",
  mode: "LIVE", eventType: "REQUEST_CREATED", matched: true, recursionDepth: 0,
  state: "ACTIONS_PENDING", createdAt: "2026-10-12T00:00:00Z",
};
const preview: OperationalWorkflowExecution = {
  ...live, id: "preview-only", mode: "PREVIEW", state: "PREVIEWED",
};
const action = (executionId: string, state: OperationalWorkflowActionExecution["state"],
  actionType: OperationalWorkflowActionExecution["actionType"]): OperationalWorkflowActionExecution => ({
  id: executionId + "-" + state + "-" + actionType,
  branchId: "branch-a", executionId, actionIndex: 0,
  attemptNumber: 1, actionType, state, createdAt: "2026-10-12T00:01:00Z",
});
const renderStatus = (props: Partial<React.ComponentProps<typeof AiOperationsStatus>>) =>
  renderToStaticMarkup(createElement(AiOperationsStatus, {
    workspaceSlug: "qa-cleaning", publishedRuleCount: 1, compact: true, ...props,
  }));

describe("V4 Today visible operational AI + automation proof", () => {
  it("shows only saved LIVE decisions and their linked internal work", () => {
    const html = renderStatus({
      executions: [live, preview],
      actions: [
        action("live-proof", "SUCCEEDED", "CREATE_ATTENTION"),
        action("live-proof", "APPROVAL_REQUIRED", "SEND_WHATSAPP_TEMPLATE"),
        action("preview-only", "FAILED", "SEND_EMAIL_TEMPLATE"),
      ],
    });
    expect(html).toContain('aria-label="Persisted AI and automation activity"');
    expect(html).toContain("Recorded live rule decisions");
    expect(html).toContain("Completed internal attention records");
    expect(html).toContain("External actions requiring approval");
    expect(html).toContain("Failed action records");
    expect(html).toContain("simulated previews excluded");
    expect(html).toContain("no provider delivery verified");
    expect(html).toContain('href="/app/qa-cleaning/automations"');
    expect(html).not.toContain("provider delivered");
  });

  it("does not invent zero saved executions if the authorized snapshot is missing", () => {
    const html = renderStatus({ executions: undefined, actions: undefined });
    expect(html).not.toContain('aria-label="Persisted AI and automation activity"');
    expect(html).toContain("Confirm an actual event-execution receipt");
    expect(html).toContain("AI not enabled");
  });

  it("never treats preview-only synthetic actions as live proof", () => {
    const html = renderStatus({
      executions: [preview],
      actions: [action("preview-only", "SUCCEEDED", "CREATE_ATTENTION")],
    });
    expect(html).toContain("Recorded live rule decisions");
    expect(html).toContain(">0</strong>");
    expect(html).toContain("no provider delivery verified");
  });

  it("uses existing scoped operational snapshots and responsive accessible styles", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    const today = read("src/features/operations/StaffOverviewDashboard.tsx");
    const css = read("src/features/operations/AiOperationsStatus.module.css");
    expect(today).toContain("executions={snapshot.workflowExecutions}");
    expect(today).toContain("actions={snapshot.workflowActionExecutions}");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(css).toContain("@media (max-width: 390px)");
    expect(css).toContain(".proof a:focus-visible");
  });
});
