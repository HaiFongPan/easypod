/**
 * AI Task Status Cache
 *
 * 内存级别的 AI 任务状态缓存，用于追踪任务执行状态、防止重复提交。
 * 特性：
 * - 纯内存缓存，轻量高效
 * - 支持跨页面状态追踪
 * - 防止重复提交
 * - 错误信息持久化
 */

export type AITaskStatus = "processing" | "success" | "failed";
export type AITaskType = "insights" | "mindmap";

export interface AITaskCacheEntry {
  episodeId: number;
  taskType: AITaskType;
  status: AITaskStatus;
  startTime: number;
  endTime?: number;
  error?: string;
  tokenUsage?: number;
}

export class AITaskCache {
  private cache: Map<string, AITaskCacheEntry> = new Map();

  /**
   * 生成缓存键
   */
  private getKey(episodeId: number, taskType: AITaskType): string {
    return `${episodeId}-${taskType}`;
  }

  /**
   * 检查任务是否正在处理中
   */
  isProcessing(episodeId: number, taskType: AITaskType): boolean {
    const entry = this.cache.get(this.getKey(episodeId, taskType));
    return entry?.status === "processing";
  }

  /**
   * 标记任务开始处理
   * @returns 如果任务已在处理中则返回 false，否则标记成功并返回 true
   */
  markProcessing(episodeId: number, taskType: AITaskType): boolean {
    const key = this.getKey(episodeId, taskType);

    // 如果已经在处理中，拒绝重复提交
    if (this.isProcessing(episodeId, taskType)) {
      console.warn(
        `[AITaskCache] Task already processing: episodeId=${episodeId}, taskType=${taskType}`,
      );
      return false;
    }

    const entry: AITaskCacheEntry = {
      episodeId,
      taskType,
      status: "processing",
      startTime: Date.now(),
    };

    this.cache.set(key, entry);
    console.log(
      `[AITaskCache] Marked as processing: episodeId=${episodeId}, taskType=${taskType}`,
    );
    return true;
  }

  /**
   * 标记任务成功完成
   */
  markSuccess(
    episodeId: number,
    taskType: AITaskType,
    tokenUsage?: number,
  ): void {
    const key = this.getKey(episodeId, taskType);
    const existing = this.cache.get(key);

    if (!existing) {
      console.warn(
        `[AITaskCache] Cannot mark success: task not found in cache (episodeId=${episodeId}, taskType=${taskType})`,
      );
      return;
    }

    existing.status = "success";
    existing.endTime = Date.now();
    existing.tokenUsage = tokenUsage;
    existing.error = undefined;

    this.cache.set(key, existing);
    console.log(
      `[AITaskCache] Marked as success: episodeId=${episodeId}, taskType=${taskType}, duration=${existing.endTime - existing.startTime}ms`,
    );
  }

  /**
   * 标记任务失败
   */
  markFailed(episodeId: number, taskType: AITaskType, error: string): void {
    const key = this.getKey(episodeId, taskType);
    const existing = this.cache.get(key);

    if (!existing) {
      console.warn(
        `[AITaskCache] Cannot mark failed: task not found in cache (episodeId=${episodeId}, taskType=${taskType})`,
      );
      return;
    }

    existing.status = "failed";
    existing.endTime = Date.now();
    existing.error = error;

    this.cache.set(key, existing);
    console.error(
      `[AITaskCache] Marked as failed: episodeId=${episodeId}, taskType=${taskType}, error=${error}`,
    );
  }

  /**
   * 获取任务状态
   */
  getStatus(episodeId: number, taskType: AITaskType): AITaskCacheEntry | null {
    const entry = this.cache.get(this.getKey(episodeId, taskType));
    return entry ?? null;
  }

  /**
   * 清除任务状态（允许重新提交）
   */
  clear(episodeId: number, taskType: AITaskType): void {
    const key = this.getKey(episodeId, taskType);
    const deleted = this.cache.delete(key);

    if (deleted) {
      console.log(
        `[AITaskCache] Cleared cache: episodeId=${episodeId}, taskType=${taskType}`,
      );
    }
  }

  /**
   * 清除所有缓存（仅用于测试或调试）
   */
  clearAll(): void {
    this.cache.clear();
    console.log("[AITaskCache] Cleared all cache entries");
  }

  /**
   * 获取缓存统计信息（用于调试）
   */
  getStats(): {
    totalEntries: number;
    processingCount: number;
    successCount: number;
    failedCount: number;
  } {
    const entries = Array.from(this.cache.values());
    return {
      totalEntries: entries.length,
      processingCount: entries.filter((e) => e.status === "processing").length,
      successCount: entries.filter((e) => e.status === "success").length,
      failedCount: entries.filter((e) => e.status === "failed").length,
    };
  }
}

// 单例实例
let instance: AITaskCache | null = null;

/**
 * 获取 AITaskCache 单例
 */
export function getAITaskCache(): AITaskCache {
  if (!instance) {
    instance = new AITaskCache();
    console.log("[AITaskCache] Singleton instance created");
  }
  return instance;
}

/**
 * 重置单例（仅用于测试）
 */
export function resetAITaskCache(): void {
  instance = null;
  console.log("[AITaskCache] Singleton instance reset");
}
