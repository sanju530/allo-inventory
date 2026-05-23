import path from 'path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  migrate: {
    async adapter() {
      const { PrismaNeon } = await import('@prisma/adapter-neon')
      const { neonConfig, Pool } = await import('@neondatabase/serverless')
      const ws = await import('ws')
      neonConfig.webSocketConstructor = ws.default
      const pool = new Pool({
        connectionString: process.env.DIRECT_URL,
      })
      return new PrismaNeon(pool)
    },
  },
})