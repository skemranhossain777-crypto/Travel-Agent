# Travel Agent — Web UI

A Next.js 16 chat frontend for the travel agent. It runs its own copy of the
agent in a Node.js API route using `@google/adk` (JS), with the same three
capabilities as the Python agent at the repo root:

- **Currency** — `get_fx_rate` tool (live rates via HexaRate).
- **Real-time logistics** — `google_search` tool (weather, news, business hours).
- **History & culture** — `get_wikipedia_summary` tool (Wikipedia REST API).

The travel skill at `./skills/travel-agent-skill` is loaded for routing rules.
It is a vendored copy of the root `skills/travel-agent-skill`, kept so the app
is self-contained when deployed (e.g. on Vercel the root files are not
uploaded). Keep the copies in sync.

## Getting started

```bash
cd web
npm install

# Configure your Gemini API key (copy the root .env's GOOGLE_API_KEY).
cp .env.local.example .env.local
# edit .env.local and set GOOGLE_API_KEY=...

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and chat with the agent.

## How it works

- `src/app/page.tsx` — client chat UI. Streams assistant output from `/api/chat`
  over SSE and shows which tool is being used.
- `src/app/api/chat/route.ts` — POST endpoint that runs the ADK agent and
  streams back `text` / `tool` / `done` / `error` SSE events.
- `src/lib/agent.ts` — agent definition: `Agent` with `get_fx_rate`,
  `google_search`, `get_wikipedia_summary`, and the travel skill. Also owns the
  `Runner` + `InMemorySessionService` singleton (conversations persist for the
  lifetime of the dev server process; the browser sends a per-user `sessionId`).

## Env vars

| Variable          | Purpose                                             | Required |
|-------------------|-----------------------------------------------------|----------|
| `GOOGLE_API_KEY`  | Gemini API key (falls back to `GEMINI_API_KEY`).    | yes      |
| `TRAVEL_SKILL_DIR`| Directory of the travel skill. Defaults to `./skills/travel-agent-skill`. | no |

## Scripts

```bash
npm run dev     # dev server on http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```
