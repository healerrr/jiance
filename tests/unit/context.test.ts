import { describe, expect, it } from 'vitest'
import type { Conversation, Message } from '@prisma/client'
import { buildContext, summaryPrompt } from '../../server/utils/context'

const conversation = {
  id: 'c1', externalKey: 'ext-1', title: '样品', cas: '123-45-6', testProject: '液相色谱',
  sampleName: '对照样', sampleCode: 'S-01', confirmedContent: '需要评估纯度检测方案', metadataJson: null,
  summary: '### 实验参数\n- 已尝试水相。', summaryMessageCount: 2, status: 'active',
  currentModelConfigId: null, currentModelName: null, activeGenerationId: null,
  activeGenerationStarted: null, createdAt: new Date(), updatedAt: new Date(), lastMessageAt: new Date()
} satisfies Conversation

function message(index: number): Message {
  return {
    id: `m${index}`, conversationId: 'c1', role: index % 2 ? 'user' : 'assistant',
    content: `第${index}条消息`, status: 'completed', modelConfigId: null,
    modelNameSnapshot: null, errorSummary: null, createdAt: new Date(index * 1000)
  }
}

describe('多轮上下文', () => {
  it('同时包含系统提示、初始快照、摘要和最近消息', () => {
    const result = buildContext({
      systemPrompt: '系统提示', conversation, messages: Array.from({ length: 25 }, (_, i) => message(i + 1)),
      maxMessages: 20, maxChars: 40000
    })
    expect(result[0]?.content).toBe('系统提示')
    expect(result[1]?.content).toContain('CAS号：123-45-6')
    expect(result[1]?.content).toContain('需要评估纯度检测方案')
    expect(result[1]?.content).toContain('已尝试水相')
    expect(result).toHaveLength(22)
    expect(result[2]?.content).toBe('第6条消息')
    expect(result.at(-1)?.content).toBe('第25条消息')
  })

  it('摘要提示强制保留四类关键信息', () => {
    const prompt = summaryPrompt(null, [message(1), message(2)])[0]?.content || ''
    expect(prompt).toContain('实验参数')
    expect(prompt).toContain('用户反馈')
    expect(prompt).toContain('已排除方案')
    expect(prompt).toContain('未解决问题')
  })
})
