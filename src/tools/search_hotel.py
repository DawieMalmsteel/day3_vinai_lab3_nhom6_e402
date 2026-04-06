import logging
import os
import re
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from models.hotel import HotelInput, HotelOutput

logger = logging.getLogger(__name__)

MAKCORPS_BASE_URL = "https://api.makcorps.com"
MAKCORPS_TIMEOUT = 30
MAX_RETRIES = 1

_city_id_cache: Dict[str, Optional[str]] = {}

# ---------------------------------------------------------------------------
# Curated fallback data (used when Makcorps API is unavailable / rate-limited)
# ---------------------------------------------------------------------------
_FALLBACK_HOTELS = [
    {"hotel_id": "H001", "name": "Mường Thanh Luxury Đà Nẵng", "price_per_night": 1200000, "location": "Đà Nẵng", "rating": 4.5, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 1,200,000", "Agoda: 1,300,000", "Traveloka: 1,350,000"]},
    {"hotel_id": "H002", "name": "Vinpearl Resort Nha Trang", "price_per_night": 2500000, "location": "Nha Trang", "rating": 5.0, "cheapest_vendor": "Vinpearl.com", "vendors_info": ["Vinpearl.com: 2,500,000", "Booking.com: 2,700,000", "Agoda: 2,650,000"]},
    {"hotel_id": "H003", "name": "Ibis Styles Saigon Centre", "price_per_night": 800000, "location": "TP.HCM", "rating": 3.5, "cheapest_vendor": "Agoda", "vendors_info": ["Agoda: 800,000", "Booking.com: 850,000", "Traveloka: 870,000"]},
    {"hotel_id": "H004", "name": "Hanoi La Siesta Diamond", "price_per_night": 950000, "location": "Hà Nội", "rating": 4.5, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 950,000", "Trip.com: 980,000", "Agoda: 1,000,000"]},
    {"hotel_id": "H005", "name": "Sapa Jade Hill Resort", "price_per_night": 900000, "location": "Sapa", "rating": 4.0, "cheapest_vendor": "Traveloka", "vendors_info": ["Traveloka: 900,000", "Booking.com: 950,000", "Agoda: 980,000"]},
    {"hotel_id": "H006", "name": "Pullman Danang Beach Resort", "price_per_night": 2800000, "location": "Đà Nẵng", "rating": 5.0, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 2,800,000", "Agoda: 2,900,000", "Expedia: 3,000,000"]},
    {"hotel_id": "H007", "name": "Dalat Palace Heritage Hotel", "price_per_night": 3500000, "location": "Đà Lạt", "rating": 5.0, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 3,500,000", "Trip.com: 3,600,000", "Agoda: 3,650,000"]},
    {"hotel_id": "H008", "name": "Colline Hotel Đà Lạt", "price_per_night": 1500000, "location": "Đà Lạt", "rating": 4.0, "cheapest_vendor": "Traveloka", "vendors_info": ["Traveloka: 1,500,000", "Booking.com: 1,550,000", "Agoda: 1,600,000"]},
    {"hotel_id": "H009", "name": "JW Marriott Phu Quoc", "price_per_night": 6500000, "location": "Phú Quốc", "rating": 5.0, "cheapest_vendor": "Marriott.com", "vendors_info": ["Marriott.com: 6,500,000", "Booking.com: 6,800,000", "Agoda: 7,000,000"]},
    {"hotel_id": "H010", "name": "Novotel Phu Quoc Resort", "price_per_night": 2000000, "location": "Phú Quốc", "rating": 4.0, "cheapest_vendor": "Agoda", "vendors_info": ["Agoda: 2,000,000", "Booking.com: 2,100,000", "Traveloka: 2,150,000"]},
    {"hotel_id": "H011", "name": "Sofitel Legend Metropole Hanoi", "price_per_night": 5000000, "location": "Hà Nội", "rating": 5.0, "cheapest_vendor": "Sofitel.com", "vendors_info": ["Sofitel.com: 5,000,000", "Booking.com: 5,200,000", "Agoda: 5,300,000"]},
    {"hotel_id": "H012", "name": "Lotte Hotel Hanoi", "price_per_night": 3000000, "location": "Hà Nội", "rating": 5.0, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 3,000,000", "Trip.com: 3,100,000", "Agoda: 3,150,000"]},
    {"hotel_id": "H013", "name": "Park Hyatt Saigon", "price_per_night": 4500000, "location": "TP.HCM", "rating": 5.0, "cheapest_vendor": "Hyatt.com", "vendors_info": ["Hyatt.com: 4,500,000", "Booking.com: 4,700,000", "Agoda: 4,800,000"]},
    {"hotel_id": "H014", "name": "The Reverie Saigon", "price_per_night": 8000000, "location": "TP.HCM", "rating": 5.0, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 8,000,000", "Agoda: 8,200,000", "Expedia: 8,500,000"]},
    {"hotel_id": "H015", "name": "Little Riverside Hoi An", "price_per_night": 1800000, "location": "Hội An", "rating": 4.5, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 1,800,000", "Agoda: 1,850,000", "Traveloka: 1,900,000"]},
    {"hotel_id": "H016", "name": "TMS Hotel Da Nang Beach", "price_per_night": 1100000, "location": "Đà Nẵng", "rating": 4.0, "cheapest_vendor": "Agoda", "vendors_info": ["Agoda: 1,100,000", "Booking.com: 1,200,000", "Traveloka: 1,250,000"]},
    {"hotel_id": "H017", "name": "Balcona Hotel Da Nang", "price_per_night": 850000, "location": "Đà Nẵng", "rating": 4.0, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 850,000", "Agoda: 900,000", "Trip.com: 920,000"]},
    {"hotel_id": "H018", "name": "Nesta Hotel Nha Trang", "price_per_night": 700000, "location": "Nha Trang", "rating": 3.5, "cheapest_vendor": "Traveloka", "vendors_info": ["Traveloka: 700,000", "Agoda: 750,000", "Booking.com: 780,000"]},
    {"hotel_id": "H019", "name": "Mia Resort Nha Trang", "price_per_night": 3200000, "location": "Nha Trang", "rating": 5.0, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 3,200,000", "Agoda: 3,400,000", "Expedia: 3,500,000"]},
    {"hotel_id": "H020", "name": "InterContinental Danang Sun Peninsula", "price_per_night": 9500000, "location": "Đà Nẵng", "rating": 5.0, "cheapest_vendor": "IHG.com", "vendors_info": ["IHG.com: 9,500,000", "Booking.com: 9,800,000", "Agoda: 10,000,000"]},
    {"hotel_id": "H021", "name": "Wink Hotel Saigon Centre", "price_per_night": 650000, "location": "TP.HCM", "rating": 3.5, "cheapest_vendor": "Agoda", "vendors_info": ["Agoda: 650,000", "Booking.com: 700,000", "Traveloka: 720,000"]},
    {"hotel_id": "H022", "name": "Fusion Maia Da Nang", "price_per_night": 4200000, "location": "Đà Nẵng", "rating": 5.0, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 4,200,000", "Agoda: 4,400,000", "Expedia: 4,500,000"]},
    {"hotel_id": "H023", "name": "Hanoi Peridot Hotel", "price_per_night": 550000, "location": "Hà Nội", "rating": 3.0, "cheapest_vendor": "Agoda", "vendors_info": ["Agoda: 550,000", "Booking.com: 580,000", "Trip.com: 600,000"]},
    {"hotel_id": "H024", "name": "Vinpearl Resort & Spa Phú Quốc", "price_per_night": 3800000, "location": "Phú Quốc", "rating": 5.0, "cheapest_vendor": "Vinpearl.com", "vendors_info": ["Vinpearl.com: 3,800,000", "Booking.com: 4,000,000", "Agoda: 4,100,000"]},
    {"hotel_id": "H025", "name": "Ana Mandara Huế", "price_per_night": 2200000, "location": "Huế", "rating": 4.5, "cheapest_vendor": "Booking.com", "vendors_info": ["Booking.com: 2,200,000", "Agoda: 2,300,000", "Traveloka: 2,350,000"]},
    {"hotel_id": "H026", "name": "Pilgrimage Village Huế", "price_per_night": 1600000, "location": "Huế", "rating": 4.0, "cheapest_vendor": "Agoda", "vendors_info": ["Agoda: 1,600,000", "Booking.com: 1,700,000", "Traveloka: 1,750,000"]},
]

_CITY_ALIASES: Dict[str, List[str]] = {
    "Đà Nẵng": ["da nang", "danang", "đà nẵng"],
    "Nha Trang": ["nha trang", "nhatrang"],
    "TP.HCM": ["ho chi minh", "hcm", "tp.hcm", "saigon", "sài gòn", "tp hcm", "hồ chí minh", "tp. hồ chí minh"],
    "Hà Nội": ["ha noi", "hanoi", "hà nội"],
    "Sapa": ["sapa", "sa pa"],
    "Đà Lạt": ["da lat", "dalat", "đà lạt"],
    "Phú Quốc": ["phu quoc", "phú quốc", "phuquoc"],
    "Hội An": ["hoi an", "hoian", "hội an"],
    "Huế": ["hue", "huế"],
}


def _normalize_location(location: str) -> str:
    q = location.lower().strip()
    for canonical, aliases in _CITY_ALIASES.items():
        if any(a in q for a in aliases):
            return canonical
    return location


# ---------------------------------------------------------------------------
# Makcorps API helpers
# ---------------------------------------------------------------------------

def _get_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(
        total=MAX_RETRIES,
        backoff_factor=1,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    session.mount("https://", HTTPAdapter(max_retries=retries))
    return session


def _get_city_id(api_key: str, location: str) -> Optional[str]:
    """Mapping API: resolve city name → cityid (GEO type document_id)."""
    cache_key = location.lower().strip()
    if cache_key in _city_id_cache:
        return _city_id_cache[cache_key]

    session = _get_session()
    try:
        resp = session.get(
            f"{MAKCORPS_BASE_URL}/mapping",
            params={"api_key": api_key, "name": location},
            timeout=MAKCORPS_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, list) or not data:
            _city_id_cache[cache_key] = None
            return None

        for entry in data:
            if isinstance(entry, dict) and entry.get("type") == "GEO":
                city_id = str(entry.get("document_id", ""))
                if city_id:
                    logger.info(f"Mapping: '{location}' → cityid={city_id}")
                    _city_id_cache[cache_key] = city_id
                    return city_id

        if isinstance(data[0], dict) and data[0].get("document_id"):
            city_id = str(data[0]["document_id"])
            _city_id_cache[cache_key] = city_id
            return city_id

        _city_id_cache[cache_key] = None
        return None
    except requests.RequestException as e:
        logger.warning(f"Mapping API error: {e}")
        return None
    finally:
        session.close()


def _parse_price(raw: Any) -> Optional[float]:
    if isinstance(raw, (int, float)):
        return float(raw) if raw > 0 else None
    if not isinstance(raw, str):
        return None
    cleaned = raw.strip()
    if not cleaned or cleaned.lower() in ("n/a", "na", "null", "none", "-"):
        return None
    cleaned = re.sub(r"[₫$€£¥\s]", "", cleaned)
    cleaned = re.sub(r"(?i)\bVND\b", "", cleaned)
    if cleaned.count(".") > 1:
        cleaned = cleaned.replace(".", "")
    elif cleaned.count(",") > 1:
        cleaned = cleaned.replace(",", "")
    elif "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(",", "")
    cleaned = cleaned.replace(",", "")
    try:
        val = float(cleaned)
        return val if val > 0 else None
    except ValueError:
        return None


def _extract_vendors(item: Dict) -> List[Dict[str, Any]]:
    vendors = []
    for i in range(1, 5):
        for v_key, p_key in [(f"vendor{i}", f"price{i}"), (f"{i}vendor", f"{i}price")]:
            vendor_name = item.get(v_key)
            price_raw = item.get(p_key)
            if vendor_name and price_raw is not None:
                price = _parse_price(price_raw)
                if price is not None:
                    vendors.append({"name": str(vendor_name), "price": price})
    vendors.sort(key=lambda v: v["price"])
    return vendors


def _try_city_api(api_key: str, city_id: str, req: HotelInput) -> Optional[List[HotelOutput]]:
    """Try the /city endpoint (requires paid plan)."""
    checkin = req.checkin or (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    checkout = req.checkout or (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")

    params: Dict[str, str] = {
        "api_key": api_key,
        "cityid": city_id,
        "pagination": "0",
        "cur": req.currency or "VND",
        "rooms": str(req.rooms or 1),
        "adults": str(max(req.adults or 2, 1)),
        "checkin": checkin,
        "checkout": checkout,
    }
    if req.children and req.children > 0:
        params["children"] = str(min(req.children, 10))

    session = _get_session()
    start = time.time()
    try:
        resp = session.get(f"{MAKCORPS_BASE_URL}/city", params=params, timeout=MAKCORPS_TIMEOUT)
        elapsed = time.time() - start
        if resp.status_code != 200:
            logger.warning(
                f"City API returned {resp.status_code} ({elapsed:.1f}s) — "
                f"falling back to curated data"
            )
            return None
        data = resp.json()
        if not isinstance(data, list) or not data:
            return None

        results: List[HotelOutput] = []
        for idx, item in enumerate(data):
            if not isinstance(item, dict):
                continue
            name = item.get("name", item.get("hotel_name"))
            if not name:
                continue
            vendors = _extract_vendors(item)
            if not vendors:
                continue
            cheapest = vendors[0]
            if cheapest["price"] > req.max_price:
                continue
            rating = None
            for k in ("star", "stars", "rating"):
                if k in item and item[k]:
                    try:
                        rating = float(str(item[k]).strip())
                    except (ValueError, TypeError):
                        pass
                    if rating and rating > 0:
                        break
            img = item.get("img", item.get("image"))
            results.append(HotelOutput(
                hotel_id=str(item.get("id", f"MK{idx:04d}")),
                name=str(name),
                price_per_night=cheapest["price"],
                location=req.location,
                rating=rating,
                cheapest_vendor=cheapest["name"],
                vendors_info=[f"{v['name']}: {v['price']:,.0f}" for v in vendors],
                image_url=str(img) if img else None,
                source="Makcorps API (live)",
            ))
        results.sort(key=lambda h: h.price_per_night)
        logger.info(f"City API: {len(results)} hotels under {req.max_price:,.0f}")
        return results
    except requests.RequestException as e:
        logger.warning(f"City API error: {e}")
        return None
    finally:
        session.close()


def _fallback_search(location: str, max_price: float) -> List[HotelOutput]:
    """Return curated hotel data filtered by location and price."""
    canonical = _normalize_location(location)
    results = []
    for h in _FALLBACK_HOTELS:
        if h["location"] != canonical:
            continue
        if h["price_per_night"] > max_price:
            continue
        results.append(HotelOutput(
            hotel_id=h["hotel_id"],
            name=h["name"],
            price_per_night=h["price_per_night"],
            location=h["location"],
            rating=h.get("rating"),
            cheapest_vendor=h.get("cheapest_vendor"),
            vendors_info=h.get("vendors_info", []),
            source="Curated data (API fallback)",
        ))
    results.sort(key=lambda h: h.price_per_night)
    return results


def search_hotel(req: HotelInput) -> List[HotelOutput]:
    """
    Tìm kiếm khách sạn sử dụng Makcorps Hotel API.
    - Bước 1: Gọi Mapping API để lấy city ID.
    - Bước 2: Gọi City Search API để lấy danh sách khách sạn (cần paid plan).
    - Fallback: Nếu API không khả dụng (free plan / rate limit), trả về curated data.
    """
    api_key = os.getenv("MAKCORPS_API_KEY")

    if api_key:
        city_id = _get_city_id(api_key, req.location)
        if city_id:
            live_results = _try_city_api(api_key, city_id, req)
            if live_results is not None:
                return live_results
            logger.info("Falling back to curated hotel data")

    results = _fallback_search(req.location, req.max_price)
    logger.info(
        f"Fallback search: {len(results)} hotels in '{req.location}' "
        f"under {req.max_price:,.0f} VND"
    )
    return results
