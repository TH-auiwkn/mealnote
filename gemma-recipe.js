(function initializeGemmaRecipe(root) {
  "use strict";

  const MODEL = "google/gemma-4-26b-a4b-it-maas";
  const configuredBase = String(root.MEALNOTE_API_BASE || "").trim().replace(/\/$/, "");
  const API_BASE = configuredBase || (/^(?:localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:8080" : "");

  function cleanText(value = "") {
    return String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  function normalizeRecipe(value, knownIngredients = []) {
    const ingredients = Array.isArray(value?.ingredients) ? value.ingredients : [];
    const normalizedIngredients = ingredients
      .map((item) => ({ name: cleanText(item?.name), amount: cleanText(item?.amount) }))
      .filter((item) => item.name && !/^(?:材料|調味料|A|B|C)$/i.test(item.name))
      .slice(0, 120)
      .map((item) => ({ ...item, ...root.RecipeOCR.resolveIngredient(item.name, knownIngredients) }));
    if (!normalizedIngredients.length) throw new Error("Gemma 4が材料を抽出できませんでした");
    const steps = (Array.isArray(value?.steps) ? value.steps : [])
      .map((step) => cleanText(step).replace(/^(?:手順)?\s*[0-9①-⑳]+[.)、:：\s]*/, ""))
      .filter((step) => step.length >= 2)
      .slice(0, 60);
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
    const timeout = setTimeout(() => controller.abort(), 90000);
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
      if (!payload?.recipe) throw new Error("Gemma 4から抽出結果が返りませんでした");
      return payload.recipe;
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
    const raw = await request("/v1/recipes/extract-image", {
      image: { mimeType: file.type || "image/jpeg", data }
    });
    return normalizeRecipe(raw, knownIngredients);
  }

  async function analyzeUrl(pageUrl, knownIngredients = []) {
    const raw = await request("/v1/recipes/extract-url", { url: pageUrl });
    return { ...normalizeRecipe(raw, knownIngredients), sourceUrl: pageUrl };
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
