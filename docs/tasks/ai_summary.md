# 背景

先阶段已经实现了 voice to text 的功能，能够获取音频的文字稿和带时间、发言人的字幕稿。接下来需要实现基于发言稿的 AI 总结功能。

## 核心目标

- [ ] 通过发言稿总结播客核心想表达的内容
- [ ] 通过发言稿获取播客表达内容的标签
- [ ] 结合 show notes 和发言稿，获取对播客章节的总结方便听者自动跳转
- [ ] 结合 show notes 和发言稿，获取对播客章节的 mindmap

## 技术基础

### LLM SDK 集成

1. 完成 OpenAI 集成，几乎所有的 LLM 模型平台都支持 OpenAI Compatible 模式，使用 OpenAI 的 SDK 最为简单：

```
npm install openai
```

2. 对于存在不同的 LLM Provider，在设置页面提供新的配置功能，支持配置不同的 Provider，并选择使用某一个，Provider 应当存储在 sqlite 中，可选择的配置选项有。

- API Key
- API Host
- Models
  - Model name for UI
  - Model code for API
- Provider Name

### 设计

参考 docs/ai_summary/settings.jsx 的布局，融合 Easypod 的样式放在 Settings 页面

存储数据结构

```sql
create table if not exists llm_provider(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    key TEXT NOT NULL,
    token_usage integer not null default 0,
    is_default boolean default false,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
)

create table if not exists llm_models(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id integer not null, -- foreign key ,delete on cascade
    model text not null,
    token_usage integer not null default 0,
    is_default boolean default false,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
)



```

根据 API 的返回对每次调用做统计，分别包含 model 级别的 token_usage 和 provider 级别的统计

3. 增加 Prompt 配置

prompt 类型

- system: 作为系统级 prompt
- summary: user 级别的 prompt，用于提示获取 summary
- tag: user 级别 prompt，用于提示获取 tag 标签
- chapter: user 级别，用于获取章节总结
- mindmap: user 级别，用于获取脑图

```sql
create table if not exists prompts(
	id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
	type TEXT NOT NULL CHECK(status IN ('system', 'summary', 'tag', 'chapters', 'mindmap')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
)
```

在 llm provider 配置下方增加 Prompt 配置。默认可以不需要配置，使用系统内置（hard code）

### LLM 抽象接口

```tsx
interface AIService {
  getSummary: (prompt: string, transcript: string) => SummaryResponse;

  getChapters: (prompt: string, transcript: string) => ChapterResponse;

  getMindmap: (prompt: string, transcript: string) => MindmapResponse;
}
```

`SummaryResponse`

```json
{
  "summary": "",
  "tags": ["a", "b", "c"]
}
```

`ChapterReponse`

```
{
	"chapters" : [
		{
			"start": 100,
			"end": 6000,
			"summary": "本章节总结"
		}
	]
}
```

`MindmapResponse`:

```
{
	"mindmap": "markdown format"
}
```

这几个接口接受对应类型的 prompt 和字幕，字幕从 episode_transcripts 中获取 subtitles 字段，所有调用 API 的接口都需要返回 json，调用时显示的使用参数

```ts
response_format = {
  type: "json_object",
};
```
