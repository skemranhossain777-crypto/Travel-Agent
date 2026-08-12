import path from "node:path";
import { z } from "zod";
import {
  Agent,
  AgentTool,
  FunctionTool,
  Gemini,
  GOOGLE_SEARCH,
  InMemorySessionService,
  Runner,
  SkillToolset,
  loadSkillFromDir,
  type ToolUnion,
} from "@google/adk";

export const APP_NAME = "travel-agent";
export const USER_ID = "web-user";

const getApiKey = () =>
  process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? "";

const getRootModel = () =>
  process.env.TRAVEL_AGENT_MODEL || "gemini-3.5-flash-lite";

const getSearchModel = () =>
  process.env.TRAVEL_SEARCH_MODEL || "gemini-3.5-flash-lite";

// Mirror the Python agent's retry config (see agent.py / custom_agents.py).
// Safety net for Gemini 429 quota errors — do not lower `attempts`.
const getRetryConfig = () => ({
  httpOptions: {
    retryOptions: {
      attempts: 5,
      initialDelay: 2.0,
      maxDelay: 30.0,
      expBase: 2.0,
      jitter: 0.3,
      httpStatusCodes: [429, 500, 503],
    },
  },
});

const getFxRate = new FunctionTool({
  name: "get_fx_rate",
  description:
    "Fetches the current exchange rate between two currencies. Use this for any currency conversion question.",
  parameters: z.object({
    base: z.string().describe('The base currency, e.g. "SGD".'),
    target: z.string().describe('The target currency, e.g. "JPY".'),
  }),
  execute: async ({ base, target }) => {
    const url = `https://hexarate.paikama.co/api/rates/latest/${encodeURIComponent(base)}?target=${encodeURIComponent(target)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return { error: `Failed to fetch exchange rate (HTTP ${res.status}).` };
    }
    return res.json();
  },
});

const getWikipediaSummary = new FunctionTool({
  name: "get_wikipedia_summary",
  description:
    "Provides deep historical and cultural information on landmarks, concepts, and places. Use this for 'tell me about' or 'what is the history of' type questions.",
  parameters: z.object({
    topic: z
      .string()
      .describe("The topic to look up on Wikipedia, e.g. 'Angkor Wat'."),
  }),
  execute: async ({ topic }) => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "travel-agent-web/1.0 (local dev)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        error: `Wikipedia lookup failed (HTTP ${res.status}).`,
        suggestion:
          "Re-ask with a more specific topic, or retry with a different spelling.",
      };
    }
    const data = await res.json();
    if (data.type === "disambiguation") {
      return {
        note: `"${data.title}" has multiple meanings. Ask about a more specific topic.`,
        options:
          data.pages?.map((p: { title?: string }) => p.title).filter(Boolean) ??
          [],
      };
    }
    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page,
    };
  },
});

const SKILL_DEFAULT_DIR = path.join(
  process.cwd(),
  "skills",
  "travel-agent-skill"
);

let skillToolset: SkillToolset | null = null;

async function loadTravelSkill(): Promise<SkillToolset | null> {
  const skillDir = process.env.TRAVEL_SKILL_DIR || SKILL_DEFAULT_DIR;
  try {
    const skill = await loadSkillFromDir(skillDir);
    return new SkillToolset([skill]);
  } catch (error) {
    console.warn(
      `[travel-agent] Could not load travel skill from ${skillDir}:`,
      error
    );
    return null;
  }
}

const googleSearchAgent = new Agent({
  name: "google_search_agent",
  description:
    "A search agent that uses google search to get latest information about current events, weather, or business hours.",
  instruction:
    "Use google search to answer user questions about real-time, logistical information.",
  model: new Gemini({ model: getSearchModel(), apiKey: getApiKey() }),
  tools: [GOOGLE_SEARCH],
  generateContentConfig: getRetryConfig(),
});

let agentPromise: Promise<Agent> | null = null;

async function buildAgent(): Promise<Agent> {
  if (!getApiKey()) {
    throw new Error(
      "GOOGLE_API_KEY is not set. Copy web/.env.local.example to web/.env.local and add your Gemini API key."
    );
  }
  skillToolset = await loadTravelSkill();
  const tools: ToolUnion[] = [
    getFxRate,
    getWikipediaSummary,
    new AgentTool({ agent: googleSearchAgent }),
  ];
  if (skillToolset) tools.push(skillToolset);
  return new Agent({
    name: "root_agent",
    model: new Gemini({ model: getRootModel(), apiKey: getApiKey() }),
    instruction:
      "You are a helpful travel assistant. Help the user plan trips, understand destinations, check currency exchange, and answer travel logistics questions. For real-time, logistical information (current events, weather, business hours), transfer to the google_search_agent sub-agent. Answer in clear, well-structured prose or markdown lists. When giving an exchange rate, show the rate and the converted amount. If information from a tool is incomplete, say so instead of guessing.",
    tools,
    generateContentConfig: getRetryConfig(),
  });
}

export async function getAgent(): Promise<Agent> {
  if (!agentPromise) {
    agentPromise = buildAgent().catch((error) => {
      agentPromise = null;
      throw error;
    });
  }
  return agentPromise;
}

export const sessionService = new InMemorySessionService();

let runnerPromise: Promise<Runner> | null = null;

export async function getRunner(): Promise<Runner> {
  if (!runnerPromise) {
    runnerPromise = (async () => {
      const agent = await getAgent();
      return new Runner({
        appName: APP_NAME,
        agent,
        sessionService,
      });
    })();
  }
  return runnerPromise;
}

export async function ensureSession(sessionId: string): Promise<void> {
  const existing = await sessionService.getSession({
    appName: APP_NAME,
    userId: USER_ID,
    sessionId,
  });
  if (!existing) {
    await sessionService.createSession({
      appName: APP_NAME,
      userId: USER_ID,
      sessionId,
    });
  }
}
