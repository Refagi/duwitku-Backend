import { rateLimiter } from "hono-rate-limiter";

export const authRateLimiter = rateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  keyGenerator: (c) => {
    return (
      c.req.header('x-forwarded-for') || 'anonymous'
    );
  },
  skipSuccessfulRequests: true
});
