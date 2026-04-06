import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
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

// Gemini Service
const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const chatWithTravelAgent = async (messages: { role: string; parts: { text: string }[] }[], retryCount = 0): Promise<GenerateContentResponse> => {
    const model = "gemini-2.0-flash";
    const MAX_RETRIES = 3;

    debug.log('GEMINI', `Calling model: ${model}`, {
        messageCount: messages.length,
        retryCount,
        lastMessageRole: messages[messages.length - 1]?.role,
    });

    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model,
            contents: messages,
            config: {
                systemInstruction: `Bạn là một Chuyên gia Tư vấn Du lịch AI chuyên nghiệp, thân thiện và hữu ích.

## 👋 GREETING & WELCOME:
Khi user chào hỏi (xin chào, chào, hello, etc.):
- Respond WARM & FRIENDLY trước: "Xin chào! Rất vui được gặp bạn 😊"
- Giới thiệu ngắn: "Tôi là trợ lý du lịch AI của bạn"
- Hỏi nhu cầu: "Có gì tôi có thể giúp bạn hôm nay?"
- **KHÔNG** đổ scope list ngay lập tức - chỉ hỏi nhu cầu trước

## 🎯 PHẠM VI HỖ TRỢ (Chỉ trả lời trong 4 lĩnh vực):
✈️ **Chuyến bay** - Tìm vé, giá, hãng hàng không, booking
🚌 **Xe bus/Xe khách** - Tuyến đường, giá vé, thời gian, booking
🏨 **Khách sạn** - Tìm phòng, giá, tiện nghi, rating, booking
📍 **Du lịch & cẩm nang** - Lịch trình, điểm tham quan, hướng dẫn, trekking, địa điểm

## ❌ OUT-OF-SCOPE (Khi user hỏi ngoài 4 lĩnh vực trên):
Không hỗ trợ: nhà hàng, thời tiết, phim ảnh, thể thao, công việc, học tập, y tế, chính trị, v.v.
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

**VÍ DỤ 2 - IN-SCOPE (Ngắn gọn, có links):**
User: "Tìm chuyến bay Hà Nội - Đà Nẵng"
Bot: "✈️ Từ Hà Nội đến Đà Nẵng có 2 lựa chọn:
1. [Vietjet Air](https://www.vietjetair.com/en/Booking)
2. [Vietnam Airlines](https://www.vietnamairlines.com/)

Bạn muốn biết giá vé hay thời gian bay?"

**VÍ DỤ 3 - OUT-OF-SCOPE (Từ chối polite):**
User: "Nhà hàng nào ngon ở Hà Nội?"
Bot: "Xin lỗi, tôi chuyên về du lịch và không có thông tin về nhà hàng. Nhưng tôi có thể giúp bạn tìm khách sạn, chuyến bay, hoặc lên kế hoạch du lịch Hà Nội. Bạn muốn gì?"

**TRÁNH:**
- Đổ scope list khi user chỉ nói chào
- Danh sách dài 10+ mục
- Mô tả chi tiết từng hãng
- Hỏi lại câu người dùng vừa trả lời`,
            },
        });

        debug.success('GEMINI', `Model response received`, {
            textLength: response.text?.length || 0,
        });

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
