import type { Model } from '@earendil-works/pi-ai';
import type { AgentLLMConfig } from '@shared/types/agent';

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

function openAICompatibleModel(
  config: AgentLLMConfig,
  baseUrl: string,
  name: string,
): Model<'openai-completions'> {
  const isReasoner = /reasoner|r1|o1|o3|thinking/i.test(config.model);
  return {
    id: config.model,
    name,
    api: 'openai-completions',
    provider: config.provider,
    baseUrl,
    reasoning: isReasoner,
    input: ['text'],
    cost: ZERO_COST,
    contextWindow: 128000,
    maxTokens: 8192,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  };
}

/**
 * 根据用户配置构造 pi-ai 的 Model 对象。
 * deepseek / custom 走 OpenAI 兼容的 openai-completions 协议，
 * openai / anthropic 使用对应官方协议。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildModel(config: AgentLLMConfig): Model<any> {
  const model = (config.model || '').trim();
  switch (config.provider) {
    case 'anthropic': {
      return {
        id: model || 'claude-sonnet-4-5',
        name: `Anthropic ${model || 'claude-sonnet-4-5'}`,
        api: 'anthropic-messages',
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        reasoning: true,
        input: ['text'],
        cost: ZERO_COST,
        contextWindow: 200000,
        maxTokens: 8192,
      };
    }
    case 'openai': {
      return openAICompatibleModel(
        config,
        'https://api.openai.com/v1',
        `OpenAI ${model || 'gpt-4o-mini'}`,
      );
    }
    case 'custom': {
      const baseUrl = (config.baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
      return openAICompatibleModel(config, baseUrl, `Custom ${model || 'model'}`);
    }
    case 'deepseek':
    default: {
      return openAICompatibleModel(
        config,
        'https://api.deepseek.com/v1',
        `DeepSeek ${model || 'deepseek-chat'}`,
      );
    }
  }
}

export function defaultModelId(provider: AgentLLMConfig['provider']): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-5';
    case 'openai':
      return 'gpt-4o-mini';
    case 'custom':
      return 'qwen2.5';
    default:
      return 'deepseek-chat';
  }
}
