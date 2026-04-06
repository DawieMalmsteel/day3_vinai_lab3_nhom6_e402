from pydantic import BaseModel, Field
from typing import Optional, List


class HotelInput(BaseModel):
    max_price: float = Field(
        ...,
        description="Giá phòng tối đa một đêm (VND) mà người dùng có thể trả.",
    )
    location: str = Field(
        ...,
        description="Địa điểm hoặc thành phố muốn đặt khách sạn. Ví dụ: Da Nang, Nha Trang, Ho Chi Minh",
    )
    checkin: Optional[str] = Field(
        None,
        description="Ngày nhận phòng, định dạng YYYY-MM-DD. Nếu không có, mặc định là ngày mai.",
    )
    checkout: Optional[str] = Field(
        None,
        description="Ngày trả phòng, định dạng YYYY-MM-DD. Nếu không có, mặc định là ngày kia.",
    )
    adults: Optional[int] = Field(
        default=2,
        description="Số lượng người lớn (tối thiểu 1).",
    )
    rooms: Optional[int] = Field(
        default=1,
        description="Số lượng phòng cần đặt.",
    )
    children: Optional[int] = Field(
        default=0,
        description="Số lượng trẻ em (0-10).",
    )
    currency: Optional[str] = Field(
        default="VND",
        description="Loại tiền tệ: VND, USD, EUR, v.v.",
    )
    specific_requirements: Optional[str] = Field(
        None,
        description="Các yêu cầu cụ thể, ví dụ: khách sạn 5 sao, gần biển, có hồ bơi (nếu có)",
    )


class HotelOutput(BaseModel):
    hotel_id: str
    name: str
    price_per_night: float
    location: str
    rating: Optional[float] = None
    cheapest_vendor: Optional[str] = None
    vendors_info: List[str] = Field(
        default_factory=list,
        description="Danh sách 'vendor: giá' từ top 4 nhà cung cấp rẻ nhất",
    )
    image_url: Optional[str] = None
    source: str = "Makcorps API"
