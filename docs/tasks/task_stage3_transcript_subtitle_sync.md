# 任务：字幕同步和显示

## 任务信息
- **阶段**: 3 - FunASR转写集成
- **估时**: 16小时
- **优先级**: 高
- **依赖**: task_stage3_audio_preprocessing

## 任务目标
实现字幕的实时同步显示、点击跳转和多格式导出功能。

## 具体任务
1. **实时字幕滚动组件**
   - 创建字幕显示组件
   - 实现自动滚动和高亮
   - 支持多说话人显示
   - 响应式设计和样式定制

2. **时间戳对齐和校正**
   - 字幕与音频时间同步
   - 延迟补偿和校正算法
   - 用户手动调整时间偏移
   - 同步精度优化

3. **SRT/VTT格式导出**
   - 标准字幕格式生成
   - 支持样式和说话人标识
   - 批量导出功能
   - 格式验证和兼容性

4. **字幕点击跳转功能**
   - 点击字幕跳转播放位置
   - 关键词搜索和高亮
   - 字幕片段选择和分享
   - 快捷键导航支持

## 验收标准
- [ ] 字幕与音频同步误差≤500ms
- [ ] 支持中英文混合显示
- [ ] 说话人切换标识清晰
- [ ] SRT/VTT格式符合标准
- [ ] 点击跳转响应时间≤100ms
- [ ] 长文本正确断行和滚动

## 字幕显示组件

