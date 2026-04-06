- Nguyễn Anh Quân vẽ workflow filter cho user và tối ưu system prompt
- Trần Sơn làm về search hotel system prompt
- Phạm Đăng Phong debug log AI
- Đào Hồng Sơn thêm provider Gemini bên thứ 3, thêm logs, so sánh chi phí khi dùng aganet và chatbot
- Phạm Minh Khang thêm provider Openrouter cho app, thêm brave search cho app
- Phan Dương Định init projects, tạo giao diện, thêm connect Gemini AI cho app, ghi đè system prompt, access websearch, thêm thông tin ban đầu cho chat nếu user thiếu thông tin phải hỏi thêm, thêm Agent.md cho vibe code, thêm lớp bảo vệ cho AI chỉ trả lời câu hỏi trong vùng được cho phép

## Run Locally

**Prerequisites:**  `[nodejs](https://nodejs.org/en/download)`

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
