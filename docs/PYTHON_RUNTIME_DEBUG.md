# Python Runtime Debugging Guide

This document explains how to debug Python Runtime issues in EasyPod.

## Quick Diagnosis

```bash
npm run diagnose:python-runtime
```

This will check:
- ✓ Bundled runtime files exist
- ✓ Archive structure is valid
- ✓ Extracted runtime status
- ✓ Python binary detection (including symlinks)
- ✓ FunASR import test
- ✓ System Python availability

**New:** Test symlink detection specifically:
```bash
npm run test:python-runtime
```

## Debug Logging

Run the app with detailed Python Runtime logs:

```bash
# Development mode (automatically enabled)
npm run dev

# Or explicitly enable debug logging
DEBUG_PYTHON_RUNTIME=1 npm run dev
```

### What to Look For

The console will show detailed logs from `PythonRuntimeManager`:

```
[PythonRuntime] 🔍 Checking for embedded Python runtime...
[PythonRuntime] ✓ Runtime root: /path/to/resources/python-runtime
[PythonRuntime] ✓ Manifest found: /path/to/runtime.manifest
[PythonRuntime] ✓ Archive found: /path/to/runtime-macos.tar.gz
[PythonRuntime] 📦 Extracting bundled Python runtime version 2025-10-07T02:27:01Z...
[PythonRuntime] ✓ Extraction completed successfully
[PythonRuntime] ✓ Python found: /path/to/runtime/bin/python3
[PythonRuntime] ✅ Embedded runtime ready
```

## Common Issues

### Issue 1: Runtime Not Extracted

**Symptoms:**
- Error message mentions "无法在 ... 创建 Python 虚拟环境"
- `diagnose-runtime.js` shows venv exists but no extracted runtime

**Diagnosis:**
```bash
npm run diagnose:python-runtime
```

Look for:
```
✗ Extracted runtime directory
⚠️  System Python venv exists - runtime may have fallen back
```

**Solution:**
```bash
# Clean up conflicting directories
rm -rf ~/Library/Application\ Support/Electron/python/venv
rm -rf ~/Library/Application\ Support/Electron/python/runtime*

# Run with debug logging
DEBUG_PYTHON_RUNTIME=1 npm run dev
```

### Issue 2: Archive Missing

**Symptoms:**
- `diagnose-runtime.js` shows "Runtime archive not found"
- App fails with "Embedded runtime not available"

**Solution:**
```bash
# Build the runtime (requires Python 3.10+)
npm run build:python-runtime

# Verify
npm run verify:python-runtime
```

### Issue 3: Extraction Fails

**Symptoms:**
- Logs show "❌ Extraction failed"
- Runtime directory exists but is incomplete

**Diagnosis:**
Check console logs for specific tar errors.

**Solution:**
```bash
# Test manual extraction
cd /tmp
tar -xzf /path/to/resources/python-runtime/runtime-macos.tar.gz

# If this fails, the archive may be corrupted
# Rebuild:
npm run build:python-runtime
```

### Issue 4: FunASR Import Fails

**Symptoms:**
- Logs show "❌ funasr import failed"
- Runtime extracted successfully but module not found

**Diagnosis:**
```bash
# Check extracted runtime
~/Library/Application\ Support/Electron/python/runtime/bin/python3 -c "import funasr"
```

**Solution:**
- Runtime may be incomplete
- Rebuild: `npm run build:python-runtime`
- Or manually install in extracted runtime (not recommended)

## Understanding the Fallback Chain

`PythonRuntimeManager` tries 3 approaches in order:

1. **Environment Variable** (`EASYPOD_FUNASR_PYTHON`)
   - Highest priority
   - Set this to use your own Python installation
   - Example: `export EASYPOD_FUNASR_PYTHON=/usr/local/bin/python3`

2. **Embedded Runtime** (recommended)
   - Pre-built runtime from `resources/python-runtime/runtime-macos.tar.gz`
   - Extracted to `~/Library/Application Support/Electron/python/runtime/`
   - Self-contained, no system dependencies

3. **System Python** (fallback)
   - Creates venv at `~/Library/Application Support/Electron/python/venv/`
   - Requires: system Python 3.10+, venv module, internet for dependencies
   - **Unreliable** - only used as last resort

### Why Fallback to System Python is Bad

If you see System Python venv being created:
- Embedded runtime failed to load
- First-run experience is broken (long setup time)
- Requires internet and system Python
- Not suitable for distribution

**Always investigate why embedded runtime failed!**

## Clean Slate Reset

To completely reset Python Runtime state:

```bash
# Remove all runtime state
rm -rf ~/Library/Application\ Support/Electron/python

# Rebuild and test
npm run build:main
DEBUG_PYTHON_RUNTIME=1 npm run dev
```

## Testing in Production Build

```bash
# Build with runtime included
npm run dist:mac

# Install and run the .app
# Check logs at: ~/Library/Logs/EasyPod/
```

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `DEBUG_PYTHON_RUNTIME` | Enable detailed logs | `DEBUG_PYTHON_RUNTIME=1 npm run dev` |
| `EASYPOD_FUNASR_PYTHON` | Override Python path | `export EASYPOD_FUNASR_PYTHON=/usr/local/bin/python3` |
| `EASYPOD_FUNASR_SKIP_INSTALL` | Skip dependency install | `export EASYPOD_FUNASR_SKIP_INSTALL=1` |

## Getting Help

1. Run diagnosis: `npm run diagnose:python-runtime`
2. Check logs with: `DEBUG_PYTHON_RUNTIME=1 npm run dev`
3. Clean state and retry: `rm -rf ~/Library/Application\ Support/Electron/python`
4. If still failing, check:
   - Archive exists: `ls -lh resources/python-runtime/runtime-macos.tar.gz`
   - Archive is valid: `tar -tzf resources/python-runtime/runtime-macos.tar.gz | head`
   - System permissions: Write access to `~/Library/Application Support/Electron/`

## Known Fixes

### Symlink Detection Fix (2025-10-07)

**Issue**: Python binaries not detected in extracted runtime because they are symlinks.

**Symptoms**:
- Logs show "Searching in: .../runtime/bin" but "Not found"
- Manual `ls` confirms python3 exists
- Runtime falls back to system Python

**Solution**: Modified `findPythonBinary()` to check for both files and symlinks:
```typescript
if ((entry.isFile() || entry.isSymbolicLink()) && candidateNames.includes(entry.name))
```

**Test**:
```bash
npm run test:python-runtime
```

See `docs/python-runtime-symlink-fix.md` for complete details.

## Related Files

- `/src/main/services/funasr/PythonRuntimeManager.ts` - Runtime management logic
- `/src/main/main.ts` - Log event listeners
- `/scripts/diagnose-runtime.js` - Diagnostic tool
- `/scripts/test-runtime-fix.js` - Symlink detection test
- `/scripts/build-python-runtime.sh` - Runtime build script
- `/docs/python-runtime-build.md` - Complete build guide
- `/docs/python-runtime-symlink-fix.md` - Symlink fix documentation
