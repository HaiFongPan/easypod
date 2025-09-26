# 任务：性能优化和测试

## 任务信息
- **阶段**: 3 - FunASR转写集成
- **估时**: 8小时
- **优先级**: 中
- **依赖**: task_stage3_transcript_subtitle_sync

## 任务目标
优化转写性能，确保UI响应性，并完成长音频文件处理的测试验证。

## 具体任务
1. **转写任务并发处理**
   - 实现任务队列管理
   - 多任务并发控制
   - 资源使用监控和限制
   - 任务优先级调度

2. **内存和CPU使用优化**
   - 音频分块处理优化
   - 内存泄漏检测和修复
   - CPU使用率控制
   - 垃圾回收优化

3. **长音频文件处理测试**
   - 2-10小时音频测试
   - 大文件分段策略验证
   - 进度跟踪准确性测试
   - 错误恢复机制测试

4. **UI响应性保证**
   - 后台任务与UI分离
   - 进度更新频率优化
   - 大量字幕的渲染优化
   - 滚动和搜索性能优化

## 验收标准
- [ ] 转写过程中UI保持≥30fps
- [ ] 内存使用峰值≤2GB (10小时音频)
- [ ] CPU使用率平均≤70%
- [ ] 支持同时处理3个转写任务
- [ ] 10小时音频处理成功率≥95%
- [ ] 任务取消和恢复功能正常

## 任务队列管理

### 转写任务调度器
```typescript
// src/main/services/TranscriptionScheduler.ts
interface TranscriptionTask {
  id: string;
  episodeId: string;
  audioPath: string;
  options: TranscriptionOptions;
  priority: 'low' | 'normal' | 'high';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: TranscriptionResult;
  error?: string;
}

interface SchedulerConfig {
  maxConcurrentTasks: number;
  maxMemoryUsage: number; // MB
  maxCpuUsage: number; // percentage
  taskTimeout: number; // minutes
}

class TranscriptionScheduler {
  private tasks = new Map<string, TranscriptionTask>();
  private activeWorkers = new Set<string>();
  private config: SchedulerConfig;
  private resourceMonitor: ResourceMonitor;

  constructor(config: SchedulerConfig) {
    this.config = config;
    this.resourceMonitor = new ResourceMonitor();
    this.startScheduler();
  }

  addTask(
    episodeId: string,
    audioPath: string,
    options: TranscriptionOptions,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): string {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const task: TranscriptionTask = {
      id: taskId,
      episodeId,
      audioPath,
      options,
      priority,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
    };

    this.tasks.set(taskId, task);
    this.scheduleNext();

    return taskId;
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'processing') {
      // 通知工作进程取消任务
      this.cancelActiveTask(taskId);
    }

    task.status = 'cancelled';
    task.completedAt = new Date();

    return true;
  }

  getTask(taskId: string): TranscriptionTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): TranscriptionTask[] {
    return Array.from(this.tasks.values());
  }

  getQueueStatus(): {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const tasks = Array.from(this.tasks.values());
    return {
      queued: tasks.filter(t => t.status === 'queued').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    };
  }

  private startScheduler(): void {
    setInterval(() => {
      this.scheduleNext();
      this.cleanupCompletedTasks();
      this.checkTaskTimeouts();
    }, 1000); // 每秒检查一次
  }

  private async scheduleNext(): Promise<void> {
    if (this.activeWorkers.size >= this.config.maxConcurrentTasks) {
      return; // 已达到并发限制
    }

    // 检查资源使用情况
    const resourceUsage = await this.resourceMonitor.getCurrentUsage();
    if (
      resourceUsage.memory > this.config.maxMemoryUsage ||
      resourceUsage.cpu > this.config.maxCpuUsage
    ) {
      return; // 资源使用过高
    }

    // 选择下一个任务
    const nextTask = this.getNextTask();
    if (!nextTask) return;

    // 开始处理任务
    await this.processTask(nextTask);
  }

  private getNextTask(): TranscriptionTask | null {
    const queuedTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'queued')
      .sort((a, b) => {
        // 按优先级排序
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // 相同优先级按创建时间排序
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    return queuedTasks[0] || null;
  }

  private async processTask(task: TranscriptionTask): Promise<void> {
    task.status = 'processing';
    task.startedAt = new Date();
    this.activeWorkers.add(task.id);

    try {
      const funASRClient = new FunASRClient();

      const result = await funASRClient.transcribeAudio(
        task.audioPath,
        task.options,
        (progress) => {
          task.progress = progress;
          this.emitTaskProgress(task.id, progress);
        }
      );

      task.status = 'completed';
      task.result = result;
      task.progress = 100;
      task.completedAt = new Date();

      this.emitTaskCompleted(task.id, result);

    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = new Date();

      this.emitTaskFailed(task.id, error.message);
    } finally {
      this.activeWorkers.delete(task.id);
    }
  }

  private cancelActiveTask(taskId: string): void {
    // 这里应该通知FunASR客户端取消任务
    // 实现取决于FunASR服务的具体接口
  }

  private cleanupCompletedTasks(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前

    for (const [taskId, task] of this.tasks) {
      if (
        (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
        task.completedAt &&
        task.completedAt < cutoffTime
      ) {
        this.tasks.delete(taskId);
      }
    }
  }

  private checkTaskTimeouts(): void {
    const timeoutMs = this.config.taskTimeout * 60 * 1000;
    const now = new Date();

    for (const task of this.tasks.values()) {
      if (
        task.status === 'processing' &&
        task.startedAt &&
        now.getTime() - task.startedAt.getTime() > timeoutMs
      ) {
        this.cancelTask(task.id);
        task.error = 'Task timeout';
        task.status = 'failed';
      }
    }
  }

  private emitTaskProgress(taskId: string, progress: number): void {
    // 发送进度更新事件到渲染进程
    if (global.mainWindow) {
      global.mainWindow.webContents.send('transcription-progress', { taskId, progress });
    }
  }

  private emitTaskCompleted(taskId: string, result: TranscriptionResult): void {
    if (global.mainWindow) {
      global.mainWindow.webContents.send('transcription-completed', { taskId, result });
    }
  }

  private emitTaskFailed(taskId: string, error: string): void {
    if (global.mainWindow) {
      global.mainWindow.webContents.send('transcription-failed', { taskId, error });
    }
  }
}
```

