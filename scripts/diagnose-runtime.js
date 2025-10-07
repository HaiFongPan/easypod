#!/usr/bin/env node

/**
 * Diagnostic tool for Python Runtime issues
 *
 * Usage: node scripts/diagnose-runtime.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title) {
  console.log('');
  log(`${'='.repeat(60)}`, colors.blue);
  log(`  ${title}`, colors.blue);
  log(`${'='.repeat(60)}`, colors.blue);
}

function checkFile(filePath, description, required = true) {
  const exists = fs.existsSync(filePath);
  const icon = exists ? '✓' : '✗';
  const color = exists ? colors.green : (required ? colors.red : colors.yellow);

  log(`${icon} ${description}`, color);

  if (exists) {
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      log(`  Size: ${sizeMB} MB`, colors.gray);
    }
    log(`  Path: ${filePath}`, colors.gray);
  } else {
    log(`  Expected: ${filePath}`, colors.gray);
  }

  return exists;
}

function exec(command, description) {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    log(`✓ ${description}`, colors.green);
    log(`  ${output.trim()}`, colors.gray);
    return { success: true, output };
  } catch (error) {
    log(`✗ ${description}`, colors.red);
    log(`  ${error.message}`, colors.gray);
    return { success: false, error };
  }
}

// Main diagnostic flow
section('Python Runtime Diagnostics');

// 1. Check bundled runtime files
section('1. Bundled Runtime Files');

const projectRoot = path.resolve(__dirname, '..');
const runtimeDir = path.join(projectRoot, 'resources', 'python-runtime');
const manifest = path.join(runtimeDir, 'runtime.manifest');
const archive = path.join(runtimeDir, 'runtime-macos.tar.gz');

checkFile(runtimeDir, 'Runtime directory exists', true);
const hasManifest = checkFile(manifest, 'Runtime manifest exists', true);
const hasArchive = checkFile(archive, 'Runtime archive exists', true);

if (hasManifest) {
  try {
    const manifestContent = JSON.parse(fs.readFileSync(manifest, 'utf-8'));
    log('  Manifest details:', colors.gray);
    log(`    Version: ${manifestContent.version}`, colors.gray);
    log(`    Python: ${manifestContent.python_version}`, colors.gray);
    log(`    FunASR: ${manifestContent.funasr_version}`, colors.gray);
  } catch (error) {
    log(`  Failed to parse manifest: ${error.message}`, colors.red);
  }
}

// 2. Check archive structure
if (hasArchive) {
  section('2. Archive Structure');

  exec(
    `tar -tzf "${archive}" | head -20`,
    'Archive contents (first 20 entries)'
  );

  const hasPython = exec(
    `tar -tzf "${archive}" | grep -E "bin/python3?$" | head -1`,
    'Python binary in archive'
  );

  if (hasPython.success) {
    log('  Archive structure looks valid', colors.green);
  } else {
    log('  Archive may be corrupted or incomplete', colors.red);
  }
}

// 3. Check extracted runtime (if exists)
section('3. Extracted Runtime (User Data)');

const homeDir = require('os').homedir();
const userDataDir = path.join(homeDir, 'Library', 'Application Support', 'Electron', 'python');
const extractedRuntime = path.join(userDataDir, 'runtime');
const extractedManifest = path.join(userDataDir, 'runtime.json');
const venvDir = path.join(userDataDir, 'venv');

log(`User data directory: ${userDataDir}`, colors.gray);
console.log('');

const hasExtractedRuntime = checkFile(extractedRuntime, 'Extracted runtime directory', false);
const hasExtractedManifest = checkFile(extractedManifest, 'Extracted runtime manifest', false);
const hasVenv = checkFile(venvDir, 'System Python venv (fallback)', false);

if (hasExtractedRuntime) {
  const pythonBin = path.join(extractedRuntime, 'bin', 'python3');
  if (checkFile(pythonBin, 'Python binary in extracted runtime', false)) {
    exec(
      `"${pythonBin}" --version`,
      'Python version'
    );

    exec(
      `"${pythonBin}" -c "import funasr; print(f'FunASR {funasr.__version__}')"`,
      'FunASR import test'
    );
  }
}

if (hasVenv) {
  log('  ⚠️  System Python venv exists - runtime may have fallen back', colors.yellow);
  const venvPython = path.join(venvDir, 'bin', 'python3');
  if (fs.existsSync(venvPython)) {
    exec(
      `"${venvPython}" --version`,
      'Venv Python version'
    );
  }
}

// 4. Check system Python
section('4. System Python');

exec('which python3', 'Python3 location');
exec('python3 --version', 'Python3 version');
exec('python3 -c "import venv; print(\\"venv module available\\")"', 'venv module check');

// 5. Recommendations
section('5. Recommendations');

if (hasArchive && hasManifest) {
  log('✅ Bundled runtime is properly built', colors.green);

  if (!hasExtractedRuntime) {
    log('⚠️  Runtime not extracted yet', colors.yellow);
    log('   This is normal on first run - it will be extracted automatically', colors.gray);
  } else {
    log('✓ Runtime already extracted', colors.green);
  }

  if (hasVenv) {
    log('⚠️  System Python venv exists alongside extracted runtime', colors.yellow);
    log('   This suggests the embedded runtime may have failed to load', colors.yellow);
    log('   Try the following:', colors.yellow);
    log('   1. Delete the venv: rm -rf ~/Library/Application\\ Support/Electron/python/venv', colors.gray);
    log('   2. Delete extracted runtime: rm -rf ~/Library/Application\\ Support/Electron/python/runtime*', colors.gray);
    log('   3. Run the app with DEBUG_PYTHON_RUNTIME=1 npm run dev to see detailed logs', colors.gray);
  }
} else {
  log('❌ Bundled runtime is missing', colors.red);
  log('   Run: npm run build:python-runtime', colors.yellow);
}

section('Next Steps');

if (!hasArchive) {
  log('1. Build the Python runtime:', colors.yellow);
  log('   npm run build:python-runtime', colors.gray);
} else if (hasVenv && hasExtractedRuntime) {
  log('1. Clean up conflicting runtime directories:', colors.yellow);
  log('   rm -rf ~/Library/Application\\ Support/Electron/python/{venv,runtime}', colors.gray);
  log('2. Run with debug logging:', colors.yellow);
  log('   DEBUG_PYTHON_RUNTIME=1 npm run dev', colors.gray);
  log('3. Check console output for specific error messages', colors.gray);
} else {
  log('✓ Everything looks good!', colors.green);
  log('  If you still encounter issues, run with debug logging:', colors.gray);
  log('  DEBUG_PYTHON_RUNTIME=1 npm run dev', colors.gray);
}

console.log('');
