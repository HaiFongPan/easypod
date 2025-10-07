# Task Stage 1.5: 数据转换和处理逻辑

## 任务概述

实现数据转换和处理的核心逻辑，包括字幕格式转换、文本提取、发言人统计、时间轴处理等功能。

## 技术设计

### 数据流转

```
原始数据 (FunASR/Aliyun)
    ↓
Converter (转换器)
    ↓
统一格式 (SentenceInfo[])
    ↓
数据库存储
    ↓
UI 展示
```

### 核心功能模块

1. **格式转换**: 将不同服务的数据转换为统一格式
2. **文本处理**: 提取纯文本、清理格式
3. **时间轴处理**: 时间戳校验、对齐、合并
4. **发言人分析**: 统计发言人、分段标记

## 实现细节

### 1. 字幕格式处理工具类

在 `src/main/utils/subtitleUtils.ts`:

```typescript
/**
 * 字幕工具类
 */
export class SubtitleUtils {
  /**
   * 格式化时间（毫秒 -> HH:MM:SS.mmm）
   */
  static formatTimestamp(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }

  /**
   * 解析时间戳字符串
   */
  static parseTimestamp(timeStr: string): number {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const [seconds, milliseconds] = parts[2].split('.').map(s => parseInt(s, 10));

    return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
  }

  /**
   * 转换为 SRT 格式
   */
  static toSRT(sentences: SentenceInfo[]): string {
    const lines: string[] = [];

    sentences.forEach((sentence, index) => {
      lines.push(`${index + 1}`);
      lines.push(
        `${this.formatTimestamp(sentence.start)} --> ${this.formatTimestamp(sentence.end)}`
      );
      lines.push(sentence.text);
      lines.push(''); // 空行
    });

    return lines.join('\n');
  }

  /**
   * 转换为 VTT 格式
   */
  static toVTT(sentences: SentenceInfo[]): string {
    const lines: string[] = ['WEBVTT', ''];

    sentences.forEach((sentence, index) => {
      lines.push(`${index + 1}`);
      lines.push(
        `${this.formatTimestamp(sentence.start)} --> ${this.formatTimestamp(sentence.end)}`
      );
      lines.push(sentence.text);
      lines.push(''); // 空行
    });

    return lines.join('\n');
  }

  /**
   * 转换为 LRC 格式（歌词格式）
   */
  static toLRC(sentences: SentenceInfo[]): string {
    const lines: string[] = [];

    sentences.forEach(sentence => {
      const timeTag = this.formatLRCTime(sentence.start);
      lines.push(`[${timeTag}]${sentence.text}`);
    });

    return lines.join('\n');
  }

  /**
   * 格式化 LRC 时间标签
   */
  private static formatLRCTime(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }

  /**
   * 按发言人分组字幕
   */
  static groupBySpeaker(sentences: SentenceInfo[]): Map<number, SentenceInfo[]> {
    const groups = new Map<number, SentenceInfo[]>();

    for (const sentence of sentences) {
      const spk = sentence.spk;
      if (!groups.has(spk)) {
        groups.set(spk, []);
      }
      groups.get(spk)!.push(sentence);
    }

    return groups;
  }

  /**
   * 合并连续的同一发言人字幕
   */
  static mergeContinuousSpeaker(
    sentences: SentenceInfo[],
    maxGapMs: number = 1000
  ): SentenceInfo[] {
    if (sentences.length === 0) return [];

    const merged: SentenceInfo[] = [];
    let current = { ...sentences[0] };

    for (let i = 1; i < sentences.length; i++) {
      const next = sentences[i];

      // 同一发言人且时间间隔小于阈值
      if (next.spk === current.spk && next.start - current.end <= maxGapMs) {
        current.text += ' ' + next.text;
        current.end = next.end;
        current.timestamp = [...current.timestamp, ...next.timestamp];
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * 校验字幕时间轴的合法性
   */
  static validateTimestamps(sentences: SentenceInfo[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      // 检查起止时间
      if (sentence.start >= sentence.end) {
        errors.push(
          `Sentence ${i}: start time (${sentence.start}) >= end time (${sentence.end})`
        );
      }

      // 检查是否与下一句重叠
      if (i < sentences.length - 1) {
        const next = sentences[i + 1];
        if (sentence.end > next.start) {
          errors.push(
            `Sentence ${i} and ${i + 1}: overlapping timestamps (${sentence.end} > ${next.start})`
          );
        }
      }

      // 检查词级别时间戳
      for (const [start, end] of sentence.timestamp) {
        if (start < sentence.start || end > sentence.end) {
          errors.push(
            `Sentence ${i}: word timestamp out of range ([${start}, ${end}] not in [${sentence.start}, ${sentence.end}])`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 查找指定时间点的字幕
   */
  static findByTimestamp(
    sentences: SentenceInfo[],
    timestampMs: number
  ): SentenceInfo | null {
    for (const sentence of sentences) {
      if (timestampMs >= sentence.start && timestampMs <= sentence.end) {
        return sentence;
      }
    }
    return null;
  }

  /**
   * 获取时间范围内的字幕
   */
  static getRange(
    sentences: SentenceInfo[],
    startMs: number,
    endMs: number
  ): SentenceInfo[] {
    return sentences.filter(
      sentence =>
        (sentence.start >= startMs && sentence.start <= endMs) ||
        (sentence.end >= startMs && sentence.end <= endMs) ||
        (sentence.start <= startMs && sentence.end >= endMs)
    );
  }
}
```

