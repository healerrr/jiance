import type { ModelConfig, Prisma } from '@prisma/client'
import { prisma } from './prisma'

export function publicModelConfig(config: ModelConfig, maskedKey = '••••••••') {
  const { apiKeyEncrypted: _secret, ...safe } = config
  return { ...safe, apiKeyMasked: maskedKey }
}

export async function setDefaultModel(id: string) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.modelConfig.findUnique({ where: { id } })
    if (!target) throw createError({ statusCode: 404, statusMessage: '模型配置不存在' })
    if (!target.enabled) throw createError({ statusCode: 400, statusMessage: '停用的模型不能设为默认' })
    await tx.modelConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
    return tx.modelConfig.update({ where: { id }, data: { isDefault: true } })
  })
}

export async function saveModelConfigDefaults(tx: Prisma.TransactionClient, id: string, enabled: boolean, requestedDefault: boolean) {
  if (requestedDefault) {
    if (!enabled) throw createError({ statusCode: 400, statusMessage: '停用的模型不能设为默认' })
    await tx.modelConfig.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } })
  }
}

export async function selectModel(modelConfigId?: string | null) {
  if (modelConfigId) {
    const selected = await prisma.modelConfig.findFirst({ where: { id: modelConfigId, enabled: true } })
    if (!selected) throw createError({ statusCode: 400, statusMessage: '选择的模型不存在或已停用' })
    return selected
  }
  const defaultModel = await prisma.modelConfig.findFirst({ where: { enabled: true, isDefault: true } })
  if (!defaultModel) throw createError({ statusCode: 409, statusMessage: '尚未配置可用的默认模型' })
  return defaultModel
}
