const NOISY_LOG_PATTERNS = [
  /CoreText note: Client requested name "\.PingFangUIDisplaySC-Bold"/,
];

const suppressNoise = (stream: NodeJS.WriteStream) => {
  const originalWrite = stream.write;

  stream.write = function write(
    chunk: unknown,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean {
    const text =
      typeof chunk === 'string'
        ? chunk
        : Buffer.isBuffer(chunk)
          ? chunk.toString(
              typeof encoding === 'string' ? encoding : 'utf8',
            )
          : '';

    if (text && NOISY_LOG_PATTERNS.some((pattern) => pattern.test(text))) {
      return true;
    }

    return originalWrite.call(stream, chunk as any, encoding as any, callback);
  };
};

// Attempt to silence macOS CoreText noise early so child processes inherit the configuration.
if (!process.env.OS_ACTIVITY_MODE) {
  process.env.OS_ACTIVITY_MODE = 'disable';
}

if (!process.env.CORETEXT_DEFAULT_LOGGING_LEVEL) {
  process.env.CORETEXT_DEFAULT_LOGGING_LEVEL = '0';
}

if (!process.env.CORETEXT_FRAMEWORK_LOGGING) {
  process.env.CORETEXT_FRAMEWORK_LOGGING = '0';
}

suppressNoise(process.stderr);
suppressNoise(process.stdout);
