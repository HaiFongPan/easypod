# Python Runtime Symlink Fix

## Issue

The Python Runtime Manager failed to detect Python binaries in the extracted runtime because the `findPythonBinary()` function only checked for regular files using `entry.isFile()`, which returns `false` for symlinks.

### Error Symptoms

```
[PythonRuntime] 🔍 Searching for Python binary in .../runtime...
[PythonRuntime]    [findPython depth=1] Searching in: .../runtime/bin
[PythonRuntime]    [findPython depth=1] Not found in: .../runtime/bin
[PythonRuntime] ❌ Python binary not found in .../runtime
```

Despite manual verification showing the Python binary exists:
```bash
$ ls .../runtime/bin/python*
python python3 python3.13  # All are symlinks
```

## Root Cause

In Python virtual environments (including the extracted runtime), Python binaries are typically symlinks to the actual interpreter binary. The `readdirSync(..., { withFileTypes: true })` API returns `Dirent` objects where:

- `entry.isFile()` returns `true` only for regular files
- `entry.isFile()` returns `false` for symlinks, even if they point to files
- `entry.isSymbolicLink()` returns `true` for symlinks

The original code only checked `entry.isFile()`:

```typescript
for (const entry of entries) {
  if (entry.isFile() && candidateNames.includes(entry.name)) {
    // This never matched because python/python3 are symlinks
    return join(root, entry.name);
  }
}
```

## Solution

Modified `findPythonBinary()` in `PythonRuntimeManager.ts` to check for both regular files and symlinks:

```typescript
for (const entry of entries) {
  if ((entry.isFile() || entry.isSymbolicLink()) && candidateNames.includes(entry.name)) {
    const foundPath = join(root, entry.name);
    this.emit('log', `   [findPython depth=${depth}] ✓ Found: ${foundPath} (${entry.isSymbolicLink() ? 'symlink' : 'file'})`);
    return foundPath;
  }
}
```

### Changed File

**`src/main/services/funasr/PythonRuntimeManager.ts`** (line 421-429)

## Verification

### Test Script

Created `scripts/test-runtime-fix.js` to verify the fix:

```bash
$ node scripts/test-runtime-fix.js

Searching for Python with old logic (isFile only):
  ✗ Not found

Searching for Python with new logic (isFile || isSymbolicLink):
  ✓ Found: .../runtime/bin/python (symlink)

Result: ✅ Fix successful!
```

### Runtime Logs

After the fix, the runtime initialization succeeds:

```
[PythonRuntime] 📦 Extracting bundled Python runtime version 2025-10-07T02:27:01Z...
[PythonRuntime] ✓ Extraction completed successfully
[PythonRuntime] 🔍 Searching for Python binary in .../runtime...
[PythonRuntime]    [findPython depth=1] ✓ Found: .../runtime/bin/python (symlink)
[PythonRuntime] ✓ Python found: .../runtime/bin/python
[PythonRuntime] 🔍 Checking funasr import...
[PythonRuntime] ✓ funasr import successful
[PythonRuntime] ✅ Embedded runtime ready
```

### Diagnostic Results

```bash
$ npm run diagnose:python-runtime

✓ Extracted runtime directory
✓ Python binary in extracted runtime
✓ Python version: Python 3.13.5
✓ FunASR import test: FunASR 1.2.7
✅ Everything looks good!
```

## Impact

### Before Fix
- Runtime extraction succeeded
- Python binary detection failed
- Fell back to system Python (if available)
- Created unnecessary venv
- Slow first-run experience

### After Fix
- Runtime extraction succeeds
- Python binary detection succeeds
- Uses embedded runtime (no system Python required)
- Fast first-run experience
- ✅ Meets requirement: "npm run dev works on any machine after clone"
- ✅ Meets requirement: "Packaged app works without external intervention"

## Related Issues

This fix also resolves:
1. Unnecessary fallback to system Python venv
2. "无法在 .../venv 创建 Python 虚拟环境" errors
3. First-run setup delays
4. External Python dependency requirement

## Files Modified

1. **src/main/services/funasr/PythonRuntimeManager.ts**
   - Line 421-429: Added `|| entry.isSymbolicLink()` check
   - Line 426: Enhanced log message to show symlink vs file

## Testing Checklist

- [x] Runtime extraction completes
- [x] Python binary detected in extracted runtime
- [x] funasr module imports successfully
- [x] No fallback to system Python
- [x] Diagnostic script passes all checks
- [x] Works from fresh clone (no prior runtime state)

## Additional Notes

### Why Symlinks?

Python virtual environments use symlinks for several reasons:
1. **Space efficiency**: Share the actual interpreter binary
2. **Version management**: Multiple names (python, python3, python3.13) point to same binary
3. **Flexibility**: Easy to update/switch Python versions
4. **Standard practice**: All venv/virtualenv implementations use this pattern

### Platform Considerations

- **macOS/Linux**: Python binaries are symlinks (this fix required)
- **Windows**: Python binaries are .exe files (already worked with `entry.isFile()`)
- The fix is safe for all platforms as it adds symlink support without breaking file detection

### Forward Compatibility

This fix ensures the runtime manager works with:
- Python virtual environments (standard library venv)
- Conda environments
- pyenv environments
- Any other Python distribution using symlinks

## References

- [Node.js fs.Dirent documentation](https://nodejs.org/api/fs.html#class-fsdirent)
- [Python venv documentation](https://docs.python.org/3/library/venv.html)
- Original issue: PythonRuntimeManager initialization failing in dev and packaged builds
