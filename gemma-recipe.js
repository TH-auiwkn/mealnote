(function initializeGemmaRecipe(root) {
  "use strict";

  const MODEL = "google/gemma-4-26b-a4b-it-maas";
  const configuredBase = String(root.MEALNOTE_API_BASE || "").trim().replace(/\/$/, "");
  const API_BASE = configuredBase || (/^(?:localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:8080" : "");

  function cleanText(value = "") {
    return String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  function cleanIngredientName(value = "") {
    return cleanText(value)
      .replace(/^[・•●▪︎]\s*/, "")
      .replace(/^[【\[(]\s*[A-Z]\s*[】\])]\s*/i, "")
      .trim();
  }

  function normalizeIngredientGroup(value = "") {
    return cleanText(value).toUpperCase().match(/[A-H]/)?.[0] || "";
  }

  function stepText(value, depth = 0) {
    if (depth > 5 || value == null) return "";
    if (typeof value === "string" || typeof value === "number") {
      const text = cleanText(value);
      return /^\[?object(?: Object)?\]?$/i.test(text) ? "" : text;
    }
    if (Array.isArray(value)) return value.map((item) => stepText(item, depth + 1)).filter(Boolean).join(" ");
    if (typeof value !== "object") return "";
    const preferredKeys = ["text", "instruction", "instructions", "description", "content", "step", "direction", "directions", "value", "name"];
    for (const key of preferredKeys) {
      if (!Object.hasOwn(value, key)) continue;
      const text = stepText(value[key], depth + 1);
      if (text) return text;
    }
    return Object.entries(value)
      .filter(([key]) => !/^(?:@type|type|position|number|id|name)$/i.test(key))
      .map(([, item]) => stepText(item, depth + 1))
      .filter(Boolean)
      .join(" ");
  }

  function normalizeSteps(value) {
    const candidates = Array.isArray(value)
      ? value
      : (value && typeof value === "object" ? Object.values(value) : [value]);
    return candidates
      .map((step) => stepText(step).replace(/^(?:手順)?\s*[0-9①-⑳]+[.)、:：\s]*/, ""))
      .filter((step) => step.length >= 2)
      .slice(0, 60);
  }

  function normalizeRecipe(value, knownIngredients = []) {
    const ingredients = Array.isArray(value?.ingredients) ? value.ingredients : [];
    let activeGroup = "";
    const normalizedIngredients = [];
    ingredients.slice(0, 120).forEach((item) => {
      const rawName = cleanText(item?.name);
      const prefixedGroup = rawName.match(/^(?:\(|（|【|\[)\s*([A-H])\s*(?:\)|）|】|\])\s*/i)?.[1]?.toUpperCase() || "";
      const markerGroup = rawName.match(/^(?:\(|（|【|\[)?\s*([A-H])\s*(?:\)|）|】|\])?$/i)?.[1]?.toUpperCase() || "";
      const explicitGroup = normalizeIngredientGroup(item?.group);
      if (explicitGroup) activeGroup = explicitGroup;
      else if (prefixedGroup || markerGroup) activeGroup = prefixedGroup || markerGroup;
      else if (Object.hasOwn(item || {}, "group")) activeGroup = "";
      const name = cleanIngredientName(rawName);
      if (!name || markerGroup || /^(?:材料|調味料)$/i.test(name)) return;
      const normalized = { name, amount: cleanText(item?.amount), group: explicitGroup || prefixedGroup || activeGroup };
      normalizedIngredients.push({ ...normalized, ...root.RecipeOCR.resolveIngredient(name, knownIngredients) });
    });
    if (!normalizedIngredients.length) throw new Error("Gemma 4が材料を抽出できませんでした");
    const steps = normalizeSteps(value?.steps ?? value?.instructions ?? value?.directions);
    return {
      name: cleanText(value?.name) || "Gemma 4で読み取ったレシピ",
      time: Math.min(1440, Math.max(1, Number(value?.time) || 20)),
      servings: Math.min(100, Math.max(1, Number(value?.servings) || 2)),
      ingredients: normalizedIngredients,
      steps,
      engine: "gemma-4"
    };
  }

  function fileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(new Error("画像ファイルを読み込めませんでした"));
      reader.readAsDataURL(file);
    });
  }

  async function request(path, body) {
    if (!API_BASE) throw new Error("Gemma 4解析サービスの接続先が設定されていません");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 413) throw new Error("画像またはページのデータが大きすぎます");
        if (response.status === 429) throw new Error(payload?.error || "Gemma 4が混み合っています。少し待ってからもう一度お試しください");
        throw new Error(payload?.error || `Gemma 4解析サービスでエラーが発生しました（${response.status}）`);
      }
      if (!payload?.recipe && !payload?.recipes?.length) throw new Error("Gemma 4から抽出結果が返りませんでした");
      return payload;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Gemma 4の解析がタイムアウトしました");
      if (/Failed to fetch|NetworkError|Load failed/i.test(error?.message || "")) throw new Error("Gemma 4解析サービスへ接続できませんでした");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function analyzeImage(file, knownIngredients = []) {
    const data = await fileAsBase64(file);
    const payload = await request("/v1/recipes/extract-image", {
      image: { mimeType: file.type || "image/jpeg", data }
    });
    return normalizeRecipe(payload.recipe, knownIngredients);
  }

  async function analyzeUrl(pageUrl, knownIngredients = []) {
    const payload = await request("/v1/recipes/extract-url", { url: pageUrl });
    const recipes = Array.isArray(payload.recipes) && payload.recipes.length ? payload.recipes : [payload.recipe];
    return recipes
      .filter(Boolean)
      .map((recipe) => ({ ...normalizeRecipe(recipe, knownIngredients), sourceUrl: pageUrl }));
  }

  root.GemmaRecipe = {
    API_BASE,
    MODEL,
    analyzeImage,
    analyzeUrl,
    isConfigured: () => Boolean(API_BASE),
    normalizeRecipe
  };
}(typeof globalThis !== "undefined" ? globalThis : window));
