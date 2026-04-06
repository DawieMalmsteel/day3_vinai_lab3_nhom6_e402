import logging
import os
import re
import time
from typing import List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from models.flight import FlightInput, FlightOutput

logger = logging.getLogger(__name__)

BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search"
BRAVE_TIMEOUT = 30
MAX_RETRIES = 2


def _get_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(
        total=MAX_RETRIES,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    session.mount("https://", HTTPAdapter(max_retries=retries))
    return session

KNOWN_AIRLINES = {
    "Vietnam Airlines": ["vietnam airlines", "vietnamairlines", "vna "],
    "Vietjet Air": ["vietjet", "viet jet", "vietjetair"],
    "Bamboo Airways": ["bamboo airways", "bambooairways"],
    "Pacific Airlines": ["pacific airlines", "jetstar pacific"],
    "Vietravel Airlines": ["vietravel airlines", "vietravelairlines"],
}


def _build_query(req: FlightInput) -> str:
    query = f"vé máy bay {req.origin} đến {req.destination}"
    if req.departure_time:
        query += f" ngày {req.departure_time}"
    if req.trip_type:
        query += f" {req.trip_type}"
    if req.specific_requirements:
        query += f" {req.specific_requirements}"
    return query


def _extract_time(text: str) -> Optional[str]:
    """Trích xuất thời gian khởi hành từ chuỗi văn bản."""
    patterns = [
        r"(\d{1,2}[:/]?\d{2})\s*(?:sáng|chiều|tối|AM|PM)",
        r"(\d{1,2}[hH]\d{0,2})",
        r"(\d{1,2}:\d{2})",
        r"(\d{1,2}/\d{1,2}/\d{2,4})",
        r"(\d{1,2}-\d{1,2}-\d{2,4})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    return None


def _extract_trip_type(text: str) -> Optional[str]:
    """Nhận diện loại chuyến bay: một chiều hay khứ hồi."""
    text_lower = text.lower()
    round_trip_keywords = ["khứ hồi", "round trip", "roundtrip", "round-trip", "hai chiều"]
    one_way_keywords = ["một chiều", "one way", "oneway", "one-way", "1 chiều"]
    for kw in round_trip_keywords:
        if kw in text_lower:
            return "khứ hồi"
    for kw in one_way_keywords:
        if kw in text_lower:
            return "một chiều"
    return None


def _extract_airline(text: str) -> Optional[str]:
    """Nhận diện hãng hàng không từ văn bản."""
    text_lower = text.lower()
    for airline, keywords in KNOWN_AIRLINES.items():
        if any(kw in text_lower for kw in keywords):
            return airline
    return None


def _process_results(raw_results: list, req: FlightInput) -> List[FlightOutput]:
    """Xử lý kết quả thô từ Brave Search thành FlightOutput phù hợp với model."""
    processed: List[FlightOutput] = []
    seen_urls: set = set()

    for item in raw_results:
        title = item.get("title", "").strip()
        snippet = item.get("description", "").strip()
        url = item.get("url", "").strip()

        if not title or not url:
            continue

        if url in seen_urls:
            continue
        seen_urls.add(url)

        combined = f"{title} {snippet}"

        departure_time = _extract_time(combined)
        trip_type = _extract_trip_type(combined)
        airline = _extract_airline(combined)

        processed.append(
            FlightOutput(
                title=title,
                snippet=snippet,
                url=url,
                departure_time=departure_time,
                trip_type=trip_type,
                airline=airline,
            )
        )

    return processed


def search_flight(req: FlightInput) -> List[FlightOutput]:
    """
    Tìm kiếm vé máy bay dựa trên điểm đi, điểm đến, thời gian và loại chuyến bay.
    Không cần ngân sách. Chỉ cần origin và destination là đủ để gọi.
    Sử dụng Brave Search API để lấy thông tin chuyến bay thực tế từ web.
    """
    api_key = os.getenv("BRAVE_API_KEY")
    if not api_key:
        logger.error("BRAVE_API_KEY is missing from environment variables")
        return []

    query = _build_query(req)
    logger.info(f"Brave Search query: {query}")

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": api_key,
    }
    params = {
        "q": query,
        "count": 10,
    }

    session = _get_session()
    start_time = time.time()

    try:
        resp = session.get(
            BRAVE_API_URL, headers=headers, params=params, timeout=BRAVE_TIMEOUT
        )
        elapsed = time.time() - start_time
        logger.info(f"Brave Search API responded in {elapsed:.1f}s (status {resp.status_code})")
        resp.raise_for_status()
        data = resp.json()
    except requests.Timeout:
        elapsed = time.time() - start_time
        logger.error(f"Brave Search API timed out after {elapsed:.1f}s")
        return []
    except requests.RequestException as exc:
        elapsed = time.time() - start_time
        logger.error(f"Brave Search API failed after {elapsed:.1f}s: {exc}")
        return []
    finally:
        session.close()

    web_results = data.get("web", {}).get("results", [])
    if not web_results:
        logger.warning("No results returned from Brave Search API")
        return []

    results = _process_results(web_results, req)
    logger.info(f"Processed {len(results)} flight results from {len(web_results)} raw results")
    return results