### 实时滚动字幕
```tsx
// src/renderer/components/Transcript/TranscriptViewer.tsx
interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker: string;
  confidence: number;
}

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime: number;
  isPlaying: boolean;
  onSegmentClick: (timestamp: number) => void;
  onSpeakerClick?: (speaker: string) => void;
  highlightSearch?: string;
  showTimestamps?: boolean;
  showSpeakers?: boolean;
  showConfidence?: boolean;
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  segments,
  currentTime,
  isPlaying,
  onSegmentClick,
  onSpeakerClick,
  highlightSearch = '',
  showTimestamps = true,
  showSpeakers = true,
  showConfidence = false,
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // 查找当前播放的字幕片段
  const currentSegmentIndex = segments.findIndex(segment =>
    currentTime >= segment.start && currentTime < segment.end
  );

  // 自动滚动到当前字幕
  useEffect(() => {
    if (autoScroll && isPlaying && activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSegmentIndex, autoScroll, isPlaying]);

  const handleSegmentClick = (segment: TranscriptSegment) => {
    setSelectedSegment(segment.id);
    onSegmentClick(segment.start);
  };

  const handleScroll = () => {
    // 用户手动滚动时暂时禁用自动滚动
    setAutoScroll(false);

    // 5秒后重新启用自动滚动
    setTimeout(() => setAutoScroll(true), 5000);
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const highlightText = (text: string, searchQuery: string): React.ReactNode => {
    if (!searchQuery) return text;

    const regex = new RegExp(`(${escapeRegExp(searchQuery)})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="transcript-viewer h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`btn-sm ${autoScroll ? 'btn-primary' : 'btn-secondary'}`}
          >
            Auto Scroll
          </button>

          <span className="text-sm text-gray-600 dark:text-gray-400">
            {segments.length} segments
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={showTimestamps}
              onChange={(e) => setShowTimestamps(e.target.checked)}
            />
            Timestamps
          </label>

          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={showSpeakers}
              onChange={(e) => setShowSpeakers(e.target.checked)}
            />
            Speakers
          </label>
        </div>
      </div>

      {/* 字幕内容 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        onScroll={handleScroll}
      >
        {segments.map((segment, index) => {
          const isActive = index === currentSegmentIndex;
          const isSelected = segment.id === selectedSegment;

          return (
            <div
              key={segment.id}
              ref={isActive ? activeSegmentRef : undefined}
              className={`transcript-segment group cursor-pointer transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 pl-3 scale-105'
                  : isSelected
                  ? 'bg-gray-100 dark:bg-gray-800 pl-3'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 pl-3'
              }`}
              onClick={() => handleSegmentClick(segment)}
            >
              <div className="flex items-start gap-3">
                {/* 时间戳 */}
                {showTimestamps && (
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1 min-w-[3rem]">
                    {formatTime(segment.start)}
                  </span>
                )}

                {/* 说话人标识 */}
                {showSpeakers && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSpeakerClick?.(segment.speaker);
                    }}
                    className={`text-xs px-2 py-1 rounded-full font-medium mt-0.5 min-w-[2rem] ${getSpeakerColor(segment.speaker)}`}
                  >
                    {segment.speaker}
                  </button>
                )}

                {/* 文本内容 */}
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-gray-900 dark:text-gray-100">
                    {highlightText(segment.text, highlightSearch)}
                  </p>

                  {/* 置信度显示 */}
                  {showConfidence && (
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Confidence:</span>
                        <div className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              segment.confidence > 0.8 ? 'bg-green-500' :
                              segment.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${segment.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round(segment.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(segment.text);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Copy text"
                  >
                    <CopyIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const getSpeakerColor = (speaker: string): string => {
  const colors = [
    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  ];

  const index = speaker.charCodeAt(speaker.length - 1) % colors.length;
  return colors[index];
};
```

## 字幕格式导出

### SRT/VTT导出器
```typescript
// src/main/services/SubtitleExporter.ts
interface SubtitleExportOptions {
  format: 'srt' | 'vtt' | 'json';
  includeSpeakers: boolean;
  includeConfidence: boolean;
  maxLineLength: number;
  mergeShortSegments: boolean;
  minSegmentDuration: number;
}

class SubtitleExporter {
  async exportSubtitles(
    segments: TranscriptSegment[],
    outputPath: string,
    options: SubtitleExportOptions
  ): Promise<void> {
    // 预处理片段
    const processedSegments = this.preprocessSegments(segments, options);

    switch (options.format) {
      case 'srt':
        await this.exportSRT(processedSegments, outputPath, options);
        break;
      case 'vtt':
        await this.exportVTT(processedSegments, outputPath, options);
        break;
      case 'json':
        await this.exportJSON(processedSegments, outputPath, options);
        break;
      default:
        throw new Error(`Unsupported subtitle format: ${options.format}`);
    }
  }

  private preprocessSegments(
    segments: TranscriptSegment[],
    options: SubtitleExportOptions
  ): TranscriptSegment[] {
    let processed = [...segments];

    // 合并短片段
    if (options.mergeShortSegments) {
      processed = this.mergeShortSegments(processed, options.minSegmentDuration);
    }

    // 文本换行处理
    processed = processed.map(segment => ({
      ...segment,
      text: this.wrapText(segment.text, options.maxLineLength)
    }));

    return processed;
  }

  private async exportSRT(
    segments: TranscriptSegment[],
    outputPath: string,
    options: SubtitleExportOptions
  ): Promise<void> {
    const srtContent = segments
      .map((segment, index) => {
        const startTime = this.formatSRTTime(segment.start);
        const endTime = this.formatSRTTime(segment.end);

        let text = segment.text;
        if (options.includeSpeakers) {
          text = `<b>${segment.speaker}:</b> ${text}`;
        }

        return `${index + 1}\n${startTime} --> ${endTime}\n${text}\n`;
      })
      .join('\n');

    await fs.writeFile(outputPath, srtContent, 'utf-8');
  }

  private async exportVTT(
    segments: TranscriptSegment[],
    outputPath: string,
    options: SubtitleExportOptions
  ): Promise<void> {
    let vttContent = 'WEBVTT\n\n';

    // 添加样式定义
    if (options.includeSpeakers) {
      vttContent += `STYLE
::cue(.speaker) {
  color: #3b82f6;
  font-weight: bold;
}

`;
    }

    vttContent += segments
      .map(segment => {
        const startTime = this.formatVTTTime(segment.start);
        const endTime = this.formatVTTTime(segment.end);

        let text = segment.text;
        if (options.includeSpeakers) {
          text = `<c.speaker>${segment.speaker}:</c> ${text}`;
        }

        let cueContent = `${startTime} --> ${endTime}\n${text}`;

        // 添加置信度信息
        if (options.includeConfidence && segment.confidence < 0.8) {
          cueContent += `\nNOTE confidence: ${Math.round(segment.confidence * 100)}%`;
        }

        return cueContent;
      })
      .join('\n\n');

    await fs.writeFile(outputPath, vttContent, 'utf-8');
  }

  private async exportJSON(
    segments: TranscriptSegment[],
    outputPath: string,
    options: SubtitleExportOptions
  ): Promise<void> {
    const jsonData = {
      version: '1.0',
      segments: segments.map(segment => ({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        speaker: options.includeSpeakers ? segment.speaker : undefined,
        confidence: options.includeConfidence ? segment.confidence : undefined,
      })),
      metadata: {
        totalDuration: Math.max(...segments.map(s => s.end)),
        segmentCount: segments.length,
        speakerCount: new Set(segments.map(s => s.speaker)).size,
        exportedAt: new Date().toISOString(),
      }
    };

    await fs.writeFile(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms
      .toString()
      .padStart(3, '0')}`;
  }

  private formatVTTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(3);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.padStart(6, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${secs.padStart(6, '0')}`;
  }

  private wrapText(text: string, maxLineLength: number): string {
    if (text.length <= maxLineLength) {
      return text;
    }

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length > maxLineLength && currentLine !== '') {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }

    if (currentLine.trim() !== '') {
      lines.push(currentLine.trim());
    }

    return lines.join('\n');
  }

  private mergeShortSegments(
    segments: TranscriptSegment[],
    minDuration: number
  ): TranscriptSegment[] {
    const merged: TranscriptSegment[] = [];

    for (let i = 0; i < segments.length; i++) {
      const current = segments[i];
      const duration = current.end - current.start;

      if (duration < minDuration && merged.length > 0 && merged[merged.length - 1].speaker === current.speaker) {
        // 合并到上一个片段
        const previous = merged[merged.length - 1];
        previous.end = current.end;
        previous.text += ' ' + current.text;
        previous.confidence = (previous.confidence + current.confidence) / 2;
      } else {
        merged.push({ ...current });
      }
    }

    return merged;
  }
}
```

## 时间同步服务
```typescript
// src/main/services/TranscriptSyncService.ts
interface SyncAdjustment {
  globalOffset: number; // 全局时间偏移
  speedAdjustment: number; // 播放速度调整
  segmentAdjustments: Map<string, number>; // 特定片段的调整
}

class TranscriptSyncService {
  private syncAdjustment: SyncAdjustment = {
    globalOffset: 0,
    speedAdjustment: 1.0,
    segmentAdjustments: new Map(),
  };

  adjustGlobalOffset(offsetMs: number): void {
    this.syncAdjustment.globalOffset = offsetMs / 1000; // 转换为秒
  }

  adjustSegmentTiming(segmentId: string, offsetMs: number): void {
    this.syncAdjustment.segmentAdjustments.set(segmentId, offsetMs / 1000);
  }

  getAdjustedTimestamp(segmentId: string, originalTime: number): number {
    let adjustedTime = originalTime + this.syncAdjustment.globalOffset;

    // 应用播放速度调整
    adjustedTime *= this.syncAdjustment.speedAdjustment;

    // 应用特定片段调整
    const segmentAdjustment = this.syncAdjustment.segmentAdjustments.get(segmentId) || 0;
    adjustedTime += segmentAdjustment;

    return Math.max(0, adjustedTime);
  }

  detectSyncIssues(
    segments: TranscriptSegment[],
    audioEvents: { timestamp: number; type: 'speech' | 'silence' }[]
  ): { segmentId: string; suggestedOffset: number }[] {
    const issues: { segmentId: string; suggestedOffset: number }[] = [];

    // 简化的同步问题检测算法
    for (const segment of segments) {
      const nearbyEvents = audioEvents.filter(
        event => Math.abs(event.timestamp - segment.start) < 2 // 2秒内的事件
      );

      if (nearbyEvents.length === 0) {
        // 可能的时间戳错误
        const closestEvent = audioEvents.reduce((closest, event) =>
          Math.abs(event.timestamp - segment.start) < Math.abs(closest.timestamp - segment.start)
            ? event
            : closest
        );

        const suggestedOffset = closestEvent.timestamp - segment.start;
        if (Math.abs(suggestedOffset) > 0.5) { // 超过500ms的偏差
          issues.push({
            segmentId: segment.id,
            suggestedOffset: suggestedOffset * 1000, // 转换为毫秒
          });
        }
      }
    }

    return issues;
  }

  exportSyncSettings(): string {
    return JSON.stringify(this.syncAdjustment, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    }, 2);
  }

  importSyncSettings(settingsJson: string): void {
    try {
      const settings = JSON.parse(settingsJson);
      this.syncAdjustment.globalOffset = settings.globalOffset || 0;
      this.syncAdjustment.speedAdjustment = settings.speedAdjustment || 1.0;
      this.syncAdjustment.segmentAdjustments = new Map(
        Object.entries(settings.segmentAdjustments || {})
      );
    } catch (error) {
      console.error('Failed to import sync settings:', error);
      throw new Error('Invalid sync settings format');
    }
  }
}
```

## 相关文件
- `src/renderer/components/Transcript/TranscriptViewer.tsx`
- `src/main/services/SubtitleExporter.ts`
- `src/main/services/TranscriptSyncService.ts`
- `src/renderer/hooks/useTranscriptSync.ts`
- `src/main/types/transcript.ts`

## 后续任务依赖
- task_stage3_performance_optimization
- task_stage4_ai_content_integration