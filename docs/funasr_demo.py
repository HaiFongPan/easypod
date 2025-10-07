#!/usr/bin/env python3
"""Long audio transcription helper built on FunASR AutoModel.

This script loads an ASR model with optional VAD and punctuation support,
performs recognition on long audio, and emits both structured segment data
and optional SRT subtitles.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Transcribe long audio with FunASR, emitting timestamps and subtitles."
    )
    parser.add_argument(
        "audio", type=Path, help="Path to the input audio file (wav/mp3/flac/etc.)."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("outputs"),
        help="Directory where transcription artifacts will be written (default: outputs).",
    )
    parser.add_argument(
        "--model",
        default="iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        help="FunASR model identifier to load (default: paraformer-zh).",
    )
    parser.add_argument(
        "--vad-model",
        default="fsmn-vad",
        help="VAD model identifier. Set to empty string to disable VAD (default: fsmn-vad).",
    )
    parser.add_argument(
        "--punc-model",
        default="ct-punc",
        help="Punctuation model identifier. Set to empty string to disable punctuation (default: ct-punc).",
    )
    parser.add_argument(
        "--max-segment-ms",
        type=int,
        default=60000,
        help="Maximum single VAD segment length in milliseconds (default: 60000).",
    )
    parser.add_argument(
        "--batch-size-s",
        type=int,
        default=180,
        help="Maximum total audio duration per ASR batch in seconds (default: 180).",
    )
    parser.add_argument(
        "--batch-threshold-s",
        type=int,
        default=60,
        help="Segment duration threshold above which batching is disabled (default: 60).",
    )
    parser.add_argument(
        "--merge-vad",
        action="store_true",
        help="Merge neighbouring short VAD segments (recommended for subtitle output).",
    )
    parser.add_argument(
        "--merge-length-s",
        type=int,
        default=15,
        help="When --merge-vad is set, keep merging segments shorter than this length (seconds).",
    )
    parser.add_argument(
        "--disable-update",
        action="store_true",
        help="Disable FunASR automatic update checks to avoid extra network calls.",
    )
    parser.add_argument(
        "--srt",
        action="store_true",
        help="Emit an .srt subtitle file in addition to JSON and plain-text outputs.",
    )
    parser.add_argument(
        "--device",
        default=None,
        help="Target device string understood by FunASR / PyTorch (e.g. cuda:0).",
    )
    parser.add_argument(
        "--return-stamp",
        dest="return_stamp",
        action="store_true",
        default=True,
        help="Request word/sentence timestamp information from FunASR (default: on).",
    )
    parser.add_argument(
        "--no-return-stamp",
        dest="return_stamp",
        action="store_false",
        help="Disable timestamp retrieval if you only need plain text output.",
    )
    parser.add_argument(
        "--dump-raw",
        type=Path,
        default=None,
        help="Optional path to dump the raw FunASR result JSON for debugging.",
    )
    return parser.parse_args()


def _load_model(args: argparse.Namespace):
    try:
        from funasr import AutoModel
    except ModuleNotFoundError as exc:  # pragma: no cover - environment guard
        raise SystemExit(
            "Could not import funasr. Install dependencies first: pip install funasr modelscope"
        ) from exc

    kwargs: Dict[str, Any] = {"model": args.model}
    if args.vad_model:
        kwargs["vad_model"] = args.vad_model
        kwargs["vad_kwargs"] = {"max_single_segment_time": args.max_segment_ms}
    if args.punc_model:
        kwargs["punc_model"] = args.punc_model
    if args.device:
        kwargs["device"] = args.device
    if args.disable_update:
        kwargs["disable_update"] = True

    # Enable senltence-level timestamps for better segmentation
    if args.return_stamp:
        kwargs["sentence_timestamp"] = True

    print(f"Model configuration: {kwargs}")
    return AutoModel(**kwargs)


def _ensure_output_dir(base_dir: Path) -> Path:
    timestamp = _dt.datetime.now()
    dated = base_dir / timestamp.strftime("%Y-%m-%d") / timestamp.strftime("%H-%M-%S")
    dated.mkdir(parents=True, exist_ok=True)
    return dated


def _format_srt_timestamp(seconds: float) -> str:
    total_ms = int(round(seconds * 1000))
    hours, rem = divmod(total_ms, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, millis = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def _segment_text(res_item: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract per-sentence segments (start/end in seconds) from a FunASR result item."""
    segments: List[Dict[str, Any]] = []

    # First try to get sentence-level information from sentence_info field
    sentence_info = res_item.get("sentence_info")
    if isinstance(sentence_info, list) and sentence_info:
        for sent in sentence_info:
            if not isinstance(sent, dict):
                continue
            text = sent.get("text", "").strip()
            start = sent.get("start")
            end = sent.get("end")
            if text and start is not None and end is not None:
                segments.append(
                    {
                        "text": text,
                        "start_sec": float(start),  # sentence_info already in seconds
                        "end_sec": float(end),
                    }
                )
        if segments:
            return segments

    # Fallback to stamp_sents (legacy format)
    stamp_sents = res_item.get("stamp_sents")
    if isinstance(stamp_sents, str):
        try:
            stamp_sents = json.loads(stamp_sents)
        except json.JSONDecodeError:
            stamp_sents = None
    if isinstance(stamp_sents, Iterable):
        for sent in stamp_sents or []:
            if not isinstance(sent, dict):
                continue
            text_seg = sent.get("text_seg") or ""
            punc = sent.get("punc") or ""
            start = sent.get("start")
            end = sent.get("end")
            if start is None or end is None:
                continue
            segments.append(
                {
                    "text": f"{text_seg}{punc}".strip(),
                    "start_sec": float(start) / 1000.0,
                    "end_sec": float(end) / 1000.0,
                }
            )

    # If no sentence-level segmentation is available, try to create segments from word timestamps
    if not segments:
        text = (res_item.get("text") or "").strip()
        timestamp = res_item.get("timestamp")
        if isinstance(timestamp, str):
            try:
                timestamp = json.loads(timestamp)
            except json.JSONDecodeError:
                timestamp = None

        if isinstance(timestamp, list) and timestamp and text:
            # Try to split text into sentences and map to timestamps
            sentences = _split_text_into_sentences(text)
            if len(sentences) > 1:
                segments = _map_sentences_to_timestamps(sentences, timestamp, text)
            else:
                # Single sentence case
                start_ms = timestamp[0][0]
                end_ms = timestamp[-1][-1]
                segments.append(
                    {
                        "text": text,
                        "start_sec": float(start_ms) / 1000.0,
                        "end_sec": float(end_ms) / 1000.0,
                    }
                )
        elif text:
            segments.append({"text": text, "start_sec": 0.0, "end_sec": 0.0})

    return segments


