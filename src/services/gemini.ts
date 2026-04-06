import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { debug } from "../utils/debug";
import { recordLlmMetric, recordToolCall, recordToolResult, recordReasoningStep, measureLatency } from "../utils/metrics";
import { getCurrentSession } from "../utils/telemetry";
import { getActiveProviderConfig, MODEL, PROVIDER_LABEL } from "../config/apiProvider";

// ────────────────────────────── Provider / Model constants ─────────
export const PROVIDER = PROVIDER_LABEL;
export { MODEL };

// ────────────────────────────── Tool Implementations ──────────────

const GUIDES: Record<string, string> = {
    "da lat": "dalat.md",
    "da nang": "danang.md",
    "phu quoc": "phuquoc.md"
};

export const query_knowledge_base = async (location: string, query: string): Promise<string> => {
    debug.log('QUERY_KB', `Searching knowledge base for "${location}" with query: "${query}"`);

    const fileName = GUIDES[location.toLowerCase().trim()];
    if (!fileName) {
        debug.warn('QUERY_KB', `Location not found: ${location}. Available: Đà Lạt, Đà Nẵng, Phú Quốc`);
        return `Không tìm thấy thông tin cho địa điểm: ${location}. Hiện tại tôi chỉ có dữ liệu cho Đà Lạt, Đà Nẵng và Phú Quốc.`;
    }

    try {
        debug.log('QUERY_KB', `Fetching file: ${fileName}`);
        const response = await fetch(`/public/data/guides/${fileName}`);
        if (!response.ok) throw new Error("File not found");
        const content = await response.text();
        debug.success('QUERY_KB', `Retrieved ${content.length} characters from ${fileName}`);
        return content;
    } catch (error) {
        debug.error('QUERY_KB', `Failed to read guide for ${location}`, error);
        return "Lỗi khi truy xuất dữ liệu từ cẩm nang.";
    }
};

export const get_current_date = (): string => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

