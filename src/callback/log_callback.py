import json
from typing import Any, Dict, Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.tools.base_tool import BaseTool
from google.adk.tools.tool_context import ToolContext
from google.genai.types import Content

from telemetry.logger import logger
from telemetry.metrics import metrics, current_trace


def log_before_agent_entry(callback_context: CallbackContext) -> Optional[Content]:
    """Logs structured event when an agent starts execution."""
    agent_name = callback_context.agent_name
    invocation_id = callback_context.invocation_id

    logger.log_event(
        "AGENT_START",
        {
            "agent_name": agent_name,
            "invocation_id": invocation_id,
        },
    )
    return None


def log_after_tool_execution(
    tool: BaseTool,
    args: Dict[str, Any],
    tool_context: ToolContext,
    tool_response: Dict,
) -> Optional[Dict]:
    """
    Logs structured event after tool execution with timing and full I/O.
    Returns None to keep the original tool response unchanged.
    """
    agent_name = tool_context.agent_name
    tool_name = tool.name

    try:
        response_str = json.dumps(tool_response, ensure_ascii=False, default=str)
    except TypeError:
        response_str = str(tool_response)

    result_count = 0
    if isinstance(tool_response, dict):
        for v in tool_response.values():
            if isinstance(v, list):
                result_count = len(v)
                break
    elif isinstance(tool_response, list):
        result_count = len(tool_response)

    logger.log_event(
        "TOOL_EXECUTION",
        {
            "agent_name": agent_name,
            "tool_name": tool_name,
            "arguments": args,
            "result_count": result_count,
            "response_preview": response_str[:300],
        },
    )

    trace = current_trace.get(None)
    if trace is not None:
        metrics.add_tool_call(
            trace,
            tool_name=tool_name,
            args=args,
            response=tool_response,
            duration_ms=0,
        )

    return None
