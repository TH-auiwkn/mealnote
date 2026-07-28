const STORAGE_KEY = "mealnote-state-v1";
const INGREDIENT_GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const DISH_TYPES = ["メイン料理", "副菜", "その他"];

const baseRecipes = [
  {
    id: "salmon-teriyaki",
    name: "鮭の照り焼き",
    dishType: "メイン料理",
    tools: ["フライパン"],
    time: 20,
    servings: 2,
    ingredients: [
      { name: "鮭", amount: "2切れ", category: "魚・肉" },
      { name: "ししとう", amount: "8本", category: "野菜" },
      { name: "大根", amount: "5cm", category: "野菜" },
      { name: "しょうゆ", amount: "大さじ2", category: "調味料" },
      { name: "みりん", amount: "大さじ2", category: "調味料" }
    ],
    steps: ["鮭の水気をふき、薄く小麦粉をまぶす。", "フライパンで鮭とししとうを両面焼く。", "しょうゆとみりんを加え、照りが出るまで煮からめる。"],
    lastCooked: "2026-07-21",
    createdAt: "2026-07-02"
  },
  {
    id: "tomato-chicken",
    name: "鶏肉のトマト煮",
    dishType: "メイン料理",
    tools: ["鍋", "包丁"],
    time: 35,
    servings: 2,
    ingredients: [
      { name: "鶏もも肉", amount: "300g", category: "魚・肉" },
      { name: "トマト", amount: "2個", category: "野菜" },
      { name: "玉ねぎ", amount: "1/2個", category: "野菜" },
      { name: "バジル", amount: "適量", category: "野菜" },
      { name: "にんにく", amount: "1片", category: "野菜" }
    ],
    steps: ["鶏肉をひと口大に切り、塩をふる。", "鶏肉を焼き、玉ねぎとにんにくを加えて炒める。", "トマトを加えて20分煮込み、バジルを添える。"],
    lastCooked: "2026-07-13",
    createdAt: "2026-07-08"
  },
  {
    id: "miso-stirfry",
    name: "豚肉と野菜の味噌炒め",
    dishType: "メイン料理",
    tools: ["フライパン", "包丁"],
    time: 15,
    servings: 2,
    ingredients: [
      { name: "豚こま肉", amount: "200g", category: "魚・肉" },
      { name: "キャベツ", amount: "1/4玉", category: "野菜" },
      { name: "パプリカ", amount: "1/2個", category: "野菜" },
      { name: "玉ねぎ", amount: "1/2個", category: "野菜" },
      { name: "味噌", amount: "大さじ1.5", category: "調味料" }
    ],
    steps: ["野菜を食べやすい大きさに切る。", "豚肉を炒め、色が変わったら野菜を加える。", "味噌、みりん、しょうゆを合わせて加え、さっと炒める。"],
    lastCooked: "2026-06-29",
    createdAt: "2026-07-12"
  },
  {
    id: "cream-pasta",
    name: "ほうれん草ときのこのクリームパスタ",
    dishType: "メイン料理",
    tools: ["鍋", "フライパン"],
    time: 25,
    servings: 2,
    ingredients: [
      { name: "パスタ", amount: "180g", category: "その他" },
      { name: "ほうれん草", amount: "1/2束", category: "野菜" },
      { name: "マッシュルーム", amount: "6個", category: "野菜" },
      { name: "牛乳", amount: "200ml", category: "乳製品" },
      { name: "粉チーズ", amount: "大さじ2", category: "乳製品" }
    ],
    steps: ["パスタを表示時間より1分短くゆでる。", "きのことほうれん草を炒め、牛乳を加える。", "パスタと粉チーズを加え、とろみがつくまで和える。"],
    lastCooked: "2026-07-05",
    createdAt: "2026-07-16"
  }
];

const defaultIngredients = ["鮭", "鶏もも肉", "豚こま肉", "ひき肉", "卵", "豆腐", "トマト", "玉ねぎ", "にんじん", "キャベツ", "ほうれん草", "きのこ", "じゃがいも", "牛乳", "チーズ", "パスタ", "ごはん", "しょうゆ", "味噌", "みりん", "にんにく"];
const categoryMap = {
  "鮭": "魚・肉", "鶏もも肉": "魚・肉", "豚こま肉": "魚・肉", "ひき肉": "魚・肉", "卵": "卵・豆腐", "豆腐": "卵・豆腐",
  "牛乳": "乳製品", "チーズ": "乳製品", "粉チーズ": "乳製品", "しょうゆ": "調味料", "味噌": "調味料", "みりん": "調味料",
  "パスタ": "その他", "ごはん": "その他"
};

const today = new Date();
today.setHours(0, 0, 0, 0);
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date, days) => { const value = new Date(date); value.setDate(value.getDate() + days); return value; };
const seedSchedule = {
  [iso(addDays(today, -2))]: "salmon-teriyaki",
  [iso(addDays(today, 1))]: "tomato-chicken",
  [iso(addDays(today, 3))]: "miso-stirfry",
  [iso(addDays(today, 5))]: "cream-pasta"
};

function initialState() {
  return { recipes: baseRecipes, schedule: seedSchedule, shopping: [], customIngredients: defaultIngredients };
}

function normalizeIngredientGroup(value = "") {
  const match = String(value).normalize("NFKC").toUpperCase().match(/[A-H]/);
  return match ? match[0] : "";
}

function normalizeRecipeStep(value, depth = 0) {
  if (depth > 5 || value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
    return /^\[?object(?: Object)?\]?$/i.test(text) ? "" : text;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeRecipeStep(item, depth + 1)).filter(Boolean).join(" ");
  if (typeof value !== "object") return "";
  for (const key of ["text", "instruction", "instructions", "description", "content", "step", "direction", "directions", "value", "name"]) {
    if (!Object.hasOwn(value, key)) continue;
    const text = normalizeRecipeStep(value[key], depth + 1);
    if (text) return text;
  }
  return Object.entries(value)
    .filter(([key]) => !/^(?:@type|type|position|number|id|name)$/i.test(key))
    .map(([, item]) => normalizeRecipeStep(item, depth + 1))
    .filter(Boolean)
    .join(" ");
}

function normalizeRecipeSteps(value) {
  const candidates = Array.isArray(value) ? value : (value && typeof value === "object" ? Object.values(value) : [value]);
  return candidates.map((step) => normalizeRecipeStep(step)).filter(Boolean).slice(0, 60);
}

function normalizeRecipeTools(value) {
  const candidates = Array.isArray(value) ? value : String(value || "").split(/[、,，\n]/);
  return [...new Set(candidates.map((item) => String(item || "").normalize("NFKC").trim()).filter(Boolean))].slice(0, 20);
}

function normalizeDishType(value) {
  return DISH_TYPES.includes(value) ? value : "その他";
}

function safeHttpsUrl(value = "") {
  try {
    const url = new URL(String(value).trim());
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}

function normalizeRecipeSource(value) {
  if (!value || typeof value !== "object") return null;
  if (value.type === "url") {
    const url = safeHttpsUrl(value.url);
    return url ? { type: "url", url } : null;
  }
  if (value.type !== "image") return null;
  const url = safeHttpsUrl(value.url);
  const dataUrl = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value.dataUrl || "") ? value.dataUrl : "";
  if (!url && !dataUrl) return null;
  const storagePath = /^recipeSources\/[^/]+\/[^/]+\.(?:jpe?g|png|webp)$/i.test(value.storagePath || "") ? value.storagePath : "";
  return {
    type: "image",
    ...(url ? { url } : {}),
    ...(dataUrl ? { dataUrl } : {}),
    ...(storagePath ? { storagePath } : {}),
    name: String(value.name || "取り込み元画像").trim().slice(0, 120) || "取り込み元画像"
  };
}

