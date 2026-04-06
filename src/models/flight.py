from pydantic import BaseModel, Field
from typing import Optional, List


class FlightInput(BaseModel):
    max_price: float = Field(..., description="Giá vé tối đa (ngân sách) người dùng có thể trả.")
    origin: str = Field(..., description="Điểm khởi hành. Ví dụ: Hà Nội, TP.HCM")
    destination: str = Field(..., description="Điểm đến. Ví dụ: Đà Nẵng, Phú Quốc")
    specific_requirements: Optional[str] = Field(None, description="Các yêu cầu cụ thể, ví dụ: vé rẻ nhất, bay đêm, hãng bay, hành lý... (nếu có)")


class FlightOutput(BaseModel):
    title: str = Field(..., description="Tiêu đề kết quả tìm kiếm")
    snippet: str = Field(..., description="Mô tả ngắn gọn/trích đoạn từ kết quả tìm kiếm")
    url: str = Field(..., description="URL nguồn thông tin")
    price: Optional[float] = Field(None, description="Giá vé máy bay (VND) nếu trích xuất được từ nội dung")
    airline: Optional[str] = Field(None, description="Hãng hàng không nếu nhận diện được từ nội dung")
    source: str = Field(default="Brave Search", description="Nguồn dữ liệu")
