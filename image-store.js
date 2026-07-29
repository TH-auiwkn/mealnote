"use strict";

(function setupMealnoteImages(root) {
  const DB_NAME = "mealnote-images";
  const STORE_NAME = "recipe-sources";
  const VERSION = 1;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("画像保存領域を開けませんでした"));
    });
  }

  async function withStore(mode, operation) {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("画像を保存できませんでした"));
      });
    } finally {
      database.close();
    }
  }

  function dataUrlFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("画像を読み込めませんでした"));
      reader.readAsDataURL(blob);
    });
  }

  async function save(recipeId, dataUrl, name = "取り込み元画像") {
    if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(dataUrl || "")) throw new Error("保存できる画像形式ではありません");
    const blob = await (await fetch(dataUrl)).blob();
    const id = `recipe-source-${String(recipeId).replace(/[^a-z0-9_-]/gi, "-").slice(0, 120)}`;
    await withStore("readwrite", (store) => store.put({ id, blob, name: String(name || "取り込み元画像").slice(0, 120), updatedAt: Date.now() }));
    return { type: "image", localId: id, name: String(name || "取り込み元画像").slice(0, 120) };
  }

  async function getDataUrl(source) {
    if (source?.type !== "image" || !source.localId) return "";
    const record = await withStore("readonly", (store) => store.get(source.localId));
    return record?.blob ? dataUrlFromBlob(record.blob) : "";
  }

  async function deleteSource(source) {
    if (source?.type !== "image" || !source.localId) return;
    await withStore("readwrite", (store) => store.delete(source.localId));
  }

  async function migrateState(nextState) {
    const migrated = JSON.parse(JSON.stringify(nextState));
    let changed = false;
    for (const recipe of migrated.recipes || []) {
      if (recipe?.source?.type !== "image" || !recipe.source.dataUrl) continue;
      try {
        recipe.source = await save(recipe.id, recipe.source.dataUrl, recipe.source.name);
        changed = true;
      } catch {}
    }
    return { state: migrated, changed };
  }

  root.MealnoteImages = { save, getDataUrl, deleteSource, migrateState };
})(window);
