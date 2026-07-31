"use strict";

(function setupMealnoteCloud(root) {
  const SDK_VERSION = "12.16.0";
  const CLOUD_SCHEMA_VERSION = 1;
  const STATE_ENCODING = "gzip-base64-v1";
  const PENDING_KEY_PREFIX = "mealnote-cloud-pending-v2:";
  const config = root.MEALNOTE_FIREBASE_CONFIG;
  const clientId = crypto.randomUUID();
  let appModule;
  let authModule;
  let firestoreModule;
  let storageModule;
  let auth;
  let db;
  let storage;
  let currentUser = null;
  let activeUserId = "";
  let activeDocument = null;
  let unsubscribeSnapshot = null;
  let remoteHandler = null;
  let writeTimer = null;
  let flushPromise = null;
  let queuedState = null;
  let remoteReadRevision = 0;
  let status = { phase: "initializing", user: null, message: "クラウド同期を準備しています" };

  function publicUser(user) {
    if (!user) return null;
    return {
      uid: user.uid,
      displayName: user.displayName || "",
      email: user.email || ""
    };
  }

  function emit(next) {
    status = { ...status, ...next, user: next.user === undefined ? status.user : next.user };
    root.dispatchEvent(new CustomEvent("mealnote-cloud-status", { detail: status }));
  }

  function imageDataUrl(value = "") {
    return /^data:image\/(?:jpeg|png|webp);base64,/i.test(value) ? value : "";
  }

  async function uploadRecipeImage(recipeId, dataUrl, name = "取り込み元画像") {
    await ready;
    if (!currentUser) return null;
    const safeDataUrl = imageDataUrl(dataUrl);
    if (!safeDataUrl) throw new Error("保存できる画像形式ではありません");
    const response = await fetch(safeDataUrl);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size > 5 * 1024 * 1024) throw new Error("画像は5MB以下にしてください");
    const safeRecipeId = String(recipeId).replace(/[^a-z0-9_-]/gi, "-").slice(0, 120);
    const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const storagePath = `recipeSources/${currentUser.uid}/${safeRecipeId}.${extension}`;
    const imageRef = storageModule.ref(storage, storagePath);
    await storageModule.uploadBytes(imageRef, blob, { contentType: blob.type, cacheControl: "public,max-age=31536000" });
    return {
      type: "image",
      url: await storageModule.getDownloadURL(imageRef),
      storagePath,
      name: String(name || "取り込み元画像").slice(0, 120)
    };
  }

  async function prepareStateForCloud(nextState) {
    const prepared = JSON.parse(JSON.stringify(nextState));
    let migrated = false;
    for (const recipe of prepared.recipes || []) {
      const source = recipe?.source;
      if (source?.type !== "image") continue;
      let localDataUrl = imageDataUrl(source.dataUrl);
      if (!localDataUrl && source.localId) {
        try { localDataUrl = await root.MealnoteImages?.getDataUrl?.(source) || ""; }
        catch {}
      }
      if (!localDataUrl) continue;
      try {
        const uploaded = await uploadRecipeImage(recipe.id, localDataUrl, source.name);
        if (uploaded) {
          recipe.source = uploaded;
          migrated = true;
        } else delete recipe.source;
      } catch {
        // Keep the original image on this device without blocking other cloud data.
        delete recipe.source;
      }
    }
    return { state: prepared, migrated };
  }

  async function deleteRecipeImage(source) {
    await ready;
    if (!currentUser || source?.type !== "image") return;
    const prefix = `recipeSources/${currentUser.uid}/`;
    if (!String(source.storagePath || "").startsWith(prefix)) return;
    try { await storageModule.deleteObject(storageModule.ref(storage, source.storagePath)); }
    catch (error) { if (error?.code !== "storage/object-not-found") throw error; }
  }

  function pendingKey() {
    const userId = activeUserId || currentUser?.uid || "";
    return userId ? `${PENDING_KEY_PREFIX}${userId}` : "";
  }

  function hasPendingChanges() {
    const key = pendingKey();
    if (!key) return false;
    try { return root.localStorage.getItem(key) === "1"; }
    catch { return false; }
  }

  function markPendingChanges() {
    const key = pendingKey();
    if (!key) return;
    try { root.localStorage.setItem(key, "1"); }
    catch {}
  }

  function clearPendingChanges() {
    const key = pendingKey();
    if (!key) return;
    try { root.localStorage.removeItem(key); }
    catch {}
  }

  function bytesToBase64(bytes) {
    let value = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      value += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(value);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  async function encodeCloudState(nextState) {
    const json = JSON.stringify(nextState);
    if (!root.CompressionStream) return { encoding: "json-v1", payload: json };
    const compressed = new Blob([new TextEncoder().encode(json)])
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
    return { encoding: STATE_ENCODING, payload: bytesToBase64(bytes) };
  }

  async function decodeCloudState(value) {
    if (!value || typeof value !== "object") return null;
    if (value.encoding === "json-v1" && typeof value.payload === "string") return JSON.parse(value.payload);
    if (value.encoding !== STATE_ENCODING || typeof value.payload !== "string") return value;
    if (!root.DecompressionStream) throw new Error("このブラウザではクラウドデータを展開できません");
    const decompressed = new Blob([base64ToBytes(value.payload)])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(decompressed).text());
  }

  function clearConnection() {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeSnapshot = null;
    activeDocument = null;
    activeUserId = "";
    remoteHandler = null;
    queuedState = null;
    clearTimeout(writeTimer);
    writeTimer = null;
    flushPromise = null;
    remoteReadRevision += 1;
  }

  async function writeDocument(nextState) {
    if (!activeDocument || !currentUser) return;
    emit({ phase: "syncing", message: "変更を保存しています" });
    const prepared = await prepareStateForCloud(nextState);
    const encodedState = await encodeCloudState(prepared.state);
    await firestoreModule.setDoc(activeDocument, {
      state: encodedState,
      schemaVersion: CLOUD_SCHEMA_VERSION,
      clientId,
      updatedAt: firestoreModule.serverTimestamp()
    });
    clearPendingChanges();
    emit({ phase: "synced", message: "クラウドと同期済み" });
    return prepared;
  }

  function flush() {
    clearTimeout(writeTimer);
    writeTimer = null;
    if (flushPromise) return flushPromise;
    if (!queuedState || !activeDocument || !currentUser) return Promise.resolve();
    flushPromise = (async () => {
      while (queuedState && activeDocument && currentUser) {
        const nextState = queuedState;
        queuedState = null;
        try {
          const prepared = await writeDocument(nextState);
          if (prepared?.migrated) remoteHandler?.(prepared.state, { sourceMigration: true });
        } catch (error) {
          if (!queuedState) queuedState = nextState;
          emit({ phase: "error", message: "クラウドへの保存に失敗しました。端末のデータは保持されています", error });
          throw error;
        }
      }
    })().finally(() => {
      flushPromise = null;
      if (queuedState && activeDocument && currentUser && !writeTimer) {
        writeTimer = setTimeout(() => { flush().catch(() => {}); }, 3000);
      }
    });
    return flushPromise;
  }

  const ready = (async () => {
    if (!config?.apiKey || !config?.projectId) throw new Error("Firebaseの設定がありません");
    [appModule, authModule, firestoreModule, storageModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-storage.js`)
    ]);
    const firebaseApp = appModule.initializeApp(config);
    auth = authModule.getAuth(firebaseApp);
    auth.languageCode = "ja";
    db = firestoreModule.initializeFirestore(firebaseApp, {
      localCache: firestoreModule.persistentLocalCache({ tabManager: firestoreModule.persistentMultipleTabManager() })
    });
    storage = storageModule.getStorage(firebaseApp);
    authModule.onAuthStateChanged(auth, (user) => {
      const changedUser = currentUser?.uid !== user?.uid;
      currentUser = user;
      if (changedUser) clearConnection();
      emit(user
        ? { phase: "signed-in", user: publicUser(user), message: "ログインしました" }
        : { phase: "signed-out", user: null, message: "この端末に保存中" });
    });
  })().catch((error) => {
    emit({ phase: "error", user: null, message: "クラウド同期を開始できませんでした", error });
    throw error;
  });

  async function connect(localState, onRemote) {
    await ready;
    if (!currentUser) return { source: "device" };
    if (activeUserId === currentUser.uid && activeDocument) return { source: "connected" };
    clearConnection();
    activeUserId = currentUser.uid;
    remoteHandler = onRemote;
    activeDocument = firestoreModule.doc(db, "mealnoteStates", currentUser.uid);
    emit({ phase: "syncing", message: "クラウドのデータを確認しています" });

    try {
      const snapshot = await firestoreModule.getDoc(activeDocument);
      const data = snapshot.data();
      const recoverDeviceState = hasPendingChanges();
      let source = recoverDeviceState ? "device" : "cloud";
      if (snapshot.exists() && data?.state) {
        const remoteState = await decodeCloudState(data.state);
        if (recoverDeviceState) {
          const prepared = await writeDocument(JSON.parse(JSON.stringify(localState)));
          if (prepared?.migrated) remoteHandler?.(prepared.state, { sourceMigration: true });
        } else {
          remoteHandler?.(remoteState, { initial: true });
          if (data.state.encoding !== STATE_ENCODING) {
            const prepared = await writeDocument(remoteState);
            if (prepared?.migrated) remoteHandler?.(prepared.state, { sourceMigration: true });
          }
        }
      } else {
        source = "device";
        const deviceState = JSON.parse(JSON.stringify(localState));
        const prepared = await writeDocument(deviceState);
        if (prepared?.migrated) remoteHandler?.(prepared.state, { sourceMigration: true });
      }

      unsubscribeSnapshot = firestoreModule.onSnapshot(activeDocument, (nextSnapshot) => {
        if (!nextSnapshot.exists()) return;
        const nextData = nextSnapshot.data();
        if (!nextData?.state || nextData.clientId === clientId) return;
        if (queuedState || flushPromise || hasPendingChanges()) return;
        const revision = ++remoteReadRevision;
        decodeCloudState(nextData.state)
          .then((remoteState) => {
            if (revision !== remoteReadRevision) return;
            remoteHandler?.(remoteState, { initial: false });
            emit({ phase: "synced", message: "クラウドと同期済み" });
          })
          .catch((error) => emit({ phase: "error", message: "クラウドの更新を読み込めませんでした", error }));
      }, (error) => emit({ phase: "error", message: "同期接続が中断されました", error }));

      emit({ phase: "synced", message: "クラウドと同期済み" });
      return { source };
    } catch (error) {
      clearConnection();
      emit({ phase: "error", message: "クラウドのデータを読み込めませんでした", error });
      throw error;
    }
  }

  function queueSave(nextState) {
    if (!currentUser) return;
    markPendingChanges();
    queuedState = JSON.parse(JSON.stringify(nextState));
    if (!activeDocument) return;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => { flush().catch(() => {}); }, 120);
  }

  async function signIn() {
    await ready;
    emit({ phase: "signing-in", message: "Googleログインを開いています" });
    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      return await authModule.signInWithPopup(auth, provider);
    } catch (error) {
      emit(currentUser
        ? { phase: "signed-in", user: publicUser(currentUser), message: "ログインしています" }
        : { phase: "signed-out", user: null, message: "この端末に保存中" });
      throw error;
    }
  }

  async function signOut() {
    await ready;
    if (queuedState) await flush().catch(() => {});
    await authModule.signOut(auth);
  }

  root.MealnoteCloud = {
    ready,
    connect,
    queueSave,
    flush,
    signIn,
    signOut,
    uploadRecipeImage,
    deleteRecipeImage,
    getStatus: () => ({ ...status })
  };
})(window);
