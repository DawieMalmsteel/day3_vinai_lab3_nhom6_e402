# Telemetry & Cost Comparison — Thay đổi và triển khai

> Dựa trên handoff: `HANDOFF_API_PROVIDER.md`

---

## Tổng quan

Bổ sung hệ thống **structured logging (JSONL)** và **bảng so sánh chi phí Chatbot vs Agent** vào repo Travel Agent.  
Toàn bộ chạy trên **browser** (không dùng `fs`/`path` Node.js).

---

## Danh sách file thay đổi

| File | Trạng thái | Mô tả |
|---|---|---|
| `src/utils/telemetry.ts` | **Viết lại** | Core logger browser-compatible |
| `src/utils/pricing.ts` | **Tạo mới** | Bảng giá API theo provider/model |
| `src/utils/metrics.ts` | **Tạo mới** | Bóc tách usage, tính cost, ghi LLM_METRIC |
| `src/utils/comparison.ts` | **Tạo mới** | Tổng hợp và so sánh Chatbot vs Agent |
| `src/services/gemini.ts` | **Sửa** | Hook telemetry vào model call + tool handling |
| `src/App.tsx` | **Sửa** | Thêm mode toggle, session management, UI panel |

---

## Chi tiết từng file

### `src/utils/telemetry.ts` — Viết lại hoàn toàn

File cũ dùng `import * as fs from 'fs'` và `import * as path from 'path'` — **không chạy được trên browser**.

**Hàm đã thêm / thay đổi:**

| Hàm | Mô tả |
|---|---|
| `createSessionId()` | Tạo ID duy nhất cho mỗi session: `sess_<timestamp>_<random>` |
| `startSessionLog(label, query, provider, model)` | Khởi tạo session mới, ghi event `CHATBOT_START` hoặc `AGENT_START` |
| `getCurrentSession()` | Trả về session đang chạy |
| `getCompletedSessions()` | Trả về danh sách tất cả session đã kết thúc |
| `logEvent(event, data)` | Ghi 1 dòng JSON vào memory + pretty-print màu lên console |
| `endSession(finalAnswer, extraData)` | Kết thúc session, ghi `CHATBOT_END` / `AGENT_SUCCESS`, archive vào `completedSessions` |
| `logError(label, step, errorType, message)` | Ghi event `ERROR` với phân loại lỗi |
| `exportSessionLogJsonl(session?)` | Download file `.jsonl` (1 JSON object mỗi dòng) |
| `exportSessionLogJson(session?)` | Download file `.json` (pretty-printed) |
| `getSessionJsonl(session?)` | Trả về toàn bộ log dạng JSONL string (dùng cho UI hiển thị) |

**Đặc điểm:**
- Mỗi event có đủ `timestamp`, `event`, `data` theo schema handoff
- Console log dùng màu khác nhau cho từng loại event (xanh, tím, vàng, đỏ...)
- Download qua `Blob` + `URL.createObjectURL` — không cần server

---

### `src/utils/pricing.ts` — Tạo mới

Bảng giá tách riêng, **không hard-code vào UI** theo yêu cầu handoff.

**Hàm:**

| Hàm | Mô tả |
|---|---|
| `getPricingConfig(provider, model)` | Tra bảng giá theo `provider` + `model`, trả `null` nếu không tìm thấy |
| `calculateEstimatedCost(promptTokens, completionTokens, pricingConfig, toolUseTokens?)` | Tính `estimated_cost_usd` theo công thức: `(tokens / 1_000_000) * price_per_1m` |
| `formatCost(costUsd)` | Format thành chuỗi `$0.000123` |

**Bảng giá hiện có:**

| Provider | Model | Input ($/1M) | Output ($/1M) |
|---|---|---:|---:|
| google | gemini-2.5-flash | $0.075 | $0.30 |
| google | gemini-2.0-flash | $0.075 | $0.30 |
| google | gemini-1.5-pro | $3.50 | $10.50 |
| openai | gpt-4o | $5.00 | $15.00 |
| anthropic | claude-3-sonnet | $3.00 | $15.00 |

---

### `src/utils/metrics.ts` — Tạo mới

Bóc tách usage từ Gemini response và ghi event telemetry.

**Hàm:**

| Hàm | Mô tả |
|---|---|
| `extractUsageMetrics(response)` | Bóc tách `prompt_tokens`, `completion_tokens`, `tool_use_prompt_tokens`, `total_tokens` từ `response.usageMetadata` |
| `measureLatency(startMs, endMs?)` | Tính `latency_ms = endMs - startMs` |
| `recordLlmMetric(label, step, response, latencyMs, provider, model, requestIndex?)` | Gọi `extractUsageMetrics` + `calculateEstimatedCost` + ghi event `LLM_METRIC` |
| `recordReasoningStep(step, rawContent, thoughtPreview?, actionName?)` | Ghi event `AGENT_REASONING_STEP` |
| `recordToolCall(step, toolName, args)` | Ghi event `TOOL_CALL` |
| `recordToolResult(step, toolName, success, durationMs, resultPreview)` | Ghi event `TOOL_RESULT` |