## 资源监控

### 系统资源监控器
```typescript
// src/main/services/ResourceMonitor.ts
interface ResourceUsage {
  memory: number; // MB
  cpu: number; // percentage
  disk: number; // MB
}

class ResourceMonitor {
  private usageHistory: ResourceUsage[] = [];
  private readonly maxHistorySize = 60; // 保存60个数据点

  async getCurrentUsage(): Promise<ResourceUsage> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = await this.getCPUUsage();

    const usage: ResourceUsage = {
      memory: Math.round(memoryUsage.heapUsed / 1024 / 1024), // 转换为MB
      cpu: cpuUsage,
      disk: await this.getDiskUsage(),
    };

    // 添加到历史记录
    this.usageHistory.push(usage);
    if (this.usageHistory.length > this.maxHistorySize) {
      this.usageHistory.shift();
    }

    return usage;
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise(resolve => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = process.hrtime(startTime);

        const totalTime = currentTime[0] * 1e6 + currentTime[1] / 1e3; // 转换为微秒
        const totalCpu = currentUsage.user + currentUsage.system;

        const cpuPercent = (totalCpu / totalTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  private async getDiskUsage(): Promise<number> {
    try {
      const tempDir = path.join(os.tmpdir(), 'easypod-audio');
      const stats = await fs.stat(tempDir);
      return Math.round(stats.size / 1024 / 1024);
    } catch {
      return 0;
    }
  }

  getAverageUsage(minutes: number = 5): ResourceUsage {
    const dataPoints = Math.min(minutes, this.usageHistory.length);
    const recentUsage = this.usageHistory.slice(-dataPoints);

    if (recentUsage.length === 0) {
      return { memory: 0, cpu: 0, disk: 0 };
    }

    const sum = recentUsage.reduce(
      (acc, usage) => ({
        memory: acc.memory + usage.memory,
        cpu: acc.cpu + usage.cpu,
        disk: acc.disk + usage.disk,
      }),
      { memory: 0, cpu: 0, disk: 0 }
    );

    return {
      memory: Math.round(sum.memory / recentUsage.length),
      cpu: Math.round(sum.cpu / recentUsage.length),
      disk: Math.round(sum.disk / recentUsage.length),
    };
  }

  detectMemoryLeak(): boolean {
    if (this.usageHistory.length < 10) return false;

    const recent = this.usageHistory.slice(-10);
    const trend = this.calculateTrend(recent.map(r => r.memory));

    // 如果内存使用持续上升且斜率大于阈值，可能存在内存泄漏
    return trend > 5; // 每分钟增长5MB
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = values.reduce((sum, _, x) => sum + x * x, 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    } else {
      console.warn('Garbage collection not available');
    }
  }
}
```

