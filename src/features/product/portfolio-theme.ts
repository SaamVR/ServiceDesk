export type PortfolioAppearance = "light" | "dark";
export const PORTFOLIO_THEME_KEY = "servicedesk-portfolio-theme-v1";
export const PORTFOLIO_THEME_ATTRIBUTE = "data-portfolio-theme";

/**
 * Runs in the document head before CSS paints. A visitor's manual choice
 * wins across all portfolio routes. No server-side user state or cookies.
 * Default is the deliberately colorful light edition.
 */
export const portfolioThemeBootScript = String.raw`(()=>{let theme="light";try{const saved=localStorage.getItem("servicedesk-portfolio-theme-v1");if(saved==="dark"||saved==="light")theme=saved}catch{}document.documentElement.dataset.portfolioTheme=theme;document.documentElement.style.colorScheme=theme;})();`;

export function nextPortfolioTheme(current: PortfolioAppearance): PortfolioAppearance {
  return current === "dark" ? "light" : "dark";
}