**Event `LLM_METRIC` đầy đủ field theo handoff:**
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
    "tool_use_prompt_tokens": 0,
    "total_tokens": 168,
    "latency_ms": 796,
    "estimated_cost_usd": 0.000012,
    "request_index": 1,
    "finish_reason": "STOP",
    "function_call_count": 0,
    "has_grounding_sources": false
  }
}
```

---

### `src/utils/comparison.ts` — Tạo mới

Tổng hợp số liệu và tạo bảng so sánh cuối.

**Hàm:**

| Hàm | Mô tả |
|---|---|
| `finalizeRunSummary(session)` | Tổng hợp tất cả `LLM_METRIC` events → 1 `RunSummary` object |
| `buildComparisonSummary(chatbotSummary, agentSummary)` | Tạo `ComparisonSummary` gồm cả 2 run + `diff` |
| `exportComparisonMarkdown(summary)` | Render bảng Markdown 4 cột (Metric / Chatbot / Agent / Ghi chú) |
| `exportComparisonJson(summary)` | Serialize JSON đầy đủ |
| `downloadComparisonMd(summary)` | Download file `compare_<timestamp>.md` |
| `downloadComparisonJson(summary)` | Download file `compare_<timestamp>.json` |

**`RunSummary` gồm các field:**
- `total_tokens`, `prompt_tokens`, `completion_tokens`
- `total_cost_usd`, `avg_latency_ms`, `total_duration_ms`
- `loop_count`, `tool_call_count`, `error_count`, `llm_call_count`

**Bảng so sánh xuất ra:**
```
| Metric              | Chatbot   | Agent     | Ghi chú                    |
|---------------------|----------:|----------:|----------------------------|
| Total Tokens        | 168       | 1,245     | Agent dùng 7.41x tokens    |
| Total Cost (USD)    | $0.000012 | $0.000089 | Agent tốn 7.41x chi phí    |
| Avg Latency (ms)    | 796       | 2,341     | +1545ms                    |
| Loop Count          | 0         | 3         | +3 loops                   |
| Tool Call Count     | 0         | 4         | +4 tools                   |
```

---

### `src/services/gemini.ts` — Sửa

**Hàm đã thêm:**

| Hàm | Mô tả |
|---|---|
| `resetStepCounter()` | Reset bộ đếm step về 0 trước mỗi session |
| `getStepCount()` | Lấy số step hiện tại |

**Hàm đã thay đổi:**

| Hàm | Thay đổi |
|---|---|
| `chatWithTravelAgent(messages, mode?, retryCount?)` | Thêm tham số `mode: 'chatbot' \| 'agent'` — chatbot không truyền tools, agent truyền đủ tools. Gọi `recordLlmMetric(...)` sau mỗi response. Gọi `recordReasoningStep(...)` nếu là agent. |
| `handleToolCalls(response)` | Thêm `recordToolCall(...)` trước khi chạy tool. Thêm `recordToolResult(...)` sau khi tool hoàn thành. Xử lý `unknown tool` thành `success=false`. |

**Thêm 2 system instruction riêng biệt:**
- `AGENT_SYSTEM_INSTRUCTION` — buộc gọi tools
- `CHATBOT_SYSTEM_INSTRUCTION` — không gọi tool, trả lời trực tiếp

**Hằng số mới:**
```ts
export const PROVIDER = 'google';
export const MODEL    = 'gemini-2.5-flash';
```

---

### `src/App.tsx` — Sửa

**State mới:**

| State | Kiểu | Mô tả |
|---|---|---|
| `mode` | `'agent' \| 'chatbot'` | Mode hiện tại |
| `showPanel` | `boolean` | Hiện/ẩn Telemetry panel |
| `panelTab` | `'log' \| 'compare'` | Tab đang hiện trong panel |
| `chatbotSummary` | `RunSummary \| null` | Kết quả sau khi chạy chatbot |
| `agentSummary` | `RunSummary \| null` | Kết quả sau khi chạy agent |
| `comparison` | `ComparisonSummary \| null` | Tự động build khi có đủ 2 summary |
| `liveLog` | `string` | JSONL hiện tại để hiển thị trong panel |

**Logic mới trong `handleSend()`:**
- Gọi `resetStepCounter()` trước mỗi request
- Gọi `startSessionLog(mode, userMessage, PROVIDER, MODEL)`
- Chatbot mode: không dùng tool loop
- Agent mode: giữ nguyên ReAct loop
- Sau khi hoàn thành: gọi `endSession(...)`, `finalizeRunSummary(...)`, cập nhật `chatbotSummary` hoặc `agentSummary`
- Khi catch error: gọi `logError(...)`

**Component mới:**
- `<CompareRow>` — 1 dòng trong bảng so sánh
- `<SummaryCard>` — Card tóm tắt 1 run (hiện khi chưa có đủ 2 run để compare)

---

## Quy trình so sánh chuẩn (theo handoff)

```
1. Bật Telemetry panel (nút "Telemetry" trên header)
2. Chọn Chatbot mode → gửi câu hỏi (VD: "Kế hoạch Đà Nẵng 3 ngày")
3. Chuyển sang Agent mode → gửi CÙNG câu hỏi đó
4. Mở tab "So sanh" → bảng tự động hiện
5. Download .md / .json để nộp báo cáo
```

---

## Event schema đầy đủ

```
CHATBOT_START / AGENT_START
LLM_METRIC             ← event quan trọng nhất
AGENT_REASONING_STEP   ← chỉ agent
TOOL_CALL              ← chỉ agent
TOOL_RESULT            ← chỉ agent
CHATBOT_END / AGENT_SUCCESS
ERROR
```

Mỗi event đều có: `timestamp`, `event`, `data`.

---

## Checklist nghiệm thu (theo handoff)

- [x] Có raw log theo kiểu JSONL
- [x] Có event `LLM_METRIC`
- [x] Có tổng hợp Chatbot vs Agent
- [x] Có tính `estimated_cost_usd`
- [x] Có `latency_ms` cho từng model call
- [x] Có `loop_count` và `tool_call_count` cho agent
- [x] Có `error_count`
- [x] Có thể dùng log để chỉ ra 1 failed trace cụ thể
