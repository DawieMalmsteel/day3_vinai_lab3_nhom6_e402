/**
 * Pricing configuration for different providers and models
 * Prices in USD per 1M tokens
 */

export interface PricingConfig {
  inputPricePer1M: number;
  outputPricePer1M: number;
  toolUsePricePer1M?: number; // Optional separate pricing for tool use tokens
}

export const pricingTable: Record<string, Record<string, PricingConfig>> = {
  google: {
    'gemini-2.5-flash': {
      inputPricePer1M: 0.075, // $0.075 per 1M input tokens
      outputPricePer1M: 0.3, // $0.3 per 1M output tokens
    },
    'gemini-2.0-flash': {
      inputPricePer1M: 0.075,
      outputPricePer1M: 0.3,
    },
    'gemini-1.5-pro': {
      inputPricePer1M: 3.5,
      outputPricePer1M: 10.5,
    },
  },
  openai: {
    'gpt-4-turbo': {
      inputPricePer1M: 10,
      outputPricePer1M: 30,
    },
    'gpt-4o': {
      inputPricePer1M: 5,
      outputPricePer1M: 15,
    },
  },
  anthropic: {
    'claude-3-opus': {
      inputPricePer1M: 15,
      outputPricePer1M: 75,
    },
    'claude-3-sonnet': {
      inputPricePer1M: 3,
      outputPricePer1M: 15,
    },
  },
};

/**
 * Get pricing config for a provider and model
 */
export function getPricingConfig(
  provider: string,
  model: string
): PricingConfig | null {
  return pricingTable[provider]?.[model] || null;
}

/**
 * Calculate estimated cost based on tokens and pricing
 */
export function calculateEstimatedCost(
  promptTokens: number,
  completionTokens: number,
  pricingConfig: PricingConfig,
  toolUseTokens: number = 0
): number {
  let cost = 0;

  // Calculate base cost
  cost += (promptTokens / 1_000_000) * pricingConfig.inputPricePer1M;
  cost += (completionTokens / 1_000_000) * pricingConfig.outputPricePer1M;

  // Add tool use token cost if applicable
  if (toolUseTokens > 0 && pricingConfig.toolUsePricePer1M) {
    cost += (toolUseTokens / 1_000_000) * pricingConfig.toolUsePricePer1M;
  }

  return parseFloat(cost.toFixed(8)); // Round to 8 decimal places
}

/**
 * Format cost as USD string
 */
export function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(6)}`;
}
