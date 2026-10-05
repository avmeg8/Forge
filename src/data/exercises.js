/**
 * FORGE exercise database — data-driven.
 *
 * Every exercise declares:
 *   id, name
 *   primary / secondary      muscle ids (see muscles.js)
 *   equipment                capabilities required (see equipment.js) — availability is computed, never hard-coded
 *   load                     which capability's weight config drives the weight stepper
 *                            ('dumbbell' | 'kettlebell' | 'barbell' | 'cable' | 'machine' | 'bodyweight' | 'bands')
 *   metric                   'reps' or 'time' (seconds)
 *   unilateral               true → left and right are logged separately
 *   difficulty               1 beginner · 2 intermediate · 3 advanced
 *   pattern                  movement pattern (used for variety/redundancy + cross-exercise history)
 *   reps                     [min, max] target range (seconds for timed holds)
 *   sets, rest               recommended sets and rest (seconds)
 *   instructions, cues, mistakes
 *   easier, harder           alternative exercise ids
 *   related                  [{ id, type }] — 'variation_of' | 'progression_from' (harder version of id) | 'progresses_to' (leads to id) | 'alternative_to'
 *   progression              { method: 'double' | 'reps' | 'time', notes }
 *   startKg                  conservative first-time weight (clamped to the user's dumbbell range)
 *   bwKg                     nominal load used to score bodyweight exercises (keeps the XP formula uniform)
 */

const D = {
  primary: [], secondary: [], equipment: ['dumbbell'], load: 'dumbbell', metric: 'reps',
  unilateral: false, difficulty: 2, reps: [8, 12], sets: 3, rest: 90,
  instructions: [], cues: [], mistakes: [], easier: [], harder: [], related: [],
  progression: { method: 'double', notes: '' }, startKg: 8, bwKg: 0,
};
const BW = { equipment: ['bodyweight'], load: 'bodyweight', progression: { method: 'reps', notes: '' } };
const x = (id, name, o) => ({ ...D, ...o, id, name });

