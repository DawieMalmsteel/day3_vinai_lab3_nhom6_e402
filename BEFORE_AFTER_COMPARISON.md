# 🔄 System Prompt Before & After Comparison

## Side-by-Side Comparison

### 📌 **Test Case 1: User says "Chào"**

#### ❌ BEFORE (Unfriendly)
```
User: "Chào"

Bot: "Xin lỗi! Tôi chỉ hỗ trợ về các chủ đề sau:

✈️ Chuyến bay - Tìm vé, so sánh giá, đặt chuyến 
🚌 Xe bus - Các tuyến xe, giá vé, đặt vé 
🏨 Khách sạn - Tìm phòng, so sánh, đặt phòng 
📍 Địa điểm du lịch - Cẩm nang, lịch trình, địa điểm tham quan

Bạn muốn tìm chuyến bay, xe bus, khách sạn hoặc thông tin du lịch nào?"

❌ Issues:
  - Starts with "Xin lỗi" (apologetic)
  - Immediately dumps scope list
  - Not welcoming for simple greeting
  - Feels cold & robotic
```

#### ✅ AFTER (Friendly)
```
User: "Chào"

Bot: "Xin chào! Rất vui được gặp bạn 😊
Tôi là trợ lý du lịch AI của bạn. 
Có gì tôi có thể giúp bạn hôm nay?"

✅ Improvements:
  - Starts with warm greeting
  - Introduces itself naturally
  - Asks about needs first
  - Friendly emoji & tone
  - Scope list NOT shown unless user asks
```

---

### 📌 **Test Case 2: User asks "Giá xe bus Hà Nội - Hải Phòng?"**

#### ❌ BEFORE (Xe bus not explicit)
```
User: "Giá xe bus Hà Nội đến Hải Phòng bao nhiêu?"

Prompt says:
"🚌 Xe bus - Các tuyến xe, giá vé, đặt vé"

✅ It's listed, but:
  - Generic description
  - No pricing guidance
  - No company examples
```

#### ✅ AFTER (Xe bus explicit & detailed)
```
User: "Giá xe bus Hà Nội đến Hải Phòng bao nhiêu?"

Bot Response (following new prompt):
"🚌 Vé xe buýt Hà Nội → Hải Phòng:

- **Giá:** 50-100k/vé (tùy loại ghế)
- **Thời gian:** ~2h
- **Nhà xe:** Việt Tín, Tuyến Phát, Nam Cường

Bạn muốn đặt vé hoặc cần thông tin chuyến khác?"

✅ Improvements:
  - Xe bus explicitly supported
  - Pricing examples provided
  - Company names listed
  - Follow-up question included
```

---

### 📌 **Test Case 3: User asks "Nhà hàng nào ngon?"**

#### ❌ BEFORE (Curt rejection)
```
User: "Biết nhà hàng nào ngon ở Hà Nội không?"

Bot: "Xin lỗi! Tôi chỉ hỗ trợ về các chủ đề sau:
✈️ Chuyến bay...
🚌 Xe bus...
🏨 Khách sạn...
📍 Địa điểm du lịch..."

❌ Issues:
  - Dumps scope list again
  - Doesn't explain why
  - Not helpful or warm
  - Frustrating for user
```

#### ✅ AFTER (Polite & helpful redirect)
```
User: "Biết nhà hàng nào ngon ở Hà Nội không?"

Bot: "Xin lỗi, tôi chuyên về du lịch và không có 
thông tin về nhà hàng. 

Nhưng tôi có thể giúp bạn với chuyến bay, xe bus, 
khách sạn, hoặc lên kế hoạch du lịch Hà Nội. 
Bạn muốn gì?"

✅ Improvements:
  - Explains limitation kindly
  - Suggests relevant alternatives
  - Still helpful tone
  - Converts to travel discussion
  - Asks what user needs
```

---

## 📊 Prompt Structure Comparison

### BEFORE
```
## 🎯 PHẠM VI HỖ TRỢ
✈️ Chuyến bay
🚌 Xe bus
🏨 Khách sạn
📍 Du lịch

## ❌ PHẠM VI TỪ CHỐI
Không hỗ trợ...

## 📝 LUẬT TRẢ LỜI
1. Ngắn gọn
2. Link Markdown
...

## 💡 VÍ DỤ
(Single example, generic)
```

### AFTER
```
## 👋 GREETING & WELCOME ← NEW!
Khi user chào: warm greeting, ask needs, NO scope dump

## 🎯 PHẠM VI HỖ TRỢ
✈️ Chuyến bay
🚌 **Xe bus/Xe khách** ← More explicit
🏨 Khách sạn
📍 Du lịch

## ❌ OUT-OF-SCOPE (Polite rejection template)
"Xin lỗi, tôi chuyên về du lịch...
Nhưng tôi có thể giúp bạn với..."

## 📝 LUẬT TRẢ LỜI
1. Ngắn gọn
2. Link Markdown
...

## 💡 EXAMPLES ← 3 detailed examples!
1. Greeting (friendly)
2. In-scope (concise with links)
3. Out-of-scope (polite rejection)
```

