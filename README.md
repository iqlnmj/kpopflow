# K-Shorts Studio · Phase 1

Private, single-creator production workspace for K-Pop YouTube Shorts. Indonesian UI; Indonesian drafts and American English narration. Every creative approval is explicit. This repository implements **Phase 1 only**; it never publishes videos to YouTube.

## Requirements

- Node.js **24 LTS**, npm (use the committed lockfile).
- PostgreSQL 16+ (Docker Compose provided).
- `ffmpeg` and `ffprobe` on PATH, with H.264/AAC decoding.
- Chromium for browser tests. Ubuntu: install Chromium with your system package manager, or install Playwright Chromium and set `CHROMIUM_PATH` to its executable.
- OpenAI API access only for live AI. DEMO works without a key.

## Local/private setup

```bash
npm ci
npm run env:init
# Open .env locally and read APP_PASSWORD for login. Do not share or commit it.
docker compose up -d --wait db
npm run db:migrate
npm run db:seed          # optional: 3 clearly labeled DEMO project topics, no original videos
npm run dev
```

In a second terminal, in the **same repository directory**:

```bash
npm run worker
```

Open the application on port 3000 in your local/private environment and enter `APP_PASSWORD`. Web and worker must use the same environment variables, database, and storage directory. The worker is mandatory for video reviews/comparisons. For a production build, use `npm run build` then `npm start` instead of `npm run dev`. Keep access private; if using a reverse proxy, use HTTPS, preserve the Host header, configure `APP_ORIGIN=https://your-private-host`, and set a request body limit of 101 MB. Do not deploy publicly without a separate access and infrastructure review.

`env:init` preserves an existing `.env`; otherwise it generates random login and session secrets with private file permissions. The checked-in `.env.example` explains all options. If using an existing PostgreSQL instance, set `DATABASE_URL` instead of starting Compose. The Compose default password is **local-only**, with the database port bound to loopback. Use a strong separate database password and matching URL outside local development.

Prisma uses its JavaScript PostgreSQL adapter (no native query-engine download needed). `npm ci` generates the Prisma client without needing a running database. Migrations are checked in and applied explicitly; application startup never destructively resets data.

## AI configuration and honest demo behavior

Default generated configuration is `AI_MODE=demo`. Topic/script/timeline/review/comparison fixtures are labeled **DEMO**. Demo review score is displayed as a dash; the stored zero is only a placeholder. Demo revisions can be approved manually with an explicit warning. Seed topics are research leads, not verified claims; no original footage is included.

Even in demo mode, uploads, PostgreSQL persistence, approvals, FFprobe inspection, extracted frame images, byte-level SHA-256 comparison, revision history, and worker jobs are real.

For real generation, configure server-side:

```dotenv
AI_MODE=live
OPENAI_API_KEY=your-private-key
OPENAI_MODEL=gpt-4.1-mini
```

Restart **both web and worker**. The provider must support Chat Completions, vision inputs, and strict JSON schema outputs. Only `https://api.openai.com/v1/chat/completions` is used. Keys never reach the browser. Live AI failures surface as errors and are never silently replaced with demo results. Live requests incur provider costs and send selected project context and sampled frames to OpenAI; MP4 files themselves are not uploaded to the provider. Live AI requires your API key and has not been validated with a paid provider in this environment.

There is **no automated web research**. Store source URLs, publication/access dates, notes, and manual claim status in the project. `CONFIRMED` means confirmed by the creator, not independently verified by the app. AI is instructed to distinguish unverified facts and interpretation and to avoid invented sources.

## Working workflow

1. Create a project or generate topic suggestions; select a topic explicitly.
2. Add research URLs and notes.
3. Generate or manually write an Indonesian draft. Save edits as new versions.
4. Approve the latest Indonesian version.
5. Generate the English adaptation; edit, save, and approve the latest version.
6. Generate an editing plan from the approved English version.
7. Edit externally and upload a portrait MP4 (maximum 100 MB, 120 seconds, 3840px on either axis).
8. FFprobe validates the actual container, codecs, dimensions, frame rate, duration and audio presence. The worker extracts timestamped frames and creates a review.
9. Upload a revision, review it, then compare two reviewed revisions (A must precede B). See videos side by side and inspect the stored comparison.
10. Watch the final video and explicitly approve the chosen revision. Reopening is an explicit action; approval and artifact history remain.

