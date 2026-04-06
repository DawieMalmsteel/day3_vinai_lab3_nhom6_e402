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
### brave_search
Input: query
Output: Tin tức, giá cả, thông tin cập nhật từ internet.

### search_flights (có thể dùng brave_search)
### search_hotels (có thể dùng brave_search)
### get_places (có thể dùng brave_search)
### get_weather (có thể dùng brave_search)

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

// Brave Search Tool
export const brave_search = async (query: string): Promise<string> => {
  debug.log('BRAVE_SEARCH', `Searching for: ${query}`);
  const apiKey = (process.env as any).BRAVE_SEARCH_API_KEY || "";
  
  if (!apiKey) {
    debug.error('BRAVE_SEARCH', 'Missing BRAVE_SEARCH_API_KEY');
    return "Lỗi: Chưa cấu hình API key cho Brave Search.";
  }

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": apiKey
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    const results = data.web?.results || [];
    
    const formattedResults = results.slice(0, 5).map((res: any) => 
      `### ${res.title}\n${res.description}\nURL: ${res.url}`
    ).join('\n\n');

    debug.success('BRAVE_SEARCH', `Found ${results.length} results`);
    return formattedResults || "Không tìm thấy kết quả tìm kiếm nào.";
  } catch (error) {
    debug.error('BRAVE_SEARCH', 'Search failed', error);
    return "Lỗi khi thực hiện tìm kiếm trên internet.";
  }
};

const tools = [
  {
    type: "function",
    function: {
      name: "brave_search",
      description: "Tìm kiếm thông tin trên internet về du lịch, chuyến bay, khách sạn, thời tiết và các địa điểm tham quan.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Câu truy vấn tìm kiếm (VD: giá vé máy bay đi Đà Nẵng, thời tiết Phú Quốc tháng 12)" },
        },
        required: ["query"],
      }
    }
  }
];

export interface GenerateContentResponse {
  text?: string;
  functionCalls?: { name: string; args: any; id?: string }[];
  candidates?: any[];
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen3.6-plus:free"; 

export const chatWithTravelAgent = async (messages: { role: string; parts: any[] }[], retryCount = 0): Promise<GenerateContentResponse> => {
  const model = DEFAULT_MODEL;
  const apiKey = (process.env as any).OPENROUTER_API_KEY || "";

  debug.log('AGENT', `Calling model: ${model}`, { messageCount: messages.length, retryCount });

  // Map messages to OpenAI-compatible format (OpenRouter)
  const mappedMessages = messages.map(msg => {
    const role = msg.role === 'model' ? 'assistant' : msg.role === 'function' ? 'tool' : msg.role;
    
    if (msg.parts && msg.parts[0]?.functionResponse) {
      const part = msg.parts[0].functionResponse;
      return {
        role: 'tool',
        tool_call_id: part.id || 'id_placeholder',
        content: JSON.stringify(part.response)
      };
    }

    if (msg.parts && msg.parts[0]?.functionCall) {
      return {
        role: 'assistant',
        content: null,
        tool_calls: msg.parts.map((p: any) => ({
          id: p.functionCall.id || 'id_placeholder',
          type: 'function',
          function: {
            name: p.functionCall.name,
            arguments: JSON.stringify(p.functionCall.args)
          }
        }))
      };
    }

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
        tools: tools,
        tool_choice: "auto"
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    const parts: any[] = [{ text: message.content || "" }];
    if (message.tool_calls) {
      message.tool_calls.forEach((tc: any) => {
        parts.push({
          functionCall: {
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
            id: tc.id
          }
        });
      });
    }

    const result: GenerateContentResponse = {
      text: message.content || "",
      functionCalls: message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments)
      })),
      candidates: [{ content: { role: 'model', parts: parts } }]
    };

    debug.success('AGENT', `Response received`, { 
      textLength: result.text?.length, 
      toolCalls: result.functionCalls?.length 
    });

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

export const handleToolCalls = async (response: GenerateContentResponse) => {
  const functionCalls = response.functionCalls;
  if (!functionCalls) return null;

  debug.group(`Handling ${functionCalls.length} tool call(s)`);
  const results = [];

  for (const call of functionCalls) {
    debug.log('TOOL_HANDLER', `Processing tool: ${call.name}`, call.args);

    let content = "";
    if (call.name === "brave_search") {
      content = await brave_search(call.args.query);
    }

    results.push({
      functionResponse: {
        name: call.name,
        response: { content },
        id: call.id
      }
    });
  }

  debug.groupEnd();
  return results;
};
