# FunASR 集成技术设计（阶段 3）

## 1. 背景与目标
- **背景**：Easypod 需要在本地完成语音转写，FunASR 提供了较优的中英文混合识别与说话人分离能力。现有项目以 Electron + React (TypeScript) 为主，需要安全、跨平台地托管 Python 服务。
- **目标**：在不要求终端用户处理 Python 安装的前提下，自动化部署 FunASR 运行时、模型与服务接口，提供可靠的转写体验。
- **成功标准**：满足任务文档中的性能与功能验收指标，提供可观测、可测试、易维护的集成方案。

## 2. 范围与非目标
- **包含**：
  - Python 运行时的分发、安装、健康管理。
  - FunASR 模型的下载、缓存、版本协调与设备选择。
  - 本地 HTTP 服务（FastAPI）及 TypeScript 客户端封装。
  - 异步任务队列、进度回调、失败重试设计。
  - Electron 主进程与渲染进程之间的 IPC 约定。
- **不包含**：
  - UI 细节实现（单独在 Stage 3 其他任务完成）。
  - 云端部署或远程服务能力。
  - 与字幕同步、音频预处理的具体逻辑（另有任务）。

## 3. 端到端架构概览
```
┌────────────────────────────────────────────────────────┐
│ Electron 主进程 (TypeScript)                          │
│  - PythonRuntimeManager                                │
│  - FunASRServiceClient                                 │
│  - TaskQueue / ProgressEmitter                         │
│  - ModelRegistry / DownloadManager                     │
└───────────────┬───────────────────────────────┬────────┘
                │ IPC (electron.ipcMain)        │
┌───────────────▼───────────────────────────────▼────────┐
│ 渲染进程 (React + Zustand)                              │
│  - Transcription store                                  │
│  - UI: 模型选择 / 队列管理 / 进度显示                    │
└────────────────────────────────────────────────────────┘
                │ HTTP (FastAPI REST/WebSocket)          
┌───────────────▼────────────────────────────────────────┐
│ Python Runtime (打包 / 首次启动自动解压)               │
│  - FunASR 服务 (fastapi + uvicorn)                     │
│  - 模型缓存目录                                        │
│  - 任务执行器 (线程池/asyncio)                         │
└────────────────────────────────────────────────────────┘
```

- **运行时属性**：
  - 第一次运行时，由主进程自动解压预置的 Python 发行版（详见 §4），再安装 wheel 依赖与模型。
  - 主进程负责 FunASR 服务生命周期管理：启动、健康检查、异常重启。
  - 服务端使用 FastAPI，提供 `/initialize`、`/transcribe`、`/task/:id` 等端点，并支持 WebSocket 推送实时进度（备选方案）。
  - 任务队列支持并发控制、重试与超时时间配置，防止 UI 卡死。

## 4. Python 运行时策略
### 4.1 发行版分发
- **策略**：各平台预置 Python 最小发行版（Mac: 3.10 universal2，Windows: embeddable，Linux: manylinux），随应用包一起分发至 `resources/python-runtime/<platform>`。
- **首次启动**：
  1. `PythonRuntimeManager` 检查 `app.getPath('userData')/python/runtime.json`。
  2. 若不存在，解压对应平台压缩包至 `app.getPath('userData')/python/`，同时写入版本号。
  3. 利用 `venv` 创建隔离环境 `.../venv`，并记录 `pythonPath`、`pipPath`。
- **升级与回滚**：当应用版本升级时，校验 `runtime.json` 中版本号，与包内 `runtime.manifest` 比较，若不一致触发重新解压和依赖安装。
- **权限与清理**：仅主进程读写；提供 `reset` 指令以在诊断时清空（通过隐藏调试菜单）。

### 4.2 依赖安装自动化
- 包含 FunASR、ModelScope、ONNX Runtime、FastAPI、Uvicorn 等；在资源包中内置 `requirements.lock`。
- 安装流程：
  1. 运行 `pip install --no-index --find-links <resources/python-wheels>` 优先使用离线 wheel。
  2. 若 wheel 缺失且联网环境允许，再回落到在线源（需要用户授权，默认不使用网络）。
  3. 安装结果写入日志，失败时重试一次并提示用户收集日志反馈。

### 4.3 健康检查
- 每次 Electron 启动：
  - 检查虚拟环境完整性（`python -c "import funasr"`）。
  - 若失败则重新安装依赖或通知用户重置。
