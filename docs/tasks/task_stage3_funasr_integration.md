# 任务：FunASR服务集成

## 任务信息
- **阶段**: 3 - FunASR转写集成
- **估时**: 24小时
- **优先级**: 高
- **依赖**: task_stage1_sqlite_database

## 任务目标
集成FunASR本地转写服务，实现Python环境管理、模型下载配置和转写任务处理。

## 具体任务
1. **Python环境和依赖管理**
   - 内置Python虚拟环境设置
   - FunASR和依赖包自动安装
   - 环境隔离和版本控制
   - 跨平台兼容性处理

2. **FunASR模型下载和配置**
   - 支持多种模型规格(轻量/标准/增强)
   - 模型文件管理和缓存
   - 模型加载和内存优化
   - 设备选择(CPU/GPU/MPS)

3. **HTTP/gRPC服务接口设计**
   - 本地服务端点设计
   - 转写任务API接口
   - 说话人分离接口
   - 服务健康检查和状态监控

4. **任务队列和进度跟踪**
   - 异步任务队列系统
   - 实时进度回调机制
   - 并发任务控制
   - 错误处理和重试逻辑

## 验收标准
- [ ] Python环境自动配置成功率100%
- [ ] FunASR模型下载和加载正常
- [ ] 转写服务API响应正确
- [ ] 60分钟音频转写≤40分钟 (M1 Mac)
- [ ] 支持中英文混合语音识别
- [ ] 说话人分离功能可用

## Python环境管理

### 虚拟环境设置
```typescript
// src/main/services/PythonManager.ts
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

interface PythonEnvironment {
  pythonPath: string;
  pipPath: string;
  venvPath: string;
  isReady: boolean;
}

class PythonManager {
  private environment: PythonEnvironment | null = null;
  private readonly venvPath: string;

  constructor() {
    this.venvPath = path.join(process.resourcesPath, 'python-env');
  }

  async setupEnvironment(): Promise<PythonEnvironment> {
    const venvPath = this.venvPath;
    const pythonPath = path.join(venvPath, 'bin', 'python');
    const pipPath = path.join(venvPath, 'bin', 'pip');

    // 检查虚拟环境是否已存在
    if (await this.checkEnvironmentExists(venvPath)) {
      this.environment = {
        pythonPath,
        pipPath,
        venvPath,
        isReady: true,
      };
      return this.environment;
    }

    // 创建新的虚拟环境
    await this.createVirtualEnvironment(venvPath);

    // 安装基础依赖
    await this.installBaseDependencies(pipPath);

    // 安装FunASR依赖
    await this.installFunASRDependencies(pipPath);

    this.environment = {
      pythonPath,
      pipPath,
      venvPath,
      isReady: true,
    };

    return this.environment;
  }

  private async createVirtualEnvironment(venvPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('python3', ['-m', 'venv', venvPath]);

      process.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to create virtual environment: exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async installFunASRDependencies(pipPath: string): Promise<void> {
    const dependencies = [
      'funasr[framework-onnx]==1.0.23',
      'modelscope==1.11.0',
      'fastapi==0.104.1',
      'uvicorn==0.24.0',
      'websockets==12.0',
      'numpy==1.24.3',
      'soundfile==0.12.1',
    ];

    for (const dep of dependencies) {
      await this.installPackage(pipPath, dep);
    }
  }

  private async installPackage(pipPath: string, packageName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(pipPath, ['install', packageName], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('exit', (code) => {
        if (code === 0) {
          console.log(`Successfully installed ${packageName}`);
          resolve();
        } else {
          console.error(`Failed to install ${packageName}: ${stderr}`);
          reject(new Error(`Installation failed: ${stderr}`));
        }
      });

      process.on('error', reject);
    });
  }

  async checkEnvironmentExists(venvPath: string): Promise<boolean> {
    try {
      const pythonPath = path.join(venvPath, 'bin', 'python');
      await fs.access(pythonPath);
      return true;
    } catch {
      return false;
    }
  }
}
```

