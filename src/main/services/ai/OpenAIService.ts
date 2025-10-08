import OpenAI from 'openai';
import type {
  AIService,
  AIServiceConfig,
  SummaryResponse,
  ChapterResponse,
  MindmapResponse,
  TokenUsage,
} from './types';

export class OpenAIService implements AIService {
  private client: OpenAI;
  private config: AIServiceConfig;
  public lastTokenUsage: TokenUsage | null = null;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30000,
      defaultHeaders: config.headers,
    });
  }

  private async callAPI(systemPrompt: string, userPrompt: string, transcript: string): Promise<any> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${userPrompt}\n\n播客内容：\n${transcript}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    // Record token usage
    if (response.usage) {
      this.lastTokenUsage = {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      };
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI 返回内容为空');
    }

    return JSON.parse(content);
  }

  async getSummary(transcript: string, customPrompt?: string): Promise<SummaryResponse> {
    const systemPrompt = '你是一个专业的播客内容分析助手。';
    const userPrompt = customPrompt || '请总结以下播客内容的核心观点、金句和行动建议，并生成 5-10 个相关标签。返回 JSON 格式：{"summary": "总结内容", "tags": ["标签1", "标签2"]}';

    return await this.callAPI(systemPrompt, userPrompt, transcript);
  }

  async getChapters(transcript: string, customPrompt?: string): Promise<ChapterResponse> {
    const systemPrompt = '你是一个专业的播客内容分析助手。';
    const userPrompt = customPrompt || '请分析以下播客内容，将其分为若干章节，每个章节包含开始时间（毫秒）、结束时间（毫秒）和总结。返回 JSON 格式：{"chapters": [{"start": 0, "end": 60000, "summary": "章节总结"}]}';

    return await this.callAPI(systemPrompt, userPrompt, transcript);
  }

  async getMindmap(transcript: string, customPrompt?: string): Promise<MindmapResponse> {
    const systemPrompt = '你是一个专业的播客内容分析助手。';
    const userPrompt = customPrompt || '请将以下播客内容整理为 Markdown 格式的思维导图。返回 JSON 格式：{"mindmap": "# 主题\\n## 子主题"}';

    return await this.callAPI(systemPrompt, userPrompt, transcript);
  }
}
