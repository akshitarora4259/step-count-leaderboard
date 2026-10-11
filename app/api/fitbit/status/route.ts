import { NextResponse } from "next/server";
import { getConnectionByUserId } from "@/lib/fitbitConnections";
import { getCurrentIdentity } from "@/lib/identity";

/** Returns whether the signed-in caller has a Fitbit connection — never includes tokens. */
export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) {
    return NextResponse.json({ connected: false, signedIn: false });
  }

  try {
    const conn = await getConnectionByUserId(identity.userId);
    if (!conn) {
      return NextResponse.json({ connected: false, signedIn: true });
    }
    return NextResponse.json({
      connected: true,
      signedIn: true,
      name: conn.name,
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
