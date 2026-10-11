import { verifiedHostingCommitIdentity } from "./deployment-identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Read-only operational liveness and non-secret host build provenance.
 * SHA is omitted when the hosting environment supplies no reliable value.
 * It is not proof of a deployment until checked against provider metadata.
 */
export function GET() {
  const identity = verifiedHostingCommitIdentity(process.env);
  return Response.json(
    {
      ok: true,
      service: "servicedesk",
      status: "live",
      ...(identity ?? {}),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
