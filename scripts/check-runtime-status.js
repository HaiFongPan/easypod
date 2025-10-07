#!/usr/bin/env node
/**
 * Quick Status Check for Python Runtime
 *
 * Performs a fast check to determine if the Python runtime is built and ready.
 * Useful for CI/CD pipelines and pre-build hooks.
 */

const fs = require('fs');
const path = require('path');

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

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function checkRuntimeStatus() {
  const platform = getPlatformKey();
  const runtimeDir = path.join(process.cwd(), 'resources', 'python-runtime');
  const manifestPath = path.join(runtimeDir, 'runtime.manifest');
  const archivePath = path.join(runtimeDir, `runtime-${platform}.tar.gz`);

  const status = {
    platform,
    hasManifest: fs.existsSync(manifestPath),
    hasArchive: fs.existsSync(archivePath),
    archiveSize: null,
    manifest: null,
    ready: false,
  };

  // Read manifest
  if (status.hasManifest) {
    try {
      status.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (error) {
      status.manifest = { error: error.message };
    }
  }

  // Check archive
  if (status.hasArchive) {
    try {
      const stats = fs.statSync(archivePath);
      status.archiveSize = stats.size;
      // Consider ready if archive is at least 100MB
      status.ready = stats.size > 100 * 1024 * 1024;
    } catch (error) {
      status.archiveSize = null;
    }
  }

  return status;
}

function printStatus(status) {
  const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
  };

  console.log(`${colors.cyan}Python Runtime Status${colors.reset}\n`);
  console.log(`Platform:    ${status.platform}`);
  console.log(`Manifest:    ${status.hasManifest ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  console.log(`Archive:     ${status.hasArchive ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);

  if (status.archiveSize) {
    console.log(`Size:        ${formatBytes(status.archiveSize)}`);
  }

  if (status.manifest && !status.manifest.error) {
    console.log(`\nManifest Details:`);
    console.log(`  Version:   ${status.manifest.version || 'N/A'}`);
    console.log(`  Python:    ${status.manifest.python_version || 'N/A'}`);
    console.log(`  FunASR:    ${status.manifest.funasr_version || 'N/A'}`);
  }

  console.log('');
  if (status.ready) {
    console.log(`${colors.green}✓ Runtime is ready for packaging${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ Runtime not found or incomplete${colors.reset}`);
    console.log(`${colors.cyan}ℹ Run 'npm run build:python-runtime' to build it${colors.reset}`);
  }
}

// Main execution
const status = checkRuntimeStatus();

// Output JSON if requested
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(status, null, 2));
  process.exit(status.ready ? 0 : 1);
}

// Pretty print status
printStatus(status);
process.exit(status.ready ? 0 : 1);
