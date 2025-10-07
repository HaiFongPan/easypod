音频转写字幕功能需要同时支持本地 funasr 和[阿里云 API](https://help.aliyun.com/zh/model-studio/paraformer-recorded-speech-recognition-restful-api?scm=20140722.S_help@@%E6%96%87%E6%A1%A3@@2869541._.ID_help@@%E6%96%87%E6%A1%A3@@2869541-RL_paraformer%E8%AF%AD%E9%9F%B3%E8%AF%86%E5%88%AB-LOC_2024SPAllResult-OR_ser-PAR1_213e012617597549375151217e4a67-V_4-PAR3_o-RE_new6-P0_1-P1_0)

核心目标

1.设计通用的数据库存储2.抽象转写 service

### 字幕转写核心功能

字幕功能基础是将音频文件转写成带时间(timestamp)的文字，在此基础上可以衍生出其他功能：

1. 文字稿
2. 根据文字稿的 summary
3. 根据文字稿生成的 tags
4. 根据带时间的字幕总结出章节和段落
5. 根据文字稿和章节段落又能够解析出脑图
6. 根据文字稿可以作为 ChatBot 的 Context，实现知识问答功能

以此目的，可以这样设计数据库

```sql

create table if not exists episode_voice_text_tasks(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    task_id TEXT NOT NULL,
    output TEXT NOT NULL, -- 任务的产出数据 JSON
    service TEXT NOT NULL, -- 转写服务: funasr, aliyun
    status TEXT NOT NULL DEFAULT 'processing', -- 任务状态，processing / success / failed
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
)

-- episode_voice_text 存储通过 funasr 和 aliyun 转写得到的原始数据，方便复用
CREATE TABLE IF NOT EXISTS episode_voice_texts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    raw_json TEXT NOT NULL,
    service TEXT NOT NULL, -- 转写服务: funasr, aliyun
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
)

create table if not exists episode_transcripts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    subtitles TEXT NOT NULL, -- JSON 格式的字幕内容
    text TEXT NOT NULL, -- 纯文本内容
    speaker_number INTEGER NOT NULL DEFAULT 1, -- 发言人数量
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
)

create table if not exists episode_ai_summarys(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    summary TEXT NOT NULL DEFAULT '', -- AI 总结内容
    tags TEXT NOT NULL DEFAULT '', -- 按英文逗号分割的标签
    chapters TEXT NOT NULL DEFAULT '[]', -- JSON 格式的章节展示
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
)

```

### 关键数据结构

#### service 返回产物

##### funasr

funasr 在执行完完成离线音频转文字后会输出一个 raw json，样例如下

```json

{
    "key": "audio_name",
    "text": "audio text, welcome to my house",
    "timestamp": [
        [110, 615],[5720, 5960], ...
    ],
    "sentence_info": [
        {
            "text": "audio text",
            "start": 110,
            "end": 5960,
            "timestamp": [
                [110, 615],[5720, 5960]
            ],
            "spk":0
        },
        {
            "text": "welcome to my house",
            "start": 11100,
            "end": 22200,
            "timestamp": [
                [11100, 12000],[13000, 16000]...
            ],
            "spk":0
        }
    ]
}

```

解释：

| 字段          | 属性                 | 示例                      | 说明                                        |
| ------------- | -------------------- | ------------------------- | ------------------------------------------- |
| key           | string               | audio name                |                                             |
| text          | string               | audio text ...            | 整个音频文件的转写文字稿                    |
| timestamp     | array                | [[110, 615],[5720, 5960]] | 一组 [x,y] 表示一个词出现的时间，单位是毫秒 |
| sentence_info | array[sentence_info] |                           | 一个 sentence_info 表示一句话的时间轴       |

_sentence_info_

| 字段      | 属性   | 示例                      | 说明                                        |
| --------- | ------ | ------------------------- | ------------------------------------------- |
| text      | string | hello, how are you        | 一个句子                                    |
| start     | int    | 110                       | 句子起始的毫秒                              |
| end       | int    | 5960                      | 句子结束的毫秒                              |
| timestamp | array  | [[110, 615],[5720, 5960]] | 一组 [x,y] 表示一个词出现的时间，单位是毫秒 |
| spk       | int    | 0,1,2,3..                 | 发言人编号                                  |

##### aliyun

阿里云服务需要分三步，示例如下:

1. 提交任务

```bash
# 示例 curl
curl --request POST \
  --url https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription \
  --header 'Authorization: Bearer xxxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --header 'X-DashScope-Async: enable' \
  --data '{
    "model":"paraformer-v2",
    "input":{
        "file_urls":[
            "https://assets.teahour.dev/teahour2_6.mp3"
        ]
    },
    "parameters":{
        "disfluency_removal_enabled":true,
        "timestamp_alignment_enabled": true,
        "language_hints":[
            "zh",
            "en"
        ],
        "diarization_enabled":true,
        "speaker_count": 2
    }
}'

```

提交任务返回:

```json
{
  "output": {
    "task_status": "PENDING",
    "task_id": "c2e5d63b-96e1-4607-bb91-************"
  },
  "request_id": "77ae55ae-be17-97b8-9942--************"
}
```

2. 查询任务

```bash
# 示例 curl
curl --request GET \
  --url https://dashscope.aliyuncs.com/api/v1/tasks/8a6b9cf5-e878-4000-8550-ff135b478e40 \
  --header 'Authorization: Bearer sk-xxxxxxxxxxxxxxxxxxx'
```

查询返回:

> 只有 task_status = 'SUCCEEDED' 才算成功

```json
{
  "request_id": "98913d00-b1af-4125-9aeb-7f935155c4a5",
  "output": {
    "task_id": "8a6b9cf5-e878-4000-8550-ff135b478e40",
    "task_status": "SUCCEEDED",
    "submit_time": "2025-10-07 14:20:42.139",
    "scheduled_time": "2025-10-07 14:20:42.176",
    "end_time": "2025-10-07 14:23:17.647",
    "results": [
      {
        "file_url": "https://assets.teahour.dev/teahour2_6.mp3",
        "transcription_url": "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/prod/paraformer-v2/20251007/14%3A23/215ccc7e-8f38-4351-ae99-4b9769a009c3-1.json?Expires=1759904597&OSSAccessKeyId=LTAI5tQZd8AEcZX6KZV4G8qL&Signature=D8YOpcTk6tQDOdQJFT7LPiqww3s%3D",
        "subtask_status": "SUCCEEDED"
      }
    ],
    "task_metrics": {
      "TOTAL": 1,
      "SUCCEEDED": 1,
      "FAILED": 0
    }
  },
  "usage": {
    "duration": 5559
  }
}
```

3. 获取最终字幕

第二步的 response.output.results[0].transcription_url 是最终返回的字幕文件示例

```json
{
  "file_url": "https://dashscope.oss-cn-beijing.aliyuncs.com/samples/audio/paraformer/hello_world_female2.wav",
  "properties": {
    "audio_format": "pcm_s16le",
    "channels": [0],
    "original_sampling_rate": 16000,
    "original_duration_in_milliseconds": 3834
  },
  "transcripts": [
    {
      "channel_id": 0,
      "content_duration_in_milliseconds": 3720,
      "text": "Hello world, 这里是阿里巴巴语音实验室。", // 所有的文字稿
      "sentences": [
        // 句子
        {
          "begin_time": 100,
          "end_time": 3820,
          "text": "Hello world, 这里是阿里巴巴语音实验室。",
          "sentence_id": 1,
          "speaker_id": 0, //当开启自动说话人分离功能时才会显示该字段
          "words": [
            {
              "begin_time": 100,
              "end_time": 596,
              "text": "Hello ",
              "punctuation": ""
            },
            {
              "begin_time": 596,
              "end_time": 844,
              "text": "world",
              "punctuation": ", "
            }
            // 这里省略其它内容
          ]
        }
      ]
    }
  ]
}
```

#### easypod 处理产物

- episode_transcripts.subtitles
- episode_transcripts.text
- episode_transcripts.speaker_number

1. 需要把 funasr 或者 aliyun 的返回存储到 episode_voice_text_tasks 和 episode_voice_texts 中
   - funasr 结果直接存储到 episode_voice_text_tasks.output 和 episode_voice_texts.raw_json
   - aliyun task_id 存储到 episode_voice_text_tasks.task_id, 状态映射后存储到 status, output 存储查询结果成功或者失败的直，RUNNING 的不存储
   - aliyun response.output.results[0].transcription_url 下载后存储到 episode_voice_texts.raw_json
2. 需要对 raw_json 做二次处理并写入 episode_transcripts
   - funasr sentence_info value -> subtitles, text -> text, speaker_number 取 spk 最大值 + 1
   - aliyun transcripts.sentences 转换成 sentence_info 后 -> subtitles, transcripts.text -> text, speaker_number 取 speaker_id 最大值 + 1

### 抽象 service (伪代码，实现使用 TS)

```
interface VoiceToText {
    TaskInfo submit(audio str);
    TaskInfo query(taskId str);
}
```

- submit 方法提交任务，
  - 直接提交在线的音频，在提交前先测试 url， 如果是 302 则找到真实的音频 url，返回提交信息
  - 任务信息入库
  - funasr 是 python runtime 服务，需要自行实现异步功能
- query 根据任务 ID 查询任务状态
  - funasr 是 python runtime 服务，需要自行实现异步功能，查询到结果后根据规则将结果转换并入库
  - aliyun 查询到 SUCCEEDED 后，下载文件内容并入库

#### 实现功能阶段

- [ ] stage 1 完成 funasr 和 aliyun 的集成
  - funasr 需要支持设置模型: model / vad_model / punt_model / spk_model
  - aliyun 需要支持设置 URL, API KEY
- [ ] stage 2 episode_ai_summarys AI 功能实现
