# LetsBeGoofy — Codex Handoff

## Current status

Phase 1 — Foundation / Supabase / RLS ✅
Phase 2 — Private image upload ✅
Phase 3 — Gemini caption generation ✅
Phase 4 — Public feed implemented; not deployed
Phase 5 — Own-vote controls implemented and live-verified
Phase 6 — Public aggregate scores and New/Hot UI implemented
Phase 7 — Humor preference and daily-generation application flow implemented

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
Public aggregate scores are available through get_public_feed once its SQL is applied manually. Raw votes remain private.

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
- The least-privilege mutation fix passed live verification; temporary diagnostics
  were removed. Production error handling remains intact.
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


## Phase 6 public scores and sorting

Apply the reviewed supabase/public-feed.sql manually before using this phase.
The application does not execute SQL setup or change existing grants/RLS.
The SQL file uses CREATE FUNCTION for initial installation; do not rerun it if
this same RPC has already been installed. Live installation is not verified here.

- The public anonymous client calls public.get_public_feed with p_sort, p_limit,
  and p_offset, explicitly selecting id, caption, created_at, score only.
- /feed defaults to New. Explicit modes are /feed?sort=new and /feed?sort=hot.
- New orders by created_at DESC, id DESC. Hot orders by score minus age in days,
  with age floored at zero, then created_at DESC, id DESC. SQL orders before paging.
- Switching mode resets to page 1. Previous/Next and retry links retain the mode.
- Pages show 12 posts; the RPC returns up to 13 to detect another page.
- Score is SUM(value), or zero for an unvoted post. No vote-count breakdown.
- Own-vote loading stays separate, authenticated, batched, and filtered by owner.
- Confirmed-state mutation behavior is unchanged. Existing revalidatePath('/feed')
  refreshes aggregate scores and can move posts in Hot order after a vote.
- RPC failures display a feed error, never fabricated zero scores. Sorting stays
  available in query-error and empty states. Offset pages may shift as data changes.

Security: the read-only SECURITY DEFINER RPC deliberately reads all votes under
its trusted postgres owner, with an empty search_path and fully qualified tables.
Only its fixed aggregate output is public. It returns no voter IDs, individual
votes, prompt, or creator data. Existing votes RLS and UPDATE(value)-only grants
remain unchanged. There are no privileged application credentials.

The RPC assumes every generation is publicly visible. It bypasses generation
RLS as its owner, so revise its publication predicate before adding drafts,
private generations, or moderation. Public score changes can reveal voting
activity by inference, particularly on low-activity posts.

No automated database changes or deployment were performed. Verify live RPC
permissions/results, raw-vote privacy, score refresh, and New/Hot behavior after
manual SQL installation. Earlier Phase 4/5 sections describe those phases;
Phase 6 replaces the direct public generation query and adds Hot sorting.


## Phase 7 humor preference and daily allowance

The user applied the reviewed migration manually in Supabase before this code.
No application-side migration or database changes are performed.

- profiles.humor_preference is optional nullable text, limited to 500 characters.
  The existing own-profile form trims it and saves blank as NULL. It participates
  in Save/Discard/dirty state but does not affect profile completeness.
- The generation action loads the saved preference through the authenticated
  client, never from a client override. A profile-read failure stops generation.
- Blank preferences use the original CAPTION_PROMPT verbatim. Otherwise the
  approved personalized prompt includes JSON.stringify(trimmedPreference) as
  untrusted style inspiration. The string is built once, passed to Gemini, and
  saved unchanged in generations.prompt. Preferences/prompts are never logged.
- The dashboard loads get_daily_generation_status() server-side. The generation
  action independently authenticates and rechecks that RPC before downloading
  the image or contacting Gemini. Unknown status blocks generation, not uploads.
- The private generation_daily_usage table and transactional AFTER INSERT trigger
  enforce one committed generation per user per America/New_York calendar day.
  No application code writes usage rows. Failed Gemini requests or rolled-back
  saves do not consume usage; deleting a generation does not restore usage.
- The trigger's P0001 / daily_generation_limit_reached response is recognized
  separately from other save failures, including simultaneous submissions.
- Database generation_day/resets_at are authoritative. The UI formats resets_at
  in America/New_York using the named timezone (DST-aware), never computes a day
  or reset from the browser clock. Check availability refreshes without dropping
  the selected/uploaded image and is available after the next midnight.
- After a successful save, availability is read again. If that read fails, the
  saved caption is still shown, but availability remains unknown until checked.
  Lost/ambiguous save responses also require a fresh availability check.
- Concurrent requests may both reach Gemini, but only one save per day commits.
- Feed, New/Hot, voting, publication/signing, RLS, and Gemini model remain unchanged.
  No feedback learning, visual redesign, or deployment is included.

Validation must distinguish mocked application checks from live database/provider
verification. Exercise available/used/unknown states, Gemini failures, save races,
profile normalization, and New York midnight/DST reset display before release.