function normalizeRecipeGroups(recipe) {
  return {
    ...recipe,
    ingredients: Array.isArray(recipe?.ingredients)
      ? recipe.ingredients.map((item) => ({ ...item, group: normalizeIngredientGroup(item?.group) }))
      : [],
    steps: normalizeRecipeSteps(recipe?.steps),
    tools: normalizeRecipeTools(recipe?.tools),
    dishType: normalizeDishType(recipe?.dishType),
    source: normalizeRecipeSource(recipe?.source)
  };
}

function normalizeState(saved) {
  const fallback = initialState();
  if (!saved || typeof saved !== "object") return fallback;
  return {
    recipes: (Array.isArray(saved.recipes) ? saved.recipes : fallback.recipes).map(normalizeRecipeGroups),
    schedule: saved.schedule && typeof saved.schedule === "object" && !Array.isArray(saved.schedule) ? saved.schedule : fallback.schedule,
    shopping: Array.isArray(saved.shopping) ? saved.shopping : [],
    customIngredients: Array.isArray(saved.customIngredients)
      ? [...new Set(saved.customIngredients.filter((item) => typeof item === "string" && item.trim()))]
      : fallback.customIngredients
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return normalizeState(saved);
  } catch { return initialState(); }
}

let state = loadState();
let applyingCloudState = false;
let connectedCloudUid = "";
let activeView = "recipes";
let activeTags = new Set();
let activeTools = new Set();
let activeDishTypes = new Set();
let calendarDate = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedMealDate = iso(today);
let pendingImage = "";
let pendingSource = null;
let lastPhotoFile = null;
let ocrInProgress = false;
let urlImportInProgress = false;
let lastUrlText = "";
let lastUrlPage = "";
let ingredientRowId = 0;
let stepRowId = 0;
let editingRecipeId = "";

const $ = (id) => document.getElementById(id);
const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const escapeAttr = escapeHTML;
const dateFormatter = new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" });

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { toast("端末への保存に失敗しました"); }
  if (!applyingCloudState) window.MealnoteCloud?.queueSave(state);
}

function renderAllData() {
  renderIngredientSuggestions();
  renderRecipes();
  renderCalendar();
  renderShopping();
  if ($("ingredientManagerDialog")?.open) renderCustomIngredients();
}

function applyCloudState(remoteState, context = {}) {
  const nextState = normalizeState(remoteState);
  if (JSON.stringify(nextState) === JSON.stringify(state)) return;
  applyingCloudState = true;
  state = nextState;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { toast("端末への保存に失敗しました"); }
  applyingCloudState = false;
  renderAllData();
  if (context.initial) toast("クラウドのデータを読み込みました");
}

function accountInitials(user) {
  if (!user) return "HM";
  const source = (user.displayName || user.email?.split("@")[0] || "M").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
  return [...source].slice(0, 2).join("").toUpperCase();
}

function updateAccountUI(cloudStatus = {}) {
  const user = cloudStatus.user || null;
  const signedIn = Boolean(user);
  const phase = cloudStatus.phase || "initializing";
  const initials = accountInitials(user);
  $("accountAvatar").textContent = initials;
  $("accountAvatarLarge").textContent = initials;
  $("accountName").textContent = signedIn ? (user.displayName || "Googleアカウント") : "この端末のデータ";
  $("accountEmail").textContent = signedIn ? (user.email || "ログイン中") : "Googleにログインすると端末間で同期できます";
  $("signedOutPanel").hidden = signedIn;
  $("signedInPanel").hidden = !signedIn;
  $("googleSignIn").disabled = phase === "signing-in";
  $("cloudStatusCard").dataset.phase = phase;
  $("accountButton").classList.toggle("is-synced", signedIn && phase === "synced");

  const labels = {
    initializing: ["クラウド同期を準備中", "現在のデータはこの端末にも保存されています。"],
    "signed-out": ["この端末に保存中", "ログインするとクラウド保存が始まります。"],
    "signing-in": ["Googleログインを確認中", "表示された画面でアカウントを選択してください。"],
    "signed-in": ["クラウドへ接続中", "保存済みのデータを確認しています。"],
    syncing: ["クラウドへ保存中", cloudStatus.message || "変更を反映しています。"],
    synced: ["クラウドと同期済み", "レシピ・献立・買い物・材料候補を自動保存します。"],
    error: ["同期を完了できませんでした", cloudStatus.message || "通信環境を確認して、もう一度お試しください。"]
  };
  const [title, message] = labels[phase] || labels.initializing;
  $("cloudStatusTitle").textContent = title;
  $("cloudStatusMessage").textContent = message;
}

async function handleCloudStatus(eventOrStatus) {
  const cloudStatus = eventOrStatus?.detail || eventOrStatus || {};
  updateAccountUI(cloudStatus);
  if (cloudStatus.phase === "signed-out") connectedCloudUid = "";
  if (cloudStatus.phase !== "signed-in" || !cloudStatus.user?.uid || connectedCloudUid === cloudStatus.user.uid) return;
  connectedCloudUid = cloudStatus.user.uid;
  try {
    const result = await window.MealnoteCloud.connect(state, applyCloudState);
    if (result.source === "device") toast("この端末のデータをクラウドに保存しました");
  } catch {
    connectedCloudUid = "";
  }
}

function openAccountDialog() {
  const cloudStatus = window.MealnoteCloud?.getStatus() || { phase: "error", message: "クラウド同期を読み込めませんでした" };
  updateAccountUI(cloudStatus);
  if (cloudStatus.phase === "error" && cloudStatus.user) {
    connectedCloudUid = "";
    handleCloudStatus({ ...cloudStatus, phase: "signed-in" });
  }
  $("accountDialog").showModal();
}

function cloudLoginErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "ログインをキャンセルしました";
  if (code.includes("popup-blocked")) return "ログイン画面を開けませんでした。ポップアップを許可してください";
  if (code.includes("unauthorized-domain")) return "このページからのログインは許可されていません";
  if (code.includes("network-request-failed")) return "通信環境を確認して、もう一度お試しください";
  return "Googleログインを完了できませんでした";
}

function initializeCloudSync() {
  window.addEventListener("mealnote-cloud-status", handleCloudStatus);
  if (!window.MealnoteCloud) {
    updateAccountUI({ phase: "error", message: "クラウド同期の設定がありません" });
    return;
  }
  handleCloudStatus(window.MealnoteCloud.getStatus());
  window.MealnoteCloud.ready.catch(() => {});
}

function toast(message, actionLabel = "", action = null) {
  const element = $("toast");
  element.replaceChildren();
  const label = document.createElement("span");
  label.textContent = message;
  element.append(label);
  element.classList.toggle("is-actionable", Boolean(actionLabel && action));
  if (actionLabel && action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = actionLabel;
    button.addEventListener("click", () => {
      clearTimeout(toast.timer);
      element.classList.remove("is-visible", "is-actionable");
      action();
    }, { once: true });
    element.append(button);
  }
  element.classList.add("is-visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("is-visible", "is-actionable"), action ? 4200 : 2300);
}

function formatLastCooked(value) {
  if (!value) return "まだ作っていません";
  const date = new Date(`${value}T00:00:00`);
  const days = Math.round((today - date) / 86400000);
  if (days === 0) return "今日作りました";
  if (days === 1) return "昨日作りました";
  if (days > 1 && days < 30) return `${days}日前に作りました`;
  return `${date.getMonth() + 1}月${date.getDate()}日に作りました`;
}

function setView(view) {
  activeView = view;
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    const visible = panel.dataset.viewPanel === view;
    panel.hidden = !visible;
    panel.classList.toggle("is-visible", visible);
  });
  document.querySelectorAll(".nav-item[data-view], .mobile-nav [data-view]").forEach((button) => {
    const selected = button.dataset.view === view;
    button.classList.toggle("is-active", selected);
    if (button.classList.contains("nav-item")) selected ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
  });
  if (view === "calendar") renderCalendar();
  if (view === "shopping") renderShopping();
  window.scrollTo({ top: 0, behavior: "smooth" });
  $("mainContent").focus({ preventScroll: true });
}

