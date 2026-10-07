# LetsBeGoofy

Drop a photo, get a funny AI caption, and let the public feed react.
Signed-in users upload a photo, Google Gemini writes a caption in their sense of
humor, and the post goes to a public feed where other users vote on it.

## Stack

- Next.js (App Router, Server Actions) on Vercel
- Supabase Auth (Google OAuth), Postgres with RLS, and Storage
- Google Gemini via `@google/genai` (server-side only)
- `heic-to` for in-browser HEIC/HEIF conversion

## Features

- **Google sign-in.** Protected `/dashboard` and `/dashboard/profile`; the public
  `/feed` works signed out.
- **Create.** Upload a photo privately, then generate and publish a caption.
  One successful generation per user per America/New_York day, enforced by the
  database. The exact prompt sent to Gemini is stored with the generation.
- **Humor learning.** An optional humor preference (500 characters max) and
  private "That's so me" / "Not my humor" feedback on your own captions shape
  later prompts.
- **Public feed.** New and Hot sorting, pagination, a masonry layout, and
  up/down voting with public aggregate scores. Raw votes and prompts stay private.
- **Profile.** Name, avatar, and humor preference.
- **iPhone photos.** HEIC/HEIF is converted to JPEG on the device before preview
  or upload (see below).

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public client key |
| `GEMINI_API_KEY` | Server-only. Never prefix it with `NEXT_PUBLIC_` |

No Supabase service-role key is used.

Checks: `npm run lint`, `npx tsc --noEmit`, `node --test tests/*.test.mjs`,
`npm run build`.

## Supabase setup

Tables, RLS policies, grants, RPCs (`get_public_feed`,
`get_daily_generation_status`), triggers, and Storage buckets/policies are
**managed manually in the Supabase dashboard / SQL Editor**. The app never runs
migrations. Reference SQL is in `supabase/`, and the full database and security
model is in `CODEX_HANDOFF.md`.

Google OAuth:

- Enable the Google provider in Supabase and add its client ID and secret there.
- In Google Cloud, authorize the Supabase callback
  (`https://<project-ref>.supabase.co/auth/v1/callback`).
- In Supabase Auth → URL Configuration, set the Site URL and allow
  `<origin>/auth/callback` for each origin (`http://localhost:3000` locally plus
  the production domain).

## iPhone photo uploads

Generation photos and avatars share `lib/image-upload.ts`. HEIC/HEIF becomes a
full-resolution JPEG (quality 0.9) with orientation baked in and source metadata
(including GPS) dropped. JPEG, PNG, and WebP pass through unchanged. Pending or
failed conversion blocks upload.

Size limits apply to the prepared file:

- **Generation photos: 5 MiB.** These upload directly from the browser to Storage.
- **Avatars: 4 MiB.** These go through a Server Action, and Vercel rejects
  request bodies above ~4.5 MB. The limit is enforced in the picker and again
  on the server.

Oversized files get a clear message; nothing is silently downscaled. Automated
tests mock the decoder. The real-device checklist is in `CODEX_HANDOFF.md`.
