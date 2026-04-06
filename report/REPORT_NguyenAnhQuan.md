# Individual Report: Lab 3 - Chatbot vs ReAct Agent
- **Group Name**: E402 - Group 6
- **Student Name**: Nguyễn Anh Quân
- **Student ID**: 2A202600132
- **Date**: 2026-04-06

---

## I. Technical Contribution (15 Points)

My assigned scope was: flowchart design, system prompt optimization, user-input filtering, and writing the group report.

- **Modules Implementated**:
  - `src/services/gemini.ts` (system prompt refinement)
  - `src/services/contentFilter.ts` (topic/input filtering)
  - Architecture flow documentation (flowchart for request processing)
  - `TEMPLATE_GROUP_REPORT.md` (drafted and completed the technical group report content)

- **Code Highlights**:
  - Designed a processing flowchart that maps the request path: input -> topic filter -> in-scope handling -> ReAct/tool loop -> final response.
  - Optimized `DEFAULT_SYSTEM_INSTRUCTION` in `gemini.ts`:
    - Added warm greeting behavior.
    - Clarified 4 supported domains (flight, bus, hotel, travel guide).
    - Added concise response rules and follow-up requirement.
    - Improved out-of-scope redirection tone.
  - Implemented/strengthened user-input filtering in `contentFilter.ts`:
    - Allowed-topic signals + travel-intent signals.
    - Blocked-topic detection.
    - Friendly fallback response via `getOutOfScopeMessage()`.

- **Documentation**:
  - Drew the FlowChart for the chatbot-agent pipeline, including key nodes: user input, topic filter, in-scope/out-of-scope branch, ReAct/tool execution, and final response.
  - Message lifecycle aligned with my contribution:
    1. Validate topic (`isValidTopic` guardrail).
    2. If out-of-scope -> return polite filtered response.
    3. If in-scope -> apply optimized system prompt + ReAct orchestration/tool calls.
    4. Return concise Vietnamese markdown response with next-step question.
  - Authored the group-level technical summary in `TEMPLATE_GROUP_REPORT.md`, including architecture, tool inventory, RCA, ablation, and production-readiness sections.

---

## II. Debugging Case Study (10 Points)

### Case: Inconsistent Tone and Scope Handling

- **Problem Description**:
  - Early versions often produced cold/rigid first responses and inconsistent out-of-scope handling, hurting UX consistency.

- **Log Source**:
  - `debug.log('FILTER', 'Greeting detected and accepted')`
  - `debug.warn('FILTER', 'Blocked topic detected: ...')`
  - `debug.log('FILTER', 'Travel signal detected and accepted', ...)`
  - These logs were used to verify acceptance/rejection paths after filter tuning.

- **Diagnosis**:
  - Root causes:
    - System prompt lacked explicit greeting and refusal style constraints.
    - Filter thresholds/signals were not explicit enough, causing ambiguous acceptance/rejection behavior on mixed queries.

- **Solution**:
  - Refined system prompt structure (greeting, strict scope, out-of-scope template, concise format rules).
  - Added/adjusted keyword signal logic in `isValidTopic()` (allowed + intent + blocked categories).
  - Standardized fallback message through `getOutOfScopeMessage()` to keep tone polite and helpful.
  - Verified behavior against scenario-based tests in `TEST_REPORT.md`.

---

## III. Personal Insights: Chatbot vs ReAct (10 Points)

*Reflect on the reasoning capability difference.*

1. **Reasoning**:
Flowchart-first thinking helped clarify where reasoning belongs: guardrails before model, tool actions after intent confirmation, and response synthesis at the end.

2. **Reliability**:
ReAct can still perform worse than direct chatbot if input is weak/ambiguous and filters are too permissive. In those cases, the model may proceed with low-confidence assumptions.

3. **Observation**:
Observation logs from the filter layer are critical: they immediately show whether a query is accepted as travel intent or blocked as out-of-scope, which strongly affects downstream answer quality.

---

## IV. Future Improvements (5 Points)

*How would you scale this for a production-level AI agent system?*

- **Scalability**:
  - Externalize filter config (keywords/rules) into versioned JSON for easier tuning without code edits.
  - Keep the flowchart updated as system complexity grows (new tools/new branches).

- **Safety**:
  - Add confidence thresholds and explicit clarification prompts when filter signals conflict (both travel and blocked topics).
  - Add audit logging for rejected queries to improve policy iteration.

- **Performance**:
  - Track filter hit-rate, false-accept, false-reject metrics.
  - Add prompt/version A/B testing pipeline to quantify tone and task-completion improvements.

---

> [!NOTE]
> Submit this report by renaming it to `REPORT_[YOUR_NAME].md` and placing it in this folder.
