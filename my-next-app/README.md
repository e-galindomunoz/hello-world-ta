# Hello world — Supabase table

The homepage shows a sign-in gate or signed-in controls. The protected `/dashboard` displays up to 100 rows from the coffee table after verifying the user's Supabase session on the server.

## Database setup

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_TABLE=coffee` in `.env.local`. For a fresh checkout, copy `.env.example` first. Complete the Google setup below before signing in.

The dashboard uses the public API key and the signed-in user's session for its query. This code does not change RLS or database permissions. With RLS disabled on the coffee table, the app's route is protected but the table remains readable directly through the Data API with the anon key. Database access controls are a separate assignment step.

## Local setup

1. In Google Cloud, create/select your own project. Configure Google Auth Platform branding and audience; add your Google account as a test user if using Testing mode.
2. Create an OAuth client with application type **Web application**:
   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `http://localhost:3000/auth/callback`
   - Use the exact URI, with no trailing slash or query parameters.
3. In Supabase, enable the Google provider under Authentication → Sign In / Providers. Enter that Google client ID. This app uses ID-token sign-in, so no Google client secret is used. Leave nonce-check skipping and unverified-email sign-in disabled. If the dashboard requires a secret to save, check the provider configuration rather than adding a secret to the app.
4. Set Supabase Authentication → URL Configuration → Site URL to `http://localhost:3000`; add `http://localhost:3000/auth/callback` to Redirect URLs.
5. Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com` to your existing `.env.local`, keeping your Supabase URL, anon key, and table name. Do not use a Supabase secret/service-role key.
6. Run `npm install`, then `npm run dev`. Restart the dev server after changing environment variables.

For deployment, add the deployed HTTPS origin and exact `https://YOUR-DOMAIN/auth/callback` URI to Google and Supabase, and configure the same environment variables before building.

## Sign-in flow

Google Identity Services renders the Google button in redirect mode. Google POSTs the credential and CSRF token directly to `/auth/callback`; there are no callback query parameters. The handler checks Google's double-submit CSRF cookie and calls `supabase.auth.signInWithIdToken`. Supabase verifies the Google token and issues the session cookies. Only after successful authentication does the handler send the user to `/dashboard`.

The proxy refreshes sessions; the dashboard independently calls `getUser()` before querying or rendering the coffee table. Sign-out is a POST Server Action that ends the current session. No tables, SQL, or RLS policies are created or changed.

## Verification

Run `npm run lint` and `npm run build`.

With real configuration:

- In a private browser window, visit `/dashboard` directly: it must redirect to `/login` without showing member content.
- Sign in with Google. Verify that Google's redirect URI is exactly your origin plus `/auth/callback`, and its credential arrives in a POST body.
- Confirm the dashboard displays your email and coffee rows. The homepage displays signed-in controls without fetching table data.
- Refresh the dashboard to confirm the cookie session persists.
- Sign out, then revisit `/dashboard`: access must be denied again.
- A callback POST with missing or mismatched CSRF tokens must return 403. A credential rejected by Supabase must never grant dashboard access.

References: [Google redirect handling](https://developers.google.com/identity/gsi/web/guides/handle-credential-responses-js-functions), [Google CSRF verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Supabase ID-token API](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
