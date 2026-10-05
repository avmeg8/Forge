/**
 * Workout focus / split definitions — what a workout is MEANT to train.
 *
 *   target   muscles the workout should cover well (missing them costs points)
 *   support  muscles that naturally get worked and are welcome, never required
 *   dose     'focus'  → one or two muscle groups: deeper per-muscle volume expected
 *            'split'  → several groups (PPL, upper/lower): moderate per-muscle volume
 *            'full'   → whole body: lighter per-muscle volume, broad coverage
 *   balance  pairs of muscle lists that should be in sensible proportion *within* this focus,
 *            [a, b, minRatio] — ratio = smaller / larger side, ≥ minRatio scores full marks
 *
 * Everything outside target ∪ support is "off-focus": a few sets are fine, but a chest
 * day that's half squats will be told so.
 */
export const SPLIT_GROUPS = [
  { id: 'auto', name: 'Automatic' },
  { id: 'ppl', name: 'Push / Pull / Legs' },
  { id: 'single', name: 'Muscle group days' },
  { id: 'pair', name: 'Pairings' },
  { id: 'whole', name: 'Whole body' },
  { id: 'custom', name: 'Custom' },
];

export const SPLITS = [
  { id: 'push', group: 'ppl', name: 'Push', target: ['chest', 'front_delts', 'side_delts', 'triceps'], support: ['abs'], dose: 'split',
    balance: [[['chest'], ['front_delts', 'side_delts'], 0.35], [['chest'], ['triceps'], 0.4]] },
  { id: 'pull', group: 'ppl', name: 'Pull', target: ['lats', 'traps', 'rear_delts', 'biceps'], support: ['forearms', 'lower_back'], dose: 'split',
    balance: [[['lats', 'traps'], ['biceps'], 0.35], [['lats'], ['traps', 'rear_delts'], 0.4]] },
  { id: 'legs', group: 'ppl', name: 'Legs', target: ['quads', 'glutes', 'hamstrings', 'calves'], support: ['adductors', 'hip_flexors', 'lower_back', 'abs', 'obliques'], dose: 'split',
    balance: [[['quads'], ['hamstrings', 'glutes'], 0.55]] },

  { id: 'chest', group: 'single', name: 'Chest', target: ['chest'], support: ['front_delts', 'triceps', 'abs'], dose: 'focus', balance: [] },
  { id: 'back', group: 'single', name: 'Back', target: ['lats', 'traps'], support: ['rear_delts', 'biceps', 'lower_back', 'forearms'], dose: 'focus',
    balance: [[['lats'], ['traps'], 0.4]] },
  { id: 'shoulders', group: 'single', name: 'Shoulders', target: ['front_delts', 'side_delts', 'rear_delts'], support: ['traps', 'triceps'], dose: 'focus',
    balance: [[['side_delts'], ['front_delts'], 0.4], [['rear_delts'], ['front_delts'], 0.4]] },
  { id: 'arms', group: 'single', name: 'Arms', target: ['biceps', 'triceps'], support: ['forearms', 'front_delts'], dose: 'focus',
    balance: [[['biceps'], ['triceps'], 0.6]] },
  { id: 'legs_day', group: 'single', name: 'Legs', alias: 'legs' },
  { id: 'glutes', group: 'single', name: 'Glutes', target: ['glutes'], support: ['hamstrings', 'quads', 'adductors', 'lower_back'], dose: 'focus', balance: [] },
  { id: 'core', group: 'single', name: 'Core', target: ['abs', 'obliques'], support: ['lower_back', 'hip_flexors'], dose: 'focus',
    balance: [[['abs'], ['obliques'], 0.3]] },

  { id: 'chest_triceps', group: 'pair', name: 'Chest & Triceps', target: ['chest', 'triceps'], support: ['front_delts', 'side_delts'], dose: 'focus',
    balance: [[['chest'], ['triceps'], 0.4]] },
  { id: 'back_biceps', group: 'pair', name: 'Back & Biceps', target: ['lats', 'traps', 'biceps'], support: ['rear_delts', 'forearms', 'lower_back'], dose: 'focus',
    balance: [[['lats', 'traps'], ['biceps'], 0.35]] },
  { id: 'chest_back', group: 'pair', name: 'Chest & Back', target: ['chest', 'lats', 'traps'], support: ['front_delts', 'rear_delts', 'biceps', 'triceps'], dose: 'split',
    balance: [[['chest'], ['lats', 'traps'], 0.6]] },
  { id: 'shoulders_arms', group: 'pair', name: 'Shoulders & Arms', target: ['front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps'], support: ['forearms', 'traps'], dose: 'split',
    balance: [[['biceps'], ['triceps'], 0.6], [['side_delts', 'rear_delts'], ['front_delts'], 0.4]] },

  { id: 'upper', group: 'whole', name: 'Upper body', target: ['chest', 'lats', 'traps', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps'], support: ['forearms', 'abs'], dose: 'split',
    balance: [[['chest'], ['lats', 'traps'], 0.6], [['front_delts'], ['rear_delts'], 0.5], [['biceps'], ['triceps'], 0.6]] },
  { id: 'lower', group: 'whole', name: 'Lower body', target: ['quads', 'glutes', 'hamstrings', 'calves'], support: ['adductors', 'hip_flexors', 'lower_back', 'abs', 'obliques'], dose: 'split',
    balance: [[['quads'], ['hamstrings', 'glutes'], 0.55]] },
  { id: 'full', group: 'whole', name: 'Full body', target: ['chest', 'lats', 'quads', 'glutes', 'hamstrings', 'side_delts'], support: ['traps', 'front_delts', 'rear_delts', 'biceps', 'triceps', 'abs', 'obliques', 'calves', 'lower_back', 'adductors'], dose: 'full',
    balance: [[['chest'], ['lats', 'traps'], 0.6], [['quads'], ['hamstrings', 'glutes'], 0.55]] },
];

export const SPLIT_BY_ID = Object.fromEntries(SPLITS.map((s) => [s.id, s]));

/** Resolve a template's focus setting to a concrete split definition (custom builds one). */
export function resolveSplit(focus, customMuscles = []) {
  if (focus === 'custom') {
    const target = customMuscles.length ? customMuscles : ['chest'];
    return { id: 'custom', group: 'custom', name: 'Custom', target, support: [], dose: target.length <= 3 ? 'focus' : target.length <= 8 ? 'split' : 'full', balance: [] };
  }
  const s = SPLIT_BY_ID[focus];
  if (!s) return null;
  return s.alias ? { ...SPLIT_BY_ID[s.alias], id: s.id, name: s.name, group: s.group } : s;
}

/** Ideal effective sets per TARGET muscle in one session, by dose and experience. */
export function sessionDose(dose, experience = 'beginner') {
  const base = { focus: [5, 12], split: [3, 9], full: [2, 6] }[dose] || [3, 9];
  const k = { beginner: 0.8, intermediate: 1, advanced: 1.2 }[experience] || 1;
  return [Math.max(2, Math.round(base[0] * k)), Math.round(base[1] * k)];
}

/** Recommended weekly effective sets per muscle (for the weekly plan rating). */
export function weeklyDose(experience = 'beginner') {
  return { beginner: [6, 14], intermediate: [8, 18], advanced: [10, 22] }[experience] || [8, 18];
}