## FunASR模型管理

### 模型下载和缓存
```typescript
// src/main/services/ModelManager.ts
interface ModelConfig {
  name: string;
  modelId: string;
  size: 'small' | 'base' | 'large';
  languages: string[];
  capabilities: ('asr' | 'vad' | 'diarization')[];
  downloadUrl?: string;
  localPath?: string;
}

const AVAILABLE_MODELS: ModelConfig[] = [
  {
    name: 'SenseVoice Small',
    modelId: 'sensevoice-small',
    size: 'small',
    languages: ['zh', 'en'],
    capabilities: ['asr'],
  },
  {
    name: 'Paraformer Large',
    modelId: 'paraformer-large',
    size: 'large',
    languages: ['zh', 'en'],
    capabilities: ['asr'],
  },
  {
    name: 'CAM++ VAD',
    modelId: 'campplus-vad',
    size: 'small',
    languages: ['zh', 'en'],
    capabilities: ['vad'],
  },
  {
    name: 'Speaker Diarization',
    modelId: 'campplus-diarization',
    size: 'base',
    languages: ['zh', 'en'],
    capabilities: ['diarization'],
  },
];

class ModelManager {
  private modelsPath: string;
  private downloadProgress = new Map<string, number>();

  constructor() {
    this.modelsPath = path.join(process.resourcesPath, 'models');
  }

  async ensureModelsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.modelsPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create models directory:', error);
      throw error;
    }
  }

  async downloadModel(
    modelId: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const model = AVAILABLE_MODELS.find(m => m.modelId === modelId);
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const modelPath = path.join(this.modelsPath, modelId);

    // 检查模型是否已存在
    if (await this.checkModelExists(modelPath)) {
      return modelPath;
    }

    // 使用modelscope下载模型
    return this.downloadModelFromModelScope(model, onProgress);
  }

  private async downloadModelFromModelScope(
    model: ModelConfig,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const pythonManager = new PythonManager();
    const env = await pythonManager.setupEnvironment();

    const downloadScript = `
import os
from modelscope import snapshot_download
import sys

model_id = '${model.modelId}'
cache_dir = '${this.modelsPath}'

try:
    model_path = snapshot_download(
        model_id,
        cache_dir=cache_dir,
        revision='master'
    )
    print(f"SUCCESS:{model_path}")
except Exception as e:
    print(f"ERROR:{str(e)}")
    sys.exit(1)
`;

    return new Promise((resolve, reject) => {
      const process = spawn(env.pythonPath, ['-c', downloadScript], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;

        // 解析进度信息
        const progressMatch = output.match(/(\d+)%/);
        if (progressMatch && onProgress) {
          const progress = parseInt(progressMatch[1]);
          this.downloadProgress.set(model.modelId, progress);
          onProgress(progress);
        }
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('exit', (code) => {
        if (code === 0 && stdout.includes('SUCCESS:')) {
          const modelPath = stdout.split('SUCCESS:')[1].trim();
          resolve(modelPath);
        } else {
          reject(new Error(`Model download failed: ${stderr || stdout}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async checkModelExists(modelPath: string): Promise<boolean> {
    try {
      await fs.access(modelPath);
      return true;
    } catch {
      return false;
    }
  }

  getAvailableModels(): ModelConfig[] {
    return [...AVAILABLE_MODELS];
  }

  getDownloadProgress(modelId: string): number {
    return this.downloadProgress.get(modelId) ?? 0;
  }
}
```

## FunASR服务接口

### HTTP服务器实现
```python
# resources/python/funasr_server.py
import asyncio
import json
import logging
import os
import sys
from typing import Dict, List, Optional
import uuid

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from funasr import AutoModel
import soundfile as sf
import numpy as np

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="FunASR Service", version="1.0.0")

# 允许跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局模型实例
models: Dict[str, AutoModel] = {}
active_tasks: Dict[str, dict] = {}

