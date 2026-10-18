import {describe,expect,it} from "vitest";
import {testAuthorizedAiModelConnection,type AiConnectionTestDependencies} from "../../src/server/ai/owner-provider-connection-test";
const output={output:{},replyDraft:"ServiceDesk model probe acknowledged",
  requestedToolCalls:[],citations:[]};
const make=(options:{afterRole?:string;afterUser?:string;badOutput?:unknown;badClock?:string}={})=>{
  let auth=0,model=0;
  const deps={
    resolveActor:async()=>{
      auth++;
      return {ok:true,value:{
        workspace:{id:"workspace-qa",slug:"qa-cleaning"},
        actor:{workspaceId:"workspace-qa",role:auth>1?(options.afterRole??"OWNER"):"OWNER",
          userId:auth>1?(options.afterUser??"owner-1"):"owner-1"},
      }};
    },
    readConfig:()=>({ok:true,value:{model:"fictional-model",now:()=>options.badClock??"2026-10-18T03:00:00.000Z"}}),
    callModel:async()=>{model++;return {ok:true,value:{...output,output:options.badOutput??{}}};},
  } as unknown as AiConnectionTestDependencies;
  return {deps,counts:()=>({auth,model})};
};
describe("SONIC R36 connection diagnostic post-provider owner boundary",()=>{
 it("rechecks the owner and returns only ephemeral controlled probe evidence",async()=>{
    const x=make();
    expect(await testAuthorizedAiModelConnection("qa-cleaning",x.deps))
      .toMatchObject({ok:true,value:{durableReceipt:false,state:"PROVIDER_RESPONDED_TO_CONTROLLED_PROBE"}});
    expect(x.counts()).toEqual({auth:2,model:1});
 });
 it("rejects same workspace but revoked owner or switched user after provider generation",async()=>{
   for(const opt of [{afterRole:"DISPATCHER"},{afterUser:"foreign-user"}]){
      const x=make(opt);
      expect(await testAuthorizedAiModelConnection("qa-cleaning",x.deps))
        .toMatchObject({ok:false,code:"AI_DIAGNOSTIC_OWNER_REVOKED"});
      expect(x.counts().model).toBe(1);
   }
 });
 it("fails on forged empty output with hidden fields, arrays or inherited data",async()=>{
    const hidden=Object.defineProperty({},"privateMessage",{value:"private",enumerable:false});
    for(const badOutput of [hidden,[],Object.create({private:"secret"})]){
      const x=make({badOutput});
      expect(await testAuthorizedAiModelConnection("qa-cleaning",x.deps))
        .toMatchObject({ok:false,code:"AI_DIAGNOSTIC_RESPONSE_UNVERIFIED"});
      expect(x.counts().auth).toBe(1);
    }
 });
 it("does not emit a provider badge with an invalid clock or unexpected input",async()=>{
    const x=make({badClock:"2026-02-30T03:00:00.000Z"});
    expect(await testAuthorizedAiModelConnection("qa-cleaning",x.deps))
      .toMatchObject({ok:false,code:"AI_DIAGNOSTIC_CLOCK_UNAVAILABLE"});
    expect(await testAuthorizedAiModelConnection(null as never,x.deps))
      .toMatchObject({ok:false,code:"AI_DIAGNOSTIC_INPUT_INVALID"});
 });
});
