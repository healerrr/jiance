export const BAILIAN_API_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

export const BAILIAN_MODEL_PRESETS = [
  {
    name: 'deepseek-v4',
    modelName: 'deepseek-v4-pro-0813',
    temperature: 0.2,
    maxOutputTokens: 4000,
    timeoutMs: 120_000,
    isDefault: true
  },
  {
    name: 'qwen3.8-max',
    modelName: 'qwen3.8-max',
    temperature: 0.2,
    maxOutputTokens: 4000,
    timeoutMs: 120_000,
    isDefault: false
  },
  {
    name: 'glm-5.2',
    modelName: 'glm-5.2',
    temperature: 0.2,
    maxOutputTokens: 4000,
    timeoutMs: 120_000,
    isDefault: false
  }
] as const

export const LEGACY_DEMO_MODEL = {
  name: '内置演示模型',
  apiBaseUrl: 'mock://chemical-assistant',
  modelName: 'chemical-mock-v1'
} as const
