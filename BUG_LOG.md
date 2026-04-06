# Bug Report: Tổng hợp lỗi luồng xử lý Chatbot (Knowledge Base & Booking Service)

### Bug 1: Lỗi tra cứu địa điểm trong Knowledge Base (Case-sensitivity Mismatch) (đã debug)
* **Mức độ (Severity):** High (Ảnh hưởng đến việc AI bị thiếu ngữ cảnh chính xác từ hệ thống).
* **Mô tả:** Khi người dùng nhập "tôi Muốn đi Đà nẵng", hệ thống trích xuất được `Location detected: đà nẵng`. Tuy nhiên, khi truy vấn vào Knowledge Base, hệ thống lại báo `Location not found: đà nẵng`, trong khi danh sách Available có chứa `Đà Nẵng`.
* **Nguyên nhân:** Lỗi so sánh chuỗi (String comparison). Hệ thống đang so sánh chính xác tuyệt đối (`===`) giữa chuỗi viết thường (`đà nẵng`) và chuỗi có viết hoa (`Đà Nẵng`) trong database.
* **Đề xuất sửa (Action Item):**
  Cần chuẩn hóa (normalize) cả từ khóa tìm kiếm và dữ liệu trong danh sách về cùng một định dạng (ví dụ: viết thường toàn bộ và xóa khoảng trắng thừa) trước khi so sánh.


### Bug 2: Lỗi AI phớt lờ ràng buộc ngân sách (Constraint Violation) (đã debug)
* **Mức độ (Severity):** Medium (Không gây lỗi hệ thống nhưng làm sai logic nghiệp vụ và giảm trải nghiệm người dùng).
* **Mô tả:** Khi người dùng nhập "lịch trình 2 ngày, budget 5.000.000", AI chỉ đề xuất các điểm đến tham quan mà hoàn toàn bỏ qua việc  dự toán chi phí, 
* **Nguyên nhân:** AI bị phân tán sự chú ý, chỉ tập trung hoàn thành task "lên lịch trình" mà bỏ qua con số ngân sách (lỗi instruction neglect). System Prompt hiện tại chưa có chỉ thị bắt buộc AI phải làm toán.
* **Đề xuất sửa (Action Item):**
  Bổ sung chỉ thị cứng vào System Prompt: "Nếu user cung cấp ngân sách, BẮT BUỘC phải có dự kiến chi phí và đảm bảo tổng chi phí không vượt quá ngân sách."

  
