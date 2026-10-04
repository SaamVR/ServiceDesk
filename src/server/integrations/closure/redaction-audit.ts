import type { ConnectorRegressionProvider } from "./cross-provider-regression";

export type RedactionFindingKind = "SECRET" | "BEARER_TOKEN" | "EMAIL" | "PHONE" | "PROVIDER_URL" | "RAW_BODY" | "PROVIDER_VERIFIED_CLAIM";

export interface RedactionAuditInput {
  provider: ConnectorRegressionProvider;
  artifactName: string;
  value: unknown;
}

export interface RedactionFinding {
  kind: RedactionFindingKind;
  path: string;
  redactedSample: string;
}

export interface RedactionAuditResult {
  provider: ConnectorRegressionProvider;
  artifactName: string;
  safeForOperatorLog: boolean;
  findings: RedactionFinding[];
}

export interface RedactionAuditSummary {
  total: number;
  unsafe: number;
  safe: number;
  providerVerifiedClaims: number;
}

const secretPattern = /\b(?:sk|whsec|xoxb|ya29|secret|api[_-]?key|token)[a-z0-9_:\-.]{4,}/i;
const bearerPattern = /bearer\s+[a-z0-9_:\-.]+/i;
const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const phonePattern = /\+?\d[\d\s().-]{7,}\d/;
const providerUrlPattern = /https:\/\/(?:graph\.facebook\.com|api\.stripe\.com|www\.googleapis\.com|hooks\.slack\.com|.*\.n8n\.cloud)\//i;

function redactedSample(value: string): string {
  if (value.length <= 8) return "<redacted>";
  return `${value.slice(0, 3)}…${value.slice(-2)}`;
}

function visit(value: unknown, path: string, findings: RedactionFinding[]): void {
  if (typeof value === "string") {
    const candidates: Array<[RedactionFindingKind, RegExp]> = [
      ["BEARER_TOKEN", bearerPattern],
      ["SECRET", secretPattern],
      ["EMAIL", emailPattern],
      ["PHONE", phonePattern],
      ["PROVIDER_URL", providerUrlPattern],
    ];

    for (const [kind, pattern] of candidates) {
      const matched = value.match(pattern)?.[0];
      if (matched) findings.push({ kind, path, redactedSample: redactedSample(matched) });
    }
    return;
  }

  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, `${path}[${index}]`, findings));
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    if (/raw(body|payload|providerevent)/i.test(key)) {
      findings.push({ kind: "RAW_BODY", path: childPath, redactedSample: "<raw-body-redacted>" });
      continue;
    }
    if (key === "verification" && child === "PROVIDER_VERIFIED") {
      findings.push({ kind: "PROVIDER_VERIFIED_CLAIM", path: childPath, redactedSample: "PROVIDER_VERIFIED" });
      continue;
    }
    visit(child, childPath, findings);
  }
}

export function auditConnectorRedaction(input: RedactionAuditInput): RedactionAuditResult {
  const findings: RedactionFinding[] = [];
  visit(input.value, "", findings);
  return {
    provider: input.provider,
    artifactName: input.artifactName,
    safeForOperatorLog: findings.length === 0,
    findings,
  };
}

export function summarizeRedactionAudit(results: RedactionAuditResult[]): RedactionAuditSummary {
  return results.reduce<RedactionAuditSummary>(
    (summary, result) => {
      summary.total += 1;
      if (result.safeForOperatorLog) summary.safe += 1;
      else summary.unsafe += 1;
      summary.providerVerifiedClaims += result.findings.filter((finding) => finding.kind === "PROVIDER_VERIFIED_CLAIM").length;
      return summary;
    },
    { total: 0, unsafe: 0, safe: 0, providerVerifiedClaims: 0 },
  );
}
