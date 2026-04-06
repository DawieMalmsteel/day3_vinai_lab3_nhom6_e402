import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_LOG_DIR = str(PROJECT_ROOT / "logs")


class IndustryLogger:
    """
    Structured JSON logger following industry observability practices.
    Logs events to both console and dated JSONL files for post-hoc analysis.
    """

    def __init__(self, name: str = "TravelAgent", log_dir: str = DEFAULT_LOG_DIR):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        self._log_dir = log_dir
        os.makedirs(log_dir, exist_ok=True)

        if not self.logger.handlers:
            log_file = os.path.join(
                log_dir, f"{datetime.now().strftime('%Y-%m-%d')}.jsonl"
            )
            fh = logging.FileHandler(log_file, encoding="utf-8")
            fh.setLevel(logging.INFO)
            self.logger.addHandler(fh)

            ch = logging.StreamHandler()
            ch.setLevel(logging.INFO)
            fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
            ch.setFormatter(fmt)
            self.logger.addHandler(ch)

    def log_event(self, event_type: str, data: Dict[str, Any]):
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event_type,
            "data": data,
        }
        self.logger.info(json.dumps(payload, ensure_ascii=False, default=str))

    def info(self, msg: str):
        self.logger.info(msg)

    def error(self, msg: str, exc_info: bool = False):
        self.logger.error(msg, exc_info=exc_info)


logger = IndustryLogger()
