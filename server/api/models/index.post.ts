import { prisma } from '../../utils/prisma'
import { encryptApiKey } from '../../utils/crypto'
import { publicModelConfig } from '../../utils/model-configs'
import { modelConfigCreateSchema, validationMessage } from '../../utils/validation'
import { getEncryptionMasterKey } from '../../utils/runtime-secret'

export default defineEventHandler(async (event) => {
  const parsed = modelConfigCreateSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: validationMessage(parsed.error) })
  const masterKey = getEncryptionMasterKey()
  const { apiKey, ...data } = parsed.data

  try {
    const created = await prisma.$transaction(async (tx) => {
      const defaultCount = await tx.modelConfig.count({ where: { isDefault: true } })
      const makeDefault = data.enabled && (data.isDefault || defaultCount === 0)
      if (makeDefault) await tx.modelConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      return tx.modelConfig.create({
        data: { ...data, isDefault: makeDefault, apiKeyEncrypted: encryptApiKey(apiKey, masterKey) }
      })
    })
    return publicModelConfig(created)
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, statusMessage: '配置名称已存在' })
    throw error
  }
})