- 运行时通过 `/health` 端点返回 Python 版本、FunASR 版本、剩余磁盘空间等信息。

## 5. FunASR 服务设计
### 5.1 FastAPI 应用结构
```
resources/python/funasr_server.py
├─ startup: 解析 CLI 参数（模型目录、端口、日志级别）
├─ initialize_models(): 加载 ASR / VAD / Diarization 模型
├─ POST /initialize: 按需加载、更换模型
├─ POST /transcribe: 提交任务，返回 task_id
├─ GET /task/{task_id}: 返回任务状态与结果
├─ GET /health: 运行状态
└─ WebSocket /progress (可选): 推送实时进度
```

- 任务队列基于 `asyncio.Queue` 或 `Celery`-less 自研轻量执行器：
  - 控制最大并发（默认 1，可配置 2）。
  - 使用 `ThreadPoolExecutor` 调用 FunASR 推理以避免 GIL 阻塞。
- 说话人分离：若模型支持，调用 FunASR 的 diarization pipeline，结果写入 `segments[*].speaker`。
- 资源控制：
  - 通过 CLI 参数 `--device cpu|cuda|mps`，默认自动检测 GPU/MPS。
  - “轻量/标准/增强”决定模型 ID 与 chunk 参数。

### 5.2 模型管理
- **模型目录**：`<userData>/python/models/<modelId>`。
- **ModelRegistry (TS)**：
  - 维护内置表（见任务文档示例），记录模型大小、语言、依赖组件。
  - 暴露 `listModels()` 给渲染层用于 UI。
- **下载策略**：
  - 首选内置模型（预置小模型），其余按需下载。
  - 下载器支持断点续传与校验 SHA256；下载任务纳入统一进度总线。
  - 模型文件较大时采用单独线程下载，避免阻塞主进程。
- **缓存策略**：
  - 使用 `manifest.json` 存储版本与更新时间，供 `initialize` 时校验文件完整性。
  - 提供模型清理 API，释放磁盘空间。

## 6. Electron 主进程集成
### 6.1 新增核心模块
- `src/main/services/PythonRuntimeManager.ts`
  - 封装运行时准备、依赖安装、健康检查；暴露 `ensureReady()`。
- `src/main/services/FunASRServiceClient.ts`
  - 管理 FunASR 进程生命周期（spawn uvicorn）、等待 `/health`。
  - 提供 `initializeModels()`, `submitTranscription()`, `checkTask()`。
- `src/main/services/ModelRegistry.ts`
  - 维护模型元数据与下载路径。
- `src/main/services/TranscriptionTaskQueue.ts`
  - 处理任务排队、重试策略、事件派发。

### 6.2 进程通信
- 主进程通过 `ipcMain.handle('funasr/submit', ...)` 等定义接口。
- 渲染进程调用 `window.api.funasr.submit(payload)`。
- 进度反馈：
  - 主进程订阅 FunASR `/task` 轮询或 WebSocket 推送，将进度通过 `ipcMain` 广播 `funasr:progress`。
  - Zustand store 接收进度并更新 UI。

### 6.3 错误恢复
- FunASR 进程异常退出：
  1. 日志写入 `funasr.log`。
  2. 自动重启（最多 3 次），并通过 UI 提示用户。
  3. 若连续失败，要求用户在设置页执行“重置 Python 环境”。
- 任务失败：按照错误类型（模型缺失、音频格式错误、资源不足）做分类提示。

## 7. 任务队列与状态机
- **状态定义**：`idle → downloading_model → ready → processing → success|failed`。
- **队列实现**：
  - 使用 `p-queue`（已有依赖）或自建基于 `EventEmitter` 的序列执行。
  - 支持最大并发、优先级（后续扩展）。
  - 每个任务记录：音频路径、选定模型、参数（语言、分段大小、说话人分离开关）。
- **进度来源**：
  - 下载阶段：由 ModelManager 报告下载百分比。
  - 推理阶段：FunASR 返回 `progress` 字段（0–1），若无则根据 chunk 数估算。
- **重试策略**：默认失败后重试一次（配置化），并记录错误码。