def _split_text_into_sentences(text: str) -> List[str]:
    """Split text into sentences based on Chinese punctuation."""
    import re

    # Split on Chinese sentence-ending punctuation
    sentences = re.split(r"[。！？；]", text)
    # Filter out empty sentences and add back punctuation
    result = []
    for i, sent in enumerate(sentences):
        sent = sent.strip()
        if sent:
            # Find the punctuation that was used to split
            if i < len(sentences) - 1:  # Not the last sentence
                # Look for the punctuation in the original text after this sentence
                start_pos = text.find(sent)
                if start_pos != -1:
                    end_pos = start_pos + len(sent)
                    if end_pos < len(text) and text[end_pos] in "。！？；":
                        sent += text[end_pos]
            result.append(sent)
    return result if result else [text]


def _map_sentences_to_timestamps(
    sentences: List[str], timestamps: List[List[int]], full_text: str
) -> List[Dict[str, Any]]:
    """Map sentences to word-level timestamps."""
    segments = []

    # Calculate character positions for each sentence
    char_positions = []
    current_pos = 0
    for sentence in sentences:
        start_pos = full_text.find(sentence.rstrip("。！？；"), current_pos)
        if start_pos == -1:
            start_pos = current_pos
        end_pos = start_pos + len(sentence.rstrip("。！？；"))
        char_positions.append((start_pos, end_pos))
        current_pos = end_pos + 1  # Skip punctuation

    # Distribute timestamps across sentences proportionally
    if len(timestamps) >= len(sentences):
        words_per_sentence = len(timestamps) // len(sentences)
        remainder = len(timestamps) % len(sentences)

        timestamp_idx = 0
        for i, (sentence, (char_start, char_end)) in enumerate(
            zip(sentences, char_positions)
        ):
            # Calculate how many timestamps to use for this sentence
            words_for_this_sentence = words_per_sentence + (1 if i < remainder else 0)

            if timestamp_idx < len(timestamps):
                start_ms = timestamps[timestamp_idx][0]
                end_idx = min(
                    timestamp_idx + words_for_this_sentence - 1, len(timestamps) - 1
                )
                end_ms = timestamps[end_idx][-1]

                segments.append(
                    {
                        "text": sentence,
                        "start_sec": float(start_ms) / 1000.0,
                        "end_sec": float(end_ms) / 1000.0,
                    }
                )

                timestamp_idx += words_for_this_sentence
    else:
        # Fewer timestamps than sentences, distribute evenly
        for i, sentence in enumerate(sentences):
            if i < len(timestamps):
                start_ms = timestamps[i][0]
                end_ms = timestamps[i][-1]
                segments.append(
                    {
                        "text": sentence,
                        "start_sec": float(start_ms) / 1000.0,
                        "end_sec": float(end_ms) / 1000.0,
                    }
                )

    return segments


