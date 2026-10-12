import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const panel=read("src/features/operations/AiOwnerModelProbe.tsx");
const css=read("src/features/operations/AiOwnerModelProbe.module.css");
function luminance(hex:string) {
  return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
    .map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4)
    .reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
}
function contrast(a:string,b:string) {
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
describe("V4 Clean Air owner AI diagnostic presentation",()=>{
  it("uses design system CSS rather than scattered inline styles",()=>{
    expect(panel).toContain('import styles from "./AiOwnerModelProbe.module.css"');
    expect(panel).toContain('className={styles.panel}');
    expect(panel).toContain('className={styles.action}');
    expect(panel).not.toContain('style={{');
    expect(css).toContain("min-height: 46px");
    expect(css).toContain("width: 100%");
    expect(css).toContain("@media (max-width: 440px)");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
  it("enforces legible body, header, primary button and disabled state",()=>{
    expect(contrast("#4e6d63","#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#254b43","#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff","#166b5e")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#51655d","#e5eeea")).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain("font-size: 14px");
  });
  it("never implies model setup alone establishes provider delivery",()=>{
    expect(panel).toContain("Configured · unverified");
    expect(panel).toContain("Setup required");
    expect(panel).toContain("does not verify WhatsApp, email or automation delivery");
    expect(panel).toContain("ephemeral connection test");
    expect(panel).toContain("not a durable");
    expect(panel).toContain('role="status"');
    expect(panel).toContain('role="alert"');
    expect(panel).toContain("disabled={!configured || busy}");
  });
});
