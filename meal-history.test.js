"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { compareRecipesByLastCooked, lastCookedDates, recipeLastCookedDate } = require("./meal-history.js");

test("過去日の複数のレシピをすべて最終調理日に反映する", () => {
  const schedule = {
    "2026-08-27": ["recipe-a", "recipe-b", "recipe-c"],
    "2026-08-23": ["recipe-d", "recipe-e"],
    "2026-09-07": ["future-recipe"]
  };
  const dates = lastCookedDates(schedule, "2026-09-06");

  assert.equal(recipeLastCookedDate({ id: "recipe-a", lastCooked: "" }, dates, "2026-09-06"), "2026-08-27");
  assert.equal(recipeLastCookedDate({ id: "recipe-b", lastCooked: "" }, dates, "2026-09-06"), "2026-08-27");
  assert.equal(recipeLastCookedDate({ id: "recipe-c", lastCooked: "" }, dates, "2026-09-06"), "2026-08-27");
  assert.equal(recipeLastCookedDate({ id: "recipe-d", lastCooked: "" }, dates, "2026-09-06"), "2026-08-23");
  assert.equal(recipeLastCookedDate({ id: "recipe-e", lastCooked: "" }, dates, "2026-09-06"), "2026-08-23");
  assert.equal(recipeLastCookedDate({ id: "future-recipe", lastCooked: "" }, dates, "2026-09-06"), "2026-09-07");
});

test("最後に作った順では未来の同日に登録したすべてのレシピも上位に並べる", () => {
  const today = "2026-09-06";
  const schedule = {
    "2026-09-16": ["recipe-future-a", "recipe-future-b", "recipe-future-c"],
    "2026-08-27": ["recipe-a", "recipe-b"],
    "2026-08-23": ["recipe-c", "recipe-d"]
  };
  const dates = lastCookedDates(schedule, today);
  const recipes = [
    { id: "recipe-future-c", name: "Future C", lastCooked: "" },
    { id: "recipe-d", name: "D", lastCooked: "" },
    { id: "recipe-future-a", name: "Future A", lastCooked: "" },
    { id: "recipe-b", name: "B", lastCooked: "" },
    { id: "recipe-c", name: "C", lastCooked: "" },
    { id: "recipe-future-b", name: "Future B", lastCooked: "" },
    { id: "recipe-a", name: "A", lastCooked: "" }
  ];

  recipes.sort((a, b) => compareRecipesByLastCooked(a, b, dates, today));

  assert.deepEqual(recipes.map((recipe) => recipe.id), [
    "recipe-future-a", "recipe-future-b", "recipe-future-c",
    "recipe-a", "recipe-b", "recipe-c", "recipe-d"
  ]);
});

test("同じレシピの献立履歴から未来を含む最新日を選ぶ", () => {
  const dates = lastCookedDates({
    "2026-08-20": ["recipe-a"],
    "2026-09-01": ["recipe-a"],
    "2026-09-10": ["recipe-a"]
  }, "2026-09-06");

  assert.equal(dates.get("recipe-a"), "2026-09-10");
});

test("最新の献立を削除すると一つ前の調理日に戻る", () => {
  const before = lastCookedDates({
    "2026-08-20": ["recipe-a"],
    "2026-09-01": ["recipe-a"]
  }, "2026-09-06");
  const after = lastCookedDates({ "2026-08-20": ["recipe-a"] }, "2026-09-06");

  assert.equal(before.get("recipe-a"), "2026-09-01");
  assert.equal(after.get("recipe-a"), "2026-08-20");
});

test("献立履歴がない既存データでは保存済みの最終調理日を維持する", () => {
  const dates = lastCookedDates({}, "2026-09-06");

  assert.equal(recipeLastCookedDate({ id: "legacy", lastCooked: "2026-08-01" }, dates, "2026-09-06"), "2026-08-01");
  assert.equal(recipeLastCookedDate({ id: "invalid", lastCooked: "2026-99-99" }, dates, "2026-09-06"), "");
});
