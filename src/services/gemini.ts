import { FunctionDeclaration, GenerateContentResponse, GoogleGenAI, Type } from '@google/genai';
import { getActiveProviderConfig, MODEL, PROVIDER_LABEL } from '../config/apiProvider';
import { debug } from '../utils/debug';
import {
  measureLatency,
  recordLlmMetric,
  recordReasoningStep,
  recordToolCall,
  recordToolResult,
} from '../utils/metrics';
import { getCurrentSession } from '../utils/telemetry';

export const PROVIDER = PROVIDER_LABEL;
export { MODEL };

type ChatMode = 'chatbot' | 'agent';

const GUIDES: Record<string, string> = {
  'da lat': 'dalat.md',
  'da nang': 'danang.md',
  'phu quoc': 'phuquoc.md',
};

const BASE_SYSTEM_INSTRUCTION = `Bạn là một Chuyên gia Tư vấn Du lịch AI chuyên nghiệp, thân thiện và hữu ích.

## 👋 GREETING & WELCOME:
Khi user chào hỏi (xin chào, chào, hello, hey, xin kỷ lục, có ai không, v.v.):
- Respond WARM & FRIENDLY trước: "Xin chào! Rất vui được gặp bạn 😊"
- Giới thiệu ngắn: "Tôi là trợ lý du lịch AI của bạn"
- Hỏi nhu cầu: "Có gì tôi có thể giúp bạn hôm nay?"
- **KHÔNG** đổ scope list ngay lập tức - chỉ hỏi nhu cầu trước

## 🎯 PHẠM VI HỖ TRỢ (Trả lời chi tiết về 9 lĩnh vực):
✈️ **Chuyến bay** - Tìm vé, giá, hãng hàng không, so sánh giá, booking
🚌 **Xe bus/Xe khách** - Tuyến đường, giá vé, thời gian, nhà xe, booking
🏨 **Khách sạn** - Tìm phòng, giá, tiện nghi, rating, booking, so sánh
📍 **Du lịch & cẩm nang** - Lịch trình, điểm tham quan, hướng dẫn, trekking, địa điểm, khám phá
📅 **Lên kế hoạch chuyến đi** - Tạo itinerary, phân chia ngày, lên lịch trình chi tiết, gợi ý hoạt động
💰 **So sánh giá vé** - So sánh giá giữa các hãng, tìm vé rẻ nhất, gợi ý hãng tốt
🍽️ **Gợi ý nhà hàng** - Gợi ý ăn uống theo khu vực, loại ẩm thực, rating, booking
🚕 **Di chuyển cục bộ** - Hướng dẫn từ A đến B, taxi, grab, bus, xe máy, giá, thời gian
📸 **Hoạt động & Attractions** - Gợi ý điểm tham quan, trải nghiệm, lặn, trekking, sự kiện, giá vé

## ❌ OUT-OF-SCOPE (Khi user hỏi ngoài phạm vi hỗ trợ):
Không hỗ trợ: thời tiết, phim ảnh, thể thao, công việc, học tập, y tế, chính trị, tư vấn luật, tài chính cá nhân, v.v.
👉 **Từ chối thân thiện**: "Xin lỗi, tôi chuyên về du lịch và không có thông tin về [chủ đề]. Nhưng tôi có thể giúp bạn với chuyến bay, xe bus, khách sạn, hoặc lên kế hoạch du lịch. Bạn cần gì?"

## 📝 LUẬT TRÌNH BÀY CÂU TRẢ LỜI:
1. **Ngắn gọn**: Tối đa 10 dòng, trực tiếp vào vấn đề
2. **Link Markdown**: Luôn dùng định dạng [Tên](URL) cho tất cả links
3. **Cấu trúc**: Giới thiệu ngắn (1-2 dòng) → Danh sách (2-4 mục tối đa) → Câu hỏi tiếp theo
4. **Kết thúc hội thoại**: **LUÔN LUÔN** hỏi một câu tiếp theo để tiếp tục hội thoại
5. **Tránh**: Mô tả dài dòng, nhiều section, thông tin dư thừa, danh sách dài

## 🔗 TÀI NGUYÊN BOOKING:
Khi cần link booking, sử dụng các mẫu:
- Booking.com: https://www.booking.com/searchresults.html?ss=TênThànhPhố
- Agoda: https://www.agoda.com/search?ss=TênThànhPhố
- Vietjet Air: https://www.vietjetair.com/en/Booking
- Vietnam Airlines: https://www.vietnamairlines.com/

## 🌐 NGÔN NGỮ & ĐỊNH DẠNG:
- Luôn trả lời bằng **tiếng Việt**
- Sử dụng **Markdown** cho định dạng (bold, italic, lists, links)
- Emoji hợp lý để giao diện thân thiện
- Không dùng thẻ HTML

## 💡 VÍ DỤ CÁCH TRẢ LỜI:

**VÍ DỤ 1 - GREETING (Thân thiện):**
User: "Chào"
Bot: "Xin chào! Rất vui được gặp bạn 😊 Tôi là trợ lý du lịch AI của bạn. Có gì tôi có thể giúp bạn hôm nay?"

**VÍ DỤ 2 - GREETING VARIATION:**
User: "Xin chào"
Bot: "Xin chào bạn! 👋 Rất vui được gặp bạn. Mình có thể giúp bạn lên kế hoạch chuyến du lịch, tìm vé máy bay, khách sạn, hoặc bất kỳ thông tin du lịch nào khác. Bạn muốn đi đâu?"

**VÍ DỤ 3 - IN-SCOPE (Ngắn gọn, có links):**
User: "Tìm chuyến bay Hà Nội - Đà Nẵng"
Bot: "✈️ Từ Hà Nội đến Đà Nẵng có 2 lựa chọn:
1. [Vietjet Air](https://www.vietjetair.com/en/Booking)
2. [Vietnam Airlines](https://www.vietnamairlines.com/)

Bạn muốn biết giá vé hay thời gian bay?"

**VÍ DỤ 4 - TRIP PLANNER:**
User: "Lên kế hoạch Đà Nẵng 3 ngày"
Bot: "📅 Itinerary Đà Nẵng 3 ngày cho bạn:
- **Ngày 1**: Khám phá Phố cổ Hội An, thưởng thức cơm lam
- **Ngày 2**: Tắm biển Mỹ Khê, chèo kayak
- **Ngày 3**: Viếng chùa Linh Ứng, mua quà lưu niệm

Bạn muốn biết thêm về hoạt động, nhà hàng, hoặc giá khách sạn?"

**VÍ DỤ 5 - PRICE COMPARISON:**
User: "So sánh giá vé TP.HCM - Hà Nội"
Bot: "💰 So sánh giá vé TP.HCM → Hà Nội:
- Vietjet: 450K (rẻ nhất)
- Bamboo: 650K (tốt nhất - chất lượng + giá)
- Vietnam Airlines: 850K (chất lượng cao)

Hãng nào bạn thích?"

**VÍ DỤ 6 - OUT-OF-SCOPE (Từ chối polite):**
User: "Thời tiết Đà Nẵng hôm nay?"
Bot: "Xin lỗi, tôi không có thông tin thời tiết. Nhưng tôi có thể giúp bạn lên kế hoạch du lịch Đà Nẵng, tìm vé máy bay, khách sạn, hoặc gợi ý nhà hàng ở đó. Bạn muốn gì?"

**TRÁNH:**
- Đổ scope list khi user chỉ nói chào
- Danh sách dài 10+ mục
- Mô tả chi tiết từng hãng
- Hỏi lại câu người dùng vừa trả lời`;