## 性能测试套件

### 长音频测试
```typescript
// src/test/performance/long-audio.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { TranscriptionScheduler } from '@/main/services/TranscriptionScheduler';
import { ResourceMonitor } from '@/main/services/ResourceMonitor';
import { generateTestAudio } from '@test/utils/audioGenerator';

describe('Long Audio Performance Tests', () => {
  let scheduler: TranscriptionScheduler;
  let monitor: ResourceMonitor;

  beforeAll(async () => {
    scheduler = new TranscriptionScheduler({
      maxConcurrentTasks: 2,
      maxMemoryUsage: 2048, // 2GB
      maxCpuUsage: 80,
      taskTimeout: 240, // 4 hours
    });

    monitor = new ResourceMonitor();
  });

  afterAll(async () => {
    // 清理测试文件
  });

  test('processes 2-hour audio within memory limits', async () => {
    const audioPath = await generateTestAudio({
      duration: 7200, // 2 hours
      sampleRate: 44100,
      channels: 1,
    });

    const initialUsage = await monitor.getCurrentUsage();

    const taskId = scheduler.addTask(
      'test-episode-2h',
      audioPath,
      {
        enableDiarization: true,
        chunkSize: 30000,
      }
    );

    // 监控任务执行过程中的资源使用
    const monitoringInterval = setInterval(async () => {
      const usage = await monitor.getCurrentUsage();
      expect(usage.memory).toBeLessThan(2048); // 不超过2GB
      expect(usage.cpu).toBeLessThan(95); // CPU使用率不超过95%

      // 检查内存泄漏
      expect(monitor.detectMemoryLeak()).toBe(false);
    }, 30000); // 每30秒检查一次

    // 等待任务完成
    await new Promise<void>((resolve, reject) => {
      const checkTask = () => {
        const task = scheduler.getTask(taskId);
        if (task?.status === 'completed') {
          clearInterval(monitoringInterval);
          resolve();
        } else if (task?.status === 'failed') {
          clearInterval(monitoringInterval);
          reject(new Error(task.error || 'Task failed'));
        } else {
          setTimeout(checkTask, 5000);
        }
      };
      checkTask();
    });

    const task = scheduler.getTask(taskId);
    expect(task?.status).toBe('completed');
    expect(task?.result).toBeDefined();

    // 验证结果质量
    const result = task!.result!;
    expect(result.segments).toBeDefined();
    expect(result.segments!.length).toBeGreaterThan(100); // 至少100个片段

    // 验证内存使用回到合理范围
    const finalUsage = await monitor.getCurrentUsage();
    expect(finalUsage.memory - initialUsage.memory).toBeLessThan(500); // 增长不超过500MB
  }, 300000); // 5分钟超时

  test('handles concurrent transcription tasks', async () => {
    const audioFiles = await Promise.all([
      generateTestAudio({ duration: 1800 }), // 30分钟
      generateTestAudio({ duration: 3600 }), // 1小时
      generateTestAudio({ duration: 2400 }), // 40分钟
    ]);

    const taskIds = audioFiles.map((audioPath, index) =>
      scheduler.addTask(
        `concurrent-test-${index}`,
        audioPath,
        { enableDiarization: true }
      )
    );

    let completedTasks = 0;
    const maxMemoryUsage = { value: 0 };

    // 监控并发执行
    const monitoringInterval = setInterval(async () => {
      const usage = await monitor.getCurrentUsage();
      maxMemoryUsage.value = Math.max(maxMemoryUsage.value, usage.memory);

      const status = scheduler.getQueueStatus();
      expect(status.processing).toBeLessThanOrEqual(2); // 不超过并发限制

      // 统计完成的任务
      completedTasks = taskIds.filter(id => {
        const task = scheduler.getTask(id);
        return task?.status === 'completed';
      }).length;
    }, 10000);

    // 等待所有任务完成
    await new Promise<void>((resolve) => {
      const checkCompletion = () => {
        if (completedTasks === taskIds.length) {
          clearInterval(monitoringInterval);
          resolve();
        } else {
          setTimeout(checkCompletion, 5000);
        }
      };
      checkCompletion();
    });

    // 验证所有任务都成功完成
    taskIds.forEach(taskId => {
      const task = scheduler.getTask(taskId);
      expect(task?.status).toBe('completed');
      expect(task?.result).toBeDefined();
    });

    // 验证内存使用合理
    expect(maxMemoryUsage.value).toBeLessThan(3072); // 不超过3GB
  }, 600000); // 10分钟超时
});
```

