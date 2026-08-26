import { describe, expect, it } from 'vitest'
import { resolveDatabaseUrl } from '../../server/utils/prisma'

describe('SQLite 运行时地址', () => {
  it('将相对地址稳定解析到项目 prisma 目录', () => {
    const value = resolveDatabaseUrl('file:./dev.db')
    expect(value).toMatch(/^file:/)
    expect(value).toContain('/prisma/dev.db')
  })

  it('保留绝对 SQLite 地址和非 SQLite 地址', () => {
    expect(resolveDatabaseUrl('file:C:/data/app.db')).toBe('file:C:/data/app.db')
    expect(resolveDatabaseUrl('mysql://localhost/app')).toBe('mysql://localhost/app')
  })
})
