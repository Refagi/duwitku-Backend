import { z } from 'zod';
import type{ TokenTypeConfig } from '@/models/token.js';
// import type { PusherTypeConfig } from '@/models/pusher.model.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().trim().min(1, { message: 'DATABASE_URL is required' }),
  JWT_SECRET: z.string().trim().min(1, { message: 'JWT_SECRET is required' }),
  JWT_ACCESS_EXPIRATION_MINUTES: z.coerce.number().default(60),
  JWT_REFRESH_EXPIRATION_DAYS: z.coerce.number().default(30),
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES: z.coerce.number().default(5),
  JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: z.coerce.number().default(5),
  FRONTEND_URL: z.string(),
  // PUSHER_APP_ID: z.string().trim().min(1, { message: 'PUSHER_APP_ID is required' }),
  // PUSHER_KEY: z.string().trim().min(1, { message: 'PUSHER_KEY is required' }),
  // PUSHER_SECRET: z.string().trim().min(1, { message: 'PUSHER_SECRET is required' }),
  // PUSHER_CLUSTER: z.string().trim().min(1, { message: 'PUSHER_CLUSTER is required' }),

});

class AppConfig {
  private typeEnv: z.infer<typeof envSchema>;
  private databaseUrl: string | null = null;

  constructor() {
    const parsedEnv = envSchema.safeParse(process.env);

    if (!parsedEnv.success) {
      console.error("Environment variables validation failed: ", z.treeifyError(parsedEnv.error));
      throw new Error("Invalid environment configuration");
    }

    this.typeEnv= parsedEnv.data;
    this.databaseUrl = this.typeEnv.DATABASE_URL;
 }


  get env(): string {
    return this.typeEnv.NODE_ENV;
  }

  get port(): number {
    return this.typeEnv.PORT;
  }

  get database(): string {
    if(!this.databaseUrl) {
      throw new Error("Database URL is not initilized");
    }
    return this.databaseUrl!;
  }

  get jwt(): TokenTypeConfig{
    return {
      secret: this.typeEnv.JWT_SECRET,
      accessExpirationMinutes: this.typeEnv.JWT_ACCESS_EXPIRATION_MINUTES,
      refreshExpirationDays: this.typeEnv.JWT_REFRESH_EXPIRATION_DAYS,
      resetPasswordExpirationMinutes: this.typeEnv.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
      verifyEmailExpirationMinutes: this.typeEnv.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES
    }
  }
  get fe(): string {
    return this.typeEnv.FRONTEND_URL;
  }
}

export const config = new AppConfig();
