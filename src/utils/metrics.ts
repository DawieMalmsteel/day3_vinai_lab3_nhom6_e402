/**
 * Metrics — Bóc tách usage từ Gemini response, tính cost, ghi LLM_METRIC
 */

import type { GenerateContentResponse } from '@google/genai';
import { logEvent } from './telemetry';
import { calculateEstimatedCost, getPricingConfig, type PricingConfig } from './pricing';

// ────────────────────────────── Types ──────────────────────────────

export interface UsageMetrics {
  prompt_tokens: number;
  completion_tokens: number;
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
  tool_use_prompt_tokens: number;
  total_tokens: number;
  latency_ms: number;
  estimated_cost_usd: number;
  request_index?: number;
  finish_reason?: string;
  function_call_count: number;
  has_grounding_sources: boolean;
}

// ────────────────────────────── Extract usage ─────────────────────

/**
 * Bóc tách token usage từ Gemini GenerateContentResponse.
 *
 * Gemini trả usageMetadata ở response.usageMetadata hoặc
 * response.candidates[0].usageMetadata tuỳ SDK version.
 */
export function extractUsageMetrics(response: GenerateContentResponse): UsageMetrics {
  // Gemini SDK ≥ 1.x stores usageMetadata at top level
  const usage = (response as any).usageMetadata ?? {};

  const prompt_tokens: number =
    usage.promptTokenCount ?? usage.prompt_token_count ?? 0;
  const completion_tokens: number =
    usage.candidatesTokenCount ?? usage.candidates_token_count ?? usage.responseTokenCount ?? 0;
  const tool_use_prompt_tokens: number =
    usage.toolUsePromptTokenCount ?? usage.tool_use_prompt_token_count ?? 0;
  const total_tokens: number =
    usage.totalTokenCount ?? usage.total_token_count ?? (prompt_tokens + completion_tokens);

  return { prompt_tokens, completion_tokens, tool_use_prompt_tokens, total_tokens };
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
  const estimated_cost_usd = pricing
    ? calculateEstimatedCost(
        usage.prompt_tokens,
        usage.completion_tokens,
        pricing,
        usage.tool_use_prompt_tokens,
      )
    : 0;

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
