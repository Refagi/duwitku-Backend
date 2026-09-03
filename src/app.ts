import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { secureHeaders } from 'hono/secure-headers'
import { cors } from 'hono/cors'
import { compress } from 'hono/compress'
import { honoLogger } from '@logtape/hono'
import { config } from '@/config/config.js'
import { errorHandler } from '@/middlewares/error.js'
import routes from '@/routes/index.js'
import { authRateLimiter } from '@/middlewares/ratelimiter.js'

const app = new Hono().basePath('/v1')

if (config.env !== 'test' && config.env !== 'production') {
  app.use(honoLogger({ category: ['app', 'http'], format: 'dev' }))
}

// app.use('*', csrf())

if (config.env === 'production') {
  app.use('/v1', authRateLimiter)
}

app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
  }),
)

app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowedOrigins = [process.env.FRONTEND_URL].filter((v): v is string => Boolean(v))

      if (origin && origin.includes('vercel.app')) return origin
      if (origin && origin.startsWith('http://localhost:')) {
        return origin
      }
      if (origin && allowedOrigins.includes(origin)) {
        return origin
      }
      return 'http://localhost:5173'
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

app.use('*', compress({ encoding: 'gzip' }))

app.route('/', routes)

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.get('/', (c) => {
  return c.json({ message: 'Personal Finance API is running' })
})

app.onError(errorHandler)

app.notFound((c) => {
  return c.json({ code: 404, message: 'Route not found' }, 404)
})

export default app
