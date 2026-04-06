# Individual Report: Lab 3 - Chatbot vs ReAct Agent

- **Student Name**: [Trần Thượng Trường Sơn]
- **Student ID**: [2A202600313]
- **Branch**: Phần làm của em là ở branch `TranThuongTruongSon`.

---

## I. Technical Contribution (15 Points)

*Mô tả chi tiết đóng góp cụ thể vào codebase.*

### Modules Implemented
- `src/tools/search_flight.py` - Triển khai tool tìm kiếm vé máy bay sử dụng Brave Search API để lấy thông tin chuyến bay thực tế từ web.
- `src/tools/search_hotel.py` - Triển khai tool tìm kiếm khách sạn với Makcorps Hotel API và fallback curated data.
- `src/agents/agent_v2.py` - Cải tiến Agent v2 với prompt engineering tốt hơn, thêm guardrails chống hallucination.
- `src/main.py` - Xây dựng hệ thống FastAPI server với session management hỗ trợ contextual memory.

### Code Highlights

**1. Tool Calling - Agent gọi tools tự động dựa trên ngữ cảnh:**

```python
# src/agents/agent.py - Agent được cấu hình với tools để tự quyết định khi nào gọi
return LlmAgent(
    model=model,
    name="TravelAgent",
    tools=[search_flight, search_hotel],        # Tool calling: Agent tự chọn tool phù hợp
    after_tool_callback=log_after_tool_execution, # Logging mỗi lần gọi tool
    output_key="travel_result",
)
```

Agent sử dụng cơ chế **Tool Calling** của LLM: khi nhận được yêu cầu từ người dùng, LLM phân tích ý định và tự động quyết định gọi tool nào (`search_flight` hay `search_hotel`) với các tham số phù hợp. Đây là điểm khác biệt cốt lõi so với Chatbot (không có tool nào).

**2. Contextual Memory - Nhớ ngữ cảnh qua InMemorySessionService:**

```python
# src/main.py - Session service giữ lại toàn bộ lịch sử hội thoại
session_service = InMemorySessionService()

async def call_agent(user_id, session_id, query, mode, provider):
    effective_session = f"{mode}_{provider}_{session_id}"
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=effective_session
    )
    if not session:
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=effective_session
        )
```

`InMemorySessionService` lưu trữ toàn bộ lịch sử hội thoại (conversation history) của từng user/session. Nhờ đó, Agent có khả năng **nhớ ngữ cảnh** (contextual memory): khi người dùng hỏi tiếp "còn khách sạn nào rẻ hơn không?", Agent biết được người dùng đang nói về địa điểm nào từ câu hỏi trước đó mà không cần hỏi lại.

### How My Code Interacts with the ReAct Loop

- **Tool Calling trong ReAct Loop**: Khi người dùng gửi yêu cầu (ví dụ: "Tìm vé máy bay Hà Nội đi Đà Nẵng"), Agent thực hiện vòng lặp ReAct:
  1. **Thought**: Agent phân tích yêu cầu, xác định cần gọi `search_flight` với origin="Hà Nội", destination="Đà Nẵng".
  2. **Action**: Agent gọi tool `search_flight(origin="Hà Nội", destination="Đà Nẵng")` — đây là bước **Tool Calling**.
  3. **Observation**: Kết quả trả về từ Brave Search API được đưa lại vào prompt.
  4. **Final Answer**: Agent tổng hợp kết quả và trả lời người dùng dưới dạng bảng markdown.

- **Contextual Memory trong ReAct Loop**: Nhờ session service, mỗi lượt hội thoại đều được lưu lại. Agent có thể tham chiếu đến các kết quả tìm kiếm trước đó để trả lời câu hỏi tiếp theo một cách mạch lạc, ví dụ: người dùng hỏi "vé đi Đà Nẵng" → rồi hỏi tiếp "tìm luôn khách sạn ở đó" → Agent biết "ở đó" là Đà Nẵng nhờ ngữ cảnh.

