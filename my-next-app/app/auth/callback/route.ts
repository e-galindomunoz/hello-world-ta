import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

function failure(message: string, status: number) {
  return new Response(message, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("error")) {
    return failure("Google sign-in was not completed. Return to /login and try again.", 400);
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return failure("Missing sign-in code. Return to /login and try again.", 400);
  if (!getSupabaseConfig()) return failure("Sign-in is not configured yet.", 503);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure("Unable to sign in. Return to /login and try again, or check the Google provider configuration.", 401);
  } catch {
    return failure("Unable to connect to sign-in. Return to /login and try again.", 503);
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