### 2. 文本处理工具类

在 `src/main/utils/textUtils.ts`:

```typescript
/**
 * 文本处理工具类
 */
export class TextUtils {
  /**
   * 清理文本（去除多余空格、换行等）
   */
  static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // 多个空白字符替换为单个空格
      .trim();
  }

  /**
   * 计算文本统计信息
   */
  static getTextStats(text: string): {
    characters: number;
    words: number;
    sentences: number;
  } {
    const cleaned = this.cleanText(text);

    return {
      characters: cleaned.length,
      words: cleaned.split(/\s+/).filter(w => w.length > 0).length,
      sentences: cleaned.split(/[。！？.!?]+/).filter(s => s.trim().length > 0).length,
    };
  }

  /**
   * 提取关键词（简单实现，基于词频）
   */
  static extractKeywords(text: string, topN: number = 10): string[] {
    const words = this.cleanText(text).split(/\s+/);
    const wordFreq = new Map<string, number>();

    // 停用词（简化版）
    const stopWords = new Set([
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人',
      'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    ]);

    for (const word of words) {
      const lower = word.toLowerCase();
      if (lower.length > 1 && !stopWords.has(lower)) {
        wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1);
      }
    }

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word]) => word);
  }

  /**
   * 生成摘要（简单截取）
   */
  static generateExcerpt(text: string, maxLength: number = 200): string {
    const cleaned = this.cleanText(text);
    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    // 尽量在句子边界截断
    const truncated = cleaned.substring(0, maxLength);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？')
    );

    if (lastPeriod > maxLength * 0.5) {
      return truncated.substring(0, lastPeriod + 1);
    }

    return truncated + '...';
  }

  /**
   * 检测文本语言
   */
  static detectLanguage(text: string): 'zh' | 'en' | 'mixed' {
    const zhChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
    const enChars = text.match(/[a-zA-Z]/g)?.length || 0;
    const total = zhChars + enChars;

    if (total === 0) return 'en';

    const zhRatio = zhChars / total;

    if (zhRatio > 0.7) return 'zh';
    if (zhRatio < 0.3) return 'en';
    return 'mixed';
  }
}
```

### 3. 转写数据处理服务

在 `src/main/services/transcript/TranscriptProcessor.ts`:

