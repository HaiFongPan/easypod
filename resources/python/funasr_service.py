#!/usr/bin/env python3
"""Lightweight FunASR HTTP service used by the Electron main process.

The service intentionally mirrors the behaviour exercised in docs/funasr_demo.py
so that model configuration and segmentation remain consistent between the
standalone helper script and the embedded backend. Later stages will extend this
server with queue persistence, diarization, and richer telemetry.
"""

from __future__ import annotations

import argparse
import logging
import threading
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:  # pragma: no cover - guard: the runtime may not have funasr yet
    from funasr import AutoModel  # type: ignore
except Exception:  # pragma: no cover - defer import error until initialization
    AutoModel = None  # type: ignore


LOGGER = logging.getLogger("funasr_service")

app = FastAPI(title="EasyPod FunASR Service", version="0.1.0")


@dataclass
class RuntimeState:
    model_id: Optional[str] = None
    model: Any = None
    model_without_spk: Any = None
    model_lock: threading.Lock = field(default_factory=threading.Lock)
    tasks: Dict[str, Dict[str, Any]] = field(default_factory=dict)


STATE = RuntimeState()


class InitializePayload(BaseModel):
    asr_model: str = Field(..., description="FunASR model identifier")
    device: Optional[str] = Field(None, description="PyTorch device string")
    options: Dict[str, Any] = Field(default_factory=dict)


class InitializeResponse(BaseModel):
    status: str
    loaded_models: List[str]
    message: Optional[str] = None


class TranscribePayload(BaseModel):
    audio_path: str = Field(..., description="Absolute path to audio file")
    options: Dict[str, Any] = Field(default_factory=dict)


class TaskResponse(BaseModel):
    status: str
    progress: float = 0.0
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


def _json_ready(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value

    if isinstance(value, dict):
        return {key: _json_ready(inner) for key, inner in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_json_ready(item) for item in value]

    tolist = getattr(value, "tolist", None)
    if callable(tolist):
        return _json_ready(tolist())

    return str(value)


def _load_model(payload: InitializePayload) -> Any:
    if AutoModel is None:
        raise RuntimeError("funasr is not installed in the current Python environment")

    kwargs: Dict[str, Any] = {"model": payload.asr_model, "disable_update": True}
    options = payload.options or {}

    vad_model = options.get("vad_model")
    if vad_model:
        kwargs["vad_model"] = vad_model
        vad_kwargs = options.get("vad_kwargs") or {}
        if "max_single_segment_time" in options:
            vad_kwargs.setdefault(
                "max_single_segment_time", options["max_single_segment_time"]
            )
        if vad_kwargs:
            kwargs["vad_kwargs"] = vad_kwargs

    punc_model = options.get("punc_model")
    if punc_model:
        kwargs["punc_model"] = punc_model

    spk_model = options.get("spk_model")
    if spk_model:
        kwargs["spk_model"] = spk_model

    if payload.device:
        kwargs["device"] = payload.device

    if options.get("sentence_timestamp", True):
        kwargs["sentence_timestamp"] = True

    LOGGER.info("Loading FunASR model with kwargs=%s", kwargs)
    model = AutoModel(**kwargs)
    LOGGER.info("FunASR model loaded")
    return model


def _ensure_model_loaded(without_spk: bool) -> Any:
    if STATE.model is None and not without_spk:
        raise RuntimeError("FunASR model is not initialized")
    if STATE.model_without_spk is None and without_spk:
        raise RuntimeError("FunASR model(without spk) is not initialized")

    return STATE.model_without_spk if without_spk else STATE.model


def _prepare_generate_kwargs(audio: str, options: Dict[str, Any]) -> Dict[str, Any]:
    opts = options or {}
    kwargs: Dict[str, Any] = {"input": audio}

    if "batch_size_s" in opts:
        kwargs["batch_size_s"] = opts["batch_size_s"]
    if "batch_size_threshold_s" in opts:
        kwargs["batch_size_threshold_s"] = opts["batch_size_threshold_s"]
    if opts.get("sentence_timestamp", True):
        kwargs["sentence_timestamp"] = True
    if opts.get("word_timestamp"):
        kwargs["word_timestamp"] = True
    if opts.get("return_stamp", True):
        kwargs["return_stamp"] = True
    if opts.get("merge_vad"):
        kwargs["merge_vad"] = True
    if "merge_length_s" in opts:
        kwargs["merge_length_s"] = opts["merge_length_s"]

    return kwargs


def _run_transcription(task_id: str, payload: TranscribePayload) -> None:
    LOGGER.info(
        "Starting transcription task %s for audio=%s", task_id, payload.audio_path
    )
    STATE.tasks[task_id]["status"] = "processing"
    STATE.tasks[task_id]["progress"] = 0.05

    try:
        with STATE.model_lock:
            without_spk = payload.options.get("spk_enable", False) == False
            model = _ensure_model_loaded(without_spk)
        kwargs = _prepare_generate_kwargs(payload.audio_path, payload.options)

        try:
            results = model.generate(**kwargs)
        except TypeError:
            if kwargs.pop("return_stamp", None) is not None:
                results = model.generate(**kwargs)
            else:
                raise

        if not results:
            raise RuntimeError(
                "FunASR did not return any results for the provided audio"
            )

        raw_json = _json_ready(results[0])
        STATE.tasks[task_id].update(
            {
                "status": "completed",
                "progress": 1.0,
                "result": raw_json,
                "metadata": {
                    "model": STATE.model_id,
                    "options": payload.options,
                },
            }
        )
        LOGGER.info("Transcription task %s completed", task_id)
    except Exception as exc:  # pragma: no cover - resilience path
        LOGGER.exception("Transcription task %s failed: %s", task_id, exc)
        STATE.tasks[task_id].update(
            {"status": "failed", "error": str(exc), "progress": 1.0}
        )


@app.get("/health", response_model=Dict[str, Any])
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "model": STATE.model_id,
        "task_count": len(STATE.tasks),
    }


@app.post("/initialize", response_model=InitializeResponse)
def initialize(payload: InitializePayload) -> InitializeResponse:
    LOGGER.info("Initialization request for model=%s", payload.asr_model)

    with STATE.model_lock:
        STATE.model = _load_model(payload)
        payload.options.pop("spk_model", None)
        STATE.model_without_spk = _load_model(payload)
        STATE.model_id = payload.asr_model

    return InitializeResponse(status="ready", loaded_models=[payload.asr_model])


@app.post("/transcribe", response_model=Dict[str, Any])
def transcribe(payload: TranscribePayload) -> Dict[str, Any]:
    with STATE.model_lock:
        without_spk = payload.options.get("spk_enable", False) == False
        _ensure_model_loaded(without_spk)

    task_id = str(uuid.uuid4())
    STATE.tasks[task_id] = {"status": "queued", "progress": 0.0}

    thread = threading.Thread(
        target=_run_transcription, args=(task_id, payload), daemon=True
    )
    thread.start()

    return {"task_id": task_id, "status": "queued"}


@app.get("/task/{task_id}", response_model=TaskResponse)
def get_task(task_id: str) -> TaskResponse:
    task = STATE.tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse(**task)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the EasyPod FunASR HTTP service")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=17953)
    parser.add_argument("--log-level", default="INFO")
    parser.add_argument("--reload", action="store_true")
    return parser.parse_args()


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


def main() -> int:
    import uvicorn

    args = _parse_args()
    _configure_logging(args.log_level)
    LOGGER.info("Starting FunASR service on %s:%s", args.host, args.port)

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level=args.log_level.lower(),
        reload=args.reload,
    )
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())
