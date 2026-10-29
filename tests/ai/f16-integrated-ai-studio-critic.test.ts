import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=(path:string)=>readFileSync(path);
const hash=(b:Buffer)=>createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
const lock=JSON.parse(read("docs/delivery/sonic-ir17-f16-grounded-quote-source-lock-20261030.json").toString()) as {
 baseIR16:string;sourceOnly:boolean;sourceBranch:string;
 imported:Array<{path:string;sha:string}>;
 priorWorkbenchSha:string;integratedWorkbenchSha:string;
 priceBookMustExist:boolean;modelCalls:boolean;quoteCreated:boolean;paymentOrSend:boolean;
 productionGate:string;
};
describe("IR17 independent critic: genuine price-book quote proposal UI",()=>{
 it("pins three independent source files and one exact reviewed AI Studio successor",()=>{
  expect(lock.baseIR16).toBe("fe4d69b6d618e7c13172da832fca7309c11c65d5");
  expect(lock.sourceBranch).toBe("sonic-feature/f16-grounded-quote-ui-20261030");
  expect(lock.imported).toHaveLength(3);
  expect(new Set(lock.imported.map(x=>x.path)).size).toBe(3);
  for(const x of lock.imported)expect(hash(read(x.path)),x.path).toBe(x.sha);
  expect(lock.priorWorkbenchSha).toBe("445f21423e3ca317d12842f71b99d588c3265dfa");
  expect(lock.integratedWorkbenchSha).toBe("6b7502ac0ddb7f5210ad16ed389f59a944527638");
  expect(hash(read("src/features/operations/AiStudioWorkbench.tsx"))).toBe(lock.integratedWorkbenchSha);
 });
 it("review is attached to actual saved request; prices never generated from absent books",()=>{
  const workbench=read("src/features/operations/AiStudioWorkbench.tsx").toString();
  expect(workbench).toContain('<AiGroundedQuoteAlternatives workspaceSlug={workspaceSlug} requestId={selected.id} />');
  expect(workbench).toContain('selected && mode === "request"');
  const action=read("src/features/operations/f16-grounded-quote-review-action.ts").toString();
  expect(action).toContain("proposeAuthorizedGroundedQuoteAlternatives");
  expect(action).toContain("expectedVersion:req.version");
  expect(action).toContain("return denied()");
  expect(lock).toMatchObject({sourceOnly:true,priceBookMustExist:true,
   modelCalls:false,quoteCreated:false,paymentOrSend:false,
   productionGate:"P02_818_OPEN_P03_819_QUEUED"});
 });
});
