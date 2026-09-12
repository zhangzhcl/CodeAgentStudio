import type { AgentConfigSnapshot, AgentProviderId } from './contracts.js';

function credential(present: boolean): AgentConfigSnapshot['credential'] {
  return present ? { present: true, source: 'native' } : { present: false };
}

function parseJson(text: string): Record<string, any> {
  return JSON.parse(text) as Record<string, any>;
}

function tomlString(text: string, key: string): string | undefined {
  const match = text.match(new RegExp(`^\\s*${key.replace('.', '\\.') }\\s*=\\s*["']([^"']+)["']`, 'm'));
  return match?.[1];
}

export function parseProviderConfig(provider: AgentProviderId, text: string, sourcePath: string): AgentConfigSnapshot {
  if (provider === 'claude') {
    const value = parseJson(text);
    const env = value.env ?? {};
    return { provider, sourcePath, model: value.model, baseUrl: env.ANTHROPIC_BASE_URL, credential: credential(Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN)) };
  }
  if (provider === 'cursor') {
    const value = parseJson(text);
    return { provider, sourcePath, model: value.model?.modelId ?? value.model?.displayModelId, credential: credential(Boolean(value.apiKey)) };
  }
  if (provider === 'codex') {
    const modelProvider = tomlString(text, 'model_provider');
    const providerBlock = modelProvider ? text.slice(text.indexOf(`[model_providers.${modelProvider}]`)) : '';
    return { provider, sourcePath, model: tomlString(text, 'model'), baseUrl: tomlString(providerBlock, 'base_url') ?? tomlString(text, 'openai_base_url'), credential: credential(Boolean(tomlString(providerBlock, 'env_key') || tomlString(providerBlock, 'experimental_bearer_token'))) };
  }
  if (provider === 'pi') {
    const value = parseJson(text);
    const providers = value.providers ?? {};
    const first = Object.values(providers)[0] as any;
    const firstModel = first?.models?.[0];
    return { provider, sourcePath, model: firstModel?.id ?? value.defaultModel, baseUrl: first?.baseUrl, credential: credential(Boolean(first?.apiKey)) };
  }
  const value = parseJson(text.replace(/\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'));
  const providers = value.provider ?? value.providers ?? {};
  const first = Object.values(providers)[0] as any;
  const firstModel = first?.models ? Object.keys(first.models)[0] : undefined;
  return { provider, sourcePath, model: value.model ?? firstModel, baseUrl: first?.options?.baseURL ?? first?.settings?.baseURL, credential: credential(Boolean(first?.options?.apiKey || first?.settings?.apiKey || first?.env?.length)) };
}
