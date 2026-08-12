# CLAUDE.md

This file gives coding agents working in this repository the guidance needed to
edit, run, and debug the Travel Agent project.

## Overview

- **Framework:** Google ADK (Agent Development Kit), Python SDK.
- **Purpose:** A travel assistant that answers currency, logistics, and
  cultural/historical travel questions.
- **Entry point:** `agent.py` exposes `root_agent`.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run the local web UI
adk web .

# Run the agent headless (see README "Run headless / in code")
python scripts/run_headless.py   # if present
```

## Code conventions

- Keep the agent definition in `agent.py`; import tools from the sibling modules.
- Never import heavy modules at module scope unless needed (keeps `adk web` fast).
- Preserve the existing `generate_content_config` retry settings — they handle
  Gemini 429 quota errors. Do not lower `attempts`.
- Secrets live only in `.env` (git-ignored). Never commit real API keys.

## Model configuration

- Root agent: `gemini-flash-latest` (see `agent.py`).
- Search sub-agent: `gemini-2.5-flash` (see `custom_agents.py`).
- Gemini API rate limits are **per model**. If 429 errors persist, switch a model
  to one with a separate quota bucket rather than editing retry logic.

## How to add a new tool

1. Add the function in a module (e.g., a new `my_tools.py`).
2. Wrap it: `FunctionTool(my_func)` and add to `root_agent.tools` in `agent.py`.
3. If the skill's routing rules should mention the new tool, update
   `skills/travel-agent-skill/SKILL.md` **and** the root `travel-agent-skill.md`.

## How to update the skill

1. Edit `skills/travel-agent-skill/SKILL.md` (this is what the agent loads).
2. Mirror the change to the root `travel-agent-skill.md` so the docs stay in sync.
3. Restart `adk web` — skills are loaded at startup, not hot-reloaded.

## Testing / verification

- Smoke-test with a quick headless run (see README snippet) — do not write
  pytest that asserts on LLM text output (LLM output is non-deterministic).
- Verify import with: `python -c "from travel_agent import agent; print(agent.root_agent.name)"`.

## Gotchas

- `InMemorySessionService.create_session` and `Runner.run_async` are **async** in
  current ADK — always `await`/`async for` them.
- `Runner.run()` (sync) no longer accepts `message=`; use `new_message=` with a
  `types.Content` object.
- If `adk web` shows the old code, delete `__pycache__/` and restart the server.
- Port conflicts: stop any process on the port before restarting
  (`Stop-Process` on the PID owning the port).