class TranscriptionRequest:
    def __init__(self, task_id: str, audio_path: str, options: dict):
        self.task_id = task_id
        self.audio_path = audio_path
        self.options = options
        self.status = "queued"
        self.progress = 0.0
        self.result = None
        self.error = None

class FunASRService:
    def __init__(self):
        self.model_asr = None
        self.model_vad = None
        self.model_diarization = None

    async def initialize_models(self, model_config: dict):
        """初始化ASR模型"""
        try:
            # 加载ASR模型
            if 'asr_model' in model_config:
                logger.info(f"Loading ASR model: {model_config['asr_model']}")
                self.model_asr = AutoModel(
                    model=model_config['asr_model'],
                    device='cpu',  # 可配置为'cuda'或'mps'
                    disable_update=True,
                    disable_log=False
                )

            # 加载VAD模型
            if 'vad_model' in model_config:
                logger.info(f"Loading VAD model: {model_config['vad_model']}")
                self.model_vad = AutoModel(
                    model=model_config['vad_model'],
                    device='cpu'
                )

            # 加载说话人分离模型
            if 'diarization_model' in model_config:
                logger.info(f"Loading diarization model: {model_config['diarization_model']}")
                self.model_diarization = AutoModel(
                    model=model_config['diarization_model'],
                    device='cpu'
                )

            logger.info("All models loaded successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize models: {str(e)}")
            return False

    async def transcribe_audio(
        self,
        audio_path: str,
        enable_diarization: bool = True,
        chunk_size: int = 30000,  # 30秒分块
        progress_callback=None
    ) -> dict:
        """转写音频文件"""
        try:
            # 读取音频文件
            audio_data, sample_rate = sf.read(audio_path)

            # 如果是立体声，转为单声道
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)

            # 分块处理长音频
            chunks = self._split_audio(audio_data, sample_rate, chunk_size)

            results = []
            total_chunks = len(chunks)

            for i, (start_time, end_time, chunk_data) in enumerate(chunks):
                if progress_callback:
                    progress = (i + 1) / total_chunks * 100
                    await progress_callback(progress)

                # VAD检测
                if self.model_vad:
                    vad_result = self.model_vad.generate(
                        input=chunk_data,
                        cache={}
                    )
                    # 过滤掉静音片段
                    if not self._has_speech(vad_result):
                        continue

                # ASR转写
                asr_result = self.model_asr.generate(
                    input=chunk_data,
                    cache={},
                    language="auto",  # 自动检测语言
                    use_itn=True     # 启用逆文本标准化
                )

                # 说话人分离
                speakers = []
                if enable_diarization and self.model_diarization:
                    diarization_result = self.model_diarization.generate(
                        input=chunk_data,
                        cache={}
                    )
                    speakers = self._parse_diarization_result(diarization_result)

                # 整理结果
                chunk_result = {
                    'start_time': start_time,
                    'end_time': end_time,
                    'text': asr_result[0]['text'] if asr_result else '',
                    'speakers': speakers,
                    'confidence': asr_result[0].get('confidence', 0.0) if asr_result else 0.0
                }

                results.append(chunk_result)

            # 合并结果并生成最终输出
            final_result = self._merge_transcription_results(results)

            return {
                'status': 'success',
                'segments': final_result,
                'summary': {
                    'total_duration': len(audio_data) / sample_rate,
                    'total_segments': len(final_result),
                    'languages_detected': self._detect_languages(final_result),
                    'speakers_count': len(set(s.get('speaker', 'unknown') for s in final_result))
                }
            }

        except Exception as e:
            logger.error(f"Transcription failed: {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }

    def _split_audio(self, audio_data: np.ndarray, sample_rate: int, chunk_size_ms: int) -> List[tuple]:
        """将音频分割成小块"""
        chunk_size_samples = int(chunk_size_ms * sample_rate / 1000)
        chunks = []

        for i in range(0, len(audio_data), chunk_size_samples):
            start_time = i / sample_rate
            end_time = min((i + chunk_size_samples) / sample_rate, len(audio_data) / sample_rate)
            chunk_data = audio_data[i:i + chunk_size_samples]
            chunks.append((start_time, end_time, chunk_data))

        return chunks

    def _has_speech(self, vad_result) -> bool:
        """检查VAD结果是否包含语音"""
        # 根据FunASR VAD结果格式解析
        if not vad_result or not vad_result[0]:
            return False

        segments = vad_result[0].get('value', [])
        return len(segments) > 0 and any(seg.get('conf', 0) > 0.5 for seg in segments)

    def _parse_diarization_result(self, diarization_result) -> List[dict]:
        """解析说话人分离结果"""
        speakers = []
        if diarization_result and diarization_result[0]:
            # 解析FunASR说话人分离结果格式
            spk_info = diarization_result[0].get('spk_embedding', [])
            for i, spk in enumerate(spk_info):
                speakers.append({
                    'speaker_id': f"S{i}",
                    'confidence': spk.get('conf', 0.0),
                    'start': spk.get('start', 0.0),
                    'end': spk.get('end', 0.0)
                })
        return speakers

    def _merge_transcription_results(self, results: List[dict]) -> List[dict]:
        """合并分块转写结果"""
        merged = []
        for chunk in results:
            if chunk['text'].strip():
                # 分割句子并添加时间戳
                sentences = self._split_sentences(chunk['text'])
                chunk_duration = chunk['end_time'] - chunk['start_time']

                for i, sentence in enumerate(sentences):
                    sentence_start = chunk['start_time'] + (i / len(sentences)) * chunk_duration
                    sentence_end = chunk['start_time'] + ((i + 1) / len(sentences)) * chunk_duration

                    merged.append({
                        'start': sentence_start,
                        'end': sentence_end,
                        'text': sentence.strip(),
                        'speaker': self._assign_speaker(chunk['speakers'], sentence_start),
                        'confidence': chunk['confidence']
                    })

        return merged

    def _split_sentences(self, text: str) -> List[str]:
        """简单的句子分割"""
        import re
        sentences = re.split(r'[。！？；.!?;]', text)
        return [s.strip() for s in sentences if s.strip()]

    def _assign_speaker(self, speakers: List[dict], timestamp: float) -> str:
        """为时间戳分配说话人"""
        for speaker in speakers:
            if speaker['start'] <= timestamp <= speaker['end']:
                return speaker['speaker_id']
        return 'S0'  # 默认说话人

    def _detect_languages(self, segments: List[dict]) -> List[str]:
        """检测转写结果中的语言"""
        # 简化的语言检测逻辑
        languages = set()
        for segment in segments:
            text = segment['text']
            if any('\u4e00' <= char <= '\u9fff' for char in text):
                languages.add('zh')
            if any(char.isalpha() for char in text):
                languages.add('en')
        return list(languages)

# 全局服务实例
funasr_service = FunASRService()

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "models_loaded": {
            "asr": funasr_service.model_asr is not None,
            "vad": funasr_service.model_vad is not None,
            "diarization": funasr_service.model_diarization is not None
        }
    }

