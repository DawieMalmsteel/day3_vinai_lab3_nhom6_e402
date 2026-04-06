# HANDOFF: Telemetry, Log, Cost/Fee Comparison

## Muc tieu

Tai lieu nay chi tap trung vao phan can lam de:
- ghi `structured logs`
- tinh `token`, `cost/fee`, `latency`, `loop count`
- tao bang so sanh `Chatbot` vs `Agent`

Tai lieu nay khong bao gom code trien khai. Day la handoff quy trinh va danh sach ham can co.

## Dau ra can dat

Can co 2 dau ra chinh:

### 1. Raw log theo kieu JSON line

Muc tieu:
- giong kieu log trong anh `c0ef8d34-2fb5-49c4-b88f-ad0cbec59193.jpg`
- moi dong la 1 event JSON doc lap
- de doc tay, grep, parse script, va tong hop bao cao

Dang file de xuat:
- `logs/session_<timestamp>.log`
- `logs/session_<timestamp>.jsonl`

### 2. Bang tong hop so sanh Chatbot vs Agent

Muc tieu:
- tao bang so sanh de dua vao bao cao/cuoi buoi demo
- noi dung giong dashboard so sanh trong bo anh tren lop

Dang file de xuat:
- `logs/compare_<timestamp>.json`
- `logs/compare_<timestamp>.md`

## Hien trang repo

Hien tai code da co:
- vong lap agent trong `src/App.tsx`
- tool loop qua `chatWithTravelAgent(...)` va `handleToolCalls(...)`
- `cycleCount` trong UI flow
- `debug.log(...)` o console

Hien tai code chua co du:
- structured log luu thanh file
- tach rieng `chatbot baseline`
- log `LLM_METRIC` theo tung lan goi model
- tinh `estimated cost`
- bang tong hop `Chatbot` vs `Agent`

## Nguyen tac do de so sanh cong bang

Khi lam bang so sanh, can giu dung 4 nguyen tac:

1. Dung cung mot user query cho ca `chatbot` va `agent`.
2. Neu muc tieu la so sanh kien truc, dung cung `provider` va cung `model`.
3. `Chatbot` phai la mode khong goi tool loop. Khong dung `hybrid fallback` de thay the chatbot baseline.
4. `Agent` phai log day du tung step, tung tool call, va tong so lan goi model.

## Log format bat buoc

Muc tieu la log theo format:

```json
{"timestamp":"2026-04-06T04:01:35.108Z","event":"CHATBOT_START","data":{"query":"...","provider":"google","model":"gemini-2.5-flash"}}
{"timestamp":"2026-04-06T04:01:35.904Z","event":"LLM_METRIC","data":{"label":"chatbot","provider":"google","model":"gemini-2.5-flash","prompt_tokens":123,"completion_tokens":45,"total_tokens":168,"latency_ms":796,"estimated_cost_usd":0.00012}}
{"timestamp":"2026-04-06T04:01:36.447Z","event":"AGENT_REASONING_STEP","data":{"step":1,"raw_content":"Thought: ... Action: ..."}}
```

Luu y:
- moi dong la 1 JSON object
- khong log theo van ban tu do
- khong tron text debug va json tren cung 1 stream neu muon parse sau nay

## Danh sach event can co

### Event muc session

#### `CHATBOT_START`

Dung khi:
- bat dau 1 run chatbot

Field toi thieu:
- `query`
- `provider`
- `model`
- `session_id`

#### `AGENT_START`

Dung khi:
- bat dau 1 run agent

Field toi thieu:
- `query`
- `provider`
- `model`
- `session_id`

### Event muc model call

#### `LLM_METRIC`

Day la event quan trong nhat. Day cung la event ma giang vien dang muon thay trong `logs/`.

Field toi thieu:
- `label`: `chatbot` hoac `agent`
- `provider`
- `model`
- `step`
- `prompt_tokens`
- `completion_tokens`
- `tool_use_prompt_tokens`
- `total_tokens`
- `latency_ms`
- `estimated_cost_usd`

Field nen co them:
- `request_index`
- `finish_reason`
- `function_call_count`
- `has_grounding_sources`

### Event muc agent reasoning

#### `AGENT_REASONING_STEP`

