/**
 * API Provider Configuration
 *
 * Chọn provider tại đây:
 *   'google'    → dùng Google Gemini API trực tiếp (ai.google.dev)
 *   'shopaikey' → dùng ShopAIKey làm proxy (api.shopaikey.com)
 */

export type ApiProvider = 'google' | 'shopaikey';

// ─────────────────────────────────────────────────────────────────
// ★ ĐỔI Ở ĐÂY để chuyển provider
// ─────────────────────────────────────────────────────────────────
export const ACTIVE_PROVIDER: ApiProvider = 'shopaikey';
// ─────────────────────────────────────────────────────────────────

// Model muốn dùng
export const MODEL = 'gemini-2.5-flash';

// Tên provider đưa vào telemetry log
export const PROVIDER_LABEL = 'google';

// ────────────────────────── Provider configs ──────────────────────

interface ProviderConfig {
  /** API key lấy từ env */
  apiKey: string;
  /** Base URL của endpoint (undefined = dùng default của Google SDK) */
  baseUrl?: string;
}

// Lấy env — Vite inject process.env.* qua define trong vite.config.ts
const env = (typeof process !== 'undefined' && process.env) || ({} as Record<string, string>);

const PROVIDERS: Record<ApiProvider, ProviderConfig> = {
  google: {
    apiKey: env.GEMINI_API_KEY ?? '',
    baseUrl: undefined, // dùng endpoint mặc định: generativelanguage.googleapis.com
  },
  shopaikey: {
    apiKey: env.SHOPAIKEY_API_KEY ?? '',
    baseUrl: 'https://api.shopaikey.com',
  },
};

// ────────────────────────── Helpers ──────────────────────────────

/**
 * Trả về config của provider đang active.
 * Dùng trong getAI() bên gemini.ts.
 */
export function getActiveProviderConfig(): ProviderConfig {
  const cfg = PROVIDERS[ACTIVE_PROVIDER];

  if (!cfg.apiKey) {
    console.warn(
      `[apiProvider] API key cho provider "${ACTIVE_PROVIDER}" chưa được set.\n` +
      `Hãy thêm vào file .env:\n` +
      (ACTIVE_PROVIDER === 'google'
        ? '  VITE_GEMINI_API_KEY=AIza...'
        : '  VITE_SHOPAIKEY_API_KEY=sk-...'),
    );
  }

  return cfg;
}
