/** Cloud backup UI — shared by Settings and onboarding ("Restore from backup"). */
import { icon } from '../components/ui.js';
import { esc, plural } from '../utils/format.js';

export function ago(t, now = Date.now()) {
  if (!t) return 'never';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function statusLine(st) {
  switch (st.state) {
    case 'syncing': return `<span class="sync-dot sync-dot--busy"></span>Backing up…`;
    case 'ok': case 'idle': return `<span class="sync-dot sync-dot--ok"></span>Backed up ${esc(ago(st.lastSyncAt))}`;
    case 'offline': return `<span class="sync-dot sync-dot--wait"></span>Offline — changes are saved on this phone and upload when you're back online`;
    case 'error': return `<span class="sync-dot sync-dot--bad"></span>Couldn't back up: ${esc(st.error || 'unknown error')}`;
    default: return '';
  }
}

export function backupCard(ctx) {
  const { store } = ctx;
  if (!store.sync?.enabled) {
    return `<div class="card">
      <div class="row" style="gap:12px;align-items:flex-start"><span class="feature-ic">${icon.cloud}</span>
        <div class="grow"><div class="item-title">Cloud backup is off</div>
        <p class="small muted" style="margin:4px 0 0">Your workouts only live on this phone. Turn on backup to keep a copy in the cloud and move everything to a new phone. No account needed.</p></div></div>
      <div class="btn-row mt-16"><button class="btn btn--primary" data-action="bk-on">Turn on backup</button><button class="btn" data-action="bk-restore">Restore</button></div>
    </div>`;
  }
  return `<div class="card">
    <div class="row" style="gap:12px;align-items:flex-start"><span class="feature-ic feature-ic--on">${icon.cloud}</span>
      <div class="grow"><div class="item-title">Cloud backup is on</div>
      <p class="small text-2 sync-status" style="margin:4px 0 0">${statusLine(store.syncStatus)}</p></div></div>
    <div class="btn-row mt-16"><button class="btn" data-action="bk-now" ${store.syncStatus.state === 'syncing' ? 'disabled' : ''}>Back up now</button><button class="btn" data-action="bk-key">Backup key</button></div>
    <button class="link mt-12" style="padding:0" data-action="bk-off">Turn off backup on this phone</button>
  </div>`;
}

export function showKeySheet(ctx, { fresh = false } = {}) {
  const key = ctx.store.sync.key;
  ctx.sheet.open({
    title: fresh ? 'Backup is on' : 'Your backup key',
    render: () => `${fresh ? '<p class="text-2" style="margin-top:0">Everything is being uploaded now. This key unlocks your backup:</p>' : ''}
      <div class="backup-key num" aria-label="Backup key ${esc(key)}">${key.split('-').map((g) => `<span>${esc(g)}</span>`).join('<i>-</i>')}</div>
      <div class="btn-row mt-12"><button class="btn" data-action="bk-copy">${icon.copy} Copy</button>${navigator.share ? `<button class="btn" data-action="bk-share">Share…</button>` : ''}</div>
      <ul class="ul small mt-16"><li><b>Save it somewhere safe</b> — a password manager, or send it to yourself.</li>
      <li>On a new phone: open FORGE → <b>Restore from backup</b> → enter the key.</li>
      <li>Anyone with the key can see and change your FORGE data. If you lose the key <i>and</i> this phone, the backup can't be recovered.</li></ul>`,
    foot: () => `<button class="btn btn--primary btn--block" data-action="close-sheet">Done</button>`,
    actions: {
      'bk-copy': async () => {
        try { await navigator.clipboard.writeText(key); ctx.toast('Backup key copied.', { kind: 'good' }); } catch { ctx.toast('Couldn’t copy — long-press the key to select it.'); }
      },
      'bk-share': () => navigator.share?.({ title: 'FORGE backup key', text: `My FORGE backup key: ${key}` }).catch(() => {}),
    },
  });
}

export function restoreSheet(ctx, { onDone } = {}) {
  let busy = false;
  ctx.sheet.open({
    title: 'Restore from backup',
    render: () => `<p class="text-2" style="margin-top:0">Enter the backup key from your other phone (Settings → Cloud backup → Backup key).</p>
      <input class="input num" id="bk-input" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Backup key">
      <p class="small mt-8" id="bk-err" role="alert" style="color:var(--warn)"></p>
      <p class="tiny muted">Workouts on this phone are kept and merged with the backup; where both have the same item, the backup wins.</p>`,
    foot: () => `<button class="btn btn--primary btn--block" data-action="bk-go">Restore</button>`,
    actions: {
      'bk-go': async (c, el) => {
        if (busy) return;
        const val = document.getElementById('bk-input')?.value;
        const err = document.getElementById('bk-err');
        busy = true;
        el.disabled = true;
        el.textContent = 'Restoring…';
        try {
          const res = await ctx.store.connectBackup(val);
          ctx.sheet.close();
          const n = ctx.store.done.length;
          ctx.toast(`Restored — ${plural(n, 'workout')} in your history.`, { kind: 'good', ms: 3500 });
          onDone?.(res);
        } catch (e) {
          if (err) err.textContent = e instanceof TypeError || e.name === 'AbortError' ? 'No connection — connect to the internet and try again.' : e.message;
          el.disabled = false;
          el.textContent = 'Restore';
        } finally {
          busy = false;
        }
      },
    },
  });
}

export const backupActions = {
  'bk-on': async (ctx) => {
    await ctx.store.enableBackup();
    showKeySheet(ctx, { fresh: true });
  },
  'bk-restore': (ctx) => restoreSheet(ctx),
  'bk-now': (ctx) => ctx.store.syncNow(),
  'bk-key': (ctx) => showKeySheet(ctx),
  'bk-off': async (ctx) => {
    const ok = await ctx.confirm({ title: 'Turn off backup?', text: 'This phone stops syncing. The copy in the cloud stays, and you can reconnect any time with your backup key — make sure you have it saved.', confirm: 'Turn off' });
    if (ok) { await ctx.store.disableBackup(); ctx.toast('Backup turned off on this phone.'); }
  },
};