function filterOptionMarkup(value, count, activeSet) {
  return `<label class="tag-option"><input type="checkbox" value="${escapeAttr(value)}" ${activeSet.has(value) ? "checked" : ""}><span>${escapeHTML(value)} <small>${count}</small></span></label>`;
}

function renderTags() {
  const ingredientCounts = new Map();
  const toolCounts = new Map();
  const dishTypeCounts = new Map(DISH_TYPES.map((type) => [type, 0]));
  state.recipes.forEach((recipe) => {
    recipe.ingredients.forEach((item) => ingredientCounts.set(item.name, (ingredientCounts.get(item.name) || 0) + 1));
    recipe.tools.forEach((tool) => toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1));
    dishTypeCounts.set(recipe.dishType, (dishTypeCounts.get(recipe.dishType) || 0) + 1);
  });
  const ingredients = [...ingredientCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja")).slice(0, 18);
  const tools = [...toolCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"));
  $("tagOptions").innerHTML = ingredients.map(([tag, count]) => filterOptionMarkup(tag, count, activeTags)).join("") || `<p class="filter-empty">登録された材料はありません</p>`;
  $("toolOptions").innerHTML = tools.map(([tool, count]) => filterOptionMarkup(tool, count, activeTools)).join("") || `<p class="filter-empty">登録された調理器具はありません</p>`;
  $("dishTypeOptions").innerHTML = DISH_TYPES.map((type) => filterOptionMarkup(type, dishTypeCounts.get(type) || 0, activeDishTypes)).join("");
}

function filteredRecipes() {
  const query = $("searchInput").value.trim().toLocaleLowerCase("ja");
  const sort = $("sortSelect").value;
  const recipes = state.recipes.filter((recipe) => {
    const ingredientNames = recipe.ingredients.map((item) => item.name);
    const toolNames = recipe.tools.map((tool) => tool.toLocaleLowerCase("ja"));
    const matchesQuery = !query || recipe.name.toLocaleLowerCase("ja").includes(query) || ingredientNames.some((name) => name.toLocaleLowerCase("ja").includes(query)) || toolNames.some((tool) => tool.includes(query));
    const matchesTags = [...activeTags].every((tag) => ingredientNames.includes(tag));
    const matchesTools = activeTools.size === 0 || [...activeTools].some((tool) => recipe.tools.includes(tool));
    const matchesDishTypes = activeDishTypes.size === 0 || activeDishTypes.has(recipe.dishType);
    return matchesQuery && matchesTags && matchesTools && matchesDishTypes;
  });
  recipes.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "ja");
    if (sort === "cooked") return (b.lastCooked || "").localeCompare(a.lastCooked || "");
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
  return recipes;
}

function renderRecipes() {
  renderTags();
  const recipes = filteredRecipes();
  $("resultSummary").textContent = `${recipes.length}件のレシピ`;
  $("recipeEmpty").hidden = recipes.length !== 0;
  $("recipeGrid").hidden = recipes.length === 0;
  $("recipeGrid").innerHTML = recipes.map((recipe) => `
    <article class="recipe-card">
      <button class="recipe-card-button" type="button" data-recipe-id="${escapeAttr(recipe.id)}" aria-label="${escapeAttr(recipe.name)}の詳細を見る">
        <div class="recipe-card-content">
          <h2>${escapeHTML(recipe.name)}</h2>
          <div class="recipe-facets"><span class="dish-type-tag">${escapeHTML(recipe.dishType)}</span>${recipe.tools.slice(0, 2).map((tool) => `<span class="tool-tag">${escapeHTML(tool)}</span>`).join("")}</div>
          <div class="ingredient-tags">${recipe.ingredients.slice(0, 4).map((item) => `<span class="ingredient-tag">${escapeHTML(item.name)}</span>`).join("")}</div>
        </div>
        <div class="recipe-summary">
          <span class="time-pill"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${recipe.time}分</span>
          <p class="recipe-meta">${escapeHTML(formatLastCooked(recipe.lastCooked))}</p>
        </div>
      </button>
      <button class="recipe-delete" type="button" data-delete-recipe="${escapeAttr(recipe.id)}" aria-label="${escapeAttr(recipe.name)}を削除">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg><span>削除</span>
      </button>
    </article>`).join("");
  const count = activeTags.size + activeTools.size + activeDishTypes.size;
  $("filterCount").hidden = count === 0;
  $("filterCount").textContent = count;
}

function renderRecipeIngredientList(ingredients = []) {
  const segments = [];
  ingredients.forEach((item) => {
    const group = normalizeIngredientGroup(item.group);
    const current = segments.at(-1);
    if (!current || current.group !== group) segments.push({ group, items: [item] });
    else current.items.push(item);
  });
  const renderItem = (item) => `<li class="ingredient-item"><span>${escapeHTML(item.name)}</span><span>${escapeHTML(item.amount)}</span></li>`;
  return segments.map((segment) => {
    if (!segment.group) return segment.items.map(renderItem).join("");
    return `<li class="ingredient-group-block" aria-label="材料グループ${segment.group}"><div class="ingredient-group-heading"><strong>（${segment.group}）</strong><span>${segment.items.length}品</span></div><ul class="ingredient-group-items">${segment.items.map(renderItem).join("")}</ul></li>`;
  }).join("");
}

