# Báo cáo thay đổi — Telemetry, Log & So sánh chi phí

> Dựa trên: `HANDOFF_API_PROVIDER.md`  
> Ngày thực hiện: 2026-04-06

---

## 1. Mục tiêu

Bổ sung vào repo **AI Travel Agent** ba khả năng:

1. **Structured logging (JSONL)** — ghi log theo format chuẩn, tự động lưu file vào `logs/`
2. **Tính chi phí API** — `estimated_cost_usd` cho mỗi lần gọi model
3. **Bảng so sánh Chatbot vs Agent** — xuất file `.md` + `.json` để nộp báo cáo

---

## 2. Tổng quan file thay đổi

```
src/
├── config/
│   └── apiProvider.ts        ← [MỚI] Chọn provider: Google trực tiếp hoặc ShopAIKey
├── utils/
│   ├── telemetry.ts          ← [VIẾT LẠI] Core logger + tự ghi file qua server
│   ├── pricing.ts            ← [MỚI] Bảng giá API tách riêng
│   ├── metrics.ts            ← [MỚI] Bóc tách token, tính cost, ghi LLM_METRIC
│   ├── comparison.ts         ← [MỚI] Tổng hợp & bảng so sánh Chatbot vs Agent
│   └── debug.ts              ← (không đổi)
├── services/
│   └── gemini.ts             ← [SỬA] Hook telemetry, tách mode chatbot/agent
├── App.tsx                   ← [SỬA] UI toggle mode, panel Telemetry
server/
│   └── vite-plugin-logger.ts ← [MỚI] Plugin Vite tự ghi file vào logs/
vite.config.ts                ← [SỬA] Thêm plugin logger
.env                          ← [SỬA] Tách key Google vs ShopAIKey
.gitignore                    ← [SỬA] Ignore nội dung logs/
logs/                         ← [MỚI] Thư mục chứa file log tự sinh
```

---

## 3. Chi tiết từng thay đổi

---

### 3.1 `src/config/apiProvider.ts` — MỚI

**Vấn đề trước đó:** API key và base URL bị hard-code trong `gemini.ts`, muốn đổi provider phải sửa code.

**Giải pháp:** Tạo file config trung tâm, chỉ cần đổi 1 dòng:

```ts
// Đổi giữa 2 provider:
export const ACTIVE_PROVIDER: ApiProvider = 'shopaikey';  // hoặc 'google'
```

| Hàm / Hằng số | Vai trò |
|---|---|
| `ACTIVE_PROVIDER` | Provider đang dùng (`'google'` hoặc `'shopaikey'`) |
| `MODEL` | Tên model (`'gemini-2.5-flash'`) |
| `PROVIDER_LABEL` | Nhãn ghi vào log (`'google'`) |
| `getActiveProviderConfig()` | Trả về `{ apiKey, baseUrl }` cho provider đang active |

Tương ứng trong `.env`:

```env
GEMINI_API_KEY="AIzaSy..."                                    # Google trực tiếp
SHOPAIKEY_API_KEY="sk-7FIq..."                                # ShopAIKey proxy
```

---

### 3.2 `src/utils/telemetry.ts` — VIẾT LẠI

**Vấn đề trước đó:** File cũ dùng `fs` + `path` (Node.js) — không chạy được trên browser. Log chỉ nằm trong console, không lưu file.

**Giải pháp:** Viết lại hoàn toàn cho browser. Log lưu trong memory, đồng thời tự POST lên Vite dev server để ghi file.

**Luồng hoạt động của mỗi event:**

```
logEvent("LLM_METRIC", {...})
  │
  ├─ 1. Lưu vào mảng currentSession.events[]     (memory)
  ├─ 2. console.log() có màu theo loại event      (DevTools)
  └─ 3. POST /api/log/event → server ghi file     (logs/*.jsonl)
```

