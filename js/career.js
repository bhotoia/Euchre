// career.js — earned titles + the trophy cabinet (cups won). Persistence only;
// the trophy screen reads rivals (head-to-head) and cosmetics (packs) directly.

export const CAREER_KEY = 'euchre.career.v1';

export function defaultCareer() {
  return { titles: [], activeTitle: null, cupsWon: [] };
}

export function loadCareer() {
  try {
    const r = JSON.parse(localStorage.getItem(CAREER_KEY) || '{}');
    return {
      titles: [...(r.titles || [])],
      activeTitle: r.activeTitle || null,
      cupsWon: [...(r.cupsWon || [])],
    };
  } catch {
    return defaultCareer();
  }
}

export function saveCareer(c) {
  try { localStorage.setItem(CAREER_KEY, JSON.stringify(c)); } catch {}
  return c;
}

// Award a title (auto-equips the first one). Returns true if newly earned.
export function awardTitle(c, title) {
  if (!title || c.titles.includes(title)) return false;
  c.titles.push(title);
  if (!c.activeTitle) c.activeTitle = title;
  return true;
}

export function setActiveTitle(c, title) {
  if (title === null || c.titles.includes(title)) c.activeTitle = title;
  return c.activeTitle;
}

export function recordCup(c, id) {
  if (c.cupsWon.includes(id)) return false;
  c.cupsWon.push(id);
  return true;
}