function recipeSourceImage(source) {
  if (source?.type !== "image") return "";
  return safeHttpsUrl(source.url) || (/^data:image\//i.test(source.dataUrl || "") ? source.dataUrl : "");
}

function renderRecipeSource(recipe) {
  const source = normalizeRecipeSource(recipe.source);
  if (!source) return "";
  if (source.type === "url") {
    let host = "元のWebサイト";
    try { host = new URL(source.url).hostname.replace(/^www\./, ""); } catch {}
    return `<section class="detail-section recipe-source-section"><h3>取り込み元</h3><a class="source-link-card" href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer"><span class="source-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg></span><span><strong>元のWebサイトを開く</strong><small>${escapeHTML(host)}</small></span><svg class="source-card-arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M9 5h10v10M19 5 8 16M15 19H5V9"/></svg></a></section>`;
  }
  const image = recipeSourceImage(source);
  if (!image) return "";
  return `<section class="detail-section recipe-source-section"><h3>取り込み元</h3><button class="source-image-card" type="button" data-view-source-image="${escapeAttr(recipe.id)}"><img src="${escapeAttr(image)}" alt="" loading="lazy"><span><strong>解析した画像を表示</strong><small>タップして拡大</small></span><svg class="source-card-arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg></button></section>`;
}

function openSourceImage(recipeId) {
  const recipe = state.recipes.find((item) => item.id === recipeId);
  const image = recipeSourceImage(recipe?.source);
  if (!recipe || !image) return;
  $("sourceImagePreview").src = image;
  $("sourceImagePreview").alt = `${recipe.name}の取り込み元画像`;
  $("sourceImageDialog").showModal();
}

function openRecipeDetail(id) {
  const recipe = state.recipes.find((item) => item.id === id);
  if (!recipe) return;
  $("recipeDetail").innerHTML = `
    <div class="detail-body">
      <div class="detail-head"><div><h2 id="detailTitle">${escapeHTML(recipe.name)}</h2><p>${escapeHTML(recipe.dishType)} ・ ${recipe.time}分 ・ ${recipe.servings}人分 ・ ${escapeHTML(formatLastCooked(recipe.lastCooked))}</p></div></div>
      <div class="detail-actions">
        <button class="primary-button" type="button" data-schedule-recipe="${escapeAttr(recipe.id)}">献立に追加</button>
        <button class="secondary-button" type="button" data-shop-recipe="${escapeAttr(recipe.id)}">材料を買い物へ</button>
        <button class="secondary-button edit-recipe-button" type="button" data-edit-recipe="${escapeAttr(recipe.id)}">レシピを編集</button>
      </div>
      ${recipe.tools.length ? `<section class="detail-section compact-detail-section"><h3>調理器具</h3><div class="detail-tags">${recipe.tools.map((tool) => `<span class="tool-tag">${escapeHTML(tool)}</span>`).join("")}</div></section>` : ""}
      <section class="detail-section"><h3>材料</h3><ul class="ingredient-list">${renderRecipeIngredientList(recipe.ingredients)}</ul></section>
      <section class="detail-section"><h3>作り方</h3><ol class="steps-list">${recipe.steps.map((step) => `<li>${escapeHTML(step)}</li>`).join("")}</ol></section>
      ${renderRecipeSource(recipe)}
    </div>`;
  $("recipeDetailDialog").showModal();
}

function calendarDays(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function renderCalendar() {
  $("monthLabel").textContent = `${calendarDate.getFullYear()}年 ${calendarDate.getMonth() + 1}月`;
  $("calendarGrid").innerHTML = calendarDays(calendarDate).map((date) => {
    const key = iso(date);
    const recipe = state.recipes.find((item) => item.id === state.schedule[key]);
    const outside = date.getMonth() !== calendarDate.getMonth();
    const isToday = key === iso(today);
    return `<div class="calendar-day${outside ? " outside" : ""}${isToday ? " today" : ""}" role="gridcell">
      <button class="day-trigger" type="button" data-calendar-date="${key}" aria-label="${dateFormatter.format(date)}${recipe ? `、${escapeAttr(recipe.name)}を変更` : "、献立を追加"}">
        <span class="day-number">${date.getDate()}</span><span class="day-add" aria-hidden="true">＋</span>
      </button>
      ${recipe ? `<div class="meal-chip"><span>${escapeHTML(recipe.name)}</span><button class="meal-remove" type="button" data-remove-meal-date="${key}" aria-label="${dateFormatter.format(date)}の${escapeAttr(recipe.name)}を削除">×</button></div>` : ""}
    </div>`;
  }).join("");
}

function openMealPicker(date = iso(today), presetRecipe = "") {
  selectedMealDate = date;
  $("mealDateInput").value = date;
  $("mealSearch").value = "";
  renderMealPicker(presetRecipe);
  if ($("recipeDetailDialog").open) $("recipeDetailDialog").close();
  $("mealPickerDialog").showModal();
}

function removeMeal(date) {
  const recipeId = state.schedule[date];
  if (!recipeId) return;
  const recipe = state.recipes.find((item) => item.id === recipeId);
  delete state.schedule[date];
  saveState();
  renderCalendar();
  toast(`${recipe?.name || "献立"}の予定を削除しました`, "元に戻す", () => {
    state.schedule[date] = recipeId;
    saveState();
    renderCalendar();
    toast("予定を元に戻しました");
  });
}

function renderMealPicker(preferred = "") {
  const query = $("mealSearch").value.trim().toLocaleLowerCase("ja");
  let recipes = state.recipes.filter((item) => item.name.toLocaleLowerCase("ja").includes(query) || item.ingredients.some((ingredient) => ingredient.name.includes(query)));
  if (preferred) recipes = recipes.sort((item) => item.id === preferred ? -1 : 0);
  $("mealPickerList").innerHTML = recipes.length ? recipes.map((recipe) => `
    <button class="picker-item" type="button" data-pick-recipe="${escapeAttr(recipe.id)}">
      <span><strong>${escapeHTML(recipe.name)}</strong><small>${escapeHTML(formatLastCooked(recipe.lastCooked))}</small></span><span class="picker-add" aria-hidden="true">＋</span>
    </button>`).join("") : `<div class="empty-state small"><h2>見つかりません</h2><p>別の名前や材料で検索してください。</p></div>`;
}

function deleteRecipe(recipeId) {
  const recipe = state.recipes.find((item) => item.id === recipeId);
  if (!recipe) return;
  if (!confirm(`「${recipe.name}」を削除しますか？\n献立に追加済みの予定からも削除されます。`)) return;
  window.MealnoteCloud?.deleteRecipeImage?.(recipe.source).catch(() => {});
  state.recipes = state.recipes.filter((item) => item.id !== recipeId);
  Object.keys(state.schedule).forEach((date) => {
    if (state.schedule[date] === recipeId) delete state.schedule[date];
  });
  const availableIngredients = new Set(state.recipes.flatMap((item) => item.ingredients.map((ingredient) => ingredient.name)));
  activeTags = new Set([...activeTags].filter((tag) => availableIngredients.has(tag)));
  const availableTools = new Set(state.recipes.flatMap((item) => item.tools));
  activeTools = new Set([...activeTools].filter((tool) => availableTools.has(tool)));
  const availableDishTypes = new Set(state.recipes.map((item) => item.dishType));
  activeDishTypes = new Set([...activeDishTypes].filter((type) => availableDishTypes.has(type)));
  saveState();
  renderRecipes();
  renderCalendar();
  toast(`「${recipe.name}」を削除しました`);
}

function addMeal(recipeId) {
  state.schedule[selectedMealDate] = recipeId;
  const selectedDate = new Date(`${selectedMealDate}T00:00:00`);
  if (selectedDate <= today) {
    const recipe = state.recipes.find((item) => item.id === recipeId);
    if (recipe) recipe.lastCooked = selectedMealDate;
  }
  calendarDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  saveState();
  $("mealPickerDialog").close();
  renderCalendar();
  renderRecipes();
  toast("献立に追加しました");
}

function addRecipeToShopping(recipeId) {
  const recipe = state.recipes.find((item) => item.id === recipeId);
  if (!recipe) return;
  recipe.ingredients.forEach((ingredient) => {
    const existing = state.shopping.find((item) => item.name === ingredient.name && !item.checked);
    if (existing) {
      if (!existing.amount.includes(ingredient.amount)) existing.amount = `${existing.amount}・${ingredient.amount}`;
      if (!existing.sources.includes(recipe.name)) existing.sources.push(recipe.name);
    } else {
      state.shopping.push({ id: crypto.randomUUID(), name: ingredient.name, amount: ingredient.amount, category: ingredient.category || categorize(ingredient.name), checked: false, sources: [recipe.name] });
    }
  });
  saveState();
  renderShopping();
  renderBadges();
  if ($("recipeDetailDialog").open) $("recipeDetailDialog").close();
  toast(`${recipe.name}の材料を追加しました`);
}

function categorize(name) {
  if (categoryMap[name]) return categoryMap[name];
  if (/肉|鮭|魚|えび|さば/.test(name)) return "魚・肉";
  if (/牛乳|チーズ|バター|ヨーグルト/.test(name)) return "乳製品";
  if (/しょうゆ|味噌|みりん|塩|砂糖|酢|油/.test(name)) return "調味料";
  if (/卵|豆腐|納豆/.test(name)) return "卵・豆腐";
  if (/パスタ|米|ごはん|パン|麺/.test(name)) return "その他";
  return "野菜・その他";
}

function renderShopping() {
  const groups = new Map();
  state.shopping.forEach((item) => {
    const category = item.category || categorize(item.name);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  $("shoppingList").innerHTML = [...groups.entries()].map(([category, items]) => `<section class="shopping-group"><h3>${escapeHTML(category)}</h3>${items.map((item) => `
    <label class="shopping-item${item.checked ? " is-checked" : ""}"><input type="checkbox" data-shopping-check="${escapeAttr(item.id)}" ${item.checked ? "checked" : ""}><span class="item-name">${escapeHTML(item.name)}</span><span class="item-amount">${escapeHTML(item.amount || "")}</span><button class="remove-item" type="button" data-remove-shopping="${escapeAttr(item.id)}" aria-label="${escapeAttr(item.name)}を削除">×</button></label>`).join("")}</section>`).join("");
  const checked = state.shopping.filter((item) => item.checked).length;
  $("shoppingProgress").textContent = state.shopping.length ? `${checked} / ${state.shopping.length} 点 チェック済み` : "買うものはありません";
  $("shoppingEmpty").hidden = state.shopping.length !== 0;
  renderBadges();
}

function renderBadges() {
  const count = state.shopping.filter((item) => !item.checked).length;
  $("shoppingBadge").textContent = count;
  $("shoppingBadge").hidden = count === 0;
}

function addIngredientRow(name = "", amount = "", resolution = null, group = resolution?.group || "") {
  ingredientRowId += 1;
  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.dataset.row = ingredientRowId;
  row.dataset.resolvedName = name;
  let resolutionLabel = "";
  if (resolution?.resolution === "existing") resolutionLabel = "既存の材料";
  if (resolution?.resolution === "matched") resolutionLabel = `「${resolution.originalName}」を「${name}」に統合`;
  if (resolution?.resolution === "new") resolutionLabel = "新しい材料として保存時に登録";
  const normalizedGroup = normalizeIngredientGroup(group);
  const groupOptions = [`<option value="">なし</option>`, ...INGREDIENT_GROUPS.map((value) => `<option value="${value}"${value === normalizedGroup ? " selected" : ""}>（${value}）</option>`)].join("");
  row.innerHTML = `<label class="ingredient-group-field"><span class="sr-only">材料グループ</span><select class="ingredient-group" aria-label="材料グループ">${groupOptions}</select></label><label><span class="sr-only">材料名</span><input class="ingredient-name" list="ingredientSuggestions" placeholder="材料名" value="${escapeAttr(name)}">${resolutionLabel ? `<small class="ingredient-resolution${resolution.resolution === "new" ? " is-new" : ""}">${escapeHTML(resolutionLabel)}</small>` : ""}</label><label><span class="sr-only">分量</span><input class="ingredient-amount" placeholder="分量" value="${escapeAttr(amount)}"></label><button type="button" data-remove-row aria-label="この材料を削除">×</button>`;
  $("ingredientRows").append(row);
}

function addStepRow(value = "", afterRow = null) {
  stepRowId += 1;
  const row = document.createElement("div");
  row.className = "step-row";
  row.dataset.stepRow = stepRowId;
  row.innerHTML = `<label><span class="sr-only">作り方の手順</span><textarea class="step-input" rows="2" placeholder="この工程の内容を入力">${escapeHTML(value)}</textarea></label><button class="step-remove" type="button" data-remove-step aria-label="この手順を削除">×</button><button class="step-insert" type="button" data-insert-step aria-label="この工程の後に新しい工程を挿入">＋ この後に工程を挿入</button>`;
  if (afterRow?.parentElement === $("stepRows")) afterRow.after(row);
  else $("stepRows").append(row);
  return row;
}

function renderIngredientSuggestions() {
  $("ingredientSuggestions").innerHTML = [...new Set(state.customIngredients)].sort((a, b) => a.localeCompare(b, "ja")).map((name) => `<option value="${escapeAttr(name)}"></option>`).join("");
}

function resetRecipeForm() {
  editingRecipeId = "";
  $("recipeForm").reset();
  $("formEyebrow").textContent = "NEW RECIPE";
  $("formTitle").textContent = "レシピを追加";
  $("saveRecipe").textContent = "レシピを保存";
  $("formMethodTabs").hidden = false;
  $("recipeTime").value = 20;
  $("recipeServings").value = 2;
  $("recipeDishType").value = "その他";
  $("recipeTools").value = "";
  $("ingredientRows").innerHTML = "";
  addIngredientRow();
  addIngredientRow();
  $("stepRows").innerHTML = "";
  addStepRow();
  addStepRow();
  $("photoPreview").hidden = true;
  $("dropZone").classList.remove("has-image");
  $("analysisStatus").hidden = true;
  $("ocrError").hidden = true;
  $("urlImportStatus").hidden = true;
  $("urlImportError").hidden = true;
  $("aiNotice").hidden = true;
  pendingImage = "";
  pendingSource = null;
  lastPhotoFile = null;
  ocrInProgress = false;
  urlImportInProgress = false;
  lastUrlText = "";
  lastUrlPage = "";
  $("photoInput").disabled = false;
  $("importRecipeUrl").disabled = false;
  switchFormTab("photo");
  validateRecipeForm();
}

function openRecipeEditor(recipeId) {
  const recipe = state.recipes.find((item) => item.id === recipeId);
  if (!recipe) return;
  resetRecipeForm();
  editingRecipeId = recipe.id;
  $("formEyebrow").textContent = "EDIT RECIPE";
  $("formTitle").textContent = "レシピを編集";
  $("saveRecipe").textContent = "変更を保存";
  $("recipeName").value = recipe.name;
  $("recipeTime").value = recipe.time;
  $("recipeServings").value = recipe.servings;
  $("recipeDishType").value = recipe.dishType;
  $("recipeTools").value = recipe.tools.join("、");
  $("ingredientRows").innerHTML = "";
  recipe.ingredients.forEach((ingredient) => addIngredientRow(ingredient.name, ingredient.amount, null, ingredient.group));
  if (!recipe.ingredients.length) addIngredientRow();
  $("stepRows").innerHTML = "";
  normalizeRecipeSteps(recipe.steps).forEach((step) => addStepRow(step));
  if (!$("stepRows").children.length) addStepRow();
  switchFormTab("manual");
  $("formMethodTabs").hidden = true;
  $("gemmaBanner").hidden = true;
  validateRecipeForm();
  if ($("recipeDetailDialog").open) $("recipeDetailDialog").close();
  $("recipeFormDialog").showModal();
}

function switchFormTab(tab) {
  document.querySelectorAll("[data-form-tab]").forEach((button) => {
    const selected = button.dataset.formTab === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  $("photoFormPanel").hidden = tab !== "photo";
  $("urlFormPanel").hidden = tab !== "url";
  $("manualFormPanel").hidden = tab !== "manual";
  $("gemmaBanner").hidden = tab === "manual";
  validateRecipeForm();
}

function updateGemmaServiceStatus() {
  const ready = GemmaRecipe.isConfigured();
  $("gemmaBanner").classList.toggle("is-ready", ready);
  $("gemmaServiceStatus").textContent = ready ? `Cloud Run＋Vertex AI・${GemmaRecipe.MODEL}` : "AI解析サービスを準備しています";
}

function knownIngredientNames() {
  return [...new Set([
    ...state.customIngredients,
    ...state.recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name))
  ])];
}

function applyRecipeSuggestion(suggestion, sourceLabel, source = null) {
  pendingSource = normalizeRecipeSource(source);
  $("recipeName").value = suggestion.name;
  $("recipeTime").value = suggestion.time;
  $("recipeServings").value = suggestion.servings;
  $("ingredientRows").innerHTML = "";
  suggestion.ingredients.forEach((ingredient) => addIngredientRow(ingredient.name, ingredient.amount, ingredient, ingredient.group));
  $("stepRows").innerHTML = "";
  if (suggestion.steps.length) suggestion.steps.forEach((step) => addStepRow(step));
  else addStepRow();
  const newCount = suggestion.ingredients.filter((ingredient) => ingredient.resolution === "new").length;
  const matchedCount = suggestion.ingredients.filter((ingredient) => ingredient.resolution === "matched").length;
  const withoutAmount = suggestion.ingredients.filter((ingredient) => !ingredient.amount).length;
  const groupedCount = suggestion.ingredients.filter((ingredient) => normalizeIngredientGroup(ingredient.group)).length;
  $("aiNoticeTitle").textContent = `${sourceLabel}から${suggestion.ingredients.length}件の材料と${suggestion.steps.length}件の手順を抽出しました`;
  $("aiNoticeDetail").textContent = [
    newCount ? `未登録の${newCount}件は保存時に材料リストへ追加します。` : "",
    matchedCount ? `近い既存材料へ${matchedCount}件を統合しました。` : "",
    groupedCount ? `（A）（B）などのグループを${groupedCount}件に反映しました。` : "",
    withoutAmount ? `分量が見つからない${withoutAmount}件は確認してください。` : "",
    "保存前に内容を確認してください。"
  ].filter(Boolean).join(" ");
  $("aiNotice").hidden = false;
  switchFormTab("manual");
}

function validateRecipeForm() {
  const manualVisible = !$("manualFormPanel").hidden;
  const valid = manualVisible && $("recipeName").value.trim() && [...document.querySelectorAll(".ingredient-name")].some((input) => input.value.trim());
  $("saveRecipe").disabled = !valid;
}

async function compressImage(file) {
  const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = dataUrl; });
  const max = 1200;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .8);
}

async function analyzePhoto(file, mode = "gemma") {
  if (!file || !file.type.startsWith("image/")) { toast("画像ファイルを選択してください"); return; }
  if (file.size > 10 * 1024 * 1024) { toast("10MB以下の画像を選択してください"); return; }
  lastPhotoFile = file;
  if (ocrInProgress) return;
  pendingSource = null;
  ocrInProgress = true;
  $("photoInput").disabled = true;
  try {
    pendingImage = await compressImage(file);
    $("photoPreview").src = pendingImage;
    $("photoPreview").hidden = false;
    $("dropZone").classList.add("has-image");
    $("analysisStatus").hidden = false;
    $("ocrError").hidden = true;
    $("fallbackOCR").hidden = mode === "local";
    let suggestion;
    if (mode === "gemma") {
      $("analysisStatusTitle").textContent = "Gemma 4が画像を解析しています…";
      $("analysisStatusDetail").textContent = "材料と作り方を照合しています";
      $("analysisProgress").removeAttribute("value");
      suggestion = await GemmaRecipe.analyzeImage(file, knownIngredientNames());
    } else {
      $("analysisStatusTitle").textContent = "端末内OCRを準備しています…";
      $("analysisStatusDetail").textContent = "初回は認識モデルの準備に少し時間がかかります";
      $("analysisProgress").value = 0;
      const rawText = await RecipeOCR.recognize(file, ({ status, progress, overallProgress, phase }) => {
        const recognizing = status === "recognizing text";
        $("analysisStatusTitle").textContent = recognizing ? "画像内の文字を読み取っています…" : "端末内OCRを準備しています…";
        $("analysisStatusDetail").textContent = recognizing ? `${phase === "steps" ? "作り方を詳しく確認中" : "料理名と材料を抽出中"} ${Math.round(progress * 100)}%` : "日本語の認識モデルを読み込んでいます";
        $("analysisProgress").value = recognizing ? Math.round(overallProgress * 100) : 0;
      });
      suggestion = RecipeOCR.parse(rawText, file.name, knownIngredientNames());
    }
    if (!suggestion.ingredients.length) throw new Error("材料欄を認識できませんでした");
    $("analysisStatus").hidden = true;
    $("ocrError").hidden = true;
    applyRecipeSuggestion(suggestion, mode === "gemma" ? "Gemma 4画像" : "端末内OCR", { type: "image", dataUrl: pendingImage, name: file.name });
    toast(`${suggestion.ingredients.length}件の材料を読み取りました`);
  } catch (error) {
    $("analysisStatus").hidden = true;
    const message = error?.message || "画像を読み取れませんでした";
    const networkError = /読み込|network|fetch|timeout|タイムアウト/i.test(message);
    $("ocrErrorTitle").textContent = mode === "gemma" ? "Gemma 4で解析できませんでした" : (networkError ? "端末内OCRの準備に失敗しました" : "材料を読み取れませんでした");
    $("ocrErrorDetail").textContent = mode === "gemma"
      ? `${message} 通信環境を確認するか、端末内OCRをお試しください。`
      : (networkError ? "通信環境を確認して再読み取りしてください。初回は日本語モデルの取得が必要です。" : "材料欄と作り方が画面内に入った、文字の鮮明な画像で再読み取りしてください。");
    $("fallbackOCR").hidden = mode === "local";
    $("ocrError").hidden = false;
    toast(message);
  } finally {
    ocrInProgress = false;
    $("photoInput").disabled = false;
    $("analysisProgress").value = 0;
  }
}

function normalizeRecipeUrl(value) {
  const url = new URL(String(value || "").trim());
  if (url.protocol !== "https:") throw new Error("https://で始まる公開URLを入力してください");
  if (/^(?:localhost|127\.|0\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(url.hostname)) throw new Error("公開されているWebサイトのURLを入力してください");
  return url.href;
}

async function importRecipeFromUrl(mode = "gemma") {
  if (urlImportInProgress) return;
  let pageUrl;
  try { pageUrl = normalizeRecipeUrl($("recipeUrl").value); }
  catch (error) { $("recipeUrl").focus(); toast(error.message); return; }
  pendingSource = null;
  urlImportInProgress = true;
  $("importRecipeUrl").disabled = true;
  $("urlImportStatus").hidden = false;
  $("urlImportError").hidden = true;
  $("fallbackUrlImport").hidden = mode === "local";
  $("urlImportStatusTitle").textContent = "ページを読み取っています…";
  $("urlImportStatusDetail").textContent = "材料と作り方を探しています";
  try {
    $("urlImportStatusTitle").textContent = mode === "gemma" ? "Gemma 4がレシピを整理しています…" : "従来方式でレシピを整理しています…";
    $("urlImportStatusDetail").textContent = "材料リストと番号付きの作り方を作成しています";
    let suggestion;
    if (mode === "gemma") {
      suggestion = await GemmaRecipe.analyzeUrl(pageUrl, knownIngredientNames());
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);
      try {
        let text = lastUrlPage === pageUrl ? lastUrlText : "";
        if (!text) {
          const response = await fetch(`https://r.jina.ai/${pageUrl}`, { headers: { Accept: "text/plain" }, signal: controller.signal });
          if (!response.ok) throw new Error(`ページ取得に失敗しました（${response.status}）`);
          text = await response.text();
          lastUrlText = text;
          lastUrlPage = pageUrl;
        }
        if (text.length < 80) throw new Error("ページの内容が空でした");
        suggestion = RecipeOCR.parseWebPage(text, pageUrl, knownIngredientNames());
      } finally { clearTimeout(timeout); }
    }
    $("urlImportStatus").hidden = true;
    applyRecipeSuggestion(suggestion, mode === "gemma" ? "Gemma 4 Webページ" : "Webページ（従来方式）", { type: "url", url: pageUrl });
    toast(`${suggestion.ingredients.length}件の材料を取り込みました`);
  } catch (error) {
    $("urlImportStatus").hidden = true;
    const message = error?.name === "AbortError" ? "ページ取得がタイムアウトしました" : (error?.message || "ページを読み取れませんでした");
    const sectionError = /材料欄|材料を抽出/.test(message);
    $("urlImportErrorTitle").textContent = mode === "gemma" ? "Gemma 4でページを解析できませんでした" : (sectionError ? "レシピの材料欄を見つけられませんでした" : "ページを読み取れませんでした");
    $("urlImportErrorDetail").textContent = mode === "gemma"
      ? `${message} 通信環境を確認するか、従来方式での取り込みをお試しください。`
      : (sectionError ? "材料と作り方が本文に掲載されたレシピページか確認し、再読み取りしてください。" : "URLが公開されているか確認してください。ログインが必要なページには対応していません。");
    $("fallbackUrlImport").hidden = mode === "local";
    $("urlImportError").hidden = false;
    toast(message);
  } finally {
    urlImportInProgress = false;
    $("importRecipeUrl").disabled = false;
  }
}

async function resolveRecipeSource(recipeId, existingSource = null) {
  if (!pendingSource) return normalizeRecipeSource(existingSource);
  if (pendingSource.type === "url") return pendingSource;
  const dataUrl = recipeSourceImage(pendingSource);
  if (!dataUrl) return null;
  try {
    const uploaded = await window.MealnoteCloud?.uploadRecipeImage?.(recipeId, dataUrl, pendingSource.name);
    return normalizeRecipeSource(uploaded || pendingSource);
  } catch {
    toast("画像は端末に保存しました。クラウド保存は自動で再試行します");
    return pendingSource;
  }
}

async function submitRecipe(event) {
  event.preventDefault();
  const ingredients = [...document.querySelectorAll(".ingredient-row")].map((row) => ({
    name: row.querySelector(".ingredient-name").value.trim(),
    amount: row.querySelector(".ingredient-amount").value.trim(),
    group: normalizeIngredientGroup(row.querySelector(".ingredient-group").value),
  })).filter((item) => item.name).map((item) => ({ ...item, category: categorize(item.name) }));
  if (!$("recipeName").value.trim() || ingredients.length === 0) { toast("料理名と材料を入力してください"); return; }
  const existingRecipe = editingRecipeId ? state.recipes.find((item) => item.id === editingRecipeId) : null;
  const id = existingRecipe?.id || `recipe-${Date.now()}`;
  const saveButton = $("saveRecipe");
  const saveLabel = saveButton.textContent;
  saveButton.disabled = true;
  saveButton.textContent = pendingSource?.type === "image" ? "画像を保存中…" : "保存中…";
  const source = await resolveRecipeSource(id, existingRecipe?.source);
  const recipe = {
    ...existingRecipe,
    id,
    name: $("recipeName").value.trim(),
    time: Math.max(1, Number($("recipeTime").value) || 20),
    servings: Math.max(1, Number($("recipeServings").value) || 2),
    dishType: normalizeDishType($("recipeDishType").value),
    tools: normalizeRecipeTools($("recipeTools").value),
    ingredients,
    steps: [...document.querySelectorAll(".step-input")].map((input) => input.value.trim()).filter(Boolean),
    source,
    lastCooked: existingRecipe?.lastCooked || "",
    createdAt: existingRecipe?.createdAt || iso(today)
  };
  if (!recipe.steps.length) recipe.steps = ["材料を準備する。", "火が通るまで調理し、味を整える。"]; 
  if (existingRecipe) state.recipes = state.recipes.map((item) => item.id === id ? recipe : item);
  else state.recipes.unshift(recipe);
  ingredients.forEach((item) => { if (!state.customIngredients.includes(item.name)) state.customIngredients.push(item.name); });
  saveState();
  $("recipeFormDialog").close();
  renderIngredientSuggestions();
  renderRecipes();
  toast(existingRecipe ? "レシピを更新しました" : "レシピを保存しました");
  editingRecipeId = "";
  saveButton.textContent = saveLabel;
  setTimeout(() => openRecipeDetail(id), 180);
}

function renderCustomIngredients() {
  $("customIngredientList").innerHTML = [...new Set(state.customIngredients)].sort((a, b) => a.localeCompare(b, "ja")).map((name) => `<span class="custom-chip">${escapeHTML(name)}<button type="button" data-remove-custom="${escapeAttr(name)}" aria-label="${escapeAttr(name)}を候補から削除">×</button></span>`).join("");
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) setView(viewButton.dataset.view);
  const recipeButton = event.target.closest("[data-recipe-id]");
  if (recipeButton) openRecipeDetail(recipeButton.dataset.recipeId);
  const deleteRecipeButton = event.target.closest("[data-delete-recipe]");
  if (deleteRecipeButton) deleteRecipe(deleteRecipeButton.dataset.deleteRecipe);
  const editRecipeButton = event.target.closest("[data-edit-recipe]");
  if (editRecipeButton) openRecipeEditor(editRecipeButton.dataset.editRecipe);
  const sourceImageButton = event.target.closest("[data-view-source-image]");
  if (sourceImageButton) openSourceImage(sourceImageButton.dataset.viewSourceImage);
  const openButton = event.target.closest("[data-open='recipeForm']");
  if (openButton) { resetRecipeForm(); $("recipeFormDialog").showModal(); }
  const closeButton = event.target.closest("[data-close]");
  if (closeButton) closeButton.closest("dialog").close();
  const calendarDay = event.target.closest("[data-calendar-date]");
  if (calendarDay) openMealPicker(calendarDay.dataset.calendarDate);
  const removeMealButton = event.target.closest("[data-remove-meal-date]");
  if (removeMealButton) removeMeal(removeMealButton.dataset.removeMealDate);
  const pickButton = event.target.closest("[data-pick-recipe]");
  if (pickButton) addMeal(pickButton.dataset.pickRecipe);
  const shopRecipe = event.target.closest("[data-shop-recipe]");
  if (shopRecipe) addRecipeToShopping(shopRecipe.dataset.shopRecipe);
  const scheduleRecipe = event.target.closest("[data-schedule-recipe]");
  if (scheduleRecipe) openMealPicker(iso(addDays(today, 1)), scheduleRecipe.dataset.scheduleRecipe);
  const removeRow = event.target.closest("[data-remove-row]");
  if (removeRow) { removeRow.closest(".ingredient-row").remove(); validateRecipeForm(); }
  const insertStep = event.target.closest("[data-insert-step]");
  if (insertStep) {
    const row = addStepRow("", insertStep.closest(".step-row"));
    row.querySelector(".step-input").focus();
  }
  const removeStep = event.target.closest("[data-remove-step]");
  if (removeStep) {
    const rows = document.querySelectorAll(".step-row");
    if (rows.length === 1) removeStep.closest(".step-row").querySelector(".step-input").value = "";
    else removeStep.closest(".step-row").remove();
  }
  const removeShopping = event.target.closest("[data-remove-shopping]");
  if (removeShopping) { state.shopping = state.shopping.filter((item) => item.id !== removeShopping.dataset.removeShopping); saveState(); renderShopping(); }
  const removeCustom = event.target.closest("[data-remove-custom]");
  if (removeCustom) { state.customIngredients = state.customIngredients.filter((name) => name !== removeCustom.dataset.removeCustom); saveState(); renderIngredientSuggestions(); renderCustomIngredients(); }
});

