import { eq } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import {
  transcriptSettings,
  type TranscriptSetting,
  type NewTranscriptSetting,
} from '../schema';

export type ServiceType = 'funasr' | 'aliyun' | 'default';

export class TranscriptSettingsDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  /**
   * Get configuration for a specific service
   */
  async getConfig<T = any>(service: ServiceType): Promise<T | null> {
    const results = await this.db
      .select()
      .from(transcriptSettings)
      .where(eq(transcriptSettings.service, service))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    try {
      return JSON.parse(results[0].configJson) as T;
    } catch (error) {
      console.error(`[TranscriptSettingsDao] Failed to parse config for ${service}:`, error);
      return null;
    }
  }

  /**
   * Set configuration for a specific service
   */
  async setConfig<T = any>(service: ServiceType, config: T): Promise<void> {
    const configJson = JSON.stringify(config);
    const now = new Date().toISOString();

    // Try to update first
    const updateResult = await this.db
      .update(transcriptSettings)
      .set({
        configJson,
        updatedAt: now,
      })
      .where(eq(transcriptSettings.service, service));

    // If no rows updated, insert new record
    if (updateResult.changes === 0) {
      await this.db.insert(transcriptSettings).values({
        service,
        configJson,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Delete configuration for a specific service
   */
  async deleteConfig(service: ServiceType): Promise<boolean> {
    const result = await this.db
      .delete(transcriptSettings)
      .where(eq(transcriptSettings.service, service));

    return result.changes > 0;
  }

  /**
   * Get all configurations
   */
  async getAllConfigs(): Promise<Record<string, any>> {
    const results = await this.db.select().from(transcriptSettings);

    const configs: Record<string, any> = {};
    for (const row of results) {
      try {
        configs[row.service] = JSON.parse(row.configJson);
      } catch (error) {
        console.error(`[TranscriptSettingsDao] Failed to parse config for ${row.service}:`, error);
      }
    }

    return configs;
  }

  /**
   * Clear all configurations
   */
  async clearAll(): Promise<void> {
    await this.db.delete(transcriptSettings);
  }
}
