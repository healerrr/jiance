import { DEFAULT_CONTEXT_MAX_CHARS, DEFAULT_CONTEXT_MAX_MESSAGES, DEFAULT_SYSTEM_PROMPT } from '../../shared/constants'
import { prisma } from './prisma'

export async function getAppSettings() {
  return prisma.appSetting.upsert({
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