| Hàm | Vai trò |
|---|---|
| `createSessionId()` | Tạo ID: `sess_1712345678_a1b2c3` |
| `startSessionLog(label, query, provider, model)` | Mở session mới, ghi `CHATBOT_START` hoặc `AGENT_START` |
| `logEvent(event, data)` | Ghi 1 event vào memory + console + server |
| `endSession(finalAnswer, extraData)` | Đóng session, ghi event kết thúc, gửi toàn bộ session lên server |
| `logError(label, step, errorType, message)` | Ghi event `ERROR` |
| `saveSessionToServer(session)` | POST `/api/log/session` → server ghi `.jsonl` + `.json` |
| `saveComparisonToServer(summary, markdown)` | POST `/api/log/compare` → server ghi `.md` + `.json` |
| `exportSessionLogJsonl(session?)` | Download `.jsonl` qua browser |
| `getSessionJsonl(session?)` | Trả JSONL string cho UI panel |

---

### 3.3 `src/utils/pricing.ts` — MỚI

**Vai trò:** Bảng giá tách riêng, không hard-code vào UI (theo yêu cầu handoff).

**Bảng giá:**

| Provider | Model | Input ($/1M tokens) | Output ($/1M tokens) |
|---|---|---:|---:|
| google | gemini-2.5-flash | $0.075 | $0.30 |
| google | gemini-2.0-flash | $0.075 | $0.30 |
| google | gemini-1.5-pro | $3.50 | $10.50 |
| openai | gpt-4o | $5.00 | $15.00 |
| anthropic | claude-3-sonnet | $3.00 | $15.00 |

**Công thức:**

```
estimated_cost_usd =
  (prompt_tokens / 1,000,000) × input_price +
  (completion_tokens / 1,000,000) × output_price
```

| Hàm | Vai trò |
|---|---|
| `getPricingConfig(provider, model)` | Tra bảng giá, trả `null` nếu chưa có |
| `calculateEstimatedCost(prompt, completion, pricing, toolUse?)` | Tính `estimated_cost_usd` |
| `formatCost(costUsd)` | Định dạng `$0.000123` |

---

### 3.4 `src/utils/metrics.ts` — MỚI

**Vai trò:** Bóc tách token usage từ Gemini response, tính cost, và ghi các event telemetry chuyên biệt.

| Hàm | Vai trò |
|---|---|
| `extractUsageMetrics(response)` | Đọc `usageMetadata` từ response → `{ prompt_tokens, completion_tokens, tool_use_prompt_tokens, total_tokens }` |
| `measureLatency(startMs, endMs?)` | `endMs - startMs` |
| `recordLlmMetric(label, step, response, latencyMs, provider, model)` | **Event quan trọng nhất** — ghi `LLM_METRIC` đầy đủ field |
| `recordReasoningStep(step, rawContent)` | Ghi `AGENT_REASONING_STEP` |
| `recordToolCall(step, toolName, args)` | Ghi `TOOL_CALL` |
| `recordToolResult(step, toolName, success, durationMs, resultPreview)` | Ghi `TOOL_RESULT` |

**Ví dụ event `LLM_METRIC`:**

```json
{
  "timestamp": "2026-04-06T04:01:35.904Z",
  "event": "LLM_METRIC",
  "data": {
    "label": "chatbot",
    "provider": "google",
    "model": "gemini-2.5-flash",
    "step": 1,
    "prompt_tokens": 123,
    "completion_tokens": 45,
    "total_tokens": 168,
    "latency_ms": 796,
    "estimated_cost_usd": 0.000012,
    "function_call_count": 0,
    "has_grounding_sources": false
  }
}
```

---

### 3.5 `src/utils/comparison.ts` — MỚI

**Vai trò:** Tổng hợp kết quả mỗi run và tạo bảng so sánh cuối.

| Hàm | Vai trò |
|---|---|
| `finalizeRunSummary(session)` | Duyệt tất cả `LLM_METRIC` → tính tổng tokens, cost, latency trung bình |
| `buildComparisonSummary(chatbotSummary, agentSummary)` | Ghép 2 run + tính diff (ratio token, ratio cost, chênh lệch latency) |
| `exportComparisonMarkdown(summary)` | Render bảng Markdown |
| `downloadComparisonMd(summary)` | Download `compare_*.md` qua browser |
| `downloadComparisonJson(summary)` | Download `compare_*.json` qua browser |

