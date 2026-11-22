/** Theme parsing for the isolated portfolio presentation; no auth or tenant state. */
export type PortfolioTheme = "light" | "dark";
export const PORTFOLIO_THEME_KEY = "servicedesk-portfolio-theme-v1";
export const PORTFOLIO_THEME_EVENT = "servicedesk-portfolio-theme-change";

export function parsePortfolioTheme(value: string | null): PortfolioTheme {
  return value === "dark" ? "dark" : "light";
}

export function oppositePortfolioTheme(current: PortfolioTheme): PortfolioTheme {
  return current === "dark" ? "light" : "dark";
}
