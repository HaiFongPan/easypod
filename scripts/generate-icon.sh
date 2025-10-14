#!/bin/bash
set -e

# Generate macOS .icns file with all required sizes
# macOS requires multiple icon sizes for proper display

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$PROJECT_ROOT/resources"
ICON_ICNS="$RESOURCES_DIR/icon.icns"

# Check if sips is available (macOS built-in image tool)
if ! command -v sips &> /dev/null; then
    echo "Error: sips command not found (required on macOS)"
    exit 1
fi

# Check if iconutil is available
if ! command -v iconutil &> /dev/null; then
    echo "Error: iconutil command not found (required on macOS)"
    exit 1
fi

# Extract existing 1024x1024 source image
echo "Extracting source image from existing .icns..."
TEMP_DIR="/tmp/icon_extract_$$"
mkdir -p "$TEMP_DIR"
TEMP_ICONSET="$TEMP_DIR/temp.iconset"
iconutil -c iconset "$ICON_ICNS" -o "$TEMP_ICONSET"

# Find the largest PNG as source
SOURCE_IMAGE=$(ls -S "$TEMP_ICONSET"/*.png | head -1)
echo "Using source image: $SOURCE_IMAGE"

# Create clean iconset directory
ICONSET_DIR="$RESOURCES_DIR/icon.iconset"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# Generate all required sizes for macOS
# macOS icons need these specific sizes and retina variants
declare -a SIZES=(
    "16:icon_16x16.png"
    "32:icon_16x16@2x.png"
    "32:icon_32x32.png"
    "64:icon_32x32@2x.png"
    "128:icon_128x128.png"
    "256:icon_128x128@2x.png"
    "256:icon_256x256.png"
    "512:icon_256x256@2x.png"
    "512:icon_512x512.png"
    "1024:icon_512x512@2x.png"
)

echo "Generating icon sizes..."
for size_spec in "${SIZES[@]}"; do
    IFS=: read -r size filename <<< "$size_spec"
    output_file="$ICONSET_DIR/$filename"

    if [ ! -f "$output_file" ]; then
        echo "  Creating $filename (${size}x${size})"
        sips -z "$size" "$size" "$SOURCE_IMAGE" --out "$output_file" > /dev/null 2>&1
    else
        echo "  Skipping $filename (already exists)"
    fi
done

# Generate new .icns file
echo "Creating .icns file..."
iconutil -c icns "$ICONSET_DIR" -o "$ICON_ICNS"

# Verify the result
echo ""
echo "Verification:"
echo "  Icon file: $ICON_ICNS"
echo "  File size: $(ls -lh "$ICON_ICNS" | awk '{print $5}')"
echo "  Icon count: $(ls -1 "$ICONSET_DIR" | wc -l | tr -d ' ')"

# Clean up temp directory
rm -rf "$TEMP_DIR"

# Optionally keep the iconset directory for inspection
echo ""
echo "Icon generation complete!"
echo "Iconset directory: $ICONSET_DIR"
echo ""
echo "You can now run 'npm run dist:mac' to rebuild the app with the new icon."
