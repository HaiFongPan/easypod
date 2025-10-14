import { createServer } from 'net';

export interface PortConfig {
  defaultPort: number;
  maxRetries: number;
}

const DEFAULT_FUNASR_PORT = 17953;
const MAX_PORT_RETRIES = 3;

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available port starting from the default port
 * Tries up to maxRetries times with port+1 increment
 */
export async function findAvailablePort(
  startPort: number = DEFAULT_FUNASR_PORT,
  maxRetries: number = MAX_PORT_RETRIES,
): Promise<number> {
  for (let i = 0; i <= maxRetries; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);

    if (available) {
      if (i > 0) {
        console.log(
          `[PortConfig] Default port ${startPort} was in use, using port ${port} instead`,
        );
      }
      return port;
    }

    console.log(`[PortConfig] Port ${port} is in use, trying next...`);
  }

  throw new Error(
    `[PortConfig] Could not find available port after ${maxRetries} retries starting from ${startPort}`,
  );
}

/**
 * Get FunASR server port configuration
 */
export function getDefaultFunASRPort(): number {
  return DEFAULT_FUNASR_PORT;
}

/**
 * Get max port retries configuration
 */
export function getMaxPortRetries(): number {
  return MAX_PORT_RETRIES;
}