document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
}));
$("sourceImageDialog").addEventListener("close", () => {
  $("sourceImagePreview").removeAttribute("src");
  $("sourceImagePreview").alt = "";
});

$("filterButton").addEventListener("click", () => {
  const expanded = $("filterButton").getAttribute("aria-expanded") === "true";
  $("filterButton").setAttribute("aria-expanded", String(!expanded));
  $("tagPanel").hidden = expanded;
});
$("tagOptions").addEventListener("change", (event) => {
  if (!event.target.matches("input")) return;
  event.target.checked ? activeTags.add(event.target.value) : activeTags.delete(event.target.value);
  renderRecipes();
});
$("toolOptions").addEventListener("change", (event) => {
  if (!event.target.matches("input")) return;
  event.target.checked ? activeTools.add(event.target.value) : activeTools.delete(event.target.value);
  renderRecipes();
});
$("dishTypeOptions").addEventListener("change", (event) => {
  if (!event.target.matches("input")) return;
  event.target.checked ? activeDishTypes.add(event.target.value) : activeDishTypes.delete(event.target.value);
  renderRecipes();
});
$("clearFilters").addEventListener("click", () => { activeTags.clear(); activeTools.clear(); activeDishTypes.clear(); renderRecipes(); });
$("resetSearch").addEventListener("click", () => { $("searchInput").value = ""; activeTags.clear(); activeTools.clear(); activeDishTypes.clear(); renderRecipes(); });
$("searchInput").addEventListener("input", renderRecipes);
$("sortSelect").addEventListener("change", renderRecipes);
$("prevMonth").addEventListener("click", () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
$("nextMonth").addEventListener("click", () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
$("todayButton").addEventListener("click", () => { calendarDate = new Date(today.getFullYear(), today.getMonth(), 1); renderCalendar(); });
$("addMealHeader").addEventListener("click", () => openMealPicker(iso(today)));
$("mealSearch").addEventListener("input", () => renderMealPicker());
$("mealDateInput").addEventListener("change", (event) => {
  if (event.target.value) selectedMealDate = event.target.value;
});
$("photoInput").addEventListener("change", (event) => analyzePhoto(event.target.files[0]));
$("retryOCR").addEventListener("click", () => { if (lastPhotoFile) analyzePhoto(lastPhotoFile); else $("photoInput").click(); });
$("fallbackOCR").addEventListener("click", () => { if (lastPhotoFile) analyzePhoto(lastPhotoFile, "local"); else $("photoInput").click(); });
$("manualFromOCRError").addEventListener("click", () => switchFormTab("manual"));
$("importRecipeUrl").addEventListener("click", () => importRecipeFromUrl());
$("retryUrlImport").addEventListener("click", () => importRecipeFromUrl());
$("fallbackUrlImport").addEventListener("click", () => importRecipeFromUrl("local"));
$("manualFromUrlError").addEventListener("click", () => switchFormTab("manual"));
$("recipeUrl").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); importRecipeFromUrl(); } });
$("dropZone").addEventListener("dragover", (event) => { event.preventDefault(); $("dropZone").classList.add("is-dragging"); });
$("dropZone").addEventListener("dragleave", () => $("dropZone").classList.remove("is-dragging"));
$("dropZone").addEventListener("drop", (event) => { event.preventDefault(); $("dropZone").classList.remove("is-dragging"); analyzePhoto(event.dataTransfer.files[0]); });
document.querySelectorAll("[data-form-tab]").forEach((button) => button.addEventListener("click", () => switchFormTab(button.dataset.formTab)));
document.querySelector(".segmented").addEventListener("keydown", (event) => {
  const tabs = [...document.querySelectorAll("[data-form-tab]")];
  const current = tabs.indexOf(document.activeElement);
  if (current < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  switchFormTab(tabs[next].dataset.formTab);
  tabs[next].focus();
});
$("addIngredientRow").addEventListener("click", () => { addIngredientRow(); validateRecipeForm(); });
$("addStepRow").addEventListener("click", () => addStepRow());
$("recipeForm").addEventListener("input", (event) => {
  if (event.target.matches(".ingredient-name")) {
    const row = event.target.closest(".ingredient-row");
    const resolution = row.querySelector(".ingredient-resolution");
    if (resolution && event.target.value.trim() !== row.dataset.resolvedName) resolution.remove();
  }
  validateRecipeForm();
});
$("recipeForm").addEventListener("submit", submitRecipe);
$("manageIngredients").addEventListener("click", () => { renderCustomIngredients(); $("ingredientManagerDialog").showModal(); });
$("customIngredientForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = $("customIngredientInput").value.trim();
  if (value && !state.customIngredients.includes(value)) state.customIngredients.push(value);
  $("customIngredientInput").value = "";
  saveState(); renderIngredientSuggestions(); renderCustomIngredients();
});
$("shoppingList").addEventListener("change", (event) => {
  if (!event.target.matches("[data-shopping-check]")) return;
  const item = state.shopping.find((entry) => entry.id === event.target.dataset.shoppingCheck);
  if (item) item.checked = event.target.checked;
  saveState(); renderShopping();
});
$("quickAddForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("quickAddInput").value.trim();
  if (!name) return;
  state.shopping.push({ id: crypto.randomUUID(), name, amount: "", category: categorize(name), checked: false, sources: [] });
  $("quickAddInput").value = "";
  saveState(); renderShopping(); toast(`${name}を追加しました`);
});
$("clearChecked").addEventListener("click", () => {
  const count = state.shopping.filter((item) => item.checked).length;
  if (!count) { toast("チェック済みの項目はありません"); return; }
  state.shopping = state.shopping.filter((item) => !item.checked); saveState(); renderShopping(); toast(`${count}件を削除しました`);
});
$("shareList").addEventListener("click", async () => {
  const text = state.shopping.filter((item) => !item.checked).map((item) => `・${item.name}${item.amount ? ` ${item.amount}` : ""}`).join("\n");
  if (!text) { toast("コピーする項目がありません"); return; }
  try { await navigator.clipboard.writeText(text); toast("買い物リストをコピーしました"); }
  catch { toast("コピーできませんでした"); }
});
$("helpButton").addEventListener("click", () => toast("レシピ写真を追加するか、日付を選んで献立を作成できます"));
$("accountButton").addEventListener("click", openAccountDialog);
$("mobileMore").addEventListener("click", openAccountDialog);
$("googleSignIn").addEventListener("click", async () => {
  $("googleSignIn").disabled = true;
  try {
    await window.MealnoteCloud.signIn();
  } catch (error) {
    updateAccountUI(window.MealnoteCloud?.getStatus() || { phase: "signed-out" });
    toast(cloudLoginErrorMessage(error));
  } finally {
    $("googleSignIn").disabled = false;
  }
});
$("googleSignOut").addEventListener("click", async () => {
  $("googleSignOut").disabled = true;
  try {
    await window.MealnoteCloud.signOut();
    toast("ログアウトしました。データはこの端末にも残っています");
  } catch {
    toast("ログアウトできませんでした");
  } finally {
    $("googleSignOut").disabled = false;
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") window.MealnoteCloud?.flush().catch(() => {});
});

updateGemmaServiceStatus();
renderIngredientSuggestions();
renderRecipes();
renderCalendar();
renderShopping();
initializeCloudSync();
