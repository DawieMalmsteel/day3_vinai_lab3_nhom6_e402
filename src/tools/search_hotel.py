import logging
from typing import List
from models.hotel import HotelInput, HotelOutput

logger = logging.getLogger(__name__)

def search_hotel(req: HotelInput) -> List[HotelOutput]:
    """
    Tìm kiếm khách sạn dựa trên ngân sách tối đa, địa điểm (thành phố) và yêu cầu cụ thể.
    """
    logger.info(f"Searching hotels in {req.location} under {req.max_price}")
    hotels = [
        {"hotel_id": "H001", "name": "Mường Thanh Luxury", "price_per_night": 1200000, "location": "Đà Nẵng", "rating": 5, "amenities": ["gần biển", "hồ bơi", "buffet sáng"]},
        {"hotel_id": "H002", "name": "Vinpearl Resort", "price_per_night": 2500000, "location": "Nha Trang", "rating": 5, "amenities": ["gần biển", "hồ bơi riêng", "spa", "buffet sáng"]},
        {"hotel_id": "H003", "name": "Ibis Styles", "price_per_night": 800000, "location": "TP.HCM", "rating": 4, "amenities": ["trung tâm", "gym", "buffet sáng"]},
        {"hotel_id": "H004", "name": "Hanoi Boutique Hotel", "price_per_night": 600000, "location": "Hà Nội", "rating": 3, "amenities": ["gần phố cổ", "giặt ủi"]},
        {"hotel_id": "H005", "name": "Sapa Lodge", "price_per_night": 900000, "location": "Sapa", "rating": 4, "amenities": ["view núi", "nhà hàng", "lò sưởi"]},
        {"hotel_id": "H006", "name": "Pullman Danang Beach Resort", "price_per_night": 2800000, "location": "Đà Nẵng", "rating": 5, "amenities": ["gần biển", "spa", "hồ bơi vô cực", "nhà hàng cao cấp"]},
        {"hotel_id": "H007", "name": "Dalat Palace Heritage Hotel", "price_per_night": 3500000, "location": "Đà Lạt", "rating": 5, "amenities": ["trung tâm", "view hồ", "kiến trúc Pháp", "nhà hàng", "sân golf"]},
        {"hotel_id": "H008", "name": "Colline Hotel", "price_per_night": 1500000, "location": "Đà Lạt", "rating": 4, "amenities": ["trung tâm", "gần chợ", "view thành phố", "buffet sáng"]},
        {"hotel_id": "H009", "name": "JW Marriott Phu Quoc Emerald Bay Resort & Spa", "price_per_night": 6500000, "location": "Phú Quốc", "rating": 5, "amenities": ["gần biển", "bãi biển riêng", "kiến trúc độc đáo", "spa", "gym", "nhiều nhà hàng"]},
        {"hotel_id": "H010", "name": "Novotel Phu Quoc Resort", "price_per_night": 2000000, "location": "Phú Quốc", "rating": 4, "amenities": ["gần biển", "hồ bơi", "thích hợp cho gia đình", "buffet sáng"]},
        {"hotel_id": "H011", "name": "Sofitel Legend Metropole", "price_per_night": 5000000, "location": "Hà Nội", "rating": 5, "amenities": ["trung tâm", "kiến trúc Pháp", "hồ bơi nước nóng", "spa", "nhà hàng cao cấp"]},
        {"hotel_id": "H012", "name": "Lotte Hotel Hanoi", "price_per_night": 3000000, "location": "Hà Nội", "rating": 5, "amenities": ["view toàn cảnh", "gym", "hồ bơi trong nhà/ngoài trời", "gần trung tâm thương mại"]},
        {"hotel_id": "H013", "name": "Park Hyatt Saigon", "price_per_night": 4500000, "location": "TP.HCM", "rating": 5, "amenities": ["trung tâm", "kiến trúc thuộc địa", "hồ bơi", "spa", "nhà hàng Ý/Pháp"]},
        {"hotel_id": "H014", "name": "The Reverie Saigon", "price_per_night": 8000000, "location": "TP.HCM", "rating": 5, "amenities": ["nội thất sang trọng", "view sông", "trung tâm", "spa", "hồ bơi"]},
        {"hotel_id": "H015", "name": "Little Riverside Hoi An", "price_per_night": 1800000, "location": "Hội An", "rating": 4, "amenities": ["gần phố cổ", "view sông", "kiến trúc cổ", "hồ bơi", "spa"]},
    ]
    
    results = [h for h in hotels if h["price_per_night"] <= req.max_price]
    
    # Ở đây chúng ta trả về các khách sạn kèm theo danh sách amenities.
    # LLM sẽ dựa vào specific_requirements và amenities để tự gợi ý cho khách hàng!
    
    return [HotelOutput(**h) for h in results]
