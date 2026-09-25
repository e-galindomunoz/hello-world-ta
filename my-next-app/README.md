# Hello world — Supabase table

The homepage reads a Supabase table using only the project URL and anon key. It displays up to 100 rows, with columns taken from the returned records. No sign-in is required. The auth routes remain available for the later assignment.

## Database setup (current assignment)

Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_TABLE` (a table in the public schema). Run `npm run dev`. Google configuration is optional for this step.

The homepage always queries as anon, even if the browser has an existing login session. Existing database permissions determine which rows are visible. An empty result can mean either no data or no rows visible to anon. No RLS policies are modified, enabled, or disabled.

The remaining instructions cover the later authentication assignment. `/dashboard` verifies the user on the server and redirects unauthenticated visitors to `/login`.

## Local setup

1. In Google Cloud, create/select your own project. Configure Google Auth Platform branding and audience; add your Google account as a test user if using Testing mode.
2. Create an OAuth client with application type **Web application**:
   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `http://localhost:3000/auth/callback`
   - Use the exact URI, with no trailing slash or query parameters.
3. In Supabase, enable the Google provider under Authentication → Sign In / Providers. Enter that Google client ID. This app uses ID-token sign-in, so no Google client secret is used. Leave nonce-check skipping and unverified-email sign-in disabled. If the dashboard requires a secret to save, check the provider configuration rather than adding a secret to the app.
4. Set Supabase Authentication → URL Configuration → Site URL to `http://localhost:3000`; add `http://localhost:3000/auth/callback` to Redirect URLs.
5. Copy `.env.example` to `.env.local`. Fill in your Supabase project URL, publishable key (a legacy anon key also works), and Google client ID. Do not use a Supabase secret/service-role key.
6. Run `npm install`, then `npm run dev`. Restart the dev server after changing environment variables.

For deployment, add the deployed HTTPS origin and exact `https://YOUR-DOMAIN/auth/callback` URI to Google and Supabase, and configure the same three environment variables before building.

## Sign-in flow

Google Identity Services renders the Google button in redirect mode. Google POSTs the credential and CSRF token directly to `/auth/callback`; there are no callback query parameters. The handler checks Google's double-submit CSRF cookie and calls `supabase.auth.signInWithIdToken`. Supabase verifies the Google token and issues the session cookies. Only after successful authentication does the handler send the user to `/dashboard`.

The proxy refreshes sessions; the dashboard independently calls `getUser()` before rendering protected content. Sign-out is a POST Server Action that ends the current session. No tables, SQL, or RLS policies are created or changed. Route protection does not replace database RLS when data access is added later.

## Verification

Run `npm run lint` and `npm run build`.

With real configuration:

- In a private browser window, visit `/dashboard` directly: it must redirect to `/login` without showing member content.
- Sign in with Google. Verify that Google's redirect URI is exactly your origin plus `/auth/callback`, and its credential arrives in a POST body.
- Confirm the dashboard displays your email. The homepage continues to display the public database table.
- Refresh the dashboard to confirm the cookie session persists.
- Sign out, then revisit `/dashboard`: access must be denied again.
- A callback POST with missing or mismatched CSRF tokens must return 403. A credential rejected by Supabase must never grant dashboard access.

References: [Google redirect handling](https://developers.google.com/identity/gsi/web/guides/handle-credential-responses-js-functions), [Google CSRF verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Supabase ID-token API](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
