import test from "node:test";
import assert from "node:assert/strict";
import { createApp, normalizeGeneratedRecipe, normalizeGeneratedSteps, normalizeUrl, parseRecipeText, sourceExcerpt } from "./server.js";

const recipe = { name: "テスト料理", time: 10, servings: 2, ingredients: [{ name: "卵", amount: "2個", group: "A" }], steps: ["焼く。"] };

async function startApp(options = {}) {
  const app = createApp({ extractRecipe: async () => recipe, fetchRecipe: async () => "材料\n卵 2個\n作り方\n焼く。", ...options });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test("URLとJSON応答を正規化できる", () => {
  assert.equal(normalizeUrl("https://example.com/recipe"), "https://example.com/recipe");
  assert.throws(() => normalizeUrl("http://localhost/recipe"));
  assert.deepEqual(parseRecipeText("```json\n{\"name\":\"料理\"}\n```"), { name: "料理" });
  assert.deepEqual(normalizeGeneratedRecipe({
    title: "料理",
    ingredients: [{ item: "【A】", amount: "", group: "" }, { item: "卵", amount: "2個" }],
    instructions: ["1 焼く。"]
  }), { name: "料理", time: 20, servings: 2, ingredients: [{ name: "卵", amount: "2個", group: "A" }], steps: ["焼く。"] });
  assert.match(sourceExcerpt(`${"前".repeat(8000)}\n材料\n卵`), /材料/);
});

test("構造化された工程を文字列へ正規化しobject表示を防ぐ", () => {
  assert.deepEqual(normalizeGeneratedSteps([
    { text: "① 野菜を切る。" },
    { instruction: { text: "2. 肉を炒める。" } },
    { description: ["弱火で15分", "煮込む。"] },
    { "@type": "HowToStep", content: "ルウを溶かす。" },
    { value: "object" }
  ]), ["野菜を切る。", "肉を炒める。", "弱火で15分 煮込む。", "ルウを溶かす。"]);
  assert.deepEqual(normalizeGeneratedRecipe({
    name: "重ね煮キーマカレー",
    ingredients: [{ name: "合い挽き肉", amount: "300g", group: "" }],
    steps: { first: { text: "材料を重ねる。" }, second: { instruction: "弱火で15分加熱する。" } }
  }).steps, ["材料を重ねる。", "弱火で15分加熱する。"]) ;
});

test("空のgroup指定で直前の材料グループを終了する", () => {
  const normalized = normalizeGeneratedRecipe({
    name: "ポテト料理",
    ingredients: [
      { name: "水", amount: "100ml", group: "A" },
      { name: "塩", amount: "小さじ1/2", group: "A" },
      { name: "マヨネーズ", amount: "適量", group: "" },
      { name: "ピザチーズ", amount: "適量", group: "" }
    ],
    steps: ["調理する。"]
  });
  assert.deepEqual(normalized.ingredients.map(({ name, group }) => ({ name, group })), [
    { name: "水", group: "A" },
    { name: "塩", group: "A" },
    { name: "マヨネーズ", group: "" },
    { name: "ピザチーズ", group: "" }
  ]);
});

test("ブログの【材料】表記を中心に本文を切り出す", () => {
  const excerpt = sourceExcerpt(`${"前置き".repeat(30000)}\n【材料】（2人分）\n玉ねぎ 1個\n【作り方】\n炒める。`);
  assert.match(excerpt, /【材料】/);
  assert.match(excerpt, /【作り方】/);
  assert.ok(excerpt.length <= 120000);
});

test("画像解析APIは許可されたOriginと画像を受け付ける", async (t) => {
  const { server, base } = await startApp();
  t.after(() => server.close());
  const response = await fetch(`${base}/v1/recipes/extract-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://th-auiwkn.github.io" },
    body: JSON.stringify({ image: { mimeType: "image/png", data: Buffer.from("fake-image").toString("base64") } })
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://th-auiwkn.github.io");
  assert.deepEqual((await response.json()).recipe, recipe);
});

test("URL解析APIは非公開URLと未許可Originを拒否する", async (t) => {
  const { server, base } = await startApp();
  t.after(() => server.close());
  const privateResponse = await fetch(`${base}/v1/recipes/extract-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://th-auiwkn.github.io" },
    body: JSON.stringify({ url: "https://127.0.0.1/recipe" })
  });
  assert.equal(privateResponse.status, 400);
  const originResponse = await fetch(`${base}/v1/recipes/extract-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ url: "https://example.com/recipe" })
  });
  assert.equal(originResponse.status, 403);
});
