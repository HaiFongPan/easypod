# 任务：AI Provider抽象层

## 任务信息
- **阶段**: 4 - AI功能集成
- **估时**: 16小时
- **优先级**: 高
- **依赖**: task_stage1_sqlite_database

## 任务目标
建立可插拔的AI服务抽象层，支持多种AI Provider的统一接口和配置管理。

## 具体任务
1. **统一AI服务接口设计**
   - 定义标准化的Provider接口
   - 支持流式和非流式调用
   - 错误处理和重试机制
   - 成本追踪和限流控制

2. **支持OpenAI API兼容格式**
   - OpenAI官方API集成
   - 兼容格式的第三方服务
   - API密钥安全存储
   - 请求参数标准化

3. **配置管理和凭证存储**
   - Provider配置界面
   - macOS Keychain安全存储
   - 配置验证和测试
   - 多Profile管理

4. **重试机制和错误处理**
   - 网络错误重试策略
   - API限流处理
   - 费用预算控制
   - 降级和备选方案

## 验收标准
- [ ] 至少支持3种不同的AI Provider
- [ ] API调用成功率≥99%
- [ ] 重试机制有效处理临时故障
- [ ] 费用追踪准确度≥95%
- [ ] 配置界面用户体验良好
- [ ] 密钥安全存储无泄漏风险

## AI Provider接口设计

### 核心接口定义
```typescript
// src/main/services/ai/AIProviderInterface.ts
interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedCapabilities: AICapability[];

  // 配置验证
  validateConfig(config: ProviderConfig): Promise<ValidationResult>;

  // 文本生成
  generateText(
    prompt: string,
    options?: GenerationOptions
  ): Promise<string>;

  // 流式文本生成
  generateTextStream(
    prompt: string,
    options?: GenerationOptions
  ): AsyncIterable<string>;

  // 成本估算
  estimateCost(prompt: string, options?: GenerationOptions): Promise<number>;

  // 健康检查
  healthCheck(): Promise<HealthStatus>;
}

interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  customHeaders?: Record<string, string>;
}

interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface HealthStatus {
  isHealthy: boolean;
  latency: number; // ms
  error?: string;
  usage?: {
    remaining: number;
    total: number;
    resetTime?: Date;
  };
}

enum AICapability {
  TEXT_GENERATION = 'text_generation',
  STREAMING = 'streaming',
  FUNCTION_CALLING = 'function_calling',
  JSON_MODE = 'json_mode',
  VISION = 'vision'
}
```

### Provider管理器
```typescript
// src/main/services/ai/AIProviderManager.ts
class AIProviderManager {
  private providers = new Map<string, AIProvider>();
  private configs = new Map<string, ProviderConfig>();
  private costTracker = new CostTracker();
  private rateLimiter = new RateLimiter();

  constructor() {
    this.loadBuiltinProviders();
  }

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  async configureProvider(
    providerId: string,
    config: ProviderConfig
  ): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const validation = await provider.validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // 安全存储API密钥
    if (config.apiKey) {
      await this.secureStorage.store(`ai_provider_${providerId}_key`, config.apiKey);
      config.apiKey = '*'.repeat(8); // 隐藏密钥
    }

    this.configs.set(providerId, config);
    await this.saveConfigurations();
  }

  async generateText(
    providerId: string,
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<{ text: string; cost: number; usage: any }> {
    const provider = await this.getConfiguredProvider(providerId);

    // 检查费用限制
    await this.rateLimiter.checkLimits(providerId);

    // 估算成本
    const estimatedCost = await provider.estimateCost(prompt, options);
    await this.costTracker.checkBudget(providerId, estimatedCost);

    const startTime = Date.now();

    try {
      const text = await provider.generateText(prompt, options);
      const actualCost = await this.calculateActualCost(provider, prompt, text, options);

      // 记录使用情况
      await this.logUsage(providerId, {
        prompt,
        response: text,
        cost: actualCost,
        latency: Date.now() - startTime,
        model: options.model || 'default',
      });

      return { text, cost: actualCost, usage: {} };

    } catch (error) {
      // 记录错误
      await this.logError(providerId, error, prompt);
      throw error;
    }
  }

  async *generateTextStream(
    providerId: string,
    prompt: string,
    options: GenerationOptions = {}
  ): AsyncIterable<{ chunk: string; cost?: number }> {
    const provider = await this.getConfiguredProvider(providerId);

    if (!provider.supportedCapabilities.includes(AICapability.STREAMING)) {
      throw new Error(`Provider ${providerId} does not support streaming`);
    }

    await this.rateLimiter.checkLimits(providerId);

    try {
      let totalTokens = 0;
      const stream = provider.generateTextStream(prompt, options);

      for await (const chunk of stream) {
        totalTokens += this.estimateTokens(chunk);
        yield { chunk };
      }

      // 计算总成本
      const cost = await this.calculateStreamCost(provider, totalTokens);
      yield { chunk: '', cost };

    } catch (error) {
      await this.logError(providerId, error, prompt);
      throw error;
    }
  }

  getAvailableProviders(): { id: string; name: string; capabilities: AICapability[] }[] {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
      capabilities: provider.supportedCapabilities,
    }));
  }

  async getProviderHealth(providerId: string): Promise<HealthStatus> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return provider.healthCheck();
  }

  private async getConfiguredProvider(providerId: string): Promise<AIProvider> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const config = this.configs.get(providerId);
    if (!config) {
      throw new Error(`Provider ${providerId} not configured`);
    }

    return provider;
  }

  private loadBuiltinProviders(): void {
    // 注册内置的Provider
    this.registerProvider(new OpenAIProvider());
    this.registerProvider(new ClaudeProvider());
    this.registerProvider(new DeepSeekProvider());
    this.registerProvider(new OllamaProvider());
  }

  private async saveConfigurations(): Promise<void> {
    const configData = Object.fromEntries(this.configs);
    await fs.writeFile(
      path.join(app.getPath('userData'), 'ai-providers.json'),
      JSON.stringify(configData, null, 2)
    );
  }
}
```

