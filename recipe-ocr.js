(function initializeRecipeOCR(root) {
  "use strict";

  const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
  const STEP_REGION_MARKER = "__MEALNOTE_STEP_REGION__";
  let libraryPromise = null;

  function normalizeLine(value = "") {
    return String(value)
      .normalize("NFKC")
      .replace(/[|¦]/g, " ")
      .replace(/[▶►●■◆◇]/g, " ")
      .replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value = "") {
    return normalizeLine(value)
      .toLocaleLowerCase("ja")
      .replace(/[\s・･()（）「」『』【】\[\]。、,.\-ー]/g, "")
      .replace(/鳥もも肉|とりもも肉|鶏もも$/g, "鶏もも肉")
      .replace(/醤油/g, "しょうゆ")
      .replace(/茄子/g, "なす");
  }

  function levenshtein(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const above = previous[j];
        previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = above;
      }
    }
    return previous[b.length];
  }

  function similarity(a, b) {
    const left = normalizeKey(a);
    const right = normalizeKey(b);
    if (!left || !right) return 0;
    return 1 - (levenshtein(left, right) / Math.max(left.length, right.length));
  }

  function resolveIngredient(rawName, knownIngredients = []) {
    const originalName = normalizeLine(rawName).replace(/^[\s(A-Z)]+|[：:]$/g, "").trim();
    const originalKey = normalizeKey(originalName);
    const known = [...new Set(knownIngredients.filter(Boolean))];
    const exact = known.find((name) => normalizeKey(name) === originalKey);
    if (exact) return { name: exact, originalName, resolution: "existing", score: 1 };

    const aliases = {
      "鶏肉": "鶏もも肉",
      "とり肉": "鶏もも肉",
      "鳥肉": "鶏もも肉",
      "鶏もも": "鶏もも肉",
      "パスタ麺": "パスタ"
    };
    const alias = aliases[originalKey];
    if (alias && known.some((name) => normalizeKey(name) === normalizeKey(alias))) {
      return { name: alias, originalName, resolution: "matched", score: .96 };
    }

    const contained = known
      .filter((name) => normalizeKey(name).length >= 2 && originalKey.includes(normalizeKey(name)))
      .sort((a, b) => normalizeKey(b).length - normalizeKey(a).length)[0];
    if (contained) return { name: contained, originalName, resolution: "matched", score: .9 };

    const nearest = known
      .map((name) => ({ name, score: similarity(originalName, name) }))
      .sort((a, b) => b.score - a.score)[0];
    if (nearest && nearest.score >= .8) return { ...nearest, originalName, resolution: "matched" };
    return { name: originalName, originalName, resolution: "new", score: nearest?.score || 0 };
  }

  const amountPattern = /(?:大さじ|小さじ)\s*[0-9]+(?:[./][0-9]+)?|[0-9]+(?:[./][0-9]+)?\s*(?:kg|g|mg|ml|mL|L|個|本|枚|片|切れ|束|パック|袋|缶|合|カップ|玉|丁)(?:\s*[（(][^）)]+[）)])?|適量|少々|ひとつまみ/i;

  function parseIngredientLine(line) {
    const clean = normalizeLine(line)
      .replace(/^\(?[A-Z]\)?\s*/i, "")
      .replace(/^(?:材料|分量)\s*/u, "")
      .trim();
    if (!clean || /^(?:A|B|C|調味料)$/i.test(clean)) return null;
    const match = amountPattern.exec(clean);
    if (!match) return { type: "name", value: clean.replace(/[：:]$/, "").trim() };
    const name = clean.slice(0, match.index).replace(/[：:]$/, "").trim();
    const amount = clean.slice(match.index).replace(/\s+/g, "").trim();
    if (!name) return { type: "amount", value: amount };
    return { type: "ingredient", name, amount };
  }

  function isIngredientNoise(line) {
    return !line
      || /^(?:材料|分量|\(?[A-Z]\)?|つくり方|作り方)$/i.test(line)
      || /(?:栄養|エネルギー|たんぱく質|食物繊維|塩分|糖質|野菜量|レシピ登録|登録済|kcal|ホームクッキング)/i.test(line);
  }

  function extractIngredients(lines, start, end, knownIngredients) {
    const output = [];
    const pendingNames = [];
    lines.slice(start, end).forEach((line) => {
      if (isIngredientNoise(line)) return;
      const parsed = parseIngredientLine(line);
      if (!parsed) return;
      if (parsed.type === "ingredient") output.push(parsed);
      if (parsed.type === "name" && parsed.value.length <= 60) pendingNames.push(parsed.value);
      if (parsed.type === "amount" && pendingNames.length) output.push({ name: pendingNames.shift(), amount: parsed.value });
    });
    return output
      .filter((item) => item.name && item.amount && !/^\d+$/.test(item.name))
      .map((item) => ({ ...item, ...resolveIngredient(item.name, knownIngredients) }));
  }

  function extractSteps(lines, start) {
    const steps = [];
    let current = "";
    let hasNumbers = false;
    lines.slice(start).forEach((line) => {
      if (!line || /(?:関連レシピ|レシピを探す|キッコーマンホームクッキング)/.test(line)) return;
      const numbered = line.match(/^([1-9])(?:[.)、:：\s]*)?(.*)$/);
      if (numbered) {
        if (current.trim()) steps.push(current.trim());
        current = numbered[2].trim();
        hasNumbers = true;
        return;
      }
      if (hasNumbers) current = `${current}${current ? " " : ""}${line}`.trim();
    });
    if (current.trim()) steps.push(current.trim());
    if (steps.length) return steps.map(normalizeLine).filter((step) => step.length >= 4);

    const paragraphs = [];
    let paragraph = [];
    lines.slice(start).forEach((line) => {
      if (!line) {
        if (paragraph.length) paragraphs.push(normalizeLine(paragraph.join(" ")));
        paragraph = [];
        return;
      }
      if (!/(?:関連レシピ|レシピを探す|キッコーマンホームクッキング)/.test(line)) paragraph.push(line);
    });
    if (paragraph.length) paragraphs.push(normalizeLine(paragraph.join(" ")));
    return paragraphs.filter((step) => step.length >= 8).slice(0, 30);
  }

  function titleFromFilename(fileName = "") {
    const value = normalizeLine(fileName)
      .replace(/\.(?:png|jpe?g|webp|heic)$/i, "")
      .replace(/^FireShot Capture \d+\s*-\s*/i, "")
      .replace(/のレシピ[・･]つくり方.*$/u, "")
      .replace(/\s+-\s+(?:キッコーマン|ホームクッキング|\[?www\.).*$/i, "")
      .trim();
    return value.length >= 4 && value.length <= 80 ? value : "";
  }

  function titleFromLines(lines, materialIndex) {
    const candidates = lines.slice(0, Math.max(1, materialIndex)).filter((line) =>
      line.length >= 6 && line.length <= 80
      && !/(?:調理時間|エネルギー|塩分|たんぱく質|脂質|食物繊維|糖質|野菜量|登録|レシピ|kcal|タグ)/i.test(line)
      && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(line)
    );
    return candidates[0] || "写真から読み取ったレシピ";
  }

  function parse(text, fileName = "", knownIngredients = []) {
    const [mainText, stepRegionText = ""] = String(text || "").split(STEP_REGION_MARKER);
    const lines = mainText.split(/\r?\n/).map(normalizeLine).filter(Boolean);
    const materialIndex = lines.findIndex((line) => /^材料(?:\s|[（(]|$)/.test(line) || /材料.*[0-9]+人分/.test(line));
    const stepIndex = lines.findIndex((line, index) => index > materialIndex && /^(?:つくり方|作り方)/.test(line));
    const materialStart = materialIndex >= 0 ? materialIndex + 1 : 0;
    const materialEnd = stepIndex > materialStart ? stepIndex : lines.length;
    const ingredients = extractIngredients(lines, materialStart, materialEnd, knownIngredients);
    const stepRegionLines = stepRegionText.split(/\r?\n/).map(normalizeLine);
    const stepRegionHeading = stepRegionLines.findIndex((line) => /^(?:つくり方|作り方)/.test(line));
    const steps = stepRegionLines.length
      ? extractSteps(stepRegionLines, stepRegionHeading >= 0 ? stepRegionHeading + 1 : 0)
      : (stepIndex >= 0 ? extractSteps(lines, stepIndex + 1) : []);
    const preMaterials = lines.slice(0, materialIndex >= 0 ? materialIndex + 1 : Math.min(lines.length, 30)).join(" ");
    const timeMatch = preMaterials.match(/(?:調理時間\s*)?([0-9]{1,3})\s*分/);
    const servingsMatch = (materialIndex >= 0 ? lines[materialIndex] : preMaterials).match(/([0-9]+)\s*人分/);
    return {
      name: titleFromFilename(fileName) || titleFromLines(lines, materialIndex),
      time: timeMatch ? Number(timeMatch[1]) : 20,
      servings: servingsMatch ? Number(servingsMatch[1]) : 2,
      ingredients,
      steps,
      rawText: text
    };
  }

  function loadTesseract() {
    if (root.Tesseract) return Promise.resolve(root.Tesseract);
    if (libraryPromise) return libraryPromise;
    if (typeof document === "undefined") return Promise.reject(new Error("OCR is available only in a browser"));
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TESSERACT_URL;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve(root.Tesseract);
      script.onerror = () => reject(new Error("OCRライブラリを読み込めませんでした"));
      document.head.append(script);
    });
    return libraryPromise;
  }

  function findStepRegionTop(tsv = "") {
    const groups = new Map();
    String(tsv).split(/\r?\n/).slice(1).forEach((row) => {
      const columns = row.split("\t");
      if (columns.length < 12 || !columns[11]?.trim()) return;
      const key = columns.slice(1, 5).join(":");
      const entry = groups.get(key) || { text: "", top: Number(columns[7]) || 0, height: Number(columns[9]) || 0 };
      entry.text += columns[11].trim();
      entry.top = Math.min(entry.top, Number(columns[7]) || entry.top);
      entry.height = Math.max(entry.height, Number(columns[9]) || 0);
      groups.set(key, entry);
    });
    const heading = [...groups.values()].find((entry) => /つくり方|作り方/.test(normalizeLine(entry.text)));
    return heading ? Math.max(0, heading.top - Math.round(heading.height * .5)) : null;
  }

  async function imageSize(file) {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = reject;
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function recognize(file, onProgress = () => {}) {
    const Tesseract = await loadTesseract();
    let phase = "page";
    const worker = await Tesseract.createWorker(["jpn", "eng"], 1, {
      logger(message) {
        const progress = Number(message.progress) || 0;
        const overallProgress = message.status === "recognizing text"
          ? (phase === "steps" ? .72 + progress * .28 : progress * .72)
          : 0;
        onProgress({ status: message.status || "recognizing text", progress, overallProgress, phase });
      }
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: "3", preserve_interword_spaces: "1", user_defined_dpi: "300" });
      const result = await worker.recognize(file, {}, { text: true, tsv: true });
      const size = await imageSize(file);
      const detectedStepTop = findStepRegionTop(result.data.tsv);
      const stepTop = detectedStepTop ?? (/つくり方|作り方/.test(normalizeLine(result.data.text)) ? Math.round(size.height * .65) : null);
      if (stepTop === null || stepTop >= size.height - 80) return result.data.text || "";
      phase = "steps";
      await worker.setParameters({ tessedit_pageseg_mode: "4", preserve_interword_spaces: "1" });
      const stepResult = await worker.recognize(file, { rectangle: { top: stepTop, left: 0, width: size.width, height: size.height - stepTop } });
      const combinedText = `${result.data.text || ""}\n${STEP_REGION_MARKER}\n${stepResult.data.text || ""}`;
      return combinedText;
    } finally {
      await worker.terminate();
    }
  }

  root.RecipeOCR = { normalizeKey, parse, recognize, resolveIngredient };
}(typeof globalThis !== "undefined" ? globalThis : window));
