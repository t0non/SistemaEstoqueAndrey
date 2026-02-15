import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';

export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toDate(): Date {
    return new Date(this.seconds * 1000);
  }

  static now(): Timestamp {
    const now = new Date();
    return new Timestamp(Math.floor(now.getTime() / 1000), 0);
  }

  static fromDate(date: Date): Timestamp {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }
}

const STORAGE_PREFIX = 'estoque_app_';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const dispatchUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('local-storage-update'));
  }
};

const serializeTimestamps = (data: any) => {
  const result: any = { ...data };
  if (result.createdAt instanceof Timestamp) {
    result.createdAt = result.createdAt.toDate().toISOString();
  }
  if (result.updatedAt instanceof Timestamp) {
    result.updatedAt = result.updatedAt.toDate().toISOString();
  }
  if (result.date instanceof Timestamp) {
    result.date = result.date.toDate().toISOString();
  }
  return result;
};

const deserializeTimestamps = (item: any) => {
  if (!item) return item;
  const result: any = { ...item };
  if (typeof result.createdAt === 'string') {
    result.createdAt = Timestamp.fromDate(new Date(result.createdAt));
  }
  if (typeof result.updatedAt === 'string') {
    result.updatedAt = Timestamp.fromDate(new Date(result.updatedAt));
  }
  if (typeof result.date === 'string') {
    result.date = Timestamp.fromDate(new Date(result.date));
  }
  return result;
};

export const storage = {
  async get<T>(collection: string): Promise<T[]> {
    await delay(50);
    if (supabase) {
      const { data, error } = await supabase.from(collection).select('*');
      if (error) {
        console.error(`Supabase get error for ${collection}:`, error);
        return [];
      }
      const list = Array.isArray(data) ? data : [];
      return list.map(deserializeTimestamps) as T[];
    }
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${collection}`);
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`Error parsing storage for ${collection}:`, e);
      return [];
    }
  },

  async getById<T>(collection: string, id: string): Promise<T | null> {
    await delay(50);
    if (supabase) {
      const { data, error } = await supabase
        .from(collection)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        console.error(`Supabase getById error for ${collection}:`, error);
        return null;
      }
      return data ? (deserializeTimestamps(data) as T) : null;
    }
    const items = await this.get<any>(collection);
    return items.find(item => item.id === id) || null;
  },

  async add<T>(collection: string, data: Omit<T, 'id'>): Promise<string> {
    await delay(50);
    if (supabase) {
      const payload = serializeTimestamps(data);
      const { data: inserted, error } = await supabase
        .from(collection)
        .insert({ ...payload })
        .select('id')
        .maybeSingle();
      if (error) {
        console.error(`Supabase add error for ${collection}:`, error);
        throw error;
      }
      const newId = (inserted as any)?.id ?? uuidv4();
      dispatchUpdate();
      return newId;
    }
    const items = await this.get<any>(collection);
    const id = uuidv4();
    const newItem = { ...data, id, createdAt: Timestamp.now() };
    items.push(newItem);
    localStorage.setItem(`${STORAGE_PREFIX}${collection}`, JSON.stringify(items));
    dispatchUpdate();
    return id;
  },

  async set<T>(collection: string, id: string, data: any): Promise<void> {
    await delay(50);
    if (supabase) {
      const payload = serializeTimestamps({ ...data, id });
      const { error } = await supabase.from(collection).upsert(payload);
      if (error) {
        console.error(`Supabase set error for ${collection}:`, error);
        throw error;
      }
      dispatchUpdate();
      return;
    }
    const items = await this.get<any>(collection);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...data, updatedAt: Timestamp.now() };
    } else {
      items.push({ ...data, id, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    }
    localStorage.setItem(`${STORAGE_PREFIX}${collection}`, JSON.stringify(items));
    dispatchUpdate();
  },

  async update<T>(collection: string, id: string, data: Partial<T>): Promise<void> {
    await delay(50);
    if (supabase) {
      const base: any = {};
      const updatedData: any = {};
      for (const key in data) {
        const value = (data as any)[key];
        if (value && typeof value === 'object' && (value as any).__op === 'increment') {
          base[key] = value;
        } else {
          updatedData[key] = value;
        }
      }
      const serialized = serializeTimestamps(updatedData);
      const { error } = await supabase
        .from(collection)
        .update(serialized)
        .eq('id', id);
      if (error) {
        console.error(`Supabase update error for ${collection}:`, error);
        throw error;
      }
      dispatchUpdate();
      return;
    }
    const items = await this.get<any>(collection);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      const currentItem = items[index];
      const updatedData: any = {};
      for (const key in data) {
        const value = (data as any)[key];
        if (value && typeof value === 'object' && (value as any).__op === 'increment') {
          updatedData[key] = (currentItem[key] || 0) + (value as any).value;
        } else {
          updatedData[key] = value;
        }
      }
      items[index] = { ...currentItem, ...updatedData, updatedAt: Timestamp.now() };
      localStorage.setItem(`${STORAGE_PREFIX}${collection}`, JSON.stringify(items));
      dispatchUpdate();
    } else {
      throw new Error(`Item ${id} not found in ${collection}`);
    }
  },

  async delete(collection: string, id: string): Promise<void> {
    await delay(50);
    if (supabase) {
      const { error } = await supabase.from(collection).delete().eq('id', id);
      if (error) {
        console.error(`Supabase delete error for ${collection}:`, error);
        throw error;
      }
      dispatchUpdate();
      return;
    }
    const items = await this.get<any>(collection);
    const newItems = items.filter(item => item.id !== id);
    localStorage.setItem(`${STORAGE_PREFIX}${collection}`, JSON.stringify(newItems));
    dispatchUpdate();
  },
  
  // Transaction simulator (simple sequence)
  async runTransaction(updateFunction: (transaction: any) => Promise<void>): Promise<void> {
      const operations: any[] = [];
      const transaction = {
          get: async (ref: any) => {
             const item = await this.getById(ref.collection, ref.id);
             return {
                 exists: () => !!item,
                 data: () => item,
                 id: ref.id,
                 ref: ref
             };
          },
          update: (ref: any, data: any) => {
              operations.push({ type: 'update', ref, data });
              return transaction;
          },
          set: (ref: any, data: any) => {
               operations.push({ type: 'set', ref, data });
               return transaction;
          },
          delete: (ref: any) => {
              operations.push({ type: 'delete', ref });
              return transaction;
          }
      };
      
      await updateFunction(transaction);

      // Commit operations
      for (const op of operations) {
          if (op.type === 'set') {
              await this.set(op.ref.collection, op.ref.id, op.data);
          } else if (op.type === 'update') {
              await this.update(op.ref.collection, op.ref.id, op.data);
          } else if (op.type === 'delete') {
              await this.delete(op.ref.collection, op.ref.id);
          }
      }
  }
};
