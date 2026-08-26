import type { Message } from '@prisma/client'
import { prisma } from './prisma'

type GenerationMode = 'initial' | 'message' | 'regenerate'

export async function beginGeneration(params: {
  conversationId: string
  mode: GenerationMode
  content?: string
  assistantMessageId?: string
  modelConfigId: string
  modelName: string
}) {
  return prisma.$transaction(async (tx) => {
    let conversation = await tx.conversation.findUnique({ where: { id: params.conversationId } })
    if (!conversation) throw createError({ statusCode: 404, statusMessage: '会话不存在' })

    const staleBefore = new Date(Date.now() - 10 * 60_000)
    if (conversation.activeGenerationId && conversation.activeGenerationStarted && conversation.activeGenerationStarted < staleBefore) {
      conversation = await tx.conversation.update({
        where: { id: conversation.id },
        data: { activeGenerationId: null, activeGenerationStarted: null }
      })
    }
    if (conversation.activeGenerationId) {
      throw createError({ statusCode: 409, statusMessage: '当前会话正在生成回答' })
    }

    let assistant: Message
    if (params.mode === 'initial') {
      const assistantCount = await tx.message.count({ where: { conversationId: conversation.id, role: 'assistant' } })
      if (assistantCount > 0) {
        throw createError({ statusCode: 409, statusMessage: '首次回答已经生成，无需重复生成' })
      }
      assistant = await tx.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: '',
          status: 'generating',
          modelConfigId: params.modelConfigId,
          modelNameSnapshot: params.modelName
        }
      })
    } else if (params.mode === 'message') {
      const now = new Date()
      await tx.message.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: params.content!,
          status: 'completed',
          createdAt: now
        }
      })
      assistant = await tx.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: '',
          status: 'generating',
          modelConfigId: params.modelConfigId,
          modelNameSnapshot: params.modelName,
          createdAt: new Date(now.getTime() + 1)
        }
      })
    } else {
      const target = await tx.message.findFirst({
        where: { id: params.assistantMessageId, conversationId: conversation.id, role: 'assistant' }
      })
      if (!target) throw createError({ statusCode: 404, statusMessage: '要重新生成的回答不存在' })
      assistant = await tx.message.update({
        where: { id: target.id },
        data: {
          content: '',
          status: 'generating',
          errorSummary: null,
          modelConfigId: params.modelConfigId,
          modelNameSnapshot: params.modelName
        }
      })
    }

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        activeGenerationId: assistant.id,
        activeGenerationStarted: new Date(),
        currentModelConfigId: params.modelConfigId,
        currentModelName: params.modelName,
        lastMessageAt: new Date()
      }
    })

    return { conversation, assistant }
  })
}

export async function finishGeneration(params: {
  conversationId: string
  messageId: string
  content: string
  status: 'completed' | 'stopped' | 'failed'
  errorSummary?: string | null
}) {
  await prisma.$transaction([
    prisma.message.update({
      where: { id: params.messageId },
      data: { content: params.content, status: params.status, errorSummary: params.errorSummary || null }
    }),
    prisma.conversation.updateMany({
      where: { id: params.conversationId, activeGenerationId: params.messageId },
      data: { activeGenerationId: null, activeGenerationStarted: null, lastMessageAt: new Date() }
    })
  ])
}