Dung khi:
- agent vua tra ve 1 reasoning block hoac 1 response co y nghia cho step hien tai

Field toi thieu:
- `step`
- `raw_content`

Field nen co:
- `thought_preview`
- `action_name`

#### `TOOL_CALL`

Field toi thieu:
- `step`
- `tool_name`
- `args`

#### `TOOL_RESULT`

Field toi thieu:
- `step`
- `tool_name`
- `success`
- `duration_ms`
- `result_preview`

### Event muc ket thuc

#### `CHATBOT_END`

Field toi thieu:
- `final_answer`
- `total_duration_ms`
- `total_tokens`
- `total_cost_usd`

#### `AGENT_SUCCESS`

Field toi thieu:
- `steps`
- `final_answer`
- `total_duration_ms`
- `total_tokens`
- `total_cost_usd`
- `tool_call_count`

#### `ERROR`

Field toi thieu:
- `label`
- `step`
- `error_type`
- `message`

Loai error can phan biet:
- `JSON_PARSE_ERROR`
- `UNKNOWN_TOOL`
- `TIMEOUT`
- `RATE_LIMIT`
- `NETWORK_ERROR`
- `PROVIDER_ERROR`

## Ham can co trong handoff

Day la danh sach ham nen giao cho nguoi implement. Chi neu ten ham can doi theo codebase thi doi ten, con trach nhiem giu nguyen.

### Nhom 1: Session va logger

#### `createSessionId()`

Muc dich:
- tao id duy nhat cho 1 lan test/1 lan compare

#### `startSessionLog(label, query, provider, model)`

Muc dich:
- khoi tao metadata cho 1 run `chatbot` hoac `agent`

Ket qua mong doi:
- co `session_id`
- co thoi diem bat dau

#### `logEvent(event, data)`

Muc dich:
- ghi 1 dong JSONL theo schema thong nhat

Yeu cau:
- dung chung cho tat ca event
- khong de moi file/moi component tu log 1 kieu

#### `exportSessionLog()`

Muc dich:
- xuat raw log ra file `logs/...`

### Nhom 2: Metric va cost

#### `extractUsageMetrics(response)`

Muc dich:
- boc tach usage tu response cua provider

Field can lay:
- `promptTokenCount`
- `responseTokenCount`
- `toolUsePromptTokenCount`
- `totalTokenCount`

#### `measureLatency(startTime, endTime)`

Muc dich:
- tinh `latency_ms` cho tung lan goi model

#### `calculateEstimatedCost(usage, pricingTable)`

Muc dich:
- tinh `estimated_cost_usd`

Cong thuc de xuat:

```text
estimated_cost_usd =
  (prompt_tokens / 1_000_000) * input_price_per_1m +
  (completion_tokens / 1_000_000) * output_price_per_1m
```

Neu provider tinh them cho `tool_use_prompt_tokens` rieng:
- cong them phan token do vao cong thuc

Yeu cau:
- bang gia phai tach rieng, khong hard-code vao UI
- neu la `fee` theo cach goi cua nhom, thi `fee = estimated api cost`

#### `recordLlmMetric(label, step, response, latencyMs, pricingTable)`

Muc dich:
- goi `extractUsageMetrics(...)`
- goi `calculateEstimatedCost(...)`
- sinh event `LLM_METRIC`

### Nhom 3: Agent detail

#### `recordReasoningStep(step, rawContent)`

Muc dich:
- ghi event `AGENT_REASONING_STEP`

#### `recordToolCall(step, toolName, args)`

Muc dich:
- ghi event `TOOL_CALL`

#### `recordToolResult(step, toolName, success, durationMs, resultPreview)`

Muc dich:
- ghi event `TOOL_RESULT`

### Nhom 4: Tong hop va bang so sanh

#### `finalizeRunSummary(label, sessionLog)`

Muc dich:
- tong hop so lieu cho 1 run

Field tong hop toi thieu:
- `total_tokens`
- `total_cost_usd`
- `avg_latency_ms`
- `total_duration_ms`
- `loop_count`
- `tool_call_count`
- `error_count`

#### `buildComparisonSummary(chatbotSummary, agentSummary)`

Muc dich:
- tao bang so sanh cuoi cung

#### `exportComparisonReport(summary)`

Muc dich:
- xuat ra file Markdown hoac JSON de chen vao bao cao

