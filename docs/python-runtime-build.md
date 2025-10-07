# Python Runtime Build Guide

This guide explains how to build and package the Python runtime for EasyPod's FunASR transcription feature.

## Table of Contents

- [Why Bundle a Python Runtime?](#why-bundle-a-python-runtime)
- [Quick Start](#quick-start)
- [Build Process](#build-process)
- [Platform-Specific Instructions](#platform-specific-instructions)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)
- [CI/CD Integration](#cicd-integration)

---

## Why Bundle a Python Runtime?

EasyPod uses [FunASR](https://github.com/alibaba-damo-academy/FunASR) for local audio transcription, which requires:
- Python 3.10+
- Heavy dependencies: `torch`, `onnxruntime`, `funasr`, `modelscope`
- Total install size: ~600-800MB

**Benefits of bundling:**
- ✅ **Zero user setup** - No Python installation required
- ✅ **Offline operation** - No internet needed after installation
- ✅ **Guaranteed compatibility** - Tested version combinations
- ✅ **Faster startup** - Pre-built environment loads in seconds
- ✅ **Better UX** - Higher success rate, fewer support issues

**Tradeoffs:**
- ⚠️ App size increases by ~600MB
- ⚠️ Build time increases by 10-15 minutes
- ⚠️ Platform-specific builds (can't cross-compile)

---

## Quick Start

### Prerequisites

- Python 3.10 or later installed
- ~2GB free disk space (temporary)
- Internet connection (for first build)

### Build Command

```bash
npm run build:python-runtime
```

This will:
1. Create a virtual environment
2. Install FunASR and all dependencies
3. Package everything into `resources/python-runtime/runtime-<platform>.tar.gz`
4. Generate `runtime.manifest` with version info

### Verify Build

```bash
npm run verify:python-runtime
```

### Check Status

```bash
npm run check:python-runtime
```

---

## Build Process

### Step-by-Step

1. **Prepare Environment**
   ```bash
   # Install Python 3.10+ if needed
   python3 --version  # Should be 3.10 or higher
   ```

2. **Build Runtime**
   ```bash
   npm run build:python-runtime
   ```

   The script will:
   - Create temporary virtual environment
   - Install dependencies from `resources/python/requirements.txt`
   - Package the venv as `runtime-<platform>.tar.gz`
   - Generate `runtime.manifest` with build metadata
   - Clean up temporary files

3. **Verify Build**
   ```bash
   npm run verify:python-runtime
   ```

   This validates:
   - Archive exists and is properly formatted
   - Python interpreter is present
   - FunASR can be imported
   - All dependencies are installed

4. **Package App**
   ```bash
   npm run build
   npm run dist
   ```

   The runtime will be automatically included in the distribution.

### Build Output

After a successful build, you'll have:

```
resources/python-runtime/
├── runtime.manifest          # Build metadata (version, date, Python version)
└── runtime-macos.tar.gz      # ~600MB packaged runtime
```

**Manifest Example:**
```json
{
  "version": "2025-01-06T12:34:56Z",
  "python_version": "3.10.13",
  "platform": "macos",
  "funasr_version": "1.0.33",
  "created_at": "2025-01-06T12:34:56Z",
  "notes": "Pre-built Python runtime with FunASR dependencies"
}
```

---

## Platform-Specific Instructions

### macOS

```bash
# Use system Python or Homebrew Python
brew install python@3.10  # If needed

npm run build:python-runtime
```

**Notes:**
- Universal binary support (x64 + ARM64) depends on Python installation
- Use `python3.10` for best compatibility
- Tested on macOS 11 (Big Sur) and later

### Linux

```bash
# Install Python 3.10+
sudo apt-get install python3.10 python3.10-venv  # Ubuntu/Debian
# or
sudo yum install python310  # RHEL/CentOS

npm run build:python-runtime
```

**Notes:**
- Ensure `python3.10-venv` is installed
- Consider building on the oldest supported distribution
- May need additional system libraries for onnxruntime

### Windows

```powershell
# Install Python from python.org
# Ensure "Add Python to PATH" is checked

npm run build:python-runtime
```

**Notes:**
- Use Python installer from python.org (not Windows Store version)
- May require Visual C++ Redistributables
- Consider using Python 3.10 for best compatibility

---

## Verification

### Automated Verification

```bash
npm run verify:python-runtime
```

**Checks performed:**
- ✓ Manifest file exists and is valid
- ✓ Archive exists and is properly sized (>100MB)
- ✓ Archive integrity (SHA256 checksum)
- ✓ Python interpreter is present
- ✓ Python version is correct
- ✓ FunASR can be imported successfully

### Manual Verification

```bash
# Extract runtime manually
cd resources/python-runtime
tar -xzf runtime-macos.tar.gz -C /tmp/test-runtime

# Find Python binary
find /tmp/test-runtime -name python3 -o -name python

# Test import
/tmp/test-runtime/runtime/bin/python3 -c "import funasr; print(funasr.__version__)"
```

---

## Troubleshooting

### Build Failures

#### Problem: "Python not found"

```
✗ Python not found: python3
```

**Solution:**
- Install Python 3.10+ from https://www.python.org/downloads/
- Or specify path: `npm run build:python-runtime -- --python /path/to/python3.10`

---

#### Problem: "Failed to install FunASR dependencies"

```
✗ Failed to install FunASR dependencies
```

**Solutions:**
1. **Check internet connection** - Initial build requires downloading ~500MB
2. **Use offline wheels:**
   ```bash
   # Download wheels first
   pip download -r resources/python/requirements.txt -d resources/python/wheels/

   # Then build
   npm run build:python-runtime
   ```
3. **Check disk space** - Need ~2GB temporary space
4. **Try different Python version** - Use Python 3.10 specifically

---

#### Problem: "Import test failed"

```
✗ Failed to import funasr
```

**Solutions:**
- Rebuild with `--skip-test` to bypass verification:
  ```bash
  npm run build:python-runtime -- --skip-test
  ```
- Check Python version compatibility
- Ensure platform-specific wheels are correct

---

#### Problem: "Archive size too small"

```
⚠ Archive size (50MB) is smaller than expected (min 100MB)
```

**Solution:**
- Dependencies may not have installed correctly
- Rebuild with verbose output:
  ```bash
  bash scripts/build-python-runtime.sh 2>&1 | tee build.log
  ```

---

### Runtime Failures

#### Problem: "Embedded runtime not available"

**In development:**
```
⚠️  Python runtime is not bundled with this build.
   Developers: Run "npm run build:python-runtime" to create it.
```

**Solution:**
```bash
npm run build:python-runtime
npm run dev
```

**In production (distributed app):**
- Runtime should be included automatically
- Check `electron-builder` config includes `resources/**/*`
- Verify runtime exists before packaging: `npm run check:python-runtime`

---

## Advanced Configuration

### Custom Python Path

```bash
# Use specific Python version
npm run build:python-runtime -- --python /usr/local/bin/python3.11

# Or set environment variable
PYTHON_CMD=/usr/local/bin/python3.11 npm run build:python-runtime
```

### Custom Output Directory

```bash
npm run build:python-runtime -- --output-dir /path/to/output
```

### Skip Verification Tests

```bash
# Faster build, skip import tests
npm run build:python-runtime -- --skip-test
```

### Environment Variables

```bash
# Override platform detection
PLATFORM=linux npm run build:python-runtime

# Use specific Python
PYTHON_CMD=python3.11 npm run build:python-runtime

# Skip verification
SKIP_TEST=true npm run build:python-runtime
```

### Using Offline Wheels

For builds without internet access:

```bash
# Step 1: Download wheels on a machine with internet
pip download \
  -r resources/python/requirements.txt \
  -d resources/python/wheels/ \
  --platform macosx_11_0_universal2  # or linux_x86_64, win_amd64

# Step 2: Commit wheels to git (or distribute separately)
# Note: wheels/ directory is ~300MB

# Step 3: Build offline
npm run build:python-runtime
```

The build script automatically detects and uses offline wheels if available.

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Python Runtime

on:
  push:
    branches: [main]
    paths:
      - 'resources/python/requirements.txt'
      - 'scripts/build-python-runtime.sh'

jobs:
  build-runtime:
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build Python runtime
        run: npm run build:python-runtime

      - name: Verify runtime
        run: npm run verify:python-runtime

      - name: Upload runtime artifact
        uses: actions/upload-artifact@v3
        with:
          name: python-runtime-${{ runner.os }}
          path: resources/python-runtime/runtime-*.tar.gz
          retention-days: 30
```

### Pre-build Hook

Add to `package.json` to ensure runtime is built before packaging:

```json
{
  "scripts": {
    "prebuild": "npm run check:python-runtime || npm run build:python-runtime",
    "build": "npm run build:main && npm run build:renderer"
  }
}
```

---

## Best Practices

### For Developers

1. **Build runtime once per major update** - Not needed for every code change
2. **Add to .gitignore** - Runtime archives are too large for git (use Git LFS if needed)
3. **Verify before committing** - Always run `npm run verify:python-runtime`
4. **Document Python version** - Update CLAUDE.md with required Python version

### For CI/CD

1. **Cache runtime builds** - Save 10-15 minutes per build
2. **Build per platform** - Can't cross-compile Python environments
3. **Upload as artifacts** - Distribute runtime archives separately
4. **Version runtime archives** - Tag with date or commit hash

### For Distribution

1. **Test extracted runtime** - Verify on clean system without Python
2. **Document app size** - Inform users app is ~1GB due to transcription features
3. **Provide fallback** - Allow users to use system Python if needed
4. **Monitor runtime logs** - Check `userData/python/logs/` for issues

---

## Reference

### File Structure

```
easypod/
├── resources/
│   ├── python/                      # Python resources (always committed)
│   │   ├── funasr_service.py       # FastAPI service script
│   │   ├── requirements.txt        # Python dependencies
│   │   ├── runtime.manifest        # Build metadata (placeholder)
│   │   └── wheels/                 # Optional offline wheels
│   └── python-runtime/             # Runtime build output (gitignored)
│       ├── runtime.manifest        # Actual build metadata
│       └── runtime-<platform>.tar.gz  # Packaged runtime (~600MB)
├── scripts/
│   ├── build-python-runtime.sh    # Build script
│   ├── verify-runtime.js          # Verification script
│   └── check-runtime-status.js   # Quick status check
└── docs/
    └── python-runtime-build.md    # This file
```

### Dependencies (requirements.txt)

```
funasr>=1.0.33
modelscope>=1.9.5
fastapi>=0.110.0,<0.112
uvicorn[standard]>=0.29.0
pydantic>=1.10,<3.0
soundfile>=0.12.1
numpy>=1.23
onnxruntime>=1.16
scipy>=1.10
```

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `EASYPOD_FUNASR_PYTHON` | Override Python interpreter | `/usr/local/bin/python3.11` |
| `EASYPOD_FUNASR_SERVER_SCRIPT` | Override server script path | `/custom/path/funasr_service.py` |
| `EASYPOD_FUNASR_SKIP_INSTALL` | Skip dependency installation | `1` or `true` |
| `PLATFORM` | Override platform detection | `macos`, `linux`, `windows` |
| `PYTHON_CMD` | Python command for build | `python3.10` |
| `SKIP_TEST` | Skip import verification | `true` |

---

## Getting Help

- **Build issues**: Check [Troubleshooting](#troubleshooting) section
- **FunASR problems**: See [FunASR documentation](https://github.com/alibaba-damo-academy/FunASR)
- **Electron packaging**: See [electron-builder docs](https://www.electron.build/)
- **Project issues**: Open an issue on GitHub

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project overview and development guide
- [plan.md](./plan.md) - Project roadmap and feature stages
- [Python Runtime Manager](../src/main/services/funasr/PythonRuntimeManager.ts) - Runtime management code
- [FunASR Service](../resources/python/funasr_service.py) - Python transcription service
