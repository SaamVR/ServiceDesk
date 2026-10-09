import { NextResponse } from "next/server";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";

type Row = Record<string, unknown>;

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceSlug = url.searchParams.get("workspace")?.trim();
  const daysRaw = Number(url.searchParams.get("days") ?? "7");
  const days = Number.isInteger(daysRaw) && daysRaw >= 1 && daysRaw <= 31 ? daysRaw : 7;

  if (!workspaceSlug) {
    return new NextResponse("Workspace is required.", { status: 400 });
  }

  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) {
    const status = resolved.kind === "authentication" ? 401 : resolved.kind === "authorization" ? 403 : 404;
    return new NextResponse("Audit export is not available.", { status });
  }
  if (resolved.value.actor.role !== "OWNER") {
    return new NextResponse("Audit export is Owner-only.", { status: 403 });
  }

  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await resolved.value.rpc.rpc<Row>(
    "servicedesk_read_audit_export_metadata",
    {
      p_input: {
        workspaceId: resolved.value.workspace.id,
        actorUserId: resolved.value.actor.userId,
        actorRole: resolved.value.actor.role,
        from: from.toISOString(),
        to: now.toISOString(),
        limit: 5000,
        now: now.toISOString(),
      },
    },
  );

  if (error || !data || data.ok !== true) {
    return new NextResponse("Audit export could not be generated.", { status: 503 });
  }

  const rows = Array.isArray(data.rows)
    ? data.rows.filter((value): value is Row => Boolean(value) && typeof value === "object" && !Array.isArray(value))
    : [];

  const header = [
    "id",
    "actor_role",
    "action",
    "resource_type",
    "resource_id",
    "request_id",
    "created_at",
  ];
  const body = rows.map((row) => [
    row.id,
    row.actorRole,
    row.action,
    row.resourceType,
    row.resourceId,
    row.requestId,
    row.createdAt,
  ].map(csvCell).join(","));

  const csv = [header.map(csvCell).join(","), ...body].join("\n") + "\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="servicedesk-audit-metadata.csv"',
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
