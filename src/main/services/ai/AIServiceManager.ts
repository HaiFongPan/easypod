import { OpenAIService } from "./OpenAIService";
import { LlmProvidersDao } from "../../database/dao/llmProvidersDao";
import { LlmModelsDao } from "../../database/dao/llmModelsDao";
import { PromptsDao } from "../../database/dao/promptsDao";
import { EpisodeAiSummarysDao } from "../../database/dao/episodeAiSummarysDao";
import { EpisodeTranscriptsDao } from "../../database/dao/episodeTranscriptsDao";
import type {
  AIService,
  SummaryResponse,
  ChapterResponse,
  MindmapResponse,
} from "./types";

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
        ({ text, start, end }) => ({ text, start, end }),
      );
      const transcriptText = JSON.stringify(simplifiedSusbtitle);
      const result = await service.getChapters(transcriptText, chaptersPrompt);

      const tokenUsage =
        (service as OpenAIService).lastTokenUsage?.totalTokens ?? 0;
      await this.providersDao.incrementTokenUsage(providerId, tokenUsage);
      await this.modelsDao.incrementTokenUsage(modelId, tokenUsage);

      // Save chapters
      const existing = await this.summariesDao.findByEpisode(episodeId);
      if (existing) {
        await this.summariesDao.update(episodeId, {
          chapters: JSON.stringify(result.chapters),
        });
      } else {
        await this.summariesDao.create({
          episodeId,
          summary: "",
          tags: "",
          chapters: JSON.stringify(result.chapters),
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

      return {
        success: true,
        data: {
          summary: summary.summary,
          tags: summary.tags.split(",").filter((t) => t.trim()),
          chapters: JSON.parse(summary.chapters),
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
