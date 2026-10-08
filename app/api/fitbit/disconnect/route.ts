import { NextRequest, NextResponse } from "next/server";
import { revokeFitbitToken } from "@/lib/fitbit";
import { deleteConnection, getConnection } from "@/lib/fitbitConnections";
import { deleteStepsForName } from "@/lib/steps";

const MAX_NAME_LENGTH = 100;

/**
 * Disconnects a participant: revokes their Fitbit token (best-effort, real
 * connections only), then deletes both the stored connection and every step
 * entry it produced. This is intentionally thorough — participants should
 * be able to trust that "Disconnect" really does remove their data, since
 * that's what makes the integration feel safe to opt into in the first
 * place.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  }

  const trimmedName = name.trim();

  try {
    const conn = await getConnection(trimmedName);
    if (conn && !conn.isMock) {
      await revokeFitbitToken(conn.accessToken).catch(() => {
        // Best-effort — even if Fitbit's revoke call fails (e.g. already
        // revoked, network issue), we still remove our local copy below.
      });
    }

    await deleteConnection(trimmedName);
    await deleteStepsForName(trimmedName);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to disconnect." },
      { status: 500 }
    );
  }
}