@app.post("/initialize")
async def initialize_models(model_config: dict):
    """初始化模型"""
    success = await funasr_service.initialize_models(model_config)
    if success:
        return {"status": "success", "message": "Models initialized"}
    else:
        raise HTTPException(status_code=500, detail="Failed to initialize models")

@app.post("/transcribe")
async def transcribe_audio(request: dict):
    """转写音频"""
    task_id = str(uuid.uuid4())
    audio_path = request.get('audio_path')
    options = request.get('options', {})

    if not audio_path or not os.path.exists(audio_path):
        raise HTTPException(status_code=400, detail="Invalid audio path")

    # 添加到活跃任务
    active_tasks[task_id] = {
        'status': 'processing',
        'progress': 0,
        'audio_path': audio_path,
        'options': options
    }

    try:
        result = await funasr_service.transcribe_audio(
            audio_path=audio_path,
            enable_diarization=options.get('enable_diarization', True),
            chunk_size=options.get('chunk_size', 30000),
            progress_callback=lambda p: _update_task_progress(task_id, p)
        )

        active_tasks[task_id]['status'] = 'completed'
        active_tasks[task_id]['result'] = result

        return {
            "task_id": task_id,
            "status": "completed",
            "result": result
        }

    except Exception as e:
        active_tasks[task_id]['status'] = 'failed'
        active_tasks[task_id]['error'] = str(e)
        raise HTTPException(status_code=500, detail=str(e))

