/**
 * Metrics — Bóc tách usage từ Gemini response, tính cost, ghi LLM_METRIC
 */

import type { GenerateContentResponse } from '@google/genai';
import { logEvent } from './telemetry';
import { calculateEstimatedCost, getPricingConfig, type PricingConfig } from './pricing';

// ────────────────────────────── Types ──────────────────────────────

export interface UsageMetrics {
  prompt_tokens: number;
  completion_tokens: number;       // output tokens KHÔNG bao gồm thinking
  thinking_tokens: number;          // thinking tokens (Gemini 2.5 tính giá riêng)
  tool_use_prompt_tokens: number;
  total_tokens: number;
}

export interface LlmMetricData {
  label: 'chatbot' | 'agent';
  provider: string;
  model: string;
  step: number;
  prompt_tokens: number;
  completion_tokens: number;
  thinking_tokens: number;
  tool_use_prompt_tokens: number;
  total_tokens: number;
  latency_ms: number;
  estimated_cost_usd: number;
  cost_breakdown: {
    input_cost: number;
    output_cost: number;
    thinking_cost: number;
  };
  request_index?: number;
  finish_reason?: string;
  function_call_count: number;
  has_grounding_sources: boolean;
}

// ────────────────────────────── Extract usage ─────────────────────

/**
 * Bóc tách token usage từ Gemini GenerateContentResponse.
 *
 * Gemini 2.5 Flash trả về:
 *   - promptTokenCount      → input tokens
 *   - candidatesTokenCount  → tổng output (bao gồm cả thinking)
 *   - thoughtsTokenCount    → thinking tokens (tính giá riêng ~$3.50/1M)
 *   - totalTokenCount       → tổng tất cả
 *
 * Để tính cost đúng:
 *   completion_tokens = candidatesTokenCount - thoughtsTokenCount
 *   thinking_tokens   = thoughtsTokenCount
 */
export function extractUsageMetrics(response: GenerateContentResponse): UsageMetrics {
  const usage = (response as any).usageMetadata ?? {};

  const prompt_tokens: number =
    usage.promptTokenCount ?? usage.prompt_token_count ?? 0;

  // Tổng output tokens (bao gồm thinking nếu có)
  const raw_output: number =
    usage.candidatesTokenCount ?? usage.candidates_token_count ?? usage.responseTokenCount ?? 0;

  // Thinking tokens — Gemini 2.5 Flash trả riêng field này
  const thinking_tokens: number =
    usage.thoughtsTokenCount ?? usage.thoughts_token_count ?? 0;

  // Output tokens thuần (trừ thinking) — để tính cost đúng rate
  const completion_tokens: number = Math.max(0, raw_output - thinking_tokens);

  const tool_use_prompt_tokens: number =
    usage.toolUsePromptTokenCount ?? usage.tool_use_prompt_token_count ?? 0;

  const total_tokens: number =
    usage.totalTokenCount ?? usage.total_token_count ?? (prompt_tokens + raw_output);

  return { prompt_tokens, completion_tokens, thinking_tokens, tool_use_prompt_tokens, total_tokens };
}

// ────────────────────────────── Latency ───────────────────────────

export function measureLatency(startMs: number, endMs: number = Date.now()): number {
  return endMs - startMs;
}

// ────────────────────────────── Record LLM_METRIC ─────────────────

/**
 * Ghi 1 event LLM_METRIC hoàn chỉnh.
 * Đây là event quan trọng nhất — giảng viên muốn thấy trong logs/.
 */
export function recordLlmMetric(
  label: 'chatbot' | 'agent',
  step: number,
  response: GenerateContentResponse,
  latencyMs: number,
  provider: string,
  model: string,
  requestIndex?: number,
): LlmMetricData {
  const usage = extractUsageMetrics(response);

  // Tính cost
  const pricing: PricingConfig | null = getPricingConfig(provider, model);

  let estimated_cost_usd = 0;
  let cost_breakdown = { input_cost: 0, output_cost: 0, thinking_cost: 0 };

  if (pricing) {
    estimated_cost_usd = calculateEstimatedCost(
      usage.prompt_tokens,
      usage.completion_tokens,
      pricing,
      usage.thinking_tokens,
      usage.tool_use_prompt_tokens,
    );

    // Breakdown cho debug
    cost_breakdown = {
      input_cost: parseFloat(((usage.prompt_tokens / 1_000_000) * pricing.inputPricePer1M).toFixed(8)),
      output_cost: parseFloat(((usage.completion_tokens / 1_000_000) * pricing.outputPricePer1M).toFixed(8)),
      thinking_cost: pricing.thinkingPricePer1M
        ? parseFloat(((usage.thinking_tokens / 1_000_000) * pricing.thinkingPricePer1M).toFixed(8))
        : 0,
    };
  } else {
    console.warn(
      `[metrics] Không tìm thấy bảng giá cho provider="${provider}", model="${model}". ` +
      `Cost sẽ = $0. Hãy kiểm tra pricing.ts và apiProvider.ts.`
    );
  }

  // Finish reason
  const finishReason = (response as any).candidates?.[0]?.finishReason ?? '';

  // Function call count
  const functionCallCount = response.functionCalls?.length ?? 0;

  // Grounding
  const hasGroundingSources =
    !!(response as any).candidates?.[0]?.groundingMetadata?.groundingChunks?.length;

  const metric: LlmMetricData = {
    label,
    provider,
    model,
    step,
    ...usage,
    latency_ms: latencyMs,
    estimated_cost_usd,
    cost_breakdown,
    request_index: requestIndex,
    finish_reason: finishReason,
    function_call_count: functionCallCount,
    has_grounding_sources: hasGroundingSources,
  };

  logEvent('LLM_METRIC', metric as any);

  return metric;
}

// ────────────────────────────── Agent detail events ────────────────

export function recordReasoningStep(
  step: number,
  rawContent: string,
  thoughtPreview?: string,
  actionName?: string,
): void {
  logEvent('AGENT_REASONING_STEP', {
    step,
    raw_content: rawContent.slice(0, 500),
    thought_preview: thoughtPreview?.slice(0, 150),
    action_name: actionName,
  });
}

export function recordToolCall(
  step: number,
  toolName: string,
  args: Record<string, any>,
): void {
  logEvent('TOOL_CALL', { step, tool_name: toolName, args });
}

export function recordToolResult(
  step: number,
  toolName: string,
  success: boolean,
  durationMs: number,
  resultPreview: string,
): void {
  logEvent('TOOL_RESULT', {
    step,
    tool_name: toolName,
    success,
    duration_ms: durationMs,
    result_preview: resultPreview.slice(0, 300),
  });
}
