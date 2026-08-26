import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } }
  })
  if (!conversation) throw createError({ statusCode: 404, statusMessage: '会话不存在' })

  const { metadataJson, activeGenerationId, ...safe } = conversation
  return {
    ...safe,
    metadata: metadataJson ? JSON.parse(metadataJson) : null,
    generating: Boolean(activeGenerationId),
    activeGenerationId
  }
})
