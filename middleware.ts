import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase Auth session cookie on every request, per the
 * official `@supabase/ssr` App Router pattern — without this, a signed-in
 * user's session can silently expire mid-visit even though Route Handlers
 * keep reading a stale (or missing) cookie.
 *
 * No-op when Supabase isn't configured (local/mock-mode dev with zero
 * setup) — there's no real session to refresh in that case.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touch the session so an expiring access token gets refreshed and the
  // new cookie is written back via setAll above.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif)$).*)"],
};
