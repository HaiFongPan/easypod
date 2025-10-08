import { getDatabaseManager } from '../connection';
import {
  episodeVoiceTextTasks,
  episodes,
  episodeVoiceTexts,
  episodeTranscripts,
  episodeAiSummarys,
  feeds,
} from '../schema';
import { eq, like, desc, sql } from 'drizzle-orm';

export interface TranscriptTaskWithEpisode {
  id: number;
  episodeId: number;
  taskId: string;
  output: string;
  service: 'funasr' | 'aliyun';
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  createdAt: string;
  updatedAt: string;
  episode: {
    id: number;
    title: string;
    episodeImageUrl: string | null;
    feedId: number;
    coverUrl: string | null; // from feed
  };
}

export class EpisodeVoiceTextTasksDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  /**
   * 查询转写任务列表（分页）
   */
  async findAllWithPagination(
    page: number,
    pageSize: number,
    nameFilter?: string
  ): Promise<{ tasks: TranscriptTaskWithEpisode[]; total: number }> {
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const whereCondition = nameFilter
      ? like(episodes.title, `%${nameFilter}%`)
      : undefined;

    // 查询总数
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(episodeVoiceTextTasks)
      .leftJoin(episodes, eq(episodeVoiceTextTasks.episodeId, episodes.id))
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    // 查询任务列表
    const results = await this.db
      .select({
        id: episodeVoiceTextTasks.id,
        episodeId: episodeVoiceTextTasks.episodeId,
        taskId: episodeVoiceTextTasks.taskId,
        output: episodeVoiceTextTasks.output,
        service: episodeVoiceTextTasks.service,
        status: episodeVoiceTextTasks.status,
        createdAt: episodeVoiceTextTasks.createdAt,
        updatedAt: episodeVoiceTextTasks.updatedAt,
        episodeTitle: episodes.title,
        episodeImageUrl: episodes.episodeImageUrl,
        episodeFeedId: episodes.feedId,
      })
      .from(episodeVoiceTextTasks)
      .leftJoin(episodes, eq(episodeVoiceTextTasks.episodeId, episodes.id))
      .where(whereCondition)
      .orderBy(desc(episodeVoiceTextTasks.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 获取所有涉及的 feed IDs
    const feedIds = [...new Set(results.map((r) => r.episodeFeedId).filter((id): id is number => id !== null))];
    const feedsMap = new Map<number, string | null>();

    if (feedIds.length > 0) {
      const feedsData = await this.db
        .select({ id: feeds.id, coverUrl: feeds.coverUrl })
        .from(feeds)
        .where(sql`${feeds.id} IN (${sql.join(feedIds.map(id => sql`${id}`), sql`, `)})`);

      feedsData.forEach((feed) => {
        feedsMap.set(feed.id, feed.coverUrl);
      });
    }

    // 组装结果
    const tasks: TranscriptTaskWithEpisode[] = results.map((row) => ({
      id: row.id,
      episodeId: row.episodeId,
      taskId: row.taskId,
      output: row.output,
      service: row.service as 'funasr' | 'aliyun',
      status: row.status as 'pending' | 'processing' | 'succeeded' | 'failed',
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || '',
      episode: {
        id: row.episodeId,
        title: row.episodeTitle || 'Unknown Episode',
        episodeImageUrl: row.episodeImageUrl,
        feedId: row.episodeFeedId || 0,
        coverUrl: row.episodeFeedId ? feedsMap.get(row.episodeFeedId) || null : null,
      },
    }));

    return { tasks, total };
  }

  /**
   * 删除指定 episode 的所有转写相关数据
   * 级联删除：episode_voice_text_tasks, episode_voice_texts, episode_transcripts, episode_ai_summarys
   */
  async deleteTasksByEpisodeId(episodeId: number): Promise<void> {
    // 删除 AI 摘要
    await this.db.delete(episodeAiSummarys).where(eq(episodeAiSummarys.episodeId, episodeId));

    // 删除转写文本
    await this.db.delete(episodeTranscripts).where(eq(episodeTranscripts.episodeId, episodeId));

    // 删除原始语音文本
    await this.db.delete(episodeVoiceTexts).where(eq(episodeVoiceTexts.episodeId, episodeId));

    // 删除转写任务
    await this.db.delete(episodeVoiceTextTasks).where(eq(episodeVoiceTextTasks.episodeId, episodeId));
  }

  /**
   * 查询指定 episode 的转写任务
   */
  async findByEpisodeId(episodeId: number): Promise<typeof episodeVoiceTextTasks.$inferSelect | null> {
    const results = await this.db
      .select()
      .from(episodeVoiceTextTasks)
      .where(eq(episodeVoiceTextTasks.episodeId, episodeId))
      .orderBy(desc(episodeVoiceTextTasks.updatedAt))
      .limit(1);

    return results[0] ?? null;
  }
}
