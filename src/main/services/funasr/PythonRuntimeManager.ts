import { EventEmitter } from "events";
import { app } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
} from "fs";
import { join, dirname, delimiter, resolve } from "path";
import { createHash } from "crypto";
import tar from "tar";

const execFileAsync = promisify(execFile);

interface RuntimeManifest {
  version: string;
  python_version?: string;
  created_at?: string;
  notes?: string;
}

interface DependencyMarker {
  requirementsHash: string;
  installedAt: string;
}

export interface PythonRuntimeDetails {
  pythonPath: string;
  pipPath?: string | null;
  venvPath?: string | null;
  env: NodeJS.ProcessEnv;
  runtimeDir: string;
  logsDir: string;
  usingEmbeddedRuntime: boolean;
}

export interface EnsureRuntimeOptions {
  checkFunasr?: boolean;
  extraEnv?: Record<string, string>;
  forceReinstall?: boolean;
}

const MAX_SEARCH_DEPTH = 4;

/**
 * Python runtime bootstrapper. It prefers a bundled, pre-built runtime shipped with the
 * Electron app (resources/python-runtime/runtime-<platform>.tar.gz) and falls back to creating
 * a local virtualenv from a system interpreter when necessary. Dependencies (funasr, fastapi,
 * uvicorn, etc.) are installed from resources/python/requirements.txt or cached wheels.
 */
export class PythonRuntimeManager extends EventEmitter {
  private static instance: PythonRuntimeManager | null = null;

  private details: PythonRuntimeDetails | null = null;
  private ensurePromise: Promise<PythonRuntimeDetails> | null = null;

  static getInstance(): PythonRuntimeManager {
    if (!this.instance) {
      this.instance = new PythonRuntimeManager();
    }
    return this.instance;
  }

  private constructor() {
    super();
  }

  ensureReady(
    options: EnsureRuntimeOptions = {},
  ): Promise<PythonRuntimeDetails> {
    if (this.details && !options.forceReinstall) {
      return Promise.resolve(this.details);
    }

    if (!this.ensurePromise) {
      this.ensurePromise = this.initializeRuntime(options).catch((error) => {
        this.ensurePromise = null;
        throw error;
      });
    }

    return this.ensurePromise;
  }

  getDetails(): PythonRuntimeDetails | null {
    return this.details;
  }

  private async initializeRuntime(
    options: EnsureRuntimeOptions,
  ): Promise<PythonRuntimeDetails> {
    const override = process.env.EASYPOD_FUNASR_PYTHON;
    if (override) {
      this.emit(
        "log",
        "Using manual Python override from EASYPOD_FUNASR_PYTHON",
      );
      const logsDir = this.ensureLogsDirectory(this.getUserRuntimeRoot());
      const env = this.buildBaseEnv(dirname(override), null, options.extraEnv);
      if (options.checkFunasr) {
        await this.checkImport(override, "funasr");
      }
      const details: PythonRuntimeDetails = {
        pythonPath: override,
        env,
        runtimeDir: dirname(override),
        logsDir,
        pipPath: null,
        venvPath: null,
        usingEmbeddedRuntime: false,
      };
      this.details = details;
      this.emit("ready", details);
      return details;
    }

    try {
      const embedded = await this.prepareEmbeddedRuntime(options);
      if (embedded) {
        this.details = embedded;
        return embedded;
      }
      this.emit(
        "log",
        "⚠️  Embedded Python runtime not available; falling back to system Python.",
      );
    } catch (error) {
      this.emit(
        "log",
        `❌ Failed to prepare embedded runtime: ${String(error)}`,
      );
      if (error instanceof Error && error.stack) {
        this.emit("log", `   Stack: ${error.stack}`);
      }
    }

    const systemRuntime = await this.prepareSystemRuntime(options);
    this.details = systemRuntime;
    this.emit("ready", systemRuntime);
    return systemRuntime;
  }

