'use client';

import { useState, useEffect, useMemo } from 'react';
import { storage, Timestamp } from '@/services/storage';
export { Timestamp } from '@/services/storage';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';

export interface DocumentReference {
  type: 'doc';
  collection: string;
  id: string;
  path: string;
}

export interface DocumentSnapshot<T = any> {
  exists: () => boolean;
  data: () => T | undefined;
  id: string;
}

export function useUser() {
  const [user, setUser] = useState<{
    uid: string;
    email: string | null;
    displayName: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setUser({
        uid: 'local-user',
        email: 'user@local.com',
        displayName: 'Usuário Local',
      });
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const { data, error } = await client.auth.getUser();
      if (cancelled) return;
      if (error || !data.user) {
        setUser(null);
      } else {
        const u = data.user;
        setUser({
          uid: u.id,
          email: u.email ?? null,
          displayName: (u.user_metadata as any)?.name ?? null,
        });
      }
      setIsLoading(false);
    };

    load();

    const subscription = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const u = session?.user;
      if (!u) {
        setUser(null);
      } else {
        setUser({
          uid: u.id,
          email: u.email ?? null,
          displayName: (u.user_metadata as any)?.name ?? null,
        });
      }
    });

    return () => {
      cancelled = true;
      subscription.data?.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isLoading,
    isUserLoading: isLoading,
  };
}

export function useAuth() {
  return useMemo(() => (supabase ? supabase.auth : null), []);
}

export function useFirestore() {
  return useMemo(() => ({}), []);
}

export const signInWithEmailAndPassword = async (auth: any, email: string, pass: string) => {
  if (!supabase) {
    return {
      user: {
        uid: 'local-user',
        email,
        displayName: 'Usuário Local',
      },
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error || !data.user) {
    const mapped: any = new Error(error?.message || 'Falha no login');
    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('invalid login credentials')) {
      mapped.code = 'auth/invalid-credential';
    } else if (msg.includes('email not confirmed') || msg.includes('confirm your email') || msg.includes('email confirmation')) {
      mapped.code = 'auth/email-not-confirmed';
    } else if (error?.code) {
      mapped.code = error.code;
    } else {
      mapped.code = 'auth/error';
    }
    throw mapped;
  }

  return {
    user: {
      uid: data.user.id,
      email: data.user.email,
      displayName: (data.user.user_metadata as any)?.name ?? '',
    },
  };
};

export const createUserWithEmailAndPassword = async (auth: any, email: string, pass: string) => {
  if (!supabase) {
    return {
      user: {
        uid: 'local-user',
        email,
        displayName: 'Usuário Local',
      },
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
  });

  if (error || !data.user) {
    const mapped: any = new Error(error?.message || 'Falha ao criar usuário');
    if (error?.code === 'user_already_exists') {
      mapped.code = 'auth/email-already-in-use';
    } else if (error?.code) {
      mapped.code = error.code;
    } else {
      mapped.code = 'auth/error';
    }
    throw mapped;
  }

  return {
    user: {
      uid: data.user.id,
      email: data.user.email,
      displayName: (data.user.user_metadata as any)?.name ?? '',
    },
  };
};

export const sendPasswordResetEmail = async (auth: any, email: string) => {
  if (!supabase) {
    return;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    const mapped: any = new Error(error.message);
    mapped.code = error.code || 'auth/error';
    throw mapped;
  }
};

export const signOut = async (auth: any) => {
  if (!supabase) {
    return;
  }
  const { error } = await supabase.auth.signOut();
  if (error) {
    const mapped: any = new Error(error.message);
    mapped.code = error.code || 'auth/error';
    throw mapped;
  }
};

export function useMemoFirebase(factory: () => any, deps: any[]) {
  return useMemo(factory, deps);
}

export const collection = (db: any, name: string) => ({ type: 'collection', name, path: name });
export const query = (ref: any, ...constraints: any[]) => ({ type: 'query', ref, constraints });
export const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });
export const orderBy = (field: string, dir: string) => ({ type: 'orderBy', field, dir });
export const limit = (num: number) => ({ type: 'limit', num });

export const doc = (arg1: any, arg2?: any, arg3?: string): DocumentReference => {
  let collectionName = '';
  let id = '';

  if (arg1 && arg1.type === 'collection' && !arg2) {
    collectionName = arg1.name;
    id = uuidv4();
  } else if (arg2 && arg3) {
    collectionName = arg2;
    id = arg3;
  } else if (arg1 && arg1.type === 'collection' && arg2) {
    collectionName = arg1.name;
    id = arg2;
  } else {
    collectionName = arg2 || '';
    id = arg3 || '';
  }

  return { type: 'doc', collection: collectionName, id, path: `${collectionName}/${id}` };
};

export const increment = (value: number) => ({ __op: 'increment', value });
export const serverTimestamp = () => Timestamp.now();

