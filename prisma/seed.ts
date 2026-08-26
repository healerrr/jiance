import { PrismaClient } from '@prisma/client'
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

}

main()
  .finally(async () => prisma.$disconnect())
