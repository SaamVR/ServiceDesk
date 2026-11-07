import test from 'node:test';
import assert from 'node:assert/strict';
import { assessMilestones, countCheckboxes, DELIVERY_ISSUES,
  getLiveMilestones } from './sonic-critical-path-gate.mjs';
const sha='a184e62ffb61280233c55c47fb01cdb7a715fc6b';
function fixtures(overrides={}) {
  return DELIVERY_ISSUES.map(({number,minimumChecks},i)=>{
    const checked=number===817 ? minimumChecks : number===818 ? 2 : 0;
    const body=Array.from({length:minimumChecks},(_,j)=>'- ['+(j<checked?'x':' ')+'] verified source or business gate').join('\n');
    return {number,state:number===817?'closed':'open',body,...overrides[number]};
  });
}
const pr={head:{sha},draft:true,merged:false};

test('P02 remains first unresolved despite a green source PR and 2/7 checks',()=>{
  const result=assessMilestones(fixtures(),pr);
  assert.equal(result.nextBatch,'P02');
  assert.equal(result.acceptedByIssue,1);
  assert.deepEqual(result.milestones[1],{batch:'P02',issue:818,state:'open',checked:2,required:7,milestone:'ACCEPTANCE_OPEN'});
  assert.equal(result.stagedOwnerJourneyVerified,false);
  assert.equal(result.productionReleaseApproved,false);
  assert.equal(result.existingFeaturePr.merged,false);
  assert.equal(result.releaseVeto.length,3);
});

test('only closed and fully checked P02 advances to P03; no live claim',()=>{
  const result=assessMilestones(fixtures({818:{state:'closed',body:'- [x] accepted\n'.repeat(7)}}),pr);
  assert.equal(result.nextBatch,'P03');
  assert.equal(result.issueGateStatus,'NOT_READY');
  assert.equal(result.stagedOwnerJourneyVerified,false);
});

test('closed but unchecked P02 remains blocked',()=>{
  const result=assessMilestones(fixtures({818:{state:'closed'}}),pr);
  assert.equal(result.nextBatch,'P02');
});

test('detects a later milestone closed while prerequisite P02 remains open',()=>{
  const result=assessMilestones(fixtures({819:{state:'closed',body:'- [x] checked\n'.repeat(6)}}),pr);
  assert.deepEqual(result.driftViolations,['DEPENDENCY_BYPASS_P03']);
  assert.equal(result.nextBatch,'P02');
});

test('all issue boxes still cannot grant production release',()=>{
  const all=fixtures();
  for(const x of all) {
    x.state='closed';
    x.body='- [x] checked\n'.repeat(x.number===818?7:6);
  }
  const result=assessMilestones(all,{...pr,merged:true,draft:false});
  assert.equal(result.acceptedByIssue,12);
  assert.equal(result.nextBatch,'P12_RELEASE_EVIDENCE_REVIEW');
  assert.equal(result.productionReleaseApproved,false);
  assert.equal(result.issueGateStatus,'ISSUE_CHECKLISTS_ONLY_REQUIRE_INDEPENDENT_UAT');
});

test('malformed and missing evidence fail closed, including duplicate issue',()=>{
  assert.throws(()=>assessMilestones(fixtures().slice(1),pr),/INCOMPLETE_MILESTONE_INPUT/);
  const duplicate=fixtures(); duplicate[1]=duplicate[0];
  assert.throws(()=>assessMilestones(duplicate,pr),/INVALID_MILESTONE_INPUT/);
  assert.throws(()=>assessMilestones(fixtures(),{...pr,head:{sha:'bad'}}),/PR_EVIDENCE_UNVERIFIED/);
  assert.throws(()=>countCheckboxes(null),/ISSUE_BODY_UNVERIFIED/);
});

test('online path is GET-only, pinned to GitHub and returns no issue bodies or tokens',async()=>{
  const issues=fixtures();
  const seen=[];
  const result=await getLiveMilestones({token:'fictional_read_token',fetcher:async(url,opts)=>{
    seen.push({url,method:opts.method});
    assert.equal(opts.redirect,'error');
    assert.equal(opts.method,'GET');
    assert.ok(url.startsWith('https://api.github.com/repos/SaamVR/ServiceDesk/'));
    const path=url.split('/').at(-1);
    const data=path==='915'?pr:issues.find(x=>String(x.number)===path);
    assert.ok(data);
    return {ok:true,json:async()=>data};
  }});
  assert.equal(result.nextBatch,'P02');
  assert.equal(seen.length,13);
  const publicResult=JSON.stringify(result);
  assert.ok(!publicResult.includes('fictional_read_token'));
  assert.ok(!publicResult.includes('verified source or business gate'));
});

test('no token, unavailable GitHub and HTTP denial cannot become green',async()=>{
  await assert.rejects(getLiveMilestones({token:''}),/GITHUB_READ_TOKEN_REQUIRED/);
  await assert.rejects(getLiveMilestones({token:'fictional_read_token',fetcher:async()=>({ok:false,status:403})}),/GITHUB_ISSUE_GATE_UNAVAILABLE/);
});
