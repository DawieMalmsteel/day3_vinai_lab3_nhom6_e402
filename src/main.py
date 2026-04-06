import asyncio
import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part
from dotenv import load_dotenv

from agents.agent import TravelAgent

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

APP_NAME = "travel_agent"
session_service = InMemorySessionService()

app = FastAPI(title="TravelAgent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"


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
        app_name=APP_NAME,
        session_service=session_service,
    )

    content = Content(role="user", parts=[Part(text=query)])
    final_response = "Agent không trả về kết quả."

    async for event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=content
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

    if not query:
        return JSONResponse({"error": "query is required"}, status_code=400)

    logger.info(f"Chat request: user={user_id}, session={session_id}, query={query[:80]}")

    try:
        response = await call_agent(user_id, session_id, query)
        return {"response": response, "session_id": session_id}
    except Exception as e:
        logger.exception("Agent call failed")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/health")
async def health():
    return {"status": "ok", "agent": "TravelAgent"}


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=5500, reload=True)
