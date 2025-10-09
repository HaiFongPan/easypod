# UI 交互优化

## 首页交互优化

1. Search Podcasts 组件完全移除
2. Categories 修复，现在只展示了 Uncategorized，实际上包含了其他分组
3. Sort: 默认使用 order by last_pub_date desc, feeds 表新增该字段，取最新的 episodes 的值（从 rss 中解析）
4. viewControl 修改，把 list view 修改成 compact grid ，也就是同样时 gride view，但是展示更多的 feeds，至少 6 个，之多 10 个。grid view 使用 lucide icon: grid, compact grid 使用 lucide icon: grid-3x3
5. 定义一种新的颜色 zima blue:Pantone 2985 C，HEX #5BC2E7（RGB 91, 194, 231），页面上所有的蓝色替换为这种蓝色

- Play / Next / Add to End 操作放到最右侧居中，并且增加 Archive 操作, 所有按钮 icon 大小保持一致
- cover 用 24x24

## 设置页交互优化

1. TranscriptSettings 修改成两栏式

## AI 功能优化

- [ ] 进度模拟
- [ ] 可选人声处理的交互
- [ ] 优化模型配置
- [ ] 程序启动后就调用 initialize
- [ ] Chapter 提示词优化

## AudioPlayer 优化

1. PlayQueue 支持拖动排序，复用 Play Queue 页面中的拖动功能
2. 使用新的 zima blue 蓝色

## ~~新功能~~

1. 需要一个新的页面，用于展示 AI 转写任务查看，list 的形式展示: cover / title / task create at /status / operaion
2. 样式参考 All Episodes 页面，但是需要更加紧凑，operation 放最后
3. 数据来源是 episode_voice_text_tasks, episodes 支持分页查询，分页组件可复用 All Episodes
4. 支持按 episode name 过滤

operations：

- 删除，删除 episode_voice_text_tasks / episode_voice_texts / episode_transcripts / episode_ai_summarys 这四张表中关于 episode_id 的记录
- 重试（失败的情况下），icon: rotate-ccw

### Bugs

- remove episode from playqueue if exists, stop playing if it is now playing after archive episode
