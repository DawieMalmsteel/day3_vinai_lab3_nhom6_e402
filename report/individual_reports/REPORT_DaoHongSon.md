# Individual Report: Lab 3 - Chatbot vs ReAct Agent

- **Student Name**: Dao Hong Son
- **Student ID**: 2A202600462
- **Date**: 06/04/2026

---

## I. Technical Contribution (15 Points)

My individual contribution focused on the telemetry and evaluation layer of the project. I worked on the cost comparison between Agent and Chatbot, structured logging, integration of a third-party Gemini provider, API response tracking, and a more visual frontend for reading the comparison results.

- **Modules Implemented**:
  - `src/config/apiProvider.ts`: added centralized provider selection so the app can switch between direct Google Gemini access and a third-party Gemini-compatible provider (`shopaikey`).
  - `src/utils/telemetry.ts`: implemented structured session logging for Chatbot and Agent runs.
  - `src/utils/pricing.ts`: added provider/model pricing rules for estimated API cost.
  - `src/utils/metrics.ts`: extracted token usage, measured latency, and recorded `LLM_METRIC`, `TOOL_CALL`, `TOOL_RESULT`, and reasoning-related events.
  - `src/utils/comparison.ts`: generated Chatbot vs Agent summaries and exported Markdown/JSON comparison reports.
  - `server/vite-plugin-logger.ts`: added a Vite logging plugin so browser-side telemetry can be persisted into the `logs/` folder.

- **Files I modified or added for this scope**:
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

- **Main technical results**:
  - Added a measurable comparison between `chatbot` mode and `agent` mode.
  - Logged raw execution traces into `logs/*.jsonl` and exported comparison results into `logs/*.md` and `logs/*.json`.
  - Estimated API usage cost from token counts instead of comparing the two modes only by final answer quality.
  - Added support for a third-party Gemini provider so the same application can run through another Gemini-compatible endpoint.
  - Separated the execution behavior clearly: Chatbot is a direct single-shot call, while Agent can run reasoning/tool-flow logic.

- **Frontend and visualization work**:
  - Added an `Agent/Chatbot` toggle so the user can switch mode directly from the interface.
  - Added a `Telemetry` side panel to make logs and comparison metrics easier to read without opening the console.
  - Built two UI tabs: `Raw Log (JSONL)` for real-time structured logs and `Compare` for the Agent vs Chatbot dashboard.
  - Added status badges, summary cards, and a comparison table so token usage, cost, latency, loop count, tool count, and errors can be read quickly.
  - Added download buttons for `.jsonl`, `.md`, and `.json` outputs so the comparison results can be reused in reports.
  - Added UI guidance for fair comparison and warnings when the two latest runs do not use the same prompt.

- **API response handling and observability**:
  - Added response validation to detect empty responses or cases where the agent does not call tools as expected.
  - Logged response metadata such as text length, function call count, function names, finish reason, grounding presence, token usage, and latency.
  - Displayed planning/loading states when the Agent is processing tool calls.
  - Rendered reference sources in the chat UI when the response contains grounding data.
  - Added telemetry support for local features so they still appear in the comparison dashboard with real latency and zero API cost.

- **Documentation**:
  - `TELEMETRY_CHANGES.md`: records my main code changes, added modules, frontend comparison UI, and bug fixes.
  - `HANDOFF_API_PROVIDER.md`: defines the event schema, cost fields, and required metrics for Agent vs Chatbot comparison.

---

## II. Debugging Case Study (10 Points)

- **Problem Description**: A critical bug made the Agent and Chatbot behave too similarly for some prompts, which broke the purpose of the comparison. For example, travel-planning prompts could be intercepted by the same local handlers, so the Chatbot was not always acting as a true direct-API baseline.

- **Log Source**:
  - `logs/session_chatbot_2026-04-06T14-39-52.json`
  - `logs/session_agent_2026-04-06T14-39-24.json`
  - `logs/compare_2026-04-06T14-39-52.md`

- **Diagnosis**: The main issue was in the application flow, not in Gemini itself. Local feature handlers in `src/App.tsx` were executed before the mode separation was strict enough. As a result, both modes could be routed through similar local logic. This made the Chatbot baseline unreliable. A second issue was that local features originally had no telemetry session, so some runs produced no useful comparison summary and the comparison panel could not reflect the true behavior.

- **Solution**:
  - Wrapped local feature handlers so they only run in `agent` mode.
  - Added `trackLocalFeature()` to create telemetry records even when a local feature returns early.
  - Expanded trip-planner keyword detection so prompts such as `"ke hoach di"` are handled correctly.
  - Improved error handling for invalid API keys, rate limits, network failures, and server-side errors.
  - Ensured the frontend comparison dashboard only compares equivalent runs and shows mismatched-run warnings when needed.

- **Result**: After the fixes, the comparison became much more trustworthy. Chatbot could remain a direct-response baseline, while Agent kept its own execution path. The logs and frontend dashboard then showed real metrics such as token usage, latency, cost, loop count, tool count, and errors instead of mixing two different behaviors under the same label.

---

## III. Personal Insights: Chatbot vs ReAct (10 Points)

1. **Reasoning**: The biggest advantage of the Agent is not only the final answer, but the visibility of its process. With telemetry, I can inspect each reasoning step, tool call, tool result, and response metric. That makes the Agent easier to analyze when something goes wrong.

2. **Reliability**: The Agent is not automatically better than the Chatbot. For simple prompts, the Chatbot is usually simpler and more predictable. The Agent introduces more moving parts, so it can become slower or harder to debug if the tool loop is not actually needed.

3. **Observation**: Environment feedback matters only when it changes the next decision. If the Agent gets useful tool output, the next step can become more grounded. If no useful observation exists, the extra reasoning path may only add overhead.

4. **Cost and Performance Insight**: One important lesson from this task is that assumptions are not enough. The Agent is often expected to be more expensive, but real logs are necessary because cost, latency, token usage, and even response behavior can vary by prompt. That is why I added raw logs, API response metrics, and a visual comparison report instead of relying on manual judgment.

---

## IV. Future Improvements (5 Points)

- **Scalability**: Store telemetry in a proper backend or database instead of only writing local log files in dev mode.
- **Safety**: Add stronger guardrails for loop count, tool validation, and fallback behavior when the Agent keeps reasoning without useful observations.
- **Performance**: Add caching and batch evaluation so repeated Agent vs Chatbot comparisons can be executed faster.
- **Evaluation**: Build a fixed benchmark set of prompts and automatically compare total tokens, total cost, latency, response quality, and success rate across multiple runs.
