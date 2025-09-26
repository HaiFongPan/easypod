# 任务：测试和调试

## 任务信息
- **阶段**: 1 - 核心基础设施
- **估时**: 8小时
- **优先级**: 中
- **依赖**: task_stage1_basic_audio_player

## 任务目标
建立完整的测试框架和调试环境，确保代码质量和开发效率。

## 具体任务
1. **单元测试配置**
   - 选择和配置测试框架(Jest/Vitest)
   - 设置TypeScript测试环境
   - 配置测试覆盖率报告
   - 创建测试工具函数和Mock

2. **组件测试设置**
   - 配置React Testing Library
   - 设置组件渲染测试环境
   - 创建测试用的Provider包装器
   - 实现常用测试工具函数

3. **集成测试框架**
   - 配置数据库测试环境
   - 设置IPC通信测试
   - 创建端到端测试基础设施
   - 实现测试数据生成器

4. **调试和性能监控**
   - 配置开发者工具集成
   - 设置性能监控和分析
   - 实现错误边界和错误报告
   - 配置日志系统

## 验收标准
- [ ] 测试框架正常运行，覆盖率≥80%
- [ ] 所有现有功能单元测试通过
- [ ] 组件测试覆盖核心UI组件
- [ ] 数据库操作集成测试完整
- [ ] 开发调试工具配置完善
- [ ] CI/CD集成测试流程建立

## 测试框架配置

### Jest/Vitest配置
```javascript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
```

### 测试工具函数
```tsx
// src/test/utils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { TestProviders } from './TestProviders';

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: TestProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

## 测试用例示例

### 组件测试
```tsx
// src/components/Button/Button.test.tsx
import { render, screen, fireEvent } from '@test/utils';
import { Button } from './Button';

describe('Button Component', () => {
  test('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  test('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

### 数据库测试
```tsx
// src/main/database/dao/FeedDAO.test.ts
import { describe, test, expect, beforeEach } from 'vitest';
import { FeedDAO } from './FeedDAO';
import { createTestDatabase } from '@test/database';

describe('FeedDAO', () => {
  let dao: FeedDAO;

  beforeEach(async () => {
    const db = await createTestDatabase();
    dao = new FeedDAO(db);
  });

  test('creates feed successfully', async () => {
    const feedData = {
      title: 'Test Podcast',
      url: 'https://example.com/feed.xml',
    };

    const feed = await dao.create(feedData);
    expect(feed.id).toBeDefined();
    expect(feed.title).toBe(feedData.title);
  });
});
```

## 性能监控
```tsx
// src/renderer/utils/performance.ts
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  startTiming(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(label, duration);
    };
  }

  recordMetric(label: string, value: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(value);
  }

  getMetrics(label: string) {
    const values = this.metrics.get(label) || [];
    return {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }
}
```

## 调试工具配置
- React DevTools集成
- Redux DevTools支持(状态管理)
- Electron DevTools增强
- 网络请求监控
- 数据库查询日志

## 错误处理和报告
```tsx
// src/renderer/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // 发送错误报告到监控服务
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    // 错误上报逻辑
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
```

## 相关文件
- `vitest.config.ts` - 测试框架配置
- `src/test/` - 测试工具和设置
- `src/**/*.test.ts` - 单元测试文件
- `src/**/*.spec.ts` - 集成测试文件
- `src/renderer/utils/logger.ts` - 日志系统

## 后续任务依赖
- 所有后续开发任务的测试保障
- task_stage2_integration_testing
- task_stage5_end_to_end_testing