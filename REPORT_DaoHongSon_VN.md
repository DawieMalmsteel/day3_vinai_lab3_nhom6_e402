# Báo Cáo Cá Nhân: Lab 3 - Chatbot vs ReAct Agent

- **Họ và tên**: Đào Hồng Sơn
- **Mã sinh viên**: 2A202600462
- **Ngày**: 06/04/2026

---

## I. Đóng Góp Kỹ Thuật (15 Điểm)

Phần tôi phụ trách tập trung vào lớp telemetry và đánh giá hệ thống. Tôi làm phần so sánh chi phí giữa Agent và Chatbot, thêm structured logs, tích hợp provider Gemini bên thứ 3, theo dõi response từ API, và bổ sung giao diện trực quan để dễ quan sát kết quả so sánh.

- **Các module đã thực hiện**:
  - `src/config/apiProvider.ts`: thêm cơ chế chọn provider tập trung để ứng dụng có thể chuyển giữa Google Gemini trực tiếp và provider Gemini tương thích bên thứ 3 (`shopaikey`).
  - `src/utils/telemetry.ts`: xây dựng logging theo session cho cả Chatbot và Agent.
  - `src/utils/pricing.ts`: thêm bảng giá theo provider/model để ước lượng chi phí API.
  - `src/utils/metrics.ts`: tách token usage, đo latency, và ghi các event như `LLM_METRIC`, `TOOL_CALL`, `TOOL_RESULT`, và reasoning step.
  - `src/utils/comparison.ts`: tổng hợp kết quả Chatbot vs Agent và xuất báo cáo so sánh dạng Markdown/JSON.
  - `server/vite-plugin-logger.ts`: thêm Vite plugin để lưu telemetry từ browser xuống thư mục `logs/`.

- **Các file tôi sửa hoặc thêm trong phạm vi này**:
  - `src/App.tsx`
  - `src/services/gemini.ts`
  - `src/config/apiProvider.ts`
  - `src/utils/telemetry.ts`
  - `src/utils/pricing.ts`
  - `src/utils/metrics.ts`
  - `src/utils/comparison.ts`
  - `server/vite-plugin-logger.ts`
  - `vite.config.ts`
  - `.gitignore`
  - `.env` / `.env.example`
  - `logs/.gitkeep`

- **Kết quả kỹ thuật chính**:
  - Tạo được cơ chế so sánh có số liệu giữa `chatbot` mode và `agent` mode.
  - Ghi raw execution trace vào `logs/*.jsonl` và xuất kết quả so sánh ra `logs/*.md`, `logs/*.json`.
  - Ước lượng chi phí API từ token usage thay vì chỉ so sánh bằng cảm tính theo câu trả lời cuối.
  - Thêm hỗ trợ cho provider Gemini bên thứ 3 để cùng một ứng dụng có thể chạy qua endpoint Gemini-compatible khác.
  - Tách rõ hành vi thực thi: Chatbot là single-shot direct call, còn Agent có thể đi theo reasoning/tool-flow.

- **Phần frontend và trực quan hóa**:
  - Thêm nút chuyển `Agent/Chatbot` ngay trên giao diện để dễ chạy thử hai mode.
  - Thêm side panel `Telemetry` để xem log và bảng so sánh trực tiếp trên giao diện thay vì chỉ nhìn console.
  - Xây dựng 2 tab `Raw Log (JSONL)` và `So sánh` để dễ theo dõi dữ liệu thô và dữ liệu tổng hợp.
  - Thêm status badge, summary card, bảng metric và phần nhận xét để đọc nhanh token, cost, latency, loop count, tool count, và error count.
  - Thêm nút tải `.jsonl`, `.md`, `.json` để xuất log và báo cáo so sánh.
  - Thêm hướng dẫn so sánh công bằng và cảnh báo khi hai lần chạy gần nhất không dùng cùng một prompt.

- **Phần xử lý response API và khả năng quan sát**:
  - Thêm kiểm tra response rỗng hoặc trường hợp agent không gọi tool như mong đợi.
  - Ghi lại metadata của response như độ dài text, số function call, tên function, finish reason, grounding sources, token usage, và latency.
  - Hiển thị trạng thái đang xử lý khi Agent gọi tool.
  - Render nguồn tham khảo trong giao diện chat khi response có grounding data.
  - Bổ sung telemetry cho local feature để chúng vẫn xuất hiện trong dashboard với latency thực và cost bằng 0.

