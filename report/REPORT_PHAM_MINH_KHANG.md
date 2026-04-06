# Individual Report: Lab 3 - Chatbot vs ReAct Agent

- **Student Name**: Pham Minh Khang
- **Student ID**: 2A2600417
- **Date**: 06/04/2026

---

## I. Technical Contribution (15 Points)

*Describe your specific contribution to the codebase (e.g., implemented a specific tool, fixed the parser, etc.).*

- **Modules Implementated**: 
    - `src/services/agent.ts`: Xây dựng hệ thống ReAct Agent sử dụng OpenRouter (Qwen-2.5) và tích hợp công cụ `brave_search`.
    - `src/components/AgentChat.tsx`: Triển khai vòng lặp ReAct (Thought → Action → Observation) phía frontend để xử lý các phản hồi đa bước từ Model.
- **Code Highlights**:
    - Tự động hóa việc gọi công cụ và đẩy kết quả Observation ngược lại cho LLM thông qua vòng lặp `while (toolResults)` trong `handleSend`.
    - Thiết kế hệ thống System Prompt (`AGENT_RULES`) chặt chẽ, buộc Model phải suy luận qua bước `Thought` trước khi đưa ra hành động.
- **Documentation**: 
    - Agent hoạt động dựa trên cơ chế chặn (interception) các `functionCall` từ API. Khi nhận được yêu cầu gọi tool, frontend sẽ thực thi hàm `brave_search` qua proxy, sau đó gửi kết quả trả về cho Model kèm theo lịch sử trò chuyện để Model tiếp tục suy luận cho đến khi đạt được `Final Answer`.

---

## II. Debugging Case Study (10 Points)

*Analyze a specific failure event you encountered during the lab using the logging system.*

- **Problem Description**: Agent rơi vào trạng thái lỗi khi cố gắng gọi tool với query có chứa ký tự đặc biệt (ngoặc kép, xuống dòng), dẫn đến lỗi `SyntaxError: Unexpected token` khi thực hiện `JSON.parse` đối với arguments.
- **Log Source**: 
  ```text
  [17:15:20] [AGENT] Calling model: qwen/qwen-2.5-72b-instruct
  [17:15:22] [AGENT] Response received { toolCalls: 1 }
  [17:15:22] [TOOL_HANDLER] Processing tool: brave_search { query: "thời tiết "Đà Lạt" hôm nay" }
  [17:15:22] [AGENT_UI] Process error SyntaxError: Unexpected token ... in JSON at position ...
  ```
- **Diagnosis**: Model thỉnh thoảng sinh ra chuỗi JSON không hợp lệ (không escape dấu ngoặc kép bên trong chuỗi) khi tạo arguments cho function call.
- **Solution**: Đã bổ sung bước xử lý lỗi `try-catch` quanh đoạn `JSON.parse(tc.function.arguments)` trong `agent.ts` và cập nhật System Prompt yêu cầu Model "luôn escape ký tự đặc biệt trong tool arguments".

---

## III. Personal Insights: Chatbot vs ReAct (10 Points)

*Reflect on the reasoning capability difference.*

1.  **Reasoning**: Khối `Thought` đóng vai trò như một "sổ nháp" giúp Model tự nhắc nhở bản thân về mục tiêu. Thay vì trả lời "Tôi không biết", Agent có thể suy nghĩ: "Tôi cần thông tin thời tiết để lên lịch trình, vậy tôi sẽ gọi tool get_weather". Điều này giúp giải quyết các yêu cầu phức tạp mà một Chatbot thông thường (không có tool) thường phải trả lời dựa trên dữ liệu cũ hoặc hallucinate.
2.  **Reliability**: Agent đôi khi hoạt động kém hơn Chatbot ở tốc độ phản hồi (latency cao do phải gọi API nhiều lần). Ngoài ra, nếu kết quả từ `Observation` quá nhiễu, Agent có thể bị lạc hướng và đưa ra kế hoạch không tối ưu.
3.  **Observation**: Phản hồi từ môi trường là yếu tố sống còn. Ví dụ, khi tìm vé máy bay, `Observation` trả về giá thực tế giúp Agent điều chỉnh `Budget Allocation` ngay lập tức, chuyển từ khách sạn 5 sao sang 3 sao để đảm bảo không vượt ngân sách của user.

---

## IV. Future Improvements (5 Points)

*How would you scale this for a production-level AI agent system?*

- **Scalability**: Triển khai hàng đợi (Task Queue) để xử lý các tool call tốn thời gian ở phía server nhằm tránh timeout trên client.
- **Safety**: Sử dụng kỹ thuật "Self-Correction" hoặc một "Guardrail LLM" để kiểm tra tính an toàn của các tham số trước khi thực thi tool (đặc biệt là các tool có tác động thay đổi dữ liệu như booking).
- **Performance**: Tích hợp bộ nhớ dài hạn (Long-term Memory) qua Vector DB để Agent có thể nhớ sở thích của user từ các phiên làm việc trước đó mà không cần hỏi lại.
