import { exportSessionData } from "@/server/mongo";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/session-dump/[sessionCode]">
) {
  const { sessionCode } = await context.params;

  if (!sessionCode) {
    return Response.json({ error: "sessionCode is required" }, { status: 400 });
  }

  const data = await exportSessionData(sessionCode);
  if (!data) {
    return Response.json(
      { error: "Mongo export unavailable. Check MONGODB_URI." },
      { status: 500 }
    );
  }

  return Response.json(data, {
    headers: {
      "Content-Disposition": `attachment; filename=\"${sessionCode}-mongo-dump.json\"`,
    },
  });
}
