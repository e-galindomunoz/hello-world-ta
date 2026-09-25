import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

function failure(message: string, status: number) {
  return new Response(message, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (request.nextUrl.search) return failure("The callback URL must not contain query parameters.", 400);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return failure("Invalid sign-in response. Return to /login and try again.", 400);
  }

  // Google's double-submit cookie protects against login CSRF.
  const cookieToken = request.cookies.get("g_csrf_token")?.value;
  const bodyToken = form.get("g_csrf_token");
  if (!cookieToken || typeof bodyToken !== "string" || cookieToken !== bodyToken) {
    return failure("Sign-in verification failed. Return to /login and try again.", 403);
  }
  const credential = form.get("credential");
  if (typeof credential !== "string" || !credential) return failure("Missing Google credential.", 400);
  if (!getSupabaseConfig()) return failure("Sign-in is not configured yet.", 503);

  const supabase = await createClient();
  // Supabase verifies Google's signature, audience, issuer, and expiry.
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential });
  if (error) return failure("Unable to sign in. Return to /login and try again, or check the Google provider configuration.", 401);

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.delete("g_csrf_token");
  return response;
}

export async function GET() {
  return failure("This endpoint accepts Google sign-in responses. Start at /login.", 405);
}
