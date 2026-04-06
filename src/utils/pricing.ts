/**
 * Pricing configuration for different providers and models
 * Prices in USD per 1M tokens
 *
 * Nguồn giá:
 *   Google:    https://ai.google.dev/pricing
 *   OpenAI:    https://openai.com/api/pricing
 *   Anthropic: https://docs.anthropic.com/en/docs/about-claude/models
 */

export interface PricingConfig {
  inputPricePer1M: number;
  outputPricePer1M: number;
  thinkingPricePer1M?: number;   // Giá riêng cho thinking tokens (Gemini 2.5)
  toolUsePricePer1M?: number;    // Giá riêng cho tool use tokens (nếu provider tính riêng)
}

// ────────────────────────────── Bảng giá ──────────────────────────

export const pricingTable: Record<string, Record<string, PricingConfig>> = {
  google: {
    // Gemini 2.5 Flash — có thinking tokens tính riêng
    // Giá cho context ≤ 200K tokens
    'gemini-2.5-flash': {
      inputPricePer1M: 0.15,          // $0.15 / 1M input
      outputPricePer1M: 0.60,         // $0.60 / 1M output (non-thinking)
      thinkingPricePer1M: 3.50,       // $3.50 / 1M thinking tokens
    },
    // Gemini 2.0 Flash
    'gemini-2.0-flash': {
      inputPricePer1M: 0.10,          // $0.10 / 1M input
      outputPricePer1M: 0.40,         // $0.40 / 1M output
    },
    // Gemini 1.5 Pro (context ≤ 128K)
    'gemini-1.5-pro': {
      inputPricePer1M: 1.25,          // $1.25 / 1M input
      outputPricePer1M: 5.00,         // $5.00 / 1M output
    },
  },
  openai: {
    'gpt-4-turbo': {
      inputPricePer1M: 10.00,
      outputPricePer1M: 30.00,
    },
    'gpt-4o': {
      inputPricePer1M: 2.50,          // $2.50 / 1M input
      outputPricePer1M: 10.00,        // $10.00 / 1M output
    },
    'gpt-4o-mini': {
      inputPricePer1M: 0.15,
      outputPricePer1M: 0.60,
    },
  },
  anthropic: {
    'claude-3-opus': {
      inputPricePer1M: 15.00,
      outputPricePer1M: 75.00,
    },
    'claude-3.5-sonnet': {
      inputPricePer1M: 3.00,
      outputPricePer1M: 15.00,
    },
    'claude-3-haiku': {
      inputPricePer1M: 0.25,
      outputPricePer1M: 1.25,
    },
  },
};

// ────────────────────────────── Lookup ─────────────────────────────

export function getPricingConfig(
  provider: string,
  model: string,
): PricingConfig | null {
  return pricingTable[provider]?.[model] || null;
}

// ────────────────────────────── Calculate ──────────────────────────

/**
 * Tính estimated cost.
 *
 * Công thức:
 *   cost = (prompt / 1M) × inputPrice
 *        + (completion / 1M) × outputPrice
 *        + (thinking / 1M) × thinkingPrice       ← nếu model có thinking
 *        + (toolUse / 1M) × toolUsePrice          ← nếu provider tính riêng
 */
export function calculateEstimatedCost(
  promptTokens: number,
  completionTokens: number,
  pricingConfig: PricingConfig,
  thinkingTokens: number = 0,
  toolUseTokens: number = 0,
): number {
  let cost = 0;

  // Input cost
  cost += (promptTokens / 1_000_000) * pricingConfig.inputPricePer1M;

  // Output cost (non-thinking)
  // Nếu model có thinking → completionTokens đã trừ thinking ở bên metrics.ts
  cost += (completionTokens / 1_000_000) * pricingConfig.outputPricePer1M;

  // Thinking tokens — giá cao hơn (~6x output thông thường cho Gemini 2.5)
  if (thinkingTokens > 0 && pricingConfig.thinkingPricePer1M) {
    cost += (thinkingTokens / 1_000_000) * pricingConfig.thinkingPricePer1M;
  }

  // Tool use tokens (nếu provider tính riêng)
  if (toolUseTokens > 0 && pricingConfig.toolUsePricePer1M) {
    cost += (toolUseTokens / 1_000_000) * pricingConfig.toolUsePricePer1M;
  }

  return parseFloat(cost.toFixed(8));
}

// ────────────────────────────── Format ─────────────────────────────

export function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(6)}`;
}
