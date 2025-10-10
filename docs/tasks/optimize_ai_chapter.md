优化 generateChapter

现在 AIServiceManager.generateChapters 中，使用了

      const input = {
        segments: simplifiedSusbtitle,
        meta: {
          audio_duration_ms:
            simplifiedSusbtitle[simplifiedSusbtitle.length - 1]["end"],
        },
      };

转换成：

```
{
  "segmentsCount": 200,
  "segments": [
    {"id": 1, "text": "开场音乐与主持人问好"},
    {"id": 2, "text": "嘉宾自我介绍..."},
    ...
  ]
}

```

让 LLM 输出返回的 ChapterResponses

```
{
"totalChapters": <整数>,
"detectedTime": "__FILL_BY_SYSTEM__",
"chapters": [
 {
   "start": <整数序号>,
   "summary": "<≤50字标题>",
   "content": "<≥140字详细内容>"
 }
]
}

```

- id 为 simplifiedSusbtitle 的数组编号
- 在内存中记录 id 和 start time 的映射
- 将新的返回结果 ChapterResponses 转换成 ChapterResponse, 时间通过 id 映射, end 不需要了，summary = concat(summary,":",context)，再更新入库
