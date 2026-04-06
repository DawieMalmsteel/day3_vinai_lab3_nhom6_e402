<<<<<<< HEAD
=======
import asyncio
>>>>>>> origin/TranThuongTruongSon
import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
<<<<<<< HEAD
from google.adk.models.lite_llm import LiteLlm
=======
>>>>>>> origin/TranThuongTruongSon
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part
from dotenv import load_dotenv

<<<<<<< HEAD
from agents.chatbot import create_chatbot
from agents.agent import create_agent_v1
from agents.agent_v2 import create_agent_v2
from telemetry.logger import logger
from telemetry.metrics import metrics, current_trace
=======
from agents.agent import TravelAgent
>>>>>>> origin/TranThuongTruongSon

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
<<<<<<< HEAD
=======
logger = logging.getLogger(__name__)
>>>>>>> origin/TranThuongTruongSon

APP_NAME = "travel_agent"
session_service = InMemorySessionService()

<<<<<<< HEAD
MODELS = {
    "openai": lambda: LiteLlm(model="openai/gpt-4o-mini"),
    "gemini": lambda: LiteLlm(model="gemini/gemini-2.0-flash"),
}

AGENT_FACTORIES = {
    "chatbot": create_chatbot,
    "v1": create_agent_v1,
    "v2": create_agent_v2,
}

_agent_cache = {}


def get_agent(mode: str, provider: str):
    key = f"{mode}_{provider}"
    if key not in _agent_cache:
        model_factory = MODELS.get(provider, MODELS["openai"])
        agent_factory = AGENT_FACTORIES.get(mode, AGENT_FACTORIES["v1"])
        _agent_cache[key] = agent_factory(model=model_factory())
        logger.log_event("AGENT_CREATED", {"mode": mode, "provider": provider})
    return _agent_cache[key]


app = FastAPI(title="TravelAgent - Multi-Mode")
=======
app = FastAPI(title="TravelAgent")
>>>>>>> origin/TranThuongTruongSon

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"


<<<<<<< HEAD
async def call_agent(
    user_id: str, session_id: str, query: str, mode: str = "v1", provider: str = "openai"
) -> str:
    effective_session = f"{mode}_{provider}_{session_id}"

    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=effective_session
    )
    if not session:
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=effective_session
        )

    agent = get_agent(mode, provider)
    runner = Runner(
        agent=agent,
=======
async def call_agent(user_id: str, session_id: str, query: str) -> str:
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )

    runner = Runner(
        agent=TravelAgent,
>>>>>>> origin/TranThuongTruongSon
        app_name=APP_NAME,
        session_service=session_service,
    )

    content = Content(role="user", parts=[Part(text=query)])
    final_response = "Agent không trả về kết quả."

    async for event in runner.run_async(
<<<<<<< HEAD
        user_id=user_id, session_id=effective_session, new_message=content
=======
        user_id=user_id, session_id=session_id, new_message=content
>>>>>>> origin/TranThuongTruongSon
    ):
        if event.is_final_response():
            if event.content and event.content.parts:
                final_response = event.content.parts[0].text
            elif event.actions and event.actions.escalate:
                final_response = (
                    f"Agent escalated: {event.error_message or 'No details.'}"
                )
            break

    return final_response


@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    index_path = STATIC_DIR / "index.html"
    return HTMLResponse(content=index_path.read_text(encoding="utf-8"))


@app.post("/api/chat")
async def chat(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    query = body.get("query", "").strip()
    session_id = body.get("session_id", str(uuid.uuid4()))
    user_id = body.get("user_id", "web_user")
<<<<<<< HEAD
    mode = body.get("mode", "v1")
    provider = body.get("provider", "openai")

    if not query:
        return JSONResponse({"error": "query is required"}, status_code=400)
    if mode not in AGENT_FACTORIES:
        return JSONResponse({"error": f"Invalid mode: {mode}"}, status_code=400)
    if provider not in MODELS:
        return JSONResponse({"error": f"Invalid provider: {provider}"}, status_code=400)

    logger.log_event(
        "CHAT_REQUEST",
        {
            "user_id": user_id,
            "session_id": session_id,
            "mode": mode,
            "provider": provider,
            "query": query[:200],
        },
    )

    trace = metrics.start_trace(
        trace_id=str(uuid.uuid4()), mode=mode, provider=provider, query=query
    )

    token = current_trace.set(trace)
    try:
        response = await call_agent(user_id, session_id, query, mode, provider)
        metrics.end_trace(trace, response, status="success")
        logger.log_event(
            "CHAT_RESPONSE",
            {
                "mode": mode,
                "provider": provider,
                "duration_ms": trace["duration_ms"],
                "tool_calls": len(trace["tool_calls"]),
                "status": "success",
            },
        )
        return {"response": response, "session_id": session_id, "mode": mode, "provider": provider}
    except Exception as e:
        metrics.end_trace(trace, "", status="error", error=str(e))
        logger.log_event(
            "CHAT_ERROR",
            {"mode": mode, "provider": provider, "error": str(e)},
        )
        logging.getLogger(__name__).exception("Agent call failed")
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        current_trace.reset(token)


@app.get("/api/metrics")
async def get_metrics():
    """Performance metrics comparison across modes."""
    return {
        "summary": metrics.get_summary(),
        "available_modes": list(AGENT_FACTORIES.keys()),
        "available_providers": list(MODELS.keys()),
    }


@app.get("/api/traces")
async def get_traces(limit: int = 30):
    """Recent request traces for failure analysis."""
    return {"traces": metrics.get_recent_traces(limit=limit)}
=======

    if not query:
        return JSONResponse({"error": "query is required"}, status_code=400)

    logger.info(f"Chat request: user={user_id}, session={session_id}, query={query[:80]}")

    try:
        response = await call_agent(user_id, session_id, query)
        return {"response": response, "session_id": session_id}
    except Exception as e:
        logger.exception("Agent call failed")
        return JSONResponse({"error": str(e)}, status_code=500)
>>>>>>> origin/TranThuongTruongSon


@app.get("/api/health")
async def health():
<<<<<<< HEAD
    return {
        "status": "ok",
        "agent": "TravelAgent Multi-Mode",
        "modes": list(AGENT_FACTORIES.keys()),
        "providers": list(MODELS.keys()),
    }
=======
    return {"status": "ok", "agent": "TravelAgent"}
>>>>>>> origin/TranThuongTruongSon


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=5500, reload=True)
