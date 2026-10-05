/** Settings — training preferences, equipment & profiles, data backup, safety. */
import { appbar, icon, SAFETY_TEXT } from '../components/ui.js';
import { EQUIPMENT, EQUIPMENT_BY_ID } from '../data/equipment.js';
import { FREQ_LIST } from '../engine/streak.js';
import { unlockSuggestions, availableExercises } from '../engine/equipment.js';
import { levelCost, THRESHOLDS } from '../engine/levels.js';
import { esc, kg, num } from '../utils/format.js';
import { uid } from '../utils/id.js';
import { validate } from './onboarding.js';
import * as shared from './shared.js';

const REST = [['exercise', 'Per exercise'], ['60', '60 s'], ['90', '90 s'], ['120', '2 min'], ['180', '3 min']];

function seg(action, current, options) {
  return `<div class="seg">${options.map(([v, n]) => `<button data-action="${action}" data-v="${v}" aria-pressed="${String(current) === String(v)}">${n}</button>`).join('')}</div>`;
}

function sw(action, on, label, disabled = false, extra = '') {
  return `<button class="switch" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-action="${action}" ${extra} ${disabled ? 'disabled' : ''}></button>`;
}

function equipmentSection(ctx) {
  const { store } = ctx;
  const s = store.settings;
  const prof = store.profile;
  const owned = prof.items || {};
  const count = availableExercises(store.caps).length;
  const profiles = s.profiles.length > 1 || true
    ? `<div class="chips mt-8" role="group" aria-label="Equipment profile">${s.profiles.map((p) => `<button class="chip" data-action="st-profile" data-v="${p.id}" aria-pressed="${p.id === prof.id}">${esc(p.name)}</button>`).join('')}
        <button class="chip" data-action="st-profile-new">${icon.plus.replace('<svg', '<svg style="width:14px;display:inline;vertical-align:-2px"')} Profile</button></div>`
    : '';
  const rows = EQUIPMENT.filter((e) => owned[e.id] || e.alwaysOwned).map((e) => {
    const load = owned[e.id]?.load;
    return `<div class="eq-row"><div class="grow"><div class="item-title">${esc(e.name)}</div>
      <div class="item-sub">${load ? `${kg(load.min)}–${kg(load.max)} kg · ${kg(load.increment)} kg steps` : esc(e.description)}</div>
      ${load ? `<button class="link" style="padding:4px 0" data-action="st-load" data-item="${e.id}">Edit weights</button>` : ''}</div>
      ${sw('st-eq-off', true, `Remove ${e.name}`, !!e.alwaysOwned, `data-item="${e.id}"`)}</div>`;
  }).join('');
  const custom = (prof.custom || []).map((c, i) => `<div class="eq-row"><div class="grow"><div class="item-title">${esc(c)}</div><div class="item-sub">Noted for reference</div></div>
    <button class="icon-btn" data-action="st-custom-del" data-i="${i}" aria-label="Remove ${esc(c)}">${icon.trash}</button></div>`).join('');
  const unlocks = unlockSuggestions(prof).filter((u) => u.gain > 0).slice(0, 3);
  return `<section class="section"><p class="eyebrow">My equipment</p>
    ${profiles}
    <div class="card card--flush mt-8">${rows}${custom}</div>
    <button class="btn btn--block mt-8" data-action="st-eq-add">${icon.plus} Add equipment</button>
    <p class="small muted mt-8">${count} exercises available with your equipment.</p>
    ${unlocks.length ? `<div class="card mt-8"><p class="eyebrow">Unlock more exercises</p><div class="stack mt-8 small">${unlocks.map((u) => `<div class="row row--between"><span class="text-2">Adding a ${esc(u.item.short.toLowerCase())}</span><b>+${u.gain} exercises</b></div>`).join('')}</div></div>` : ''}
    ${s.profiles.length > 1 ? `<button class="link mt-8" data-action="st-profile-del" style="color:var(--bad)">Delete “${esc(prof.name)}” profile</button>` : ''}
  </section>`;
}