const list = [
  // ───────────────────────── CHEST ─────────────────────────
  x('db_floor_press', 'Dumbbell Floor Press', {
    primary: ['chest'], secondary: ['triceps', 'front_delts'], pattern: 'horizontal_press',
    difficulty: 1, startKg: 10, rest: 120,
    instructions: [
      'Lie on your back, knees bent, feet flat. Hold the dumbbell vertically with both hands over your chest.',
      'Lower it until your upper arms touch the floor, elbows about 45° from your body.',
      'Pause briefly, then press back up until your arms are straight.',
    ],
    cues: ['Squeeze the handle hard', 'Elbows at 45°, not flared', 'Soft touch — no bouncing off the floor'],
    mistakes: ['Slamming elbows into the floor', 'Flaring elbows to 90°', 'Losing tension at the top'],
    easier: ['push_up_knee', 'push_up'], harder: ['single_arm_floor_press', 'db_squeeze_press'],
    related: [{ id: 'db_bench_press', type: 'progresses_to' }, { id: 'single_arm_bench_press', type: 'progresses_to' }],
    progression: { method: 'double', notes: 'Fill the rep range on every set, then add the smallest weight step.' },
  }),
  x('single_arm_floor_press', 'Single-Arm Floor Press', {
    primary: ['chest'], secondary: ['triceps', 'front_delts', 'obliques'], pattern: 'horizontal_press',
    unilateral: true, difficulty: 2, startKg: 8, rest: 75,
    instructions: [
      'Lie on your back with knees bent. Hold the dumbbell in one hand beside your chest, upper arm on the floor.',
      'Press straight up while keeping your hips and shoulders flat — resist rotating.',
      'Lower under control until the upper arm lightly touches the floor. Finish all reps, then switch.',
    ],
    cues: ['Brace your core against the twist', 'Free hand flat on the floor', 'Wrist stacked over elbow'],
    mistakes: ['Rolling toward the weight', 'Letting the wrist bend back'],
    easier: ['db_floor_press'], harder: ['single_arm_bench_press'],
    related: [{ id: 'db_floor_press', type: 'variation_of' }],
    progression: { method: 'double', notes: 'Unilateral loading doubles the effective weight per arm — great when the two-hand press maxes out.' },
  }),
  x('db_squeeze_press', 'Dumbbell Squeeze Press', {
    primary: ['chest'], secondary: ['triceps', 'front_delts'], pattern: 'horizontal_press',
    difficulty: 2, startKg: 8, reps: [10, 15],
    instructions: [
      'Lie on the floor holding the dumbbell horizontally by both heads, palms pressing inward.',
      'Squeeze the dumbbell as hard as you can and keep squeezing throughout.',
      'Press up, then lower until your elbows touch the floor.',
    ],
    cues: ['Constant inward squeeze', 'Slow lowering (2–3 s)', 'Chest up, shoulders down'],
    mistakes: ['Relaxing the squeeze at the top', 'Pressing too fast'],
    easier: ['db_floor_press'], harder: ['single_arm_floor_press'],
    related: [{ id: 'db_floor_press', type: 'variation_of' }],
  }),
  x('db_pullover', 'Dumbbell Pullover', {
    primary: ['lats', 'chest'], secondary: ['triceps', 'abs'], pattern: 'pullover',
    difficulty: 2, startKg: 8, reps: [10, 15],
    instructions: [
      'Lie on the floor, knees bent, holding one dumbbell by its head with both hands over your chest.',
      'With a slight elbow bend, lower the dumbbell back behind your head until it nearly touches the floor.',
      'Pull it back over your chest using your lats and chest.',
    ],
    cues: ['Keep elbows slightly bent and fixed', 'Ribs down — don’t arch', 'Feel the stretch along your sides'],
    mistakes: ['Bending elbows into a triceps extension', 'Arching the lower back'],
    easier: ['db_floor_press'], harder: [],
    related: [{ id: 'bench_pullover', type: 'progresses_to' }],
  }),
  x('push_up', 'Push-Up', {
    ...BW, primary: ['chest'], secondary: ['triceps', 'front_delts', 'abs'], pattern: 'horizontal_press',
    difficulty: 1, reps: [8, 20], bwKg: 40, rest: 75,
    instructions: [
      'Start in a high plank, hands slightly wider than shoulders, body in one straight line.',
      'Lower your chest to just above the floor, elbows about 45° from your body.',
      'Push the floor away until your arms are straight.',
    ],
    cues: ['Squeeze glutes, brace abs', 'Chest leads, hips follow', 'Full range every rep'],
    mistakes: ['Sagging hips', 'Half reps', 'Head poking forward'],
    easier: ['push_up_knee', 'push_up_incline'], harder: ['push_up_decline', 'uneven_push_up', 'archer_push_up'],
    progression: { method: 'reps', notes: 'Build to 20 clean reps, then move to decline or uneven push-ups.' },
  }),
  x('push_up_knee', 'Knee Push-Up', {
    ...BW, primary: ['chest'], secondary: ['triceps', 'front_delts'], pattern: 'horizontal_press',
    difficulty: 1, reps: [8, 20], bwKg: 28, rest: 60,
    instructions: ['Set up as a push-up but with knees on the floor.', 'Keep a straight line from knees to head.', 'Lower your chest to the floor and press back up.'],
    cues: ['Hips in line', 'Full range'], mistakes: ['Hips piking up'],
    harder: ['push_up'], related: [{ id: 'push_up', type: 'variation_of' }],
  }),
  x('push_up_incline', 'Hands-Elevated Push-Up', {
    ...BW, primary: ['chest'], secondary: ['triceps', 'front_delts'], pattern: 'horizontal_press',
    difficulty: 1, reps: [10, 20], bwKg: 30, rest: 60,
    instructions: ['Place hands on a sturdy couch, table or wall.', 'Walk feet back into a straight-body plank.', 'Lower your chest to the edge and press away.'],
    cues: ['Higher surface = easier', 'Body stays rigid'], mistakes: ['Using an unstable surface'],
    harder: ['push_up'], related: [{ id: 'push_up', type: 'variation_of' }],
  }),
  x('push_up_decline', 'Feet-Elevated Push-Up', {
    ...BW, primary: ['chest'], secondary: ['front_delts', 'triceps'], pattern: 'horizontal_press',
    difficulty: 2, reps: [8, 20], bwKg: 48, rest: 75,
    instructions: ['Place feet on a couch or sturdy chair, hands on the floor.', 'Keep your body straight from heels to head.', 'Lower your chest to the floor and press up.'],
    cues: ['Don’t let hips sag', 'Elbows 45°'], mistakes: ['Shortening the range'],
    easier: ['push_up'], harder: ['archer_push_up'], related: [{ id: 'push_up', type: 'variation_of' }],
  }),
  x('close_grip_push_up', 'Close-Grip Push-Up', {
    ...BW, primary: ['triceps', 'chest'], secondary: ['front_delts'], pattern: 'horizontal_press',
    difficulty: 2, reps: [8, 20], bwKg: 40, rest: 75,
    instructions: ['Set up in a push-up with hands under your shoulders or slightly narrower.', 'Lower with elbows tucked close to your ribs.', 'Press up by straightening your arms.'],
    cues: ['Elbows brush your sides', 'Lock out fully'], mistakes: ['Hands so close the wrists hurt', 'Elbows flaring'],
    easier: ['push_up'], harder: ['diamond_push_up'], related: [{ id: 'push_up', type: 'variation_of' }],
  }),
  x('diamond_push_up', 'Diamond Push-Up', {
    ...BW, primary: ['triceps'], secondary: ['chest', 'front_delts'], pattern: 'horizontal_press',
    difficulty: 3, reps: [6, 15], bwKg: 42, rest: 75,
    instructions: ['Form a diamond with your thumbs and index fingers under your chest.', 'Lower until your chest touches your hands.', 'Press up to full lockout.'],
    cues: ['Elbows back, not out'], mistakes: ['Sagging hips'],
    easier: ['close_grip_push_up'], related: [{ id: 'close_grip_push_up', type: 'progression_from' }],
  }),
  x('uneven_push_up', 'Uneven Push-Up', {
    primary: ['chest'], secondary: ['triceps', 'front_delts', 'obliques'], pattern: 'horizontal_press',
    equipment: ['dumbbell'], load: 'bodyweight', unilateral: true, difficulty: 2, reps: [6, 15], bwKg: 44, rest: 75,
    progression: { method: 'reps', notes: 'Build reps per side, then progress toward archer push-ups.' },
    instructions: ['Place one hand on the dumbbell handle (set on its side so it can’t roll), the other on the floor.', 'Lower your chest, letting the floor-side arm do most of the work.', 'Press up. Finish the set, then swap hands.'],
    cues: ['Dumbbell must be stable', 'Hips level'], mistakes: ['Using a rolling dumbbell', 'Twisting the torso'],
    easier: ['push_up'], harder: ['archer_push_up'], related: [{ id: 'push_up', type: 'variation_of' }],
  }),
  x('archer_push_up', 'Archer Push-Up', {
    ...BW, primary: ['chest'], secondary: ['triceps', 'front_delts', 'abs'], pattern: 'horizontal_press',
    unilateral: true, difficulty: 3, reps: [4, 10], bwKg: 55, rest: 90,
    instructions: ['Start in a very wide push-up position.', 'Shift toward one hand as you lower, keeping the other arm nearly straight.', 'Press back up and alternate sides set by set.'],
    cues: ['Working elbow tucked', 'Straight arm assists only'], mistakes: ['Rushing the descent'],
    easier: ['uneven_push_up'], related: [{ id: 'push_up', type: 'progression_from' }],
  }),
  x('db_floor_fly', 'Single-Arm Floor Fly', {
    primary: ['chest'], secondary: ['front_delts'], pattern: 'fly',
    unilateral: true, difficulty: 2, reps: [10, 15], startKg: 5, rest: 60,
    instructions: ['Lie on the floor holding the dumbbell above your chest, palm facing in, slight elbow bend.', 'Open your arm out to the side until the upper arm touches the floor.', 'Hug it back up over your chest. Finish reps, then switch arms.'],
    cues: ['Fixed elbow angle', 'Think “hug a tree”', 'Light weight, big stretch'],
    mistakes: ['Turning it into a press', 'Going too heavy'],
    harder: [], related: [{ id: 'db_fly', type: 'progresses_to' }],
  }),

  // ───────────────────────── BACK ─────────────────────────
  x('one_arm_row', 'One-Arm Dumbbell Row', {
    primary: ['lats'], secondary: ['traps', 'rear_delts', 'biceps', 'forearms'], pattern: 'horizontal_pull',
    unilateral: true, difficulty: 1, startKg: 12, rest: 75,
    instructions: ['Stagger your stance and hinge forward, free hand on your front thigh for support.', 'Let the dumbbell hang straight down, back flat.', 'Row it toward your hip, then lower under control. Finish reps, then switch.'],
    cues: ['Pull elbow to hip', 'Flat back, neutral neck', 'Pause at the top'],
    mistakes: ['Twisting the torso to cheat', 'Shrugging the shoulder', 'Rounding the back'],
    easier: ['supported_row'], harder: ['kroc_row'],
    related: [{ id: 'bench_row', type: 'progresses_to' }, { id: 'chest_supported_row', type: 'alternative_to' }],
  }),
  x('supported_row', 'Supported One-Arm Row', {
    primary: ['lats'], secondary: ['traps', 'rear_delts', 'biceps'], pattern: 'horizontal_pull',
    unilateral: true, difficulty: 1, startKg: 12, rest: 75,
    instructions: ['Place your free hand on a sturdy chair, counter or wall at hip height.', 'Hinge until your torso is close to parallel with the floor.', 'Row the dumbbell to your hip and lower it slowly.'],
    cues: ['Support lets you focus on the lat', 'Square hips and shoulders'],
    mistakes: ['Support too high (turns it upright)', 'Jerking the weight'],
    harder: ['one_arm_row'], related: [{ id: 'one_arm_row', type: 'variation_of' }, { id: 'bench_row', type: 'progresses_to' }],
  }),
  x('kroc_row', 'Kroc Row', {
    primary: ['lats'], secondary: ['traps', 'rear_delts', 'biceps', 'forearms'], pattern: 'horizontal_pull',
    unilateral: true, difficulty: 3, reps: [15, 25], startKg: 16, rest: 90,
    instructions: ['Set up like a supported one-arm row with your heaviest dumbbell.', 'Row for high reps with a controlled body-English — strict at first, slight momentum at the end.', 'Keep the back flat throughout.'],
    cues: ['Heavy and high reps', 'Grip hard'], mistakes: ['Losing spine position'],
    easier: ['one_arm_row'], related: [{ id: 'one_arm_row', type: 'progression_from' }],
    progression: { method: 'double', notes: 'Perfect when your dumbbell is too light for 8–12 reps.' },
  }),
  x('rear_delt_row', 'Rear-Delt Row', {
    primary: ['rear_delts', 'traps'], secondary: ['lats', 'biceps'], pattern: 'rear_delt',
    unilateral: true, difficulty: 2, reps: [10, 15], startKg: 6, rest: 60,
    instructions: ['Hinge forward with support, dumbbell hanging, palm facing back.', 'Row with your elbow flared out to ~70°, pulling toward your upper chest.', 'Lower slowly.'],
    cues: ['Elbow wide and high', 'Think “pull apart” not “pull up”'],
    mistakes: ['Turning it into a lat row', 'Going too heavy'],
    easier: ['reverse_fly'], harder: ['high_row'], related: [{ id: 'one_arm_row', type: 'variation_of' }],
  }),
  x('reverse_fly', 'Single-Arm Reverse Fly', {
    primary: ['rear_delts'], secondary: ['traps'], pattern: 'rear_delt',
    unilateral: true, difficulty: 1, reps: [12, 20], startKg: 3, rest: 60,
    instructions: ['Hinge forward, free hand supported, dumbbell hanging under your shoulder.', 'With a soft elbow, raise your arm out to the side until it’s level with your back.', 'Lower slowly.'],
    cues: ['Lead with the knuckles', 'No swinging'], mistakes: ['Using momentum', 'Shrugging'],
    harder: ['rear_delt_row'], related: [{ id: 'band_pull_apart', type: 'alternative_to' }],
  }),
  x('high_row', 'Single-Arm High Row', {
    primary: ['traps', 'rear_delts'], secondary: ['lats', 'biceps'], pattern: 'rear_delt',
    unilateral: true, difficulty: 2, reps: [10, 15], startKg: 6, rest: 60,
    instructions: ['Stand hinged at about 45° with support.', 'Row the dumbbell toward your chest/shoulder line with the elbow out.', 'Squeeze your shoulder blade back, then lower.'],
    cues: ['Shoulder blade back and down', 'Elbow flared'], mistakes: ['Shrugging up to the ear'],
    easier: ['rear_delt_row'], related: [{ id: 'face_pull', type: 'alternative_to' }],
  }),
  x('db_shrug', 'Dumbbell Shrug', {
    primary: ['traps'], secondary: ['forearms'], pattern: 'shrug',
    unilateral: true, difficulty: 1, reps: [10, 15], startKg: 16, rest: 60,
    instructions: ['Stand tall holding the dumbbell at your side.', 'Shrug your shoulder straight up toward your ear.', 'Hold for a second, then lower fully.'],
    cues: ['Straight up, no rolling', 'Pause at the top'], mistakes: ['Rolling the shoulders', 'Bending the elbow'],
    harder: ['suitcase_deadlift'],
  }),
  x('renegade_row_single', 'Single-Dumbbell Renegade Row', {
    primary: ['lats', 'abs'], secondary: ['obliques', 'traps', 'biceps', 'chest'], pattern: 'horizontal_pull',
    unilateral: true, difficulty: 3, reps: [6, 12], startKg: 8, rest: 75,
    instructions: ['Start in a high plank, one hand on the dumbbell, feet wide.', 'Row the dumbbell to your hip without rotating your hips.', 'Lower it, then complete the side before switching.'],
    cues: ['Feet wide for stability', 'Hips square to the floor'], mistakes: ['Hips twisting', 'Rolling dumbbell'],
    easier: ['one_arm_row'], related: [{ id: 'renegade_row', type: 'variation_of' }],
  }),
  x('superman', 'Superman Hold', {
    ...BW, primary: ['lower_back'], secondary: ['glutes', 'traps'], pattern: 'back_extension',
    metric: 'time', difficulty: 1, reps: [20, 45], bwKg: 20, rest: 45,
    progression: { method: 'time', notes: 'Add 5 seconds per hold, then try prone back extensions.' },
    instructions: ['Lie face down, arms extended overhead.', 'Lift arms, chest and legs a few centimetres off the floor.', 'Hold, breathing steadily.'],
    cues: ['Long, not high', 'Squeeze glutes'], mistakes: ['Cranking the neck up', 'Over-arching'],
    harder: ['back_extension_prone'],
  }),
  x('back_extension_prone', 'Prone Back Extension', {
    ...BW, primary: ['lower_back'], secondary: ['glutes', 'hamstrings'], pattern: 'back_extension',
    difficulty: 1, reps: [10, 20], bwKg: 20, rest: 45,
    instructions: ['Lie face down, hands by your temples.', 'Lift your chest off the floor using your back muscles.', 'Lower slowly.'],
    cues: ['Smooth, controlled', 'Chin tucked'], mistakes: ['Jerking up'],
    easier: ['superman'], harder: ['good_morning'],
  }),
  x('bird_dog', 'Bird Dog', {
    ...BW, primary: ['lower_back', 'abs'], secondary: ['glutes', 'rear_delts'], pattern: 'anti_rotation',
    unilateral: true, difficulty: 1, reps: [8, 12], bwKg: 15, rest: 45,
    instructions: ['Start on hands and knees.', 'Extend one arm and the opposite leg until both are level with your torso.', 'Pause, return, and repeat. Then switch sides.'],
    cues: ['Don’t let the hips rotate', 'Reach long'], mistakes: ['Arching the low back'],
    harder: ['dead_bug'],
  }),

  // ───────────────────────── SHOULDERS ─────────────────────────
  x('one_arm_shoulder_press', 'One-Arm Shoulder Press', {
    primary: ['front_delts'], secondary: ['side_delts', 'triceps', 'obliques'], pattern: 'vertical_press',
    unilateral: true, difficulty: 1, startKg: 8, rest: 75,
    instructions: ['Stand tall with the dumbbell at shoulder height, palm facing in or forward.', 'Brace and press straight overhead to full lockout.', 'Lower to your shoulder under control. Finish reps, then switch.'],
    cues: ['Glutes and abs tight', 'Bicep near ear at the top', 'Don’t lean away'],
    mistakes: ['Leaning sideways', 'Arching the low back'],
    easier: ['pike_push_up'], harder: ['arnold_press', 'z_press'],
    related: [{ id: 'seated_db_press', type: 'progresses_to' }, { id: 'db_shoulder_press_pair', type: 'progresses_to' }],
  }),
  x('half_kneeling_press', 'Half-Kneeling Press', {
    primary: ['front_delts'], secondary: ['side_delts', 'triceps', 'abs', 'obliques'], pattern: 'vertical_press',
    unilateral: true, difficulty: 2, startKg: 8, rest: 75,
    instructions: ['Kneel on one knee, the same-side hand holding the dumbbell at your shoulder.', 'Squeeze the glute of the down knee and press overhead.', 'Lower slowly.'],
    cues: ['Ribs down', 'Stacked over the knee'], mistakes: ['Leaning back'],
    easier: ['one_arm_shoulder_press'], related: [{ id: 'one_arm_shoulder_press', type: 'variation_of' }],
  }),
  x('z_press', 'Z-Press (Seated Floor Press)', {
    primary: ['front_delts'], secondary: ['side_delts', 'triceps', 'abs'], pattern: 'vertical_press',
    unilateral: true, difficulty: 3, startKg: 6, rest: 90,
    instructions: ['Sit on the floor with legs straight and spread.', 'Press the dumbbell overhead without leaning back.', 'Lower under control.'],
    cues: ['Sit tall', 'Strict — no leg drive possible'], mistakes: ['Rounding the back'],
    easier: ['one_arm_shoulder_press'], related: [{ id: 'one_arm_shoulder_press', type: 'progression_from' }],
  }),
  x('arnold_press', 'Arnold Press', {
    primary: ['front_delts', 'side_delts'], secondary: ['triceps'], pattern: 'vertical_press',
    unilateral: true, difficulty: 2, startKg: 6, rest: 75,
    instructions: ['Start with the dumbbell in front of your shoulder, palm facing you.', 'Rotate your palm forward as you press overhead.', 'Reverse the rotation on the way down.'],
    cues: ['Smooth rotation', 'Full lockout'], mistakes: ['Rushing the rotation'],
    easier: ['one_arm_shoulder_press'], related: [{ id: 'one_arm_shoulder_press', type: 'variation_of' }],
  }),
  x('pike_push_up', 'Pike Push-Up', {
    ...BW, primary: ['front_delts'], secondary: ['triceps', 'side_delts', 'traps'], pattern: 'vertical_press',
    difficulty: 2, reps: [6, 15], bwKg: 35, rest: 75,
    instructions: ['Start in a push-up, then walk your feet in so your hips are high (inverted V).', 'Bend your elbows to lower the top of your head toward the floor.', 'Press back up.'],
    cues: ['Head goes slightly forward of hands', 'Hips high'], mistakes: ['Turning it into a regular push-up'],
    harder: ['one_arm_shoulder_press'],
  }),
  x('lateral_raise', 'Lateral Raise', {
    primary: ['side_delts'], secondary: ['traps'], pattern: 'lateral_raise',
    unilateral: true, difficulty: 1, reps: [10, 15], startKg: 4, rest: 60,
    instructions: ['Stand tall holding the dumbbell at your side.', 'With a soft elbow, raise your arm out to the side to shoulder height.', 'Lower slowly. Finish reps, then switch.'],
    cues: ['Lead with the elbow', 'Pinky slightly up is fine', 'Slow 2-second lowering'],
    mistakes: ['Swinging', 'Shrugging', 'Going above shoulder height with heavy weight'],
    harder: ['leaning_lateral_raise'], related: [{ id: 'band_lateral_raise', type: 'alternative_to' }],
  }),
  x('leaning_lateral_raise', 'Leaning Lateral Raise', {
    primary: ['side_delts'], secondary: [], pattern: 'lateral_raise',
    unilateral: true, difficulty: 2, reps: [10, 15], startKg: 4, rest: 60,
    instructions: ['Hold a door frame or pole and lean away from it.', 'Raise the dumbbell out to the side.', 'Lower slowly — the lean keeps tension at the bottom.'],
    cues: ['Stable anchor', 'Strict tempo'], mistakes: ['Weak anchor'],
    easier: ['lateral_raise'], related: [{ id: 'lateral_raise', type: 'progression_from' }],
  }),
  x('front_raise', 'Front Raise', {
    primary: ['front_delts'], secondary: ['side_delts', 'traps'], pattern: 'front_raise',
    difficulty: 1, reps: [10, 15], startKg: 5, rest: 60,
    instructions: ['Hold the dumbbell by both heads in front of your thighs.', 'Raise it straight in front of you to eye level.', 'Lower slowly.'],
    cues: ['No leaning back', 'Soft elbows'], mistakes: ['Using momentum'],
  }),
  x('rear_delt_fly', 'Rear-Delt Fly', {
    primary: ['rear_delts'], secondary: ['traps'], pattern: 'rear_delt',
    unilateral: true, difficulty: 1, reps: [12, 20], startKg: 3, rest: 60,
    instructions: ['Hinge forward with your chest supported on your knee or a chair back, or stand bent over.', 'Raise the dumbbell out to the side with a slightly bent elbow.', 'Pause and lower slowly.'],
    cues: ['Move from the shoulder, not the shoulder blade', 'Thumb slightly down'], mistakes: ['Rowing instead of flying'],
    harder: ['rear_delt_row'], related: [{ id: 'reverse_fly', type: 'variation_of' }],
  }),
  x('upright_row', 'Upright Row', {
    primary: ['side_delts', 'traps'], secondary: ['biceps', 'front_delts'], pattern: 'upright_row',
    difficulty: 2, reps: [10, 15], startKg: 8, rest: 60,
    instructions: ['Hold the dumbbell by both heads in front of your thighs.', 'Pull it up along your body, elbows leading, to lower-chest height.', 'Lower slowly.'],
    cues: ['Elbows above hands', 'Stop at lower chest — pain-free range only'],
    mistakes: ['Pulling to the chin if it pinches', 'Using momentum'],
  }),
  x('y_raise_prone', 'Prone Y-Raise', {
    ...BW, primary: ['traps', 'rear_delts'], secondary: ['lower_back'], pattern: 'rear_delt',
    difficulty: 1, reps: [10, 20], bwKg: 10, rest: 45,
    instructions: ['Lie face down, arms overhead in a Y shape, thumbs up.', 'Lift your arms off the floor by squeezing your upper back.', 'Lower slowly.'],
    cues: ['Thumbs to the ceiling', 'Shoulders away from ears'], mistakes: ['Lifting with the low back'],
    harder: ['reverse_fly'],
  }),

  // ───────────────────────── BICEPS ─────────────────────────
  x('db_curl', 'Dumbbell Curl', {
    primary: ['biceps'], secondary: ['forearms'], pattern: 'elbow_flexion',
    unilateral: true, difficulty: 1, startKg: 8, rest: 60,
    instructions: ['Stand tall, dumbbell at your side, palm facing forward.', 'Curl the weight up, keeping your elbow by your side.', 'Lower fully under control. Finish reps, then switch.'],
    cues: ['Elbow pinned', 'Squeeze at the top', 'Full extension at the bottom'],
    mistakes: ['Swinging the torso', 'Elbow drifting forward', 'Half reps'],
    easier: [], harder: ['concentration_curl', 'drag_curl'],
  }),
  x('goblet_curl', 'Goblet Curl', {
    primary: ['biceps'], secondary: ['forearms'], pattern: 'elbow_flexion',
    difficulty: 1, startKg: 10, rest: 60,
    instructions: ['Hold the dumbbell vertically by its top head with both hands, palms up.', 'Curl it to your upper chest, elbows at your sides.', 'Lower slowly.'],
    cues: ['Both arms share the load', 'Strict elbows'], mistakes: ['Leaning back'],
    related: [{ id: 'db_curl', type: 'variation_of' }],
  }),
  x('hammer_curl', 'Hammer Curl', {
    primary: ['biceps', 'forearms'], secondary: [], pattern: 'elbow_flexion',
    unilateral: true, difficulty: 1, startKg: 8, rest: 60,
    instructions: ['Hold the dumbbell at your side with a neutral grip (palm facing in).', 'Curl up keeping the palm facing in.', 'Lower fully.'],
    cues: ['Thumb up the whole time', 'No swinging'], mistakes: ['Elbow drifting forward'],
    harder: ['cross_body_hammer_curl'], related: [{ id: 'db_curl', type: 'variation_of' }],
  }),
  x('cross_body_hammer_curl', 'Cross-Body Hammer Curl', {
    primary: ['biceps', 'forearms'], secondary: [], pattern: 'elbow_flexion',
    unilateral: true, difficulty: 2, startKg: 8, rest: 60,
    instructions: ['Hold the dumbbell with a neutral grip.', 'Curl it across your body toward the opposite shoulder.', 'Lower to the starting position.'],
    cues: ['Upper arm stays still'], mistakes: ['Twisting the torso'],
    easier: ['hammer_curl'], related: [{ id: 'hammer_curl', type: 'variation_of' }],
  }),
  x('concentration_curl', 'Concentration Curl', {
    primary: ['biceps'], secondary: [], pattern: 'elbow_flexion',
    unilateral: true, difficulty: 1, reps: [10, 15], startKg: 6, rest: 60,
    instructions: ['Sit on the floor or a chair, elbow braced against your inner thigh.', 'Curl the dumbbell toward your shoulder.', 'Squeeze, then lower fully.'],
    cues: ['Elbow locked on the thigh', 'Slow negatives'], mistakes: ['Lifting the elbow off the thigh'],
    easier: ['db_curl'], related: [{ id: 'spider_curl', type: 'alternative_to' }],
  }),
  x('reverse_curl', 'Reverse Curl', {
    primary: ['forearms'], secondary: ['biceps'], pattern: 'elbow_flexion',
    unilateral: true, difficulty: 2, reps: [10, 15], startKg: 5, rest: 60,
    instructions: ['Hold the dumbbell with an overhand grip (palm facing down).', 'Curl it up keeping the wrist straight.', 'Lower slowly.'],
    cues: ['Wrist neutral'], mistakes: ['Letting the wrist bend'],
    easier: ['hammer_curl'],
  }),
  x('zottman_curl', 'Zottman Curl', {
    primary: ['biceps', 'forearms'], secondary: [], pattern: 'elbow_flexion',
    unilateral: true, difficulty: 2, reps: [8, 12], startKg: 6, rest: 60,
    instructions: ['Curl up with your palm facing up.', 'At the top, rotate so your palm faces down.', 'Lower slowly with the overhand grip, rotate back at the bottom.'],
    cues: ['Slow 3-second lowering'], mistakes: ['Rushing the rotation'],
    easier: ['db_curl', 'reverse_curl'],
  }),
  x('drag_curl', 'Drag Curl', {
    primary: ['biceps'], secondary: ['forearms'], pattern: 'elbow_flexion',
    unilateral: true, difficulty: 2, startKg: 6, rest: 60,
    instructions: ['Hold the dumbbell in front of your thigh.', 'Curl it up while pulling your elbow back, dragging the weight along your body.', 'Lower the same way.'],
    cues: ['Elbow travels back', 'Weight stays close'], mistakes: ['Letting the dumbbell drift forward'],
    easier: ['db_curl'],
  }),

  // ───────────────────────── TRICEPS ─────────────────────────
  x('one_arm_oh_extension', 'One-Arm Overhead Extension', {
    primary: ['triceps'], secondary: [], pattern: 'elbow_extension',
    unilateral: true, difficulty: 1, reps: [10, 15], startKg: 5, rest: 60,
    instructions: ['Hold the dumbbell overhead with your arm straight.', 'Bend your elbow to lower the weight behind your head.', 'Extend back to the top.'],
    cues: ['Elbow points up', 'Full stretch at the bottom'], mistakes: ['Elbow flaring wide', 'Arching the back'],
    harder: ['two_hand_oh_extension'],
  }),
  x('two_hand_oh_extension', 'Two-Hand Overhead Extension', {
    primary: ['triceps'], secondary: [], pattern: 'elbow_extension',
    difficulty: 1, reps: [10, 15], startKg: 10, rest: 75,
    instructions: ['Hold one dumbbell by its top head with both hands overhead.', 'Lower it behind your head by bending your elbows.', 'Extend to lockout.'],
    cues: ['Elbows in', 'Ribs down'], mistakes: ['Flaring elbows'],
    easier: ['one_arm_oh_extension'], related: [{ id: 'one_arm_oh_extension', type: 'variation_of' }],
  }),
  x('db_skull_crusher', 'Dumbbell Skull Crusher', {
    primary: ['triceps'], secondary: [], pattern: 'elbow_extension',
    difficulty: 2, reps: [10, 15], startKg: 8, rest: 75,
    instructions: ['Lie on the floor holding the dumbbell by both heads above your chest.', 'Bend your elbows to lower it toward your forehead.', 'Extend back up without moving your upper arms.'],
    cues: ['Upper arms vertical', 'Control near your head'], mistakes: ['Elbows flaring', 'Moving the upper arms'],
    easier: ['one_arm_oh_extension'],
  }),
  x('close_grip_floor_press', 'Close-Grip Floor Press', {
    primary: ['triceps'], secondary: ['chest', 'front_delts'], pattern: 'horizontal_press',
    difficulty: 1, startKg: 10, rest: 90,
    instructions: ['Lie on the floor holding the dumbbell vertically, hands touching.', 'Lower with elbows tucked close to your sides until they touch the floor.', 'Press up to lockout.'],
    cues: ['Elbows tucked', 'Squeeze triceps at the top'], mistakes: ['Elbows flaring out'],
    harder: ['tate_press'], related: [{ id: 'db_floor_press', type: 'variation_of' }],
  }),
  x('triceps_kickback', 'Triceps Kickback', {
    primary: ['triceps'], secondary: ['rear_delts'], pattern: 'elbow_extension',
    unilateral: true, difficulty: 1, reps: [12, 15], startKg: 4, rest: 60,
    instructions: ['Hinge forward with support, upper arm tight to your side and parallel to the floor.', 'Extend your elbow until your arm is straight.', 'Squeeze, then lower slowly.'],
    cues: ['Upper arm doesn’t move', 'Squeeze at lockout'], mistakes: ['Swinging the weight'],
  }),
  x('tate_press', 'Tate Press', {
    primary: ['triceps'], secondary: ['chest'], pattern: 'elbow_extension',
    unilateral: true, difficulty: 3, reps: [8, 12], startKg: 5, rest: 60,
    instructions: ['Lie on the floor holding the dumbbell above your chest, palm facing your feet.', 'Bend the elbow outward to lower the dumbbell toward your chest.', 'Extend back up.'],
    cues: ['Elbow points out', 'Light and controlled'], mistakes: ['Going too heavy'],
    easier: ['close_grip_floor_press'],
  }),

  // ───────────────────────── FOREARMS ─────────────────────────
  x('wrist_curl', 'Wrist Curl', {
    primary: ['forearms'], secondary: [], pattern: 'wrist',
    unilateral: true, difficulty: 1, reps: [12, 20], startKg: 6, rest: 45,
    instructions: ['Kneel and rest your forearm on your thigh, palm up, wrist past your knee.', 'Let the dumbbell roll down to your fingers.', 'Curl it back up with your wrist.'],
    cues: ['Full range'], mistakes: ['Lifting the forearm'],
    harder: ['reverse_wrist_curl'],
  }),
  x('reverse_wrist_curl', 'Reverse Wrist Curl', {
    primary: ['forearms'], secondary: [], pattern: 'wrist',
    unilateral: true, difficulty: 1, reps: [12, 20], startKg: 4, rest: 45,
    instructions: ['Rest your forearm on your thigh, palm down.', 'Lift the back of your hand up.', 'Lower slowly.'],
    cues: ['Light weight, strict'], mistakes: ['Using the arm'],
    easier: ['wrist_curl'],
  }),

  // ───────────────────────── LEGS ─────────────────────────
  x('bodyweight_squat', 'Bodyweight Squat', {
    ...BW, primary: ['quads', 'glutes'], secondary: ['adductors'], pattern: 'squat',
    difficulty: 1, reps: [12, 25], bwKg: 30, rest: 60,
    instructions: ['Stand with feet shoulder-width apart.', 'Sit down between your heels as low as you comfortably can.', 'Drive up through your whole foot.'],
    cues: ['Knees track over toes', 'Chest up'], mistakes: ['Heels lifting'],
    harder: ['goblet_squat'],
  }),
  x('goblet_squat', 'Goblet Squat', {
    primary: ['quads', 'glutes'], secondary: ['adductors', 'abs', 'lower_back'], pattern: 'squat',
    difficulty: 1, startKg: 12, rest: 120,
    instructions: ['Hold the dumbbell vertically against your chest by its top head.', 'Squat down between your heels, elbows inside your knees.', 'Drive up through your whole foot.'],
    cues: ['Dumbbell tight to chest', 'Knees out', 'Stay tall'],
    mistakes: ['Heels lifting', 'Knees caving in', 'Rounding forward'],
    easier: ['bodyweight_squat'], harder: ['heel_elevated_goblet_squat', 'bulgarian_split_squat'],
    related: [{ id: 'front_squat', type: 'progresses_to' }, { id: 'back_squat', type: 'progresses_to' }],
    atMax: ['bulgarian_split_squat', 'tempo', 'pause'],
  }),
  x('heel_elevated_goblet_squat', 'Heel-Elevated Goblet Squat', {
    primary: ['quads'], secondary: ['glutes', 'adductors'], pattern: 'squat',
    difficulty: 2, reps: [10, 15], startKg: 10, rest: 90,
    instructions: ['Place your heels on a small plate, book or sturdy wedge.', 'Hold the dumbbell at your chest and squat deep, knees travelling forward.', 'Stand up tall.'],
    cues: ['Upright torso', 'Knees forward is fine'], mistakes: ['Unstable heel support'],
    easier: ['goblet_squat'], related: [{ id: 'goblet_squat', type: 'variation_of' }],
  }),
  x('sumo_squat', 'Sumo Squat', {
    primary: ['adductors', 'glutes'], secondary: ['quads'], pattern: 'squat',
    difficulty: 1, startKg: 14, rest: 90,
    instructions: ['Stand with a wide stance, toes turned out.', 'Hold the dumbbell by one head, hanging between your legs.', 'Squat straight down, then stand up.'],
    cues: ['Knees follow toes', 'Torso upright'], mistakes: ['Knees caving in'],
    easier: ['bodyweight_squat'], related: [{ id: 'goblet_squat', type: 'variation_of' }],
  }),
  x('split_squat', 'Split Squat', {
    primary: ['quads', 'glutes'], secondary: ['adductors'], pattern: 'lunge',
    unilateral: true, difficulty: 1, startKg: 8, rest: 75,
    instructions: ['Stand in a long split stance holding the dumbbell at your chest or by your side.', 'Lower your back knee toward the floor.', 'Drive up through the front foot. Finish reps, then switch.'],
    cues: ['Front heel stays down', 'Torso tall'], mistakes: ['Stance too short', 'Front knee caving'],
    easier: ['bodyweight_squat'], harder: ['bulgarian_split_squat'],
  }),
  x('bulgarian_split_squat', 'Bulgarian Split Squat', {
    primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings'], pattern: 'lunge',
    unilateral: true, difficulty: 2, startKg: 8, rest: 90,
    instructions: ['Place your rear foot on a couch or sturdy chair behind you.', 'Hold the dumbbell at your chest or in the hand opposite the front leg.', 'Lower until your front thigh is near parallel, then drive up.'],
    cues: ['Most weight on the front leg', 'Lean slightly forward for glutes'], mistakes: ['Rear surface too high', 'Bouncing'],
    easier: ['split_squat'], harder: ['single_leg_squat'],
    related: [{ id: 'split_squat', type: 'progression_from' }],
  }),
  x('reverse_lunge', 'Reverse Lunge', {
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors'], pattern: 'lunge',
    unilateral: true, difficulty: 1, startKg: 8, rest: 75,
    instructions: ['Stand tall holding the dumbbell at your chest.', 'Step one foot back and lower your back knee toward the floor.', 'Push through the front foot to return. Finish reps, then switch.'],
    cues: ['Step back far enough', 'Front shin near vertical'], mistakes: ['Wobbling — slow down'],
    harder: ['bulgarian_split_squat', 'forward_lunge'],
  }),
  x('forward_lunge', 'Forward Lunge', {
    primary: ['quads', 'glutes'], secondary: ['adductors'], pattern: 'lunge',
    unilateral: true, difficulty: 2, startKg: 8, rest: 75,
    instructions: ['Hold the dumbbell at your chest.', 'Step forward and lower your back knee toward the floor.', 'Push back to standing.'],
    cues: ['Decelerate under control'], mistakes: ['Front knee collapsing inward'],
    easier: ['reverse_lunge'], harder: ['walking_lunge'],
  }),
  x('walking_lunge', 'Walking Lunge', {
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors', 'calves'], pattern: 'lunge',
    difficulty: 2, reps: [10, 20], startKg: 8, rest: 90,
    instructions: ['Hold the dumbbell at your chest.', 'Lunge forward, then bring the back foot through into the next lunge.', 'Count total steps (both legs).'],
    cues: ['Tall posture', 'Smooth rhythm'], mistakes: ['Short steps'],
    easier: ['forward_lunge'],
  }),
  x('lateral_lunge', 'Lateral Lunge', {
    primary: ['adductors', 'quads'], secondary: ['glutes'], pattern: 'lunge',
    unilateral: true, difficulty: 2, startKg: 6, rest: 75,
    instructions: ['Stand with feet together holding the dumbbell at your chest.', 'Step wide to one side and sit back into that hip, other leg straight.', 'Push back to the start.'],
    cues: ['Sit back, not down', 'Trailing leg straight'], mistakes: ['Heel lifting'],
    harder: ['cossack_squat'],
  }),
  x('cossack_squat', 'Cossack Squat', {
    primary: ['adductors'], secondary: ['quads', 'glutes'], pattern: 'squat',
    unilateral: true, difficulty: 3, reps: [6, 10], startKg: 6, rest: 75,
    instructions: ['Take a very wide stance holding the dumbbell at your chest.', 'Shift down onto one leg, the other leg straight with toes up.', 'Return to the middle and repeat.'],
    cues: ['Go only as deep as you control'], mistakes: ['Forcing depth'],
    easier: ['lateral_lunge'],
  }),
  x('single_leg_squat', 'Single-Leg Box Squat', {
    ...BW, primary: ['quads', 'glutes'], secondary: ['adductors', 'abs'], pattern: 'squat',
    unilateral: true, difficulty: 3, reps: [5, 12], bwKg: 55, rest: 90,
    progression: { method: 'reps', notes: 'Lower the box height over time, then progress toward a full pistol squat.' },
    instructions: ['Stand on one leg in front of a chair or couch.', 'Sit back slowly onto it with control on one leg.', 'Stand back up without using the other leg. Lower the seat over time.'],
    cues: ['Arms forward for balance', 'Knee tracks over toes'], mistakes: ['Dropping onto the seat'],
    easier: ['bulgarian_split_squat'], harder: ['pistol_squat'],
  }),
  x('pistol_squat', 'Pistol Squat', {
    ...BW, primary: ['quads', 'glutes'], secondary: ['abs', 'hip_flexors', 'adductors'], pattern: 'squat',
    unilateral: true, difficulty: 3, reps: [3, 10], bwKg: 65, rest: 120,
    instructions: ['Stand on one leg, other leg held in front.', 'Squat all the way down on one leg.', 'Stand back up. Hold the dumbbell forward as a counterweight if needed.'],
    cues: ['Slow and controlled'], mistakes: ['Collapsing at the bottom'],
    easier: ['single_leg_squat'], related: [{ id: 'single_leg_squat', type: 'progression_from' }],
  }),

  // ───────────────────────── HAMSTRINGS ─────────────────────────
  x('db_rdl', 'Dumbbell Romanian Deadlift', {
    primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'forearms', 'traps'], pattern: 'hinge',
    difficulty: 1, startKg: 14, rest: 120,
    instructions: ['Stand holding the dumbbell vertically by both heads in front of your thighs.', 'Push your hips back with soft knees, sliding the weight down your legs.', 'When you feel a strong hamstring stretch, drive your hips forward to stand.'],
    cues: ['Hips back, not down', 'Flat back', 'Weight close to legs'],
    mistakes: ['Rounding the back', 'Squatting the movement', 'Weight drifting forward'],
    harder: ['single_leg_rdl', 'staggered_rdl'],
    related: [{ id: 'barbell_rdl', type: 'progresses_to' }],
    atMax: ['staggered_rdl', 'single_leg_rdl', 'tempo'],
  }),
  x('staggered_rdl', 'Staggered-Stance RDL', {
    primary: ['hamstrings', 'glutes'], secondary: ['lower_back'], pattern: 'hinge',
    unilateral: true, difficulty: 2, startKg: 12, rest: 75,
    instructions: ['Stand with one foot slightly behind, on its toes (kickstand).', 'Hold the dumbbell and hinge over the front leg.', 'Stand back up driving through the front heel.'],
    cues: ['90% of weight on the front leg'], mistakes: ['Using the back leg too much'],
    easier: ['db_rdl'], harder: ['single_leg_rdl'], related: [{ id: 'db_rdl', type: 'variation_of' }],
  }),
  x('single_leg_rdl', 'Single-Leg RDL', {
    primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'adductors'], pattern: 'hinge',
    unilateral: true, difficulty: 2, startKg: 10, rest: 75,
    instructions: ['Stand on one leg holding the dumbbell in the opposite hand.', 'Hinge forward as the free leg extends behind you.', 'Return to standing with control.'],
    cues: ['Hips square to the floor', 'Reach long through the back heel'], mistakes: ['Opening the hip', 'Rounding'],
    easier: ['staggered_rdl'], related: [{ id: 'db_rdl', type: 'progression_from' }],
  }),
  x('good_morning', 'Dumbbell Good Morning', {
    primary: ['hamstrings', 'lower_back'], secondary: ['glutes'], pattern: 'hinge',
    difficulty: 2, reps: [10, 15], startKg: 8, rest: 75,
    instructions: ['Hold the dumbbell against your upper chest.', 'With soft knees, push your hips back and hinge forward until your torso nears parallel.', 'Drive your hips forward to stand.'],
    cues: ['Neutral spine throughout'], mistakes: ['Going too heavy', 'Rounding'],
    easier: ['back_extension_prone'], harder: ['db_rdl'],
  }),
  x('slider_leg_curl', 'Towel Slider Leg Curl', {
    ...BW, primary: ['hamstrings'], secondary: ['glutes', 'calves'], pattern: 'knee_flexion',
    difficulty: 2, reps: [8, 15], bwKg: 30, rest: 75,
    instructions: ['Lie on your back on a smooth floor, heels on a towel.', 'Lift your hips into a bridge.', 'Slide your heels out until legs are almost straight, then pull them back in.'],
    cues: ['Hips stay up', 'Slow on the way out'], mistakes: ['Dropping hips'],
    easier: ['glute_bridge_bw'], related: [{ id: 'leg_curl_machine', type: 'alternative_to' }],
  }),

  // ───────────────────────── GLUTES ─────────────────────────
  x('glute_bridge_bw', 'Bodyweight Glute Bridge', {
    ...BW, primary: ['glutes'], secondary: ['hamstrings'], pattern: 'hip_extension',
    difficulty: 1, reps: [12, 25], bwKg: 25, rest: 45,
    instructions: ['Lie on your back, knees bent, feet flat.', 'Drive through your heels to lift your hips.', 'Squeeze your glutes at the top, then lower.'],
    cues: ['Ribs down', 'Squeeze 1 s at the top'], mistakes: ['Arching the low back'],
    harder: ['glute_bridge', 'single_leg_glute_bridge'],
  }),
  x('glute_bridge', 'Dumbbell Glute Bridge', {
    primary: ['glutes'], secondary: ['hamstrings'], pattern: 'hip_extension',
    difficulty: 1, reps: [10, 20], startKg: 14, rest: 75,
    instructions: ['Lie on your back with the dumbbell resting across your hips (use a towel for comfort).', 'Drive through your heels to lift your hips.', 'Pause at the top, then lower.'],
    cues: ['Chin tucked, ribs down', 'Pause at the top'], mistakes: ['Pushing through toes'],
    easier: ['glute_bridge_bw'], harder: ['db_hip_thrust', 'single_leg_glute_bridge'],
    related: [{ id: 'barbell_hip_thrust', type: 'progresses_to' }],
  }),
  x('db_hip_thrust', 'Dumbbell Hip Thrust', {
    primary: ['glutes'], secondary: ['hamstrings', 'quads'], pattern: 'hip_extension',
    difficulty: 2, reps: [8, 15], startKg: 14, rest: 90,
    instructions: ['Sit with your upper back against the edge of a sturdy couch, dumbbell on your hips.', 'Drive your hips up until your torso is level with the floor.', 'Squeeze, then lower under control.'],
    cues: ['Shins vertical at the top', 'Chin tucked'], mistakes: ['Over-arching', 'Unstable surface'],
    easier: ['glute_bridge'], related: [{ id: 'glute_bridge', type: 'progression_from' }, { id: 'barbell_hip_thrust', type: 'progresses_to' }],
  }),
  x('single_leg_glute_bridge', 'Single-Leg Glute Bridge', {
    primary: ['glutes'], secondary: ['hamstrings'], pattern: 'hip_extension',
    unilateral: true, difficulty: 2, reps: [8, 15], startKg: 4, rest: 60,
    instructions: ['Lie on your back, one foot on the floor and the other leg straight up or held.', 'Optionally rest the dumbbell on the working hip.', 'Bridge up on one leg, squeeze, and lower.'],
    cues: ['Hips level'], mistakes: ['Hips tilting'],
    easier: ['glute_bridge'],
  }),
  x('curtsy_lunge', 'Curtsy Lunge', {
    primary: ['glutes'], secondary: ['quads', 'adductors'], pattern: 'lunge',
    unilateral: true, difficulty: 2, startKg: 6, rest: 60,
    instructions: ['Hold the dumbbell at your chest.', 'Step one leg diagonally behind the other, lowering into a lunge.', 'Return to standing.'],
    cues: ['Hips stay square'], mistakes: ['Knee collapsing inward'],
    easier: ['reverse_lunge'],
  }),

  // ───────────────────────── CALVES ─────────────────────────
  x('calf_raise_bw', 'Bodyweight Calf Raise', {
    ...BW, primary: ['calves'], secondary: [], pattern: 'calf_raise',
    difficulty: 1, reps: [15, 30], bwKg: 30, rest: 45,
    instructions: ['Stand on the edge of a step with heels hanging off (or flat on the floor).', 'Rise as high as possible onto your toes.', 'Lower slowly to a full stretch.'],
    cues: ['Pause at the top'], mistakes: ['Bouncing'],
    harder: ['loaded_calf_raise', 'single_leg_calf_raise'],
  }),
  x('loaded_calf_raise', 'Loaded Calf Raise', {
    primary: ['calves'], secondary: ['forearms'], pattern: 'calf_raise',
    difficulty: 1, reps: [12, 20], startKg: 14, rest: 60,
    instructions: ['Hold the dumbbell at your side, other hand on a wall for balance.', 'Rise onto your toes as high as possible.', 'Lower slowly through the full range.'],
    cues: ['Full stretch, full squeeze'], mistakes: ['Short range'],
    easier: ['calf_raise_bw'], harder: ['single_leg_calf_raise'],
  }),
  x('single_leg_calf_raise', 'Single-Leg Calf Raise', {
    primary: ['calves'], secondary: [], pattern: 'calf_raise',
    unilateral: true, difficulty: 2, reps: [10, 20], startKg: 8, rest: 60,
    instructions: ['Stand on one foot on a step edge, holding the dumbbell on the same side.', 'Rise as high as possible.', 'Lower to a deep stretch.'],
    cues: ['Slow 2-second lowering'], mistakes: ['Bending the knee to cheat'],
    easier: ['loaded_calf_raise'],
  }),
  x('seated_calf_raise', 'Seated Calf Raise', {
    primary: ['calves'], secondary: [], pattern: 'calf_raise',
    difficulty: 1, reps: [15, 25], startKg: 14, rest: 45,
    instructions: ['Sit on a chair with the dumbbell resting on your knees.', 'Raise your heels as high as possible.', 'Lower slowly.'],
    cues: ['Toes on a book for more range'], mistakes: ['Bouncing'],
  }),

  // ───────────────────────── CORE ─────────────────────────
  x('weighted_crunch', 'Weighted Crunch', {
    primary: ['abs'], secondary: [], pattern: 'core_flexion',
    difficulty: 1, reps: [10, 20], startKg: 5, rest: 60,
    instructions: ['Lie on your back, knees bent, holding the dumbbell on your chest.', 'Curl your shoulders off the floor, bringing ribs toward hips.', 'Lower slowly.'],
    cues: ['Exhale on the way up', 'Chin slightly tucked'], mistakes: ['Pulling the neck'],
    harder: ['db_sit_up'],
  }),
  x('db_sit_up', 'Dumbbell Sit-Up', {
    primary: ['abs'], secondary: ['hip_flexors', 'obliques'], pattern: 'core_flexion',
    difficulty: 2, reps: [8, 15], startKg: 5, rest: 60,
    instructions: ['Lie on your back holding the dumbbell at your chest, knees bent.', 'Sit all the way up.', 'Lower under control.'],
    cues: ['Feet planted (anchor under a couch if needed)'], mistakes: ['Jerking up'],
    easier: ['weighted_crunch'],
  }),
  x('russian_twist', 'Russian Twist', {
    primary: ['obliques'], secondary: ['abs', 'hip_flexors'], pattern: 'core_rotation',
    difficulty: 2, reps: [12, 24], startKg: 5, rest: 60,
    instructions: ['Sit leaning back slightly, holding the dumbbell at your chest.', 'Rotate your torso to touch the weight beside one hip, then the other.', 'Count each side as one rep.'],
    cues: ['Rotate the ribs, not just the arms'], mistakes: ['Rounding the back'],
    harder: ['db_woodchop'],
  }),
  x('db_woodchop', 'Dumbbell Woodchop', {
    primary: ['obliques'], secondary: ['abs', 'front_delts'], pattern: 'core_rotation',
    unilateral: true, difficulty: 2, reps: [10, 15], startKg: 5, rest: 60,
    instructions: ['Hold the dumbbell with both hands by one hip, knees bent.', 'Rotate and lift it diagonally across your body to above the opposite shoulder.', 'Return under control. Switch sides.'],
    cues: ['Pivot the back foot'], mistakes: ['Yanking with the arms'],
    easier: ['russian_twist'],
  }),
  x('suitcase_hold', 'Suitcase Hold', {
    primary: ['obliques', 'forearms'], secondary: ['traps', 'abs'], pattern: 'carry',
    metric: 'time', unilateral: true, difficulty: 1, reps: [30, 60], startKg: 16, rest: 60,
    progression: { method: 'time', notes: 'Extend the hold to 60 s, then add weight or progress to a suitcase march.' },
    instructions: ['Stand tall holding the dumbbell at one side.', 'Don’t lean — stay perfectly upright.', 'Hold for time, then switch sides.'],
    cues: ['Shoulders level', 'Crush the handle'], mistakes: ['Leaning toward the weight'],
    harder: ['suitcase_march'],
  }),
  x('suitcase_march', 'Suitcase March', {
    primary: ['obliques', 'hip_flexors'], secondary: ['abs', 'forearms', 'traps'], pattern: 'carry',
    metric: 'time', unilateral: true, difficulty: 2, reps: [30, 60], startKg: 14, rest: 60,
    progression: { method: 'time', notes: 'Longer marches, then heavier dumbbell.' },
    instructions: ['Hold the dumbbell at one side.', 'March in place, lifting knees to hip height slowly.', 'Stay upright the whole time, then switch sides.'],
    cues: ['Slow knees', 'No leaning'], mistakes: ['Rushing'],
    easier: ['suitcase_hold'], related: [{ id: 'farmers_carry', type: 'alternative_to' }],
  }),
  x('suitcase_deadlift', 'Suitcase Deadlift', {
    primary: ['glutes', 'obliques'], secondary: ['quads', 'hamstrings', 'traps', 'forearms'], pattern: 'hinge',
    unilateral: true, difficulty: 2, startKg: 16, rest: 75,
    instructions: ['Place the dumbbell beside one foot.', 'Hinge and bend your knees to grip it, back flat.', 'Stand up without leaning sideways, then lower it.'],
    cues: ['Shoulders level', 'Push the floor away'], mistakes: ['Side-bending'],
    easier: ['db_rdl'],
  }),
  x('side_bend', 'Dumbbell Side Bend', {
    primary: ['obliques'], secondary: [], pattern: 'lateral_flexion',
    unilateral: true, difficulty: 1, reps: [12, 20], startKg: 10, rest: 45,
    instructions: ['Stand holding the dumbbell at one side.', 'Bend sideways toward the weight.', 'Use the opposite side to pull yourself back upright.'],
    cues: ['Pure side bend — no twisting'], mistakes: ['Leaning forward'],
  }),
  x('plank', 'Plank', {
    ...BW, primary: ['abs'], secondary: ['obliques', 'front_delts', 'glutes'], pattern: 'anti_extension',
    metric: 'time', difficulty: 1, reps: [30, 60], bwKg: 20, rest: 45,
    progression: { method: 'time', notes: 'Build to 60 s, then progress to plank drag-throughs.' },
    instructions: ['Forearms on the floor, elbows under shoulders.', 'Straight line from heels to head.', 'Brace and hold.'],
    cues: ['Squeeze glutes', 'Push the floor away'], mistakes: ['Sagging hips', 'Holding your breath'],
    harder: ['plank_drag'],
  }),
  x('plank_drag', 'Plank Drag-Through', {
    primary: ['abs', 'obliques'], secondary: ['front_delts', 'chest'], pattern: 'anti_rotation',
    difficulty: 2, reps: [8, 16], startKg: 6, rest: 60, load: 'dumbbell',
    instructions: ['Start in a high plank with the dumbbell beside one hand.', 'Reach under with the opposite hand and drag it to the other side.', 'Alternate without rotating your hips.'],
    cues: ['Feet wide', 'Hips still'], mistakes: ['Hips swaying'],
    easier: ['plank'],
  }),
  x('side_plank', 'Side Plank', {
    ...BW, primary: ['obliques'], secondary: ['abs', 'side_delts', 'adductors'], pattern: 'anti_lateral',
    metric: 'time', unilateral: true, difficulty: 1, reps: [20, 45], bwKg: 20, rest: 45,
    progression: { method: 'time', notes: 'Build to 45 s per side, then hold the dumbbell on your top hip.' },
    instructions: ['Lie on your side, elbow under your shoulder.', 'Lift your hips to form a straight line.', 'Hold, then switch sides.'],
    cues: ['Hips forward', 'Top hip high'], mistakes: ['Hips sagging'],
    harder: ['suitcase_hold'],
  }),
  x('dead_bug', 'Dead Bug', {
    ...BW, primary: ['abs'], secondary: ['hip_flexors', 'obliques'], pattern: 'anti_extension',
    difficulty: 1, reps: [8, 16], bwKg: 15, rest: 45,
    instructions: ['Lie on your back, arms up, knees bent at 90° over your hips.', 'Press your low back into the floor and extend one arm and the opposite leg.', 'Return and alternate. Count each side.'],
    cues: ['Low back glued down', 'Exhale as you extend'], mistakes: ['Back arching off the floor'],
    harder: ['weighted_dead_bug'],
  }),
  x('weighted_dead_bug', 'Weighted Dead Bug', {
    primary: ['abs'], secondary: ['hip_flexors', 'obliques'], pattern: 'anti_extension',
    difficulty: 2, reps: [8, 16], startKg: 4, rest: 45,
    instructions: ['Hold the dumbbell over your chest with both hands.', 'Keep it still while extending your legs one at a time.', 'Low back stays on the floor.'],
    cues: ['Slow legs'], mistakes: ['Arching'],
    easier: ['dead_bug'],
  }),
  x('lying_leg_raise', 'Lying Leg Raise', {
    ...BW, primary: ['hip_flexors', 'abs'], secondary: ['obliques'], pattern: 'hip_flexion',
    difficulty: 2, reps: [8, 15], bwKg: 20, rest: 60,
    instructions: ['Lie on your back, hands under your hips.', 'Keeping legs nearly straight, lift them to vertical.', 'Lower slowly without arching.'],
    cues: ['Low back stays down'], mistakes: ['Dropping the legs'],
    easier: ['dead_bug'], harder: ['weighted_leg_raise'],
    related: [{ id: 'hanging_leg_raise', type: 'progresses_to' }],
  }),
  x('weighted_leg_raise', 'Weighted Leg Raise', {
    primary: ['hip_flexors', 'abs'], secondary: ['obliques', 'adductors'], pattern: 'hip_flexion',
    difficulty: 3, reps: [8, 12], startKg: 3, rest: 60,
    instructions: ['Lie on your back and grip a light dumbbell between your feet.', 'Raise your legs to vertical.', 'Lower slowly.'],
    cues: ['Secure grip with feet'], mistakes: ['Going too heavy'],
    easier: ['lying_leg_raise'],
  }),
  x('adductor_raise', 'Side-Lying Adductor Raise', {
    ...BW, primary: ['adductors'], secondary: [], pattern: 'adduction',
    unilateral: true, difficulty: 1, reps: [12, 20], bwKg: 10, rest: 45,
    instructions: ['Lie on your side, top foot planted in front of your bottom knee.', 'Lift the straight bottom leg off the floor.', 'Lower slowly. Switch sides.'],
    cues: ['Toes forward'], mistakes: ['Rolling back'],
    harder: ['sumo_squat', 'cossack_squat'],
  }),

  // ───────────────── REQUIRES MORE EQUIPMENT (shown as locked until owned) ─────────────────
  x('single_arm_bench_press', 'Single-Arm Bench Press', {
    primary: ['chest'], secondary: ['triceps', 'front_delts', 'obliques'], pattern: 'horizontal_press',
    equipment: ['dumbbell', 'bench'], unilateral: true, difficulty: 2, startKg: 10, rest: 90,
    instructions: ['Lie on a bench with the dumbbell beside your chest.', 'Press up while resisting rotation.', 'Lower below chest level for a full stretch.'],
    cues: ['Feet planted wide'], mistakes: ['Rolling off the bench'],
    easier: ['single_arm_floor_press'], related: [{ id: 'single_arm_floor_press', type: 'progression_from' }],
  }),
  x('incline_single_arm_press', 'Incline Single-Arm Press', {
    primary: ['chest', 'front_delts'], secondary: ['triceps'], pattern: 'horizontal_press',
    equipment: ['dumbbell', 'bench'], unilateral: true, difficulty: 2, startKg: 8, rest: 90,
    instructions: ['Set an adjustable bench to 30°.', 'Press the dumbbell up over your upper chest.', 'Lower with control.'],
    cues: ['Shoulder blades pinned'], mistakes: ['Bench too steep'],
    related: [{ id: 'single_arm_bench_press', type: 'variation_of' }],
  }),
  x('db_bench_press', 'Dumbbell Bench Press', {
    primary: ['chest'], secondary: ['triceps', 'front_delts'], pattern: 'horizontal_press',
    equipment: ['dumbbell_pair', 'bench'], difficulty: 2, startKg: 12, rest: 120,
    instructions: ['Lie on a bench with a dumbbell in each hand at chest level.', 'Press both up until your arms are straight.', 'Lower to a comfortable stretch.'],
    cues: ['Elbows 45°'], mistakes: ['Bouncing at the bottom'],
    easier: ['db_floor_press'], related: [{ id: 'db_floor_press', type: 'progression_from' }],
  }),
  x('db_fly', 'Dumbbell Fly', {
    primary: ['chest'], secondary: ['front_delts'], pattern: 'fly',
    equipment: ['dumbbell_pair', 'bench'], difficulty: 2, reps: [10, 15], startKg: 6, rest: 75,
    instructions: ['Lie on a bench with dumbbells over your chest, palms facing.', 'Open your arms wide with a slight elbow bend.', 'Bring them back together.'],
    cues: ['Fixed elbow angle'], mistakes: ['Going too deep'],
    related: [{ id: 'db_floor_fly', type: 'progression_from' }],
  }),
  x('bench_pullover', 'Bench Pullover', {
    primary: ['lats', 'chest'], secondary: ['triceps'], pattern: 'pullover',
    equipment: ['dumbbell', 'bench'], difficulty: 2, reps: [10, 15], startKg: 10, rest: 75,
    instructions: ['Lie across or along a bench holding the dumbbell over your chest.', 'Lower it behind your head for a deep stretch.', 'Pull it back over.'],
    cues: ['Slight elbow bend'], mistakes: ['Over-arching'],
    related: [{ id: 'db_pullover', type: 'progression_from' }],
  }),
  x('bench_row', 'Bench-Supported One-Arm Row', {
    primary: ['lats'], secondary: ['traps', 'rear_delts', 'biceps'], pattern: 'horizontal_pull',
    equipment: ['dumbbell', 'bench'], unilateral: true, difficulty: 1, startKg: 14, rest: 75,
    instructions: ['Place one knee and hand on a bench.', 'Row the dumbbell to your hip.', 'Lower to a full stretch.'],
    cues: ['Flat back'], mistakes: ['Twisting'],
    related: [{ id: 'one_arm_row', type: 'progression_from' }],
  }),
  x('chest_supported_row', 'Chest-Supported Row', {
    primary: ['lats', 'traps'], secondary: ['rear_delts', 'biceps'], pattern: 'horizontal_pull',
    equipment: ['dumbbell', 'bench'], unilateral: true, difficulty: 1, startKg: 12, rest: 75,
    instructions: ['Lie face down on an incline bench.', 'Row the dumbbell up beside the bench.', 'Lower fully.'],
    cues: ['Chest stays on the pad'], mistakes: ['Lifting the chest'],
    related: [{ id: 'one_arm_row', type: 'progression_from' }],
  }),
  x('seated_db_press', 'Seated Dumbbell Press', {
    primary: ['front_delts'], secondary: ['side_delts', 'triceps'], pattern: 'vertical_press',
    equipment: ['dumbbell', 'bench'], unilateral: true, difficulty: 1, startKg: 10, rest: 90,
    instructions: ['Sit on an upright bench, dumbbell at shoulder height.', 'Press overhead.', 'Lower under control.'],
    cues: ['Back against the pad'], mistakes: ['Arching'],
    related: [{ id: 'one_arm_shoulder_press', type: 'progression_from' }],
  }),
  x('spider_curl', 'Spider Curl', {
    primary: ['biceps'], secondary: [], pattern: 'elbow_flexion',
    equipment: ['dumbbell', 'bench'], unilateral: true, difficulty: 2, startKg: 6, rest: 60,
    instructions: ['Lie chest-down on an incline bench, arm hanging.', 'Curl the dumbbell up.', 'Lower fully.'],
    cues: ['No swinging possible — stay strict'], mistakes: ['Partial reps'],
    related: [{ id: 'concentration_curl', type: 'alternative_to' }],
  }),
  x('bench_dip', 'Bench Dip', {
    ...BW, primary: ['triceps'], secondary: ['chest', 'front_delts'], pattern: 'elbow_extension',
    equipment: ['bench'], difficulty: 1, reps: [8, 20], bwKg: 35, rest: 75,
    instructions: ['Hands on a bench behind you, legs out front.', 'Lower by bending your elbows to about 90°.', 'Press back up.'],
    cues: ['Shoulders down'], mistakes: ['Going too deep'],
  }),
  x('step_up', 'Dumbbell Step-Up', {
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'], pattern: 'lunge',
    equipment: ['dumbbell', 'bench'], unilateral: true, difficulty: 2, startKg: 8, rest: 75,
    instructions: ['Stand facing a bench holding the dumbbell.', 'Step up driving through the top foot.', 'Step down under control.'],
    cues: ['Don’t push off the back foot'], mistakes: ['Bench too high'],
    related: [{ id: 'reverse_lunge', type: 'alternative_to' }],
  }),
  x('db_shoulder_press_pair', 'Dumbbell Shoulder Press', {
    primary: ['front_delts'], secondary: ['side_delts', 'triceps'], pattern: 'vertical_press',
    equipment: ['dumbbell_pair'], difficulty: 2, startKg: 10, rest: 90,
    instructions: ['Hold a dumbbell at each shoulder.', 'Press both overhead.', 'Lower with control.'],
    cues: ['Ribs down'], mistakes: ['Arching'],
    related: [{ id: 'one_arm_shoulder_press', type: 'progression_from' }],
  }),
  x('farmers_carry', 'Farmer’s Carry', {
    primary: ['forearms', 'traps'], secondary: ['abs', 'obliques', 'glutes'], pattern: 'carry',
    equipment: ['dumbbell_pair'], metric: 'time', difficulty: 1, reps: [30, 60], startKg: 16, rest: 75,
    progression: { method: 'time', notes: 'Longer carries, then heavier.' },
    instructions: ['Hold a dumbbell in each hand.', 'Walk tall with short, quick steps.', 'Carry for time.'],
    cues: ['Shoulders packed'], mistakes: ['Leaning'],
    related: [{ id: 'suitcase_march', type: 'alternative_to' }],
  }),
  x('renegade_row', 'Renegade Row', {
    primary: ['lats', 'abs'], secondary: ['obliques', 'biceps'], pattern: 'horizontal_pull',
    equipment: ['dumbbell_pair'], unilateral: true, difficulty: 3, reps: [6, 12], startKg: 8, rest: 90,
    instructions: ['Plank on two dumbbells.', 'Row one, then the other, keeping hips still.'],
    cues: ['Wide feet'], mistakes: ['Hip rotation'],
    related: [{ id: 'renegade_row_single', type: 'variation_of' }],
  }),
  x('pull_up', 'Pull-Up', {
    ...BW, primary: ['lats'], secondary: ['biceps', 'traps', 'rear_delts', 'forearms'], pattern: 'vertical_pull',
    equipment: ['pullup_bar'], difficulty: 3, reps: [4, 12], bwKg: 70, rest: 120,
    instructions: ['Hang from the bar, hands slightly wider than shoulders, palms away.', 'Pull your chest to the bar.', 'Lower to a full hang.'],
    cues: ['Drive elbows down'], mistakes: ['Kipping', 'Half reps'],
    easier: ['chin_up'], related: [{ id: 'db_pullover', type: 'alternative_to' }],
  }),
  x('chin_up', 'Chin-Up', {
    ...BW, primary: ['lats', 'biceps'], secondary: ['traps', 'forearms'], pattern: 'vertical_pull',
    equipment: ['pullup_bar'], difficulty: 2, reps: [4, 12], bwKg: 68, rest: 120,
    instructions: ['Hang with palms facing you, shoulder-width.', 'Pull until your chin clears the bar.', 'Lower fully.'],
    cues: ['Chest up'], mistakes: ['Swinging'],
    harder: ['pull_up'],
  }),
  x('hanging_knee_raise', 'Hanging Knee Raise', {
    ...BW, primary: ['hip_flexors', 'abs'], secondary: ['forearms', 'obliques'], pattern: 'hip_flexion',
    equipment: ['pullup_bar'], difficulty: 2, reps: [8, 15], bwKg: 30, rest: 60,
    instructions: ['Hang from the bar.', 'Raise your knees toward your chest.', 'Lower without swinging.'],
    cues: ['Curl the pelvis up'], mistakes: ['Swinging'],
    harder: ['hanging_leg_raise'],
  }),
  x('hanging_leg_raise', 'Hanging Leg Raise', {
    ...BW, primary: ['hip_flexors', 'abs'], secondary: ['forearms', 'obliques'], pattern: 'hip_flexion',
    equipment: ['pullup_bar'], difficulty: 3, reps: [6, 12], bwKg: 40, rest: 75,
    instructions: ['Hang from the bar.', 'Raise straight legs to hip height or higher.', 'Lower slowly.'],
    cues: ['No swing'], mistakes: ['Using momentum'],
    easier: ['hanging_knee_raise'], related: [{ id: 'lying_leg_raise', type: 'progression_from' }],
  }),
  x('dead_hang', 'Dead Hang', {
    ...BW, primary: ['forearms'], secondary: ['lats'], pattern: 'carry',
    equipment: ['pullup_bar'], metric: 'time', difficulty: 1, reps: [20, 60], bwKg: 40, rest: 60,
    instructions: ['Hang from the bar with straight arms.', 'Relax the lower body, keep shoulders engaged.', 'Hold for time.'],
    cues: ['Breathe'], mistakes: ['Shrugging into the ears'],
  }),
  x('band_pull_apart', 'Band Pull-Apart', {
    ...BW, primary: ['rear_delts'], secondary: ['traps'], pattern: 'rear_delt',
    equipment: ['bands'], load: 'bands', difficulty: 1, reps: [15, 25], bwKg: 10, rest: 45,
    instructions: ['Hold a band at shoulder height, arms straight.', 'Pull it apart until it touches your chest.', 'Return slowly.'],
    cues: ['Squeeze shoulder blades'], mistakes: ['Shrugging'],
  }),
  x('face_pull', 'Band Face Pull', {
    ...BW, primary: ['rear_delts', 'traps'], secondary: ['side_delts'], pattern: 'rear_delt',
    equipment: ['bands'], load: 'bands', difficulty: 1, reps: [12, 20], bwKg: 12, rest: 45,
    instructions: ['Anchor a band at face height.', 'Pull toward your face, hands ending beside your ears.', 'Return slowly.'],
    cues: ['Elbows high'], mistakes: ['Leaning back'],
  }),
  x('band_lateral_raise', 'Band Lateral Raise', {
    ...BW, primary: ['side_delts'], secondary: [], pattern: 'lateral_raise',
    equipment: ['bands'], load: 'bands', unilateral: true, difficulty: 1, reps: [12, 20], bwKg: 8, rest: 45,
    instructions: ['Stand on one end of the band.', 'Raise your arm out to the side.', 'Lower slowly.'],
    cues: ['Soft elbow'], mistakes: ['Shrugging'],
  }),
  x('pallof_press', 'Pallof Press', {
    ...BW, primary: ['obliques', 'abs'], secondary: [], pattern: 'anti_rotation',
    equipment: ['bands'], load: 'bands', unilateral: true, difficulty: 1, reps: [10, 15], bwKg: 12, rest: 45,
    instructions: ['Anchor a band at chest height, stand side-on.', 'Press the band straight out from your chest.', 'Resist the pull, then return.'],
    cues: ['Hips and ribs square'], mistakes: ['Rotating'],
  }),
  x('band_pushdown', 'Band Triceps Pushdown', {
    ...BW, primary: ['triceps'], secondary: [], pattern: 'elbow_extension',
    equipment: ['bands'], load: 'bands', difficulty: 1, reps: [12, 20], bwKg: 10, rest: 45,
    instructions: ['Anchor a band high.', 'Push down until your arms are straight.', 'Return slowly.'],
    cues: ['Elbows pinned'], mistakes: ['Leaning over'],
  }),
  x('band_lat_pulldown', 'Band Lat Pull-Down', {
    ...BW, primary: ['lats'], secondary: ['biceps', 'traps'], pattern: 'vertical_pull',
    equipment: ['bands'], load: 'bands', difficulty: 1, reps: [12, 20], bwKg: 15, rest: 60,
    instructions: ['Anchor a band high and kneel facing it.', 'Pull your elbows down to your sides.', 'Return slowly.'],
    cues: ['Chest up'], mistakes: ['Shrugging'],
  }),
  x('band_lateral_walk', 'Band Lateral Walk', {
    ...BW, primary: ['glutes'], secondary: ['adductors'], pattern: 'abduction',
    equipment: ['bands'], load: 'bands', difficulty: 1, reps: [10, 20], bwKg: 10, rest: 45,
    instructions: ['Place a loop band above your knees.', 'Half-squat and step sideways.', 'Keep tension throughout.'],
    cues: ['Toes forward'], mistakes: ['Feet coming together'],
  }),
  x('kb_swing', 'Kettlebell Swing', {
    primary: ['glutes', 'hamstrings'], secondary: ['lower_back', 'forearms', 'abs'], pattern: 'swing',
    equipment: ['kettlebell'], load: 'kettlebell', difficulty: 2, reps: [12, 20], startKg: 12, rest: 75,
    instructions: ['Hinge and hike the kettlebell between your legs.', 'Snap your hips forward to swing it to chest height.', 'Let it fall back into the next hinge.'],
    cues: ['Hips, not arms'], mistakes: ['Squatting the swing'],
    related: [{ id: 'db_rdl', type: 'alternative_to' }],
  }),
  x('kb_clean_press', 'Kettlebell Clean & Press', {
    primary: ['front_delts', 'glutes'], secondary: ['triceps', 'traps', 'hamstrings'], pattern: 'vertical_press',
    equipment: ['kettlebell'], load: 'kettlebell', unilateral: true, difficulty: 3, reps: [5, 10], startKg: 12, rest: 90,
    instructions: ['Clean the kettlebell to the rack position.', 'Press it overhead.', 'Lower and repeat.'],
    cues: ['Tame the arc'], mistakes: ['Banging the wrist'],
  }),
  x('barbell_bench_press', 'Barbell Bench Press', {
    primary: ['chest'], secondary: ['triceps', 'front_delts'], pattern: 'horizontal_press',
    equipment: ['barbell', 'plates', 'bench', 'rack'], load: 'barbell', difficulty: 2, reps: [5, 10], startKg: 30, rest: 150,
    instructions: ['Lie under the bar, eyes under it.', 'Lower to your lower chest.', 'Press to lockout.'],
    cues: ['Leg drive', 'Shoulder blades pinned'], mistakes: ['Bouncing'],
    related: [{ id: 'db_floor_press', type: 'progression_from' }],
  }),
  x('back_squat', 'Barbell Back Squat', {
    primary: ['quads', 'glutes'], secondary: ['adductors', 'lower_back', 'hamstrings'], pattern: 'squat',
    equipment: ['barbell', 'plates', 'rack'], load: 'barbell', difficulty: 2, reps: [5, 10], startKg: 30, rest: 180,
    instructions: ['Bar on your upper back.', 'Squat to depth.', 'Drive up.'],
    cues: ['Brace hard'], mistakes: ['Knees caving'],
    related: [{ id: 'goblet_squat', type: 'progression_from' }],
  }),
  x('front_squat', 'Barbell Front Squat', {
    primary: ['quads'], secondary: ['glutes', 'abs', 'traps'], pattern: 'squat',
    equipment: ['barbell', 'plates', 'rack'], load: 'barbell', difficulty: 3, reps: [5, 8], startKg: 30, rest: 180,
    instructions: ['Bar on the front of your shoulders, elbows high.', 'Squat down tall.', 'Drive up.'],
    cues: ['Elbows up'], mistakes: ['Rounding forward'],
    related: [{ id: 'goblet_squat', type: 'progression_from' }],
  }),
  x('barbell_deadlift', 'Barbell Deadlift', {
    primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['traps', 'forearms', 'quads'], pattern: 'hinge',
    equipment: ['barbell', 'plates'], load: 'barbell', difficulty: 3, reps: [3, 8], startKg: 40, rest: 180,
    instructions: ['Bar over mid-foot.', 'Grip, brace, and push the floor away.', 'Lock out with your hips.'],
    cues: ['Bar close'], mistakes: ['Rounding'],
    related: [{ id: 'db_rdl', type: 'progression_from' }],
  }),
  x('barbell_rdl', 'Barbell Romanian Deadlift', {
    primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'forearms'], pattern: 'hinge',
    equipment: ['barbell', 'plates'], load: 'barbell', difficulty: 2, reps: [6, 10], startKg: 30, rest: 150,
    instructions: ['Hold the bar at your hips.', 'Hinge back with soft knees.', 'Stand tall.'],
    cues: ['Hips back'], mistakes: ['Squatting it'],
    related: [{ id: 'db_rdl', type: 'progression_from' }],
  }),
  x('barbell_row', 'Barbell Row', {
    primary: ['lats', 'traps'], secondary: ['rear_delts', 'biceps', 'lower_back'], pattern: 'horizontal_pull',
    equipment: ['barbell', 'plates'], load: 'barbell', difficulty: 2, reps: [6, 12], startKg: 30, rest: 120,
    instructions: ['Hinge with the bar hanging.', 'Row it to your lower ribs.', 'Lower with control.'],
    cues: ['Torso still'], mistakes: ['Standing up as you row'],
    related: [{ id: 'one_arm_row', type: 'progression_from' }],
  }),
  x('barbell_ohp', 'Barbell Overhead Press', {
    primary: ['front_delts'], secondary: ['side_delts', 'triceps', 'abs'], pattern: 'vertical_press',
    equipment: ['barbell', 'plates', 'rack'], load: 'barbell', difficulty: 2, reps: [5, 10], startKg: 20, rest: 150,
    instructions: ['Bar at your collarbones.', 'Press overhead, head through at the top.', 'Lower.'],
    cues: ['Glutes tight'], mistakes: ['Leaning back'],
    related: [{ id: 'one_arm_shoulder_press', type: 'progression_from' }],
  }),
  x('barbell_hip_thrust', 'Barbell Hip Thrust', {
    primary: ['glutes'], secondary: ['hamstrings'], pattern: 'hip_extension',
    equipment: ['barbell', 'plates', 'bench'], load: 'barbell', difficulty: 2, reps: [8, 12], startKg: 40, rest: 120,
    instructions: ['Upper back on a bench, bar over hips.', 'Drive hips up.', 'Lower.'],
    cues: ['Chin tucked'], mistakes: ['Over-arching'],
    related: [{ id: 'db_hip_thrust', type: 'progression_from' }],
  }),
  x('barbell_curl', 'Barbell Curl', {
    primary: ['biceps'], secondary: ['forearms'], pattern: 'elbow_flexion',
    equipment: ['barbell'], load: 'barbell', difficulty: 1, reps: [8, 12], startKg: 20, rest: 75,
    instructions: ['Hold the bar with palms up.', 'Curl it up.', 'Lower fully.'],
    cues: ['Elbows still'], mistakes: ['Swinging'],
  }),
  x('cable_fly', 'Cable Fly', {
    primary: ['chest'], secondary: ['front_delts'], pattern: 'fly',
    equipment: ['cable'], load: 'cable', difficulty: 1, reps: [10, 15], startKg: 10, rest: 60,
    instructions: ['Set handles at shoulder height.', 'Bring your hands together in front of your chest.', 'Return slowly.'],
    cues: ['Hug motion'], mistakes: ['Pressing'],
  }),
  x('lat_pulldown', 'Lat Pulldown', {
    primary: ['lats'], secondary: ['biceps', 'traps', 'rear_delts'], pattern: 'vertical_pull',
    equipment: ['cable'], load: 'cable', difficulty: 1, reps: [8, 12], startKg: 30, rest: 90,
    instructions: ['Grip the bar wide.', 'Pull it to your upper chest.', 'Return under control.'],
    cues: ['Chest up'], mistakes: ['Leaning far back'],
    related: [{ id: 'pull_up', type: 'alternative_to' }],
  }),
  x('cable_row', 'Seated Cable Row', {
    primary: ['lats', 'traps'], secondary: ['rear_delts', 'biceps'], pattern: 'horizontal_pull',
    equipment: ['cable'], load: 'cable', difficulty: 1, reps: [8, 12], startKg: 30, rest: 90,
    instructions: ['Sit tall with the handle.', 'Row to your stomach.', 'Return slowly.'],
    cues: ['No rocking'], mistakes: ['Using momentum'],
  }),
  x('cable_pushdown', 'Cable Triceps Pushdown', {
    primary: ['triceps'], secondary: [], pattern: 'elbow_extension',
    equipment: ['cable'], load: 'cable', difficulty: 1, reps: [10, 15], startKg: 15, rest: 60,
    instructions: ['Grip the rope or bar.', 'Push down to full extension.', 'Return slowly.'],
    cues: ['Elbows pinned'], mistakes: ['Leaning in'],
  }),
  x('cable_crunch', 'Cable Crunch', {
    primary: ['abs'], secondary: ['obliques'], pattern: 'core_flexion',
    equipment: ['cable'], load: 'cable', difficulty: 2, reps: [10, 15], startKg: 20, rest: 60,
    instructions: ['Kneel holding a rope behind your head.', 'Crunch your ribs toward your hips.', 'Return slowly.'],
    cues: ['Hips still'], mistakes: ['Pulling with arms'],
  }),
  x('leg_press', 'Leg Press', {
    primary: ['quads', 'glutes'], secondary: ['adductors', 'hamstrings'], pattern: 'squat',
    equipment: ['machine'], load: 'machine', difficulty: 1, reps: [8, 15], startKg: 60, rest: 120,
    instructions: ['Feet shoulder-width on the platform.', 'Lower until knees are near 90°.', 'Press up without locking.'],
    cues: ['Low back on the pad'], mistakes: ['Hips lifting'],
  }),
  x('leg_curl_machine', 'Leg Curl Machine', {
    primary: ['hamstrings'], secondary: ['calves'], pattern: 'knee_flexion',
    equipment: ['machine'], load: 'machine', difficulty: 1, reps: [10, 15], startKg: 25, rest: 75,
    instructions: ['Set the pad above your heels.', 'Curl your heels toward your glutes.', 'Return slowly.'],
    cues: ['Hips down'], mistakes: ['Jerking'],
  }),
  x('leg_extension', 'Leg Extension', {
    primary: ['quads'], secondary: [], pattern: 'knee_extension',
    equipment: ['machine'], load: 'machine', difficulty: 1, reps: [10, 15], startKg: 25, rest: 75,
    instructions: ['Pad on your lower shins.', 'Extend your knees fully.', 'Lower slowly.'],
    cues: ['Squeeze at the top'], mistakes: ['Swinging'],
  }),
];

export const EXERCISES = list;
export const EXERCISE_BY_ID = Object.fromEntries(list.map((e) => [e.id, e]));

/** Exercises that reference another exercise by relationship (reverse index). */
export function relatedExercises(id) {
  const ex = EXERCISE_BY_ID[id];
  if (!ex) return [];
  const out = new Map();
  for (const r of ex.related) if (EXERCISE_BY_ID[r.id]) out.set(r.id, r.type);
  for (const other of list) {
    if (other.id === id) continue;
    const back = other.related.find((r) => r.id === id);
    if (back && !out.has(other.id)) out.set(other.id, INVERSE[back.type] || back.type);
  }
  return [...out].map(([rid, type]) => ({ id: rid, type }));
}

const INVERSE = { progression_from: 'progresses_to', progresses_to: 'progression_from' };

export const RELATION_LABEL = {
  variation_of: 'Variation',
  progression_from: 'Builds on',
  progresses_to: 'Next step',
  alternative_to: 'Alternative',
};
