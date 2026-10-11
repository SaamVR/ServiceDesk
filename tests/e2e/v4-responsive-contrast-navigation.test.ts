import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const file=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const pages=file("src/features/product/BrightProductPages.module.css");
const tour=file("src/app/tour/tour.module.css");
const homepage=file("src/features/product/BrightHomeExperience.module.css");
const auth=file("src/features/auth/RegistrationShell.module.css");
const header=file("src/components/shell/MarketingNavV3.module.css");

function luminance(hex:string) {
  return [1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255)
    .map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4)
    .reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
}
function contrast(a:string,b:string) {
  const l=luminance(a), r=luminance(b);
  return (Math.max(l,r)+0.05)/(Math.min(l,r)+0.05);
}
describe("V4 Clean Air responsive readability and contrast",()=>{
  it("makes all primary orange and teal actions readable with white text",()=>{
    expect(contrast("#bd4b36","#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#a93b2b","#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#167770","#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(pages).toContain("--coral: #bd4b36");
    expect(tour).toContain("--coral: #bd4b36");
    expect(homepage).toContain("--clean-coral: #bd4b36");
    expect(auth).toContain("background: #bd4b36");
    expect(header).toContain("background: #167770");
  });
  it("has no hardcoded microtext in the full homepage or auth/marketing header skins",()=>{
    for(const css of [homepage,auth,header]) {
      const sizes=[...css.matchAll(/font-size:\s*([0-9]*\.?[0-9]+)rem\b/g)].map(x=>Number(x[1]));
      expect(sizes.length).toBeGreaterThan(8);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(0.75);
    }
  });
  it("organizes the mobile provider diagram into a stable two-column grid instead of absolutely overlapping cards",()=>{
    expect(pages).toContain(".networkNodes {\n    position: static; inset: auto; display: grid;");
    expect(pages).toContain("grid-template-columns: repeat(2,minmax(0,1fr))");
    expect(pages).toContain(".networkNode strong,.networkNode small { overflow-wrap: anywhere; }");
    expect(pages).toContain("position: static; width: 100%; margin: 0;");
    expect(tour).toContain(".cardStage small { grid-column: 2; text-align: left;");
  });
});
