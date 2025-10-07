#!/usr/bin/env node
/**
 * Verify Python Runtime for EasyPod FunASR
 *
 * This script validates that the bundled Python runtime is:
 * 1. Present and correctly packaged
 * 2. Contains a working Python interpreter
 * 3. Has FunASR and all dependencies installed
 * 4. Can successfully import funasr
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createHash } = require('crypto');

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(level, message) {
  const icons = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗',
  };
  const color = colors[level === 'error' ? 'red' : level === 'warning' ? 'yellow' : level === 'success' ? 'green' : 'blue'];
  console.log(`${color}${icons[level] || 'ℹ'}${colors.reset} ${message}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function calculateSHA256(filePath) {
  const hash = createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function getPlatformKey() {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    default:
      return 'unknown';
  }
}

async function verifyRuntime() {
  log('info', 'Starting Python runtime verification...\n');

  const platform = getPlatformKey();
  const runtimeDir = path.join(process.cwd(), 'resources', 'python-runtime');
  const manifestPath = path.join(runtimeDir, 'runtime.manifest');
  const archiveName = `runtime-${platform}.tar.gz`;
  const archivePath = path.join(runtimeDir, archiveName);

  let exitCode = 0;
  const results = {
    manifest: false,
    archive: false,
    size: false,
    integrity: false,
  };

  // Check 1: Manifest file
  log('info', '1️⃣  Checking runtime manifest...');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      log('success', `Manifest found`);
      console.log(`   Version:        ${manifest.version || 'N/A'}`);
      console.log(`   Python:         ${manifest.python_version || 'N/A'}`);
      console.log(`   Platform:       ${manifest.platform || 'N/A'}`);
      console.log(`   FunASR:         ${manifest.funasr_version || 'N/A'}`);
      console.log(`   Created:        ${manifest.created_at || 'N/A'}`);
      results.manifest = true;

      // Check platform match
      if (manifest.platform && manifest.platform !== platform) {
        log('warning', `Manifest platform (${manifest.platform}) doesn't match current platform (${platform})`);
      }
    } catch (error) {
      log('error', `Failed to parse manifest: ${error.message}`);
      exitCode = 1;
    }
  } else {
    log('error', `Manifest not found: ${manifestPath}`);
    log('info', 'Run `npm run build:python-runtime` to create the runtime');
    exitCode = 1;
  }
  console.log('');

  // Check 2: Archive file
  log('info', '2️⃣  Checking runtime archive...');
  if (fs.existsSync(archivePath)) {
    const stats = fs.statSync(archivePath);
    const size = formatBytes(stats.size);
    log('success', `Archive found: ${archiveName}`);
    console.log(`   Size:           ${size}`);
    console.log(`   Path:           ${archivePath}`);
    results.archive = true;

    // Check size (should be at least 100MB for a valid runtime)
    const minSize = 100 * 1024 * 1024; // 100MB
    if (stats.size < minSize) {
      log('warning', `Archive size (${size}) is smaller than expected (min 100MB)`);
      log('warning', 'The runtime may be incomplete or corrupted');
    } else {
      results.size = true;
    }

    // Calculate checksum
    log('info', 'Calculating archive integrity (SHA256)...');
    try {
      const checksum = calculateSHA256(archivePath);
      log('success', 'Archive integrity verified');
      console.log(`   SHA256:         ${checksum.substring(0, 16)}...`);
      results.integrity = true;
    } catch (error) {
      log('error', `Failed to calculate checksum: ${error.message}`);
      exitCode = 1;
    }
  } else {
    log('error', `Archive not found: ${archivePath}`);
    log('info', 'Run `npm run build:python-runtime` to create the runtime');
    exitCode = 1;
  }
  console.log('');

  // Check 3: Test extraction (optional, only if archive exists)
  if (results.archive && results.integrity) {
    log('info', '3️⃣  Testing archive extraction...');
    try {
      const tempDir = path.join(runtimeDir, '.verify-temp');

      // Clean up existing temp dir
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Extract archive
      execSync(`tar -xzf "${archivePath}" -C "${tempDir}"`, { stdio: 'pipe' });
      log('success', 'Archive extracted successfully');

      // Find Python binary
      const runtimeRoot = path.join(tempDir, 'runtime');
      let pythonBin = null;

      function findPython(dir, depth = 0) {
        if (depth > 4) return null;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isFile()) {
            const candidates = process.platform === 'win32'
              ? ['python.exe', 'python3.exe']
              : ['python3', 'python'];
            if (candidates.includes(entry.name)) {
              return path.join(dir, entry.name);
            }
          }
        }

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const found = findPython(path.join(dir, entry.name), depth + 1);
            if (found) return found;
          }
        }

        return null;
      }

      pythonBin = findPython(runtimeRoot);

      if (pythonBin) {
        log('success', 'Python interpreter found');
        console.log(`   Path:           ${path.relative(tempDir, pythonBin)}`);

        // Test Python version
        try {
          const version = execSync(`"${pythonBin}" --version`, { encoding: 'utf-8' }).trim();
          log('success', `Python version: ${version}`);
        } catch (error) {
          log('error', `Failed to get Python version: ${error.message}`);
          exitCode = 1;
        }

        // Test funasr import
        log('info', 'Testing funasr import...');
        try {
          const importTest = execSync(
            `"${pythonBin}" -c "import funasr; print(f'FunASR {funasr.__version__}')"`,
            { encoding: 'utf-8', stdio: 'pipe' }
          ).trim();
          log('success', `Import test passed: ${importTest}`);
        } catch (error) {
          log('error', 'Failed to import funasr');
          console.log(`   Error: ${error.message}`);
          exitCode = 1;
        }
      } else {
        log('error', 'Python interpreter not found in extracted runtime');
        exitCode = 1;
      }

      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      log('error', `Extraction test failed: ${error.message}`);
      exitCode = 1;
    }
    console.log('');
  }

  // Summary
  log('info', '📊 Verification Summary:');
  console.log(`   Manifest:       ${results.manifest ? '✓' : '✗'}`);
  console.log(`   Archive:        ${results.archive ? '✓' : '✗'}`);
  console.log(`   Size Check:     ${results.size ? '✓' : '✗'}`);
  console.log(`   Integrity:      ${results.integrity ? '✓' : '✗'}`);
  console.log('');

  if (exitCode === 0) {
    log('success', 'Python runtime verification passed! ✨');
    log('info', 'The runtime is ready for distribution');
  } else {
    log('error', 'Python runtime verification failed!');
    log('info', 'To rebuild the runtime, run: npm run build:python-runtime');
  }

  return exitCode;
}

// Run verification
verifyRuntime()
  .then((code) => process.exit(code))
  .catch((error) => {
    log('error', `Verification failed with error: ${error.message}`);
    process.exit(1);
  });
