import { plainToInstance } from 'class-transformer';
import { IsIn, IsOptional, IsString, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: string;

  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  API_PORT?: string;

  @IsOptional()
  @IsString()
  API_GLOBAL_PREFIX?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL?: string;

  @IsOptional()
  @IsString()
  REFRESH_COOKIE_NAME?: string;

  @IsString()
  RAZORPAY_KEY_ID!: string;

  @IsString()
  RAZORPAY_KEY_SECRET!: string;

  @IsString()
  RAZORPAY_WEBHOOK_SECRET!: string;

  @IsOptional()
  @IsString()
  PAYMENTS_CURRENCY?: string;

  @IsOptional()
  @IsString()
  FREE_SHIPPING_THRESHOLD?: string;

  @IsOptional()
  @IsString()
  FLAT_SHIPPING_FEE?: string;

  @IsOptional()
  @IsString()
  LOW_STOCK_THRESHOLD?: string;

  @IsOptional()
  @IsString()
  THROTTLE_DEFAULT_TTL_MS?: string;

  @IsOptional()
  @IsString()
  THROTTLE_DEFAULT_LIMIT?: string;

  @IsOptional()
  @IsString()
  THROTTLE_AUTH_TTL_MS?: string;

  @IsOptional()
  @IsString()
  THROTTLE_AUTH_LIMIT?: string;

  @IsOptional()
  @IsString()
  THROTTLE_SENSITIVE_TTL_MS?: string;

  @IsOptional()
  @IsString()
  THROTTLE_SENSITIVE_LIMIT?: string;

  @IsOptional()
  @IsString()
  THROTTLE_OTP_VERIFY_TTL_MS?: string;

  @IsOptional()
  @IsString()
  THROTTLE_OTP_VERIFY_LIMIT?: string;

  @IsOptional()
  @IsString()
  THROTTLE_OTP_RESEND_TTL_MS?: string;

  @IsOptional()
  @IsString()
  THROTTLE_OTP_RESEND_LIMIT?: string;

  @IsOptional()
  @IsString()
  RESEND_API_KEY?: string;

  @IsOptional()
  @IsString()
  RESEND_FROM_EMAIL?: string;

  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_PASSWORD?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_CLOUD_NAME?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_API_KEY?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_API_SECRET?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }
  return validated;
}
