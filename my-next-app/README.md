# Coffee Collection

The app started as a Hello World page, then added a table displaying coffee records from Supabase. It now includes Google sign-in, a protected dashboard, and a homepage that changes based on whether the user is signed in.

The dashboard displays the coffee table's `id`, `created_at`, `roast`, and `bestif` columns. Signed-in users can view the table and sign out.

## Authentication flow

1. A signed-out visitor sees the homepage gate and follows the sign-in link.
2. The Google sign-in button starts authentication with Google.
3. Google POSTs the sign-in credential directly to `/auth/callback`, with no callback query parameters or additional application callback route.
4. The callback checks Google's CSRF token, then calls Supabase's `signInWithIdToken` to verify the credential and create a session.
5. `@supabase/ssr` saves the session in cookies, and the user is sent to `/dashboard`.
6. Before fetching or displaying coffee records, the dashboard verifies the user through Supabase. Visitors without a valid session are redirected to `/login`.
7. The proxy refreshes session cookies as needed. Signing out ends the current session and returns the user to the homepage gate.