```typescript
import { SentenceInfo, EpisodeTranscript } from '@/main/types/transcript';
import { SubtitleUtils } from '@/main/utils/subtitleUtils';
import { TextUtils } from '@/main/utils/textUtils';

/**
 * 转写数据处理服务
 */
export class TranscriptProcessor {
  /**
   * 处理并优化字幕数据
   */
  static processTranscript(
    sentences: SentenceInfo[],
    options: ProcessOptions = {}
  ): ProcessedTranscript {
    let processed = [...sentences];

    // 1. 校验时间轴
    const validation = SubtitleUtils.validateTimestamps(processed);
    if (!validation.valid) {
      console.warn('Timestamp validation warnings:', validation.errors);
    }

    // 2. 合并连续同发言人字幕
    if (options.mergeSpeaker !== false) {
      processed = SubtitleUtils.mergeContinuousSpeaker(
        processed,
        options.maxSpeakerGapMs || 1000
      );
    }

    // 3. 提取纯文本
    const text = processed.map(s => s.text).join(' ');
    const cleanedText = TextUtils.cleanText(text);

    // 4. 统计信息
    const stats = TextUtils.getTextStats(cleanedText);
    const speakerGroups = SubtitleUtils.groupBySpeaker(processed);
    const language = TextUtils.detectLanguage(cleanedText);

    // 5. 按发言人统计
    const speakerStats = Array.from(speakerGroups.entries()).map(([spk, sents]) => ({
      speakerId: spk,
      sentenceCount: sents.length,
      duration: sents.reduce((sum, s) => sum + (s.end - s.start), 0),
      text: sents.map(s => s.text).join(' '),
    }));

    return {
      sentences: processed,
      text: cleanedText,
      stats: {
        ...stats,
        duration: processed[processed.length - 1]?.end || 0,
        speakerCount: speakerGroups.size,
        language,
      },
      speakerStats,
    };
  }

  /**
   * 导出为不同格式
   */
  static export(
    sentences: SentenceInfo[],
    format: 'srt' | 'vtt' | 'lrc' | 'txt' | 'json'
  ): string {
    switch (format) {
      case 'srt':
        return SubtitleUtils.toSRT(sentences);
      case 'vtt':
        return SubtitleUtils.toVTT(sentences);
      case 'lrc':
        return SubtitleUtils.toLRC(sentences);
      case 'txt':
        return sentences.map(s => s.text).join('\n');
      case 'json':
        return JSON.stringify(sentences, null, 2);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 生成字幕预览（用于 UI 显示）
   */
  static generatePreview(
    sentences: SentenceInfo[],
    options: PreviewOptions = {}
  ): SubtitlePreview[] {
    const maxItems = options.maxItems || 50;
    const highlightSpeaker = options.highlightSpeaker;

    return sentences.slice(0, maxItems).map((sentence, index) => ({
      id: index,
      text: sentence.text,
      startTime: SubtitleUtils.formatTimestamp(sentence.start),
      endTime: SubtitleUtils.formatTimestamp(sentence.end),
      startMs: sentence.start,
      endMs: sentence.end,
      speakerId: sentence.spk,
      isHighlighted: highlightSpeaker !== undefined && sentence.spk === highlightSpeaker,
    }));
  }
}

interface ProcessOptions {
  mergeSpeaker?: boolean;
  maxSpeakerGapMs?: number;
}

interface ProcessedTranscript {
  sentences: SentenceInfo[];
  text: string;
  stats: {
    characters: number;
    words: number;
    sentences: number;
    duration: number;
    speakerCount: number;
    language: 'zh' | 'en' | 'mixed';
  };
  speakerStats: Array<{
    speakerId: number;
    sentenceCount: number;
    duration: number;
    text: string;
  }>;
}

interface PreviewOptions {
  maxItems?: number;
  highlightSpeaker?: number;
}

interface SubtitlePreview {
  id: number;
  text: string;
  startTime: string;
  endTime: string;
  startMs: number;
  endMs: number;
  speakerId: number;
  isHighlighted: boolean;
}
```

## 依赖关系

- **前置依赖**:
  - Task 1.1: 数据库表结构
  - Task 1.2: VoiceToText 接口
  - Task 1.3: FunASR 服务
  - Task 1.4: 阿里云服务

- **后置依赖**:
  - Task 1.6: IPC 通信接口
  - Task 1.7: UI 集成

## 验收标准

- [ ] SubtitleUtils 工具类实现完整
- [ ] TextUtils 工具类实现完整
- [ ] TranscriptProcessor 处理服务实现
- [ ] 支持多种字幕格式导出（SRT、VTT、LRC、TXT、JSON）
- [ ] 时间轴校验逻辑正确
- [ ] 发言人分组和合并逻辑正确
- [ ] 文本统计和语言检测准确
- [ ] 单元测试覆盖所有工具函数

## 风险和注意事项

### 风险

1. **时间轴精度**: 不同服务的时间戳精度可能不一致
2. **字幕合并**: 自动合并可能不符合用户期望
3. **语言检测**: 简单的字符统计可能不够准确

### 注意事项

1. **时间格式**: 统一使用毫秒作为内部时间单位
2. **字符编码**: 确保 UTF-8 编码处理正确
3. **边界情况**: 空字幕、单句字幕等边界情况
4. **性能优化**: 大量字幕数据的处理性能

## 实施步骤

1. 实现 SubtitleUtils 工具类
2. 实现 TextUtils 工具类
3. 实现 TranscriptProcessor 处理服务
4. 编写单元测试
5. 性能测试和优化
6. 集成到转写服务流程

## 估时

- 设计: 1 天
- 实现: 3 天
- 测试: 2 天
- **总计**: 6 天
