import { type NextRequest } from "next/server";
import { refreshAuthSession } from "@/features/auth/session-proxy";
import { STUDIO_RETURN_HEADER, safeStudioReturnFromRequest } from "@/features/auth/studio-return-target";

export async function proxy(request: NextRequest) {
  // An untrusted client can supply headers with this name. Always remove it
  // and derive the new value from the actual request URL before auth refresh.
  request.headers.delete(STUDIO_RETURN_HEADER);
  const target = safeStudioReturnFromRequest(request.nextUrl.pathname, request.nextUrl.search);
  if (target) request.headers.set(STUDIO_RETURN_HEADER, target);
  return refreshAuthSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