  private async prepareEmbeddedRuntime(
    options: EnsureRuntimeOptions,
  ): Promise<PythonRuntimeDetails | null> {
    this.emit("log", "🔍 Checking for embedded Python runtime...");

    const runtimeRoot = this.getEmbeddedRuntimeRoot();
    if (!runtimeRoot) {
      this.emit("log", "❌ Embedded runtime directory not found");
      return null;
    }
    this.emit("log", `✓ Runtime root: ${runtimeRoot}`);

    const bundleManifestPath = join(runtimeRoot, "runtime.manifest");
    if (!existsSync(bundleManifestPath)) {
      this.emit(
        "log",
        "❌ Runtime manifest not found - runtime may not be built",
      );
      this.emit("log", `   Expected: ${bundleManifestPath}`);
      return null;
    }
    this.emit("log", `✓ Manifest found: ${bundleManifestPath}`);

    const bundleManifest = this.readManifest(bundleManifestPath);
    if (!bundleManifest) {
      this.emit("log", "Failed to read runtime manifest");
      return null;
    }

    const archivePath = this.getRuntimeArchivePath(runtimeRoot);
    if (!archivePath || !existsSync(archivePath)) {
      this.emit(
        "log",
        `❌ Runtime archive not found: ${archivePath ?? "undefined"}`,
      );
      this.emit("log", "");
      this.emit("log", "⚠️  Python runtime is not bundled with this build.");
      this.emit(
        "log",
        '   Developers: Run "npm run build:python-runtime" to create it.',
      );
      this.emit("log", "   See docs/python-runtime-build.md for details.");
      this.emit("log", "");
      return null;
    }
    this.emit("log", `✓ Archive found: ${archivePath}`);

    const userRoot = this.getUserRuntimeRoot();
    const logsDir = this.ensureLogsDirectory(userRoot);
    const installDir = join(userRoot, "runtime");
    const installedManifestPath = join(userRoot, "runtime.json");
    const installedManifest = this.readManifest(installedManifestPath);

    const needsExtraction =
      options.forceReinstall ||
      !installedManifest ||
      installedManifest.version !== bundleManifest.version;

    if (needsExtraction) {
      this.emit(
        "log",
        `📦 Extracting bundled Python runtime version ${bundleManifest.version}...`,
      );
      this.emit("log", `   Target: ${installDir}`);
      this.resetDirectory(installDir);
      try {
        await this.extractArchive(archivePath, installDir);
        this.emit("log", "✓ Extraction completed successfully");
      } catch (error) {
        this.emit("log", `❌ Extraction failed: ${String(error)}`);
        throw error;
      }
      this.writeManifest(installedManifestPath, {
        version: bundleManifest.version,
        python_version: bundleManifest.python_version,
        created_at: new Date().toISOString(),
        notes: "embedded",
      });
      this.emit("log", "✓ Manifest written");
    } else {
      this.emit(
        "log",
        `✓ Runtime already extracted (version ${installedManifest?.version})`,
      );
    }

    this.emit("log", `🔍 Searching for Python binary in ${installDir}...`);
    const pythonPath = this.findPythonBinary(installDir);
    if (!pythonPath) {
      this.emit("log", `❌ Python binary not found in ${installDir}`);
      throw new Error(
        "Embedded runtime does not contain a Python interpreter.",
      );
    }
    this.emit("log", `✓ Python found: ${pythonPath}`);

    const { venvPath, scriptsDir, pipPath } =
      this.resolvePythonPaths(pythonPath);
    const env = this.buildBaseEnv(scriptsDir, venvPath, options.extraEnv);

    if (options.checkFunasr) {
      this.emit("log", "🔍 Checking funasr import...");
      try {
        await this.checkImport(pythonPath, "funasr");
        this.emit("log", "✓ funasr import successful");
      } catch (error) {
        this.emit("log", `❌ funasr import failed: ${String(error)}`);
        throw error;
      }
    }

    this.emit("log", "✅ Embedded runtime ready");
    return {
      pythonPath,
      pipPath,
      venvPath,
      env,
      runtimeDir: venvPath ?? dirname(pythonPath),
      logsDir,
      usingEmbeddedRuntime: true,
    };
  }

