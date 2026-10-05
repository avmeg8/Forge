/**
 * Tier → Level → XP
 *
 * 40 levels in 4 tiers of 10. The XP needed for each level grows with
 * level^1.5, so early levels come quickly (feedback while building the habit)
 * and later levels require sustained, progressive training.
 *
 *   cost(level → level+1) = round10( 50 + 8 · level^1.5 )
 *
 * With consistent, well-structured training a primary muscle earns roughly
 * 120–160 XP/week (see xp.js). That puts:
 *   Intermediate (L11) ≈ 2–3 months,  Advanced (L21) ≈ 1 year,
 *   Elite (L31) ≈ 2.5 years,          Max (L40) ≈ 4–5 years.
 */
export const MAX_LEVEL = 40;

export const TIERS = [
  { id: 'beginner', name: 'Beginner', min: 1, max: 10 },
  { id: 'intermediate', name: 'Intermediate', min: 11, max: 20 },
  { id: 'advanced', name: 'Advanced', min: 21, max: 30 },
  { id: 'elite', name: 'Elite', min: 31, max: 40 },
];

export function levelCost(level) {
  return Math.round((50 + 8 * level ** 1.5) / 10) * 10;
}

/** THRESHOLDS[L] = total XP needed to reach level L (THRESHOLDS[1] = 0). */
export const THRESHOLDS = (() => {
  const t = [0, 0];
  for (let l = 1; l < MAX_LEVEL; l++) t[l + 1] = t[l] + levelCost(l);
  return t;
})();

export function tierForLevel(level) {
  return TIERS.find((t) => level >= t.min && level <= t.max) || TIERS[TIERS.length - 1];
}

/** Everything the UI needs to describe a muscle's progress from its total XP. */
export function levelInfo(totalXp) {
  const xp = Math.max(0, totalXp || 0);
  let level = 1;
  while (level < MAX_LEVEL && xp >= THRESHOLDS[level + 1]) level++;
  const tier = tierForLevel(level);
  const isMax = level >= MAX_LEVEL;
  const into = Math.floor(xp - THRESHOLDS[level]);
  const need = isMax ? 0 : levelCost(level);
  return {
    xp: Math.floor(xp),
    level,
    tier,
    isMax,
    xpIntoLevel: into,
    xpForLevel: need,
    xpToNext: isMax ? 0 : Math.max(0, need - into),
    progress: isMax ? 1 : Math.min(1, into / need),
    // 0..1 across the whole 40-level journey — used for body-map emphasis
    overall: Math.min(1, (level - 1 + (isMax ? 0 : into / need)) / (MAX_LEVEL - 1)),
  };
}
