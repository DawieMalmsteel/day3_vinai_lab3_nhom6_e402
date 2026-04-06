from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from tools.search_flight import search_flight
from tools.search_hotel import search_hotel
from callback.log_callback import log_after_tool_execution, log_before_agent_entry
from prompts import GLOBAL_INSTRUCTION, AGENT_V1_INSTRUCTION


def create_agent_v1(model=None):
    """Agent v1: Phiên bản cơ bản với ReAct loop qua Google ADK."""
    if model is None:
        model = LiteLlm(model="openai/gpt-4o-mini")
    return LlmAgent(
        model=model,
        name="TravelAgent",
        description="Agent hỗ trợ đặt vé máy bay, khách sạn trong mức ngân sách của người dùng",
        global_instruction=GLOBAL_INSTRUCTION,
        instruction=AGENT_V1_INSTRUCTION,
        tools=[search_flight, search_hotel],
        after_tool_callback=log_after_tool_execution,
        before_agent_callback=log_before_agent_entry,
        output_key="travel_result",
    )


TravelAgent = create_agent_v1()
root_agent = TravelAgent
