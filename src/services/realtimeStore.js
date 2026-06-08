import { initializeApp } from "firebase/app";
import { getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { DEFAULT_STATE } from "../data/defaults.js";

const ROOT_PATH = import.meta.env.VITE_FIREBASE_ROOT_PATH || "roboface";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

const clone = (value) => JSON.parse(JSON.stringify(value));

const getAtPath = (source, path) =>
  path
    .split("/")
    .filter(Boolean)
    .reduce((current, segment) => current?.[segment], source);

const setAtPath = (source, path, value) => {
  const segments = path.split("/").filter(Boolean);
  const next = clone(source);
  let cursor = next;

  segments.slice(0, -1).forEach((segment) => {
    if (!cursor[segment] || typeof cursor[segment] !== "object") {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  });

  cursor[segments.at(-1)] = value;
  return next;
};

const removeAtPath = (source, path) => {
  const segments = path.split("/").filter(Boolean);
  const next = clone(source);
  let cursor = next;

  segments.slice(0, -1).forEach((segment) => {
    cursor = cursor?.[segment];
  });

  if (cursor && Object.prototype.hasOwnProperty.call(cursor, segments.at(-1))) {
    delete cursor[segments.at(-1)];
  }

  return next;
};

const createLocalStore = () => {
  const storageKey = `${ROOT_PATH}:local-state`;
  const listeners = new Set();
  let state = (() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : clone(DEFAULT_STATE);
    } catch {
      return clone(DEFAULT_STATE);
    }
  })();

  const emit = () => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    listeners.forEach((listener) => listener(state));
  };

  return {
    mode: "local",
    rootPath: ROOT_PATH,
    subscribeData(callback) {
      callback(state);
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    subscribeConnection(callback) {
      callback(false);
      return () => {};
    },
    async setValue(path, value) {
      state = setAtPath(state, path, value);
      emit();
    },
    async updateValue(path, value) {
      const current = getAtPath(state, path) || {};
      state = setAtPath(state, path, { ...current, ...value });
      emit();
    },
    async removeValue(path) {
      state = removeAtPath(state, path);
      emit();
    },
    async touchController() {
      state = setAtPath(state, "controller/web", {
        connected: true,
        lastSeen: Date.now(),
      });
      emit();
    },
  };
};

const createFirebaseStore = () => {
  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const rootRef = ref(database, ROOT_PATH);

  return {
    mode: "firebase",
    rootPath: ROOT_PATH,
    subscribeData(callback) {
      const unsubscribe = onValue(rootRef, (snapshot) => {
        callback(snapshot.val() || {});
      });
      return unsubscribe;
    },
    subscribeConnection(callback) {
      const infoRef = ref(database, ".info/connected");
      const unsubscribe = onValue(infoRef, (snapshot) => {
        const connected = snapshot.val() === true;
        callback(connected);

        if (connected) {
          const presenceRef = ref(database, `${ROOT_PATH}/controller/web`);
          set(presenceRef, {
            connected: true,
            lastSeen: serverTimestamp(),
            userAgent: navigator.userAgent,
          });
          onDisconnect(presenceRef).set({
            connected: false,
            lastSeen: serverTimestamp(),
          });
        }
      });
      return unsubscribe;
    },
    setValue(path, value) {
      return set(ref(database, `${ROOT_PATH}/${path}`), value);
    },
    updateValue(path, value) {
      return update(ref(database, `${ROOT_PATH}/${path}`), value);
    },
    removeValue(path) {
      return remove(ref(database, `${ROOT_PATH}/${path}`));
    },
    touchController() {
      return update(ref(database, `${ROOT_PATH}/controller/web`), {
        connected: true,
        lastSeen: serverTimestamp(),
      });
    },
  };
};

export const realtimeStore = hasFirebaseConfig ? createFirebaseStore() : createLocalStore();
