/**
 * Comparison — Tổng hợp & so sánh Chatbot vs Agent
 *
 * Tạo bảng so sánh giống dashboard trong ảnh trên lớp.
 */

import type { SessionLog, LogEvent } from './telemetry';

// ────────────────────────────── Types ──────────────────────────────

export interface RunSummary {
  label: 'chatbot' | 'agent';
  session_id: string;
  query: string;
  provider: string;
  model: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  total_duration_ms: number;
  loop_count: number;
  tool_call_count: number;
  error_count: number;
  llm_call_count: number;
}

export interface ComparisonSummary {
  query: string;
  provider: string;
  model: string;
  chatbot: RunSummary;
  agent: RunSummary;
  diff: {
    token_ratio: string;       // e.g. "Agent dùng 3.2x tokens"
    cost_ratio: string;        // e.g. "Agent tốn 3.2x chi phí"
    latency_diff_ms: number;   // agent - chatbot
    extra_tool_calls: number;
    extra_loops: number;
  };
  generated_at: string;
}

// ────────────────────────────── Finalize Run Summary ───────────────

export function finalizeRunSummary(session: SessionLog): RunSummary {
  const llmMetrics = session.events.filter(e => e.event === 'LLM_METRIC');
  const toolCalls  = session.events.filter(e => e.event === 'TOOL_CALL');
  const errors     = session.events.filter(e => e.event === 'ERROR');

  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalCost = 0;
  let totalLatency = 0;

  for (const m of llmMetrics) {
    totalTokens      += m.data.total_tokens      ?? 0;
    promptTokens     += m.data.prompt_tokens      ?? 0;
    completionTokens += m.data.completion_tokens  ?? 0;
    totalCost        += m.data.estimated_cost_usd ?? 0;
    totalLatency     += m.data.latency_ms         ?? 0;
  }

  const avgLatency = llmMetrics.length > 0
    ? Math.round(totalLatency / llmMetrics.length)
    : 0;

  // Total duration = khoảng cách giữa event đầu và event cuối
  const firstTs = session.events[0]
    ? new Date(session.events[0].timestamp).getTime()
    : session.start_time;
  const lastTs = session.events[session.events.length - 1]
    ? new Date(session.events[session.events.length - 1].timestamp).getTime()
    : Date.now();
  const totalDuration = lastTs - firstTs;

  // Loop count = số lần model được gọi lại (= llmMetrics.length - 1 cho agent, 0 cho chatbot)
  const loopCount = session.label === 'agent'
    ? Math.max(0, llmMetrics.length - 1)
    : 0;

  return {
    label: session.label as 'chatbot' | 'agent',
    session_id: session.session_id,
    query: session.query,
    provider: session.provider,
    model: session.model,
    total_tokens: totalTokens,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_cost_usd: parseFloat(totalCost.toFixed(8)),
    avg_latency_ms: avgLatency,
    total_duration_ms: totalDuration,
    loop_count: loopCount,
    tool_call_count: toolCalls.length,
    error_count: errors.length,
    llm_call_count: llmMetrics.length,
  };
}

// ────────────────────────────── Build Comparison ──────────────────

export function buildComparisonSummary(
  chatbotSummary: RunSummary,
  agentSummary: RunSummary,
): ComparisonSummary {
  const tokenRatio = chatbotSummary.total_tokens > 0
    ? (agentSummary.total_tokens / chatbotSummary.total_tokens).toFixed(2)
    : 'N/A';

  const costRatio = chatbotSummary.total_cost_usd > 0
    ? (agentSummary.total_cost_usd / chatbotSummary.total_cost_usd).toFixed(2)
    : 'N/A';

  return {
    query: chatbotSummary.query,
    provider: chatbotSummary.provider,
    model: chatbotSummary.model,
    chatbot: chatbotSummary,
    agent: agentSummary,
    diff: {
      token_ratio: `Agent dùng ${tokenRatio}x tokens`,
      cost_ratio: `Agent tốn ${costRatio}x chi phí`,
      latency_diff_ms: agentSummary.avg_latency_ms - chatbotSummary.avg_latency_ms,
      extra_tool_calls: agentSummary.tool_call_count - chatbotSummary.tool_call_count,
      extra_loops: agentSummary.loop_count - chatbotSummary.loop_count,
    },
    generated_at: new Date().toISOString(),
  };
}

// ────────────────────────────── Export Markdown ────────────────────

export function exportComparisonMarkdown(summary: ComparisonSummary): string {
  const c = summary.chatbot;
  const a = summary.agent;

  const md = `# So sánh Chatbot vs Agent

> **Query:** ${summary.query}
> **Provider:** ${summary.provider} | **Model:** ${summary.model}
> **Generated:** ${summary.generated_at}

| Metric | Chatbot | Agent | Ghi chú |
|---|---:|---:|---|
| **Total Tokens** | ${c.total_tokens.toLocaleString()} | ${a.total_tokens.toLocaleString()} | ${summary.diff.token_ratio} |
| Prompt Tokens | ${c.prompt_tokens.toLocaleString()} | ${a.prompt_tokens.toLocaleString()} | |
| Completion Tokens | ${c.completion_tokens.toLocaleString()} | ${a.completion_tokens.toLocaleString()} | |
| **Total Cost (USD)** | $${c.total_cost_usd.toFixed(6)} | $${a.total_cost_usd.toFixed(6)} | ${summary.diff.cost_ratio} |
| **Avg Latency (ms)** | ${c.avg_latency_ms.toLocaleString()} | ${a.avg_latency_ms.toLocaleString()} | ${summary.diff.latency_diff_ms > 0 ? '+' : ''}${summary.diff.latency_diff_ms}ms |
| Total Duration (ms) | ${c.total_duration_ms.toLocaleString()} | ${a.total_duration_ms.toLocaleString()} | |
| LLM Calls | ${c.llm_call_count} | ${a.llm_call_count} | |
| **Loop Count** | ${c.loop_count} | ${a.loop_count} | +${summary.diff.extra_loops} loops |
| **Tool Call Count** | ${c.tool_call_count} | ${a.tool_call_count} | +${summary.diff.extra_tool_calls} tools |
| Error Count | ${c.error_count} | ${a.error_count} | |

## Nhận xét

- ${a.total_cost_usd > c.total_cost_usd ? 'Agent tốn chi phí cao hơn' : 'Chatbot tốn chi phí cao hơn'} (${summary.diff.cost_ratio})
- ${a.avg_latency_ms > c.avg_latency_ms ? 'Agent chậm hơn' : 'Chatbot chậm hơn'} trung bình ${Math.abs(summary.diff.latency_diff_ms)}ms mỗi lần gọi
- Agent sử dụng thêm ${summary.diff.extra_tool_calls} tool calls qua ${summary.diff.extra_loops} vòng lặp
`;

  return md;
}

// ────────────────────────────── Export JSON ────────────────────────

export function exportComparisonJson(summary: ComparisonSummary): string {
  return JSON.stringify(summary, null, 2);
}

// ────────────────────────────── Download helpers ──────────────────

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadComparisonMd(summary: ComparisonSummary): void {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  downloadBlob(
    exportComparisonMarkdown(summary),
    `compare_${ts}.md`,
    'text/markdown',
  );
}

export function downloadComparisonJson(summary: ComparisonSummary): void {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  downloadBlob(
    exportComparisonJson(summary),
    `compare_${ts}.json`,
    'application/json',
  );
}