async def _update_task_progress(task_id: str, progress: float):
    """更新任务进度"""
    if task_id in active_tasks:
        active_tasks[task_id]['progress'] = progress

@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """获取任务状态"""
    if task_id not in active_tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    return active_tasks[task_id]

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8899)
    parser.add_argument("--log-level", default="info")

    args = parser.parse_args()

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level=args.log_level,
        access_log=False
    )
```

## TypeScript服务接口

### FunASR客户端
```typescript
// src/main/services/FunASRClient.ts
interface TranscriptionOptions {
  enableDiarization?: boolean;
  chunkSize?: number;
  language?: 'auto' | 'zh' | 'en';
  outputFormats?: ('srt' | 'vtt' | 'json')[];
}

interface TranscriptionResult {
  taskId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  segments?: TranscriptionSegment[];
  error?: string;
}

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker: string;
  confidence: number;
}

class FunASRClient {
  private baseUrl: string;
  private serverProcess: ChildProcess | null = null;

  constructor(port: number = 8899) {
    this.baseUrl = `http://127.0.0.1:${port}`;
  }

  async startServer(): Promise<void> {
    const pythonManager = new PythonManager();
    const env = await pythonManager.setupEnvironment();

    const serverScript = path.join(__dirname, '../../../resources/python/funasr_server.py');

    this.serverProcess = spawn(env.pythonPath, [serverScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // 等待服务器启动
    await this.waitForServer(30000); // 30秒超时
  }

  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
    }
  }

  private async waitForServer(timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`${this.baseUrl}/health`);
        if (response.ok) {
          return;
        }
      } catch {
        // 服务器尚未启动，继续等待
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('FunASR server startup timeout');
  }

  async initializeModels(modelConfig: {
    asr_model: string;
    vad_model?: string;
    diarization_model?: string;
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelConfig),
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize models: ${response.statusText}`);
    }
  }

  async transcribeAudio(
    audioPath: string,
    options: TranscriptionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionResult> {
    const response = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_path: audioPath,
        options: {
          enable_diarization: options.enableDiarization ?? true,
          chunk_size: options.chunkSize ?? 30000,
          language: options.language ?? 'auto',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const result = await response.json();

    // 如果任务在处理中，轮询状态
    if (result.status === 'processing') {
      return this.pollTaskStatus(result.task_id, onProgress);
    }

    return result;
  }

  private async pollTaskStatus(
    taskId: string,
    onProgress?: (progress: number) => void
  ): Promise<TranscriptionResult> {
    while (true) {
      const response = await fetch(`${this.baseUrl}/task/${taskId}`);

      if (!response.ok) {
        throw new Error(`Failed to get task status: ${response.statusText}`);
      }

      const status = await response.json();

      if (onProgress && typeof status.progress === 'number') {
        onProgress(status.progress);
      }

      if (status.status === 'completed' || status.status === 'failed') {
        return {
          taskId,
          status: status.status,
          progress: status.progress,
          segments: status.result?.segments,
          error: status.error,
        };
      }

      // 等待1秒后再次检查
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

## 相关文件
- `src/main/services/PythonManager.ts` - Python环境管理
- `src/main/services/ModelManager.ts` - 模型下载管理
- `src/main/services/FunASRClient.ts` - 转写服务客户端
- `resources/python/funasr_server.py` - Python转写服务
- `src/main/types/transcription.ts` - 转写相关类型定义

## 后续任务依赖
- task_stage3_audio_preprocessing
- task_stage3_transcript_subtitle_sync