  private async prepareSystemRuntime(
    options: EnsureRuntimeOptions,
  ): Promise<PythonRuntimeDetails> {
    const pythonExecutable = await this.resolveSystemPython();
    const userRoot = this.getUserRuntimeRoot();
    const logsDir = this.ensureLogsDirectory(userRoot);
    const venvPath = join(userRoot, "venv");

    let pythonPath = this.findPythonBinary(venvPath);
    let venvCreationError: unknown | null = null;
    if (!pythonPath || options.forceReinstall) {
      this.emit("log", `Creating Python virtual environment at ${venvPath}`);
      this.resetDirectory(venvPath);
      try {
        await execFileAsync(pythonExecutable, ["-m", "venv", venvPath]);
      } catch (error) {
        venvCreationError = error;
        const troubleshooting = [
          "❌ Failed to create Python virtual environment.",
          `Interpreter: ${pythonExecutable}`,
          `Target: ${venvPath}`,
          this.formatExecError(error),
          "",
          "Hints:",
          "  • Confirm python3 (3.10+) is installed and includes the venv module",
          "  • Ensure the app has write permission to the userData directory",
          "  • Or bundle a runtime archive under resources/python-runtime/",
        ].join("\n");
        this.emit("log", troubleshooting);
      }
      pythonPath = this.findPythonBinary(venvPath);
    }

    if (!pythonPath) {
      const details = venvCreationError
        ? `\n${this.formatExecError(venvCreationError)}`
        : "";
      throw new Error(
        `无法在 ${venvPath} 创建 Python 虚拟环境。请确认系统已安装可执行的 python3，并启用了 venv 模块。可选方案：设置 EASYPOD_FUNASR_PYTHON 指向已准备好的解释器，或打包内置 runtime。${details}`,
      );
    }

    const { scriptsDir, pipPath } = this.resolvePythonPaths(pythonPath);
    const env = this.buildBaseEnv(scriptsDir, venvPath, options.extraEnv);

    if (!process.env.EASYPOD_FUNASR_SKIP_INSTALL) {
      await this.installDependenciesIfNeeded(
        pythonPath,
        venvPath,
        env,
        options.forceReinstall,
      );
    }

    if (options.checkFunasr) {
      await this.checkImport(pythonPath, "funasr");
    }

    return {
      pythonPath,
      pipPath,
      venvPath,
      env,
      runtimeDir: venvPath,
      logsDir,
      usingEmbeddedRuntime: false,
    };
  }

  private getResourcesRoot(): string {
    if (app.isPackaged) {
      return process.resourcesPath;
    }
    // In development mode, use process.cwd() instead of app.getAppPath()
    // because app.getAppPath() may point to dist/main where the compiled JS is,
    // but resources/ is in the project root
    return process.cwd();
  }

  private getEmbeddedRuntimeRoot(): string | null {
    const base = this.getResourcesRoot();
    const devPath = join(base, "resources", "python-runtime");
    const prodPath = join(base, "python-runtime");

    this.emit("log", `🔍 Searching for runtime in:`);
    this.emit("log", `   Base path: ${base}`);
    this.emit(
      "log",
      `   Dev path: ${devPath} (exists: ${existsSync(devPath)})`,
    );
    this.emit(
      "log",
      `   Prod path: ${prodPath} (exists: ${existsSync(prodPath)})`,
    );
    this.emit("log", `   app.isPackaged: ${app.isPackaged}`);

    if (!app.isPackaged && existsSync(devPath)) {
      return devPath;
    }
    if (existsSync(prodPath)) {
      return prodPath;
    }
    return null;
  }

  private getPythonResourcesRoot(): string | null {
    const base = this.getResourcesRoot();
    const devPath = join(base, "resources", "python");
    const prodPath = join(base, "python");
    if (!app.isPackaged && existsSync(devPath)) {
      return devPath;
    }
    if (existsSync(prodPath)) {
      return prodPath;
    }
    return null;
  }

  private getRuntimeArchivePath(runtimeRoot: string): string | null {
    const platformKey = this.getPlatformKey();
    const candidate = join(runtimeRoot, `runtime-${platformKey}.tar.gz`);
    return candidate;
  }

  private getPlatformKey(): string {
    switch (process.platform) {
      case "darwin":
        return "macos";
      case "win32":
        return "windows";
      default:
        return "linux";
    }
  }

  private getUserRuntimeRoot(): string {
    const userData = app.getPath("userData");
    const runtimeDir = join(userData, "python");
    if (!existsSync(runtimeDir)) {
      mkdirSync(runtimeDir, { recursive: true });
    }
    return runtimeDir;
  }

  private ensureLogsDirectory(runtimeDir: string): string {
    const logsDir = join(runtimeDir, "logs");
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    return logsDir;
  }

  private readManifest(path: string): RuntimeManifest | null {
    try {
      const content = readFileSync(path, "utf-8");
      return JSON.parse(content) as RuntimeManifest;
    } catch (error) {
      this.emit("log", `Failed to read manifest ${path}: ${String(error)}`);
      return null;
    }
  }

  private writeManifest(path: string, manifest: RuntimeManifest): void {
    writeFileSync(path, JSON.stringify(manifest, null, 2), "utf-8");
  }