## 具体Provider实现

### OpenAI Provider
```typescript
// src/main/services/ai/providers/OpenAIProvider.ts
class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly supportedCapabilities = [
    AICapability.TEXT_GENERATION,
    AICapability.STREAMING,
    AICapability.FUNCTION_CALLING,
    AICapability.JSON_MODE,
    AICapability.VISION,
  ];

  private config: ProviderConfig | null = null;
  private client: OpenAI | null = null;

  async validateConfig(config: ProviderConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.apiKey) {
      errors.push('API key is required');
    }

    if (!config.model) {
      errors.push('Model is required');
    }

    if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
      warnings.push('Temperature should be between 0 and 2');
    }

    // 测试API连接
    if (config.apiKey && errors.length === 0) {
      try {
        const testClient = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseUrl,
        });

        await testClient.models.list();
      } catch (error) {
        errors.push(`API connection failed: ${error.message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async generateText(prompt: string, options: GenerationOptions = {}): Promise<string> {
    const client = await this.getClient();

    const response = await client.chat.completions.create({
      model: options.model || this.config!.model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature: options.temperature ?? this.config!.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.config!.maxTokens ?? 2048,
      stream: false,
    });

    return response.choices[0]?.message?.content || '';
  }

  async *generateTextStream(
    prompt: string,
    options: GenerationOptions = {}
  ): AsyncIterable<string> {
    const client = await this.getClient();

    const stream = await client.chat.completions.create({
      model: options.model || this.config!.model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature: options.temperature ?? this.config!.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.config!.maxTokens ?? 2048,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async estimateCost(prompt: string, options: GenerationOptions = {}): Promise<number> {
    const model = options.model || this.config!.model;
    const promptTokens = this.estimateTokens(prompt);
    const maxTokens = options.maxTokens ?? 2048;

    // OpenAI定价 (需要定期更新)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 0.03, output: 0.06 }, // per 1K tokens
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    };

    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo'];

    return (
      (promptTokens / 1000) * modelPricing.input +
      (maxTokens / 1000) * modelPricing.output
    );
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const client = await this.getClient();
      const startTime = Date.now();

      await client.models.list();

      return {
        isHealthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        isHealthy: false,
        latency: -1,
        error: error.message,
      };
    }
  }

  private async getClient(): Promise<OpenAI> {
    if (!this.config) {
      throw new Error('Provider not configured');
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
      });
    }

    return this.client;
  }

  private estimateTokens(text: string): number {
    // 简化的Token估算，实际应该使用tiktoken
    return Math.ceil(text.length / 4);
  }
}
```

### 成本追踪器
```typescript
// src/main/services/ai/CostTracker.ts
interface UsageRecord {
  providerId: string;
  timestamp: Date;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  episodeId?: string;
  taskType: string;
}

interface BudgetLimit {
  providerId: string;
  daily: number;
  monthly: number;
  total: number;
}

class CostTracker {
  private usageRecords: UsageRecord[] = [];
  private budgetLimits = new Map<string, BudgetLimit>();

  async recordUsage(record: UsageRecord): Promise<void> {
    this.usageRecords.push(record);

    // 保存到数据库
    await this.saveToDatabase(record);

    // 清理旧记录 (保留30天)
    this.cleanupOldRecords(30);
  }

  async checkBudget(providerId: string, estimatedCost: number): Promise<void> {
    const limits = this.budgetLimits.get(providerId);
    if (!limits) return;

    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const dailyUsage = this.calculateUsage(providerId, today);
    const monthlyUsage = this.calculateUsage(providerId, thisMonth);
    const totalUsage = this.calculateUsage(providerId, new Date(0));

    if (dailyUsage + estimatedCost > limits.daily) {
      throw new Error(`Daily budget exceeded for ${providerId}`);
    }

    if (monthlyUsage + estimatedCost > limits.monthly) {
      throw new Error(`Monthly budget exceeded for ${providerId}`);
    }

    if (totalUsage + estimatedCost > limits.total) {
      throw new Error(`Total budget exceeded for ${providerId}`);
    }
  }

  setBudgetLimit(providerId: string, limits: BudgetLimit): void {
    this.budgetLimits.set(providerId, limits);
  }

