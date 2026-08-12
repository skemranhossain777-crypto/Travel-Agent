# Travel Agent

A production-ready multi-tool travel assistant built with the
[Google Agent Development Kit (ADK)](https://adk.dev/).

The agent answers travel questions: live currency exchange rates, real-time
logistics (weather, business hours, current events), and historical/cultural
information about destinations and landmarks.

## Architecture

```
┌────────────────────────────┐
│        root_agent          │  gemini-flash-latest
│  (LlmAgent, orchestrator)  │
│                           │
│  tools:                   │
│   • get_fx_rate (FunctionTool)        ── live FX from HexaRate
│   • google_search_agent (AgentTool)   ── sub-agent (gemini-2.5-flash)
│   • Wikipedia (LangchainTool)         ── history & culture
│   • travel-agent-skill (SkillToolset) ── routing instructions
└────────────────────────────┘
```

| Component | File | Purpose |
|-----------|------|---------|
| Root agent | `agent.py` | Orchestrates routing between tools |
| Search sub-agent | `custom_agents.py` | Real-time info via Google Search |
| FX function | `custom_functions.py` | `get_fx_rate(base, target)` via HexaRate |
| Wikipedia tool | `third_party_tools.py` | LangChain Wikipedia wrapper |
| Skill | `skills/travel-agent-skill/SKILL.md` | Domain instructions for routing |

## Quick start

### 1. Prerequisites

- Python 3.10+ (tested on 3.14)
- A [Gemini API key](https://aistudio.google.com/app/apikey)

### 2. Install

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

pip install -r requirements.txt
```

### 3. Configure the API key

```bash
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
```

Edit `.env` and set `GOOGLE_API_KEY` to your real key.

### 4. Run the web UI

```bash
adk web .
```

Open http://127.0.0.1:8000 and chat with the agent.

### 5. Run headless / in code

```python
import asyncio
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from travel_agent import agent

async def main():
    ss = InMemorySessionService()
    await ss.create_session(app_name="t", user_id="u", session_id="s")
    runner = Runner(agent=agent.root_agent, app_name="t", session_service=ss)
    async for event in runner.run_async(
        user_id="u", session_id="s",
        new_message=types.Content(role="user", parts=[types.Part(text="How much is 100 SGD in JPY?")]),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    print(part.text)

asyncio.run(main())
```

## What the agent can do

| Ask about | Tool used | Example |
|-----------|-----------|---------|
| Currency exchange | `get_fx_rate` | "How much is 100 SGD in JPY?" |
| Weather / news / hours | `google_search_agent` | "What's the weather in Tokyo today?" |
| History / landmarks | Wikipedia | "Tell me about Angkor Wat." |
| Full itinerary | all tools | "Plan a 3-day trip to Kyoto." |

## Troubleshooting

### 429 RESOURCE_EXHAUSTED

This means the Gemini API quota for your key is exhausted. Mitigations:

1. **Retries are already enabled** on both agents (5 attempts, exponential
   backoff, jitter, targeting HTTP 429/500/503). Quota may be temporarily
   exhausted — just retry.
2. **Switch models** — rate limits are **per model**. This project uses
   `gemini-flash-latest` (root) and `gemini-2.5-flash` (search). Edit
   `agent.py` / `custom_agents.py` to use a different model.
3. **Use a second API key** — each Gemini API key has its own quota bucket.
   Put a second key in `GOOGLE_API_KEY_ALT` and rotate between keys if needed.
4. **Request a higher quota** in
   [Google AI Studio](https://aistudio.google.com/) or upgrade your plan.

See the official [ADK 429 guide](https://google.github.io/adk-docs/agents/models/google-gemini/#error-code-429-resource_exhausted).

### Common import errors

- `No module named 'langchain_core'` → install `requirements.txt` (the agent
  imports LangChain via `third_party_tools.py`).
- `No API key provided` → set `GOOGLE_API_KEY` in `.env`.

## Project structure

```
travel_agent/
├── agent.py                  # Root agent definition (entrypoint)
├── custom_agents.py          # google_search_agent sub-agent
├── custom_functions.py       # get_fx_rate function tool
├── third_party_tools.py      # Wikipedia LangChain tool
├── skills/
│   └── travel-agent-skill/
│       └── SKILL.md          # ADK skill (loadable)
├── travel-agent-skill.md     # Skill source / documentation
├── __init__.py
├── requirements.txt          # Pinned dependencies
├── .env.example              # Environment template
├── .env                      # Your secrets (git-ignored)
├── .gitignore
└── README.md
```

## Contributing

See `CLAUDE.md` / `AGENTS.md` for coding-agent instructions, and the
[ADK Python docs](https://google.github.io/adk-docs/) for API details.