const AGENT_SYSTEM_INSTRUCTION = `${BASE_SYSTEM_INSTRUCTION}

## 🛠️ QUY TẮC DÙNG CÔNG CỤ:
- Với câu hỏi cần dữ liệu, ưu tiên gọi tool thay vì đoán.
- Nếu hỏi về Đà Lạt, Đà Nẵng, Phú Quốc hoặc nội dung cẩm nang, ưu tiên query_knowledge_base.
- Nếu hỏi về thời gian, ngày đi, lịch trình, ưu tiên get_current_date.
- Nếu cần dữ liệu mới, giá mới, review mới hoặc nội dung từ URL, dùng googleSearch hoặc fetch_web_content.
- Sau khi có kết quả tool, tổng hợp ngắn gọn bằng Markdown và kèm câu hỏi tiếp theo.
`;

const CHATBOT_SYSTEM_INSTRUCTION = `${BASE_SYSTEM_INSTRUCTION}

## 🚫 QUY TẮC CHATBOT:
- Trả lời trực tiếp dựa trên kiến thức sẵn có.
- Không gọi bất kỳ tool hoặc function nào.
`;

const queryKnowledgeBaseDeclaration: FunctionDeclaration = {
  name: 'query_knowledge_base',
  description: 'Truy xuất thông tin chi tiết từ cẩm nang du lịch (Markdown) về một địa điểm cụ thể.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description: 'Tên thành phố hoặc địa điểm (VD: Da Lat, Da Nang, Phu Quoc)',
      },
      query: {
        type: Type.STRING,
        description: 'Câu hỏi hoặc chủ đề cần tìm kiếm (VD: địa điểm ăn uống, khách sạn, giá vé)',
      },
    },
    required: ['location', 'query'],
  },
};

