/**
 * Equipment catalog — data-driven.
 *
 * Exercises never reference equipment items directly. They declare the
 * *capabilities* they require (e.g. ['dumbbell', 'bench']), and each equipment
 * item declares which capabilities it `provides`. An exercise is available when
 * every required capability is provided by some owned item.
 *
 * This keeps the app open-ended: adding a new piece of equipment or hundreds of
 * new exercises is a data change, never a code change.
 *
 * `load` (optional) describes the weights the item can be loaded with. It is the
 * default config for new profiles; users edit the per-profile copy in Settings.
 */
export const EQUIPMENT = [
  {
    id: 'bodyweight', name: 'Bodyweight & Floor', short: 'Bodyweight',
    provides: ['bodyweight', 'floor'], alwaysOwned: true,
    description: 'Your body and a clear patch of floor.',
  },
  {
    id: 'adjustable_dumbbell', name: 'Adjustable Dumbbell', short: 'Dumbbell',
    provides: ['dumbbell'], loadCapability: 'dumbbell',
    load: { min: 2, max: 30, increment: 1 },
    description: 'One adjustable dumbbell.',
  },
  {
    id: 'second_dumbbell', name: 'Second Dumbbell', short: 'Second Dumbbell',
    provides: ['dumbbell', 'dumbbell_pair'], loadCapability: 'dumbbell',
    load: { min: 2, max: 30, increment: 1 },
    description: 'A matching second dumbbell for two-handed movements.',
  },
  {
    id: 'bench', name: 'Bench', short: 'Bench', provides: ['bench'],
    description: 'Flat or adjustable weight bench.',
  },
  {
    id: 'resistance_bands', name: 'Resistance Bands', short: 'Bands', provides: ['bands'],
    description: 'Loop or tube bands with a door anchor.',
  },
  {
    id: 'pullup_bar', name: 'Pull-up Bar', short: 'Pull-up Bar', provides: ['pullup_bar'],
    description: 'Doorway or wall-mounted bar.',
  },
  {
    id: 'kettlebell', name: 'Kettlebell', short: 'Kettlebell', provides: ['kettlebell'],
    loadCapability: 'kettlebell', load: { min: 8, max: 24, increment: 4 },
    description: 'One or more kettlebells.',
  },
  {
    id: 'barbell', name: 'Barbell', short: 'Barbell', provides: ['barbell'],
    loadCapability: 'barbell', load: { min: 20, max: 120, increment: 2.5 },
    description: 'Olympic or standard barbell.',
  },
  {
    id: 'weight_plates', name: 'Weight Plates', short: 'Plates', provides: ['plates'],
    description: 'Plates to load a barbell.',
  },
  {
    id: 'squat_rack', name: 'Squat Rack', short: 'Rack', provides: ['rack'],
    description: 'Rack or stands for barbell work.',
  },
  {
    id: 'cable_machine', name: 'Cable Machine', short: 'Cables', provides: ['cable'],
    loadCapability: 'cable', load: { min: 5, max: 80, increment: 5 },
    description: 'Adjustable cable station.',
  },
  {
    id: 'machines', name: 'Gym Machines', short: 'Machines', provides: ['machine'],
    loadCapability: 'machine', load: { min: 5, max: 150, increment: 5 },
    description: 'Leg press, leg curl, leg extension and similar.',
  },
];

export const EQUIPMENT_BY_ID = Object.fromEntries(EQUIPMENT.map((e) => [e.id, e]));

/** Human names for capabilities (used in "🔒 Requires: Bench"). */
export const CAPABILITY_NAMES = {
  bodyweight: 'Bodyweight',
  floor: 'Floor space',
  dumbbell: 'Dumbbell',
  dumbbell_pair: 'Second Dumbbell',
  bench: 'Bench',
  bands: 'Resistance Bands',
  pullup_bar: 'Pull-up Bar',
  kettlebell: 'Kettlebell',
  barbell: 'Barbell',
  plates: 'Weight Plates',
  rack: 'Squat Rack',
  cable: 'Cable Machine',
  machine: 'Gym Machines',
};

/** Which catalog item is the cheapest/most direct way to get a capability. */
export const CAPABILITY_SOURCE = {
  dumbbell: 'adjustable_dumbbell',
  dumbbell_pair: 'second_dumbbell',
  bench: 'bench',
  bands: 'resistance_bands',
  pullup_bar: 'pullup_bar',
  kettlebell: 'kettlebell',
  barbell: 'barbell',
  plates: 'weight_plates',
  rack: 'squat_rack',
  cable: 'cable_machine',
  machine: 'machines',
};

/** Default profile for a brand-new user: one adjustable dumbbell + bodyweight. */
export function defaultProfile(dumbbell = { min: 2, max: 30, increment: 1 }) {
  return {
    id: 'home',
    name: 'Home',
    items: {
      bodyweight: {},
      adjustable_dumbbell: { load: { ...dumbbell } },
    },
    custom: [], // user-named "Other" equipment, kept for reference
  };
}
