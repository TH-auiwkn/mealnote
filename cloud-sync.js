"use strict";

(function setupMealnoteCloud(root) {
  const SDK_VERSION = "12.16.0";
  const config = root.MEALNOTE_FIREBASE_CONFIG;
  const clientId = crypto.randomUUID();
  let appModule;
  let authModule;
  let firestoreModule;
  let auth;
  let db;
  let currentUser = null;
  let activeUserId = "";
  let activeDocument = null;
  let unsubscribeSnapshot = null;
  let remoteHandler = null;
  let writeTimer = null;
  let queuedState = null;
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

  function clearConnection() {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeSnapshot = null;
    activeDocument = null;
    activeUserId = "";
    remoteHandler = null;
    queuedState = null;
    clearTimeout(writeTimer);
    writeTimer = null;
  }

  async function writeDocument(nextState) {
    if (!activeDocument || !currentUser) return;
    emit({ phase: "syncing", message: "変更を保存しています" });
    await firestoreModule.setDoc(activeDocument, {
      state: nextState,
      schemaVersion: 1,
      clientId,
      updatedAt: firestoreModule.serverTimestamp()
    });
    emit({ phase: "synced", message: "クラウドと同期済み" });
  }

  async function flush() {
    clearTimeout(writeTimer);
    writeTimer = null;
    if (!queuedState || !activeDocument || !currentUser) return;
    const nextState = queuedState;
    queuedState = null;
    try {
      await writeDocument(nextState);
    } catch (error) {
      queuedState = nextState;
      emit({ phase: "error", message: "クラウドへの保存に失敗しました", error });
      throw error;
    }
  }

  const ready = (async () => {
    if (!config?.apiKey || !config?.projectId) throw new Error("Firebaseの設定がありません");
    [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`)
    ]);
    const firebaseApp = appModule.initializeApp(config);
    auth = authModule.getAuth(firebaseApp);
    auth.languageCode = "ja";
    db = firestoreModule.getFirestore(firebaseApp);
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
      let source = "cloud";
      if (snapshot.exists() && snapshot.data()?.state) {
        remoteHandler?.(snapshot.data().state, { initial: true });
      } else {
        source = "device";
        await writeDocument(JSON.parse(JSON.stringify(localState)));
      }

      unsubscribeSnapshot = firestoreModule.onSnapshot(activeDocument, (nextSnapshot) => {
        if (!nextSnapshot.exists()) return;
        const data = nextSnapshot.data();
        if (!data?.state || data.clientId === clientId) return;
        remoteHandler?.(data.state, { initial: false });
        emit({ phase: "synced", message: "クラウドと同期済み" });
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
    if (!activeDocument || !currentUser) return;
    queuedState = JSON.parse(JSON.stringify(nextState));
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => { flush().catch(() => {}); }, 550);
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
    getStatus: () => ({ ...status })
  };
})(window);
