#!/usr/bin/env bash
# Build a self-contained Python runtime for FunASR integration
# This script creates a virtual environment, installs all dependencies,
# and packages it as a tar.gz archive for distribution with the Electron app.

set -euo pipefail

# Default configuration
PLATFORM="${PLATFORM:-$(uname -s | tr '[:upper:]' '[:lower:]')}"
PYTHON_CMD="${PYTHON_CMD:-python3}"
OUTPUT_DIR="resources/python-runtime"
REQUIREMENTS_FILE="resources/python/requirements.txt"
SKIP_TEST="${SKIP_TEST:-false}"
TEMP_DIR=""

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
  echo -e "${GREEN}✓${NC} $*"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
  echo -e "${RED}✗${NC} $*" >&2
}

cleanup() {
  if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
    log_info "Cleaning up temporary directory: ${TEMP_DIR}"
    rm -rf "${TEMP_DIR}"
  fi
}

trap cleanup EXIT

show_help() {
  cat <<EOF
Build Python Runtime for EasyPod FunASR

Usage: $0 [OPTIONS]

Options:
  --platform <name>     Target platform (macos|linux|windows) [default: auto-detect]
  --python <path>       Path to Python executable [default: python3]
  --output-dir <path>   Output directory [default: resources/python-runtime]
  --skip-test           Skip import verification tests
  -h, --help            Show this help message

Environment Variables:
  PLATFORM              Override platform detection
  PYTHON_CMD            Override Python command
  SKIP_TEST             Skip verification (set to 'true')

Examples:
  # Build for current platform with default Python
  $0

  # Build with specific Python version
  $0 --python /usr/local/bin/python3.10

  # Build for macOS explicitly
  $0 --platform macos

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --python)
      PYTHON_CMD="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --skip-test)
      SKIP_TEST=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Normalize platform name
case "${PLATFORM}" in
  darwin|macos|osx)
    PLATFORM="macos"
    ;;
  linux)
    PLATFORM="linux"
    ;;
  win32|windows|mingw*)
    PLATFORM="windows"
    ;;
  *)
    log_error "Unsupported platform: ${PLATFORM}"
    exit 1
    ;;
esac

log_info "Building Python runtime for platform: ${PLATFORM}"

# Check Python availability and version
if ! command -v "${PYTHON_CMD}" &> /dev/null; then
  log_error "Python not found: ${PYTHON_CMD}"
  log_error "Please install Python 3.10+ or specify --python <path>"
  exit 1
fi

PYTHON_VERSION=$("${PYTHON_CMD}" --version 2>&1 | awk '{print $2}')
PYTHON_MAJOR=$(echo "${PYTHON_VERSION}" | cut -d. -f1)
PYTHON_MINOR=$(echo "${PYTHON_VERSION}" | cut -d. -f2)

log_info "Found Python ${PYTHON_VERSION}"

if [[ ${PYTHON_MAJOR} -lt 3 ]] || [[ ${PYTHON_MAJOR} -eq 3 && ${PYTHON_MINOR} -lt 10 ]]; then
  log_error "Python 3.10+ is required (found ${PYTHON_VERSION})"
  exit 1
fi

log_success "Python version check passed"

# Check requirements file
if [[ ! -f "${REQUIREMENTS_FILE}" ]]; then
  log_error "Requirements file not found: ${REQUIREMENTS_FILE}"
  exit 1
fi

log_info "Using requirements: ${REQUIREMENTS_FILE}"

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Create temporary build directory
TEMP_DIR=$(mktemp -d -t easypod-runtime-XXXXXX)
log_info "Created temporary directory: ${TEMP_DIR}"

VENV_DIR="${TEMP_DIR}/runtime"
log_info "Creating virtual environment at: ${VENV_DIR}"

# Create virtual environment
"${PYTHON_CMD}" -m venv "${VENV_DIR}"

# Determine activation script path
if [[ "${PLATFORM}" == "windows" ]]; then
  ACTIVATE_SCRIPT="${VENV_DIR}/Scripts/activate"
  PYTHON_BIN="${VENV_DIR}/Scripts/python.exe"
  PIP_BIN="${VENV_DIR}/Scripts/pip.exe"