function addEquipmentSheet(ctx) {
  ctx.sheet.open({
    title: 'Add equipment',
    live: true,
    render: () => {
      const prof = ctx.store.profile;
      const unl = Object.fromEntries(unlockSuggestions(prof).map((u) => [u.item.id, u.gain]));
      const list = EQUIPMENT.filter((e) => !e.alwaysOwned && !prof.items[e.id]);
      return `<div class="list">${list.map((e) => `<div class="item"><div class="grow"><div class="item-title">${esc(e.name)}</div><div class="item-sub">${esc(e.description)}${unl[e.id] ? ` · unlocks ${unl[e.id]} exercises` : ''}</div></div>
        <button class="btn btn--sm btn--primary" data-action="add-equipment" data-item="${e.id}">Add</button></div>`).join('') || '<p class="muted">You have everything in the catalog.</p>'}</div>
        <div class="section"><p class="eyebrow">Other</p><div class="row mt-8"><input class="input grow" id="st-custom" placeholder="e.g. Jump rope" maxlength="30" aria-label="Other equipment name"><button class="btn" data-action="st-custom-add">Add</button></div>
        <p class="tiny muted mt-8">Other equipment is noted for reference; future FORGE updates can add exercises for it.</p></div>`;
    },
    actions: {
      'st-custom-add': async () => {
        const v = document.getElementById('st-custom')?.value.trim();
        if (!v) return;
        await ctx.store.updateProfile((p) => { (p.custom ||= []).push(v); });
        ctx.toast(`${esc(v)} noted.`);
      },
    },
  });
}

function loadSheet(ctx, itemId) {
  const item = EQUIPMENT_BY_ID[itemId];
  const cur = ctx.store.profile.items[itemId]?.load || item.load;
  const s = { min: cur.min, max: cur.max, inc: cur.increment };
  ctx.sheet.open({
    title: `${item.name} weights`,
    render: () => `<p class="small muted" style="margin-top:0">FORGE never suggests a weight outside this range.</p>
      <div class="db-grid">
        <label class="field"><span class="tiny muted">Minimum (kg)</span><input class="input num" type="number" inputmode="decimal" step="0.5" value="${s.min}" data-input="st-l" data-k="min"></label>
        <label class="field"><span class="tiny muted">Maximum (kg)</span><input class="input num" type="number" inputmode="decimal" step="0.5" value="${s.max}" data-input="st-l" data-k="max"></label>
        <label class="field"><span class="tiny muted">Increment (kg)</span><input class="input num" type="number" inputmode="decimal" step="0.25" value="${s.inc}" data-input="st-l" data-k="inc"></label>
      </div><p class="small mt-8" id="st-l-err" style="color:var(--warn)" role="alert"></p>`,
    foot: () => `<button class="btn btn--primary btn--block" data-action="st-l-save">Save</button>`,
    inputs: { 'st-l': (c, el) => { s[el.dataset.k] = Number(el.value); document.getElementById('st-l-err').textContent = validate(s); } },
    actions: {
      'st-l-save': async () => {
        const err = validate(s);
        if (err) { document.getElementById('st-l-err').textContent = err; return; }
        await ctx.store.updateProfile((p) => { p.items[itemId] = { ...(p.items[itemId] || {}), load: { min: s.min, max: s.max, increment: s.inc } }; });
        ctx.sheet.close();
        ctx.toast('Weights updated.');
      },
    },
  });
}

function xpSheet(ctx) {
  ctx.sheet.open({
    title: 'How levels work',
    render: () => `<p class="text-2" style="margin-top:0">Each muscle moves through <b>4 tiers × 10 levels</b>: Beginner (1–10), Intermediate (11–20), Advanced (21–30), Elite (31–40).</p>
      <p class="text-2">XP comes from <b>hard sets</b>, not endless reps. Every set is weighed by:</p>
      <ul class="ul small"><li><b>Primary vs secondary</b> — the target muscle gets full XP, helpers 40%.</li>
      <li><b>Intensity</b> — sets close to your best earn full XP; light warm-up sets earn little.</li>
      <li><b>Progressive overload</b> — beating your best earns +50%, beating last session +15%.</li>
      <li><b>Getting stronger</b> — as your best lifts grow, every set is worth up to 50% more.</li>
      <li><b>Exercise difficulty</b> and <b>consistency</b> (streak) add small bonuses.</li>
      <li><b>Junk-volume protection</b> — beyond ~12 hard sets per muscle per week, returns drop sharply.</li></ul>
      <p class="text-2">With consistent training, expect Intermediate in roughly 2–3 months, Advanced in about a year, and Elite after several years.</p>
      <div class="kv mt-12">${[1, 10, 20, 30].map((l) => `<div><span>Level ${l} → ${l + 1}</span><b class="num">${num(levelCost(l))} XP</b></div>`).join('')}</div>
      <p class="tiny muted mt-12">Total XP for Elite: ${num(THRESHOLDS[31])}. Everyone starts at Level 1 — FORGE never guesses your strength.</p>`,
  });
}

