import wikipedia

from langchain_community.tools import WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper

# The bundled `wikipedia` library sends a default User-Agent that Wikipedia
# blocks (returns HTML instead of JSON), which breaks every tool call.
wikipedia.set_user_agent("TravelAgent/1.0 (https://github.com/google/adk; contact: travel-agent@example.com)")

# Configure the Wikipedia LangChain tool to act as our cultural guide
langchain_wikipedia_tool = WikipediaQueryRun(
    api_wrapper=WikipediaAPIWrapper(top_k_results=1, doc_content_chars_max=3000)
)

# Give the tool a more specific description for our agent
langchain_wikipedia_tool.description = (
    "Provides deep historical and cultural information on landmarks, concepts, and places."
    "Use this for 'tell me about' or 'what is the history of' type questions."
)