## Cac chi so bat buoc trong bang so sanh

Bang tong hop can co it nhat cac dong sau:

| Metric | Chatbot | Agent |
| --- | ---: | ---: |
| Total Tokens | ... | ... |
| Prompt Tokens | ... | ... |
| Completion Tokens | ... | ... |
| Total Cost (USD) | ... | ... |
| Avg Latency (ms) | ... | ... |
| Total Duration (ms) | ... | ... |
| Loop Count | ... | ... |
| Tool Call Count | ... | ... |
| Error Count | ... | ... |

Neu test nhieu query hoac nhieu lan:
- them `Success Rate`
- them `Avg Tokens / Query`
- them `Avg Cost / Query`

## Quy trinh lam de doi khac follow

### Buoc 1: Tach 2 mode ro rang

Can co:
- 1 mode `chatbot`
- 1 mode `agent`

Muc tieu:
- tranh so sanh sai giua `agent` va `agent co luc khong goi tool`

### Buoc 2: Gan logger vao moi diem quan trong

Chatbot:
- log `CHATBOT_START`
- log `LLM_METRIC`
- log `CHATBOT_END` hoac `ERROR`

Agent:
- log `AGENT_START`
- log `LLM_METRIC` cho moi lan goi model
- log `AGENT_REASONING_STEP`
- log `TOOL_CALL`
- log `TOOL_RESULT`
- log `AGENT_SUCCESS` hoac `ERROR`

### Buoc 3: Tinh cost/fee ngay khi co usage

Khong de den cuoi moi tinh.

Ly do:
- de de debug tung request
- de biet request nao dot token nhieu
- de so sanh chatbot va agent theo tung step

### Buoc 4: Tong hop thanh summary cho tung run

Moi run phai co 1 summary rieng:
- `chatbot_summary`
- `agent_summary`

### Buoc 5: Build bang compare cuoi

Bang compare phai doc duoc ngay:
- chatbot re hon hay agent re hon
- chatbot nhanh hon hay agent cham hon
- agent ton nhieu token hon bao nhieu
- agent co them bao nhieu step va tool call

## Mapping vao code hien tai

### File `src/App.tsx`

Noi can hook telemetry:
- truoc khi bat dau request
- sau moi lan goi `chatWithTravelAgent(...)`
- trong while loop agent
- truoc va sau khi xu ly tool
- khi co final answer
- khi catch error

Metric co san de tan dung:
- `cycleCount`

### File `src/services/gemini.ts`

Noi can lay du lieu cho metric:
- response usage metadata
- function call count
- response text
- finish status neu co

Noi khong nen de UI tu tinh:
- token usage
- estimated cost
- latency cua model call

### File `src/utils/debug.ts`

Trang thai hien tai:
- chi phu hop console debug cho dev

Khong du cho bai lab:
- khong phai structured JSON log
- khong co schema on dinh
- khong co raw file de parse

## Log schema de doi khac khong lam lech

Can chot truoc 3 quy tac:

1. Tat ca event deu co:
   - `timestamp`
   - `event`
   - `data`

2. Event `LLM_METRIC` luon co:
   - `label`
   - `provider`
   - `model`
   - `prompt_tokens`
   - `completion_tokens`
   - `total_tokens`
   - `latency_ms`
   - `estimated_cost_usd`

3. Event ket thuc luon co:
   - `total_duration_ms`
   - `total_tokens`
   - `total_cost_usd`

## Checklist nghiem thu

- Co raw log theo kieu JSONL.
- Co event `LLM_METRIC` trong `logs/`.
- Co tong hop `Chatbot` vs `Agent`.
- Co tinh `estimated_cost_usd`.
- Co `latency_ms` cho tung model call.
- Co `loop_count` va `tool_call_count` cho agent.
- Co `error_count`.
- Co the dung log de chi ra 1 failed trace cu the.

## Ket luan handoff

Neu phai uu tien, thi thu tu lam nen la:

1. chot schema log
2. ghi duoc `LLM_METRIC`
3. tinh duoc `cost/fee`
4. tach `chatbot` va `agent`
5. build bang compare cuoi

Day la ban handoff de lam phan `log + cost/fee + compare`, khong phai ban handoff cho refactor toan bo provider.
