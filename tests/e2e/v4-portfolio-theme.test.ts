import {describe,expect,it} from "vitest";
import {nextPortfolioTheme,PORTFOLIO_THEME_ATTRIBUTE,PORTFOLIO_THEME_KEY,portfolioThemeBootScript} from "@/features/product/portfolio-theme";

describe("portfolio theme isolation and persistence",()=>{
 it("switches explicitly between colorful light and deep-green dark",()=>{
  expect(nextPortfolioTheme("light")).toBe("dark");
  expect(nextPortfolioTheme("dark")).toBe("light");
 });
 it("persists an allowlisted appearance before CSS paints without server access",()=>{
  expect(PORTFOLIO_THEME_ATTRIBUTE).toBe("data-portfolio-theme");
  expect(portfolioThemeBootScript).toContain(PORTFOLIO_THEME_KEY);
  expect(portfolioThemeBootScript).toContain('theme="light"');
  expect(portfolioThemeBootScript).toContain('saved==="dark"||saved==="light"');
  expect(portfolioThemeBootScript).not.toContain("fetch(");
 });
});