Changing an Indonesian script removes current ID/EN approvals; changing English removes EN approval. Old scripts, timelines, reviews and comparisons remain accessible. Timeline and video review context IDs prevent approving a stale final artifact. An active job blocks final approval. Every project mutation has an audit record. No UI action automatically approves content.

The dashboard offers grid, list and Kanban views and search. Script and editing/video navigation open the relevant project workspace. All included buttons perform an action, navigate, or are disabled until prerequisites are met. Creator defaults are informational in Phase 1; advanced creator settings are deferred.

## Media jobs and limitations

The PostgreSQL durable queue has QUEUED → PROCESSING → COMPLETED/FAILED states, atomic `SKIP LOCKED` job claims, progress updates and heartbeat timestamps. A stale processing job is marked failed after three minutes; retry with Review/Compare. Failed jobs do not overwrite existing reports. Every completed report is separately archived, even when regenerating the latest view. Frames are deterministic reusable generated files; failed extraction may leave partial frames within that revision folder, overwritten on retry. Rejected uploads are removed immediately. Retained videos and frames are intentional revision assets, never automatically overwritten with a new video.

Sampling prioritizes 0–3 seconds, adds evenly distributed frames, and includes the ending. Reviews analyze **sampled images**, not continuous video, audio listening, OCR, transcription, loudness, peak levels or silence. The app reports audio presence/codec only. Comparison is an editorial comparison of sampled frames and metadata; it cannot establish every crop, subtitle or audio change. Findings are schema checked and timestamps must fit the actual video duration. Scores are subjective editorial judgments, not viral predictions.

Narration estimates use 150 words/minute. Timeline timing is a plan, not actual TTS alignment. Video and timeline durations may differ; compare the real FFprobe duration before final approval. Phase 2/3 features intentionally excluded: TTS, subtitle export, interactive timeline editing/alignment, analytics, cross-project insights, custom prompt settings, YouTube integration, automated trends/scraping, scheduling and advanced scene detection.

## Validation

Use a development/test database, never a shared production database. Tests create and remove only their own identified test projects.

```bash
npm run smoke             # web must be running; no secrets printed
npm run typecheck
npm test                  # unit contracts + PostgreSQL workflow integration
npm run build
# start web + worker as above first; default http://localhost:3000
npm run test:e2e           # system Chromium; override CHROMIUM_PATH / TEST_BASE_URL if needed
```

Browser E2E generates a synthetic portrait MP4 with FFmpeg (not real idol footage), then exercises project creation → ID generation/approval → EN generation/approval → timeline → upload → persisted review/frame extraction → revision upload → comparison → final approval. It also checks anonymous API denial, foreign-origin mutation denial and mobile dashboard overflow. Tests deliberately run AI fixtures and should be executed with both web and worker in DEMO mode. Browser failure artifacts can contain private project data or login form state; treat them as private and never commit them.

## Security baseline and operations

Single-user password authentication with signed 12-hour HttpOnly, SameSite=Strict cookies; secure cookie on HTTPS. APIs and every media read require a valid session. Password comparison uses fixed-length hashes and timing-safe equality. Mutations require a matching browser origin (or explicitly configured `APP_ORIGIN`). Login, generation and uploads have in-process throttles suitable for a single application instance, not distributed rate limiting. FFmpeg/FFprobe use argument arrays, timeouts, protocol restrictions and generated storage paths, never interpolated shell input. Media keys and byte ranges are validated. Upload extension, MIME, byte size, real container, duration, orientation and resolution are checked. Original file names are display-only. UI content is React-escaped.

Keep `.env`, `storage/`, database volumes and test artifacts private. Stop worker and web before backups. Back up **both PostgreSQL and `storage/`**, including older revisions:

```bash
docker compose exec -T db pg_dump -U kshorts kshorts > private-backup.sql
# Store the dump and a copy of storage/ in a protected location outside Git.
```

The Docker volume `postgres_data` persists across service restarts; `docker compose down -v` deletes it. Filesystem snapshots may not include Docker volumes on every platform: back up the database explicitly before migrating environments. No fresh-task cloud restoration or public deployment is claimed by current-instance validation.

See [ARCHITECTURE.md](ARCHITECTURE.md) for relationships, state transitions and module boundaries.
