import { describe, expect, it } from 'vitest'
import { ModelServiceError, normalizeModelError } from '../../server/utils/model-adapter'

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
