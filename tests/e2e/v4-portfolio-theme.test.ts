import {describe,expect,it} from "vitest";
import {parsePortfolioTheme,oppositePortfolioTheme,PORTFOLIO_THEME_KEY} from "@/features/product/portfolio-theme";

describe("portfolio theme preferences remain isolated from SaaS auth",()=>{
 it("uses existing light palette by default and never trusts arbitrary storage text",()=>{
  expect(parsePortfolioTheme(null)).toBe("light");
  expect(parsePortfolioTheme("unknown")).toBe("light");
  expect(parsePortfolioTheme("auto")).toBe("light");
  expect(parsePortfolioTheme("dark")).toBe("dark");
 });
 it("switches themes symmetrically without other state mutations",()=>{
  expect(oppositePortfolioTheme("light")).toBe("dark");
  expect(oppositePortfolioTheme("dark")).toBe("light");
 });
 it("uses a portfolio-only storage key",()=>{
  expect(PORTFOLIO_THEME_KEY).toMatch(/portfolio-theme/);
  expect(PORTFOLIO_THEME_KEY).not.toMatch(/auth|token|tenant|payment/);
 });
});
