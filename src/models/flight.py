from pydantic import BaseModel, Field
from typing import Optional


class FlightInput(BaseModel):
    origin: str = Field(..., description="Điểm khởi hành. Ví dụ: Hà Nội, TP.HCM")
    destination: str = Field(..., description="Điểm đến. Ví dụ: Đà Nẵng, Phú Quốc")
    departure_time: Optional[str] = Field(None, description="Thời gian khởi hành mong muốn. Ví dụ: 2025-07-15, sáng, chiều, tối")
    trip_type: Optional[str] = Field(None, description="Loại chuyến bay: 'mot chieu' hoặc 'khu hoi'")
    specific_requirements: Optional[str] = Field(None, description="Các yêu cầu cụ thể, ví dụ: bay đêm, hãng bay, hành lý... (nếu có)")


class FlightOutput(BaseModel):
    title: str = Field(..., description="Tiêu đề kết quả tìm kiếm")
    snippet: str = Field(..., description="Mô tả ngắn gọn/trích đoạn từ kết quả tìm kiếm")
    url: str = Field(..., description="URL nguồn thông tin")
    departure_time: Optional[str] = Field(None, description="Thời gian khởi hành nếu trích xuất được từ nội dung")
    trip_type: Optional[str] = Field(None, description="Loại chuyến bay: 'một chiều' hoặc 'khứ hồi' nếu nhận diện được")
    airline: Optional[str] = Field(None, description="Hãng hàng không nếu nhận diện được từ nội dung")
    source: str = Field(default="Brave Search", description="Nguồn dữ liệu")