else
  ACTIVATE_SCRIPT="${VENV_DIR}/bin/activate"
  PYTHON_BIN="${VENV_DIR}/bin/python"
  PIP_BIN="${VENV_DIR}/bin/pip"
fi

log_success "Virtual environment created"

# Upgrade pip, setuptools, wheel
log_info "Upgrading pip, setuptools, and wheel..."
"${PYTHON_BIN}" -m pip install --upgrade pip setuptools wheel --quiet

log_success "Base tools upgraded"

# Install dependencies
log_info "Installing FunASR dependencies (this may take 10-15 minutes)..."
log_warning "Downloading and building packages: funasr, onnxruntime, torch, etc."

# Check if offline wheels are available
WHEELS_DIR="resources/python/wheels"
if [[ -d "${WHEELS_DIR}" ]] && [[ -n "$(ls -A "${WHEELS_DIR}" 2>/dev/null)" ]]; then
  log_info "Using offline wheels from: ${WHEELS_DIR}"
  "${PIP_BIN}" install --no-index --find-links="${WHEELS_DIR}" -r "${REQUIREMENTS_FILE}"
else
  log_warning "No offline wheels found, downloading from PyPI (requires internet)"
  "${PIP_BIN}" install -r "${REQUIREMENTS_FILE}"
fi

log_success "Dependencies installed"

# Run import test unless skipped
if [[ "${SKIP_TEST}" != "true" ]]; then
  log_info "Verifying funasr import..."
  if "${PYTHON_BIN}" -c "import funasr; print(f'FunASR version: {funasr.__version__}')"; then
    log_success "Import verification passed"
  else
    log_error "Failed to import funasr"
    exit 1
  fi
fi

# Generate manifest
MANIFEST_FILE="${OUTPUT_DIR}/runtime.manifest"
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FUNASR_VERSION=$("${PYTHON_BIN}" -c "import funasr; print(funasr.__version__)" 2>/dev/null || echo "unknown")

log_info "Generating runtime manifest..."
cat > "${MANIFEST_FILE}" <<EOF
{
  "version": "${BUILD_DATE}",
  "python_version": "${PYTHON_VERSION}",
  "platform": "${PLATFORM}",
  "funasr_version": "${FUNASR_VERSION}",
  "created_at": "${BUILD_DATE}",
  "notes": "Pre-built Python runtime with FunASR dependencies"
}
EOF

log_success "Manifest created: ${MANIFEST_FILE}"

# Package runtime
ARCHIVE_NAME="runtime-${PLATFORM}.tar.gz"
ARCHIVE_PATH="${OUTPUT_DIR}/${ARCHIVE_NAME}"

log_info "Packaging runtime to: ${ARCHIVE_PATH}"
log_warning "This may take several minutes (compressing ~1GB of files)..."

# Create archive (strip leading path component)
tar -czf "${ARCHIVE_PATH}" -C "${TEMP_DIR}" runtime

# Get archive size
ARCHIVE_SIZE=$(du -h "${ARCHIVE_PATH}" | awk '{print $1}')
log_success "Archive created: ${ARCHIVE_NAME} (${ARCHIVE_SIZE})"

# Final verification
if [[ -f "${ARCHIVE_PATH}" ]]; then
  log_success "Build completed successfully!"
  echo ""
  log_info "Runtime details:"
  echo "  Platform:       ${PLATFORM}"
  echo "  Python:         ${PYTHON_VERSION}"
  echo "  FunASR:         ${FUNASR_VERSION}"
  echo "  Archive:        ${ARCHIVE_PATH}"
  echo "  Size:           ${ARCHIVE_SIZE}"
  echo "  Manifest:       ${MANIFEST_FILE}"
  echo ""
  log_info "Next steps:"
  echo "  1. Run 'npm run verify:python-runtime' to verify the build"
  echo "  2. Run 'npm run build' to package the Electron app"
  echo "  3. The runtime will be included in the distributed app"
else
  log_error "Archive creation failed"
  exit 1
fi
