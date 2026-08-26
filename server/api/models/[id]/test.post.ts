import { prisma } from '../../../utils/prisma'
import { runnableModel, testConnection } from '../../../utils/model-adapter'
import { getEncryptionMasterKey } from '../../../utils/runtime-secret'

export default defineEventHandler(async (event) => {
  const config = await prisma.modelConfig.findUnique({ where: { id: getRouterParam(event, 'id')! } })
  if (!config) throw createError({ statusCode: 404, statusMessage: '模型配置不存在' })
  try {
    return await testConnection(runnableModel(config, getEncryptionMasterKey()))
  } catch {
    throw createError({ statusCode: 502, statusMessage: '连接测试失败，请检查地址、密钥和模型名称' })
  }
})
