# Coffee Collection

The app started as a Hello World page, then added a table displaying coffee records from Supabase. It now includes Google sign-in, a protected dashboard, and a homepage that changes based on whether the user is signed in.

The dashboard displays the coffee table's `id`, `created_at`, `roast`, and `bestif` columns. Signed-in users can view the table and sign out.

## Authentication flow

1. A signed-out visitor sees the homepage gate and follows the sign-in link.
2. The Google sign-in button calls Supabase `signInWithOAuth` with the Google provider and the current origin’s `/auth/callback` as `redirectTo`. The `@supabase/ssr` browser client uses PKCE and stores the verifier in cookies.
3. Supabase manages the Google OAuth flow and redirects back to `/auth/callback?code=…`.
4. The callback reads `code` and calls `exchangeCodeForSession(code)` using the existing `@supabase/ssr` server client. Failed or cancelled sign-ins display an error without redirecting to the dashboard.
5. `@supabase/ssr` saves the session in cookies, and the user is sent to `/dashboard`.
6. Before fetching or displaying coffee records, the dashboard verifies the user through Supabase. Visitors without a valid session are redirected to `/login`.
7. The proxy refreshes session cookies as needed. Signing out ends the current session and returns the user to the homepage gate.

## Google OAuth configuration

- Enable Google in Supabase Authentication providers and configure the Google client ID and secret there.
- In Google Cloud, authorize the Supabase provider callback URL shown in the Supabase dashboard (typically `https://<project-ref>.supabase.co/auth/v1/callback`).
- In Supabase Authentication URL Configuration, allow each application callback URL, including `http://localhost:3000/auth/callback` for local development and your deployed origin followed by `/auth/callback`.
- The frontend only needs the Supabase URL and public key from `.env.example`.

See [Supabase’s Google OAuth guide](https://supabase.com/docs/guides/auth/social-login/auth-google).
