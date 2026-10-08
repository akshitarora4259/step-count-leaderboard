import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/fitbitConnections";

/** Returns whether a participant currently has a Fitbit connection — never includes tokens. */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const conn = await getConnection(name);
    if (!conn) {
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json({
      connected: true,
      isMock: conn.isMock,
      connectedAt: conn.connectedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check status." },
      { status: 500 }
    );
  }
}