---

## 🎯 Key Metrics

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| **Greeting Tone** | Curt | Warm 😊 | **+User satisfaction** |
| **Scope List Shown** | Always | Only if needed | **-Clutter, +Focus** |
| **Xe Bus Support** | Generic | Explicit | **+Clarity** |
| **Out-of-Scope Rejection** | Scope dump | Helpful redirect | **+Conversion** |
| **Examples** | 1 generic | 3 detailed | **+Guidance** |
| **Conversational** | Robotic | Natural | **+UX** |
| **Response Quality** | Varies | Consistent | **+Predictability** |

---

## 🚀 Real-World Impact

### Scenario A: New User
```
BEFORE:
User thinks: "Why is it apologizing? Seems unhelpful"
Outcome: ❌ Poor first impression

AFTER:
User thinks: "Nice! Friendly AI assistant"
Outcome: ✅ Good first impression
```

### Scenario B: Out-of-Scope Question
```
BEFORE:
User thinks: "I want restaurant recommendations, but this bot 
just shows me the same boring list again"
Outcome: ❌ Frustrated, abandons chat

AFTER:
User thinks: "OK, it can't help with restaurants, but it can 
help me plan my trip instead"
Outcome: ✅ Redirected to relevant service
```

### Scenario C: Xe Bus Question
```
BEFORE:
User: "Does this bot support buses?"
Bot: "🚌 Xe bus - Các tuyến xe, giá vé, đặt vé"
User thinks: "Not sure if it really knows bus details..."

AFTER:
Bot: "🚌 Vé xe buýt Hà Nội → Hải Phòng:
- **Giá:** 50-100k/vé
- **Thời gian:** ~2h
- **Nhà xe:** Việt Tín..."
User thinks: "Yes, it definitely supports buses with real info!"
```

---

## ✅ Backward Compatibility

- ✅ No breaking changes to code
- ✅ Same 4 support topics
- ✅ Same Markdown link format
- ✅ Same Gemini API interface
- ✅ Only prompt text improved
- ✅ Can revert if needed

---

## 📈 Expected Improvements

1. **User Engagement**
   - Higher greeting acceptance
   - More conversations initiated
   - Better retention

2. **Out-of-Scope Handling**
   - Fewer user frustrations
   - More redirections to valid topics
   - Better conversion

3. **Bus Bookings**
   - Clearer availability
   - More bookings (explicit support)
   - Better user confidence

4. **Response Quality**
   - Consistent tone
   - Better structure
   - More helpful

---

---

# 🐛 Bug Fixes & Changes Log

## 🔧 Fix 1: Agent & Chatbot trả kết quả giống nhau (Critical)

### Vấn đề
Cùng 1 prompt (VD: `"kế hoạch đi đà nẵng"`), cả **Agent** và **Chatbot** đều trả kết quả **giống hệt nhau**. Chatbot đáng lẽ phải gọi Gemini API trực tiếp nhưng lại bị local handler chặn trước.

### Nguyên nhân
Tất cả 6 local feature handlers (Hotel, Trip Planner, Price Comparison, Restaurant, Local Transport, Activity) chạy cho **cả hai mode** — không phân biệt agent hay chatbot. Khi user gõ prompt khớp keyword, local handler bắt và return ngay → **chatbot không bao giờ gọi Gemini API**.

**File:** `src/App.tsx` (lines 291-452)

### Before (Sai)
```
// Chạy cho CẢ HAI mode — chatbot bị chặn ở đây
if (detectTripPlanRequest(userMessage)) {
  // ... trả mock data, return
}
if (detectRestaurantRequest(userMessage)) {
  // ... trả mock data, return  
}
// ... 4 handlers khác cũng vậy
// → Chatbot KHÔNG BAO GIỜ đến được chỗ gọi Gemini API
```

### After (Đúng)
```
// Chỉ Agent mode mới dùng local handlers
if (mode === 'agent') {
  if (detectTripPlanRequest(userMessage)) { ... return; }
  if (detectRestaurantRequest(userMessage)) { ... return; }
  // ... 4 handlers khác
} // end if (mode === 'agent')

// Chatbot mode → bỏ qua local handlers → gọi Gemini API trực tiếp
```

### Kết quả
| Mode | Before | After |
|------|--------|-------|
| **Agent** | Local mock data (nhanh, cost=0) | Local mock data (nhanh, cost=0) |
| **Chatbot** | Local mock data (giống agent!) | Gemini API response (khác agent) |

→ Comparison dashboard giờ thể hiện **sự khác biệt thực sự**: tokens, cost, latency khác nhau rõ ràng.

---

## 🔧 Fix 2: "kế hoạch đi đà nẵng" gây lỗi ở Agent mode

### Vấn đề
Khi gõ `"kế hoạch đi đà nẵng"` ở agent mode → hiện lỗi: **"Đã có lỗi xảy ra. Vui lòng thử lại sau."**