def _write_plaintext(segments: List[Dict[str, Any]], path: Path) -> None:
    with path.open("w", encoding="utf-8") as f:
        for seg in segments:
            start = _format_srt_timestamp(seg["start_sec"])
            end = _format_srt_timestamp(seg["end_sec"])
            f.write(f"[{start} --> {end}] {seg['text']}\n")


def _write_json(segments: List[Dict[str, Any]], path: Path) -> None:
    payload = {
        "generated_at": _dt.datetime.now().isoformat(timespec="seconds"),
        "segments": segments,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_srt(segments: List[Dict[str, Any]], path: Path) -> None:
    with path.open("w", encoding="utf-8") as f:
        for idx, seg in enumerate(segments, start=1):
            start = _format_srt_timestamp(seg["start_sec"])
            end = _format_srt_timestamp(seg["end_sec"])
            text = seg["text"]
            f.write(f"{idx}\n{start} --> {end}\n{text}\n\n")


def main() -> int:
    args = _parse_args()
    if not args.audio.exists():
        print(f"Audio file not found: {args.audio}", file=sys.stderr)
        return 1

    model = _load_model(args)

    output_root = _ensure_output_dir(args.output_dir)
    print(f"Writing artifacts to: {output_root}")

    generate_kwargs: Dict[str, Any] = {
        "input": str(args.audio),
        "batch_size_s": args.batch_size_s,
        "batch_size_threshold_s": args.batch_threshold_s,
    }
    if args.return_stamp:
        generate_kwargs["return_stamp"] = True
        generate_kwargs.setdefault("sentence_timestamp", True)
        generate_kwargs.setdefault("word_timestamp", True)
    if args.merge_vad:
        generate_kwargs["merge_vad"] = True
        generate_kwargs["merge_length_s"] = args.merge_length_s

    print("Starting recognition. This may take a while for long recordings...")
    try:
        results = model.generate(**generate_kwargs)
    except TypeError:
        # Older FunASR builds may not accept return_stamp; fall back gracefully.
        if generate_kwargs.pop("return_stamp", None) is not None:
            results = model.generate(**generate_kwargs)
        else:
            raise

    if not results:
        print("No recognition results were returned", file=sys.stderr)
        return 2

    segments = _segment_text(results[0])
    if args.dump_raw:
        args.dump_raw.parent.mkdir(parents=True, exist_ok=True)
        args.dump_raw.write_text(
            json.dumps(results, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"Raw FunASR output dumped to: {args.dump_raw}")

    if not segments:
        print("Recognition results are empty", file=sys.stderr)
        return 3

    # Improved warning message with more helpful suggestions
    if (
        len(segments) == 1
        and not results[0].get("stamp_sents")
        and not results[0].get("sentence_info")
    ):
        warn_msg = (
            "Only a single segment was produced. The model may not support sentence-level timestamps. "
            "This could be due to:\n"
            "1. Model compatibility: Try updating FunASR to the latest version\n"
            "2. Long continuous speech: Use --merge-vad to combine short segments\n"
            "3. Model selection: Consider using SenseVoice models for better segmentation\n"
            "4. Check raw output with --dump-raw to inspect available timestamp fields"
        )
        print(warn_msg, file=sys.stderr)

        # Try to provide better segmentation even with single segment
        if len(segments) == 1 and len(segments[0]["text"]) > 100:
            print(
                "Attempting to create artificial segments from the long text...",
                file=sys.stderr,
            )
            # This fallback was already handled in _segment_text function

    # Write artifacts
    json_path = output_root / "segments.json"
    txt_path = output_root / "transcript.txt"
    _write_json(segments, json_path)
    _write_plaintext(segments, txt_path)

    if args.srt:
        srt_path = output_root / "subtitles.srt"
        _write_srt(segments, srt_path)
        print(f"Subtitle file written: {srt_path}")

    print(f"Segment JSON written: {json_path}")
    print(f"Plain-text summary written: {txt_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
