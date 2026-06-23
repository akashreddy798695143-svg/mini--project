import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function isTransientPrismaError(err: unknown) {
  const msg = String(err ?? '')
  return (
    // @ts-ignore - some Prisma errors include .code
    (err && typeof (err as any).code === 'string' && (err as any).code === 'P2024') ||
    /Timed out fetching a new connection|connection pool|Can't reach database|ENOTFOUND|ECONNREFUSED/i.test(msg)
  )
}

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 1000): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      attempt++
      if (attempt > retries || !isTransientPrismaError(err)) throw err
      const wait = baseDelay * Math.pow(2, attempt - 1)
      // eslint-disable-next-line no-console
      console.warn(`Prisma transient error, retrying (${attempt}/${retries}) after ${wait}ms:`, String(err))
      await new Promise((res) => setTimeout(res, wait))
    }
  }
}

function createRetryProxy<T extends object>(client: T): T {
  const handler: ProxyHandler<T> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)

      if (typeof prop === 'string' && prop.startsWith('$')) {
        return value
      }

      if (value && typeof value === 'object') {
        return new Proxy(value, {
          get(modelTarget, modelProp, modelReceiver) {
            const method = Reflect.get(modelTarget, modelProp, modelReceiver)
            if (typeof method === 'function') {
              return (...args: unknown[]) => withDbRetry(() => method.apply(modelTarget, args as []), 3, 1000)
            }
            return method
          },
        })
      }

      return value
    },
  }

  return new Proxy(client, handler)
}

const client =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

export const db = createRetryProxy(client)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
