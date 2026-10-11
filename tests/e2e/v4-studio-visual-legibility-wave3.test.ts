import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const file=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
const rail=file("src/components/product/StaffCleanAirV4.module.css");
const workroom=file("src/features/operations/StaffOverviewDashboard.module.css");
function lum(h:string) {return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)
  .map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4)
  .reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0)}
function contrast(a:string,b:string) {const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
describe("V4 actual Studio content hierarchy",()=>{
  it("keeps all V4 Studio sidebar labels at >= 12px even at 320px",()=>{
    const sizes=[...rail.matchAll(/font-size:\s*([0-9]*\.?[0-9]+)rem\b/g)].map(x=>Number(x[1]));
    expect(sizes.length).toBeGreaterThan(9);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(.75);
  });
  it("makes real workroom metric supporting text readable against white",()=>{
    const palette=["#536f64","#557066","#566f64","#536b61","#526d61"];
    for(const color of palette) {
      expect(contrast(color,"#ffffff"),color).toBeGreaterThanOrEqual(4.5);
      expect(workroom).toContain(color);
    }
    expect(workroom).toContain("/* V4 / CLEAN AIR — real Today workroom.");
    expect(workroom).toContain(".kpi_warning");
    expect(workroom).toContain(".kpi_danger");
  });
});
