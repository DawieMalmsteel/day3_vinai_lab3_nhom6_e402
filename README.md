# AI Travel Agent Chatbot

Ứng dụng React + TypeScript để thử nghiệm so sánh `Chatbot` và `Agent` với Gemini, có telemetry, logs và bảng so sánh chi phí, latency, token.

## 1. Yêu cầu trên máy mới

Máy chưa cài gì vẫn có thể chạy được, chỉ cần:

- `Git`
- `Node.js` bản LTS, nên dùng `Node 20` hoặc `Node 22`
- `npm` đi kèm theo Node.js

Sau khi cài xong, mở terminal mới và kiểm tra:

```bash
node -v
npm -v
git --version
```

Nếu 3 lệnh trên in ra version thì môi trường đã sẵn sàng.

## 2. Lấy source code

Nếu máy chưa có repo:

```bash
git clone https://github.com/DawieMalmsteel/day3_vinai_lab3_nhom6_e402.git
cd day3_vinai_lab3_nhom6_e402
```

Nếu đã có sẵn thư mục project thì chỉ cần `cd` vào thư mục repo.

## 3. Cài dependencies

Chạy:

```bash
npm install
```

Chỉ cần chạy một lần đầu tiên. Nếu `npm install` lỗi do Node quá cũ thì hãy cài lại Node.js bản LTS rồi mở terminal mới.

## 4. Tạo file env

Repo này dùng file `.env` hoặc `.env.local`. Cách đơn giản nhất là tạo `.env` từ `.env.example`.

### PowerShell

```powershell
Copy-Item .env.example .env
```

### macOS / Linux / Git Bash

```bash
cp .env.example .env
```

Sau đó mở file `.env` và điền API key.

## 5. Cấu hình provider trong file config

Project hỗ trợ 2 cách gọi Gemini:

- `google`: gọi trực tiếp Google Gemini API
- `shopaikey`: gọi qua bên thứ 3 `https://api.shopaikey.com`

Bạn có thể **chuyển qua lại giữa Google và provider bên thứ 3** bằng cách sửa file config:

`src/config/apiProvider.ts`

Dòng quan trọng nhất là:

```ts
export const ACTIVE_PROVIDER: ApiProvider = 'google';
```

Hoặc:

```ts
export const ACTIVE_PROVIDER: ApiProvider = 'shopaikey';
```

Nói ngắn gọn:

- Muốn dùng Google trực tiếp: sửa `ACTIVE_PROVIDER = 'google'`
- Muốn dùng provider bên thứ 3: sửa `ACTIVE_PROVIDER = 'shopaikey'`

## 6. Cách dùng Google Gemini trực tiếp

Trong file `src/config/apiProvider.ts`, để:

```ts
export const ACTIVE_PROVIDER: ApiProvider = 'google';
```

Trong file `.env`, điền:

```env
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

Không cần điền `SHOPAIKEY_API_KEY` nếu bạn không dùng ShopAIKey.

## 7. Cách dùng provider bên thứ 3

Trong file `src/config/apiProvider.ts`, sửa thành:

```ts
export const ACTIVE_PROVIDER: ApiProvider = 'shopaikey';
```

Trong file `.env`, điền:

```env
SHOPAIKEY_API_KEY="YOUR_SHOPAIKEY_API_KEY"
```

Không cần điền `GEMINI_API_KEY` nếu bạn không dùng Google trực tiếp.

## 8. Chạy project

Chạy dev server:

```bash
npm run dev
```

Khi chạy thành công, mở trình duyệt tại:

```text
http://localhost:3000
```

Nếu `localhost` không vào được thì thử:

```text
http://127.0.0.1:3000
```

## 9. Cách kiểm tra đã chạy thành công

Sau khi giao diện mở lên, thử các bước sau:

1. Gửi một prompt bất kỳ trong khung chat.
2. Nếu đã điền API key đúng, bot sẽ trả lời.
3. Bấm nút `Telemetry` để mở side panel.
4. Xem tab `Raw Log (JSONL)` để kiểm tra log realtime.
5. Chạy cùng một prompt ở 2 mode `Chatbot` và `Agent` để bảng `So sánh` hiện ra.
6. Kiểm tra thư mục `logs/` để thấy file `.jsonl`, `.json`, `.md` được tạo.

Nếu làm được 6 bước trên thì có thể xem như README này đã chạy thành công trên máy mới.

## 10. Các lệnh hay dùng

### Chạy dev

```bash
npm run dev
```

### Kiểm tra TypeScript

```bash
npm run lint
```

Lưu ý: repo này không có test runner riêng. `npm run lint` là bước kiểm tra chính.

### Build production

```bash
npm run build
```

### Preview bản build

```bash
npm run preview
```

Lưu ý:

- `preview` dùng để xem bản build.
- Tính năng ghi log ra file `logs/` phụ thuộc vào Vite dev server plugin, vì vậy muốn có log file thì nên dùng `npm run dev`.

## 11. Các lỗi thường gặp

### Lỗi API key

Nếu giao diện báo lỗi API key:

- kiểm tra bạn đã điền đúng key trong `.env`
- kiểm tra `ACTIVE_PROVIDER` có trùng với key bạn đang dùng hay không
- sau khi sửa `.env`, hãy tắt terminal cũ và chạy lại `npm run dev`

### Chạy lên nhưng bot không trả lời

Kiểm tra:

- có internet
- API key còn hạn
- provider đang chọn đúng
- terminal có báo lỗi `401`, `403`, `429`, `500` hay không

### Không thấy file trong `logs/`

Kiểm tra:

- bạn đang chạy `npm run dev`, không phải chỉ `npm run preview`
- bạn đã gửi ít nhất 1 tin nhắn trong giao diện
- side panel `Telemetry` có hiện log hay không

### Lỗi khi `npm install`

Thử lần lượt:

1. Cài lại Node.js bản LTS
2. Mở terminal mới
3. Chạy lại:

```bash
npm install
```

## 12. Cấu trúc file quan trọng

- `src/App.tsx`: giao diện chat, mode toggle, telemetry panel
- `src/services/gemini.ts`: gọi model, tool loop, response handling
- `src/config/apiProvider.ts`: file config để chuyển provider qua lại giữa Google và bên thứ 3
- `src/utils/telemetry.ts`: structured log và session log
- `src/utils/metrics.ts`: token, latency, cost
- `src/utils/comparison.ts`: bảng so sánh Chatbot vs Agent
- `server/vite-plugin-logger.ts`: ghi log ra thư mục `logs/`
- `.env.example`: mẫu env để copy thành `.env`

## 13. Ghi chú quan trọng

- Không commit API key thật vào git.
- `.env` chỉ dùng ở máy local.
- Nếu bạn đổi provider thì nhớ đổi cả key tương ứng.
- Để tạo dữ liệu so sánh công bằng, hãy gửi cùng một prompt cho cả `Chatbot` và `Agent`.
