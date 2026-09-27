"use strict";

(function setupMealHistory(root, factory) {
  const history = factory();
  if (typeof module === "object" && module.exports) module.exports = history;
  root.MealnoteHistory = history;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }

  function lastCookedDates(schedule, today) {
    const dates = new Map();
    if (!schedule || typeof schedule !== "object" || !isIsoDate(today)) return dates;
    Object.entries(schedule).forEach(([date, entry]) => {
      if (!isIsoDate(date)) return;
      const recipeIds = Array.isArray(entry) ? entry : [entry];
      recipeIds.forEach((recipeId) => {
        if (typeof recipeId !== "string" || !recipeId) return;
        const current = dates.get(recipeId);
        if (!current || date > current) dates.set(recipeId, date);
      });
    });
    return dates;
  }

  function recipeLastCookedDate(recipe, scheduledDates, today) {
    const scheduled = scheduledDates?.get?.(recipe?.id);
    if (scheduled) return scheduled;
    const stored = recipe?.lastCooked;
    return isIsoDate(stored) && stored <= today ? stored : "";
  }

  function compareRecipesByLastCooked(a, b, scheduledDates, today) {
    return recipeLastCookedDate(b, scheduledDates, today).localeCompare(recipeLastCookedDate(a, scheduledDates, today))
      || String(a?.name || "").localeCompare(String(b?.name || ""), "ja");
  }

  return { isIsoDate, lastCookedDates, recipeLastCookedDate, compareRecipesByLastCooked };
});
