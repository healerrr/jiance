import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../server/utils/prisma'
import { encryptApiKey } from '../../server/utils/crypto'
import { resolveConversation, deleteConversation } from '../../server/utils/conversations'
import { setDefaultModel } from '../../server/utils/model-configs'
import { updateSummaryIfNeeded } from '../../server/utils/context'
import { runnableModel } from '../../server/utils/model-adapter'

const runId = `vitest-${Date.now()}`
const masterKey = process.env.ENCRYPTION_MASTER_KEY || 'local-development-master-key-change-before-production-2026'
const externalKeys: string[] = []
const modelIds: string[] = []
let originalDefaultId: string | undefined

beforeAll(async () => {
  originalDefaultId = (await prisma.modelConfig.findFirst({ where: { isDefault: true } }))?.id
})

afterAll(async () => {
  await prisma.message.deleteMany({ where: { conversation: { externalKey: { startsWith: runId } } } })
  await prisma.conversation.deleteMany({ where: { externalKey: { startsWith: runId } } })
  if (originalDefaultId) await setDefaultModel(originalDefaultId)
  await prisma.modelConfig.deleteMany({ where: { id: { in: modelIds } } })
  await prisma.$disconnect()
})

function input(key: string) {
  externalKeys.push(key)
  return {
    externalKey: key,
    cas: '123-45-6',
    testProject: '液相色谱',
    confirmedContent: '请给出基础纯度检测思路',
    sampleName: '集成测试样品',
    sampleCode: 'IT-01',
    metadata: { source: 'vitest' }
  }
}

describe('会话持久化与 externalKey 幂等', () => {
  it('相同 externalKey 恢复原会话且不覆盖快照', async () => {
    const key = `${runId}-same`
    const first = await resolveConversation(input(key))
    const second = await resolveConversation({ ...input(key), cas: '999-99-9', confirmedContent: '不应覆盖' })
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.conversation.id).toBe(first.conversation.id)
    expect(second.conversation.cas).toBe('123-45-6')
    expect(await prisma.message.count({ where: { conversationId: first.conversation.id } })).toBe(1)
  })

  it('并发请求只创建一个会话和一条初始消息', async () => {
    const key = `${runId}-concurrent`
    const results = await Promise.all(Array.from({ length: 8 }, () => resolveConversation(input(key))))
    expect(new Set(results.map(item => item.conversation.id)).size).toBe(1)
    expect(results.filter(item => item.created)).toHaveLength(1)
    const id = results[0]!.conversation.id
    expect(await prisma.message.count({ where: { conversationId: id } })).toBe(1)
  })

  it('事务删除会话及其消息', async () => {
    const created = await resolveConversation(input(`${runId}-delete`))
    await deleteConversation(created.conversation.id)
    expect(await prisma.conversation.findUnique({ where: { id: created.conversation.id } })).toBeNull()
    expect(await prisma.message.count({ where: { conversationId: created.conversation.id } })).toBe(0)
  })
})

describe('默认模型与历史摘要', () => {
  it('切换默认模型时始终只保留一个默认项', async () => {
    for (const suffix of ['a', 'b']) {
      const model = await prisma.modelConfig.create({ data: {
        name: `${runId}-model-${suffix}`, apiBaseUrl: 'mock://chemical-assistant',
        apiKeyEncrypted: encryptApiKey('mock-key', masterKey), modelName: `mock-${suffix}`,
        temperature: 0.3, maxOutputTokens: 1000, timeoutMs: 5000, enabled: true, isDefault: false
      } })
      modelIds.push(model.id)
    }
    await setDefaultModel(modelIds[0]!)
    await setDefaultModel(modelIds[1]!)
    expect(await prisma.modelConfig.count({ where: { isDefault: true } })).toBe(1)
    expect((await prisma.modelConfig.findUnique({ where: { id: modelIds[1]! } }))?.isDefault).toBe(true)
  })

  it('超过消息数量后生成并保存结构化摘要', async () => {
    const result = await resolveConversation(input(`${runId}-summary`))
    await prisma.message.createMany({ data: Array.from({ length: 24 }, (_, index) => ({
      conversationId: result.conversation.id,
      role: index % 2 ? 'assistant' : 'user', content: `摘要测试消息 ${index + 1}`, status: 'completed',
      createdAt: new Date(Date.now() + index * 10)
    })) })
    const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: result.conversation.id } })
    const messages = await prisma.message.findMany({ where: { conversationId: result.conversation.id }, orderBy: { createdAt: 'asc' } })
    const mockConfig = await prisma.modelConfig.create({ data: {
      name: `${runId}-summary-model`, apiBaseUrl: 'mock://chemical-assistant',
      apiKeyEncrypted: encryptApiKey('mock-key', masterKey), modelName: 'summary-mock',
      temperature: 0.3, maxOutputTokens: 1000, timeoutMs: 5000, enabled: true, isDefault: false
    } })
    modelIds.push(mockConfig.id)
    const updated = await updateSummaryIfNeeded(conversation, messages, runnableModel(mockConfig, masterKey))
    expect(updated.summary).toContain('### 实验参数')
    expect(updated.summary).toContain('### 未解决问题')
    expect(updated.summaryMessageCount).toBe(5)
  })
})
