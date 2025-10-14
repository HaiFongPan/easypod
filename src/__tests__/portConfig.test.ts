import { isPortAvailable, findAvailablePort } from '../main/config/portConfig';
import { createServer } from 'net';

describe('Port Configuration', () => {
  describe('isPortAvailable', () => {
    it('should return true for an available port', async () => {
      // Use a high random port to avoid conflicts
      const port = 40000 + Math.floor(Math.random() * 10000);
      const available = await isPortAvailable(port);
      expect(available).toBe(true);
    });

    it('should return false for a port in use', async () => {
      // Create a server to occupy a port
      const server = createServer();
      const port = 40000 + Math.floor(Math.random() * 10000);

      await new Promise<void>((resolve) => {
        server.listen(port, '127.0.0.1', () => resolve());
      });

      try {
        const available = await isPortAvailable(port);
        expect(available).toBe(false);
      } finally {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      }
    });
  });

  describe('findAvailablePort', () => {
    it('should return the default port if available', async () => {
      const startPort = 40000 + Math.floor(Math.random() * 10000);
      const port = await findAvailablePort(startPort, 3);
      expect(port).toBe(startPort);
    });

    it('should find next available port if default is occupied', async () => {
      const startPort = 40000 + Math.floor(Math.random() * 10000);
      const server = createServer();

      // Occupy the default port
      await new Promise<void>((resolve) => {
        server.listen(startPort, '127.0.0.1', () => resolve());
      });

      try {
        const port = await findAvailablePort(startPort, 3);
        expect(port).toBeGreaterThan(startPort);
        expect(port).toBeLessThanOrEqual(startPort + 3);
      } finally {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      }
    });

    it('should throw error when all ports are occupied', async () => {
      const startPort = 40000 + Math.floor(Math.random() * 10000);
      const servers: any[] = [];

      // Occupy all ports in range
      for (let i = 0; i <= 3; i++) {
        const server = createServer();
        await new Promise<void>((resolve) => {
          server.listen(startPort + i, '127.0.0.1', () => resolve());
        });
        servers.push(server);
      }

      try {
        await expect(findAvailablePort(startPort, 3)).rejects.toThrow(
          /Could not find available port/,
        );
      } finally {
        // Clean up all servers
        await Promise.all(
          servers.map(
            (server) =>
              new Promise<void>((resolve) => {
                server.close(() => resolve());
              }),
          ),
        );
      }
    });
  });
});
