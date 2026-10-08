import {
  getSupabaseAdminClient,
  isSupabaseAdminConfigured,
  type FitbitConnectionRow,
} from "@/lib/supabase";
import { decryptToken, encryptToken } from "@/lib/crypto";
import {
  deleteFitbitConnection as deleteMemoryConnection,
  getFitbitConnection as getMemoryConnection,
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
