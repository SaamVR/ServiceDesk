import { type NextRequest } from "next/server";
import { refreshAuthSession } from "@/features/auth/session-proxy";
import { STAFF_REQUEST_TARGET_HEADER } from "@/features/auth/studio-return-path";
import { portfolioAllowsRequest } from "@/features/product/portfolio-route-policy";

export async function proxy(request: NextRequest) {
  // A public portfolio is not an invitation to exercise unfinished SaaS routes,
  // Auth actions, provider webhooks or payment/tenant APIs. Allow only public
  // brochure/sandbox reads, and reject mutations before auth/session handling.
  if (process.env.SERVICEDESK_PORTFOLIO_MODE === "true" &&
      !portfolioAllowsRequest(request.method, request.nextUrl.pathname)) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  // Always overwrite an inbound path hint; a client must not choose this header.
  request.headers.delete(STAFF_REQUEST_TARGET_HEADER);
  if (request.nextUrl.pathname.startsWith("/app/")) {
    const search = new URLSearchParams(request.nextUrl.searchParams);
    search.delete("_rsc");
    const target = request.nextUrl.pathname + (search.size ? "?" + search.toString() : "");
    if (target.length <= 2048) request.headers.set(STAFF_REQUEST_TARGET_HEADER, target);
  }
  // Session refresh still owns all auth cookies and the route remains protected
  // by server-side verified identity + tenant scope checks.
  return refreshAuthSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