function applyQueryConstraints(items: any[], constraints: any[]) {
  let result = [...items];

  const whereConstraints = constraints.filter((c) => c.type === 'where');
  for (const w of whereConstraints) {
    result = result.filter((item) => {
      const itemValue = item[w.field];
      switch (w.op) {
        case '==':
          return itemValue == w.value;
        case '>':
          return itemValue > w.value;
        case '<':
          return itemValue < w.value;
        case '>=':
          return itemValue >= w.value;
        case '<=':
          return itemValue <= w.value;
        case '!=':
          return itemValue != w.value;
        case 'array-contains':
          return Array.isArray(itemValue) && itemValue.includes(w.value);
        default:
          return true;
      }
    });
  }

  const orderByConstraints = constraints.filter((c) => c.type === 'orderBy');
  for (const o of orderByConstraints) {
    result.sort((a, b) => {
      const valA = a[o.field];
      const valB = b[o.field];

      const timeA = valA?.seconds ? valA.seconds : valA;
      const timeB = valB?.seconds ? valB.seconds : valB;

      if (timeA < timeB) return o.dir === 'desc' ? 1 : -1;
      if (timeA > timeB) return o.dir === 'desc' ? -1 : 1;
      return 0;
    });
  }

  const limitConstraint = constraints.find((c) => c.type === 'limit');
  if (limitConstraint) {
    result = result.slice(0, limitConstraint.num);
  }

  return result;
}

export const addDoc = async (ref: any, data: any) => {
  const colName = ref.name;
  const id = await storage.add(colName, data);
  return { type: 'doc', collection: colName, id };
};

export const updateDoc = async (ref: any, data: any) => {
  await storage.update(ref.collection, ref.id, data);
};

export const deleteDoc = async (ref: any) => {
  await storage.delete(ref.collection, ref.id);
};

export const setDoc = async (ref: any, data: any) => {
  await storage.set(ref.collection, ref.id, data);
};

export const getDoc = async (ref: any) => {
  const data = await storage.getById(ref.collection, ref.id);
  return {
    exists: () => !!data,
    data: () => data,
    id: ref.id,
  };
};

export const getDocs = async (queryRef: any) => {
  const colName = queryRef.type === 'collection' ? queryRef.name : queryRef.ref.name;
  let items = await storage.get(colName);

  if (queryRef.type === 'query') {
    items = applyQueryConstraints(items, queryRef.constraints);
  }

  return {
    docs: items.map((item) => ({
      id: (item as any).id,
      data: () => item,
    })),
    empty: items.length === 0,
    size: items.length,
  };
};

export const runTransaction = async (db: any, updateFunction: (transaction: any) => Promise<void>) => {
  return storage.runTransaction(updateFunction);
};

export const writeBatch = (db: any) => {
  const operations: any[] = [];
  return {
    set: (ref: any, data: any) => operations.push({ type: 'set', ref, data }),
    update: (ref: any, data: any) => operations.push({ type: 'update', ref, data }),
    delete: (ref: any) => operations.push({ type: 'delete', ref }),
    commit: async () => {
      for (const op of operations) {
        if (op.type === 'set') {
          await storage.set(op.ref.collection, op.ref.id, op.data);
        } else if (op.type === 'update') {
          await storage.update(op.ref.collection, op.ref.id, op.data);
        } else if (op.type === 'delete') {
          await storage.delete(op.ref.collection, op.ref.id);
        }
      }
    },
  };
};

export const onSnapshot = (
  queryRef: any,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void,
) => {
  const colName = queryRef.type === 'collection' ? queryRef.name : queryRef.ref?.name;

  const load = async () => {
    try {
      const items = await storage.get(colName);
      let filteredItems = items;

      if (queryRef.type === 'query') {
        filteredItems = applyQueryConstraints(items, queryRef.constraints);
      }

      onNext({
        docs: filteredItems.map((item) => ({
          id: (item as any).id,
          data: () => item,
        })),
        empty: filteredItems.length === 0,
        size: filteredItems.length,
      });
    } catch (e) {
      if (onError) onError(e);
    }
  };

  load();

  const handleUpdate = () => load();
  if (typeof window !== 'undefined') {
    window.addEventListener('local-storage-update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('local-storage-update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    }
  };
};

export function useCollection<T>(queryRef: any) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!queryRef) {
      setIsLoading(false);
      return;
    }

    async function load() {
      try {
        const colName = queryRef.type === 'collection' ? queryRef.name : queryRef.ref.name;
        let items = await storage.get<T>(colName);

        if (queryRef.type === 'query') {
          items = applyQueryConstraints(items, queryRef.constraints);
        }

        if (isMounted) {
          setData(items);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) setError(err);
        setIsLoading(false);
      }
    }

    setIsLoading(true);
    load();

    const handleUpdate = () => load();

    if (typeof window !== 'undefined') {
      window.addEventListener('local-storage-update', handleUpdate);
      window.addEventListener('storage', handleUpdate);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('local-storage-update', handleUpdate);
        window.removeEventListener('storage', handleUpdate);
      }
    };
  }, [JSON.stringify(queryRef)]);

  return { data, isLoading, error };
}

export function useDoc<T>(docRef: any) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!docRef) {
      setIsLoading(false);
      return;
    }

    async function load() {
      try {
        const item = await storage.getById<T>(docRef.collection, docRef.id);
        if (isMounted) {
          setData(item);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) setError(err);
        setIsLoading(false);
      }
    }

    setIsLoading(true);
    load();

    const handleUpdate = () => load();

    if (typeof window !== 'undefined') {
      window.addEventListener('local-storage-update', handleUpdate);
      window.addEventListener('storage', handleUpdate);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('local-storage-update', handleUpdate);
        window.removeEventListener('storage', handleUpdate);
      }
    };
  }, [JSON.stringify(docRef)]);

  return { data, isLoading, error };
}

export const errorEmitter = {
  emit: (event: string, error: any) => {
    console.error(`[Mock ErrorEmitter] ${event}:`, error);
  },
  on: (event: string, callback: (error: any) => void) => {},
  off: (event: string, callback: (error: any) => void) => {},
};

export class FirestorePermissionError extends Error {
  constructor(public details: any) {
    super('Permission denied (Mock)');
  }
}
