import Link from "next/link";
import { buildStaffModuleHref } from "./staff-modules";
import { readConfiguredAiRuntimeConfig } from "@/server/ai/runtime-config";
import styles from "./AiOperationsStatus.module.css";
import { AiOwnerModelProbe } from "./AiOwnerModelProbe";

export function AiOperationsStatus({
  workspaceSlug, publishedRuleCount, compact = false, allowOwnerModelTest = false,
}: {
  workspaceSlug: string;
  publishedRuleCount: number;
  compact?: boolean;
  allowOwnerModelTest?: boolean;
}) {
  const ready = readConfiguredAiRuntimeConfig().ok;
  return (
    <section className={styles.panel} aria-label="AI and automation operating status">
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>AI & automation workspace</p>
          <h2>Turn enquiries into reviewed next steps</h2>
          <p>Generate staff-only intake briefs, review AI replies, and configure event-driven workflows—without hidden customer sends or payments.</p>
        </div>
        <span className={ready ? styles.configured : styles.unconfigured}>
          {ready ? "AI configured · provider proof pending" : "AI not enabled"}
        </span>
      </div>
      <div className={styles.grid}>
        <div>
          <strong>01 · AI intake copilot</strong>
          <p>Summarize a persisted cleaning request and identify missing information. A model call occurs only when explicitly requested by staff.</p>
          <Link href={buildStaffModuleHref(workspaceSlug, "requests")}>Open requests <span aria-hidden="true">↗</span></Link>
        </div>
        <div>
          <strong>02 · Human-reviewed customer replies</strong>
          <p>Propose a reply from a saved inbound conversation; staff reviews and approves the text before queueing delivery.</p>
          <Link href={buildStaffModuleHref(workspaceSlug, "inbox")}>Open inbox <span aria-hidden="true">↗</span></Link>
        </div>
        <div>
          <strong>03 · Workflow automation</strong>
          <p>{publishedRuleCount > 0
            ? `${publishedRuleCount} published rule version${publishedRuleCount === 1 ? "" : "s"} recorded. Confirm an actual event-execution receipt before calling them operational.`
            : "No published workflow versions in this workspace. Draft and preview an event → condition → action rule before publishing."}</p>
          <Link href={buildStaffModuleHref(workspaceSlug, "automations")}>Review rules <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      {allowOwnerModelTest && !compact ? <AiOwnerModelProbe workspaceSlug={workspaceSlug} configured={ready} /> : null}
      {!compact ? <p className={styles.note}>Configuration status is not a successful provider connection test. AI suggestions cannot execute quotes, scheduling, outbound messages or charges.</p> : null}
    </section>
  );
}
