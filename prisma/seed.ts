import { PrismaClient } from '@prisma/client'
import { encryptApiKey } from '../server/utils/crypto'
import { BAILIAN_API_BASE_URL, BAILIAN_MODEL_PRESETS, LEGACY_DEMO_MODEL } from '../shared/bailian-models'
import { DEFAULT_CONTEXT_MAX_CHARS, DEFAULT_CONTEXT_MAX_MESSAGES, DEFAULT_SYSTEM_PROMPT } from '../shared/constants'

const prisma = new PrismaClient()

async function main() {
  await prisma.appSetting.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      globalSystemPrompt: DEFAULT_SYSTEM_PROMPT,
      contextMaxMessages: DEFAULT_CONTEXT_MAX_MESSAGES,
      contextMaxChars: DEFAULT_CONTEXT_MAX_CHARS
    }
  })

  const bailianApiKey = process.env.BAILIAN_API_KEY?.trim()
  const encryptionMasterKey = process.env.ENCRYPTION_MASTER_KEY?.trim()

  await prisma.$transaction(async (tx) => {
    const provisionedIds: string[] = []
    let preferredDefaultId: string | undefined

    if (bailianApiKey) {
      if (!encryptionMasterKey) throw new Error('ENCRYPTION_MASTER_KEY is required when BAILIAN_API_KEY is set')
      const encryptedKey = encryptApiKey(bailianApiKey, encryptionMasterKey)

      for (const preset of BAILIAN_MODEL_PRESETS) {
        const byEndpoint = await tx.modelConfig.findFirst({
          where: { apiBaseUrl: BAILIAN_API_BASE_URL, modelName: preset.modelName }
        })
        const byName = byEndpoint || await tx.modelConfig.findUnique({ where: { name: preset.name } })
        const data = {
          name: preset.name,
          apiBaseUrl: BAILIAN_API_BASE_URL,
          apiKeyEncrypted: encryptedKey,
          modelName: preset.modelName,
          temperature: preset.temperature,
          maxOutputTokens: preset.maxOutputTokens,
          timeoutMs: preset.timeoutMs,
          enabled: true,
          isDefault: false
        }
        const model = byName
          ? await tx.modelConfig.update({ where: { id: byName.id }, data })
          : await tx.modelConfig.create({ data })
        provisionedIds.push(model.id)
        if (preset.isDefault) preferredDefaultId = model.id
      }

      if (preferredDefaultId) {
        await tx.modelConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
        await tx.modelConfig.update({ where: { id: preferredDefaultId }, data: { isDefault: true } })
      }
    }

    const legacyModels = await tx.modelConfig.findMany({
      where: {
        OR: [
          { name: LEGACY_DEMO_MODEL.name },
          { apiBaseUrl: LEGACY_DEMO_MODEL.apiBaseUrl, modelName: LEGACY_DEMO_MODEL.modelName }
        ]
      },
      select: { id: true }
    })
    const legacyIds = legacyModels.map(model => model.id)

    let fallback = preferredDefaultId
      ? await tx.modelConfig.findUnique({ where: { id: preferredDefaultId } })
      : null
    if (!fallback) {
      fallback = await tx.modelConfig.findFirst({
        where: {
          enabled: true,
          ...(legacyIds.length ? { id: { notIn: legacyIds } } : {})
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
      })
    }

    if (fallback && !fallback.isDefault) {
      await tx.modelConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      fallback = await tx.modelConfig.update({ where: { id: fallback.id }, data: { isDefault: true } })
    }

    for (const legacy of legacyModels) {
      await tx.conversation.updateMany({
        where: { currentModelConfigId: legacy.id },
        data: {
          currentModelConfigId: fallback?.id || null,
          currentModelName: fallback?.modelName || null
        }
      })
      await tx.modelConfig.delete({ where: { id: legacy.id } })
    }

    if (bailianApiKey && provisionedIds.length !== BAILIAN_MODEL_PRESETS.length) {
      throw new Error('Bailian model provisioning did not complete')
    }
  })

  console.log(bailianApiKey
    ? `Provisioned ${BAILIAN_MODEL_PRESETS.length} Bailian model configurations.`
    : 'BAILIAN_API_KEY is not set; skipped Bailian model provisioning.')
}

main()
  .finally(async () => prisma.$disconnect())
