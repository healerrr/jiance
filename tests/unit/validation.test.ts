import { describe, expect, it } from 'vitest'
import { modelConfigCreateSchema } from '../../server/utils/validation'

describe('模型配置校验', () => {
  const valid = {
    name: '测试模型', apiBaseUrl: 'https://api.example.com/v1', apiKey: 'secret',
    modelName: 'example-chat', temperature: 0.3, maxOutputTokens: 2000,
    timeoutMs: 60000, enabled: true, isDefault: false
  }

  it('接受 OpenAI 兼容地址与合法参数', () => {
    expect(modelConfigCreateSchema.safeParse(valid).success).toBe(true)
    expect(modelConfigCreateSchema.safeParse({ ...valid, apiBaseUrl: 'mock://chemical-assistant' }).success).toBe(true)
  })

  it('拒绝越界 temperature、超时和危险协议', () => {
    expect(modelConfigCreateSchema.safeParse({ ...valid, temperature: 2.1 }).success).toBe(false)
    expect(modelConfigCreateSchema.safeParse({ ...valid, timeoutMs: 10 }).success).toBe(false)
    expect(modelConfigCreateSchema.safeParse({ ...valid, apiBaseUrl: 'file:///secret' }).success).toBe(false)
  })
})