**Bảng so sánh mẫu:**

| Metric | Chatbot | Agent | Ghi chú |
|---|---:|---:|---|
| Total Tokens | 168 | 1,245 | Agent dùng 7.41x tokens |
| Total Cost (USD) | $0.000012 | $0.000089 | Agent tốn 7.41x chi phí |
| Avg Latency (ms) | 796 | 2,341 | +1545ms |
| Loop Count | 0 | 3 | +3 loops |
| Tool Call Count | 0 | 4 | +4 tools |
| Error Count | 0 | 0 | |

---

### 3.6 `src/services/gemini.ts` — SỬA

**Thay đổi chính:**

**a) Tách mode Chatbot vs Agent:**

| Mode | System instruction | Tools | Tool loop |
|---|---|---|---|
| `chatbot` | "Trả lời trực tiếp, KHÔNG gọi tool" | Không truyền | Không |
| `agent` | "LUÔN gọi ít nhất 1 tool" | Đầy đủ 4 tools | Có (ReAct) |

**b) Hook telemetry:**

```
chatWithTravelAgent(messages, mode)
  │ startTime = Date.now()
  │ ... gọi API ...
  │ latencyMs = Date.now() - startTime
  │
  └─→ recordLlmMetric(label, step, response, latencyMs, provider, model)
       └─→ extractUsageMetrics(response)
       └─→ calculateEstimatedCost(...)
       └─→ logEvent("LLM_METRIC", {...})
```

```
handleToolCalls(response)
  │ for mỗi function call:
  │   recordToolCall(step, toolName, args)         ← trước khi chạy
  │   ... chạy tool ...
  │   recordToolResult(step, toolName, success, duration, preview)  ← sau khi chạy
```

**c) Dùng config provider:**

```ts
// Trước:
const getAI = () => new GoogleGenAI({
    apiKey: process.env.SHOPAIKEY_API_KEY || process.env.GEMINI_API_KEY || '',
    httpOptions: { baseUrl: 'https://api.shopaikey.com' },  // luôn qua shopaikey
});

// Sau:
const getAI = () => {
    const { apiKey, baseUrl } = getActiveProviderConfig();   // đọc từ config
    return new GoogleGenAI({
        apiKey,
        ...(baseUrl ? { httpOptions: { baseUrl } } : {}),   // chỉ set nếu có
    });
};
```

| Hàm mới | Vai trò |
|---|---|
| `resetStepCounter()` | Reset bộ đếm step về 0 trước mỗi session |
| `getStepCount()` | Lấy step hiện tại |

---

### 3.7 `src/App.tsx` — SỬA

**UI mới trên header:**

| Nút | Chức năng |
|---|---|
| **Agent / Chatbot** toggle | Chuyển mode — chatbot không gọi tool, agent gọi tool |
| **Telemetry** | Mở/đóng panel bên phải |

**Panel Telemetry có 2 tab:**

| Tab | Nội dung |
|---|---|
| **Raw Log (JSONL)** | Hiển thị log real-time dạng JSONL, có nút download `.jsonl` |
| **So sanh** | Bảng so sánh Chatbot vs Agent, có nút download `.md` / `.json` |

**Logic mới trong `handleSend()`:**

1. `resetStepCounter()` — reset step
2. `startSessionLog(mode, query, provider, model)` — mở session
3. Gọi model (chatbot: 1 lần / agent: loop cho đến khi hết tool call)
4. `endSession(finalAnswer)` — đóng session → tự động ghi file vào `logs/`
5. `finalizeRunSummary(session)` → cập nhật `chatbotSummary` hoặc `agentSummary`
6. Khi có đủ cả 2 → tự động `buildComparisonSummary()` + ghi file `compare_*.md` vào `logs/`

---

### 3.8 `server/vite-plugin-logger.ts` — MỚI

**Vấn đề:** Browser không thể ghi file trực tiếp. Giảng viên yêu cầu có file trong `logs/`.

