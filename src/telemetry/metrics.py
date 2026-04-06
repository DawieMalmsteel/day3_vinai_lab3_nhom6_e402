import contextvars
import time
import threading
from collections import defaultdict
from typing import Any, Dict, List, Optional

current_trace: contextvars.ContextVar[Optional[Dict]] = contextvars.ContextVar(
    "current_trace", default=None
)


class MetricsCollector:
    """
    Thread-safe collector for agent performance metrics.
    Tracks per-mode latency, tool calls, success/error rates, and full traces.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._traces: List[Dict[str, Any]] = []
        self._mode_stats: Dict[str, Dict[str, float]] = {}

    def _ensure_mode(self, mode: str):
        if mode not in self._mode_stats:
            self._mode_stats[mode] = {
                "total_requests": 0,
                "total_duration_ms": 0.0,
                "total_tool_calls": 0,
                "errors": 0,
                "success": 0,
            }

    def start_trace(self, trace_id: str, mode: str, provider: str, query: str) -> Dict:
        return {
            "trace_id": trace_id,
            "mode": mode,
            "provider": provider,
            "query": query,
            "start_time": time.time(),
            "tool_calls": [],
            "status": "pending",
            "error_detail": None,
        }

    def add_tool_call(
        self,
        trace: Dict,
        tool_name: str,
        args: Dict,
        response: Any,
        duration_ms: float,
    ):
        trace["tool_calls"].append(
            {
                "tool_name": tool_name,
                "arguments": args,
                "response_summary": str(response)[:500],
                "duration_ms": round(duration_ms, 1),
            }
        )

    def end_trace(
        self,
        trace: Dict,
        response: str,
        status: str = "success",
        error: str = None,
    ):
        trace["end_time"] = time.time()
        trace["duration_ms"] = round(
            (trace["end_time"] - trace["start_time"]) * 1000, 1
        )
        trace["response_preview"] = (response or "")[:500]
        trace["status"] = status
        trace["error_detail"] = error
        del trace["start_time"]
        del trace["end_time"]

        with self._lock:
            self._traces.append(trace)
            mode = trace["mode"]
            self._ensure_mode(mode)
            stats = self._mode_stats[mode]
            stats["total_requests"] += 1
            stats["total_duration_ms"] += trace["duration_ms"]
            stats["total_tool_calls"] += len(trace["tool_calls"])
            if status == "success":
                stats["success"] += 1
            else:
                stats["errors"] += 1

    def get_summary(self) -> Dict:
        with self._lock:
            summary = {}
            for mode, stats in self._mode_stats.items():
                n = int(stats["total_requests"])
                summary[mode] = {
                    "total_requests": n,
                    "avg_latency_ms": (
                        round(stats["total_duration_ms"] / n, 1) if n > 0 else 0
                    ),
                    "total_tool_calls": int(stats["total_tool_calls"]),
                    "avg_tool_calls": (
                        round(stats["total_tool_calls"] / n, 2) if n > 0 else 0
                    ),
                    "success_rate": (
                        round(stats["success"] / n * 100, 1) if n > 0 else 0
                    ),
                    "error_count": int(stats["errors"]),
                }
            return summary

    def get_recent_traces(self, limit: int = 30) -> List[Dict]:
        with self._lock:
            return list(reversed(self._traces[-limit:]))


metrics = MetricsCollector()