export const fetch_web_content = async (url: string): Promise<string> => {
    debug.log('FETCH_WEB', `Fetching content from: ${url}`);

    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        debug.log('FETCH_WEB', `Using proxy: api.allorigins.win`);

        const response = await fetch(proxyUrl);
        debug.log('FETCH_WEB', `Response status: ${response.status}`);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        debug.log('FETCH_WEB', `Retrieved ${html.length} bytes of HTML`);

        const doc = new DOMParser().parseFromString(html, 'text/html');

        const removed = doc.querySelectorAll('script, style, nav, header, footer, iframe, noscript, .ads, .sidebar, .menu, .navigation').length;
        doc.querySelectorAll('script, style, nav, header, footer, iframe, noscript, .ads, .sidebar, .menu, .navigation').forEach(el => el.remove());
        debug.log('FETCH_WEB', `Removed ${removed} unwanted elements`);

        const body = doc.body || doc.documentElement;
        const text = body?.innerText || '';

        const cleaned = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .slice(0, 200)
            .join('\n');

        debug.success('FETCH_WEB', `Extracted ${cleaned.split('\n').length} lines of content`);
        return cleaned || 'Không thể trích xuất nội dung từ trang web này.';
    } catch (error) {
        debug.error('FETCH_WEB', `Failed to fetch from ${url}`, error);
        return `Lỗi khi truy cập URL ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
};

// ────────────────────────────── Function Declarations ─────────────

const queryKnowledgeBaseDeclaration: FunctionDeclaration = {
    name: "query_knowledge_base",
    description: "Truy xuất thông tin chi tiết từ cẩm nang du lịch (Markdown) về một địa điểm cụ thể.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            location: { type: Type.STRING, description: "Tên thành phố hoặc địa điểm (VD: Da Lat, Da Nang, Phu Quoc)" },
            query: { type: Type.STRING, description: "Câu hỏi hoặc chủ đề cần tìm kiếm (VD: địa điểm ăn uống, khách sạn, giá vé)" },
        },
        required: ["location", "query"],
    },
};

const getCurrentDateDeclaration: FunctionDeclaration = {
    name: "get_current_date",
    description: "Lấy ngày hiện tại theo định dạng YYYY-MM-DD để tính toán thời gian chuyến đi.",
    parameters: {
        type: Type.OBJECT,
        properties: {},
    },
};

const fetchWebContentDeclaration: FunctionDeclaration = {
    name: "fetch_web_content",
    description: "Lấy nội dung từ một URL bất kỳ để đọc bài review, blog du lịch, hoặc thông tin chi tiết về địa điểm.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            url: { type: Type.STRING, description: "URL đầy đủ của trang web cần đọc (VD: https://example.com/review)" },
        },
        required: ["url"],
    },
};

// ────────────────────────────── Gemini Client ─────────────────────

const getAI = () => {
    const { apiKey, baseUrl } = getActiveProviderConfig();
    return new GoogleGenAI({
        apiKey,
        ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
    });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const validateResponse = (response: GenerateContentResponse) => {
    const hasText = !!response.text && response.text.trim().length > 0;
    const hasFunctionCalls = !!response.functionCalls && response.functionCalls.length > 0;

    if (!hasText && !hasFunctionCalls) {
        debug.warn('GEMINI', 'Empty response - no text content and no function calls!');
        return;
    }

    if (!hasFunctionCalls) {
        debug.warn('GEMINI', 'No function calls detected - model may not understand tools or chose direct response (Hybrid Mode active)', {
            textLength: response.text?.length,
            hasGroundingMetadata: !!response.candidates?.[0]?.groundingMetadata,
        });
    }
};

// ────────────────────────────── System instructions ───────────────

const AGENT_SYSTEM_INSTRUCTION = `Bạn là một Chuyên gia Tư vấn Du lịch chuyên nghiệp và thông thái.
Nhiệm vụ của bạn là giúp người dùng lên kế hoạch chuyến đi hoàn hảo nhất.

CÔNG CỤ CỦA BẠN:
1. 'query_knowledge_base': Truy xuất thông tin từ cẩm nang du lịch nội bộ.
2. 'get_current_date': Lấy ngày hiện tại để tính toán lịch trình chính xác.
3. 'googleSearch': Tìm kiếm thông tin thời gian thực (giá vé, thời tiết, review).
4. 'fetch_web_content': Đọc nội dung chi tiết từ URL cụ thể (blog, review, cẩm nang).

⚠️ QUAN TRỌNG - QUY TẮC GỌI TOOLS (BẮT BUỘC):
- LUÔN cố gắng gọi ít nhất 1 tool cho MỖI request của người dùng. Đừng bao giờ bỏ qua bước này!
- Nếu người dùng hỏi về địa điểm cụ thể → gọi 'query_knowledge_base' trước
- Nếu cần thông tin thời gian thực (giá, thời tiết, review mới) → gọi 'googleSearch' hoặc 'fetch_web_content'
- Nếu hỏi về lịch trình/ngày giờ → gọi 'get_current_date' đầu tiên
- Gọi tools KHÔNG PHẢI tuỳ chọn - đó là BƯỚC BẮT BUỘC trong quy trình của bạn!

QUY TRÌNH LÀM VIỆC:
1. Đọc request người dùng cẩn thận
2. Quyết định tool nào cần gọi (LUÔN có ít nhất 1 tool)
3. Gọi tool đó
4. Dùng kết quả từ tool để trả lời chi tiết
5. Thêm links/URL từ kết quả để người dùng có thể hành động
- QUAN TRỌNG: Hãy LUÔN kèm theo link (URL) cho các khách sạn, chuyến bay hoặc địa điểm tham quan mà bạn tìm thấy từ Google Search hoặc cẩm nang để người dùng có thể đặt chỗ trực tiếp. Trình bày link dưới dạng Markdown [Tên khách sạn](URL).
- Luôn trả lời bằng tiếng Việt, trình bày đẹp mắt bằng Markdown.`;

const CHATBOT_SYSTEM_INSTRUCTION = `Bạn là một Chuyên gia Tư vấn Du lịch chuyên nghiệp và thông thái.
Nhiệm vụ của bạn là giúp người dùng lên kế hoạch chuyến đi hoàn hảo nhất.

Hãy trả lời trực tiếp dựa trên kiến thức có sẵn của bạn.
KHÔNG gọi bất kỳ tool/function nào. Trả lời thuần text.
Luôn trả lời bằng tiếng Việt, trình bày đẹp mắt bằng Markdown.`;

// ────────────────────────────── Step counter (module-level) ───────

let _stepCounter = 0;

export function resetStepCounter(): void {
  _stepCounter = 0;
}

export function getStepCount(): number {
  return _stepCounter;
}

// ────────────────────────────── Chat with model ──────────────────

/**
 * Gọi model.
 * @param mode - 'chatbot' (không tool) hoặc 'agent' (có tool + ReAct loop)
 */
export const chatWithTravelAgent = async (
  messages: { role: string; parts: any[] }[],
  mode: 'chatbot' | 'agent' = 'agent',
  retryCount = 0,
): Promise<GenerateContentResponse> => {
    const MAX_RETRIES = 3;

    _stepCounter++;

    debug.log('GEMINI', `[${mode}] Calling model: ${MODEL} (step ${_stepCounter})`, {
        messageCount: messages.length,
        retryCount,
        lastMessageRole: messages[messages.length - 1]?.role,
    });

    const startTime = Date.now();

    try {
        const ai = getAI();

        // Chatbot mode: không truyền tools → model không thể gọi function
        const isChatbot = mode === 'chatbot';

        const config: any = {
            systemInstruction: isChatbot ? CHATBOT_SYSTEM_INSTRUCTION : AGENT_SYSTEM_INSTRUCTION,
        };

        if (!isChatbot) {
            config.tools = [
                { googleSearch: {} },
                { functionDeclarations: [queryKnowledgeBaseDeclaration, getCurrentDateDeclaration, fetchWebContentDeclaration] },
            ];
            config.toolConfig = { includeServerSideToolInvocations: true };
        }

        const response = await ai.models.generateContent({
            model: MODEL,
            contents: messages,
            config,
        });

        const latencyMs = measureLatency(startTime);

        debug.success('GEMINI', `Model response received (${latencyMs}ms)`, {
            textLength: response.text?.length || 0,
            functionCallCount: response.functionCalls?.length || 0,
            functionNames: response.functionCalls?.map(f => f.name) || [],
        });

        validateResponse(response);

        // ── Ghi LLM_METRIC ──
        const session = getCurrentSession();
        if (session) {
            const label = session.label as 'chatbot' | 'agent';
            recordLlmMetric(label, _stepCounter, response, latencyMs, PROVIDER, MODEL, _stepCounter);

            // Nếu là agent và response có text → ghi reasoning step
            if (label === 'agent' && response.text) {
                const fnNames = response.functionCalls?.map(f => f.name).join(', ');
                recordReasoningStep(
                    _stepCounter,
                    response.text.slice(0, 500),
                    response.text.slice(0, 150),
                    fnNames || undefined,
                );
            }
        }

        return response;
    } catch (error: any) {
        debug.error(`GEMINI`, `Attempt ${retryCount + 1} failed`, error);

        const isRateLimit = error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED";
        const isTransient = error?.message?.includes("500") || error?.message?.includes("503") || error?.message?.includes("xhr error");

        if ((isRateLimit || isTransient) && retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
            debug.warn('GEMINI', `Retrying in ${delay}ms...`, { isRateLimit, isTransient });
            await sleep(delay);
            return chatWithTravelAgent(messages, mode, retryCount + 1);
        }

        throw error;
    }
};

// ────────────────────────────── Handle Tool Calls ─────────────────

export const handleToolCalls = async (response: GenerateContentResponse) => {
    const functionCalls = response.functionCalls;
    if (!functionCalls) {
        debug.log('TOOL_HANDLER', 'No function calls to handle');
        return null;
    }

    debug.group(`Handling ${functionCalls.length} tool call(s)`);
    debug.log('TOOL_HANDLER', 'Received function calls:', functionCalls.map(f => f.name));

    const results = [];
    for (const call of functionCalls) {
        debug.log('TOOL_HANDLER', `Processing tool: ${call.name}`, call.args);

        // ── Ghi TOOL_CALL event ──
        const toolName = call.name ?? 'unknown';
        recordToolCall(_stepCounter, toolName, (call.args as Record<string, any>) ?? {});

        const toolStart = Date.now();
        let success = true;
        let resultContent = '';

        try {
            if (call.name === "query_knowledge_base") {
                const { location, query } = call.args as any;
                debug.log('TOOL_HANDLER', `Querying knowledge base for: ${location}`);
                resultContent = await query_knowledge_base(location, query);
            } else if (call.name === "get_current_date") {
                debug.log('TOOL_HANDLER', 'Getting current date');
                resultContent = get_current_date();
            } else if (call.name === "fetch_web_content") {
                const { url } = call.args as any;
                debug.log('TOOL_HANDLER', `Fetching web content from: ${url}`);
                resultContent = await fetch_web_content(url);
            } else {
                resultContent = `Unknown tool: ${call.name}`;
                success = false;
            }
        } catch (err: any) {
            resultContent = `Error: ${err?.message ?? 'unknown'}`;
            success = false;
        }

        const toolDuration = measureLatency(toolStart);

        // ── Ghi TOOL_RESULT event ──
        recordToolResult(_stepCounter, toolName, success, toolDuration, resultContent);

        results.push({
            functionResponse: {
                name: call.name,
                response: { content: resultContent },
                id: call.id,
            },
        });

        debug.success('TOOL_HANDLER', `${call.name} completed (${toolDuration}ms, ${resultContent.length} chars)`);
    }

    debug.success('TOOL_HANDLER', `All ${results.length} tool results prepared`);
    debug.groupEnd();

    return results;
};