**Giải pháp:** Tạo Vite plugin — khi chạy `npm run dev`, plugin thêm 4 endpoint API vào dev server:

| Endpoint | Method | Chức năng | File sinh ra |
|---|---|---|---|
| `/api/log/event` | POST | Append 1 dòng JSONL vào file | `logs/session_*.jsonl` (real-time) |
| `/api/log/session` | POST | Lưu toàn bộ session | `logs/session_*.jsonl` + `logs/session_*.json` |
| `/api/log/compare` | POST | Lưu bảng so sánh | `logs/compare_*.md` + `logs/compare_*.json` |
| `/api/log/list` | GET | Liệt kê tất cả file log | (JSON response) |

**Kết quả trong terminal khi chat:**

```
📝 [logger] New session file: logs/session_chatbot_2026-04-06T12-30-45.jsonl
✅ [logger] Session saved:
   📄 logs/session_chatbot_2026-04-06T12-30-45.jsonl
   📄 logs/session_chatbot_2026-04-06T12-30-45.json
📊 [logger] Comparison saved:
   📄 logs/compare_2026-04-06T12-35-00.md
   📄 logs/compare_2026-04-06T12-35-00.json
```

---

## 4. Cấu trúc thư mục `logs/` sau khi chạy

```
logs/
├── session_chatbot_2026-04-06T12-30-45.jsonl    ← mỗi dòng 1 JSON event
├── session_chatbot_2026-04-06T12-30-45.json     ← full session (pretty-print)
├── session_agent_2026-04-06T12-32-10.jsonl
├── session_agent_2026-04-06T12-32-10.json
├── compare_2026-04-06T12-35-00.md               ← bảng Markdown so sánh
├── compare_2026-04-06T12-35-00.json             ← data JSON so sánh
└── .gitkeep
```

---

## 5. Hướng dẫn chạy

```bash
# 1. Cài dependencies (nếu chưa)
npm install

# 2. Chỉnh API key trong .env
#    - Dùng Google: điền GEMINI_API_KEY, đổi ACTIVE_PROVIDER = 'google'
#    - Dùng ShopAIKey: điền SHOPAIKEY_API_KEY, đổi ACTIVE_PROVIDER = 'shopaikey'

# 3. Chạy dev server
npm run dev

# 4. Mở browser: http://localhost:3000
```

**Quy trình so sánh:**

1. Click nút **Telemetry** trên header
2. Chọn mode **Chatbot** → gõ: `Kế hoạch Đà Nẵng 3 ngày` → Send
3. Chọn mode **Agent** → gõ **cùng câu hỏi** → Send
4. Tab **So sanh** hiện bảng tự động
5. Mở thư mục `logs/` — file đã được tạo sẵn

---

## 6. Danh sách event theo schema handoff

```
CHATBOT_START          → bắt đầu run chatbot
AGENT_START            → bắt đầu run agent
LLM_METRIC             → mỗi lần gọi model (event quan trọng nhất)
AGENT_REASONING_STEP   → agent trả về reasoning (chỉ agent)
TOOL_CALL              → trước khi chạy tool (chỉ agent)
TOOL_RESULT            → sau khi tool trả kết quả (chỉ agent)
CHATBOT_END            → kết thúc run chatbot
AGENT_SUCCESS          → kết thúc run agent
ERROR                  → khi có lỗi
```

Tất cả event đều có 3 field gốc: `timestamp`, `event`, `data`.

---

## 7. Checklist nghiệm thu

| Yêu cầu | Trạng thái |
|---|:---:|
| Có raw log JSONL trong `logs/` | OK |
| Có event `LLM_METRIC` | OK |
| Có `estimated_cost_usd` | OK |
| Có `latency_ms` cho từng model call | OK |
| Có `loop_count` + `tool_call_count` cho agent | OK |
| Có `error_count` | OK |
| Có bảng tổng hợp Chatbot vs Agent | OK |
| File tự sinh vào `logs/` khi chat | OK |
| Có thể chọn provider Google hoặc ShopAIKey | OK |