---

## II. Debugging Case Study (10 Points)

*Phân tích chi tiết ít nhất 1 failure event sử dụng hệ thống logging.*

### Problem Description
Tool `search_flight` sử dụng Brave Search API để tìm kiếm thông tin vé máy bay. Tuy nhiên, Brave Search trả về kết quả web tổng hợp (tiêu đề trang web, snippet) thay vì dữ liệu chuyến bay có cấu trúc. Điều này dẫn đến kết quả thiếu chính xác: không có giá vé cụ thể, thời gian bay không chính xác, và đôi khi trả về các bài blog du lịch thay vì thông tin chuyến bay thực tế.

### Log Source
```json
{
  "timestamp": "2025-04-05T10:23:15",
  "event": "TOOL_EXECUTION",
  "data": {
    "agent_name": "TravelAgent",
    "tool_name": "search_flight",
    "arguments": {"origin": "Hà Nội", "destination": "Đà Nẵng", "departure_time": "2025-04-15"},
    "brave_query": "vé máy bay Hà Nội đến Đà Nẵng ngày 2025-04-15",
    "result_count": 10,
    "note": "Kết quả trả về chủ yếu là links đến các trang Traveloka, BestPrice, nhưng không có dữ liệu giá/thời gian cụ thể có cấu trúc"
  }
}
```

### Diagnosis
**Nguyên nhân gốc**: Brave Search API là công cụ tìm kiếm web tổng hợp, không phải flight API chuyên dụng. Kết quả trả về dạng `{title, snippet, url}` — là metadata của trang web, không phải dữ liệu chuyến bay có cấu trúc (giá, hãng bay, giờ khởi hành, số hiệu chuyến bay). Hàm `_extract_time()` và `_extract_airline()` cố gắng parse thông tin từ text nhưng độ chính xác thấp vì:
- Snippet thường bị cắt ngắn, thiếu thông tin.
- Giá vé hiếm khi xuất hiện trong snippet.
- Nhiều kết quả là bài viết blog, review thay vì trang booking thực tế.

### Solution
Cần thay thế Brave Search API bằng **Flight API chuyên dụng** (ví dụ: Amadeus Flight API, Skyscanner API, hoặc AviationStack API) để có dữ liệu chuyến bay có cấu trúc rõ ràng. Tương tự cách `search_hotel` đã sử dụng Makcorps Hotel API và có fallback curated data, `search_flight` nên:
1. Gọi Flight API chuyên dụng để lấy dữ liệu chuyến bay thực (giá, hãng, giờ bay, số hiệu).
2. Có fallback curated data khi API không khả dụng.
3. Trả về `FlightOutput` với thông tin đầy đủ, có cấu trúc thay vì parse từ web snippet.

---

## III. Personal Insights: Chatbot vs ReAct (10 Points)

### 1. Reasoning

**Tool Calling** là khả năng cốt lõi giúp Agent vượt trội so với Chatbot. Khi người dùng hỏi "Tìm vé máy bay Hà Nội đi Đà Nẵng ngày 15/7", Agent thực hiện reasoning:
- Thought: "Người dùng cần tìm vé máy bay cụ thể. Tôi cần gọi search_flight với origin=Hà Nội, destination=Đà Nẵng, departure_time=2025-07-15."
- Action: Gọi `search_flight` → nhận kết quả thực tế từ API.
- Answer: Trả về danh sách chuyến bay với thông tin cụ thể.

Trong khi đó, Chatbot không có tools nên chỉ có thể đoán dựa trên training data: "Thường có các chuyến bay của Vietnam Airlines, Vietjet... giá khoảng 1-2 triệu" — thông tin này không chính xác theo thời gian thực và Chatbot phải tự thừa nhận "đây là ước tính, không phải giá thực tế".

