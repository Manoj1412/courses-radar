# Syllabus Radar (CourseRadar)

## Quick Start (Windows/Node.js)

**No Bun/DB/API keys except YouTube.**

1. **Install deps** (npm running or): `npm install`
2. **YouTube API Key** (free, required for search):
   - [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
   - Enable YouTube Data API v3 → Credentials → API Key
3. **Env**: Create `.env`:
   ```
   YOUTUBE_API_KEY=your_key_here
   ```
4. **Run**: `npm run dev` (localhost:8080)

**Test**: Search \"Java full course\", upload syllabus.

## Features
- YouTube course search/ranking (likes/views/sentiment/syllabus match)
- Filters, sorting, bookmark/compare
- Responsive, SSR-ready (Cloudflare)

## New Features to Add
1. AI syllabus matching (embeddings)
2. User auth/history (Supabase)
3. Playlists/learning paths
4. Transcripts/comments

## Tech
- React/TanStack (Router/Query/Start)
- shadcn/ui, Tailwind, Vite
- YouTube API v3

`npm run lint` `npm run build` `npm run preview`
