from pydantic import BaseModel, Field
from typing import Optional, List

class HotelInput(BaseModel):
    max_price: float = Field(..., description="Giá phòng tối đa một đêm (ngân sách) mà người dùng có thể trả.")
    location: str = Field(..., description="Địa điểm hoặc thành phố muốn đặt khách sạn.")
    specific_requirements: Optional[str] = Field(None, description="Các yêu cầu cụ thể, ví dụ: khách sạn 5 sao, gần biển, có hồ bơi, ăn sáng... (nếu có)")

class HotelOutput(BaseModel):
    hotel_id: str
    name: str
    price_per_night: float
    location: str
    rating: int
    amenities: List[str]
