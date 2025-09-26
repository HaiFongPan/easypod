# 任务：SQLite数据库设计

## 任务信息
- **阶段**: 1 - 核心基础设施
- **估时**: 12小时
- **优先级**: 高
- **依赖**: task_stage1_electron_init

## 任务目标
设计并实现完整的数据库架构，支持播客订阅、转写、AI分析等核心功能的数据存储。

## 具体任务
1. **数据库表结构设计**
   - feeds表：播客订阅源信息
   - episodes表：单集信息和播放状态
   - chapters表：章节信息(支持多来源)
   - transcripts表：转写任务和结果
   - transcript_segments表：转写片段详情
   - ai_tasks表：AI任务记录
   - ai_prompts表：Prompt模板管理
   - exports表：导出任务记录

2. **better-sqlite3和Drizzle ORM集成**
   - 安装配置better-sqlite3数据库驱动
   - 集成Drizzle ORM和查询构建器
   - 配置数据库迁移系统
   - 实现数据库连接池和事务管理

3. **基础CRUD操作实现**
   - 实现每个表的增删改查操作
   - 创建数据访问层(DAO)抽象
   - 实现批量操作和事务支持
   - 添加数据验证和约束检查

4. **FTS5全文搜索配置**
   - 创建全文搜索虚拟表
   - 配置搜索字段索引(标题、描述、转写文本)
   - 实现搜索查询和结果排序
   - 优化搜索性能和相关性

## 验收标准
- [ ] 数据库表创建和迁移正常
- [ ] 所有表的CRUD操作功能完整
- [ ] 全文搜索准确性≥90%
- [ ] 数据库查询性能P95≤50ms
- [ ] 事务回滚和数据完整性保证
- [ ] 数据库文件大小合理控制

## 数据库表设计详情

### feeds表
```sql
CREATE TABLE feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  cover_url TEXT,
  description TEXT,
  last_checked_at DATETIME,
  opml_group TEXT,
  meta_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### episodes表
```sql
CREATE TABLE episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id INTEGER NOT NULL,
  guid TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description_html TEXT,
  audio_url TEXT NOT NULL,
  pub_date DATETIME,
  duration_sec INTEGER,
  episode_image_url TEXT,
  local_audio_path TEXT,
  status TEXT DEFAULT 'new', -- new|in_progress|played|archived
  last_played_at DATETIME,
  last_position_sec INTEGER DEFAULT 0,
  meta_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
);
```

### FTS5搜索表
```sql
CREATE VIRTUAL TABLE search_index USING fts5(
  title,
  description,
  transcript_text,
  ai_summary,
  content='episodes',
  content_rowid='id'
);
```

## 技术要点
- 使用WAL模式提高并发性能
- 实现数据库备份和恢复机制
- 配置适当的SQLite pragmas优化
- 支持数据库版本升级和迁移
- 实现数据库文件压缩和清理

## 性能优化
- 为常用查询字段添加索引
- 使用预编译语句提高查询效率
- 实现查询结果缓存机制
- 配置合适的页面大小和缓存大小
- 定期执行VACUUM清理

## 相关文件
- `src/main/database/schema.ts` - 数据库表定义
- `src/main/database/connection.ts` - 数据库连接管理
- `src/main/database/dao/` - 数据访问对象
- `src/main/database/migrations/` - 数据库迁移文件
- `drizzle.config.ts` - Drizzle ORM配置

## 后续任务依赖
- task_stage2_rss_parsing
- task_stage3_transcript_storage
- task_stage4_ai_task_management