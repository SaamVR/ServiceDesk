import { type NextRequest } from "next/server";
import { refreshAuthSession } from "@/features/auth/session-proxy";
import { STAFF_REQUEST_TARGET_HEADER } from "@/features/auth/studio-return-path";

export async function proxy(request: NextRequest) {
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
