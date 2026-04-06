import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { debug } from "../utils/debug";

// Tool Implementations
// In a real app, this would use fs.readFileSync or an API call to a backend
// Since we are in a frontend environment, we can't directly read files from disk easily without a backend
// However, for this demo, we can simulate the "RAG" by fetching the markdown content or having it pre-loaded
// Given the constraints, I will implement a fetch-based search or a simulated file reader

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
    return now.toISOString().split('T')[0]; // Returns YYYY-MM-DD
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

        // Remove unwanted elements
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

// Function Declarations for Gemini
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

// Gemini Service
const SHOPAIKEY_BASE_URL = 'https://api.shopaikey.com';

const getAI = () =>
    new GoogleGenAI({
        apiKey: process.env.SHOPAIKEY_API_KEY || process.env.GEMINI_API_KEY || '',
        httpOptions: {
            baseUrl: SHOPAIKEY_BASE_URL,
        },
    });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validate Gemini response for debugging purposes
 * Checks if response has expected content and warns if no tools were called
 */
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

export const chatWithTravelAgent = async (messages: { role: string; parts: { text: string }[] }[], retryCount = 0): Promise<GenerateContentResponse> => {
    const model = "gemini-2.5-flash";
    const MAX_RETRIES = 3;

    debug.log('GEMINI', `Calling model: ${model}`, {
        messageCount: messages.length,
        retryCount,
        lastMessageRole: messages[messages.length - 1]?.role,
    });

    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model : model,
            contents: messages,
            config: {
                systemInstruction: `Bạn là một Chuyên gia Tư vấn Du lịch chuyên nghiệp và thông thái. 
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
        - Luôn trả lời bằng tiếng Việt, trình bày đẹp mắt bằng Markdown.`,
                tools: [
                    { googleSearch: {} },
                    { functionDeclarations: [queryKnowledgeBaseDeclaration, getCurrentDateDeclaration, fetchWebContentDeclaration] }
                ],
                toolConfig: { includeServerSideToolInvocations: true }
            },
        });

        debug.success('GEMINI', `Model response received`, {
            textLength: response.text?.length || 0,
            functionCallCount: response.functionCalls?.length || 0,
            functionNames: response.functionCalls?.map(f => f.name) || [],
        });

        // Validate response for debugging
        validateResponse(response);

        return response;
    } catch (error: any) {
        debug.error(`GEMINI`, `Attempt ${retryCount + 1} failed`, error);

        // Check for rate limit (429) or transient errors (500, 503)
        const isRateLimit = error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED";
        const isTransient = error?.message?.includes("500") || error?.message?.includes("503") || error?.message?.includes("xhr error");

        if ((isRateLimit || isTransient) && retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
            debug.warn('GEMINI', `Retrying in ${delay}ms...`, { isRateLimit, isTransient });
            await sleep(delay);
            return chatWithTravelAgent(messages, retryCount + 1);
        }

        throw error;
    }
};

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

        if (call.name === "query_knowledge_base") {
            const { location, query } = call.args as any;
            debug.log('TOOL_HANDLER', `Querying knowledge base for: ${location}`);
            const content = await query_knowledge_base(location, query);
            results.push({
                functionResponse: {
                    name: "query_knowledge_base",
                    response: { content },
                    id: call.id
                }
            });
            debug.success('TOOL_HANDLER', `Knowledge base query completed (${content.length} chars)`);
        } else if (call.name === "get_current_date") {
            debug.log('TOOL_HANDLER', 'Getting current date');
            const date = get_current_date();
            results.push({
                functionResponse: {
                    name: "get_current_date",
                    response: { content: date },
                    id: call.id
                }
            });
            debug.success('TOOL_HANDLER', `Current date: ${date}`);
        } else if (call.name === "fetch_web_content") {
            const { url } = call.args as any;
            debug.log('TOOL_HANDLER', `Fetching web content from: ${url}`);
            const content = await fetch_web_content(url);
            results.push({
                functionResponse: {
                    name: "fetch_web_content",
                    response: { content },
                    id: call.id
                }
            });
            debug.success('TOOL_HANDLER', `Web content fetched (${content.length} chars)`);
        }
    }

    debug.success('TOOL_HANDLER', `All ${results.length} tool results prepared`);
    debug.groupEnd();

    return results;
};