## UI性能优化

### 字幕渲染优化
```typescript
// src/renderer/hooks/useVirtualizedTranscript.ts
interface VirtualizedTranscriptOptions {
  itemHeight: number;
  overscan: number;
  containerHeight: number;
}

export const useVirtualizedTranscript = (
  segments: TranscriptSegment[],
  currentTime: number,
  options: VirtualizedTranscriptOptions
) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // 计算可见范围
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / options.itemHeight);
    const end = Math.min(
      segments.length,
      start + Math.ceil(options.containerHeight / options.itemHeight) + options.overscan
    );

    return {
      start: Math.max(0, start - options.overscan),
      end,
    };
  }, [scrollTop, segments.length, options]);

  // 找到当前播放的片段
  const currentSegmentIndex = useMemo(() => {
    return segments.findIndex(
      segment => currentTime >= segment.start && currentTime < segment.end
    );
  }, [segments, currentTime]);

  // 自动滚动到当前片段
  useEffect(() => {
    if (!isUserScrolling && currentSegmentIndex >= 0) {
      const targetScrollTop = currentSegmentIndex * options.itemHeight;
      const currentViewTop = scrollTop;
      const currentViewBottom = scrollTop + options.containerHeight;

      // 只有当前片段不在可视区域时才滚动
      if (targetScrollTop < currentViewTop || targetScrollTop > currentViewBottom) {
        setScrollTop(targetScrollTop - options.containerHeight / 2);
      }
    }
  }, [currentSegmentIndex, isUserScrolling, options]);

  // 处理用户滚动
  const handleScroll = useCallback((newScrollTop: number) => {
    setScrollTop(newScrollTop);
    setIsUserScrolling(true);

    // 5秒后重新启用自动滚动
    debounce(() => setIsUserScrolling(false), 5000)();
  }, []);

  // 获取可见的片段
  const visibleSegments = useMemo(() => {
    return segments.slice(visibleRange.start, visibleRange.end).map((segment, index) => ({
      ...segment,
      virtualIndex: visibleRange.start + index,
      isActive: visibleRange.start + index === currentSegmentIndex,
    }));
  }, [segments, visibleRange, currentSegmentIndex]);

  return {
    visibleSegments,
    totalHeight: segments.length * options.itemHeight,
    scrollTop,
    onScroll: handleScroll,
    currentSegmentIndex,
  };
};
```

## 相关文件
- `src/main/services/TranscriptionScheduler.ts` - 任务调度器
- `src/main/services/ResourceMonitor.ts` - 资源监控
- `src/test/performance/` - 性能测试目录
- `src/renderer/hooks/useVirtualizedTranscript.ts` - 虚拟化优化
- `src/main/utils/performanceOptimizer.ts` - 性能优化工具

## 后续任务依赖
- task_stage4_ai_provider_abstraction
- task_stage5_end_to_end_testing