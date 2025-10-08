import { eq, desc } from 'drizzle-orm';
import { getDatabaseManager } from '../connection';
import { prompts, type Prompt, type NewPrompt } from '../schema';

export class PromptsDao {
  private get db() {
    return getDatabaseManager().getDrizzle();
  }

  // Create
  async create(data: NewPrompt): Promise<Prompt> {
    const result = await this.db
      .insert(prompts)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return result[0];
  }

  // Read
  async findAll(): Promise<Prompt[]> {
    return await this.db
      .select()
      .from(prompts)
      .orderBy(desc(prompts.createdAt));
  }

  async findByType(type: string): Promise<Prompt[]> {
    return await this.db
      .select()
      .from(prompts)
      .where(eq(prompts.type, type));
  }

  async findBuiltins(): Promise<Prompt[]> {
    return await this.db
      .select()
      .from(prompts)
      .where(eq(prompts.isBuiltin, true));
  }

  async findById(id: number): Promise<Prompt | null> {
    const result = await this.db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .limit(1);
    return result[0] || null;
  }

  // Update
  async update(id: number, data: Partial<NewPrompt>): Promise<Prompt | null> {
    const result = await this.db
      .update(prompts)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(prompts.id, id))
      .returning();
    return result[0] || null;
  }

  // Delete
  async delete(id: number): Promise<void> {
    await this.db
      .delete(prompts)
      .where(eq(prompts.id, id));
  }
}
