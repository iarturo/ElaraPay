import { Redis } from '@upstash/redis';

function getEnv(key: string): string {
  const val = process.env[key];
  if (val === undefined) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return val;
}

export const redis = new Redis({
  url: getEnv('UPSTASH_REDIS_REST_URL'),
  token: getEnv('UPSTASH_REDIS_REST_TOKEN'),
});
