#!/usr/bin/env python3
"""Lightweight FunASR HTTP service used by the Electron main process.

The service intentionally mirrors the behaviour exercised in docs/funasr_demo.py
so that model configuration and segmentation remain consistent between the
standalone helper script and the embedded backend. Later stages will extend this
server with queue persistence, diarization, and richer telemetry.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import threading
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

try:  # pragma: no cover - guard: the runtime may not have funasr yet
    from funasr import AutoModel  # type: ignore
except Exception:  # pragma: no cover - defer import error until initialization
    AutoModel = None  # type: ignore

try:
    from modelscope.hub.snapshot_download import snapshot_download  # type: ignore
except Exception:
    snapshot_download = None  # type: ignore


LOGGER = logging.getLogger("funasr_service")

app = FastAPI(title="EasyPod FunASR Service", version="0.1.0")


@dataclass
class RuntimeState:
    model_id: Optional[str] = None
    model: Any = None
    model_without_spk: Any = None
    model_lock: threading.Lock = field(default_factory=threading.Lock)
    tasks: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    download_states: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    download_cancel_flags: Dict[str, bool] = field(default_factory=dict)


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


class DownloadModelPayload(BaseModel):
    model_id: str = Field(..., description="ModelScope model identifier")
    cache_dir: Optional[str] = Field(
        None, description="Cache directory for downloaded models"
    )


class DownloadStatusResponse(BaseModel):
    model_id: str
    status: str  # 'pending' | 'downloading' | 'completed' | 'failed'
    progress: float = 0.0
    downloaded_size: int = 0
    total_size: int = 0
    download_path: Optional[str] = None
    error: Optional[str] = None


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


class _ProgressCallbackInstance:
    """Single file download progress tracker.

    This is instantiated per file by modelscope's http_get_model_file.
    Implements the ProgressCallback interface expected by modelscope.
    """

    def __init__(self, model_id: str, file_name: str, file_size: int):
        self.model_id = model_id
        self.file_name = file_name
        self.file_size = file_size
        self.downloaded = 0
        self.last_log_bytes = 0  # Track last logged position

    def update(self, n: int):
        """Called by modelscope with incremental download bytes."""
        if STATE.download_cancel_flags.get(self.model_id, False):
            raise RuntimeError(f"Download cancelled for model {self.model_id}")

        self.downloaded += n

        # Get current state
        current_state = STATE.download_states.get(self.model_id, {})

        # Directly accumulate total downloaded bytes across all files
        # This works because update() receives incremental bytes
        total_downloaded = current_state.get("downloaded_size", 0) + n
        total_size = current_state.get("total_size", 0)

        # Update total size to sum of all files (approximate)
        if self.file_size > 0:
            total_size = max(
                total_size, total_downloaded
            )  # At least what we've downloaded

        # Calculate overall progress
        progress = min(
            99.0, (total_downloaded / total_size * 100) if total_size > 0 else 50.0
        )

        # Update state atomically
        STATE.download_states[self.model_id].update(
            {
                "downloaded_size": total_downloaded,
                "total_size": total_size,
                "progress": progress,
            }
        )

        # Log milestones (every ~10MB)
        if (self.downloaded - self.last_log_bytes) >= (
            10 * 1024 * 1024
        ) or self.downloaded == self.file_size:
            self.last_log_bytes = self.downloaded
            LOGGER.info(
                f"📦 [{self.model_id}] File: {self.file_name} - "
                f"{self.downloaded / (1024 * 1024):.1f}/{self.file_size / (1024 * 1024):.1f} MB "
                f"({self.downloaded * 100 / self.file_size:.1f}%) | "
                f"Total: {total_downloaded / (1024 * 1024):.1f} MB ({progress:.1f}%)"
            )

    def end(self):
        """Called by modelscope when file download completes."""
        current_state = STATE.download_states.get(self.model_id, {})
        total_downloaded = current_state.get("downloaded_size", 0)
        LOGGER.info(
            f"✓ [{self.model_id}] Completed {self.file_name}: "
            f"{self.downloaded / (1024 * 1024):.2f} MB | "
            f"Total: {total_downloaded / (1024 * 1024):.1f} MB"
        )


class _DownloadProgressCallback:
    """Progress callback factory compatible with modelscope's interface.

    modelscope calls this as: callback(file_name, file_size) to get a progress tracker
    instance for each file download. The returned instance must have an update(n) method.
    """

    def __init__(self, model_id: str):
        self.model_id = model_id
        self.file_count = 0

    def __call__(self, file_name: str, file_size: int):
        """Called by modelscope to create a progress tracker for each file."""
        self.file_count += 1
        LOGGER.info(
            f"Starting download of file #{self.file_count} for {self.model_id}: "
            f"{file_name} ({file_size / (1024 * 1024):.2f} MB)"
        )
        return _ProgressCallbackInstance(self.model_id, file_name, file_size)


def _download_model_sync(model_id: str, cache_dir: Optional[str] = None) -> str:
    """Synchronously download model using modelscope."""
    if snapshot_download is None:
        raise RuntimeError(
            "modelscope is not installed in the current Python environment"
        )

    STATE.download_states[model_id] = {
        "status": "downloading",
        "progress": 0.0,
        "downloaded_size": 0,
        "total_size": 0,
    }

    progress_callback = _DownloadProgressCallback(model_id)

    try:
        LOGGER.info(f"Starting download for model: {model_id}, cache_dir: {cache_dir}")

        # Default cache directory
        if cache_dir is None:
            cache_dir = os.path.expanduser("~/.cache/modelscope/hub/models")

        model_path = snapshot_download(
            model_id=model_id,
            cache_dir=cache_dir,
            progress_callbacks=[progress_callback],
        )

        STATE.download_states[model_id].update(
            {
                "status": "completed",
                "progress": 100.0,
                "download_path": model_path,
            }
        )

        LOGGER.info(f"✅ Model {model_id} downloaded successfully to {model_path}")
        LOGGER.info(f"✅ Final state: {STATE.download_states[model_id]}")
        return model_path

    except Exception as exc:
        error_msg = str(exc)
        STATE.download_states[model_id].update(
            {
                "status": "failed",
                "error": error_msg,
            }
        )
        LOGGER.exception(f"❌ Failed to download model {model_id}: {exc}")
        LOGGER.error(f"❌ Final state: {STATE.download_states[model_id]}")
        raise


def _run_model_download(model_id: str, cache_dir: Optional[str]) -> None:
    """Background thread for model download."""
    try:
        _download_model_sync(model_id, cache_dir)
    except Exception as exc:
        LOGGER.exception(f"Model download thread failed for {model_id}: {exc}")


@app.post("/download-model", response_model=Dict[str, Any])
def download_model(payload: DownloadModelPayload) -> Dict[str, Any]:
    """Start downloading a model in the background."""
    model_id = payload.model_id

    # Check if already downloading
    if model_id in STATE.download_states:
        current_status = STATE.download_states[model_id].get("status")
        if current_status == "downloading":
            return {
                "success": False,
                "error": f"Model {model_id} is already being downloaded",
            }

    # Initialize download state
    STATE.download_states[model_id] = {
        "status": "pending",
        "progress": 0.0,
        "downloaded_size": 0,
        "total_size": 0,
    }
    STATE.download_cancel_flags[model_id] = False

    # Start download thread
    thread = threading.Thread(
        target=_run_model_download, args=(model_id, payload.cache_dir), daemon=True
    )
    thread.start()

    LOGGER.info(f"Download started for model: {model_id}")
    return {"success": True, "model_id": model_id, "status": "downloading"}


@app.get("/download-status", response_model=DownloadStatusResponse)
def get_download_status(model_id: str) -> DownloadStatusResponse:
    """Get the download status of a model.

    Use query parameter instead of path parameter to handle model IDs with slashes.
    """
    state = STATE.download_states.get(model_id)

    if not state:
        # Check if model exists in cache
        LOGGER.debug(f"No download state found for model: {model_id}")
        return DownloadStatusResponse(
            model_id=model_id,
            status="pending",
            progress=0.0,
            downloaded_size=0,
            total_size=0,
        )

    LOGGER.debug(
        f"Returning download status for {model_id}: {state.get('status')} - {state.get('progress'):.1f}%"
    )
    return DownloadStatusResponse(
        model_id=model_id,
        status=state.get("status", "pending"),
        progress=state.get("progress", 0.0),
        downloaded_size=state.get("downloaded_size", 0),
        total_size=state.get("total_size", 0),
        download_path=state.get("download_path"),
        error=state.get("error"),
    )


@app.delete("/download-model/{model_id}", response_model=Dict[str, Any])
def cancel_download(model_id: str) -> Dict[str, Any]:
    """Cancel an ongoing model download."""
    state = STATE.download_states.get(model_id)

    if not state or state.get("status") != "downloading":
        return {
            "success": False,
            "error": f"No active download found for model {model_id}",
        }

    # Set cancel flag
    STATE.download_cancel_flags[model_id] = True
    STATE.download_states[model_id]["status"] = "failed"
    STATE.download_states[model_id]["error"] = "Download cancelled by user"

    LOGGER.info(f"Download cancelled for model: {model_id}")
    return {"success": True, "model_id": model_id}


async def _download_progress_stream(model_id: str):
    """SSE stream for real-time download progress updates."""
    last_progress = -1
    last_status = None

    while True:
        state = STATE.download_states.get(model_id)

        if not state:
            yield f"data: {{'error': 'Model {model_id} not found'}}\n\n"
            break

        current_progress = state.get("progress", 0.0)
        current_status = state.get("status", "pending")

        # Send update if progress or status changed
        if current_progress != last_progress or current_status != last_status:
            import json

            data = {
                "model_id": model_id,
                "status": current_status,
                "progress": current_progress,
                "downloaded_size": state.get("downloaded_size", 0),
                "total_size": state.get("total_size", 0),
                "download_path": state.get("download_path"),
                "error": state.get("error"),
            }
            yield f"data: {json.dumps(data)}\n\n"

            last_progress = current_progress
            last_status = current_status

        # Stop streaming if completed or failed
        if current_status in ["completed", "failed"]:
            break

        await asyncio.sleep(0.5)  # Update every 500ms


@app.get("/download-progress/{model_id}")
async def download_progress_stream(model_id: str):
    """Server-Sent Events endpoint for real-time download progress."""
    return StreamingResponse(
        _download_progress_stream(model_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the EasyPod FunASR HTTP service")
    parser.add_argument("--host", default="127.0.0.1")
    # Default port is 17953, but Electron will pass the actual port after checking for conflicts
    # See src/main/config/portConfig.ts for port configuration
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
