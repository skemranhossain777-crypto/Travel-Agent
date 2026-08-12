from google.adk.agents import Agent
from google.adk.tools import FunctionTool
from google.adk.tools.agent_tool import AgentTool
from google.adk.integrations.langchain import LangchainTool
from google.genai import types

from .custom_functions import get_fx_rate
from .custom_agents import google_search_agent
from .third_party_tools import langchain_wikipedia_tool


root_agent = Agent(
    model='gemini-flash-latest',
    name='root_agent',
    description='A helpful assistant for user questions.',
    tools=[
        FunctionTool(get_fx_rate),
        AgentTool(agent=google_search_agent),
        LangchainTool(langchain_wikipedia_tool),
    ],
    generate_content_config=types.GenerateContentConfig(
        http_options=types.HttpOptions(
            retry_options=types.HttpRetryOptions(
                attempts=5,
                initial_delay=2.0,
                max_delay=30.0,
                exp_base=2.0,
                jitter=0.3,
                http_status_codes=[429, 500, 503],
            ),
        ),
    ),
)