- **Tài liệu liên quan**:
  - `TELEMETRY_CHANGES.md`: ghi lại các thay đổi chính, module đã thêm, phần giao diện so sánh, và các lỗi đã fix.
  - `HANDOFF_API_PROVIDER.md`: mô tả schema event, các field về chi phí, và bộ chỉ số cần có để so sánh Agent vs Chatbot.

---

## II. Case Study Debug (10 Điểm)

- **Mô tả vấn đề**: Một lỗi quan trọng khiến Agent và Chatbot cho kết quả quá giống nhau ở một số prompt, làm sai mục tiêu so sánh. Ví dụ với các prompt lập kế hoạch du lịch, cùng một local handler có thể chặn trước nên Chatbot không còn đóng vai trò là baseline gọi API trực tiếp.

- **Nguồn log**:
  - `logs/session_chatbot_2026-04-06T14-39-52.json`
  - `logs/session_agent_2026-04-06T14-39-24.json`
  - `logs/compare_2026-04-06T14-39-52.md`

- **Chẩn đoán**: Lỗi chính không nằm ở Gemini mà nằm ở luồng xử lý trong `src/App.tsx`. Một số local feature handlers được chạy trước khi tách mode đủ chặt, nên cả hai mode có thể đi vào cùng một nhánh logic. Điều này làm cho baseline của Chatbot không còn đáng tin cậy. Ngoài ra, các local feature ban đầu chưa có telemetry session nên có những lần chạy không tạo ra summary để so sánh, làm cho comparison panel không phản ánh đúng hành vi thật.

- **Cách xử lý**:
  - Bọc local feature handlers để chúng chỉ chạy trong `agent` mode.
  - Thêm `trackLocalFeature()` để local feature vẫn tạo telemetry record ngay cả khi return sớm.
  - Mở rộng keyword detection cho trip planner để các prompt như `"ke hoach di"` được xử lý đúng.
  - Cải thiện error handling cho các lỗi API key, rate limit, network, và server.
  - Đảm bảo dashboard frontend chỉ so sánh các lần chạy tương đương và có cảnh báo khi bị lệch prompt.

- **Kết quả**: Sau khi fix, phần so sánh đáng tin cậy hơn rõ rệt. Chatbot giữ đúng vai trò direct-response baseline, còn Agent giữ luồng thực thi riêng. Log và giao diện so sánh lúc đó thể hiện được các chỉ số thực như token usage, latency, cost, loop count, tool count, và error count thay vì trộn hai hành vi khác nhau vào cùng một nhãn.

---

## III. Nhận Xét Cá Nhân: Chatbot vs ReAct (10 Điểm)

1. **Reasoning**: Điểm mạnh lớn nhất của Agent không chỉ là câu trả lời cuối, mà là khả năng nhìn thấy quá trình xử lý. Với telemetry, tôi có thể xem từng reasoning step, từng tool call, từng tool result, và cả response metric. Điều này giúp việc phân tích lỗi rõ ràng hơn.

2. **Độ tin cậy**: Agent không tự động tốt hơn Chatbot. Với các prompt đơn giản, Chatbot thường đơn giản hơn và ổn định hơn. Agent có nhiều thành phần hơn nên cũng dễ chậm hơn hoặc khó debug hơn nếu tool loop thực ra không cần thiết.

3. **Observation**: Phản hồi từ môi trường chỉ có giá trị khi nó làm thay đổi quyết định ở bước tiếp theo. Nếu Agent nhận được tool output hữu ích thì bước sau sẽ grounded hơn. Nếu không có observation hữu ích thì reasoning path thêm vào chỉ làm tăng overhead.

4. **Chi phí và hiệu năng**: Một bài học quan trọng là không nên giả định. Agent thường được nghĩ là tốn hơn, nhưng phải có log thực tế mới kết luận được vì cost, latency, token usage, và cả response behavior thay đổi theo từng prompt. Đó là lý do tôi thêm raw logs, API response metrics, và comparison report trực quan thay vì chỉ đánh giá thủ công.

---

## IV. Hướng Cải Tiến (5 Điểm)

- **Scalability**: Đưa telemetry lên backend hoặc database thay vì chỉ ghi local log file ở dev mode.
- **Safety**: Thêm guardrails cho loop count, validate tool rõ hơn, và có fallback khi Agent tiếp tục reasoning nhưng không có observation hữu ích.
- **Performance**: Thêm caching và batch evaluation để chạy so sánh Agent vs Chatbot nhanh hơn.
- **Evaluation**: Xây dựng bộ prompt benchmark cố định để tự động so sánh total tokens, total cost, latency, chất lượng response, và success rate qua nhiều lần chạy.
