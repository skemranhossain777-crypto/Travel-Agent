# AGENTS.md

Guidance for AI coding agents working in this repository. This file complements
`CLAUDE.md`; if the two disagree, `CLAUDE.md` wins.

## Project at a glance

- **Stack:** Google ADK (Python) — see `agent.py` for `root_agent`.
- **Tools:** `get_fx_rate` (currency, `custom_functions.py`), Google Search
  sub-agent (`custom_agents.py`), Wikipedia LangChain tool
  (`third_party_tools.py`), and a travel skill
  (`skills/travel-agent-skill/SKILL.md`).
- **Models:** root `gemini-flash-latest`; search `gemini-2.5-flash`.

## Golden rules

1. **Never commit secrets.** `.env` holds real API keys and is git-ignored.
   Use `.env.example` as the template for anything env-related.
2. **Keep `attempts` in `generate_content_config` retry options >= 5.** It is
   the safety net for Gemini 429 quota errors.
3. **Keep the skill files in sync.** `skills/travel-agent-skill/SKILL.md` is
   what the agent actually loads; `travel-agent-skill.md` at the root is the
   doc mirror. Update both or neither.
4. **Don't write pytest that asserts on LLM text output** — it is
   non-deterministic. Verify with a headless smoke run instead.
5. **Restart `adk web` after any code/skill change** and clear `__pycache__/`
   if behavior looks stale.

## Typical tasks

- *Add a tool:* define it in a module, wrap in `FunctionTool`, add to
  `root_agent.tools`, update routing in the skill files.
- *Change a model:* edit `agent.py` / `custom_agents.py`. Prefer a model in a
  different quota bucket when fighting 429s.
- *Diagnose 429:* check `.env` key, try another Gemini key, or switch models —
  don't gut the retry config.
