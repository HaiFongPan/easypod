#!/usr/bin/env node

/**
 * Test script to verify Python runtime initialization with the symlink fix
 * This simulates what happens when the app starts up
 */

const { app } = require('electron');
const path = require('path');

// Mock electron app for testing
if (!app.isReady()) {
  app.on('ready', async () => {
    await testRuntimeInit();
    app.quit();
  });
} else {
  testRuntimeInit().then(() => app.quit());
}

async function testRuntimeInit() {
  console.log('\n=== Testing Python Runtime Initialization ===\n');

  // Set debug mode
  process.env.DEBUG_PYTHON_RUNTIME = '1';

  try {
    // Import after setting env var
    const { getPythonRuntimeManager } = require('../dist/main/services/funasr/PythonRuntimeManager.js');

    const manager = getPythonRuntimeManager();

    // Listen to events
    manager.on('log', (msg) => console.log('[PythonRuntime]', msg));
    manager.on('error', (err) => console.error('[PythonRuntime] Error:', err));
    manager.on('ready', (details) => {
      console.log('\n[PythonRuntime] ✅ Ready!');
      console.log('  Python:', details.pythonPath);
      console.log('  Runtime Dir:', details.runtimeDir);
      console.log('  Using Embedded:', details.usingEmbeddedRuntime);
    });

    console.log('Initializing Python runtime...\n');
    const details = await manager.ensureReady({ checkFunasr: true });

    console.log('\n=== Initialization Complete ===');
    console.log('Success:', details !== null);
    console.log('Details:', JSON.stringify(details, null, 2));

  } catch (error) {
    console.error('\n=== Initialization Failed ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}
