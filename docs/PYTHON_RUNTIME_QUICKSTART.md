# Python Runtime Quick Start

## For Developers (First Time Setup)

```bash
# Clone the repo
git clone <repo-url>
cd easypod

# Install dependencies
npm install

# Build the Python runtime (one-time, ~5 minutes)
npm run build:python-runtime

# Verify the build
npm run verify:python-runtime

# Start development
npm run dev
```

**That's it!** The app will:
1. Extract the embedded Python runtime on first launch (~5 seconds)
2. Initialize FunASR automatically
3. Be ready to transcribe audio

## For Daily Development

```bash
# Just run dev - runtime is already built and extracted
npm run dev
```

## Troubleshooting

### Quick Diagnostic

```bash
npm run diagnose:python-runtime
```

This checks:
- ✓ Bundled runtime archive exists
- ✓ Archive structure is valid
- ✓ Extracted runtime status
- ✓ Python binary detection
- ✓ FunASR import test

### Common Issues

**Issue: "Python binary not found"**
```bash
# Test symlink detection
npm run test:python-runtime

# If it shows "❌ Fix failed", the symlink fix may not be applied
# Rebuild and try again
npm run build:main
npm run dev
```

**Issue: "Service script not found"**
```bash
# Check if funasr_service.py exists
ls -la resources/python/funasr_service.py

# If missing, check git status
git status

# Make sure you have the latest code
git pull
```

**Issue: Runtime extraction fails**
```bash
# Clean state and retry
rm -rf ~/Library/Application\ Support/Electron/python
npm run dev
```

### Debug Mode

Enable detailed logging:
```bash
DEBUG_PYTHON_RUNTIME=1 npm run dev
```

Look for these log messages:
```
[PythonRuntime] 🔍 Checking for embedded Python runtime...
[PythonRuntime] ✓ Archive found: .../runtime-macos.tar.gz
[PythonRuntime] 📦 Extracting bundled Python runtime...
[PythonRuntime] ✓ Extraction completed successfully
[PythonRuntime] ✓ Python found: .../bin/python (symlink)
[PythonRuntime] ✓ funasr import successful
[PythonRuntime] ✅ Embedded runtime ready
```

## Building for Distribution

```bash
# Build everything (runtime + app)
npm run build:all

# Or step by step
npm run build:python-runtime  # Build runtime (if not already built)
npm run build                # Build app
npm run dist:mac            # Create DMG

# The packaged app will include the runtime
# No user setup required!
```

## Environment Variables (Optional)

Override default behavior:

```bash
# Use your own Python instead of embedded runtime (faster iteration)
export EASYPOD_FUNASR_PYTHON=/usr/local/bin/python3

# Skip dependency installation (if already installed)
export EASYPOD_FUNASR_SKIP_INSTALL=1

# Use custom FunASR service script
export EASYPOD_FUNASR_SERVER_SCRIPT=/path/to/funasr_service.py

# Enable debug logging
export DEBUG_PYTHON_RUNTIME=1
```

## Testing

```bash
# Run all diagnostics
npm run diagnose:python-runtime

# Test symlink detection specifically
npm run test:python-runtime

# Check runtime status quickly
npm run check:python-runtime
```

## What Gets Installed Where

**Development:**
- Archive: `resources/python-runtime/runtime-macos.tar.gz` (289 MB)
- Extracted: `~/Library/Application Support/Electron/python/runtime/` (650 MB)
- Logs: `~/Library/Application Support/Electron/python/logs/`

**Production (packaged app):**
- Archive: Inside `.app/Contents/Resources/python-runtime/`
- Extracted: Same as development location
- User's machine extracts on first launch

## Clean Slate Reset

```bash
# Remove all runtime state
rm -rf ~/Library/Application\ Support/Electron/python

# Remove built runtime (if you want to rebuild)
rm -rf resources/python-runtime/runtime-macos.tar.gz

# Rebuild everything
npm run build:python-runtime
npm run build:main
npm run dev
```

## Performance Notes

- **First build**: ~5 minutes (downloads Python + dependencies)
- **First run extraction**: ~5 seconds (one-time)
- **Subsequent runs**: Instant (uses cached runtime)
- **Runtime size**: 289 MB compressed, 650 MB extracted
- **FunASR startup**: ~2-3 seconds to load models

## Documentation

- **Complete Fix Details**: `PYTHON_RUNTIME_FIX_SUMMARY.md`
- **Debugging Guide**: `PYTHON_RUNTIME_DEBUG.md`
- **Build Documentation**: `docs/python-runtime-build.md`
- **Symlink Fix Technical**: `docs/python-runtime-symlink-fix.md`

## Success Criteria

After setup, you should see:

```bash
$ npm run diagnose:python-runtime

✓ Runtime directory exists
✓ Runtime archive exists (289.40 MB)
✓ Extracted runtime directory
✓ Python binary in extracted runtime
✓ Python version: Python 3.13.5
✓ FunASR import test: FunASR 1.2.7
✅ Everything looks good!
```

## Need Help?

1. Run diagnostics: `npm run diagnose:python-runtime`
2. Enable debug logging: `DEBUG_PYTHON_RUNTIME=1 npm run dev`
3. Check the logs in: `~/Library/Application Support/Electron/python/logs/`
4. Review: `PYTHON_RUNTIME_DEBUG.md` for common issues
5. Clean state and retry: `rm -rf ~/Library/Application\ Support/Electron/python`

---

**TL;DR**: Build runtime once with `npm run build:python-runtime`, then just use `npm run dev` for development.
