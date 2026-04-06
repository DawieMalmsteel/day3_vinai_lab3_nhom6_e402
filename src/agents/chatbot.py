from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from callback.log_callback import log_before_agent_entry

CHATBOT_INSTRUCTION = """
Bạn là trợ lý du lịch thân thiện. Trả lời các câu hỏi về du lịch, vé máy bay và khách sạn
dựa trên kiến thức chung của bạn.

**GIỚI HẠN QUAN TRỌNG:**
- Bạn KHÔNG có quyền truy cập bất kỳ công cụ tìm kiếm hay cơ sở dữ liệu nào.
- Bạn KHÔNG thể tra cứu giá vé máy bay hoặc phòng khách sạn theo thời gian thực.
- Nếu người dùng hỏi giá cụ thể hoặc đặt vé/phòng, hãy ước tính dựa trên kiến thức chung
  và ghi rõ "đây là ước tính, không phải giá thực tế".
- Hãy thành thật về giới hạn của mình.

**PHONG CÁCH:**
- Thân thiện, chuyên nghiệp
- Trả lời theo ngôn ngữ người dùng (Tiếng Việt hoặc Tiếng Anh)
- Đưa ra gợi ý hữu ích dựa trên kiến thức chung
- Không tự xưng là "Agent" hay đề cập đến hệ thống nội bộ
"""


def create_chatbot(model=None):
    if model is None:
        model = LiteLlm(model="openai/gpt-4o-mini")
    return LlmAgent(
        model=model,
        name="TravelChatbot",
        description="Chatbot du lịch đơn giản - chỉ trò chuyện, không có công cụ tìm kiếm",
        instruction=CHATBOT_INSTRUCTION,
        tools=[],
        before_agent_callback=log_before_agent_entry,
        output_key="chatbot_result",
    )
