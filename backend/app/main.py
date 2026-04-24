from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import day_detail, meso, overview

app = FastAPI(title="BTC Multi-Scale Visualization API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(overview.router)
app.include_router(meso.router)
app.include_router(day_detail.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "message": "BTC Multi-Scale Visualization backend"}