  getUsageSummary(
    providerId?: string,
    startDate?: Date,
    endDate?: Date
  ): {
    totalCost: number;
    totalRequests: number;
    averageCost: number;
    breakdown: Record<string, number>;
  } {
    let records = this.usageRecords;

    if (providerId) {
      records = records.filter(r => r.providerId === providerId);
    }

    if (startDate) {
      records = records.filter(r => r.timestamp >= startDate);
    }

    if (endDate) {
      records = records.filter(r => r.timestamp <= endDate);
    }

    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
    const totalRequests = records.length;
    const averageCost = totalRequests > 0 ? totalCost / totalRequests : 0;

    const breakdown: Record<string, number> = {};
    records.forEach(record => {
      const key = `${record.providerId}:${record.model}`;
      breakdown[key] = (breakdown[key] || 0) + record.cost;
    });

    return {
      totalCost,
      totalRequests,
      averageCost,
      breakdown,
    };
  }

  private calculateUsage(providerId: string, since: Date): number {
    return this.usageRecords
      .filter(r => r.providerId === providerId && r.timestamp >= since)
      .reduce((sum, r) => sum + r.cost, 0);
  }

  private cleanupOldRecords(days: number): void {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    this.usageRecords = this.usageRecords.filter(r => r.timestamp >= cutoff);
  }

  private async saveToDatabase(record: UsageRecord): Promise<void> {
    // 实现数据库保存逻辑
    const db = await getDatabase();
    await db.run(`
      INSERT INTO ai_usage (
        provider_id, timestamp, model, prompt_tokens,
        completion_tokens, cost, episode_id, task_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.providerId,
      record.timestamp.toISOString(),
      record.model,
      record.promptTokens,
      record.completionTokens,
      record.cost,
      record.episodeId,
      record.taskType,
    ]);
  }
}
```

## 安全存储服务

### macOS Keychain集成
```typescript
// src/main/services/SecureStorage.ts
import { safeStorage } from 'electron';
import keytar from 'keytar';

class SecureStorage {
  private readonly serviceName = 'EasyPod';

  async store(key: string, value: string): Promise<void> {
    try {
      // 优先使用Electron safeStorage (需要macOS 10.15+)
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(value);
        await fs.writeFile(
          path.join(app.getPath('userData'), 'secure', `${key}.encrypted`),
          encrypted
        );
      } else {
        // 回退到keytar (keychain)
        await keytar.setPassword(this.serviceName, key, value);
      }
    } catch (error) {
      console.error(`Failed to store secure data for key ${key}:`, error);
      throw new Error('Failed to store secure data');
    }
  }

  async retrieve(key: string): Promise<string | null> {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encryptedPath = path.join(app.getPath('userData'), 'secure', `${key}.encrypted`);

        if (await this.fileExists(encryptedPath)) {
          const encrypted = await fs.readFile(encryptedPath);
          return safeStorage.decryptString(encrypted);
        }
      }

      // 尝试从keychain读取
      return await keytar.getPassword(this.serviceName, key);
    } catch (error) {
      console.error(`Failed to retrieve secure data for key ${key}:`, error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // 删除文件存储的数据
      const encryptedPath = path.join(app.getPath('userData'), 'secure', `${key}.encrypted`);
      if (await this.fileExists(encryptedPath)) {
        await fs.unlink(encryptedPath);
      }

      // 删除keychain中的数据
      await keytar.deletePassword(this.serviceName, key);
    } catch (error) {
      console.error(`Failed to delete secure data for key ${key}:`, error);
    }
  }

  async listKeys(): Promise<string[]> {
    const keys: string[] = [];

    // 从文件系统获取
    try {
      const secureDir = path.join(app.getPath('userData'), 'secure');
      if (await this.fileExists(secureDir)) {
        const files = await fs.readdir(secureDir);
        keys.push(...files.filter(f => f.endsWith('.encrypted')).map(f => f.replace('.encrypted', '')));
      }
    } catch (error) {
      console.warn('Failed to list secure files:', error);
    }

    // 从keychain获取 (keytar不支持列表操作，需要维护一个索引)
    try {
      const indexKey = '_secure_keys_index';
      const indexData = await keytar.getPassword(this.serviceName, indexKey);
      if (indexData) {
        const keychainKeys = JSON.parse(indexData);
        keys.push(...keychainKeys.filter((k: string) => !keys.includes(k)));
      }
    } catch (error) {
      console.warn('Failed to read keychain index:', error);
    }

    return [...new Set(keys)];
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
```

## 相关文件
- `src/main/services/ai/AIProviderInterface.ts` - AI服务接口定义
- `src/main/services/ai/AIProviderManager.ts` - Provider管理器
- `src/main/services/ai/providers/` - 各Provider实现目录
- `src/main/services/ai/CostTracker.ts` - 成本追踪
- `src/main/services/SecureStorage.ts` - 安全存储
- `src/renderer/components/Settings/AIProviders.tsx` - 配置界面

## 后续任务依赖
- task_stage4_summary_and_chaptering
- task_stage4_markdown_export