import { NextResponse } from "next/server";
import { revokeFitbitToken } from "@/lib/fitbit";
import { deleteConnectionByUserId, getConnectionByUserId } from "@/lib/fitbitConnections";
import { deleteStepsForUserId } from "@/lib/steps";
import { getCurrentIdentity } from "@/lib/identity";

/**
 * Disconnects the signed-in participant: revokes their Fitbit token
 * (best-effort, real connections only), then deletes both the stored
 * connection and every step entry it produced.
 *
 * Identity comes from the session (see lib/identity.ts), NOT a `name` field
 * in the request body — previously any client could POST `{ name: "someone
 * else" }` here and delete that person's data. Returns 401 if not signed in.
 */
export async function POST() {
  const identity = await getCurrentIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  try {
    const conn = await getConnectionByUserId(identity.userId);
    if (conn && !conn.isMock) {
      await revokeFitbitToken(conn.accessToken).catch(() => {
        // Best-effort — even if Fitbit's revoke call fails (e.g. already
        // revoked, network issue), we still remove our local copy below.
      });
    }

    await deleteConnectionByUserId(identity.userId);
    await deleteStepsForUserId(identity.userId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to disconnect." },
      { status: 500 }
    );
  }
}
