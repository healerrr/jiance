import type { Conversation, Message, ModelConfig } from '@prisma/client'
import type { ChatInputMessage, RunnableModelConfig } from './model-adapter'
import { chatStream } from './model-adapter'
import { getAppSettings } from './settings'
import { prisma } from './prisma'

export function conversationSystemContext(conversation: Conversation, summary?: string | null) {
  const metadata = conversation.metadataJson ? `\n扩展数据：${conversation.metadataJson}` : ''
  const sample = [
    conversation.sampleName ? `样品名称：${conversation.sampleName}` : '',
    conversation.sampleCode ? `样品编号：${conversation.sampleCode}` : ''
  ].filter(Boolean).join('\n')

  return `以下是外部业务系统已经确认的会话初始信息，不得修改：
CAS号：${conversation.cas}
检测项目：${conversation.testProject}
${sample}
确认内容：${conversation.confirmedContent}${metadata}
${summary ? `\n较早对话的结构化摘要：\n${summary}` : ''}`.trim()
}

function trimRecentMessages(messages: Message[], maxMessages: number, maxChars: number) {
  const recent = messages.slice(-maxMessages)
  const selected: Message[] = []
  let chars = 0
  for (let index = recent.length - 1; index >= 0; index--) {
    const message = recent[index]
    if (!message) continue
    const next = message.content.length
    if (selected.length > 0 && chars + next > maxChars) break
    selected.unshift(message)
    chars += next
  }
  return selected
}

export function buildContext(params: {
  systemPrompt: string
  conversation: Conversation
  messages: Message[]
  maxMessages: number
  maxChars: number
}): ChatInputMessage[] {
  const recent = trimRecentMessages(params.messages, params.maxMessages, params.maxChars)
  return [
    { role: 'system', content: params.systemPrompt },
    { role: 'system', content: conversationSystemContext(params.conversation, params.conversation.summary) },
    ...recent
      .filter(item => ['user', 'assistant'].includes(item.role) && item.content)
      .map(item => ({ role: item.role as 'user' | 'assistant', content: item.content }))
  ]
}

export function summaryPrompt(existingSummary: string | null, messages: Message[]): ChatInputMessage[] {
  const transcript = messages.map(item => `${item.role === 'user' ? '用户' : '助手'}：${item.content}`).join('\n\n')
  return [{
    role: 'system',
    content: `请将下面新增的较早对话合并进已有摘要。只记录对后续化学检测讨论有用的信息，不添加事实或参数。必须使用以下四个标题：实验参数、用户反馈、已排除方案、未解决问题。\n\n已有摘要：\n${existingSummary || '无'}\n\n新增对话：\n${transcript}`
  }]
}

export async function updateSummaryIfNeeded(
  conversation: Conversation,
  allMessages: Message[],
  model: RunnableModelConfig,
  signal?: AbortSignal
) {
  const settings = await getAppSettings()
  const olderCount = Math.max(0, allMessages.length - settings.contextMaxMessages)
  if (olderCount <= conversation.summaryMessageCount) return conversation

  const unsummarized = allMessages.slice(conversation.summaryMessageCount, olderCount)
  let summary = ''
  for await (const chunk of chatStream(model, summaryPrompt(conversation.summary, unsummarized), signal)) {
    summary += chunk
  }
  return prisma.conversation.update({
    where: { id: conversation.id },
    data: { summary, summaryMessageCount: olderCount }
  })
}

export async function prepareContext(conversation: Conversation, messages: Message[], model: RunnableModelConfig, signal?: AbortSignal) {
  const summarizedConversation = await updateSummaryIfNeeded(conversation, messages, model, signal)
  const settings = await getAppSettings()
  return buildContext({
    systemPrompt: settings.globalSystemPrompt,
    conversation: summarizedConversation,
    messages,
    maxMessages: settings.contextMaxMessages,
    maxChars: settings.contextMaxChars
  })
}
