# LetsBeGoofy — Codex Handoff

## Current status

Phase 1 — Foundation / Supabase / RLS ✅
Phase 2 — Private image upload ✅
Phase 3 — Gemini caption generation ✅
Phase 4 — Public feed PLANNED, not implemented

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

No anonymous access.

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

## Phase 4 planned architecture

Goal: public /feed.

Problem:
generation-images bucket is private, so anonymous users cannot directly access post images.

Recommended solution:

GET /feed/images/<generation-id>

Flow:
1. Validate generation UUID.
2. Look up publicly readable generation.
3. Validate stored image_path:
   <generation.user_id>/<UUID>.<jpg|png|webp>
4. Server-only privileged Supabase Storage client creates ~60 second signed URL.
5. Route redirects browser to signed URL.

Use SUPABASE_SERVICE_ROLE_KEY ONLY in a server-only image-signing helper.
Do not expose it to browser.
All other app operations continue using normal authenticated/public Supabase clients.

Proposed Phase 4 files:

- app/feed/page.tsx
- app/feed/loading.tsx
- app/feed/error.tsx
- app/feed/feed.module.css
- components/feed-post-image.tsx
- app/feed/images/[id]/route.ts
- lib/supabase/public.ts
- lib/supabase/feed-images.ts
- components/landing.tsx
- components/app-shell.tsx
- components/generation-image-upload.tsx
- .env.example

Feed requirements:
- public without authentication
- newest first
- image
- caption
- created timestamp
- no creator name yet
- no voting yet
- no Hot sorting yet
- no prompt exposure
- mobile-first single-column layout
- pagination rather than infinite scrolling initially

Next step:
Approve Phase 4 using isolated SUPABASE_SERVICE_ROLE_KEY for image signing and implement the public feed.