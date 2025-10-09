# AI Summary 功能重构增强

EpisodeDetailPage 改动:

1. Play Button 统一使用 PlayPauseButton 组件
2. AI Button 重构，使用 lucide sparkle icon ，独立该组件，点击后：- submitting sparkle 呼吸灯效果 - processing sparkle 旋转效果 - done sparkle 置灰
   同时 AI Button 组件边上增加一个组件 SpeakerRecongnize(Component), 通过 toggle 表示是否增加 Speaker 识别，打开开关显示一个数字输入框，支持1-9的数字。transcript.submit 新增两个接收参数, spk_enable, spk_number_predict 表示人声识别预测打开
   当开关打开时:
   funasr: options.spkModelPath 取配置的 spkModelPath (or defalt), 否则 options.spkModelPath 设置为空或者 nil / null / undefined 等
   aliyun: speakerCount 取 spk_number_predict, diarizationEnabled = true, 否则 speakerCount = 0, diarizationEnabled = false
3. 上面三个组件都放到 publishInfo 下方
4. AI Summary tab 中存在一个 bug，点击 generate chapter，会在顶部展示 Generating AI summary... 而不是在 Chatper 部分展示 Generating AI Chapter
