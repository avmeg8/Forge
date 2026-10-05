/**
 * FORGE muscle model — 18 muscle groups.
 *
 * `size` drives how much a muscle matters in workout analysis
 * (major muscles carry more weight than small accessory ones).
 * `group` is the user-facing filter bucket (Chest / Back / Shoulders / Arms / Legs / Core).
 */
export const MUSCLES = [
  { id: 'chest',       name: 'Chest',              short: 'Chest',       group: 'chest',     region: 'upper', size: 'major' },
  { id: 'lats',        name: 'Lats',               short: 'Lats',        group: 'back',      region: 'upper', size: 'major' },
  { id: 'traps',       name: 'Upper Back / Traps', short: 'Upper Back',  group: 'back',      region: 'upper', size: 'medium' },
  { id: 'lower_back',  name: 'Lower Back',         short: 'Lower Back',  group: 'back',      region: 'core',  size: 'medium' },
  { id: 'front_delts', name: 'Front Delts',        short: 'Front Delts', group: 'shoulders', region: 'upper', size: 'small' },
  { id: 'side_delts',  name: 'Side Delts',         short: 'Side Delts',  group: 'shoulders', region: 'upper', size: 'small' },
  { id: 'rear_delts',  name: 'Rear Delts',         short: 'Rear Delts',  group: 'shoulders', region: 'upper', size: 'small' },
  { id: 'biceps',      name: 'Biceps',             short: 'Biceps',      group: 'arms',      region: 'upper', size: 'small' },
  { id: 'triceps',     name: 'Triceps',            short: 'Triceps',     group: 'arms',      region: 'upper', size: 'medium' },
  { id: 'forearms',    name: 'Forearms',           short: 'Forearms',    group: 'arms',      region: 'upper', size: 'small' },
  { id: 'abs',         name: 'Abs',                short: 'Abs',         group: 'core',      region: 'core',  size: 'medium' },
  { id: 'obliques',    name: 'Obliques',           short: 'Obliques',    group: 'core',      region: 'core',  size: 'small' },
  { id: 'glutes',      name: 'Glutes',             short: 'Glutes',      group: 'legs',      region: 'lower', size: 'major' },
  { id: 'quads',       name: 'Quadriceps',         short: 'Quads',       group: 'legs',      region: 'lower', size: 'major' },
  { id: 'hamstrings',  name: 'Hamstrings',         short: 'Hamstrings',  group: 'legs',      region: 'lower', size: 'major' },
  { id: 'calves',      name: 'Calves',             short: 'Calves',      group: 'legs',      region: 'lower', size: 'small' },
  { id: 'hip_flexors', name: 'Hip Flexors',        short: 'Hip Flexors', group: 'legs',      region: 'lower', size: 'small' },
  { id: 'adductors',   name: 'Adductors',          short: 'Adductors',   group: 'legs',      region: 'lower', size: 'small' },
];

export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
export const MUSCLE_IDS = MUSCLES.map((m) => m.id);

export const GROUPS = [
  { id: 'chest', name: 'Chest' },
  { id: 'back', name: 'Back' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'arms', name: 'Arms' },
  { id: 'legs', name: 'Legs' },
  { id: 'core', name: 'Core' },
];

export const GROUP_MUSCLES = Object.fromEntries(
  GROUPS.map((g) => [g.id, MUSCLES.filter((m) => m.group === g.id).map((m) => m.id)])
);
// Lower back is trained mostly by core / hinge work, so it also appears under Core filters.
GROUP_MUSCLES.core = [...GROUP_MUSCLES.core, 'lower_back'];

/** Weight of each muscle size class in workout analysis. */
export const SIZE_WEIGHT = { major: 1, medium: 0.8, small: 0.65 };

/**
 * Opposing / complementary muscle pairs used for balance analysis and insights.
 * Each side is a list of muscles whose volume is summed.
 */
export const OPPOSING_PAIRS = [
  { id: 'push_pull', a: ['chest'], b: ['lats', 'traps'], aName: 'chest', bName: 'back' },
  { id: 'delts', a: ['front_delts'], b: ['rear_delts'], aName: 'front delts', bName: 'rear delts' },
  { id: 'arms', a: ['biceps'], b: ['triceps'], aName: 'biceps', bName: 'triceps' },
  { id: 'legs', a: ['quads'], b: ['hamstrings', 'glutes'], aName: 'quads', bName: 'posterior chain' },
  { id: 'trunk', a: ['abs', 'obliques'], b: ['lower_back'], aName: 'abs', bName: 'lower back' },
];

/** Display groups used for the workout coverage bars (closer to how people think). */
export const COVERAGE_GROUPS = [
  { id: 'chest', name: 'Chest', muscles: ['chest'] },
  { id: 'back', name: 'Back', muscles: ['lats', 'traps'] },
  { id: 'shoulders', name: 'Shoulders', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
  { id: 'biceps', name: 'Biceps', muscles: ['biceps'] },
  { id: 'triceps', name: 'Triceps', muscles: ['triceps'] },
  { id: 'forearms', name: 'Forearms', muscles: ['forearms'] },
  { id: 'quads', name: 'Quads', muscles: ['quads'] },
  { id: 'glutes', name: 'Glutes', muscles: ['glutes'] },
  { id: 'hamstrings', name: 'Hamstrings', muscles: ['hamstrings'] },
  { id: 'calves', name: 'Calves', muscles: ['calves'] },
  { id: 'adductors', name: 'Adductors', muscles: ['adductors'] },
  { id: 'core', name: 'Core', muscles: ['abs', 'obliques'] },
  { id: 'lower_back', name: 'Lower Back', muscles: ['lower_back'] },
  { id: 'hip_flexors', name: 'Hip Flexors', muscles: ['hip_flexors'] },
];
