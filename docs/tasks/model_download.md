# 重构 FunASR 的模型下载

## 背景

当前在使用 Transcript 转换的的功能中，提供了 FunASR 和 Aliyun 。其中 FunASR 涉及到使用 python runtime，funasr_service.py 提供了初始化 FastAPI 的能力。但是在 FunASR 使用过程中，是利用了 AutoModel 构造函数的能力来初始化的 Model。这样会导致首次提交音频的时候，因为下载模型需要大量的时间。接口会超时，调整超时时长不可靠。

## 需求

改造 TranscriptSettings:

- 去掉「使用默认模型路径」
- 增加模型状态样式，参考 Python Runtime 初始化的样式
- 模型下载状态存储在 transcript_settings 中, service=funasr
- 无论模型状态是什么，都提供重新下载按钮

模型来源：TranscriptConfigManager#getDefaultFunASRModels 获取 4 个模型 id
下载方式：在 funasr_service.py 中提供新的端点下载，直接调用 modelscope 的 snapshot_download 方法，查看文档：

https://github.com/modelscope/modelscope/blob/b4c9418dd9f133974e0afacf698033beac30a899/modelscope/hub/snapshot_download.py#L33

文档中提供了 progress_callbacks，我希望能通过这个扩展展示模型下载的控制条。下载完成后，更新模型id对应的下载状态。

## 依赖

Python Runtime 必须已就绪才能调用模型下载
AI Transcript 功能如果选中的是 FunASR，必须 Python Runtime 和模型都下载完成才能点击，否则需要引导到设置页
