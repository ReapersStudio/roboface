import { database, ROOT_PATH } from '../firebase';
import { ref, onValue, set, update, remove, serverTimestamp, onDisconnect } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_STATE } from '../data/defaults';

const clone = (value: any) => JSON.parse(JSON.stringify(value));

const getAtPath = (source: any, path: string) =>
  path
    .split('/')
    .filter(Boolean)
    .reduce((current, segment) => current?.[segment], source);

const setAtPath = (source: any, path: string, value: any) => {
  const segments = path.split('/').filter(Boolean);
  const next = clone(source);
  let cursor = next;

  segments.slice(0, -1).forEach((segment) => {
    if (!cursor[segment] || typeof cursor[segment] !== 'object') {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  });

  cursor[segments.at(-1)!] = value;
  return next;
};

const removeAtPath = (source: any, path: string) => {
  const segments = path.split('/').filter(Boolean);
  const next = clone(source);
  let cursor = next;

  segments.slice(0, -1).forEach((segment) => {
    cursor = cursor?.[segment];
  });

  if (cursor && Object.prototype.hasOwnProperty.call(cursor, segments.at(-1)!)) {
    delete cursor[segments.at(-1)!];
  }

  return next;
};

const createLocalStore = () => {
  const storageKey = `${ROOT_PATH}:local-state`;
  const listeners = new Set<Function>();
  
  let state = clone(DEFAULT_STATE);
  
  // Async load initial state
  AsyncStorage.getItem(storageKey).then((stored) => {
    if (stored) {
      try {
        state = JSON.parse(stored);
        listeners.forEach((listener) => listener(state));
      } catch {}
    }
  });

  const emit = () => {
    AsyncStorage.setItem(storageKey, JSON.stringify(state));
    listeners.forEach((listener) => listener(state));
  };

  return {
    mode: 'local',
    rootPath: ROOT_PATH,
    subscribeData(callback: Function) {
      callback(state);
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    subscribeConnection(callback: Function) {
      callback(false);
      return () => {};
    },
    async setValue(path: string, value: any) {
      state = setAtPath(state, path, value);
      emit();
    },
    async updateValue(path: string, value: any) {
      const current = getAtPath(state, path) || {};
      state = setAtPath(state, path, { ...current, ...value });
      emit();
    },
    async removeValue(path: string) {
      state = removeAtPath(state, path);
      emit();
    },
    async touchController() {
      state = setAtPath(state, 'controller/mobile', {
        connected: true,
        lastSeen: Date.now(),
      });
      emit();
    },
  };
};

const createFirebaseStore = () => {
  const rootRef = ref(database, ROOT_PATH);

  return {
    mode: 'firebase',
    rootPath: ROOT_PATH,
    subscribeData(callback: Function) {
      const unsubscribe = onValue(rootRef, (snapshot) => {
        callback(snapshot.val() || {});
      });
      return unsubscribe;
    },
    subscribeConnection(callback: Function) {
      const infoRef = ref(database, '.info/connected');
      const unsubscribe = onValue(infoRef, (snapshot) => {
        const connected = snapshot.val() === true;
        callback(connected);

        if (connected) {
          const presenceRef = ref(database, `${ROOT_PATH}/controller/mobile`);
          set(presenceRef, {
            connected: true,
            lastSeen: serverTimestamp(),
            userAgent: 'React Native Mobile App',
          });
          onDisconnect(presenceRef).set({
            connected: false,
            lastSeen: serverTimestamp(),
          });
        }
      });
      return unsubscribe;
    },
    setValue(path: string, value: any) {
      return set(ref(database, `${ROOT_PATH}/${path}`), value);
    },
    updateValue(path: string, value: any) {
      return update(ref(database, `${ROOT_PATH}/${path}`), value);
    },
    removeValue(path: string) {
      return remove(ref(database, `${ROOT_PATH}/${path}`));
    },
    touchController() {
      return update(ref(database, `${ROOT_PATH}/controller/mobile`), {
        connected: true,
        lastSeen: serverTimestamp(),
      });
    },
  };
};

// Use Firebase if API key is present, otherwise fallback to local AsyncStorage
const hasFirebaseConfig = Boolean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY);
export const realtimeStore = hasFirebaseConfig ? createFirebaseStore() : createLocalStore();
