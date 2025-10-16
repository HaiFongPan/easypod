import { OpenAIService } from "./OpenAIService";
import { LlmProvidersDao } from "../../database/dao/llmProvidersDao";
import { LlmModelsDao } from "../../database/dao/llmModelsDao";
import { PromptsDao } from "../../database/dao/promptsDao";
import { EpisodeAiSummarysDao } from "../../database/dao/episodeAiSummarysDao";
import { EpisodeTranscriptsDao } from "../../database/dao/episodeTranscriptsDao";
import { EpisodesDao } from "../../database/dao/episodesDao";
import type { AIService, ChapterItem, ChapterResponse } from "./types";
import { getAITaskCache, type AITaskCacheEntry } from "./AITaskCache";

export class AIServiceManager {
  private providersDao: LlmProvidersDao;
  private modelsDao: LlmModelsDao;
  private promptsDao: PromptsDao;
  private summariesDao: EpisodeAiSummarysDao;
  private transcriptsDao: EpisodeTranscriptsDao;
  private episodesDao: EpisodesDao;

  constructor() {
    this.providersDao = new LlmProvidersDao();
    this.modelsDao = new LlmModelsDao();
    this.promptsDao = new PromptsDao();
    this.summariesDao = new EpisodeAiSummarysDao();
    this.transcriptsDao = new EpisodeTranscriptsDao();
    this.episodesDao = new EpisodesDao();
  }

  private async getDefaultService(): Promise<{
    service: AIService;
    providerId: number;
    modelId: number;
  }> {
    // Get default Provider
    const provider = await this.providersDao.findDefault();
    if (!provider) {
      throw new Error("未配置默认 LLM Provider");
    }

    // Get default Model
    const model = await this.modelsDao.findDefault(provider.id);
    if (!model) {
      throw new Error(`Provider ${provider.name} 未配置默认模型`);
    }

    // Create AI Service
    const service = new OpenAIService({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey || "",
      model: model.code,
      timeout: provider.timeout ?? undefined,
      headers: provider.headersJson
        ? JSON.parse(provider.headersJson)
        : undefined,
    });

    return { service, providerId: provider.id, modelId: model.id };
  }

  private async getPromptByType(type: string): Promise<string> {
    const prompts = await this.promptsDao.findByType(type);
    if (prompts.length === 0) {
      throw new Error(`未找到类型为 ${type} 的 Prompt`);
    }
    // Prefer custom non-builtin prompts
    const customPrompt = prompts.find((p) => !p.isBuiltin);
    return customPrompt ? customPrompt.prompt : prompts[0].prompt;
  }

