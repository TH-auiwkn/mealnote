"use strict";

(function setupMealnoteStateStore(root) {
  const DB_NAME = "mealnote-state";
  const DB_VERSION = 1;
  const STORE_NAME = "states";
  const STATE_KEY = "current";
  let writeChain = Promise.resolve();

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function runTransaction(mode, operation) {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        let result;
        request.onsuccess = () => {
          result = request.result;
          if (mode === "readonly") resolve(result);
        };
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }

  function save(state) {
    const snapshot = JSON.parse(JSON.stringify(state));
    writeChain = writeChain
      .catch(() => {})
      .then(() => runTransaction("readwrite", (store) => store.put({
        state: snapshot,
        updatedAt: Date.now()
      }, STATE_KEY)));
    return writeChain;
  }

  async function load() {
    const record = await runTransaction("readonly", (store) => store.get(STATE_KEY));
    return record?.state || null;
  }

  root.MealnoteStateStore = { load, save };
})(window);
