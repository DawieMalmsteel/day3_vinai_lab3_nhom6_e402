# Group Report: Lab 3 - Production-Grade Agentic System

- **Team Name**: E402 - Group 6
- **Team Members**:   
  - 2A202600313 Trần Thượng Trường Sơn
  - 2A202600462 Đào Hồng Sơn
  - 2A202600254 Phạm Đăng Phong
  - 2A202600277 Phan Dương Định
  - 2A202600417 Phạm Minh Khang
  - 2A202600132 Nguyễn Anh Quân
- **Deployment Date**: 2026-04-06

---

## 1. Executive Summary

The project implements a travel-focused agentic chatbot (Vietnamese-first) using a lightweight ReAct controller loop on top of Gemini. The agent handles 4 in-scope domains: flights, buses, hotels, and travel guides. Compared to a baseline prompt-only chatbot, this version can call internal tools (`search_flights`, `search_hotels`) and synthesize responses from tool observations.

- **Success Rate**: 8/8 test scenarios passed in `TEST_REPORT.md` (prompt logic verification suite; greeting/in-scope/out-of-scope patterns).
- **Key Outcome**: The agent now uses explicit tool actions for flight/hotel retrieval and appends direct flight information links to final responses, reducing pure hallucinated answers in booking-like queries.

---

## 2. System Architecture & Tooling

### 2.1 ReAct Loop Implementation
Implemented in `src/App.tsx` with a controller prompt (`REACT_CONTROLLER_SYSTEM`) and max 3 loops:

1. Build controller context:
   - `USER_QUERY`
   - last conversation messages
   - prior tool `OBSERVATIONS`
2. Call LLM controller (`chatWithTravelAgent(..., system=REACT_CONTROLLER_SYSTEM)`) to output strict JSON action.
3. Execute action:
   - `search_flights` -> local flight tool (`searchFlightsTool`)
   - `search_hotels` -> local hotel tool (`searchHotelsTool`)
   - `finish` -> stop loop
4. Append observation text and continue loop until `finish` or max iterations.
5. Final synthesis:
   - If controller returned `finish.final`, return directly.
   - Otherwise call `chatWithTravelAgent` once more with tool observations.
6. Post-processing:
   - If flight tool results exist, append a markdown section with direct flight links.

Notes on hybrid behavior:
- The system is agentic for flight/hotel tool calls but still contains a deterministic hotel A/B/C workflow branch (`asking_type`) before entering full ReAct flow.

### 2.2 Tool Definitions (Inventory)
| Tool Name | Input Format | Use Case |
| :--- | :--- | :--- |
| `search_flights` | `json` (`originCity`, `destinationCity`, `departureDate?`, `passengers`) | Query predefined flight schedules and build booking/info links. |
| `search_hotels` | `json` (`city`, `guests?`, `budget?`, `locationPreference?`, `checkinDate?`, `checkoutDate?`) | Search simulated hotel inventory and return ranked options. |
| `query_knowledge_base` | `string` (`location`, `query`) | Load local travel guide markdown from `/public/data/guides/*.md` and inject into context. |
| `fetch_web_content` | `string` (`url`) | Fetch and clean webpage content through `api.allorigins.win` proxy (available utility; not central in current ReAct loop). |
| `isValidTopic` | `string` (`message`) | Guardrail filter to restrict chatbot to travel scope and reject blocked topics. |

### 2.3 LLM Providers Used
- **Primary**: Google GenAI via `@google/genai`, model string currently set to `gemini-2.5-flash` in `src/services/gemini.ts`.
- **Secondary (Backup)**: None implemented in runtime code path (retry/backoff exists, but same provider/model stack).

---

## 3. Telemetry & Performance Dashboard

Current codebase does not yet have a persisted telemetry dashboard for latency/tokens/cost. Logging is available through `src/utils/debug.ts`, and TypeScript linting is used as the quality gate.

- **Average Latency (P50)**: N/A (not instrumented as numeric metric).
- **Max Latency (P99)**: N/A (not instrumented as numeric metric).
- **Average Tokens per Task**: N/A (token accounting not exposed in current logs).
- **Total Cost of Test Suite**: N/A (cost tracker not implemented).

Observed operational notes from test artifacts:
- `npm run lint` passes (`tsc --noEmit`).
- Gemini free-tier quota can be exhausted during repeated tests; exponential backoff is implemented for 429/5xx.

---

## 4. Root Cause Analysis (RCA) - Failure Traces

Even after removing the rigid flight Q&A loop, there are still deterministic response paths that can bypass the full agent loop and appear as "instant canned responses."

### Case Study: Hardcoded Hotel Menu Response
- **Input**: "Tìm khách sạn tại Phú Quốc"
- **Observation**: App immediately returns a fixed template:
  `Bạn muốn tìm khách sạn ở ... Chọn cách tìm kiếm: A) Nhanh B) Thông minh C) Chi tiết`
  before entering the ReAct loop.
- **Root Cause**: `detectHotelSearch` + `hotelState.step === 'asking_type'` branch in `App.tsx` short-circuits to static flow.
- **Impact**: User perceives non-agentic behavior; response consistency differs between hotel and flight/travel-guide intents.

### Case Study: Limited Route Coverage in Flight Tool
- **Input**: Flight query for route not present in mock `FLIGHT_SCHEDULES`.
- **Observation**: Tool returns empty options; final response quality depends more on LLM synthesis.
- **Root Cause**: `search_flights` relies on predefined local route data rather than real-time flight API.
- **Impact**: Good determinism for supported routes, degraded usefulness for unsupported routes.

---

## 5. Ablation Studies & Experiments

### Experiment 1: Prompt v1 vs Prompt v2
- **Diff**:
  - Added dedicated warm greeting section.
  - Added explicit bus support in scope.
  - Improved out-of-scope refusal tone and examples.
  - Enforced concise markdown + follow-up question structure.
- **Result**: In `TEST_REPORT.md`, all 8 expected behavior scenarios passed at prompt-logic level, with better greeting and rejection quality than earlier prompt style.

### Experiment 2 (Bonus): Chatbot vs Agent
| Case | Chatbot Result | Agent Result | Winner |
| :--- | :--- | :--- | :--- |
| Greeting / Scope Q | Correct but generic | Correct + structured by system prompt | Agent |
| Flight route with known tool data | Model-only answer may vary | Tool-backed options + appended direct links | **Agent** |
| Hotel request | Generic recommendations | Fast deterministic A/B/C flow (less flexible) | Draw |
| Out-of-scope query | Inconsistent refusal style | Guardrailed polite refusal + redirection | **Agent** |

---

## 6. Production Readiness Review

*Considerations for taking this system to a real-world environment.*

- **Security**:
  - Keep `GEMINI_API_KEY` in environment only.
  - Validate/sanitize tool args before execution (city/date/passenger coercion already partially implemented).
  - Add URL allowlist if `fetch_web_content` is exposed broadly.
- **Guardrails**:
  - ReAct loop capped at 3 steps to prevent runaway cost.
  - Topic guardrail (`isValidTopic`) blocks non-travel categories.
  - Retry policy with exponential backoff for 429/5xx.
- **Scaling**:
  - Replace mock flight/hotel datasets with provider APIs.
  - Unify remaining hardcoded hotel branch into full ReAct to avoid behavior split.
  - Add real telemetry pipeline (latency, token usage, cost, tool success rate).
  - Add e2e regression tests for deterministic flows and markdown link validity.

---

> [!NOTE]
> Submit this report by renaming it to `GROUP_REPORT_[TEAM_NAME].md` and placing it in this folder.
