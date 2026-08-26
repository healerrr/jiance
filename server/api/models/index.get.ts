import { prisma } from '../../utils/prisma'
import { decryptApiKey, maskApiKey } from '../../utils/crypto'
import { publicModelConfig } from '../../utils/model-configs'
import { getEncryptionMasterKey } from '../../utils/runtime-secret'

export default defineEventHandler(async (event) => {
  const masterKey = getEncryptionMasterKey()
  const items = await prisma.modelConfig.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] })
  return items.map((item) => {
    let masked = '••••••••'
    try {
      masked = maskApiKey(decryptApiKey(item.apiKeyEncrypted, masterKey))
    } catch {
      // A corrupt credential stays opaque in list responses.
    }
    return publicModelConfig(item, masked)
  })
})
