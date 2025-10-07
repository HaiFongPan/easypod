# EasyPod Media Controls Testing Guide

This guide explains how to test all the media control functionality in the EasyPod audio player.

## Quick Start

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the application** - The Electron window should appear with a test interface

3. **The test interface includes:**
   - Episode selection buttons
   - Player status display
   - Manual control buttons
   - Real-time status updates
   - Keyboard shortcut reference

## 🎵 Testing Basic Audio Controls

### Play/Pause Functionality
1. **Select a test episode** from the episode selection buttons
2. **Click "Play"** button or press **Space bar**
3. **Verify:**
   - Play button changes to pause icon
   - "Playing" status shows ▶️
   - Position counter starts updating
4. **Click "Pause"** or press **Space bar** again
5. **Verify:**
   - Pause icon appears
   - "Playing" status shows ⏸️
   - Position counter stops

### Seek/Skip Controls
1. **Load an episode** and start playing
2. **Test skip buttons:**
   - Click "⏪ -10s" or press **Left Arrow**
   - Click "⏩ +10s" or press **Right Arrow**
   - Verify position changes by 10 seconds
3. **Test seek percentage buttons (0%, 25%, 50%, 75%, 100%):**
   - Click each percentage button
   - Verify position jumps to correct time
4. **Test progress bar clicking:**
   - Click anywhere on the progress bar
   - Verify audio jumps to clicked position

## 🔊 Testing Volume Controls

### Volume Adjustment
1. **Test volume percentage buttons (0%, 25%, 50%, 75%, 100%):**
   - Click each volume button
   - Verify volume indicator updates
   - Listen for actual volume changes
2. **Test volume slider (hover over volume icon):**
   - Hover over volume icon in main player
   - Drag the volume slider
   - Verify smooth volume changes
3. **Test keyboard volume control:**
   - Press **Up Arrow** to increase volume
   - Press **Down Arrow** to decrease volume
   - Verify volume changes in 5% increments
4. **Test mute functionality:**
   - Click volume icon to mute/unmute
   - Verify mute icon changes

## ⚡ Testing Speed Controls

### Playback Rate Changes
1. **Test speed buttons (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x):**
   - Click each speed button
   - Verify playback rate indicator updates
   - Listen for actual speed changes
2. **Test keyboard shortcuts:**
   - Press **1** for 1x speed
   - Press **2** for 1.5x speed
   - Press **3** for 2x speed
3. **Test speed dropdown (hover over speed indicator):**
   - Hover over speed control in main player
   - Select different speeds from dropdown
   - Verify smooth transitions

## ⌨️ Testing Keyboard Shortcuts

### Required Setup
- **Focus the application window** (click on it)
- **Ensure no input fields are selected**
- **Load and play an episode**

### Keyboard Commands
| Key | Action | Expected Result |
|-----|--------|----------------|
| **Space** | Play/Pause | Toggle playback state |
| **←** | Skip backward | Jump back 10 seconds |
| **→** | Skip forward | Jump forward 10 seconds |
| **↑** | Volume up | Increase volume by 5% |
| **↓** | Volume down | Decrease volume by 5% |
| **1** | Normal speed | Set playback rate to 1x |
| **2** | Fast speed | Set playback rate to 1.5x |
| **3** | Faster speed | Set playback rate to 2x |

## 🎛️ Testing Media Session API (System Controls)

### macOS Testing
1. **Load and play an episode**
2. **Test Touch Bar controls** (if available):
   - Play/pause button
   - Previous/next track buttons
3. **Test Control Center** (macOS Big Sur+):
   - Open Control Center
   - Look for EasyPod controls
   - Test play/pause from system controls
4. **Test Lock Screen controls**:
   - Lock the screen while playing
   - Use media controls on lock screen
5. **Test external media keys**:
   - Use keyboard media keys (if available)
   - Test Bluetooth headphone controls

### Verification Points
- **Metadata display**: Episode title and artwork show in system controls
- **State sync**: System controls reflect actual player state
- **Bidirectional control**: System controls affect app player and vice versa

## 📊 Progress Bar & Buffering Tests

### Interactive Progress Bar
1. **Load a longer episode** (Test Episode 2 or Music Sample)
2. **Test click-to-seek**:
   - Click at different positions on progress bar
   - Verify immediate position changes