  private resetDirectory(path: string): void {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
    }
    mkdirSync(path, { recursive: true });
  }

  private async extractArchive(
    archivePath: string,
    destination: string,
  ): Promise<void> {
    try {
      await tar.x({ file: archivePath, cwd: destination, strip: 1 });
    } catch (error) {
      this.emit(
        "log",
        `Failed strip extraction: ${String(error)}. Retrying without strip.`,
      );
      this.resetDirectory(destination);
      await tar.x({ file: archivePath, cwd: destination });
    }
  }

  private findPythonBinary(root: string, depth = 0): string | null {
    if (!existsSync(root)) {
      this.emit(
        "log",
        `   [findPython depth=${depth}] Directory doesn't exist: ${root}`,
      );
      return null;
    }
    if (depth > MAX_SEARCH_DEPTH) {
      this.emit(
        "log",
        `   [findPython depth=${depth}] Max depth reached at: ${root}`,
      );
      return null;
    }

    this.emit("log", `   [findPython depth=${depth}] Searching in: ${root}`);
    const entries = readdirSync(root, { withFileTypes: true });
    const candidateNames =
      process.platform === "win32"
        ? ["python.exe", "python3.exe"]
        : ["python3", "python"];

    // First pass: look for Python in current directory
    // Check for both regular files and symlinks (Python binaries in venv are typically symlinks)
    for (const entry of entries) {
      if (
        (entry.isFile() || entry.isSymbolicLink()) &&
        candidateNames.includes(entry.name)
      ) {
        const foundPath = join(root, entry.name);
        this.emit(
          "log",
          `   [findPython depth=${depth}] ✓ Found: ${foundPath} (${entry.isSymbolicLink() ? "symlink" : "file"})`,
        );
        return foundPath;
      }
    }

    // Second pass: recurse into subdirectories
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const child = this.findPythonBinary(join(root, entry.name), depth + 1);
        if (child) {
          return child;
        }
      }
    }

    this.emit("log", `   [findPython depth=${depth}] Not found in: ${root}`);
    return null;
  }

  private resolvePythonPaths(pythonPath: string): {
    venvPath: string | null;
    scriptsDir: string;
    pipPath: string | null;
  } {
    const pythonDir = dirname(pythonPath);
    const parent = resolve(pythonDir, "..");
    const isScriptsDir =
      pythonDir.toLowerCase().endsWith("scripts") ||
      pythonDir.toLowerCase().endsWith("bin");
    const venvPath = isScriptsDir ? parent : null;
    const pipCandidate =
      process.platform === "win32"
        ? join(pythonDir, "pip.exe")
        : join(pythonDir, "pip");
    const pipPath = existsSync(pipCandidate) ? pipCandidate : null;

    return {
      venvPath,
      scriptsDir: pythonDir,
      pipPath,
    };
  }

  private buildBaseEnv(
    scriptsDir: string,
    venvPath: string | null,
    extraEnv?: Record<string, string>,
  ): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      ...extraEnv,
    };

    const originalPath = process.env.PATH ?? process.env.Path ?? "";
    env.PATH = scriptsDir + delimiter + originalPath;
    if (venvPath) {
      env.VIRTUAL_ENV = venvPath;
      env.PYTHONHOME = "";
    }

    return env;
  }

  private async resolveSystemPython(): Promise<string> {
    const candidates =
      process.platform === "win32"
        ? ["python.exe", "python3.exe", "py"]
        : ["python3", "python"];

    for (const candidate of candidates) {
      try {
        await execFileAsync(candidate, ["--version"]);
        if (candidate === "py") {
          return await this.resolveWindowsLauncher();
        }
        return candidate;
      } catch (error) {
        this.emit(
          "log",
          `System python candidate ${candidate} rejected: ${String(error)}`,
        );
      }
    }

    const errorMessage = [
      "❌ Unable to find a system Python interpreter.",
      "",
      "Solutions:",
      "1. Install Python 3.10+ from https://www.python.org/downloads/",
      "2. Set EASYPOD_FUNASR_PYTHON environment variable to your Python path",
      '3. For developers: Build the bundled runtime with "npm run build:python-runtime"',
      "",
      "See docs/python-runtime-build.md for detailed instructions.",
    ].join("\n");

    this.emit("log", errorMessage);
    throw new Error(
      "Python interpreter not found. See console output for solutions.",
    );
  }

  private async resolveWindowsLauncher(): Promise<string> {
    try {
      const { stdout } = await execFileAsync("py", [
        "-3",
        "-c",
        "import sys; print(sys.executable)",
      ]);
      const path = stdout.trim();
      if (path) {
        return path;
      }
    } catch (error) {
      this.emit("log", `Python launcher resolution failed: ${String(error)}`);
    }
    return "py";
  }

  private async installDependenciesIfNeeded(
    pythonPath: string,
    venvPath: string,
    env: NodeJS.ProcessEnv,
    force: boolean | undefined,
  ): Promise<void> {
    const resources = this.getPythonResourcesRoot();
    if (!resources) {
      this.emit(
        "log",
        "Python resources directory not found; skipping dependency installation.",
      );
      return;
    }

    const requirementsPath = join(resources, "requirements.txt");
    if (!existsSync(requirementsPath)) {
      this.emit(
        "log",
        "requirements.txt not found; skipping dependency installation.",
      );
      return;
    }

    const requirementsContent = readFileSync(requirementsPath, "utf-8");
    const requirementsHash = createHash("sha256")
      .update(requirementsContent)
      .digest("hex");
    const markerPath = join(venvPath, ".funasr-deps.json");
    const marker = this.readDependencyMarker(markerPath);

    if (!force && marker?.requirementsHash === requirementsHash) {
      this.emit("log", "FunASR dependencies already installed; skipping.");
      return;
    }

    const wheelsDir = join(resources, "wheels");
    const hasOfflineWheels =
      existsSync(wheelsDir) && this.directoryHasFiles(wheelsDir);

    this.emit("log", "Installing FunASR dependencies via pip");
    await execFileAsync(
      pythonPath,
      ["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
      {
        env,
        cwd: venvPath,
      },
    );

    const installArgs = ["-m", "pip", "install"];
    if (hasOfflineWheels) {
      installArgs.push("--no-index", "--find-links", wheelsDir);
    }
    installArgs.push("-r", requirementsPath);

    try {
      await execFileAsync(pythonPath, installArgs, {
        env,
        cwd: venvPath,
      });
    } catch (error) {
      const troubleshootingMessage = [
        "❌ Failed to install FunASR dependencies.",
        "",
        hasOfflineWheels
          ? "Offline wheels were found but installation failed. Possible causes:"
          : "No offline wheels found. Installation requires internet connection.",
        hasOfflineWheels
          ? "  - Wheels may be incomplete or corrupted"
          : "  - Network connectivity issues",
        hasOfflineWheels
          ? "  - Platform mismatch (e.g., ARM wheels on x86)"
          : "  - Firewall or proxy blocking PyPI",
        "",
        "Solutions:",
        "1. Check network connectivity (if downloading from PyPI)",
        "2. Use offline wheels: Download packages to resources/python/wheels/",
        "3. Set EASYPOD_FUNASR_SKIP_INSTALL=1 to skip automatic installation",
        '4. For developers: Rebuild bundled runtime with "npm run build:python-runtime"',
        "",
        this.formatExecError(error),
      ].join("\n");

      this.emit("log", troubleshootingMessage);
      throw new Error(
        "FunASR dependency installation failed. See console output for details.",
      );
    }

    const newMarker: DependencyMarker = {
      requirementsHash,
      installedAt: new Date().toISOString(),
    };
    writeFileSync(markerPath, JSON.stringify(newMarker, null, 2), "utf-8");
  }

  private readDependencyMarker(path: string): DependencyMarker | null {
    if (!existsSync(path)) {
      return null;
    }
    try {
      const content = readFileSync(path, "utf-8");
      return JSON.parse(content) as DependencyMarker;
    } catch (error) {
      this.emit("log", `Failed to read dependency marker: ${String(error)}`);
      return null;
    }
  }

  private directoryHasFiles(path: string): boolean {
    try {
      const entries = readdirSync(path);
      return entries.some((entry) => {
        const full = join(path, entry);
        try {
          return statSync(full).isFile();
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  private async checkImport(
    pythonPath: string,
    moduleName: string,
  ): Promise<void> {
    try {
      await execFileAsync(pythonPath, ["-c", `import ${moduleName}`]);
    } catch (error) {
      throw new Error(
        `Python module "${moduleName}" is unavailable in the configured interpreter.`,
      );
    }
  }

  private formatExecError(error: unknown): string {
    if (!error || typeof error !== "object") {
      return String(error);
    }

    const err = error as NodeJS.ErrnoException & {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    const segments: string[] = [];
    if (err.message) {
      segments.push(err.message);
    }
    if (err.code) {
      segments.push(`code: ${err.code}`);
    }
    if (err.stderr) {
      const trimmed = err.stderr.toString().trim();
      if (trimmed) {
        segments.push(trimmed);
      }
    }
    if (err.stdout) {
      const trimmed = err.stdout.toString().trim();
      if (trimmed) {
        segments.push(trimmed);
      }
    }
    return segments.join("\n");
  }
}

export const getPythonRuntimeManager = (): PythonRuntimeManager => {
  return PythonRuntimeManager.getInstance();
};
