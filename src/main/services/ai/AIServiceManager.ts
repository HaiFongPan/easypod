import { OpenAIService } from "./OpenAIService";
import { LlmProvidersDao } from "../../database/dao/llmProvidersDao";
import { LlmModelsDao } from "../../database/dao/llmModelsDao";
import { PromptsDao } from "../../database/dao/promptsDao";
import { EpisodeAiSummarysDao } from "../../database/dao/episodeAiSummarysDao";
import { EpisodeTranscriptsDao } from "../../database/dao/episodeTranscriptsDao";
import type { AIService, ChapterItem, ChapterResponse } from "./types";

export class AIServiceManager {
  private providersDao: LlmProvidersDao;
  private modelsDao: LlmModelsDao;
  private promptsDao: PromptsDao;
  private summariesDao: EpisodeAiSummarysDao;
  private transcriptsDao: EpisodeTranscriptsDao;

  constructor() {
    this.providersDao = new LlmProvidersDao();
    this.modelsDao = new LlmModelsDao();
    this.promptsDao = new PromptsDao();
    this.summariesDao = new EpisodeAiSummarysDao();
    this.transcriptsDao = new EpisodeTranscriptsDao();
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

  async generateSummary(
    episodeId: number,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Get transcript
      const transcript = await this.transcriptsDao.findByEpisodeId(episodeId);
      if (!transcript) {
        return { success: false, error: "该集未找到转写内容" };
      }

      // Get AI Service and config
      const { service, providerId, modelId } = await this.getDefaultService();

      // Get Prompt
      const summaryPrompt = await this.getPromptByType("summary");

      // Call AI API
      const result = await service.getSummary(transcript.text, summaryPrompt);

      // Record token usage
      const tokenUsage =
        (service as OpenAIService).lastTokenUsage?.totalTokens ?? 0;

      // Update Provider and Model token stats
      await this.providersDao.incrementTokenUsage(providerId, tokenUsage);
      await this.modelsDao.incrementTokenUsage(modelId, tokenUsage);

      // Save result
      const existing = await this.summariesDao.findByEpisode(episodeId);
      if (existing) {
        await this.summariesDao.update(episodeId, {
          summary: result.summary,
          tags: result.tags.join(","),
        });
      } else {
        await this.summariesDao.create({
          episodeId,
          summary: result.summary,
          tags: result.tags.join(","),
          chapters: "[]",
        });
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "生成失败",
      };
    }
  }

  async generateChapters(
    episodeId: number,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const transcript = await this.transcriptsDao.findByEpisodeId(episodeId);
      if (!transcript) {
        return { success: false, error: "该集未找到转写内容" };
      }

      const { service, providerId, modelId } = await this.getDefaultService();
      const chaptersPrompt = await this.getPromptByType("chapters");
      const simplifiedSusbtitle = transcript.subtitles.map(
        ({ text, start, end, spk }) => ({ text, start, end, spk }),
      );
      const idToTiming = new Map<number, { start: number; end: number }>();
      const segmentsForLLM = simplifiedSusbtitle.map((segment, index) => {
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
      };

      const transcriptText = JSON.stringify(inputPayload);
      const rawResult = await service.getChapters(
        transcriptText,
        chaptersPrompt,
      );

      if (
        !rawResult ||
        !Array.isArray(rawResult.chapters) ||
        rawResult.chapters.length === 0
      ) {
        throw new Error("AI 未返回有效的章节结果");
      }

      const chapters = rawResult.chapters
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
        throw new Error("章节数据为空，无法保存");
      }

      const result: ChapterResponse = {
        totalChapters: Number.isFinite(rawResult.totalChapters)
          ? Number(rawResult.totalChapters)
          : chapters.length,
        detectedTime:
          typeof rawResult.detectedTime === "string" &&
          rawResult.detectedTime !== "__FILL_BY_SYSTEM__"
            ? rawResult.detectedTime
            : new Date().toISOString(),
        chapters,
      };

      const tokenUsage =
        (service as OpenAIService).lastTokenUsage?.totalTokens ?? 0;
      await this.providersDao.incrementTokenUsage(providerId, tokenUsage);
      await this.modelsDao.incrementTokenUsage(modelId, tokenUsage);

      // Save chapters
      const existing = await this.summariesDao.findByEpisode(episodeId);
      if (existing) {
        await this.summariesDao.update(episodeId, {
          chapters: JSON.stringify(result),
        });
      } else {
        await this.summariesDao.create({
          episodeId,
          summary: "",
          tags: "",
          chapters: JSON.stringify(result),
        });
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "生成失败",
      };
    }
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
