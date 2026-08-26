import { stopRegisteredGeneration } from '../../../utils/generation-registry'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const message = await prisma.message.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!message) throw createError({ statusCode: 404, statusMessage: '消息不存在' })
  if (message.status !== 'generating') return { ok: true, stopped: false }
  return { ok: true, stopped: stopRegisteredGeneration(id) }
})
