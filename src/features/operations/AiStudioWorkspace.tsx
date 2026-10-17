import Link from "next/link";
import { readConfiguredAiRuntimeConfig } from "@/server/ai/runtime-config";
import type { OperationalStaffSnapshot } from "./operational-product-runtime";
import { AiStudioWorkbench } from "./AiStudioWorkbench";
import { verifiedStudioRecordChoices } from "./ai-studio-records";
import { AiOwnerOperationsBrief } from "./AiOwnerOperationsBrief";
import { AiOwnerModelProbe } from "./AiOwnerModelProbe";
import { buildStaffModuleHref } from "./staff-modules";
import styles from "./AiStudioWorkspace.module.css";

/**
 * Dedicated staff AI Studio. Never serialize the service-role client, API key,
 * private customer text or money amounts into a browser component. Real model
 * actions remain the pre-existing guarded POST/server-action boundaries.
 */
export function AiStudioWorkspace({
  workspaceSlug, data,
}: { workspaceSlug: string; data: OperationalStaffSnapshot }) {
  const cfg = readConfiguredAiRuntimeConfig();
  const configured = cfg.ok;
  const model = cfg.ok ? cfg.value.model : null;
  const requests = verifiedStudioRecordChoices("Request", data.requests);
  const quotes = verifiedStudioRecordChoices("Quote", data.quotes);
  const published = (data.workflowRuleVersions ?? [])
    .filter(rule => rule.state === "PUBLISHED").length;
  const executionCount = (data.workflowExecutions ?? [])
    .filter(item => item.mode === "LIVE").length;
  const isOwner = data.actor.role === "OWNER";

  return (
    <div className={styles.studio} data-testid="operational-ai-studio">
      <section className={styles.hero} aria-label="AI Studio overview">
        <div className={styles.heroContent}>
          <p className={styles.overline}>ServiceDesk / AI Studio</p>
          <h2>Business intelligence, with a human in control.</h2>
          <p>Explore real saved enquiries and quotes, generate review-only suggestions,
            test a configured model and move between human-approved automation workflows.</p>
          <div className={styles.heroActions}>
            <a className={styles.heroPrimary} href="#ai-studio-workbench">Open workbench ↗</a>
            <Link className={styles.heroSecondary} href={buildStaffModuleHref(workspaceSlug, "automations")}>
              Open Automation Studio →
            </Link>
          </div>
        </div>
        <div className={styles.heroSide} aria-label="AI Studio runtime status">
          <span className={configured ? styles.heroReady : styles.heroBlocked}>
            <span aria-hidden="true">●</span> {configured ? "API configuration present" : "API configuration required"}
          </span>
          <div className={styles.heroMetric}>
            <small>Server-selected model</small>
            <strong>{model ?? "Not configured"}</strong>
          </div>
          <div className={styles.heroMetric}>
            <small>Provider connection</small>
            <strong>Not tested in this session</strong>
          </div>
          <p>Credential presence is not a successful provider response. Only the explicit owner test below can check a real model connection.</p>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Current authorized studio sources">
        <div><strong>{requests.length}</strong><span>Saved request choices</span></div>
        <div><strong>{quotes.length}</strong><span>Saved quote choices</span></div>
        <div><strong>{published}</strong><span>Published rule versions</span></div>
        <div><strong>{executionCount}</strong><span>Recorded live rule decisions</span></div>
      </section>

      <div id="ai-studio-workbench">
        <AiStudioWorkbench key={workspaceSlug} workspaceSlug={workspaceSlug}
          configured={configured} requests={requests} quotes={quotes} />
      </div>

      <section className={styles.toolSection} aria-label="AI Studio tools and capabilities">
        <div className={styles.panelTitle}>
          <div>
            <p className={styles.overline}>Operational copilots</p>
            <h2>Choose the right assistant</h2>
            <p>Model suggestions always remain review-only. Customer communication and financial changes use separate authorized business actions.</p>
          </div>
        </div>
        <div className={styles.cards}>
          <article className={styles.card}>
            <span className={styles.cardIcon} aria-hidden="true">01</span>
            <h3>Request intelligence</h3>
            <p>Identify missing information and prepare staff follow-up from a saved cleaning enquiry.</p>
            <Link href={buildStaffModuleHref(workspaceSlug, "requests")}>Review requests →</Link>
          </article>
          <article className={styles.card}>
            <span className={styles.cardIcon} aria-hidden="true">02</span>
            <h3>Quote safety review</h3>
            <p>Suggest checks on validated saved quotes; rate cards and amounts stay authoritative in ServiceDesk.</p>
            <Link href={buildStaffModuleHref(workspaceSlug, "quotes")}>Review quotes →</Link>
          </article>
          <article className={styles.card}>
            <span className={styles.cardIcon} aria-hidden="true">03</span>
            <h3>Inbox draft assistant</h3>
            <p>Draft a reply for staff to edit and approve, with contact, consent and delivery checks applied separately.</p>
            <Link href={buildStaffModuleHref(workspaceSlug, "inbox")}>Open inbox →</Link>
          </article>
          <article className={styles.card}>
            <span className={styles.cardIcon} aria-hidden="true">04</span>
            <h3>Workflow automation</h3>
            <p>Browse 27 starter playbooks and preview event, condition and attention-action rules before publishing.</p>
            <Link href={buildStaffModuleHref(workspaceSlug, "automations")}>Build workflows →</Link>
          </article>
        </div>
      </section>

      <section className={styles.ownerSection} aria-label="Owner AI configuration and briefing">
        <div className={styles.panelTitle}>
          <div>
            <p className={styles.overline}>Provider health and governance</p>
            <h2>Model connection and owner priorities</h2>
            <p>Model usage requires an explicitly enabled server runtime and authorized owner confirmation. Do not paste provider credentials into the browser.</p>
          </div>
          <span className={styles.manualBadge}>{isOwner ? "Owner controls" : "Owner-only controls"}</span>
        </div>
        {isOwner ? (
          <div className={styles.ownerGrid}>
            <AiOwnerModelProbe workspaceSlug={workspaceSlug} configured={configured} />
            <AiOwnerOperationsBrief workspaceSlug={workspaceSlug} configured={configured} />
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>Owner authorization required</strong>
            <p>Only a verified workspace owner can test provider connectivity or generate an owner-level workday brief. Staff can still use authorized request and quote review tools.</p>
          </div>
        )}
        {!configured ? (
          <div className={styles.setupNotice} role="status">
            <strong>Connect a project API key on the server to enable AI.</strong>
            <p>Set <code>OPENAI_API_KEY</code>, <code>SERVICEDESK_AI_MODEL</code> and <code>SERVICEDESK_AI_ENABLED=true</code> in the authorized deployment secret environment. The personal Codex CLI ChatGPT login is not a ServiceDesk project credential. Do not put keys in browser settings or GitHub files.</p>
          </div>
        ) : null}
      </section>
      <p className={styles.footerNote}>Operational AI is optional. Failed model calls must never prevent ordinary request handling, quotes, invoice review or owner-approved workflows.</p>
    </div>
  );
}
