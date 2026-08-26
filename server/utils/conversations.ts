import { Prisma } from '@prisma/client'
import type { z } from 'zod'
import type { resolveConversationSchema } from './validation'
import { prisma } from './prisma'

type ResolveInput = z.infer<typeof resolveConversationSchema>

export async function resolveConversation(input: ResolveInput) {
  const existing = await prisma.conversation.findUnique({ where: { externalKey: input.externalKey } })
  if (existing) return { conversation: existing, created: false }

  const title = `${input.sampleName || input.cas} · ${input.testProject}`
  try {
    const conversation = await prisma.conversation.create({
      data: {
        externalKey: input.externalKey,
        title,
        cas: input.cas,
        testProject: input.testProject,
        sampleName: input.sampleName || null,
        sampleCode: input.sampleCode || null,
        confirmedContent: input.confirmedContent,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        messages: {
          create: {
            role: 'user',
            content: input.confirmedContent,
            status: 'completed'
          }
        }
      }
    })
    return { conversation, created: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const conversation = await prisma.conversation.findUniqueOrThrow({ where: { externalKey: input.externalKey } })
      return { conversation, created: false }
    }
    throw error
  }
}

export async function deleteConversation(id: string) {
  await prisma.$transaction(async (tx) => {
    const exists = await tx.conversation.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw createError({ statusCode: 404, statusMessage: '会话不存在' })
    await tx.message.deleteMany({ where: { conversationId: id } })
    await tx.conversation.delete({ where: { id } })
  })
}
