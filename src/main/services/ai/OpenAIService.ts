import OpenAI from "openai";
import type {
  AIService,
  AIServiceConfig,
  SummaryResponse,
  ChapterLLMResponse,
  MindmapResponse,
  TokenUsage,
} from "./types";

export class OpenAIService implements AIService {
  private client: OpenAI;
  private config: AIServiceConfig;
  public lastTokenUsage: TokenUsage | null = null;

  constructor(config: AIServiceConfig) {
    this.config = config;
    console.log(
      "[OpenAIService] Initialized",
      JSON.stringify({
        baseUrl: config.baseUrl ?? "default",
        model: config.model,
      }),
    );
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30000,
      defaultHeaders: config.headers,
    });
  }

  private async callAPI(
    systemPrompt: string,
    userPrompt: string,
    transcript: string,
  ): Promise<any> {
    console.log(
      "[OpenAIService] callAPI invoked",
      JSON.stringify({
        model: this.config.model,
        promptLength: transcript.length,
      }),
    );
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${userPrompt}\n\nInput：\n${transcript}` },
      ],
      response_format: { type: "json_object" },
      temperature: 1,
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
      throw new Error("AI 返回内容为空");
    }

    return JSON.parse(content);
  }

  async getSummary(
    transcript: string,
    customPrompt?: string,
  ): Promise<SummaryResponse> {
    console.log(
      "[OpenAIService] getSummary called",
      JSON.stringify({
        transcriptLength: transcript.length,
        hasCustomPrompt: Boolean(customPrompt),
      }),
    );
    const systemPrompt = "你是一个专业的播客内容分析助手。";
    const userPrompt =
      '请总结以下播客内容的核心观点、金句和行动建议，并生成 5-10 个相关标签。返回 JSON 格式：{"summary": "总结内容", "tags": ["标签1", "标签2"]}';

    return await this.callAPI(systemPrompt, userPrompt, transcript);
  }

  async getChapters(
    transcript: string,
    customPrompt?: string,
  ): Promise<ChapterLLMResponse> {
    const systemPrompt = `
你是“EasyPod AI”的章节编辑助手，负责将播客逐段转录摘要为结构化章节。请严格遵循指令，仅输出合法 JSON。
`.trim();

    const baseUserPrompt = `
【输入说明】
- 输入是一个 JSON 对象：
  {
    "segmentsCount": <整数>,
    "segments": [
      { "id": <1-based整数>, "text": "<该片段文本>", "spk": <0-based发言人编号> },
      ...
    ]
  }
- segments 已按时间顺序排序；系统会根据 id 映射真实时间，你无需推算时间。
- 文本可能包含主持人、嘉宾、转场或广告，请综合语义拆分章节。
- 发言人数量只有 1 人(spk 始终只有 0)，总结主语可以忽略
- 多人发言时总结需要注意注意不要搞错，避免把别人的经历冠在某人身上，可以用（嘉宾）来泛指

【输出要求】
- 仅输出以下结构的 JSON，字段齐全且不得新增其他键：
{
  "totalChapters": <整数>,
  "detectedTime": "__FILL_BY_SYSTEM__",
  "chapters": [
    {
      "start": <整数id>,
      "summary": "<≤50字标题>",
      "content": "<≥140字详细内容>"
    }
  ]
}
- "start" 必须是输入 segments 中的 id，且按升序排列。
- "summary" 为不超过 50 字的精炼标题。
- "content" ≥140 字，完整描述该章节的主题、核心论点、关键细节、结论或启示，语句自然流畅，禁止空话与重复。
- 章节数量应与播客逻辑匹配：通常 5-15 章。如内容特别长，可达 30 章；如内容极短，可少于 5 章，但需给出完整覆盖。

【写作建议】
- 优先结合话题转折、主持人提问、嘉宾观点切换等语义界标来划分章节。
- 保持事实准确，禁止编造信息；必要时引用原文关键词辅助说明。
- 若仅看到片段或存在信息缺失，需在相关章节末尾注明“（基于部分转录）”。

【输出自检】
- JSON 严格可解析；无多余文本、注释或解释。
- 章节按 start 升序排列，且总数与 totalChapters 一致。
- 每个章节的 summary、content 不得为空；content ≥140 字。
`.trim();

    const userPrompt = customPrompt
      ? `${baseUserPrompt}\n\n【额外指令】\n${customPrompt}`
      : baseUserPrompt;

    console.log(
      "[OpenAIService] getChapters called",
      JSON.stringify({
        transcriptLength: transcript.length,
        hasCustomPrompt: Boolean(customPrompt),
      }),
    );
    return await this.callAPI(systemPrompt, userPrompt, transcript);
  }

  async getMindmap(
    transcript: string,
    customPrompt?: string,
  ): Promise<MindmapResponse> {
    console.log(
      "[OpenAIService] getMindmap called",
      JSON.stringify({
        transcriptLength: transcript.length,
        hasCustomPrompt: Boolean(customPrompt),
      }),
    );
    const systemPrompt = "你是一个专业的播客内容分析助手。";
    const userPrompt =
      customPrompt ||
      '请将以下播客内容整理为 Markdown 格式的思维导图。返回 JSON 格式：{"mindmap": "# 主题\\n## 子主题"}';

    return await this.callAPI(systemPrompt, userPrompt, transcript);
  }
}
