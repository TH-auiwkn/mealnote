(function initializeRecipeOCR(root) {
  "use strict";

  const TESSERACT_URLS = [
    "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js",
    "https://unpkg.com/tesseract.js@7.0.0/dist/tesseract.min.js"
  ];
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

  function correctOCRText(value = "") {
    return String(value)
      .normalize("NFKC")
      .replace(/フライ(?:パバ|バ|パパ)ン/g, "フライパン")
      .replace(/だししようゆ/g, "だししょうゆ")
      .replace(/しようゆ/g, "しょうゆ")
      .replace(/大さ\s*じ/g, "大さじ")
      .replace(/小さ\s*じ/g, "小さじ")
      .replace(/青じ\s*そ/g, "青じそ")
      .replace(/粗びぴき/g, "粗びき")
      .replace(/一\s*口/g, "一口");
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

  const amountPattern = /(?:大さじ|小さじ)\s*[0-9]+(?:[./][0-9]+)?|[0-9]+(?:[./][0-9]+)?(?:\s*[〜~-]\s*[0-9]+(?:[./][0-9]+)?)?\s*(?:kg|g|mg|ml|mL|L|個|コ|本|枚|片|かけ|切れ|束|パック|袋|缶|合|カップ|玉|丁)(?:\s*[（(][^）)]+[）)])?|適量|少々|ひとつまみ|たっぷり/i;

  function stripMarkup(line = "") {
    return String(line)
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/^\s*>\s?/, "")
      .replace(/^\s*[*+-]\s+/, "")
      .replace(/^\s*[・･●]\s*/, "")
      .replace(/^\s*\|?|\|?\s*$/g, "")
      .replace(/\s*\|\s*/g, " ")
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
  }

  function ingredientGroupMarker(line = "") {
    return normalizeLine(stripMarkup(line)).match(/^(?:\(|（|【|\[)?\s*([A-H])\s*(?:\)|）|】|\])?$/i)?.[1]?.toUpperCase() || "";
  }

  function parseIngredientLine(line) {
    const normalized = normalizeLine(stripMarkup(line));
    const groupMatch = normalized.match(/^(?:\(|（|【|\[)\s*([A-H])\s*(?:\)|）|】|\])\s*/i);
    const group = groupMatch?.[1]?.toUpperCase() || "";
    const clean = normalized
      .replace(groupMatch?.[0] || /^$/, "")
      .replace(/^(?:材料|分量)\s*/u, "")
      .trim();
    if (!clean || /^(?:[（(【\[]?[A-C][）)】\]]?|調味料)$/i.test(clean)) return null;
    const match = amountPattern.exec(clean);
    if (!match) {
      const unitOnly = clean.match(/^(.+?)(大さじ|小さじ)$/);
      if (unitOnly) return { type: "ingredient", name: unitOnly[1].trim(), amount: unitOnly[2], group };
      return { type: "name", value: clean.replace(/[：:]$/, "").trim(), group };
    }
    const name = clean.slice(0, match.index).replace(/[：:]$/, "").trim();
    const amount = clean.slice(match.index).replace(/\s+/g, "").trim();
    if (!name) return { type: "amount", value: amount, group };
    return { type: "ingredient", name, amount, group };
  }

  function isIngredientNoise(line) {
    return !line
      || /^(?:材料|分量|[（(【\[]?[A-Z][）)】\]]?|つくり方|作り方)$/i.test(line)
      || /^[（(]?[0-9]+\s*[〜ー~-]\s*[0-9]+\s*人分[）)]?$/.test(line)
      || /(?:栄養|エネルギー|たんぱく質|食物繊維|塩分|糖質|野菜量|レシピ登録|登録済|kcal|ホームクッキング)/i.test(line);
  }

  function extractIngredients(lines, start, end, knownIngredients) {
    const output = [];
    const pendingNames = [];
    let activeGroup = "";
    lines.slice(start, end).forEach((line) => {
      const marker = ingredientGroupMarker(line);
      if (marker) { activeGroup = marker; return; }
      if (isIngredientNoise(line)) return;
      const parsed = parseIngredientLine(line);
      if (!parsed) return;
      if (parsed.group) activeGroup = parsed.group;
      if (parsed.type === "ingredient") output.push({ ...parsed, group: parsed.group || activeGroup });
      if (parsed.type === "name" && parsed.value.length <= 60) pendingNames.push({ name: parsed.value, group: parsed.group || activeGroup });
      if (parsed.type === "amount" && pendingNames.length) {
        const pending = pendingNames.shift();
        output.push({ name: pending.name, amount: parsed.value, group: parsed.group || pending.group });
      }
    });
    pendingNames.forEach((pending) => output.push({ name: pending.name, amount: "", group: pending.group }));
    return output
      .filter((item) => item.name && !/^\d+$/.test(item.name) && !/[。！？]$/.test(item.name))
      .map((item) => ({ ...item, ...resolveIngredient(item.name, knownIngredients) }));
  }

  function extractSteps(lines, start) {
    const steps = [];
    let current = "";
    let hasNumbers = false;
    const candidates = lines.slice(start);
    const endIndex = candidates.findIndex((line) => /^(?:関連レシピ|レシピを探す|タグから探す|キッコーマンホームクッキング編集担当|キッコーマン公式レシピアプリ|レシピをシェアする|Image \d+.*ホームクッキング)/.test(line));
    const stepLines = endIndex >= 0 ? candidates.slice(0, endIndex) : candidates;
    stepLines.forEach((line) => {
      if (!line) return;
      const cleanLine = stripMarkup(line);
      const numbered = cleanLine.match(/^([1-9][0-9]?)(?:[.)、:：]\s*|\s+)(.*)$/)
        || cleanLine.match(/^([①②③④⑤⑥⑦⑧⑨⑩])\s*(.*)$/);
      if (numbered) {
        if (current.trim()) steps.push(current.trim());
        const marker = numbered[1] || "";
        const body = numbered[2].trim().replace(new RegExp(`^${marker}\\s+`), "");
        current = body === marker ? "" : body;
        hasNumbers = true;
        return;
      }
      if (hasNumbers) current = `${current}${current ? " " : ""}${line}`.trim();
    });
    if (current.trim()) steps.push(current.trim());
    const cleanStep = (value) => normalizeLine(value)
      .replace(/^(?:©|@|の|\([の©@])[）)]\s*/, "")
      .replace(/^\(2のフライパン/, "2のフライパン")
      .replace(/^\(の(?=火を)/, "");
    if (steps.length) return steps.map(cleanStep).filter((step) => step.length >= 4);

    const paragraphs = [];
    let paragraph = [];
    stepLines.forEach((line) => {
      if (!line) {
        if (paragraph.length) paragraphs.push(normalizeLine(paragraph.join(" ")));
        paragraph = [];
        return;
      }
      if (!/(?:関連レシピ|レシピを探す|キッコーマンホームクッキング)/.test(line)) paragraph.push(line);
    });
    if (paragraph.length) paragraphs.push(normalizeLine(paragraph.join(" ")));
    return paragraphs.map(cleanStep).filter((step) => step.length >= 8).slice(0, 30);
  }

  function titleFromFilename(fileName = "") {
    const value = normalizeLine(fileName)
      .replace(/\.(?:png|jpe?g|webp|heic)$/i, "")
      .replace(/^FireShot Capture \d+\s*-\s*/i, "")
      .replace(/のレシピ[・･]つくり方.*$/u, "")
      .replace(/\s+-\s+(?:キッコーマン|ホームクッキング|\[?www\.).*$/i, "")
      .trim();
    if (/^スクリーンショット(?:\s|$)/.test(value)) return "";
    return value.length >= 4 && value.length <= 80 ? value : "";
  }

  function titleFromLines(lines, materialIndex) {
    const candidates = lines.slice(0, Math.max(1, materialIndex)).filter((line) =>
      line.length >= 6 && line.length <= 80
      && !/^材料(?:\s|[（(]|$)/.test(line)
      && !/(?:調理時間|エネルギー|塩分|たんぱく質|脂質|食物繊維|糖質|野菜量|登録|レシピ|kcal|タグ)/i.test(line)
      && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(line)
    );
    return candidates[0] || "写真から読み取ったレシピ";
  }

  function titleFromSource(text = "") {
    const titleLine = String(text).match(/^Title:\s*(.+)$/mi)?.[1]
      || String(text).match(/^#\s+(.+)$/m)?.[1]
      || "";
    return normalizeLine(stripMarkup(titleLine))
      .replace(/のレシピ[・･]つくり方.*$/u, "")
      .replace(/\s*[|｜].*$/, "")
      .trim();
  }

  function parse(text, fileName = "", knownIngredients = []) {
    const [mainText, stepRegionText = ""] = correctOCRText(text).split(STEP_REGION_MARKER);
    const lines = mainText.split(/\r?\n/).map((line) => normalizeLine(stripMarkup(line))).filter(Boolean);
    const materialIndex = lines.findIndex((line) => /^材料(?:\s|[（(]|$)/.test(line) || /材料.*[0-9]+人分/.test(line));
    const stepIndex = lines.findIndex((line, index) => index > materialIndex && /^(?:つくり方|作り方)/.test(line));
    const materialStart = materialIndex >= 0 ? materialIndex + 1 : 0;
    const materialEnd = stepIndex > materialStart ? stepIndex : lines.length;
    const ingredients = extractIngredients(lines, materialStart, materialEnd, knownIngredients);
    const stepRegionLines = stepRegionText.split(/\r?\n/).map(normalizeLine);
    const stepRegionHeading = stepRegionLines.findIndex((line) => /^(?:つくり方|作り方)/.test(line));
    const steps = stepRegionText.trim()
      ? extractSteps(stepRegionLines, stepRegionHeading >= 0 ? stepRegionHeading + 1 : 0)
      : (stepIndex >= 0 ? extractSteps(lines, stepIndex + 1) : []);
    const preMaterials = lines.slice(0, materialIndex >= 0 ? materialIndex + 1 : Math.min(lines.length, 30)).join(" ");
    const timeMatch = preMaterials.match(/(?:調理時間\s*)?([0-9]{1,3})\s*分/);
    const servingsMatch = (materialIndex >= 0 ? lines[materialIndex] : preMaterials).match(/([0-9]+)(?:\s*[〜~-]\s*[0-9]+)?\s*人分/);
    return {
      name: titleFromFilename(fileName) || titleFromSource(mainText) || titleFromLines(lines, materialIndex),
      time: timeMatch ? Number(timeMatch[1]) : 20,
      servings: servingsMatch ? Number(servingsMatch[1]) : 2,
      ingredients,
      steps,
      rawText: text
    };
  }

  function parseWebPage(text, pageUrl = "", knownIngredients = []) {
    const value = String(text || "");
    if (!/(?:^|\n)\s*#{0,6}\s*材料(?:\s|[（(]|$)/m.test(value)) throw new Error("材料欄が見つかりませんでした");
    const result = parse(value, "", knownIngredients);
    if (!result.ingredients.length) throw new Error("材料を抽出できませんでした");
    return { ...result, sourceUrl: pageUrl };
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error("OCRライブラリの読み込みがタイムアウトしました"));
      }, 20000);
      script.src = url;
      script.crossOrigin = "anonymous";
      script.onload = () => { clearTimeout(timeout); resolve(root.Tesseract); };
      script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error("OCRライブラリを読み込めませんでした")); };
      document.head.append(script);
    });
  }

  function loadTesseract() {
    if (root.Tesseract) return Promise.resolve(root.Tesseract);
    if (libraryPromise) return libraryPromise;
    if (typeof document === "undefined") return Promise.reject(new Error("OCR is available only in a browser"));
    libraryPromise = (async () => {
      let lastError = null;
      for (const url of TESSERACT_URLS) {
        try {
          const library = await loadScript(url);
          if (library) return library;
        } catch (error) { lastError = error; }
      }
      throw lastError || new Error("OCRライブラリを読み込めませんでした");
    })().catch((error) => { libraryPromise = null; throw error; });
    return libraryPromise;
  }

  function findRecipeRegions(tsv = "", size = { width: 0, height: 0 }) {
    const groups = new Map();
    String(tsv).split(/\r?\n/).slice(1).forEach((row) => {
      const columns = row.split("\t");
      if (columns.length < 12 || !columns[11]?.trim()) return;
      const key = columns.slice(1, 5).join(":");
      const entry = groups.get(key) || { text: "", left: Number(columns[6]) || 0, top: Number(columns[7]) || 0, width: Number(columns[8]) || 0, height: Number(columns[9]) || 0 };
      entry.text += columns[11].trim();
      entry.left = Math.min(entry.left, Number(columns[6]) || entry.left);
      entry.top = Math.min(entry.top, Number(columns[7]) || entry.top);
      entry.width = Math.max(entry.width, (Number(columns[6]) || 0) + (Number(columns[8]) || 0) - entry.left);
      entry.height = Math.max(entry.height, Number(columns[9]) || 0);
      groups.set(key, entry);
    });
    const entries = [...groups.values()];
    const material = entries.find((entry) => /^材料(?:$|[（(])/.test(normalizeLine(entry.text)));
    const steps = entries.find((entry) => /^(?:つくり方|作り方)/.test(normalizeLine(entry.text)));
    if (!steps) return { stepTop: null, columns: null };
    const top = Math.max(0, Math.min(material?.top ?? steps.top, steps.top) - Math.round(steps.height * .6));
    const isTwoColumn = material && size.width && steps.left > size.width * .25 && material.left < size.width * .2;
    if (!isTwoColumn) return { stepTop: Math.max(0, steps.top - Math.round(steps.height * .5)), columns: null };
    const gutter = Math.max(8, Math.round(size.width * .012));
    const rightLeft = Math.max(0, steps.left - gutter);
    return {
      stepTop: top,
      columns: {
        materials: { top, left: 0, width: Math.max(80, rightLeft - gutter), height: size.height - top },
        steps: { top, left: rightLeft, width: size.width - rightLeft, height: size.height - top }
      }
    };
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
          ? (phase === "steps" ? .76 + progress * .24 : phase === "materials" ? .56 + progress * .2 : progress * .56)
          : 0;
        onProgress({ status: message.status || "recognizing text", progress, overallProgress, phase });
      }
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: "3", preserve_interword_spaces: "1", user_defined_dpi: "300" });
      const result = await worker.recognize(file, {}, { text: true, tsv: true });
      const size = await imageSize(file);
      const regions = findRecipeRegions(result.data.tsv, size);
      if (regions.columns) {
        phase = "materials";
        await worker.setParameters({ tessedit_pageseg_mode: "4", preserve_interword_spaces: "1" });
        const materialResult = await worker.recognize(file, { rectangle: regions.columns.materials });
        phase = "steps";
        const stepResult = await worker.recognize(file, { rectangle: regions.columns.steps });
        return `${materialResult.data.text || ""}\n${STEP_REGION_MARKER}\n${stepResult.data.text || ""}`;
      }
      const detectedStepTop = regions.stepTop;
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

  root.RecipeOCR = { correctOCRText, normalizeKey, parse, parseWebPage, recognize, resolveIngredient };
}(typeof globalThis !== "undefined" ? globalThis : window));