  async generateInsights(
    episodeId: number,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const taskCache = getAITaskCache();

    // 1. 检查是否已在处理中，防止重复提交
    if (taskCache.isProcessing(episodeId, "insights")) {
      console.warn(
        `[AIServiceManager] Insights task already processing for episode ${episodeId}`,
      );
      return { success: false, error: "任务处理中，请稍后再试" };
    }

    // 2. 标记任务开始
    const marked = taskCache.markProcessing(episodeId, "insights");
    if (!marked) {
      return { success: false, error: "无法启动任务，请稍后重试" };
    }

    try {
      // Get transcript
      const transcript = await this.transcriptsDao.findByEpisodeId(episodeId);
      if (!transcript) {
        taskCache.markFailed(episodeId, "insights", "该集未找到转写内容");
        return { success: false, error: "该集未找到转写内容" };
      }

      // Get episode info (for shownote)
      const episode = await this.episodesDao.findById(episodeId);
      const shownote = episode?.descriptionHtml || "";

      // Get AI Service and config
      const { service, providerId, modelId } = await this.getDefaultService();

      // Prepare transcript for LLM (same as generateChapters)
      const simplifiedSubtitle = transcript.subtitles.map(
        ({ text, start, end, spk }) => ({ text, start, end, spk }),
      );
      const idToTiming = new Map<number, { start: number; end: number }>();
      const segmentsForLLM = simplifiedSubtitle.map((segment, index) => {
        const id = index + 1;
        idToTiming.set(id, {
          start: segment.start,
          end: segment.end,
        });
        return {
          id,
          text: segment.text,
          spk: segment.spk,
        };
      });

      const inputPayload = {
        segmentsCount: segmentsForLLM.length,
        segments: segmentsForLLM,
        shownote: shownote,
      };

      const transcriptText = JSON.stringify(inputPayload);

      // Call AI API with merged prompt
      const rawResult = await service.getInsight(transcriptText);

      // Record token usage
      const tokenUsage =
        (service as OpenAIService).lastTokenUsage?.totalTokens ?? 0;

      // Update Provider and Model token stats
      await this.providersDao.incrementTokenUsage(providerId, tokenUsage);
      await this.modelsDao.incrementTokenUsage(modelId, tokenUsage);

      // Process chapters
      const chapters = rawResult.chapters.chapters
        .map((chapter) => {
          const chapterId = Number(chapter.start);
          if (!Number.isFinite(chapterId)) {
            return null;
          }
          const timing = idToTiming.get(chapterId);
          if (!timing) {
            return null;
          }

          const summary = (chapter.summary || "").trim();
          const content = (chapter.content || "").trim();
          if (!summary || !content) {
            return null;
          }

          return {
            start: timing.start,
            end: timing.end ?? timing.start,
            summary,
            content,
          };
        })
        .filter(
          (
            chapter,
          ): chapter is {
            start: number;
            end: number;
            summary: string;
            content: string;
          } => Boolean(chapter),
        );

      if (chapters.length === 0) {
        const errorMsg = "章节数据为空，无法保存";
        taskCache.markFailed(episodeId, "insights", errorMsg);
        throw new Error(errorMsg);
      }

      const chaptersResult: ChapterResponse = {
        totalChapters: Number.isFinite(rawResult.chapters.totalChapters)
          ? Number(rawResult.chapters.totalChapters)
          : chapters.length,
        detectedTime:
          typeof rawResult.chapters.detectedTime === "string" &&
          rawResult.chapters.detectedTime !== "__FILL_BY_SYSTEM__"
            ? rawResult.chapters.detectedTime
            : new Date().toISOString(),
        chapters,
      };

      // Save result
      const existing = await this.summariesDao.findByEpisode(episodeId);
      if (existing) {
        await this.summariesDao.update(episodeId, {
          summary: rawResult.summary.summary,
          tags: rawResult.summary.tags.join(","),
          chapters: JSON.stringify(chaptersResult),
        });
      } else {
        await this.summariesDao.create({
          episodeId,
          summary: rawResult.summary.summary,
          tags: rawResult.summary.tags.join(","),
          chapters: JSON.stringify(chaptersResult),
        });
      }

      // 3. 标记任务成功
      taskCache.markSuccess(episodeId, "insights", tokenUsage);

      return {
        success: true,
        data: {
          summary: rawResult.summary,
          chapters: chaptersResult,
        },
      };
    } catch (error) {
      // 4. 标记任务失败
      const errorMessage =
        error instanceof Error ? error.message : "生成失败";
      taskCache.markFailed(episodeId, "insights", errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async generateSummary(
    episodeId: number,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Deprecated: Use generateInsights instead
    return this.generateInsights(episodeId);
  }

  async generateChapters(
    episodeId: number,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Deprecated: Use generateInsights instead
    return this.generateInsights(episodeId);
  }

  async getMindmap(
    episodeId: number,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const transcript = await this.transcriptsDao.findByEpisodeId(episodeId);
      if (!transcript) {
        return { success: false, error: "该集未找到转写内容" };
      }

      const { service, providerId, modelId } = await this.getDefaultService();
      const mindmapPrompt = await this.getPromptByType("mindmap");
      const result = await service.getMindmap(transcript.text, mindmapPrompt);

      const tokenUsage =
        (service as OpenAIService).lastTokenUsage?.totalTokens ?? 0;
      await this.providersDao.incrementTokenUsage(providerId, tokenUsage);
      await this.modelsDao.incrementTokenUsage(modelId, tokenUsage);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "生成失败",
      };
    }
  }

  /**
   * 获取 Insights 任务状态
   */
  async getInsightStatus(
    episodeId: number,
  ): Promise<{
    success: boolean;
    status: "idle" | "processing" | "success" | "failed";
    error?: string;
    startTime?: number;
    endTime?: number;
    tokenUsage?: number;
  }> {
    const taskCache = getAITaskCache();
    const entry = taskCache.getStatus(episodeId, "insights");

    if (!entry) {
      return { success: true, status: "idle" };
    }

    return {
      success: true,
      status: entry.status,
      error: entry.error,
      startTime: entry.startTime,
      endTime: entry.endTime,
      tokenUsage: entry.tokenUsage,
    };
  }

  /**
   * 清除 Insights 任务状态（允许重新提交）
   */
  async clearInsightStatus(
    episodeId: number,
  ): Promise<{ success: boolean }> {
    const taskCache = getAITaskCache();
    taskCache.clear(episodeId, "insights");
    return { success: true };
  }

  async getSummary(
    episodeId: number,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const summary = await this.summariesDao.findByEpisode(episodeId);
      if (!summary) {
        return { success: false, error: "该集尚未生成总结" };
      }

      let chapters: ChapterItem[] = [];
      let totalChapters: number | undefined;
      let detectedTime: string | undefined;

      try {
        const parsed = JSON.parse(summary.chapters);
        const normalizeChapter = (chapter: any): ChapterItem | null => {
          if (!chapter || typeof chapter !== "object") {
            return null;
          }

          const start = Number(chapter.start);
          if (!Number.isFinite(start)) {
            return null;
          }

          const endValue = Number(chapter.end);
          const end = Number.isFinite(endValue) ? endValue : start;

          let summaryText =
            typeof chapter.summary === "string" ? chapter.summary.trim() : "";
          if (!summaryText && typeof chapter.title === "string") {
            summaryText = chapter.title.trim();
          }

          let contentText =
            typeof chapter.content === "string" ? chapter.content.trim() : "";

          if (!contentText && summaryText.includes(":")) {
            const delimiterIndex = summaryText.indexOf(":");
            if (delimiterIndex >= 0) {
              const maybeSummary = summaryText.slice(0, delimiterIndex).trim();
              const maybeContent = summaryText.slice(delimiterIndex + 1).trim();
              if (maybeSummary) {
                summaryText = maybeSummary;
              }
              if (maybeContent) {
                contentText = maybeContent;
              }
            }
          }

          if (!summaryText) {
            return null;
          }

          if (!contentText && typeof chapter.description === "string") {
            contentText = chapter.description.trim();
          }

          return {
            start,
            end,
            summary: summaryText,
            content: contentText,
          };
        };

        const extractChapters = (value: any): ChapterItem[] => {
          if (!Array.isArray(value)) {
            return [];
          }
          return value
            .map((item) => normalizeChapter(item))
            .filter((chapter): chapter is ChapterItem => Boolean(chapter));
        };

        if (Array.isArray(parsed)) {
          chapters = extractChapters(parsed);
        } else if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.chapters)
        ) {
          chapters = extractChapters(parsed.chapters);
          if (Number.isFinite(parsed.totalChapters)) {
            totalChapters = Number(parsed.totalChapters);
          }
          if (typeof parsed.detectedTime === "string") {
            detectedTime = parsed.detectedTime;
          }
        }
      } catch (error) {
        console.warn(
          "[AIServiceManager] Failed to parse chapters JSON:",
          error,
        );
      }

      return {
        success: true,
        data: {
          summary: summary.summary,
          tags: summary.tags.split(",").filter((t) => t.trim()),
          chapters,
          totalChapters,
          detectedTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "查询失败",
      };
    }
  }
}
