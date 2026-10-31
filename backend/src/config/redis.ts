import Redis, { RedisOptions } from 'ioredis';

let isRedisConnected = false;

const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 5) {
      // Stop retrying excessively if Redis is absent in local dev
      return null;
    }
    return Math.min(times * 500, 2000);
  },
};

const redisClient: Redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    })
  : new Redis(redisOptions);

redisClient.on('connect', () => {
  isRedisConnected = true;
  console.log('Redis client connected');
});

redisClient.on('ready', () => {
  isRedisConnected = true;
  console.log('Redis client ready for caching');
});

redisClient.on('error', (err: any) => {
  isRedisConnected = false;
  // Non-fatal warning so application proceeds smoothly
  if (err?.code === 'ECONNREFUSED') {
    // Suppress spammy log on connection refusal
  } else {
    console.warn(`Redis notice: ${err.message}`);
  }
});

redisClient.on('close', () => {
  isRedisConnected = false;
});

// Initialize connection safely
export const initRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    isRedisConnected = true;
    console.log('Redis initialized successfully');
  } catch (error: any) {
    isRedisConnected = false;
    console.warn(
      '⚠️ Redis is not available. Caching & presence will gracefully use direct database queries and memory.'
    );
  }
};

export const isRedisAvailable = (): boolean => isRedisConnected;

// Cache Helpers
export const getCache = async <T>(key: string): Promise<T | null> => {
  if (!isRedisConnected) return null;
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    return null;
  }
};

export const setCache = async (
  key: string,
  value: any,
  ttlSeconds: number = 120
): Promise<void> => {
  if (!isRedisConnected) return;
  try {
    const serialized = JSON.stringify(value);
    await redisClient.set(key, serialized, 'EX', ttlSeconds);
  } catch (err) {
    // Fail silently to DB
  }
};

export const delCache = async (key: string): Promise<void> => {
  if (!isRedisConnected) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    // Fail silently
  }
};

export const delCacheByPattern = async (pattern: string): Promise<void> => {
  if (!isRedisConnected) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (err) {
    // Fail silently
  }
};

// Distributed Online Presence Helpers
const ONLINE_USERS_KEY = 'presence:online_users';

export const trackUserOnline = async (userId: string): Promise<void> => {
  if (!isRedisConnected) return;
  try {
    await redisClient.sadd(ONLINE_USERS_KEY, userId);
  } catch (err) {
    // Fail silently to in-memory presence
  }
};

export const trackUserOffline = async (userId: string): Promise<void> => {
  if (!isRedisConnected) return;
  try {
    await redisClient.srem(ONLINE_USERS_KEY, userId);
  } catch (err) {
    // Fail silently
  }
};

export const getOnlineUsersFromRedis = async (): Promise<string[]> => {
  if (!isRedisConnected) return [];
  try {
    return await redisClient.smembers(ONLINE_USERS_KEY);
  } catch (err) {
    return [];
  }
};

export default redisClient;
