import { prisma } from '../utils/prisma'
import { settingsSchema, validationMessage } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const parsed = settingsSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: validationMessage(parsed.error) })
  return prisma.appSetting.upsert({
    where: { id: 'global' },
    create: { id: 'global', ...parsed.data },
    update: parsed.data
  })
})
