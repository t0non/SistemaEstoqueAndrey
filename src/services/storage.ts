import { v4 as uuidv4 } from 'uuid';

// Simulating Firestore Timestamp
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

// Local Storage Wrapper
const STORAGE_PREFIX = 'estoque_app_';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const dispatchUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('local-storage-update'));
  }
};

export const storage = {
  async get<T>(collection: string): Promise<T[]> {
    await delay(50); // Minimal latency
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(`${STORAGE_PREFIX}${collection}`);
    try {
        const parsed = data ? JSON.parse(data) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error(`Error parsing storage for ${collection}:`, e);
        return [];
    }
  },

  async getById<T>(collection: string, id: string): Promise<T | null> {
    await delay(50);
    const items = await this.get<any>(collection);
    return items.find(item => item.id === id) || null;
  },

  async add<T>(collection: string, data: Omit<T, 'id'>): Promise<string> {
    await delay(50);
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
    const items = await this.get<any>(collection);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      const currentItem = items[index];
      const updatedData: any = {};
      
      for (const key in data) {
          const value = (data as any)[key];
          if (value && typeof value === 'object' && value.__op === 'increment') {
              updatedData[key] = (currentItem[key] || 0) + value.value;
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
