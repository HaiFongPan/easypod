# Bundled Python Runtime

Place platform-specific archives containing the pre-built Python virtual environment here.

Expected naming convention:
- `runtime-macos.tar.gz`
- `runtime-windows.tar.gz`
- `runtime-linux.tar.gz`

Each archive should unpack a directory that includes the FunASR-ready virtual environment
(with `funasr`, `fastapi`, `uvicorn`, etc.) referenced by `runtime.manifest`.
