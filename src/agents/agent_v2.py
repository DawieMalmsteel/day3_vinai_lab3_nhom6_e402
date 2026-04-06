from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from tools.search_flight import search_flight
from tools.search_hotel import search_hotel
from callback.log_callback import log_after_tool_execution, log_before_agent_entry
from prompts import GLOBAL_INSTRUCTION_V2, AGENT_V2_INSTRUCTION


def create_agent_v2(model=None):
    """
    Agent v2: Cải tiến từ v1 dựa trên failure analysis.

    Thay đổi so với v1:
    - Global instruction v2: thêm quy tắc sử dụng tool, format output cải tiến, few-shot examples
    - Instruction v2: thêm step-by-step reasoning, validate input, xử lý kết quả rỗng
    - Guardrails: chống hallucination, budget verification
    """
    if model is None:
        model = LiteLlm(model="openai/gpt-4o-mini")
    return LlmAgent(
        model=model,
        name="TravelAgentV2",
        description="Agent du lịch v2 - cải tiến prompt, thêm guardrails chống hallucination, xử lý lỗi tốt hơn",
        global_instruction=GLOBAL_INSTRUCTION_V2,
        instruction=AGENT_V2_INSTRUCTION,
        tools=[search_flight, search_hotel],
        after_tool_callback=log_after_tool_execution,
        before_agent_callback=log_before_agent_entry,
        output_key="travel_result",
    )
