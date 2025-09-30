# 任务:Episode列表页面

## 任务信息
- **阶段**: 3 - 核心播放功能增强
- **估时**: 14小时
- **优先级**: 高
- **依赖**: task_podcast_stage3_data_persistence

## 任务目标
实现统一的Episode列表页面,展示所有订阅源的最新单集,支持筛选、搜索和虚拟滚动,提供流畅的浏览体验。

## 具体任务

### 1. All Episodes视图组件 (6小时)
   - 创建 EpisodesListPage 主组件
   - 实现 EpisodeCard 卡片组件
   - 按 pubDate DESC 排序显示
   - 封面图优先级逻辑(episode > feed)
   - 显示发布日期(相对时间:今天/昨天/X天前)
   - 显示时长格式化(1:05:32)
   - 播放状态指示器(未播放/进行中/已完成)
   - 播放进度条显示(如已开始播放)

### 2. 交互功能 (4小时)
   - 点击卡片跳转到Episode详情页
   - 悬停显示快捷操作按钮:
     - 播放/暂停按钮
     - 添加到播放队列
     - 标记为已播放/未播放
   - 右键菜单(添加到队列、下载、分享)
   - 加载状态和骨架屏

### 3. 筛选和搜索 (2小时)
   - 状态筛选下拉菜单(全部/未播放/进行中/已完成)
   - 订阅源筛选下拉菜单
   - 实时搜索框(标题和描述)
   - 搜索防抖处理(300ms)
   - 清空筛选按钮

### 4. 虚拟滚动/分页加载 (2小时)
   - 使用 react-virtuoso 实现虚拟滚动
   - 每次加载50条记录
   - 滚动到底部自动加载更多
   - 加载指示器
   - 无更多数据提示

## 验收标准
- [ ] Episode列表正确显示所有订阅的单集
- [ ] 排序按发布日期降序,最新的在最上面
- [ ] 图片优先级逻辑正确(episode > feed > default)
- [ ] 播放状态和进度显示准确
- [ ] 搜索和筛选功能响应时间 < 200ms
- [ ] 支持至少1000+ episodes流畅滚动(60fps)
- [ ] 卡片悬停和点击交互流畅
- [ ] 空状态和错误状态显示友好

## 技术实现

### 关键技术点
- 使用 react-virtuoso 虚拟滚动优化性能
- 使用 Zustand 管理episodes列表状态
- 图片懒加载和缓存
- 搜索防抖优化
- CSS Grid布局实现响应式卡片

### UI布局参考
```
┌─────────────────────────────────────────────┐
│ [搜索框]  [状态筛选▾]  [订阅源筛选▾]         │
├─────────────────────────────────────────────┤
│  ┌──────┐  Episode Title                    │
│  │ IMG  │  Podcast Name • 2h ago • 45:32   │
│  │      │  [=========>        ] 65%        │
│  └──────┘  Brief description...             │
├─────────────────────────────────────────────┤
│  ┌──────┐  Another Episode                  │
│  │ IMG  │  Another Podcast • 1d ago • 1:05:12│
│  └──────┘                                    │
└─────────────────────────────────────────────┘
```

## 相关文件
- `src/renderer/pages/EpisodesListPage.tsx`
- `src/renderer/components/Episode/EpisodeCard.tsx`
- `src/renderer/components/SearchBar.tsx`
- `src/renderer/components/FilterDropdown.tsx`
- `src/renderer/store/episodesStore.ts`
- `src/renderer/utils/formatters.ts`

## 后续任务依赖
- task_podcast_stage4_episode_detail