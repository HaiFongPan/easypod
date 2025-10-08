import { eq, desc, and, sql } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import { llmModels, type LlmModel, type NewLlmModel } from '../schema';

export class LlmModelsDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  // Create
  async create(data: NewLlmModel): Promise<LlmModel> {
    const result = await this.db
      .insert(llmModels)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return result[0];
  }

  // Read
  async findAll(): Promise<LlmModel[]> {
    return await this.db
      .select()
      .from(llmModels)
      .orderBy(desc(llmModels.createdAt));
  }

  async findByProvider(providerId: number): Promise<LlmModel[]> {
    return await this.db
      .select()
      .from(llmModels)
      .where(eq(llmModels.providerId, providerId))
      .orderBy(desc(llmModels.createdAt));
  }

  async findById(id: number): Promise<LlmModel | null> {
    const result = await this.db
      .select()
      .from(llmModels)
      .where(eq(llmModels.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findDefault(providerId: number): Promise<LlmModel | null> {
    const result = await this.db
      .select()
      .from(llmModels)
      .where(and(
        eq(llmModels.providerId, providerId),
        eq(llmModels.isDefault, true)
      ))
      .limit(1);
    return result[0] || null;
  }

  // Update
  async update(id: number, data: Partial<NewLlmModel>): Promise<LlmModel | null> {
    const result = await this.db
      .update(llmModels)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(llmModels.id, id))
      .returning();
    return result[0] || null;
  }

  async setDefault(providerId: number, modelId: number): Promise<void> {
    // Clear all default flags for this provider
    await this.db
      .update(llmModels)
      .set({ isDefault: false })
      .where(eq(llmModels.providerId, providerId));

    // Set new default
    await this.db
      .update(llmModels)
      .set({ isDefault: true })
      .where(eq(llmModels.id, modelId));
  }

  async incrementTokenUsage(id: number, tokens: number): Promise<void> {
    await this.db
      .update(llmModels)
      .set({
        tokenUsage: sql`${llmModels.tokenUsage} + ${tokens}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(llmModels.id, id));
  }

  // Delete
  async delete(id: number): Promise<void> {
    await this.db
      .delete(llmModels)
      .where(eq(llmModels.id, id));
  }
}
