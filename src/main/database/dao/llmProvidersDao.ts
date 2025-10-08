import { eq, desc, sql } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import { llmProviders, type LlmProvider, type NewLlmProvider } from '../schema';

export class LlmProvidersDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  // Create
  async create(data: NewLlmProvider): Promise<LlmProvider> {
    const result = await this.db
      .insert(llmProviders)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return result[0];
  }

  // Read
  async findAll(): Promise<LlmProvider[]> {
    return await this.db
      .select()
      .from(llmProviders)
      .orderBy(desc(llmProviders.createdAt));
  }

  async findById(id: number): Promise<LlmProvider | null> {
    const result = await this.db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findDefault(): Promise<LlmProvider | null> {
    const result = await this.db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.isDefault, true))
      .limit(1);
    return result[0] || null;
  }

  // Update
  async update(id: number, data: Partial<NewLlmProvider>): Promise<LlmProvider | null> {
    const result = await this.db
      .update(llmProviders)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(llmProviders.id, id))
      .returning();
    return result[0] || null;
  }

  async setDefault(id: number): Promise<void> {
    // Clear all default flags first
    await this.db
      .update(llmProviders)
      .set({ isDefault: false });

    // Set new default
    await this.db
      .update(llmProviders)
      .set({ isDefault: true })
      .where(eq(llmProviders.id, id));
  }

  async incrementTokenUsage(id: number, tokens: number): Promise<void> {
    await this.db
      .update(llmProviders)
      .set({
        tokenUsage: sql`${llmProviders.tokenUsage} + ${tokens}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(llmProviders.id, id));
  }

  // Delete
  async delete(id: number): Promise<void> {
    await this.db
      .delete(llmProviders)
      .where(eq(llmProviders.id, id));
  }
}
