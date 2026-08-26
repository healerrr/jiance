import { createError } from 'h3'

/**
 * Read the master key only from the running server process. Keeping it out of
 * Nuxt runtimeConfig prevents build-time `.env` values from being embedded in
 * `.output`.
 */
export function getEncryptionMasterKey() {
  const secret = process.env.ENCRYPTION_MASTER_KEY
  if (!secret) throw createError({ statusCode: 500, statusMessage: '服务端未配置加密主密钥' })
  return secret
}
