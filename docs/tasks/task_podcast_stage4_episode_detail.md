# 任务:Episode详情页面

## 任务信息
- **阶段**: 4 - 增强播放功能
- **估时**: 16小时
- **优先级**: 高
- **依赖**: task_podcast_stage3_episodes_list

## 任务目标
实现完整的Episode详情页面,包括三栏布局、Show Notes渲染、章节列表、转写字幕和AI摘要展示,提供丰富的内容浏览体验。

## 具体任务

### 1. 页面布局和结构 (4小时)
   - 三栏响应式布局:
     - 左栏:封面和操作按钮(固定280px)
     - 中栏:标题、元信息、Show Notes、章节列表(主内容区)
     - 右栏:转写/AI摘要Tab切换(可折叠,320px)
   - 窗口宽度 < 1024px时右栏折叠为抽屉
   - 返回按钮和面包屑导航

### 2. 左栏:封面和操作 (2小时)
   - 大尺寸Episode封面
   - 播放/暂停按钮(大按钮)
   - 添加到队列按钮
   - 分享按钮(复制链接)
   - 下载按钮(离线下载)
   - 播客名称(可点击跳转)

### 3. 中栏:内容展示 (6小时)
   - **标题和元信息**:
     - Episode标题(大字体)
     - 发布日期、时长、播放状态
     - 播放进度百分比

   - **Show Notes渲染**:
     - HTML安全渲染(sanitize-html)
     - 时间戳链接识别(`00:12:34`或`12:34`格式)
     - 点击时间戳跳转播放
     - 外部链接在新窗口打开
     - 样式美化(字体、行距、链接颜色)

   - **章节列表**:
     - 章节标题和时间戳
     - 点击章节跳转播放
     - 当前播放章节高亮
     - 章节图片(如有)
     - 展开/折叠功能

### 4. 右栏:转写和AI摘要 (4小时)
   - **Tab切换**:
     - 转写Tab
     - AI摘要Tab

   - **转写Tab**:
     - 按说话人分段显示
     - 播放时自动滚动并高亮当前行
     - 点击字幕行跳转音频
     - 显示时间戳
     - 空状态:"尚未转写"提示和转写按钮

   - **AI摘要Tab**:
     - 显示AI生成的总结内容
     - 结构化展示:要点/金句/行动项
     - 重新生成按钮
     - 复制到剪贴板按钮
     - 空状态:"尚未生成"提示和生成按钮

## 验收标准
- [ ] 详情页正确显示episode所有信息
- [ ] Show Notes HTML渲染安全(无XSS风险)
- [ ] 时间戳链接点击后音频正确跳转(误差< 1秒)
- [ ] 章节列表点击跳转准确
- [ ] 转写字幕与音频同步高亮(误差±500ms)
- [ ] AI摘要正确加载和显示
- [ ] 响应式布局在不同窗口尺寸下正常工作
- [ ] 页面加载速度 < 1秒

## 技术实现

### 关键技术点
- 使用sanitize-html安全渲染HTML
- 正则表达式识别时间戳链接:`/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/g`
- 使用IntersectionObserver实现字幕滚动
- CSS Grid实现响应式三栏布局
- React.memo优化性能

### 时间戳解析示例
```typescript
// 支持格式: 00:12:34 或 12:34
const timestampRegex = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/g;

function parseTimestamps(text: string): string {
  return text.replace(timestampRegex, (match, hours, minutes, seconds) => {
    const totalSeconds =
      (parseInt(hours || '0') * 3600) +
      (parseInt(minutes) * 60) +
      parseInt(seconds);

    return `<a href="#" class="timestamp-link" data-seconds="${totalSeconds}">${match}</a>`;
  });
}
```

## 相关文件
- `src/renderer/pages/EpisodeDetailPage.tsx`
- `src/renderer/components/Episode/ShowNotes.tsx`
- `src/renderer/components/Episode/ChaptersList.tsx`
- `src/renderer/components/Transcript/TranscriptPanel.tsx`
- `src/renderer/components/AI/AISummaryPanel.tsx`
- `src/renderer/utils/timestampParser.ts`
- `src/renderer/hooks/useEpisodeDetail.ts`

## 后续任务依赖
- task_podcast_stage4_playback_queue