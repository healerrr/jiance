import { describe, expect, it } from 'vitest'
import type { ModelConfig } from '@prisma/client'
import { chatRequestBody, ModelServiceError, normalizeModelError } from '../../server/utils/model-adapter'

const model = {
  modelName: 'deepseek-v4-pro-0813', temperature: 0.2, maxOutputTokens: 4000
} as ModelConfig
const messages = [{ role: 'user' as const, content: '请分析检测条件' }]

describe('模型错误归一化', () => {
  it('保留安全的业务错误', () => {
    expect(normalizeModelError(new ModelServiceError('TIMEOUT', '模型响应超时，请稍后重试。')))
      .toEqual({ code: 'TIMEOUT', message: '模型响应超时，请稍后重试。' })
  })

  it('隐藏未知错误、密钥和堆栈', () => {
    const result = normalizeModelError(new Error('Authorization: Bearer sk-secret'))
    expect(result.code).toBe('UNKNOWN_ERROR')
    expect(result.message).not.toContain('sk-secret')
  })
})

describe('模型回答模式', () => {
  it('默认关闭思考，深度分析时显式开启', () => {
    expect(chatRequestBody(model, messages).enable_thinking).toBe(false)
    expect(chatRequestBody(model, messages, true).enable_thinking).toBe(true)
  })
})
