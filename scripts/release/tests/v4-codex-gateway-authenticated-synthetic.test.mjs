import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateProbeConfig, validateStructuredProbeCompletion,
  executeSyntheticGatewayProbe,
} from "../v4-codex-gateway-authenticated-synthetic.mjs";

const id = "11111111-1111-4111-8111-111111111111";
const config = {
  acknowledgement: "I_AUTHORIZE_ONE_SYNTHETIC_CODEX_PROBE",
  workspaceId: id, allowedWorkspaceId: id,
  bearer: "synthetic-secret-not-real",
};
const payload = {
  output: {}, replyDraft: "ServiceDesk model probe acknowledged",
  requestedToolCalls: [], citations: [],
};
function envelope(data = payload, overrides = {}) {
  return {
    object: "chat.completion",
    choices: [{index:0,finish_reason:"stop",
      message:{role:"assistant",content:JSON.stringify(data)}}],
    ...overrides,
  };
}
describe("one-shot Codex synthetic public probe guard", () => {
  it("requires a specific acknowledgement, an identical fictional workspace and a separate bearer key", () => {
    assert.equal(validateProbeConfig(config),null);
    assert.equal(validateProbeConfig({...config,acknowledgement:"true"}),"OPERATOR_AUTHORIZATION_REQUIRED");
    assert.equal(validateProbeConfig({...config,workspaceId:"other"}),"OPERATOR_AUTHORIZATION_REQUIRED");
    assert.equal(validateProbeConfig({...config,workspaceId:"22222222-2222-4222-8222-222222222222"}),"OPERATOR_AUTHORIZATION_REQUIRED");
    assert.equal(validateProbeConfig({...config,bearer:""}),"EVALUATION_GATEWAY_SECRET_MISSING");
    assert.equal(validateProbeConfig({...config,bearer:"bad\nsecret"}),"EVALUATION_GATEWAY_SECRET_MISSING");
  });
  it("checks exact role, stop finish, four-field structured JSON and no tool execution", () => {
    assert.equal(validateStructuredProbeCompletion(envelope()),true);
    for (const invalid of [
      envelope(payload,{choices:[]}),
      envelope(payload,{choices:[envelope().choices[0],envelope().choices[0]]}),
      envelope(payload,{choices:[{...envelope().choices[0],finish_reason:"length"}]}),
      envelope(payload,{choices:[{...envelope().choices[0],message:{
        role:"assistant",content:JSON.stringify(payload),tool_calls:[]}}]}),
      envelope({...payload,requestedToolCalls:[{name:"send_message"}]}),
      envelope({...payload,citations:[{documentId:"private"}]}),
      envelope({...payload,replyDraft:"different"}),
      envelope({...payload,output:{priceMinor:2000}}),
    ]) assert.equal(validateStructuredProbeCompletion(invalid),false);
  });
  it("does not call a provider when unapproved", async () => {
    let called = false;
    const result = await executeSyntheticGatewayProbe({...config,acknowledgement:"not-approved"},async()=>{
      called = true; return new Response();
    });
    assert.equal(called,false);
    assert.equal(result.providerVerified,false);
    assert.equal(result.state,"CONFIGURATION_BLOCKED");
  });
  it("sends only hardcoded synthetic body to the exact HTTPS hostname and rejects provider failure", async () => {
    const calls = [];
    const done = await executeSyntheticGatewayProbe(config, async(url,init)=>{
      calls.push({url,init});
      return new Response(JSON.stringify(envelope()),{status:200,headers:{"content-type":"application/json"}});
    });
    assert.equal(done.state,"PROVIDER_VERIFIED_PUBLIC_SYNTHETIC_ONLY");
    assert.equal(done.serviceDeskOwnerJourneyVerified,false);
    assert.equal(done.businessMutations,0);
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,"https://codex-api.ezcomo.shop/v1/chat/completions");
    assert.equal(calls[0].init.redirect,"error");
    assert.equal(calls[0].init.headers.authorization,"Bearer "+config.bearer);
    assert.equal(calls[0].init.body.includes(id),false);
    assert.equal(calls[0].init.body.includes(config.bearer),false);
    assert.equal(calls[0].init.body.includes("customerId"),false);
    const denied = await executeSyntheticGatewayProbe(config,async()=>new Response("raw provider secret",{status:401}));
    assert.equal(denied.providerVerified,false);
    assert.equal(JSON.stringify(denied).includes("raw provider secret"),false);
    const rejected = await executeSyntheticGatewayProbe(config,async()=>
      new Response(JSON.stringify(envelope({...payload,requestedToolCalls:[{name:"oops"}]})),
        {status:200,headers:{"content-type":"application/json"}}));
    assert.equal(rejected.providerVerified,false);
  });
});
