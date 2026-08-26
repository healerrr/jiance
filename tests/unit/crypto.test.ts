import { describe, expect, it } from 'vitest'
import { decryptApiKey, encryptApiKey, maskApiKey } from '../../server/utils/crypto'

describe('API 密钥保护', () => {
  const secret = 'unit-test-master-key-with-more-than-32-characters'

  it('使用带随机 IV 的 AES-GCM 加密并正确解密', () => {
    const first = encryptApiKey('sk-sensitive-1234567890', secret)
    const second = encryptApiKey('sk-sensitive-1234567890', secret)
    expect(first).not.toContain('sk-sensitive')
    expect(first).not.toBe(second)
    expect(decryptApiKey(first, secret)).toBe('sk-sensitive-1234567890')
  })

  it('只显示脱敏值', () => {
    expect(maskApiKey('sk-sensitive-1234567890')).toBe('sk-••••••••7890')
    expect(maskApiKey('short')).toBe('••••••••')
  })
})
