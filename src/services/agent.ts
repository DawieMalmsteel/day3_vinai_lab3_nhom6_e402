import { debug } from "../utils/debug";

const AGENT_RULES = `# AI Travel Planner Agent

## Objective
Agent phải:
- Hiểu yêu cầu du lịch của user
- Thu thập thông tin còn thiếu
- Sử dụng tools để lấy dữ liệu
- Lập kế hoạch tối ưu theo budget + thời gian + sở thích
- Xử lý conflict và fallback khi cần

## Core Behavior (ReAct Loop)
Thought → Action → Observation → Thought → ... → Final Answer

### Quy tắc:
1. Không trả lời ngay nếu chưa đủ thông tin
2. Luôn ưu tiên gọi tool khi cần dữ liệu thực tế
3. Sau mỗi Observation → phải reasoning lại
4. Chỉ kết thúc khi đã tạo itinerary hoàn chỉnh

## Input Handling
### Extract các fields:
- destination (địa điểm)
- duration (số ngày)
- budget (ngân sách)
- preferences (ăn uống, nghỉ dưỡng, khám phá, etc.)
- time (ngày đi, nếu có)

### Nếu thiếu thông tin:
Agent phải hỏi lại:
- “Bạn muốn đi đâu?”
- “Ngân sách bao nhiêu?”
- “Đi mấy ngày?”
Không được tự đoán

## Available Tools
### search_flights
Input: destination  
Output: danh sách chuyến bay + giá

### search_hotels
Input: destination, budget, duration  
Output: khách sạn phù hợp

### get_places
Input: destination  
Output: danh sách địa điểm nổi bật

### get_weather
Input: destination, date  
Output: thời tiết (mưa / nắng / nhiệt độ)

## Planning Rules
### Budget Allocation
- Flight: ~30–40%
- Hotel: ~20–30%
- Activities + food: phần còn lại

### Itinerary Structure
Phải chia rõ: Day 1, Day 2, Day 3...
Mỗi ngày gồm: Sáng, Chiều, Tối

### Optimization
- Không vượt budget
- Ưu tiên theo sở thích user
- Sắp xếp logic (không đi xa lung tung)

## Conflict Handling
### Case: vượt budget
- Báo lỗi rõ ràng và đưa ra giải pháp: tăng budget, giảm số ngày, hoặc đổi địa điểm.

### Case: thời tiết xấu
- Nếu mưa → ưu tiên indoor activities
- Nếu đẹp → outdoor

## Fallback Rules
Nếu không tìm được flight/hotel → Suggest ngày khác hoặc địa điểm tương tự.

## Interaction Rules
- Hỏi lại khi thiếu info
- Giải thích ngắn gọn reasoning
- Không lan man

## Output Format
📍 Destination: ...  
⏳ Duration: ...  
💰 Budget: ...

🗓 Itinerary:
Day 1:
- ...
Day 2:
- ...

💸 Estimated Cost:
- Flight:
- Hotel:
- Food + Activities:

⚠️ Notes: ...

## Things to Avoid
- Không hallucinate giá
- Không bỏ qua constraint user
- Không trả lời 1-shot khi bài toán multi-step
- Không tạo itinerary khi thiếu dữ liệu quan trọng

## Success Criteria
- Hỏi lại đúng khi thiếu info
- Gọi tool hợp lý
- Không vượt budget
- Có reasoning rõ ràng
- Có fallback khi fail`;

export interface GenerateContentResponse {
  text?: string;
  candidates?: any[];
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen3.6-plus:free"; // Or "meta-llama/llama-3.3-70b-instruct"

export const chatWithTravelAgent = async (messages: { role: string; parts: any[] }[], retryCount = 0): Promise<GenerateContentResponse> => {
  const model = DEFAULT_MODEL;
  const apiKey = (process.env as any).OPENROUTER_API_KEY || "";

  debug.log('AGENT', `Calling model: ${model}`, { messageCount: messages.length, retryCount });

  // Map messages to OpenAI-compatible format (OpenRouter)
  const mappedMessages = messages.map(msg => {
    const role = msg.role === 'model' ? 'assistant' : msg.role;
    const text = msg.parts.map((p: any) => p.text).join('\n');
    return { role, content: text };
  });

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "AI Travel Agent"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: AGENT_RULES
          },
          ...mappedMessages
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    const result: GenerateContentResponse = {
      text: message.content || "",
      candidates: [{ content: { role: 'model', parts: [{ text: message.content || "" }] } }]
    };

    debug.success('AGENT', `Response received`, { textLength: result.text?.length });
    return result;

  } catch (error: any) {
    debug.error('AGENT', `Attempt ${retryCount + 1} failed`, error);
    if (retryCount < 2) {
      await new Promise(r => setTimeout(r, 2000));
      return chatWithTravelAgent(messages, retryCount + 1);
    }
    throw error;
  }
};
