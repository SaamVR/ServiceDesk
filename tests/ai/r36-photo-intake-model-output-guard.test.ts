import {describe,expect,it} from "vitest";
import {validatePhotoClassificationRequest,validatePhotoClassificationOutput,
 type PhotoIntakeClassificationRequest} from "../../src/server/ai/photo-intake";
const input:PhotoIntakeClassificationRequest={workspaceId:"workspace-1",requestId:"request-1",
 photoAssetId:"asset-1",consentStatus:"GRANTED",processingOptOut:false,
 trainingAllowed:false,allowedCategoryCodes:["DEEP","STANDARD"],allowedAddOnCodes:["OVEN"],
 image:{mediaType:"image/png",bytes:new Uint8Array([1,2,3])}};
const valid={categoryCode:"DEEP",confidenceBasisPoints:8000,
 followUpQuestions:["Is the image typical of the property?"]};
describe("SONIC R36 photo AI safe multimodal proposal",()=>{
 it("retains genuine consented classification suggestion with no commercial action",()=>{
  expect(validatePhotoClassificationRequest(input)).toMatchObject({ok:true});
  expect(validatePhotoClassificationOutput(input,valid))
    .toMatchObject({ok:true,value:{categoryCode:"DEEP",confidenceBasisPoints:8000}});
 });
 it("rejects malformed raw photo payloads before invoking a model",()=>{
  for(const broken of [null,
    {...input,image:undefined},{...input,image:{mediaType:"image/png",bytes:{byteLength:1}}},
    {...input,allowedAddOnCodes:"OVEN"},
    {...input,allowedCategoryCodes:Array(2).fill("DEEP")},
    {...input,allowedAddOnCodes:Array(81).fill("OVEN")},
  ]){
   expect(()=>validatePhotoClassificationRequest(broken as PhotoIntakeClassificationRequest)).not.toThrow();
   expect(validatePhotoClassificationRequest(broken as PhotoIntakeClassificationRequest).ok).toBe(false);
  }
 });
 it("rejects hidden pricing, unknown fields and injected accessor without executing it",()=>{
  const cases=[
   {...valid,priceMinor:100},
   {...valid,customerEmail:"private@example.test"},
   Object.assign(Object.create({trusted:true}),valid),
   Object.defineProperty({...valid},"refund",{value:true,enumerable:false}),
   Object.defineProperty({...valid},"rationale",{enumerable:true,get(){throw Error("unsafe AI accessor");}}),
  ];
  for(const value of cases){
   expect(()=>validatePhotoClassificationOutput(input,value)).not.toThrow();
   expect(validatePhotoClassificationOutput(input,value).ok).toBe(false);
  }
 });
 it("rejects spoofed, sparse and getter-based question arrays, never hallucinated actions",()=>{
  const accessor=Array(1);
  Object.defineProperty(accessor,0,{enumerable:true,get(){throw Error("unsafe question");}});
  for(const followUpQuestions of [accessor,Array(1),["A".repeat(201)],["unsafe\u202estatement"]]){
   expect(()=>validatePhotoClassificationOutput(input,{...valid,followUpQuestions})).not.toThrow();
   expect(validatePhotoClassificationOutput(input,{...valid,followUpQuestions}))
    .toMatchObject({ok:false,code:"PHOTO_AI_FOLLOWUP_INVALID"});
  }
 });
});