const getCurrentDateDeclaration: FunctionDeclaration = {
  name: 'get_current_date',
  description: 'Lấy ngày hiện tại theo định dạng YYYY-MM-DD để tính toán thời gian chuyến đi.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const fetchWebContentDeclaration: FunctionDeclaration = {
  name: 'fetch_web_content',
  description: 'Lấy nội dung từ một URL bất kỳ để đọc bài review, blog du lịch, hoặc thông tin chi tiết về địa điểm.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: 'URL đầy đủ của trang web cần đọc (VD: https://example.com/review)',
      },
    },
    required: ['url'],
  },
};

const getAI = () => {
  const { apiKey, baseUrl } = getActiveProviderConfig();
  return new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const validateResponse = (response: GenerateContentResponse, mode: ChatMode): void => {
  const hasText = !!response.text && response.text.trim().length > 0;
  const hasFunctionCalls = !!response.functionCalls && response.functionCalls.length > 0;

  if (!hasText && !hasFunctionCalls) {
    debug.warn('GEMINI', 'Empty response - no text content and no function calls!');
    return;
  }

  if (mode === 'agent' && !hasFunctionCalls) {
    debug.warn(
      'GEMINI',
      'No function calls detected - model may not understand tools or chose direct response (Hybrid Mode active)',
      {
        textLength: response.text?.length,
        hasGroundingMetadata: !!response.candidates?.[0]?.groundingMetadata,
      },
    );
  }
};

export const query_knowledge_base = async (location: string, query: string): Promise<string> => {
  debug.log('QUERY_KB', `Searching knowledge base for "${location}" with query: ${query}`);

  const fileName = GUIDES[location.toLowerCase().trim()];
  if (!fileName) {
    debug.warn('QUERY_KB', `Location not found: ${location}. Available: Đà Lạt, Đà Nẵng, Phú Quốc`);
    return `Không tìm thấy thông tin cho địa điểm: ${location}. Hiện tại tôi chỉ có dữ liệu cho Đà Lạt, Đà Nẵng và Phú Quốc.`;
  }

  try {
    debug.log('QUERY_KB', `Fetching file: ${fileName}`);
    const response = await fetch(`/public/data/guides/${fileName}`);
    if (!response.ok) {
      throw new Error('File not found');
    }

    const content = await response.text();
    debug.success('QUERY_KB', `Retrieved ${content.length} characters from ${fileName}`);
    return content;
  } catch (error) {
    debug.error('QUERY_KB', `Failed to read guide for ${location}`, error);
    return 'Lỗi khi truy xuất dữ liệu từ cẩm nang.';
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
    debug.log('FETCH_WEB', 'Using proxy: api.allorigins.win');

    const response = await fetch(proxyUrl);
    debug.log('FETCH_WEB', `Response status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    debug.log('FETCH_WEB', `Retrieved ${html.length} bytes of HTML`);

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const removed = doc.querySelectorAll(
      'script, style, nav, header, footer, iframe, noscript, .ads, .sidebar, .menu, .navigation',
    ).length;
    doc.querySelectorAll(
      'script, style, nav, header, footer, iframe, noscript, .ads, .sidebar, .menu, .navigation',
    ).forEach((element) => element.remove());
    debug.log('FETCH_WEB', `Removed ${removed} unwanted elements`);

    const body = doc.body || doc.documentElement;
    const text = body?.innerText || '';

    const cleaned = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 200)
      .join('\n');

    debug.success('FETCH_WEB', `Extracted ${cleaned.split('\n').length} lines of content`);
    return cleaned || 'Không thể trích xuất nội dung từ trang web này.';
  } catch (error) {
    debug.error('FETCH_WEB', `Failed to fetch from ${url}`, error);
    return `Lỗi khi truy cập URL ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

let stepCounter = 0;

export const resetStepCounter = (): void => {
  stepCounter = 0;
};

export const getStepCount = (): number => stepCounter;

export const chatWithTravelAgent = async (
  messages: { role: string; parts: any[] }[],
  mode: ChatMode = 'agent',
  retryCount = 0,
): Promise<GenerateContentResponse> => {
  const MAX_RETRIES = 3;

  stepCounter += 1;

  debug.log('GEMINI', `[${mode}] Calling model: ${MODEL} (step ${stepCounter})`, {
    messageCount: messages.length,
    retryCount,
    lastMessageRole: messages[messages.length - 1]?.role,
  });

  const startTime = Date.now();

  try {
    const ai = getAI();
    const isChatbot = mode === 'chatbot';
    const config: {
      systemInstruction: string;
      tools?: Array<Record<string, unknown>>;
      toolConfig?: { includeServerSideToolInvocations: boolean };
    } = {
      systemInstruction: isChatbot ? CHATBOT_SYSTEM_INSTRUCTION : AGENT_SYSTEM_INSTRUCTION,
    };

    if (!isChatbot) {
      config.tools = [
        { googleSearch: {} },
        {
          functionDeclarations: [
            queryKnowledgeBaseDeclaration,
            getCurrentDateDeclaration,
            fetchWebContentDeclaration,
          ],
        },
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
      functionNames: response.functionCalls?.map((call) => call.name) || [],
    });

    validateResponse(response, mode);

    const session = getCurrentSession();
    if (session) {
      recordLlmMetric(session.label, stepCounter, response, latencyMs, PROVIDER, MODEL, stepCounter);

      if (session.label === 'agent' && response.text) {
        const functionNames = response.functionCalls?.map((call) => call.name).join(', ');
        recordReasoningStep(
          stepCounter,
          response.text.slice(0, 500),
          response.text.slice(0, 150),
          functionNames || undefined,
        );
      }
    }

    return response;
  } catch (error: any) {
    debug.error('GEMINI', `Attempt ${retryCount + 1} failed`, error);

    const isRateLimit = error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
    const isTransient =
      error?.message?.includes('500') ||
      error?.message?.includes('503') ||
      error?.message?.includes('xhr error');

    if ((isRateLimit || isTransient) && retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
      debug.warn('GEMINI', `Retrying in ${delay}ms...`, { isRateLimit, isTransient });
      await sleep(delay);
      return chatWithTravelAgent(messages, mode, retryCount + 1);
    }

    throw error;
  }
};

export const handleToolCalls = async (
  response: GenerateContentResponse,
): Promise<Array<{ functionResponse: { name: string; response: { content: string }; id: string } }> | null> => {
  const functionCalls = response.functionCalls;
  if (!functionCalls || functionCalls.length === 0) {
    debug.log('TOOL_HANDLER', 'No function calls to handle');
    return null;
  }

  debug.group(`Handling ${functionCalls.length} tool call(s)`);
  debug.log('TOOL_HANDLER', 'Received function calls:', functionCalls.map((call) => call.name));

  const results: Array<{
    functionResponse: {
      name: string;
      response: { content: string };
      id: string;
    };
  }> = [];

  for (const call of functionCalls) {
    const toolName = call.name ?? 'unknown';
    const toolArgs = (call.args as Record<string, any>) ?? {};

    debug.log('TOOL_HANDLER', `Processing tool: ${toolName}`, toolArgs);
    recordToolCall(stepCounter, toolName, toolArgs);

    const toolStart = Date.now();
    let success = true;
    let resultContent = '';

    try {
      if (toolName === 'query_knowledge_base') {
        const { location, query } = toolArgs;
        resultContent = await query_knowledge_base(location, query);
      } else if (toolName === 'get_current_date') {
        resultContent = get_current_date();
      } else if (toolName === 'fetch_web_content') {
        const { url } = toolArgs;
        resultContent = await fetch_web_content(url);
      } else {
        success = false;
        resultContent = `Unknown tool: ${toolName}`;
      }
    } catch (error: any) {
      success = false;
      resultContent = `Error: ${error?.message ?? 'unknown'}`;
    }

    const toolDuration = measureLatency(toolStart);
    recordToolResult(stepCounter, toolName, success, toolDuration, resultContent);

    results.push({
      functionResponse: {
        name: toolName,
        response: { content: resultContent },
        id: call.id ?? `${toolName}-${stepCounter}`,
      },
    });

    debug.success(
      'TOOL_HANDLER',
      `${toolName} completed (${toolDuration}ms, ${resultContent.length} chars)`,
    );
  }

  debug.success('TOOL_HANDLER', `All ${results.length} tool results prepared`);
  debug.groupEnd();

  return results;
};
