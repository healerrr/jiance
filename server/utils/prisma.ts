import { PrismaClient } from '@prisma/client'
import { resolve } from 'node:path'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export function resolveDatabaseUrl(url = process.env.DATABASE_URL) {
  if (!url?.startsWith('file:')) return url
  const filePath = url.slice('file:'.length)
  if (filePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(filePath)) return url
  const absolutePath = resolve(process.cwd(), 'prisma', filePath).replace(/\\/g, '/')
  return `file:${absolutePath}`
}

const datasourceUrl = resolveDatabaseUrl()
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
  ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {})
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
