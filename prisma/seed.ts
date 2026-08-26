import { PrismaClient } from '@prisma/client'
import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { DEFAULT_CONTEXT_MAX_CHARS, DEFAULT_CONTEXT_MAX_MESSAGES, DEFAULT_SYSTEM_PROMPT } from '../shared/constants'

const prisma = new PrismaClient()

function encryptForSeed(value: string) {
  const secret = process.env.ENCRYPTION_MASTER_KEY
  if (!secret) throw new Error('ENCRYPTION_MASTER_KEY is required')
  const key = createHash('sha256').update(secret).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

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

  const currentDefault = await prisma.modelConfig.findFirst({ where: { isDefault: true } })
  if (!currentDefault) {
    await prisma.modelConfig.upsert({
      where: { name: '内置演示模型' },
      update: { enabled: true, isDefault: true },
      create: {
        name: '内置演示模型',
        apiBaseUrl: 'mock://chemical-assistant',
        apiKeyEncrypted: encryptForSeed('mock-development-key'),
        modelName: 'chemical-mock-v1',
        temperature: 0.3,
        maxOutputTokens: 2000,
        timeoutMs: 60000,
        enabled: true,
        isDefault: true
      }
    })
  }
}

main()
  .finally(async () => prisma.$disconnect())
