import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const config = await prisma.modelConfig.findUnique({ where: { id } })
  if (!config) throw createError({ statusCode: 404, statusMessage: '模型配置不存在' })
  if (config.isDefault) throw createError({ statusCode: 400, statusMessage: '默认模型不能删除，请先切换默认模型' })
  const fallback = await prisma.modelConfig.findFirst({ where: { isDefault: true, enabled: true } })
  await prisma.$transaction(async (tx) => {
    await tx.conversation.updateMany({
      where: { currentModelConfigId: id },
      data: {
        currentModelConfigId: fallback?.id || null,
        currentModelName: fallback?.modelName || null
      }
    })
    await tx.modelConfig.delete({ where: { id } })
  })
  return { ok: true }
})