**Contextual Memory** giúp Agent duy trì cuộc hội thoại tự nhiên qua nhiều lượt. Ví dụ:
- Lượt 1: "Tìm vé Hà Nội đi Đà Nẵng" → Agent tìm và trả kết quả.
- Lượt 2: "Tìm luôn khách sạn ở đó ngân sách 2 triệu" → Agent nhớ "ở đó" = Đà Nẵng, gọi `search_hotel(location="Đà Nẵng", max_price=2000000)`.

Chatbot cũng có contextual memory (vì cùng dùng session service), nhưng vì không có tools nên không thể hành động dựa trên ngữ cảnh đó.

### 2. Reliability

Agent kém hơn Chatbot trong các trường hợp:
- **Câu hỏi đơn giản**: Khi người dùng chỉ chào hỏi hoặc hỏi tip du lịch chung ("Đà Nẵng có gì hay?"), Agent đôi khi cố gọi tool không cần thiết, tăng latency. Chatbot trả lời nhanh hơn và tự nhiên hơn.
- **Tool failure**: Khi Brave Search API timeout hoặc BRAVE_API_KEY không hợp lệ, Agent trả về kết quả rỗng — trong khi Chatbot vẫn có thể đưa ra gợi ý chung dựa trên kiến thức sẵn có.
- **Kết quả web không cấu trúc**: Brave Search trả về links web thay vì dữ liệu chuyến bay cụ thể, khiến Agent đôi khi hiển thị thông tin không đầy đủ (thiếu giá, thiếu giờ bay).

### 3. Observation Feedback Loop

Observation (kết quả tool) ảnh hưởng trực tiếp đến hành vi tiếp theo của Agent:
- **Kết quả có dữ liệu**: Agent tổng hợp và trình bày dưới dạng bảng markdown rõ ràng.
- **Kết quả rỗng**: Agent v2 nhận ra và chủ động đề xuất giải pháp: "Không tìm thấy chuyến bay phù hợp. Gợi ý: thử đổi ngày hoặc đổi điểm đến" — thay vì bịa đặt kết quả như Chatbot có thể làm.
- **Combo search**: Khi tìm cả vé máy bay lẫn khách sạn, Agent sử dụng Observation từ `search_flight` để quyết định có cần gọi tiếp `search_hotel` hay không, và tính tổng chi phí để so sánh với ngân sách người dùng.

---

## IV. Future Improvements (5 Points)

### Scalability
- Sử dụng async queue cho tool calls song song (gọi `search_flight` và `search_hotel` đồng thời thay vì tuần tự).
- Thêm caching cho queries phổ biến (ví dụ: "vé Hà Nội - Đà Nẵng" được hỏi nhiều → cache kết quả 15 phút).
- Chuyển từ `InMemorySessionService` sang database-backed session (Redis/PostgreSQL) để hỗ trợ nhiều instances.

### Safety
- Thêm Supervisor LLM để audit actions của Agent, ngăn chặn gọi tool với tham số bất thường.
- Guardrails chống prompt injection: không cho phép người dùng thay đổi system prompt qua input.
- Validate tất cả tham số tool trước khi gọi (origin ≠ destination, max_price > 0).

### Performance
- **Thay thế Brave Search bằng Flight API chuyên dụng** (Amadeus, Skyscanner, AviationStack) để có dữ liệu chuyến bay có cấu trúc, chính xác hơn — đây là điểm yếu lớn nhất hiện tại.
- Thêm curated fallback data cho flight (tương tự `search_hotel` đã có) để đảm bảo luôn có kết quả.
- Streaming response để người dùng thấy kết quả từng phần thay vì chờ toàn bộ.
- Vector DB cho tool retrieval khi mở rộng thêm nhiều tools.

### Production Features
- Tích hợp Flight Booking API thực tế thay vì Brave Search để có giá vé, số hiệu chuyến bay, giờ bay chính xác.
- Payment gateway cho chức năng đặt vé/phòng.
- User authentication và conversation history persistence (lưu DB thay vì in-memory).
- Multi-language support mở rộng (English, Japanese, Korean cho khách du lịch quốc tế).

---

