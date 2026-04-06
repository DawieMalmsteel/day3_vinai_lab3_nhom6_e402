from google.adk.agents.callback_context import CallbackContext
from google.adk.tools.base_tool import BaseTool
from typing import Dict, Any, Optional
from google.adk.tools.tool_context import ToolContext
from google.genai.types import Content
import json

def log_after_tool_execution(
    tool: BaseTool, args: Dict[str, Any], tool_context: ToolContext, tool_response: Dict
) -> Optional[Dict]:
    """
    Callback được gọi sau khi một tool thực thi thành công.
    Log lại tên agent, tên tool, tham số đầu vào và kết quả tool trả về.
    """
    agent_name = tool_context.agent_name
    tool_name = tool.name
    print("\n" + "="*20 + " AFTER TOOL EXECUTION (CALLBACK) " + "="*20)
    print(f"[Callback] Agent Name: '{agent_name}'")
    print(f"[Callback] Tool Executed: '{tool_name}'")
    try:
        print(f"[Callback] Arguments (Input) Passed to Tool:\n{json.dumps(args, indent=2, ensure_ascii=False)}")
        print(f"[Callback] Original Tool Response (Output):\n{json.dumps(tool_response, indent=2, ensure_ascii=False)}")
    except TypeError:
        print(f"[Callback] Arguments (Input) Passed to Tool: {args}")
        print(f"[Callback] Original Tool Response (Output): {tool_response}")
    print("="* (40 + len(" AFTER TOOL EXECUTION (CALLBACK) ")) + "\n")
    return None

def log_before_agent_entry(callback_context: CallbackContext) -> Optional[Content]:
    """Logs khi một agent chuẩn bị bắt đầu thực thi."""
    agent_name = callback_context.agent_name
    invocation_id = callback_context.invocation_id

    print("\n" + "-"*20 + f" AGENT START: {agent_name} " + "-"*20)
    print(f"[Callback] Invocation ID: {invocation_id}")
    print("-"*(40 + len(f" AGENT START: {agent_name} ")) + "\n")

    return None

