import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  timestamp: number;
  ttl: number; // TTL in milliseconds
  data: T;
}

const CACHE_PREFIX = '@app_cache_';

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = CACHE_PREFIX + key;
      const jsonValue = await AsyncStorage.getItem(fullKey);
      if (jsonValue === null) {
        return null;
      }

      const item: CacheItem<T> = JSON.parse(jsonValue);
      const now = Date.now();

      if (now > item.timestamp + item.ttl) {
        // Cache expired
        await AsyncStorage.removeItem(fullKey);
        console.log(`Cache expired and removed for key: ${key}`);
        return null;
      }
      console.log(`Cache hit for key: ${key}`);
      return item.data;
    } catch (e) {
      console.error('Error getting cache item:', e);
      return null;
    }
  },

  async set<T>(key: string, data: T, ttlMinutes: number): Promise<void> {
    try {
      const fullKey = CACHE_PREFIX + key;
      const timestamp = Date.now();
      const ttlMilliseconds = ttlMinutes * 60 * 1000;
      const item: CacheItem<T> = { timestamp, ttl: ttlMilliseconds, data };
      const jsonValue = JSON.stringify(item);
      await AsyncStorage.setItem(fullKey, jsonValue);
      console.log(`Cache set for key: ${key} with TTL: ${ttlMinutes} minutes`);
    } catch (e) {
      console.error('Error setting cache item:', e);
    }
  },

  async invalidate(key: string): Promise<void> {
    try {
      const fullKey = CACHE_PREFIX + key;
      await AsyncStorage.removeItem(fullKey);
      console.log(`Cache invalidated for key: ${key}`);
    } catch (e) {
      console.error('Error invalidating cache item:', e);
    }
  },

  // Optional: Clear all cache items managed by this service
  async clearAllAppCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appCacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(appCacheKeys);
      console.log('All app cache cleared');
    } catch (e) {
      console.error('Error clearing all app cache:', e);
    }
  }
};