## 8. API 约定
### 8.1 FunASR HTTP 接口
- `POST /initialize`
  ```json
  {
    "asr_model": "sensevoice-small",
    "device": "auto",
    "options": { "vad_model": "fsmn-vad", "diarization_model": "cam++" }
  }
  ```
  - 返回 `{ "status": "ready", "loaded_models": [...] }`。

- `POST /transcribe`
  ```json
  {
    "audio_path": "/abs/path/audio.wav",
    "options": {
      "language": "auto",
      "chunk_size": 30000,
      "enable_diarization": true
    }
  }
  ```
  - 返回 `{ "task_id": "uuid", "status": "processing" }`。

- `GET /task/{task_id}`
  ```json
  {
    "status": "completed",
    "progress": 1,
    "segments": [{
      "start_ms": 1200,
      "end_ms": 5400,
      "text": "你好 world",
      "speaker": "S1"
    }],
    "metadata": {
      "audio_duration_ms": 60000,
      "model": "sensevoice-small",
      "processing_time_ms": 32000
    }
  }
  ```

- `GET /health`
  - 返回 FunASR 版本、Python 版本、内存占用、已加载模型。

### 8.2 IPC 接口示例
- `funasr/runtime/status` → 返回环境准备状态。
- `funasr/model/list` → 返回可选模型及缓存情况。
- `funasr/model/download` → 触发下载并异步广播进度。
- `funasr/transcribe` → 提交任务，返回 taskId。
- `funasr/task/subscribe` → 渲染端订阅进度事件。

## 9. 日志与可观测性
- Python 与 TypeScript 均使用结构化日志（JSON lines）。
- 主进程写入 `appData/logs/funasr-main.log`，FunASR 写入 `funasr-server.log`。
- 日志内容包括：任务 ID、阶段、耗时、异常栈。
- 提供日志收集入口（设置面板“导出调试包”）。

## 10. 性能与资源考量
- 默认加载轻量模型，减少内存占用（< 2GB）。
- 音频分片：默认 30 秒；长音频时采用 Sliding Window + VAD。
- 并发控制：单任务串行执行，待验证性能后再开放多任务。
- M1/M2 Mac：优先使用 `mps`，fallback 至 `cpu`。
- 资源监控：若系统内存低于阈值，推迟新任务并提示用户。

## 11. 安全与隔离
- Python 运行时位于用户目录，不需要管理员权限。
- 服务仅监听本地环回地址 (127.0.0.1)。
- 与渲染进程交互经由 IPC，渲染层无法直接运行任意命令。
- 所有文件路径经过白名单校验（仅允许用户库或工作区），防止路径穿越。

## 12. 测试策略
- **单元测试**：
  - TypeScript：对 `PythonRuntimeManager`、`FunASRServiceClient`、`TaskQueue` 编写 Jest 测试，使用 `tmp` 目录模拟文件系统。
  - Python：使用 `pytest` 针对 API Handler、模型加载 mock 编写测试。
- **集成测试**：
  - 在 CI 中启用精简模式（使用 Dummy 模型），验证端到端流程。
  - 录制一段 5 分钟音频，比较转写耗时与准确度。
- **回归测试**：
  - 对说话人分离、中文/英文/混合样本建立基准数据。

## 13. 发布与回滚
- 构建脚本在 `npm run build` 流程中将 Python 发行版与 wheels 打包进 `resources`。
- 安装包中包含 `runtime.manifest`，用于运行时版本校验。
- 回滚策略：应用回退版本时，主进程检测 manifest 改变，允许继续使用旧 runtime；若不兼容则触发重新解压。

## 14. 风险与缓解措施
- **模型体积大 → 下载耗时**：支持断点续传、用户提示所需空间。
- **GPU 兼容性**：默认 CPU，检测 GPU 失败时写日志并回落。
- **离线环境**：提供最低限度小模型与依赖离线包；网络失败时提示用户离线模式限制。
- **跨平台差异**：单独测试 macOS、Windows、Linux；使用 CI 构建验证运行时可解压。
- **日志敏感信息**：转写结果可能包含隐私，默认日志不记录全文，仅记录摘要或哈希。

## 15. 后续工作与开放问题
- UI 上的模型管理与磁盘空间提示（渲染层任务）。
- 与音频预处理及字幕同步任务对接 API。
- 是否需要 gRPC 以提升性能？当前保留 HTTP 足够（1 req/s 以内）。
- 模型更新策略：是否提供在线更新提醒？需要产品确认。