export default {
  tab: null,
  title: 'Settings',
  render(ctx) {
    const s = ctx.store.settings;
    return `${appbar({ title: 'Settings', back: true })}
      <section class="section" style="margin-top:8px"><p class="eyebrow">Experience</p><div class="mt-8">${seg('st-exp', s.experience, [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']])}</div></section>
      <section class="section"><p class="eyebrow">Training days per week</p><div class="mt-8">${seg('st-freq', s.frequency, FREQ_LIST.map((f) => [f.id, f.label]))}</div>
        <p class="small muted mt-8">Your streak counts training days. Rest days never break it.</p></section>
      <section class="section"><p class="eyebrow">Default workout length</p><div class="mt-8">${seg('st-len', s.targetMinutes, [[30, '30'], [45, '45'], [60, '60'], [75, '75'], [90, '90']])}</div></section>
      <section class="section"><p class="eyebrow">Rest timer</p><div class="mt-8">${seg('st-rest', s.restMode, REST)}</div></section>
      <section class="section"><p class="eyebrow">Week starts on</p><div class="mt-8">${seg('st-week', s.weekStart, [[0, 'Sunday'], [1, 'Monday']])}</div></section>
      <section class="section"><p class="eyebrow">Rest timer alerts</p><div class="card card--flush mt-8">
        <div class="eq-row"><span class="grow item-title">Sound</span>${sw('st-sound', s.sound !== false, 'Sound')}</div>
        <div class="eq-row"><span class="grow item-title">Vibration</span>${sw('st-vib', s.vibrate !== false, 'Vibration')}</div></div></section>
      ${equipmentSection(ctx)}
      <section class="section"><p class="eyebrow">Your data</p>
        <div class="card"><p class="small muted" style="margin-top:0">Everything is stored on this device and works offline. Export a backup to move devices or keep a copy.</p>
        <div class="btn-row"><button class="btn" data-action="st-export">Export backup</button><label class="btn" style="cursor:pointer">Import<input type="file" accept="application/json,.json" data-change="st-import" class="sr-only"></label></div>
        <button class="btn btn--danger btn--block mt-12" data-action="st-reset">Reset all data</button></div></section>
      <section class="section"><p class="eyebrow">About</p><div class="card">
        <button class="link" style="padding:0" data-action="st-xp">How levels &amp; XP work</button>
        <p class="safety mt-12">${esc(SAFETY_TEXT)} If you feel pain, stop the exercise. If it persists, consult a qualified healthcare professional.</p>
        <p class="tiny muted mt-12" style="margin-bottom:0">FORGE 1.0 · Build. Train. Level Up.</p></div></section>`;
  },
  actions: {
    'st-exp': (ctx, el) => ctx.store.saveSettings({ experience: el.dataset.v }),
    'st-freq': (ctx, el) => ctx.store.saveSettings({ frequency: el.dataset.v }),
    'st-len': (ctx, el) => ctx.store.saveSettings({ targetMinutes: Number(el.dataset.v) }),
    'st-rest': (ctx, el) => ctx.store.saveSettings({ restMode: el.dataset.v === 'exercise' ? 'exercise' : Number(el.dataset.v) }),
    'st-week': (ctx, el) => ctx.store.saveSettings({ weekStart: Number(el.dataset.v) }),
    'st-sound': (ctx) => ctx.store.saveSettings({ sound: ctx.store.settings.sound === false }),
    'st-vib': (ctx) => ctx.store.saveSettings({ vibrate: ctx.store.settings.vibrate === false }),
    'st-xp': (ctx) => xpSheet(ctx),
    'st-eq-add': (ctx) => addEquipmentSheet(ctx),
    'st-load': (ctx, el) => loadSheet(ctx, el.dataset.item),
    'st-eq-off': async (ctx, el) => {
      const item = EQUIPMENT_BY_ID[el.dataset.item];
      const ok = await ctx.confirm({ title: `Remove ${item.name}?`, text: 'Exercises that need it will show as locked. Your history and muscle progress are kept.', confirm: 'Remove' });
      if (!ok) return;
      await ctx.store.updateProfile((p) => { delete p.items[item.id]; });
    },
    'st-custom-del': (ctx, el) => ctx.store.updateProfile((p) => { p.custom.splice(Number(el.dataset.i), 1); }),
    'st-profile': (ctx, el) => ctx.store.saveSettings({ activeProfileId: el.dataset.v }),
    'st-profile-new': (ctx) => {
      ctx.sheet.open({
        title: 'New equipment profile',
        render: () => `<p class="small muted" style="margin-top:0">E.g. “Full gym” or “Travel”. Switch between profiles any time — your progress is shared.</p>
          <input class="input" id="st-pname" placeholder="Profile name" maxlength="24" autofocus>
          <div class="list mt-12"><button class="item" data-action="st-p-create" data-copy="1"><div class="grow"><div class="item-title">Copy current equipment</div></div></button>
          <button class="item" data-action="st-p-create" data-copy="0"><div class="grow"><div class="item-title">Start with bodyweight only</div></div></button>
          <button class="item" data-action="st-p-create" data-copy="gym"><div class="grow"><div class="item-title">Full gym</div><div class="item-sub">Dumbbells, bench, barbell, rack, cables, machines…</div></div></button></div>`,
        actions: {
          'st-p-create': async (c, el) => {
            const name = document.getElementById('st-pname').value.trim() || (el.dataset.copy === 'gym' ? 'Full Gym' : 'Profile');
            const cur = ctx.store.profile;
            let items = { bodyweight: {} };
            if (el.dataset.copy === '1') items = structuredClone(cur.items);
            if (el.dataset.copy === 'gym') {
              for (const e of EQUIPMENT) items[e.id] = e.load ? { load: { ...e.load } } : {};
              delete items.adjustable_dumbbell;
              items.second_dumbbell = { load: { min: 2, max: 50, increment: 2 } };
            }
            const id = uid('p');
            const settings = ctx.store.settings;
            await ctx.store.saveSettings({ profiles: [...settings.profiles, { id, name, items, custom: [] }], activeProfileId: id });
            ctx.sheet.close();
            ctx.toast(`Switched to ${esc(name)}.`);
          },
        },
      });
    },
    'st-profile-del': async (ctx) => {
      const s = ctx.store.settings;
      const prof = ctx.store.profile;
      const ok = await ctx.confirm({ title: `Delete “${prof.name}”?`, text: 'Only the equipment list is removed. Workouts and progress are kept.', confirm: 'Delete', danger: true });
      if (!ok) return;
      const profiles = s.profiles.filter((p) => p.id !== prof.id);
      await ctx.store.saveSettings({ profiles, activeProfileId: profiles[0].id });
    },
    'st-export': async (ctx) => {
      const data = await ctx.store.exportJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `forge-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      ctx.toast('Backup exported.');
    },
    'st-reset': async (ctx) => {
      const ok = await ctx.confirm({ title: 'Reset all data?', text: 'This permanently deletes every workout, set, level and setting on this device. Export a backup first if you might want it.', confirm: 'Delete everything', danger: true });
      if (!ok) return;
      await ctx.store.resetAll();
      ctx.ui = {};
      ctx.go('#/', { replace: true });
      ctx.render();
    },
    'add-equipment': (ctx, el) => shared.addEquipment(ctx, el.dataset.item),
  },
  changes: {
    'st-import': async (ctx, el) => {
      const file = el.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const ok = await ctx.confirm({ title: 'Import backup?', text: `This replaces everything on this device with the backup (${data.sessions?.length || 0} workouts).`, confirm: 'Import', danger: true });
        if (!ok) return;
        await ctx.store.importJson(data);
        ctx.toast('Backup imported.', { kind: 'good' });
      } catch (e) {
        ctx.toast(`Couldn't import: ${esc(e.message)}`);
      } finally {
        el.value = '';
      }
    },
  },
};
