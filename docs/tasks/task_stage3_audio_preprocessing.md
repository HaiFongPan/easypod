# 任务：音频预处理

## 任务信息
- **阶段**: 3 - FunASR转写集成
- **估时**: 12小时
- **优先级**: 高
- **依赖**: task_stage3_funasr_integration

## 任务目标
实现音频文件的预处理功能，包括格式转换、采样率统一、分段处理和元数据提取。

## 具体任务
1. **FFmpeg集成和音频格式转换**
   - 集成FFmpeg二进制文件
   - 支持多种输入格式(MP3, AAC, OGG, M4A等)
   - 统一输出格式和参数
   - 处理流媒体和本地文件

2. **音频分段和采样率统一**
   - 自动检测音频格式和参数
   - 采样率转换(目标16kHz/44.1kHz)
   - 声道转换(立体声→单声道)
   - 音频质量优化处理

3. **元数据提取和处理**
   - 提取音频时长、比特率等信息
   - 读取ID3标签中的章节信息
   - 处理嵌入的封面图片
   - 音频完整性验证

4. **分段策略和缓存管理**
   - 长音频智能分段算法
   - 按静音检测分割
   - 临时文件管理和清理
   - 并行处理优化

## 验收标准
- [ ] 支持主流音频格式转换
- [ ] 音频预处理时间≤原时长的10%
- [ ] 转换后音频质量无明显损失
- [ ] 长音频(>2小时)分段处理正常
- [ ] 临时文件自动清理
- [ ] 元数据提取准确率≥95%

## FFmpeg集成