### Nguyên nhân
`detectTripPlanRequest()` chỉ có 2 keywords: `'lên kế hoạch'` và `'kế hoạch chuyến đi'`. Cụm `"kế hoạch đi"` không khớp → prompt rơi xuống gọi Gemini API → API lỗi (thiếu key hoặc mạng).

**File:** `src/services/tripPlannerService.ts` (line 10-15)

### Before
```typescript
const tripKeywords = [
  'lên kế hoạch', 'kế hoạch chuyến đi',
  'itinerary', 'lịch trình', 'lên plan', 'planning',
];
```

### After
```typescript
const tripKeywords = [
  'lên kế hoạch', 'kế hoạch chuyến đi', 'kế hoạch đi', 'kế hoạch du lịch',
  'itinerary', 'lịch trình', 'lên plan', 'planning',
  'plan đi', 'lên lịch đi', 'lập kế hoạch',
];
```

→ Giờ `"kế hoạch đi đà nẵng"` khớp keyword `'kế hoạch đi'` → local handler xử lý đúng.

---

## 🔧 Fix 3: Local features không có telemetry (latency/cost tracking)

### Vấn đề
6 local feature handlers return sớm trước khi `startSessionLog()` được gọi → **không có session** → **không có summary** → comparison dashboard **không bao giờ hiện**.

### Giải pháp
Thêm helper `trackLocalFeature()` trong `src/App.tsx`:

**File:** `src/App.tsx` (lines 133-180)

```typescript
const trackLocalFeature = (
  featureName: string,
  query: string,
  responseText: string,
  startMs: number,
) => {
  const latencyMs = Date.now() - startMs;
  const session = startSessionLog(mode, query, PROVIDER, MODEL);
  logEvent('LLM_METRIC', {
    label: mode, provider: PROVIDER, model: MODEL, step: 1,
    prompt_tokens: 0, completion_tokens: 0, thinking_tokens: 0,
    tool_use_prompt_tokens: 0, total_tokens: 0,
    latency_ms: latencyMs, estimated_cost_usd: 0,
    cost_breakdown: { input_cost: 0, output_cost: 0, thinking_cost: 0 },
    feature: featureName, is_local: true,
  });
  endSession(responseText.slice(0, 200), { feature: featureName, is_local: true, latency_ms: latencyMs });
  // ... finalize summary → set state
};
```

Áp dụng cho tất cả 6 handlers: `HOTEL_SEARCH`, `TRIP_PLANNER`, `PRICE_COMPARISON`, `RESTAURANT`, `LOCAL_TRANSPORT`, `ACTIVITY`.

→ Mỗi local feature giờ có **latency thực** (ms) trong telemetry, comparison dashboard hoạt động đúng.

---

## 🔧 Fix 4: Error handling cải thiện

### Vấn đề
Catch block chỉ hiện message chung `"Đã có lỗi xảy ra"` → khó debug.

### Giải pháp
Phân loại lỗi cụ thể trong `src/App.tsx`:

**File:** `src/App.tsx` (lines 602-629)

```typescript
// Before: chỉ có 1 message chung
let errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';

// After: phân loại chi tiết
if (errMsg.includes('401') || errMsg.includes('403')) {
  errorMessage = 'API key không hợp lệ hoặc hết hạn.';
} else if (errMsg.includes('429')) {
  errorMessage = 'Hệ thống đang quá tải. Đợi 1-2 phút rồi thử lại.';
} else if (errMsg.includes('500') || errMsg.includes('503')) {
  errorMessage = 'Lỗi máy chủ.';
} else if (errMsg.includes('Failed to fetch')) {
  errorMessage = 'Lỗi kết nối mạng.';
}
console.error('[APP] Chi tiết lỗi:', errMsg, error);
```

---

## 📊 Tổng kết thay đổi

| File | Thay đổi |
|------|----------|
| `src/App.tsx` | Wrap local handlers trong `if (mode === 'agent')`, thêm `trackLocalFeature()`, cải thiện error handling |
| `src/services/tripPlannerService.ts` | Thêm keywords cho `detectTripPlanRequest()` |

### Flow sau khi fix

```
User gõ prompt (VD: "kế hoạch đi đà nẵng")
├── Agent mode:
│   ├── detectTripPlanRequest() ✅ khớp
│   ├── generateItinerary() → mock data
│   ├── trackLocalFeature() → ghi telemetry (latency, cost=0)
│   └── return (nhanh, ~5ms)
│
└── Chatbot mode:
    ├── Bỏ qua local handlers (mode !== 'agent')
    ├── Gọi Gemini API trực tiếp (không tools)
    ├── recordLlmMetric() → ghi telemetry (latency, tokens, cost thực)
    └── return (chậm hơn, ~1-3s, có token/cost)
```

→ Comparison dashboard hiện **sự khác biệt rõ ràng** giữa Agent vs Chatbot.

---

**Generated:** 2025-04-06  
**Updated:** 2026-04-06  
**Status:** ✅ All bugs fixed, ready for testing
