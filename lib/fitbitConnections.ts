import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
  type FitbitConnectionRow,
} from "@/lib/supabase";
import { decryptToken, encryptToken } from "@/lib/crypto";
import {
  deleteFitbitConnection as deleteMemoryConnection,
  getFitbitConnection as getMemoryConnection,
  getFitbitConnectionByFitbitUserId as getMemoryConnectionByFitbitUserId,
  listFitbitConnections as listMemoryConnections,
  upsertFitbitConnection as upsertMemoryConnection,
} from "@/lib/memoryStore";

/**
 * Fitbit connection storage abstraction.
 *
 * Deliberately branches on `isSupabaseAdminConfigured()` (NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY) rather than the generic `isSupabaseConfigured()`
 * used for the `steps` table — tokens are sensitive enough that we require
 * the service-role-backed admin client specifically, even if the public
 * anon Supabase client is otherwise configured. Falls back to the in-memory
 * dev store otherwise.
 */

export type ConnectionInput = {
  name: string;
  email: string | null;
  fitbitUserId: string | null;
  /** Plaintext tokens in — encrypted before being persisted. */
  accessToken: string;
  refreshToken: string;
  /** ISO timestamp. */
  expiresAt: string;
  isMock: boolean;
};

export type DecryptedConnection = {
  name: string;
  email: string | null;
  fitbitUserId: string | null;
  /** Plaintext tokens out — decrypted only in-process, never returned from an API route. */
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  connectedAt: string;
  isMock: boolean;
};

function toRow(input: ConnectionInput): Omit<FitbitConnectionRow, "id" | "connected_at" | "updated_at"> {
  return {
    name: input.name,
    email: input.email,
    fitbit_user_id: input.fitbitUserId,
    access_token: encryptToken(input.accessToken),
    refresh_token: encryptToken(input.refreshToken),
    token_expires_at: input.expiresAt,
    is_mock: input.isMock,
  };
}

function fromRow(row: FitbitConnectionRow): DecryptedConnection {
  return {
    name: row.name,
    email: row.email,
    fitbitUserId: row.fitbit_user_id,
    accessToken: decryptToken(row.access_token),
    refreshToken: decryptToken(row.refresh_token),
    expiresAt: row.token_expires_at,
    connectedAt: row.connected_at,
    isMock: row.is_mock,
  };
}

export async function upsertConnection(input: ConnectionInput): Promise<void> {
  const row = toRow(input);

  if (!isSupabaseAdminConfigured()) {
    upsertMemoryConnection(row);
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("fitbit_connections")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "name" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getConnection(name: string): Promise<DecryptedConnection | null> {
  if (!isSupabaseAdminConfigured()) {
    const row = getMemoryConnection(name);
    return row ? fromRow(row) : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("fitbit_connections")
    .select("*")
    .ilike("name", name)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data ? fromRow(data as FitbitConnectionRow) : null;
}

/** Case-sensitive lookup by Fitbit's opaque `user_id` — used to detect the
 * same real Fitbit account already being linked under a different
 * participant name (see migration 0004's partial unique index). */
export async function getConnectionByFitbitUserId(
  fitbitUserId: string
): Promise<DecryptedConnection | null> {
  if (!isSupabaseAdminConfigured()) {
    const row = getMemoryConnectionByFitbitUserId(fitbitUserId);
    return row ? fromRow(row) : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("fitbit_connections")
    .select("*")
    .eq("fitbit_user_id", fitbitUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data ? fromRow(data as FitbitConnectionRow) : null;
}

/**
 * Throws a friendly, user-facing error if `fitbitUserId` is already linked
 * to a *different* participant name. Reconnecting under the *same* name is
 * fine (e.g. a token refresh re-running the OAuth flow) and is a no-op here.
 *
 * Callers MUST await this before writing a connection (see
 * app/api/fitbit/callback/route.ts and lib/fitbitMock.ts's `connectMock`) so
 * a conflict is caught before anything is persisted — never partway through.
 * `upsertFitbitConnection` in lib/memoryStore.ts enforces the same rule as a
 * defense-in-depth backstop for the in-memory path; the real Supabase path's
 * hard backstop is the migration 0004 partial unique index.
 */
export async function assertFitbitUserIdAvailable(
  fitbitUserId: string | null | undefined,
  name: string
): Promise<void> {
  if (!fitbitUserId) return;
  const existing = await getConnectionByFitbitUserId(fitbitUserId);
  if (existing && existing.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
    throw new Error(
      `This Fitbit account is already connected under the name "${existing.name}". Each Fitbit account can only join once.`
    );
  }
}

export async function deleteConnection(name: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) {
    deleteMemoryConnection(name);
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("fitbit_connections").delete().ilike("name", name);
  if (error) {
    throw new Error(error.message);
  }
}

export async function listConnections(): Promise<DecryptedConnection[]> {
  if (!isSupabaseAdminConfigured()) {
    return listMemoryConnections().map(fromRow);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("fitbit_connections").select("*");
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => fromRow(row as FitbitConnectionRow));
}
