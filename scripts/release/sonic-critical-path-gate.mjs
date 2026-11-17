#!/usr/bin/env node
/**
 * Read-only SONIC delivery gate. Reports issue-level milestones, never live UAT.
 * GitHub Issues are the input, not source CI or a model-generated PASS claim.
 * This tool does not approve tenants, SQL, payments, provider calls or deploys.
 */
import { pathToFileURL } from 'node:url';

export const REPO = 'SaamVR/ServiceDesk';
export const DELIVERY_ISSUES = Object.freeze(Array.from({length:12}, (_, i) => ({
  batch: 'P' + String(i + 1).padStart(2, '0'),
  number: 817 + i,
  minimumChecks: (i === 1 ? 7 : 6),
})));
export const NO_GO = Object.freeze([
  'F23_ATOMIC_HOLD_RELEASE_UNAPPLIED_AND_SECURITY_VETO_OPEN',
  'NO_LIVE_OWNER_UAT_FROM_CI_OR_ISSUE_CHECKBOXES',
  'NO_VERCEL_DEPLOY_WITHOUT_EXACT_PROJECT_SHA_ENV_APPROVAL',
]);

export function countCheckboxes(body) {
  if (typeof body !== 'string') throw Error('ISSUE_BODY_UNVERIFIED');
  let checked = 0, unchecked = 0;
  for (const m of body.matchAll(/^\s*-\s*\[([ xX])\]\s+/gm)) {
    if (m[1].toLowerCase() === 'x') checked++;
    else unchecked++;
  }
  return {checked, unchecked, total: checked + unchecked};
}

export function assessMilestones(issues, pr) {
  if (!Array.isArray(issues) || issues.length !== DELIVERY_ISSUES.length)
    throw Error('INCOMPLETE_MILESTONE_INPUT');
  const byNumber = new Map();
  for (const issue of issues) {
    if (!issue || !Number.isInteger(issue.number) || byNumber.has(issue.number) ||
        !['open', 'closed'].includes(issue.state)) throw Error('INVALID_MILESTONE_INPUT');
    byNumber.set(issue.number, issue);
  }
  if (!pr || typeof pr.head?.sha !== 'string' ||
      !/^[a-f0-9]{40}$/i.test(pr.head.sha) || typeof pr.draft !== 'boolean' ||
      typeof pr.merged !== 'boolean') throw Error('PR_EVIDENCE_UNVERIFIED');
  const milestones = DELIVERY_ISSUES.map(({batch, number, minimumChecks}) => {
    const issue = byNumber.get(number);
    if (!issue) throw Error('REQUIRED_MILESTONE_MISSING');
    const counts = countCheckboxes(issue.body);
    const issueChecklistComplete = issue.state === 'closed' &&
      counts.unchecked === 0 && counts.checked >= minimumChecks;
    return {
      batch, issue: number, state: issue.state,
      checked: counts.checked, required: counts.total,
      milestone: issueChecklistComplete ? 'ISSUE_CHECKLIST_COMPLETE' : 'ACCEPTANCE_OPEN',
    };
  });
  const first = milestones.find(x => x.milestone !== 'ISSUE_CHECKLIST_COMPLETE');
  const conflicts = [];
  const blockedIndex = first ? milestones.indexOf(first) : milestones.length;
  for (const [i, m] of milestones.entries()) {
    if (i > blockedIndex && m.milestone === 'ISSUE_CHECKLIST_COMPLETE')
      conflicts.push('DEPENDENCY_BYPASS_' + m.batch);
  }
  const acceptedByIssue = milestones.filter(x => x.milestone === 'ISSUE_CHECKLIST_COMPLETE').length;
  const nextBatch = first?.batch ?? 'P12_RELEASE_EVIDENCE_REVIEW';
  const nextAction = first?.batch === 'P02'
    ? 'OBTAIN_SCOPED_OWNER_APPROVAL_FOR_REAL_OWNER_A_B_JWT_BROWSER_RLS_AND_VERCEL_STAGING'
    : first?.batch === 'P03'
      ? 'VERIFY_SAVED_SERVICE_BRANCH_RATEBOOK_CURRENCY_REVISION_AND_QUOTE_WITH_TWO_OWNERS'
      : first ? 'COMPLETE_AUTHORIZED_SAVED_BUSINESS_RECEIPTS_FOR_' + first.batch
        : 'INDEPENDENT_RELEASE_REVIEW_AND_SEPARATE_OWNER_DEPLOY_APPROVAL';
  return {
    schema:'servicedesk.sonic.critical-path-readonly.v1',
    evidence:'GITHUB_ISSUE_CHECKBOXES_ONLY_NOT_BUSINESS_ACCEPTANCE',
    repo:REPO,
    existingFeaturePr:{number:915,headSha:pr.head.sha,draft:pr.draft,merged:pr.merged},
    acceptedByIssue, total:milestones.length,
    nextBatch, nextAction,
    issueGateStatus:first ? 'NOT_READY' : 'ISSUE_CHECKLISTS_ONLY_REQUIRE_INDEPENDENT_UAT',
    stagedOwnerJourneyVerified:false, productionReleaseApproved:false,
    releaseVeto:NO_GO,
    driftViolations:conflicts,
    milestones,
  };
}

export async function getLiveMilestones({token, fetcher=fetch}={}) {
  if (typeof token !== 'string' || token.length < 8) throw Error('GITHUB_READ_TOKEN_REQUIRED');
  const base='https://api.github.com/repos/' + REPO;
  const headers={
    Authorization:'Bearer '+token,
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'servicedesk-sonic-readonly-milestone-gate',
  };
  const get=async path=>{
    const url=base+path;
    const r=await fetcher(url,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(10000)});
    if (!r?.ok) throw Error('GITHUB_ISSUE_GATE_UNAVAILABLE');
    return r.json();
  };
  const [issues,pr]=await Promise.all([
    Promise.all(DELIVERY_ISSUES.map(x=>get('/issues/'+x.number))),
    get('/pulls/915'),
  ]);
  return assessMilestones(issues,pr);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result=await getLiveMilestones({token:process.env.GH_TOKEN || process.env.GITHUB_TOKEN});
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if (result.driftViolations.length) process.exitCode=2;
  } catch (error) {
    const reason=String(error?.message??'GATE_FAILED');
    process.stderr.write(JSON.stringify({state:'NO_EVIDENCE',reason:/^[A-Z0-9_]+$/.test(reason)?reason:'GATE_FAILED'})+'\n');
    process.exitCode=1;
  }
}
