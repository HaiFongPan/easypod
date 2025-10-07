#!/usr/bin/env node

/**
 * Test script to verify the symlink fix for Python binary detection
 */

const { readdirSync } = require('fs');
const { join } = require('path');
const os = require('os');

const runtimeDir = join(os.homedir(), 'Library', 'Application Support', 'Electron', 'python', 'runtime');
const binDir = join(runtimeDir, 'bin');

console.log('Testing Python binary detection with symlink support\n');
console.log(`Checking directory: ${binDir}\n`);

try {
  const entries = readdirSync(binDir, { withFileTypes: true });
  const candidateNames = ['python3', 'python'];

  console.log('Files in bin directory:');
  for (const entry of entries) {
    const isFile = entry.isFile();
    const isSymlink = entry.isSymbolicLink();
    const isDir = entry.isDirectory();
    const match = candidateNames.includes(entry.name);

    console.log(`  ${entry.name.padEnd(20)} - File: ${isFile}, Symlink: ${isSymlink}, Dir: ${isDir}, Match: ${match}`);
  }

  console.log('\nSearching for Python with old logic (isFile only):');
  let foundOld = null;
  for (const entry of entries) {
    if (entry.isFile() && candidateNames.includes(entry.name)) {
      foundOld = join(binDir, entry.name);
      console.log(`  ✓ Found: ${foundOld}`);
      break;
    }
  }
  if (!foundOld) {
    console.log('  ✗ Not found');
  }

  console.log('\nSearching for Python with new logic (isFile || isSymbolicLink):');
  let foundNew = null;
  for (const entry of entries) {
    if ((entry.isFile() || entry.isSymbolicLink()) && candidateNames.includes(entry.name)) {
      foundNew = join(binDir, entry.name);
      console.log(`  ✓ Found: ${foundNew} (${entry.isSymbolicLink() ? 'symlink' : 'file'})`);
      break;
    }
  }
  if (!foundNew) {
    console.log('  ✗ Not found');
  }

  console.log('\nResult:', foundNew ? '✅ Fix successful!' : '❌ Still not working');

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
