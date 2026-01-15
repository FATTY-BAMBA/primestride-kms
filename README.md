# PrimeStrideAI KMS v1

A learning-enabled Knowledge Management System with feedback-driven weekly improvements.

## What This Does

- **Document Library**: Lists your knowledge docs with feedback counts
- **Document Viewer**: Opens Google Docs + captures user feedback
- **Event Logging**: Tracks opens, reopens, and feedback in Supabase
- **Learning Summary**: Aggregates feedback for weekly improvement cycles

## Quick Start Guide

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Enter a project name (e.g., "primestride-kms")
4. Set a database password (save this!)
5. Choose a region close to you
6. Click "Create new project" and wait ~2 minutes

### Step 2: Set Up Database Tables

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy the entire contents of `supabase/01_schema.sql` and paste it
4. Click "Run" (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

### Step 3: Add Your Documents

1. Create a new query in SQL Editor
2. Copy the contents of `supabase/02_seed_data.sql`
3. **IMPORTANT**: Replace `PASTE_GOOGLE_DOC_URL_HERE` with your actual Google Doc URLs
   - Your Google Docs must be shared with "Anyone with the link can view"
4. Click "Run"

### Step 4: Get Your API Keys

1. In Supabase, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (the long string under "Project API keys")

### Step 5: Configure Environment Variables

1. Rename `.env.local.example` to `.env.local`
2. Replace the placeholder values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 6: Install Dependencies & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Testing Your Setup

1. **Library Page** (`/`): Should show your 3 documents with 0 feedback counts
2. **Click a document**: Opens the detail page
3. **Click "Open Google Doc"**: Opens your doc in a new tab
4. **Submit feedback**: Click any feedback button
5. **Return to Library**: Feedback counts should update

## Project Structure

```
primestride-kms/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Document Library (home)
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Global styles
│   │   ├── docs/
│   │   │   └── [docId]/
│   │   │       └── page.tsx      # Document Viewer + Feedback
│   │   └── api/
│   │       ├── events/
│   │       │   └── route.ts      # POST /api/events
│   │       └── learning-summary/
│   │           └── route.ts      # GET /api/learning-summary
│   └── lib/
│       └── supabaseClient.ts     # Supabase client
├── supabase/
│   ├── 01_schema.sql             # Database tables
│   └── 02_seed_data.sql          # Seed documents
├── package.json
├── tsconfig.json
├── next.config.js
└── .env.local.example
```

## API Reference

### POST /api/events
Log user interactions (opens, feedback).

**Request Body:**
```json
{
  "user_email": "optional@email.com",
  "doc_id": "PS-DIAG-001",
  "version": "v1.1",
  "event_type": "open" | "feedback" | "reopen",
  "value": "helped" | "not_confident" | "didnt_help",
  "notes": "Optional feedback notes"
}
```

### GET /api/learning-summary
Get all documents with aggregated feedback counts.

**Response:**
```json
{
  "documents": [
    {
      "doc_id": "PS-DIAG-001",
      "title": "Diagnostic → Problem Framing",
      "current_version": "v1.1",
      "status": "learning-enabled",
      "google_doc_url": "https://docs.google.com/...",
      "feedback_counts": {
        "helped": 5,
        "not_confident": 2,
        "didnt_help": 0
      }
    }
  ]
}
```

## What's Next (v1.1+)

After this works, you can add:

- [ ] **Search**: Keyword search over doc titles
- [ ] **Admin UI**: Publish new versions (bump v1.1 → v1.2)
- [ ] **Learning Dashboard**: Weekly rollup visualization
- [ ] **Doc Embedding**: Embed Google Docs inline (optional)
- [ ] **Vector Search**: Semantic search with embeddings

## Troubleshooting

### "Error: Failed to load"
- Check your `.env.local` has correct Supabase URL and key
- Make sure you ran the schema SQL in Supabase

### Documents not showing
- Verify you ran `02_seed_data.sql` in Supabase
- Check the `documents` table in Supabase Table Editor

### Feedback not saving
- Check browser console for errors
- Verify the `events` table exists in Supabase

### Google Doc won't open
- Make sure your Google Doc URLs are correct
- Docs must be shared with "Anyone with the link can view"

## License

Internal use only - PrimeStrideAI