### FFmpeg管理器
```typescript
// src/main/services/FFmpegManager.ts
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

interface AudioInfo {
  duration: number;
  sampleRate: number;
  channels: number;
  bitRate: number;
  format: string;
  size: number;
}

interface ConversionOptions {
  outputFormat: 'wav' | 'mp3' | 'flac';
  sampleRate: number;
  channels: 1 | 2;
  bitRate?: number;
  normalize?: boolean;
  removeNoise?: boolean;
}

class FFmpegManager {
  private ffmpegPath: string;
  private ffprobePath: string;

  constructor() {
    const platform = os.platform();
    const arch = os.arch();

    // 根据平台选择FFmpeg二进制文件
    const binDir = path.join(process.resourcesPath, 'bin', platform, arch);
    this.ffmpegPath = path.join(binDir, platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    this.ffprobePath = path.join(binDir, platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
  }

  async getAudioInfo(inputPath: string): Promise<AudioInfo> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        inputPath
      ];

      const process = spawn(this.ffprobePath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
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
          try {
            const info = JSON.parse(stdout);
            const audioStream = info.streams.find((s: any) => s.codec_type === 'audio');

            if (!audioStream) {
              reject(new Error('No audio stream found'));
              return;
            }

            resolve({
              duration: parseFloat(info.format.duration),
              sampleRate: parseInt(audioStream.sample_rate),
              channels: audioStream.channels,
              bitRate: parseInt(info.format.bit_rate) || 0,
              format: info.format.format_name,
              size: parseInt(info.format.size)
            });
          } catch (error) {
            reject(new Error(`Failed to parse audio info: ${error}`));
          }
        } else {
          reject(new Error(`FFprobe failed: ${stderr}`));
        }
      });

      process.on('error', reject);
    });
  }

  async convertAudio(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const audioInfo = await this.getAudioInfo(inputPath);

    const args = [
      '-i', inputPath,
      '-acodec', this.getCodecForFormat(options.outputFormat),
      '-ar', options.sampleRate.toString(),
      '-ac', options.channels.toString(),
      '-y' // 覆盖输出文件
    ];

    // 比特率设置
    if (options.bitRate) {
      args.push('-b:a', `${options.bitRate}k`);
    }

    // 音频标准化
    if (options.normalize) {
      args.push('-filter:a', 'loudnorm');
    }

    // 降噪处理
    if (options.removeNoise) {
      args.push('-filter:a', 'anlmdn');
    }

    args.push(outputPath);

    return new Promise((resolve, reject) => {
      const process = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';

      process.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;

        // 解析转换进度
        if (onProgress) {
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch) {
            const currentTime = this.parseTime(timeMatch[0].split('=')[1]);
            const progress = (currentTime / audioInfo.duration) * 100;
            onProgress(Math.min(progress, 100));
          }
        }
      });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg conversion failed: ${stderr}`));
        }
      });

      process.on('error', reject);
    });
  }

  async extractChaptersFromID3(inputPath: string): Promise<Chapter[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-f', 'ffmetadata',
        '-'
      ];

      const process = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
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
          const chapters = this.parseFFmetadataChapters(stdout);
          resolve(chapters);
        } else {
          // 没有章节信息不算错误
          resolve([]);
        }
      });

      process.on('error', reject);
    });
  }

  async splitAudio(
    inputPath: string,
    outputDir: string,
    segmentDuration: number = 30, // 默认30秒分段
    onProgress?: (progress: number) => void
  ): Promise<string[]> {
    const audioInfo = await this.getAudioInfo(inputPath);
    const totalSegments = Math.ceil(audioInfo.duration / segmentDuration);
    const outputFiles: string[] = [];

    await fs.mkdir(outputDir, { recursive: true });

    for (let i = 0; i < totalSegments; i++) {
      const startTime = i * segmentDuration;
      const outputFile = path.join(outputDir, `segment_${i.toString().padStart(3, '0')}.wav`);

      const args = [
        '-i', inputPath,
        '-ss', startTime.toString(),
        '-t', segmentDuration.toString(),
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-y',
        outputFile
      ];

      await new Promise<void>((resolve, reject) => {
        const process = spawn(this.ffmpegPath, args, {
          stdio: ['ignore', 'ignore', 'pipe']
        });

        process.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Failed to create segment ${i}`));
          }
        });

        process.on('error', reject);
      });

      outputFiles.push(outputFile);

      if (onProgress) {
        const progress = ((i + 1) / totalSegments) * 100;
        onProgress(progress);
      }
    }

    return outputFiles;
  }

  private getCodecForFormat(format: string): string {
    switch (format) {
      case 'wav':
        return 'pcm_s16le';
      case 'mp3':
        return 'libmp3lame';
      case 'flac':
        return 'flac';
      default:
        return 'pcm_s16le';
    }
  }

  private parseTime(timeString: string): number {
    const parts = timeString.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  private parseFFmetadataChapters(metadata: string): Chapter[] {
    const chapters: Chapter[] = [];
    const lines = metadata.split('\n');

    let currentChapter: Partial<Chapter> = {};
    let isInChapter = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine === '[CHAPTER]') {
        if (isInChapter && currentChapter.title && currentChapter.start !== undefined) {
          chapters.push(currentChapter as Chapter);
        }
        currentChapter = { source: 'id3' };
        isInChapter = true;
      } else if (trimmedLine.startsWith('TIMEBASE=')) {
        // 时间基准，通常是1/1000
        continue;
      } else if (trimmedLine.startsWith('START=')) {
        const start = parseInt(trimmedLine.split('=')[1]);
        currentChapter.start = start / 1000; // 转换为秒
      } else if (trimmedLine.startsWith('END=')) {
        const end = parseInt(trimmedLine.split('=')[1]);
        currentChapter.end = end / 1000; // 转换为秒
      } else if (trimmedLine.startsWith('title=')) {
        currentChapter.title = trimmedLine.split('=')[1];
      }
    }

    // 添加最后一个章节
    if (isInChapter && currentChapter.title && currentChapter.start !== undefined) {
      chapters.push(currentChapter as Chapter);
    }

    return chapters;
  }

  async detectSilence(
    inputPath: string,
    silenceDuration: number = 1.0, // 1秒静音
    silenceThreshold: number = -40 // -40dB阈值
  ): Promise<{ start: number; end: number }[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-af', `silencedetect=noise=${silenceThreshold}dB:d=${silenceDuration}`,
        '-f', 'null',
        '-'
      ];

      const process = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'ignore', 'pipe']
      });

      let stderr = '';

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('exit', (code) => {
        const silenceIntervals: { start: number; end: number }[] = [];
        const lines = stderr.split('\n');

        let silenceStart: number | null = null;

        for (const line of lines) {
          const startMatch = line.match(/silence_start: ([\d.]+)/);
          const endMatch = line.match(/silence_end: ([\d.]+)/);

          if (startMatch) {
            silenceStart = parseFloat(startMatch[1]);
          } else if (endMatch && silenceStart !== null) {
            const silenceEnd = parseFloat(endMatch[1]);
            silenceIntervals.push({
              start: silenceStart,
              end: silenceEnd
            });
            silenceStart = null;
          }
        }

        resolve(silenceIntervals);
      });

      process.on('error', reject);
    });
  }
}
```

## 音频预处理服务

### 主要处理流程
```typescript
// src/main/services/AudioPreprocessor.ts
interface PreprocessingResult {
  processedPath: string;
  segments?: string[];
  audioInfo: AudioInfo;
  chapters: Chapter[];
  duration: number;
  tempFiles: string[];
}

class AudioPreprocessor {
  private ffmpegManager: FFmpegManager;
  private tempDir: string;

  constructor() {
    this.ffmpegManager = new FFmpegManager();
    this.tempDir = path.join(os.tmpdir(), 'easypod-audio');
  }

  async preprocessForTranscription(
    inputPath: string,
    options: {
      targetSampleRate?: number;
      enableSegmentation?: boolean;
      segmentDuration?: number;
      enableNormalization?: boolean;
      enableNoiseReduction?: boolean;
    } = {},
    onProgress?: (stage: string, progress: number) => void
  ): Promise<PreprocessingResult> {
    const {
      targetSampleRate = 16000,
      enableSegmentation = true,
      segmentDuration = 30,
      enableNormalization = true,
      enableNoiseReduction = false
    } = options;

    try {
      // 确保临时目录存在
      await fs.mkdir(this.tempDir, { recursive: true });

      onProgress?.('analyzing', 0);

      // 1. 分析音频信息
      const audioInfo = await this.ffmpegManager.getAudioInfo(inputPath);

      onProgress?.('extracting_metadata', 10);

      // 2. 提取章节信息
      const chapters = await this.ffmpegManager.extractChaptersFromID3(inputPath);

      onProgress?.('converting', 20);

      // 3. 音频格式转换和优化
      const convertedPath = await this.convertAndOptimize(
        inputPath,
        audioInfo,
        {
          sampleRate: targetSampleRate,
          channels: 1,
          normalize: enableNormalization,
          removeNoise: enableNoiseReduction
        },
        (progress) => onProgress?.('converting', 20 + progress * 0.5)
      );

      const tempFiles = [convertedPath];
      let segments: string[] | undefined;

      // 4. 音频分段 (可选)
      if (enableSegmentation && audioInfo.duration > segmentDuration * 2) {
        onProgress?.('segmenting', 70);

        const segmentDir = path.join(this.tempDir, `segments-${Date.now()}`);
        segments = await this.ffmpegManager.splitAudio(
          convertedPath,
          segmentDir,
          segmentDuration,
          (progress) => onProgress?.('segmenting', 70 + progress * 0.25)
        );

        tempFiles.push(segmentDir);
      }

      onProgress?.('completed', 100);

      return {
        processedPath: convertedPath,
        segments,
        audioInfo,
        chapters,
        duration: audioInfo.duration,
        tempFiles
      };

    } catch (error) {
      // 清理临时文件
      await this.cleanupTempFiles([this.tempDir]);
      throw error;
    }
  }

  private async convertAndOptimize(
    inputPath: string,
    audioInfo: AudioInfo,
    options: ConversionOptions,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const outputPath = path.join(
      this.tempDir,
      `processed-${Date.now()}.wav`
    );

    // 如果音频已经是目标格式且参数匹配，跳过转换
    if (this.shouldSkipConversion(audioInfo, options)) {
      await fs.copyFile(inputPath, outputPath);
      onProgress?.(100);
      return outputPath;
    }

    await this.ffmpegManager.convertAudio(
      inputPath,
      outputPath,
      {
        outputFormat: 'wav',
        ...options
      },
      onProgress
    );

    return outputPath;
  }

  private shouldSkipConversion(audioInfo: AudioInfo, options: ConversionOptions): boolean {
    return (
      audioInfo.sampleRate === options.sampleRate &&
      audioInfo.channels === options.channels &&
      audioInfo.format.includes('wav') &&
      !options.normalize &&
      !options.removeNoise
    );
  }

  async detectOptimalSegmentPoints(
    audioPath: string,
    minSegmentDuration: number = 20,
    maxSegmentDuration: number = 60
  ): Promise<number[]> {
    // 检测静音区间
    const silenceIntervals = await this.ffmpegManager.detectSilence(audioPath);

    const audioInfo = await this.ffmpegManager.getAudioInfo(audioPath);
    const segmentPoints: number[] = [0]; // 起始点

    let lastSegmentStart = 0;

    for (let currentTime = minSegmentDuration; currentTime < audioInfo.duration; currentTime += 1) {
      const segmentDuration = currentTime - lastSegmentStart;

      // 如果超过最大分段时长，强制分段
      if (segmentDuration >= maxSegmentDuration) {
        segmentPoints.push(currentTime);
        lastSegmentStart = currentTime;
        continue;
      }

      // 在最小时长后寻找静音区间进行分段
      if (segmentDuration >= minSegmentDuration) {
        const nearestSilence = silenceIntervals.find(
          interval => Math.abs(interval.start - currentTime) < 5 // 5秒内的静音
        );

        if (nearestSilence) {
          const segmentPoint = (nearestSilence.start + nearestSilence.end) / 2;
          segmentPoints.push(segmentPoint);
          lastSegmentStart = segmentPoint;
        }
      }
    }

    // 添加结束点
    if (segmentPoints[segmentPoints.length - 1] < audioInfo.duration) {
      segmentPoints.push(audioInfo.duration);
    }

    return segmentPoints;
  }

  async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          await fs.rmdir(filePath, { recursive: true });
        } else {
          await fs.unlink(filePath);
        }
      } catch (error) {
        console.warn(`Failed to cleanup temp file: ${filePath}`, error);
      }
    }
  }

  async validateAudioFile(filePath: string): Promise<{
    isValid: boolean;
    error?: string;
    audioInfo?: AudioInfo;
  }> {
    try {
      const audioInfo = await this.ffmpegManager.getAudioInfo(filePath);

      // 基本验证
      if (audioInfo.duration <= 0) {
        return { isValid: false, error: 'Invalid audio duration' };
      }

      if (audioInfo.sampleRate < 8000) {
        return { isValid: false, error: 'Sample rate too low (< 8kHz)' };
      }

      if (audioInfo.duration > 10 * 3600) {
        return { isValid: false, error: 'Audio too long (> 10 hours)' };
      }

      return { isValid: true, audioInfo };

    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }
}
```

## 章节信息处理
```typescript
// src/main/utils/ChapterExtractor.ts
interface Chapter {
  id: string;
  title: string;
  start: number; // 秒
  end?: number;
  imageUrl?: string;
  url?: string;
  source: 'json' | 'id3' | 'shownote';
}

class ChapterExtractor {
  static async extractFromMultipleSources(
    episodeId: string,
    audioPath: string,
    shownoteHtml: string,
    podcastChaptersUrl?: string
  ): Promise<Chapter[]> {
    const chaptersFromSources: Chapter[] = [];

    // 1. 从Podcast 2.0 JSON提取
    if (podcastChaptersUrl) {
      try {
        const jsonChapters = await this.extractFromJSON(podcastChaptersUrl);
        chaptersFromSources.push(...jsonChapters);
      } catch (error) {
        console.warn('Failed to extract chapters from JSON:', error);
      }
    }

    // 2. 从ID3标签提取
    if (audioPath) {
      try {
        const ffmpegManager = new FFmpegManager();
        const id3Chapters = await ffmpegManager.extractChaptersFromID3(audioPath);
        chaptersFromSources.push(...id3Chapters);
      } catch (error) {
        console.warn('Failed to extract chapters from ID3:', error);
      }
    }

    // 3. 从Shownote提取时间戳
    if (shownoteHtml) {
      try {
        const shownoteChapters = await this.extractFromShownote(shownoteHtml);
        chaptersFromSources.push(...shownoteChapters);
      } catch (error) {
        console.warn('Failed to extract chapters from shownote:', error);
      }
    }

    // 按优先级选择和合并章节
    return this.mergeAndDeduplicateChapters(chaptersFromSources);
  }

  private static async extractFromJSON(chaptersUrl: string): Promise<Chapter[]> {
    const response = await fetch(chaptersUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch chapters: ${response.statusText}`);
    }

    const chaptersData = await response.json();

    if (!chaptersData.chapters || !Array.isArray(chaptersData.chapters)) {
      throw new Error('Invalid chapters JSON format');
    }

    return chaptersData.chapters.map((chapter: any, index: number) => ({
      id: `json-${index}`,
      title: chapter.title || `Chapter ${index + 1}`,
      start: chapter.startTime || 0,
      end: chapter.endTime,
      imageUrl: chapter.img,
      url: chapter.url,
      source: 'json' as const
    }));
  }

  private static extractFromShownote(html: string): Chapter[] {
    const chapters: Chapter[] = [];

    // 使用更复杂的正则表达式匹配时间戳和标题
    const timestampPatterns = [
      /(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]\s*(.+?)(?=\n|$)/gm,
      /(?:^|\n)\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+?)(?=\n|$)/gm,
      /(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?)(?=\n|$)/gm,
    ];

    for (const pattern of timestampPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const timeStr = match[1];
        const title = match[2].trim();

        if (title.length > 3) { // 过滤掉太短的标题
          const startTime = this.parseTimeString(timeStr);
          if (startTime !== null) {
            chapters.push({
              id: `shownote-${chapters.length}`,
              title,
              start: startTime,
              source: 'shownote'
            });
          }
        }
      }
    }

    return chapters;
  }

  private static parseTimeString(timeStr: string): number | null {
    const parts = timeStr.split(':');

    try {
      if (parts.length === 2) {
        // MM:SS format
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        return minutes * 60 + seconds;
      } else if (parts.length === 3) {
        // HH:MM:SS format
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseInt(parts[2], 10);
        return hours * 3600 + minutes * 60 + seconds;
      }
    } catch {
      return null;
    }

    return null;
  }

  private static mergeAndDeduplicateChapters(chapters: Chapter[]): Chapter[] {
    // 按来源优先级排序：JSON > ID3 > Shownote
    const sourcePriority = { json: 0, id3: 1, shownote: 2 };

    chapters.sort((a, b) => {
      const priorityDiff = sourcePriority[a.source] - sourcePriority[b.source];
      if (priorityDiff !== 0) return priorityDiff;
      return a.start - b.start;
    });

    // 去重逻辑：如果两个章节的开始时间相近(10秒内)，保留优先级高的
    const deduped: Chapter[] = [];
    const timeThreshold = 10; // 10秒阈值

    for (const chapter of chapters) {
      const existing = deduped.find(c =>
        Math.abs(c.start - chapter.start) < timeThreshold
      );

      if (!existing) {
        deduped.push(chapter);
      } else if (sourcePriority[chapter.source] < sourcePriority[existing.source]) {
        // 替换为更高优先级的章节
        const index = deduped.indexOf(existing);
        deduped[index] = chapter;
      }
    }

    // 最终按时间排序
    return deduped.sort((a, b) => a.start - b.start);
  }
}
```

## 相关文件
- `src/main/services/FFmpegManager.ts` - FFmpeg操作管理
- `src/main/services/AudioPreprocessor.ts` - 音频预处理主服务
- `src/main/utils/ChapterExtractor.ts` - 章节信息提取
- `resources/bin/` - FFmpeg二进制文件目录
- `src/main/types/audio.ts` - 音频相关类型定义

## 后续任务依赖
- task_stage3_transcript_subtitle_sync
- task_stage3_performance_optimization