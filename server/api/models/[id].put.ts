import { prisma } from '../../utils/prisma'
import { encryptApiKey } from '../../utils/crypto'
import { publicModelConfig } from '../../utils/model-configs'
import { modelConfigUpdateSchema, validationMessage } from '../../utils/validation'
import { getEncryptionMasterKey } from '../../utils/runtime-secret'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const parsed = modelConfigUpdateSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: validationMessage(parsed.error) })
  const existing = await prisma.modelConfig.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: '模型配置不存在' })

  if (existing.isDefault && (parsed.data.enabled === false || parsed.data.isDefault === false)) {
    throw createError({ statusCode: 400, statusMessage: '请先将其他启用模型设为默认' })
  }
  const masterKey = getEncryptionMasterKey()
  const { apiKey, ...changes } = parsed.data
  const enabled = changes.enabled ?? existing.enabled
  const makeDefault = changes.isDefault ?? existing.isDefault
  if (makeDefault && !enabled) throw createError({ statusCode: 400, statusMessage: '停用的模型不能设为默认' })

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (makeDefault) await tx.modelConfig.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } })
      return tx.modelConfig.update({
        where: { id },
        data: {
          ...changes,
          ...(apiKey ? { apiKeyEncrypted: encryptApiKey(apiKey, masterKey) } : {})
        }
      })
    })
    return publicModelConfig(updated)
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: '配置名称已存在' })
    throw error
  }
})