3. **Test drag functionality** (if implemented):
   - Click and drag the progress thumb
   - Verify smooth seeking
4. **Test buffering visualization**:
   - Look for buffer fill indicators
   - Verify buffered content shows differently

### Edge Cases
1. **Test with very short audio** (< 10 seconds)
2. **Test with network audio** (streaming URLs)
3. **Test seeking beyond duration** (should clamp to max)
4. **Test seeking to negative values** (should clamp to 0)

## 🐛 Common Issues & Troubleshooting

### Audio Won't Play
- **Check browser console** for CORS errors
- **Try alternative audio sources** in test data
- **Verify internet connection** for remote audio
- **Check audio format support** (MP3, WAV, OGG)

### Controls Not Responsive
- **Ensure window is focused** for keyboard shortcuts
- **Check for JavaScript errors** in console
- **Verify Zustand store updates** in React DevTools
- **Test with different audio sources**

### Media Session Not Working
- **macOS only feature** - won't work on other platforms in Electron
- **Requires audio to be playing** to show system controls
- **Check electron version** supports Media Session API
- **Verify metadata is properly set**

## 📝 Testing Checklist

### Basic Functionality
- [ ] Episode loads without errors
- [ ] Play button starts audio playback
- [ ] Pause button stops audio playback
- [ ] Skip forward/backward works (10s increments)
- [ ] Seek to position works accurately
- [ ] Position counter updates in real-time
- [ ] Duration is displayed correctly

### Volume Controls
- [ ] Volume slider appears on hover
- [ ] Volume can be adjusted smoothly
- [ ] Mute toggle works correctly
- [ ] Volume persists across episodes
- [ ] Keyboard volume controls work

### Speed Controls
- [ ] Speed dropdown appears on hover
- [ ] All speed options work (0.5x - 3x)
- [ ] Speed persists across episodes
- [ ] Keyboard speed shortcuts work
- [ ] Audio quality remains good at different speeds

### Keyboard Shortcuts
- [ ] Space bar play/pause works
- [ ] Arrow keys control skip/volume
- [ ] Number keys control speed
- [ ] Shortcuts only work when window focused
- [ ] Shortcuts don't interfere with text inputs

### System Integration
- [ ] Media metadata appears in system controls
- [ ] System play/pause controls work
- [ ] Lock screen controls function
- [ ] External media keys respond
- [ ] Touch Bar controls work (macOS)

### Progress & Buffering
- [ ] Progress bar shows current position
- [ ] Clicking progress bar seeks correctly
- [ ] Buffered content is visualized
- [ ] Time displays format correctly (MM:SS)
- [ ] Progress updates smoothly during playback

### Error Handling
- [ ] Invalid audio URLs show error message
- [ ] Network errors are handled gracefully
- [ ] Large files don't cause performance issues
- [ ] Unsupported formats show appropriate feedback

## 🔧 Advanced Testing

### Performance Testing
1. **Load multiple episodes rapidly**
2. **Test with large audio files** (> 100MB)
3. **Stress test seeking** (rapid position changes)
4. **Memory leak testing** (long playback sessions)

### Accessibility Testing
1. **Test with keyboard-only navigation**
2. **Verify ARIA labels** on controls
3. **Test with screen readers** (if available)
4. **Check color contrast** in dark/light modes

### Cross-Platform Testing
1. **Test on different macOS versions**
2. **Compare behavior** in development vs production build
3. **Test with different** network conditions
4. **Verify consistent** behavior across different screen sizes

---

## 🏁 Quick Verification Script

Run this sequence for a comprehensive test:

1. **Start app**: `npm run dev`
2. **Load episode**: Click "Test Episode 2"
3. **Play test**: Press Space to play
4. **Skip test**: Press → three times (should advance 30s)
5. **Volume test**: Press ↑ five times (should increase volume)
6. **Speed test**: Press 2 (should set 1.5x speed)
7. **Seek test**: Click 50% button
8. **System test**: Use macOS Control Center controls
9. **Progress test**: Click different positions on progress bar
10. **Pause test**: Press Space to pause

If all steps work correctly, your media controls are functioning properly! 🎉