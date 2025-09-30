# 任务:数据持久化集成

## 任务信息
- **阶段**: 3 - 核心播放功能增强
- **估时**: 12小时
- **优先级**: 高
- **依赖**: task_stage1_sqlite_database, task_stage2_rss_parsing

## 任务目标
实现订阅和Episode数据的完整持久化,建立RSS数据与数据库之间的同步机制,确保应用重启后数据正确恢复。

## 具体任务

### 1. Feeds数据持久化 (4小时)
   - 实现 feedsDao.ts 数据访问层
   - 添加订阅时写入 feeds 表
   - 支持订阅元数据更新(封面、描述、最后检查时间)
   - 实现订阅删除的级联处理(删除相关episodes)
   - 从数据库加载订阅列表到UI

### 2. Episodes数据持久化 (5小时)
   - 实现 episodesDao.ts 数据访问层
   - RSS刷新后批量插入episodes
   - 基于GUID的去重机制
   - Episode图片优先级处理(episodeImageUrl > feed coverUrl)
   - 状态字段初始化(new/in_progress/played/archived)
   - 支持按feedId、status、pubDate查询

### 3. 数据同步机制 (2小时)
   - RSS刷新后触发数据库更新
   - 增量更新策略(仅添加新episodes)
   - 更新 feeds.lastCheckedAt 时间戳
   - 处理feed更新时的封面和元数据变更
   - 错误处理和事务回滚

### 4. IPC接口实现 (1小时)
   - `feeds:create` - 创建订阅
   - `feeds:getAll` - 获取所有订阅
   - `feeds:update` - 更新订阅
   - `feeds:delete` - 删除订阅
   - `episodes:getByFeed` - 获取指定feed的episodes
   - `episodes:getAll` - 获取所有episodes(支持筛选)

## 验收标准
- [ ] 添加订阅后数据库中存在对应feed记录
- [ ] 刷新订阅后episodes表正确填充所有单集
- [ ] 应用重启后订阅列表从数据库完整恢复
- [ ] Episode GUID去重正常工作,不产生重复记录
- [ ] 删除订阅时相关episodes一并删除
- [ ] 图片优先级逻辑正确(episode > feed)
- [ ] 数据同步时间 < 5秒(50个episodes)

## 技术实现

### 关键技术点
- 使用Drizzle ORM进行类型安全的数据库操作
- 事务处理确保数据一致性
- 批量插入优化性能
- 索引优化查询速度(feedId, guid, pubDate)

### 数据库索引优化
```typescript
// 在 schema.ts 中添加索引
export const episodes = sqliteTable('episodes', {
  // ... 字段定义
}, (table) => ({
  feedIdIdx: index('episodes_feed_id_idx').on(table.feedId),
  guidIdx: uniqueIndex('episodes_guid_idx').on(table.guid),
  pubDateIdx: index('episodes_pub_date_idx').on(table.pubDate),
  statusIdx: index('episodes_status_idx').on(table.status),
}));
```

## 相关文件
- `src/main/database/dao/feedsDao.ts`
- `src/main/database/dao/episodesDao.ts`
- `src/main/database/schema.ts`
- `src/main/services/IPCHandlers.ts`
- `src/main/services/FeedSyncService.ts`

## 后续任务依赖
- task_podcast_stage3_episodes_list
- task_podcast_stage3_playback_state_persistence