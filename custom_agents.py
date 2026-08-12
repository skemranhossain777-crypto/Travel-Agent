from google.adk.agents import Agent
from google.adk.tools import google_search
from google.genai import types


# Create an agent with google search tool as a search specialist
google_search_agent = Agent(
    model='gemini-2.5-flash',
    name='google_search_agent',
    description='A search agent that uses google search to get latest information about current events, weather, or business hours.',
    instruction='Use google search to answer user questions about real-time, logistical information.',
    tools=[google_search],
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
