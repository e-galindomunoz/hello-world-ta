# LetsBeGoofy — Codex Handoff

## Current status

Phase 1 — Foundation / Supabase / RLS ✅
Phase 2 — Private image upload ✅
Phase 3 — Gemini caption generation ✅
Phase 4 — Public feed implemented; not deployed
Phase 5 — Own-vote controls implemented; not deployed

## Stack

- Next.js App Router
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Google Gemini via @google/genai
- Vercel deployment later

## Existing database

### profiles
Existing profile system tied to auth.users.

RLS:
- authenticated user can SELECT own profile
- authenticated user can UPDATE own profile

### generations
- id uuid
- user_id uuid
- image_path text
- prompt text
- caption text
- created_at timestamptz

RLS / privileges:
- anon + authenticated can SELECT:
    - id
    - user_id
    - image_path
    - caption
    - created_at
- prompt is NOT publicly readable
- authenticated users can INSERT only their own generations
- no UPDATE / DELETE yet

### votes
- generation_id
- user_id
- value (-1 or 1)
- primary key (generation_id, user_id)

Raw votes are private.
Public aggregate vote scores will be implemented later.

## Storage

Private bucket:

generation-images

Path format:

<authenticated-user-id>/<uuid>.<extension>

Allowed:
- JPEG
- PNG
- WebP
- max 5 MiB

Storage policies allow authenticated users to:
- INSERT own-folder images
- SELECT own-folder images
- DELETE own-folder images

Unpublished images remain owner-only. The live database was verified by the user:
- generations RLS is enabled
- generations_select_public allows anon/authenticated SELECT
- generations_insert_own enforces user_id = auth.uid()
- owner-only Storage INSERT/SELECT/DELETE policies remain in place
- generation_images_select_published was applied manually before Phase 4

The published SELECT policy permits anon/authenticated reads only when a readable
generation references the exact object path and its user_id matches the owner
folder. The bucket remains private. Phase 4 makes no database or policy changes.

## Phase 2

Working upload flow:

choose image
→ validate
→ local preview
→ authenticate
→ upload privately
→ retain image_path

Mobile-friendly.

## Phase 3

Working:

uploaded private image
→ Server Action
→ authenticate user
→ validate image_path belongs to user
→ download private image
→ Gemini
→ generate caption
→ save generations row

Gemini key:

GEMINI_API_KEY

Never expose client-side.

Current Gemini model:

gemini-3.5-flash-lite

Prompt:

"Write one short funny social-media caption for this image. Keep it concise, playful, and meme-friendly. Return only the caption."

Phase 3 tested successfully with a real image and generation row.

## Phase 4 architecture

Public /feed uses a session-free anonymous/publishable Supabase client.
No privileged Supabase credential or client is used.

- Explicit feed selection: id, caption, created_at (never prompt).
- Newest first: created_at descending, then id descending as a tie-breaker.
- Numbered pagination: 12 posts, with one extra row to detect the next page.
  Offset pagination can shift when new posts arrive between page requests.
- Mobile-first single column, UTC timestamps, loading/empty/query-error states.
- Independent image failure and retry controls.
- Landing and dashboard navigation link to the feed.
- Creation UI explains that successfully saving a generation publishes the post.
- No creator names or Hot sorting. Voting is described in Phase 5 below.

GET /feed/images/<generation-id>:
1. Validate generation UUID; no arbitrary image path input is accepted.
2. Read id, user_id, image_path under anonymous generations SELECT RLS.
3. Validate stored image_path as <generation.user_id>/<UUIDv4>.<jpg|png|webp>.
4. Ask Storage to create a 60-second signed URL using the same public client.
   Storage SELECT RLS independently enforces the publication/ownership match.
5. Return a temporary redirect with Cache-Control: no-store.

The image component requests the ID route lazily, instead of embedding expiring
signed URLs in the feed response. Retrying requests a new signed URL.

Public clients can also read/sign eligible objects directly through Supabase;
the route's 60-second lifetime is not a global signing limit. Issued signed URLs
may remain usable until expiration even if publication is later removed.

Environment: existing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
(or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) are sufficient for the feed.
GEMINI_API_KEY remains server-only for creation.

Before release: run live anonymous/owner/other-user access checks and browser
checks for pagination, image retries, and narrow screens. Do not infer live
integration verification from lint/type checks. No deployment performed.

## Phase 5 voting

- Server Action setVote accepts only generationId and desiredValue (1, -1, null).
- Auth is verified per call; user_id comes exclusively from the session.
- A separate anonymous generation lookup verifies public visibility.
- Mutations preserve UPDATE(value)-only privileges: read the user's existing vote,
  insert if absent, otherwise update only value. An INSERT duplicate-key error
  (23505) gets exactly one value-only UPDATE retry. No upsert is used.
- Lookups, updates, and deletes filter by both generation_id and session-derived
  user_id. The existing composite primary key still enforces one vote per user/post.
- Temporary server diagnostics remain for live verification; remove after the
  least-privilege fix is verified. Supabase error logs contain only operation,
  code, and message, never full error objects or session/vote data.
- Feed queries remain public and unchanged. Authenticated viewers' own votes
  are loaded in one batched server query selecting generation_id, value only.
- Anonymous viewers never query votes. Controls prompt them to sign in at /login;
  the existing OAuth flow returns to /dashboard and never auto-submits a vote.
- Selection changes only after confirmation. Per-post pending/ref guards prevent
  duplicate submissions. Clicking a selected vote removes it; the other switches it.
- Vote-load errors remain unknown, not "no vote". Interrupted/failed mutations
  require a reload to reconcile state before another vote; post content stays visible.
- Existing own-row RLS remains authoritative. No schema/RLS changes, privileged
  credentials, aggregate counts, Hot sorting, or creator identities were added.
- Concurrent choices from separate tabs use last-write-wins behavior. Phase 6
  must provide a separately reviewed aggregate interface without exposing raw votes.
- Live grants, foreign keys, cross-user denial, and browser interaction should be
  verified before release; mocked checks do not certify the deployed database.
