// The world's timekeeper. pg_cron calls this every 20 seconds with the clock secret.
// Each call does whatever is due, oldest first, inside a small time budget:
// set up the world, lock fields at the entry deadline, play rounds, pay out finished events,
// run the daily refresh at midnight New York time, and close the season at the end of each month.
import {
  sb, E, settings, clockSecretOk, json, CORS, etParts, etDate, etInstant, TORDER, RIVALS, rawCo, coLift, coachRatings,
  fairPrice, fameOf, pBook, golferRow, insertGolfers, marketProspect, valueOf, canSell, saleChanceDay, cash, addNews,
  addSkill, trainOnce, fmt$, lesson,
} from '../_shared/common.ts';

const ZONE = Math.round(E.FIELD * 0.2);
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const ageOf = (y: number) => (y <= 4 ? 17 + y : y <= 20 ? Math.round(22 + (y - 5) * 1.8) : 29 + y);
const stam = (g: any) => E.clamp(5 - Math.round((g.fatigue || 0) / 20), 0, 5);
const binom = (n: number, p: number) => { let k = 0; for (let i = 0; i < n; i++) if (Math.random() < p) k++; return k; };
function shuffle<T>(a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const sumA = (a: number[]) => a.reduce((x, y) => x + y, 0);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await clockSecretOk(req))) return json({ error: 'forbidden' }, 403);
  const t0 = performance.now(), done: string[] = [];
  try {
    const s = await settings();
    await ensureWorld(s, done);
    await scheduleQuick(s, done);
    await lockDue(s, done);
    await simNext(s, done); // one round per call keeps each call well inside its time limit
    await finalizeDue(s, done);
    await dailyIfDue(s, done);
    await fillCoachRatings(done);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e), done }, 500);
  }
  return json({ ok: true, done, ms: Math.round(performance.now() - t0) });
});

// ---------- world setup ----------
function aiCoachRow(seed: number, L: number) {
  const r = E.mulberry32(E.hash('aic-' + seed)), c = r() < 0.34 ? 'US' : E.CN[Math.floor(r() * E.CN.length)], N = E.NAMES[c];
  const name = N[0][Math.floor(r() * N[0].length)] + ' ' + N[1][Math.floor(r() * N[1].length)];
  const best = ['p1', 'p1', 'p2', 'c1', 'p2', 'p3', 'p1', 'c2'][Math.floor(r() * 8)];
  const peak = Math.round(({ p1: 78, c1: 74, p2: 73, c2: 69, p3: 68 } as any)[best] + E.gaussR(r) * 4);
  const wins = Math.round(({ p1: 4, c1: 5, p2: 3, c2: 3, p3: 2 } as any)[best] * r() * r() * 3), titles = r() < 0.2 ? 1 + Math.floor(r() * 2) : 0;
  const raw = rawCo('ai' + seed), co = coLift(raw, peak), price = Math.max(250, Math.round(fairPrice(co, { wins, titles, best }) * (0.75 + r() * 0.6) / 50) * 50);
  const given = Math.floor(r() * 400), sk = E.rollProspect(peak).sk;
  return {
    row: golferRow({ name, country: c, sk, tour: best, yr: 30 }, {
      stable: RIVALS[Math.floor(r() * RIVALS.length)], retired: true, career: false, ret_age: 48 + Math.floor(r() * 24), best: peak, sessions: 0,
      stats: { ev: 0, cuts: 0, wins, top10: 0, earn: Math.round(E.TOURS[best].purse * (0.05 + r() * 0.4) * (4 + r() * 14) / 1000) * 1000, rounds: 0, par: 0, low: null },
      trophies: Array.from({ length: titles }, (_, i) => ({ s: i + 1, n: E.TOURS[best].name + ' season title', t: best, title: true })),
      cr: { price, left: L, earn: Math.round(given * price * 0.8), given, own: 0, last: null, o: co },
    }),
    sec: { ce: sk, peak: 1, agg: 0, co: raw },
  };
}
async function fixedPools(season: number, tours: string[]) {
  const rows: any[] = [], secs: any[] = [];
  for (const tour of tours) {
    const col = E.isCol(tour);
    for (const a of E.pool(tour, season)) {
      rows.push(golferRow({ ...a, tour, yr: col ? a.yr : 10 }, { stable: null, career: false, pool_season: col ? season : null, fatigue: 0, sessions: 0 }));
      secs.push({ ce: a.sk, peak: a.peak, agg: a.agg });
    }
  }
  await insertGolfers(rows, secs);
}
async function ensureWorld(s: any, done: string[]) {
  const { data: w } = await sb.from('world').select('*').maybeSingle();
  if (w) return w;
  const p = etParts(), start = etDate(), end = iso(p.y, p.m, lastDay(p.y, p.m));
  const { data: claimed, error } = await sb.from('world').insert({ season: 1, season_start: start, season_end: end, meta: { setting_up: true } }).select('id');
  if (error || !claimed?.length) return null; // another call is setting up
  await fixedPools(1, TORDER);
  const coaches = Array.from({ length: 14 }, () => aiCoachRow(Math.floor(Math.random() * 1e9), s.lessons_per_day));
  await insertGolfers(coaches.map((c) => c.row), coaches.map((c) => c.sec));
  await scheduleSeason(s, 1, start, end);
  await sb.from('world').update({ meta: {} }).eq('id', 1);
  done.push('world created');
  return null;
}

// ---------- the calendar ----------
// About `events_per_season` events per tour per calendar month, on weekday evenings (New York time).
// A part-month season (the first one) gets proportionally fewer.
async function scheduleSeason(s: any, season: number, start: string, end: string) {
  const days: { y: number; m: number; d: number }[] = [];
  for (let t = Date.parse(start + 'T12:00:00Z'); t <= Date.parse(end + 'T12:00:00Z'); t += 864e5) {
    const d = new Date(t), wd = d.getUTCDay();
    if (wd >= 1 && wd <= 5) days.push({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
  }
  if (!days.length) return;
  const p = days[0];
  let W = 0; for (let d = 1; d <= lastDay(p.y, p.m); d++) { const wd = new Date(Date.UTC(p.y, p.m - 1, d)).getUTCDay(); if (wd >= 1 && wd <= 5) W++; }
  const n = E.clamp(Math.round(s.events_per_season * days.length / W), Math.min(3, days.length), s.events_per_season);
  const hours: number[] = s.hours, cutoff = Date.now() + (s.deadline_min + 10) * 60e3, rows: any[] = [];
  TORDER.forEach((tour, ti) => {
    const cal = E.calendar(tour, season), picks = cal.slice(0, n - 1).concat([cal[cal.length - 1]]);
    picks.forEach((c: any, k: number) => {
      const di = Math.min(days.length - 1, Math.floor((k + (ti % 4) / 4) * days.length / n)), dd = days[di];
      const at = etInstant(dd.y, dd.m, dd.d, hours[(ti + k) % hours.length]);
      if (at.getTime() < cutoff) return;
      rows.push({ tour, season, week: k + 1, name: c.name, ci: c.ci, type: c.type, purse: Math.round(c.purse * s.purse_mult), fee: Math.round(c.fee * s.fee_mult), pm: c.pm, starts_at: at.toISOString(), round_min: s.round_min });
    });
  });
  if (rows.length) { const { error } = await sb.from('events').insert(rows); if (error) throw new Error('schedule: ' + error.message); }
}

// ---------- Quick-Fire Opens ----------
// A two-round, no-cut event every `qf_every_min` minutes, all day. Open to any golfer, entered by hand only.
// One Quick-Fire Open per level, all teeing off together: college (all three conferences), then each pro and senior tour.
// Their tour is written 'qf:<level>', e.g. 'qf:col' or 'qf:p1'.
const QT = ['col', 'p3', 'p2', 'p1', 'c2', 'c1'];
const isQ = (tour: string) => String(tour).startsWith('qf');
const qLevel = (tour: string) => String(tour).split(':')[1] || '';
async function scheduleQuick(s: any, done: string[]) {
  if (!s.qf_on) return;
  const step = s.qf_every_min * 60e3, first = Math.ceil((Date.now() + (s.deadline_min + 1) * 60e3) / step) * step;
  const want = [0, 1, 2].map((k) => new Date(first + k * step).toISOString());
  const { data: have } = await sb.from('events').select('tour,starts_at').like('tour', 'qf:%').gte('starts_at', want[0]);
  const got = new Set((have || []).map((e: any) => e.tour + '|' + new Date(e.starts_at).toISOString()));
  const { data: w } = await sb.from('world').select('season').maybeSingle();
  const rows = want.flatMap((at) => QT.map((lv) => ({ lv, at }))).filter(({ lv, at }) => !got.has('qf:' + lv + '|' + at)).map(({ lv, at }) => ({
    tour: 'qf:' + lv, season: w?.season || 1, week: 0, name: 'Quick-Fire Open', ci: Math.floor(Math.random() * E.COURSES.length), type: 'Quick-Fire',
    purse: s.qf_base, fee: s.qf_fee, pm: 0, starts_at: at, round_min: s.round_min, rounds: 2,
  }));
  if (rows.length) { await sb.from('events').upsert(rows, { onConflict: 'tour,starts_at', ignoreDuplicates: true }); done.push(`scheduled ${rows.length} Quick-Fire`); }
}
async function lockQuick(ev: any, s: any, done: string[]) {
  const { data: ents } = await sb.from('entries').select('golfer_id').eq('event_id', ev.id).eq('status', 'in');
  const ids = (ents || []).map((e: any) => e.golfer_id);
  if (!ids.length) { await sb.from('events').delete().eq('id', ev.id); done.push('Quick-Fire skipped: nobody entered'); return; }
  const { data: w } = await sb.from('world').select('season').single();
  // the rest of the field: regulars from this level
  const lv = qLevel(ev.tour), tours = lv === 'col' ? ['col0', 'col1', 'col2'] : [lv];
  const { data: pool } = await sb.from('golfers').select('id,tour,pool_season').in('tour', tours).eq('career', false).eq('retired', false).is('manager_id', null);
  const reg = shuffle((pool || []).filter((g: any) => !E.isCol(g.tour) || g.pool_season === w!.season));
  const fl = ids.map((id: string) => ({ id, managed: true })).concat(reg.slice(0, Math.max(0, E.FIELD - ids.length)).map((g: any) => ({ id: g.id, managed: false })));
  const rs = new Map<string, number>();
  for (let i = 0; i < fl.length; i += 60) {
    const { data: gs } = await sb.from('golfers').select('id,sk,eq,conf,fatigue').in('id', fl.slice(i, i + 60).map((f) => f.id));
    for (const g of gs || []) rs.set(g.id, E.ratingFor(g, ev.ci));
  }
  const probs = E.winProbs(fl.map((f) => ({ r: rs.get(f.id) ?? 60, cur: 0, H: 36 })), 4000);
  const { error } = await sb.from('event_players').insert(fl.map((f, i) => ({ event_id: ev.id, golfer_id: f.id, managed: f.managed, slot0: Math.floor(Math.random() * 3), odds0: probs[i] })));
  if (error) throw new Error('quick field: ' + error.message);
  const purse = s.qf_base + s.qf_add * ids.length;
  await sb.from('events').update({ field: fl.length, purse }).eq('id', ev.id);
  done.push(`locked Quick-Fire: ${ids.length} entered, pot ${purse}`);
}
// Greens in regulation, the longest drive and aces, read from one hole's shots.
function holeExtras(res: any, par: number) {
  let n = 0, reached = 99, drive = 0;
  for (let i = 0; i < res.shots.length; i++) {
    const x = res.shots[i]; if (x.k === 'pick') continue;
    if (x.k === 'putt') { reached = n; break; }
    n++;
    if (x.holed) { reached = n; break; }
  }
  const t0 = res.shots[0];
  if (par >= 4 && t0 && t0.k === 'full' && !(res.shots[1] && res.shots[1].k === 'drop')) drive = Math.round(Math.hypot(t0.to[0] - t0.from[0], t0.to[1] - t0.from[1]));
  return { gir: reached <= par - 2 ? 1 : 0, drive, ace: res.score === 1 ? 1 : 0 };
}

// ---------- events ----------
async function lockDue(s: any, done: string[]) {
  const cutoff = new Date(Date.now() + s.deadline_min * 60e3).toISOString();
  const { data: evs } = await sb.from('events').select('*').eq('status', 'open').lte('starts_at', cutoff).order('starts_at').limit(3);
  for (const ev of evs || []) await (isQ(ev.tour) ? lockEventQ(ev, s, done) : lockEvent(ev, done));
}
async function lockEventQ(ev: any, s: any, done: string[]) {
  const { data: claimed } = await sb.from('events').update({ status: 'locked' }).eq('id', ev.id).eq('status', 'open').select('id');
  if (claimed?.length) await lockQuick(ev, s, done);
}
async function lockEvent(ev: any, done: string[]) {
  const { data: claimed } = await sb.from('events').update({ status: 'locked' }).eq('id', ev.id).eq('status', 'open').select('id');
  if (!claimed?.length) return;
  const { data: w } = await sb.from('world').select('season').single();
  const col = E.isCol(ev.tour), news: Record<string, string[]> = {};
  const { data: mine } = await sb.from('golfers').select('id,manager_id,name,enter_rule').eq('tour', ev.tour).eq('retired', false).not('manager_id', 'is', null);
  const { data: ents } = await sb.from('entries').select('golfer_id,status').eq('event_id', ev.id);
  const st = new Map((ents || []).map((e: any) => [e.golfer_id, e.status]));
  const field: { id: string; managed: boolean }[] = [];
  for (const g of mine || []) {
    const e = st.get(g.id);
    let inn = e === 'in' || (!e && (ev.test || g.enter_rule === 'all' || (g.enter_rule === 'signature' && ['Signature', 'Finale'].includes(ev.type))));
    if (inn && !e) {
      const fee = ev.test ? 0 : ev.fee;
      try {
        if (fee > 0) await cash(g.manager_id, -fee, 'entry', `Entry: ${ev.name}`, false);
        await sb.from('entries').insert({ event_id: ev.id, golfer_id: g.id, manager_id: g.manager_id, fee });
      } catch {
        inn = false;
        (news[g.manager_id] ??= []).push(`${g.name} missed the ${ev.name}: not enough money for the ${fmt$(ev.fee)} entry fee.`);
      }
    }
    if (inn) field.push({ id: g.id, managed: true });
  }
  const { data: car } = await sb.from('golfers').select('id').eq('tour', ev.tour).eq('retired', false).is('manager_id', null).eq('career', true);
  for (const g of shuffle(car || [])) if (field.length < E.FIELD) field.push({ id: g.id, managed: false });
  let q = sb.from('golfers').select('id').eq('tour', ev.tour).eq('career', false).eq('retired', false);
  q = col ? q.eq('pool_season', w!.season) : q.is('pool_season', null);
  const { data: pool } = await q;
  for (const g of shuffle(pool || [])) { if (field.length >= E.FIELD) break; field.push({ id: g.id, managed: false }); }
  const fl = field.slice(0, E.FIELD);
  // starting odds, worked out once so everyone sees the same numbers
  const odds0 = new Map<string, number>();
  for (let i = 0; i < fl.length; i += 60) {
    const { data: gs } = await sb.from('golfers').select('id,sk,eq,conf,fatigue').in('id', fl.slice(i, i + 60).map((f) => f.id));
    for (const g of gs || []) odds0.set(g.id, E.ratingFor(g, ev.ci));
  }
  const ids = fl.map((f) => f.id), probs = E.winProbs(ids.map((id) => ({ r: odds0.get(id) ?? 60, cur: 0, H: 72 })), 4000);
  const rows = fl.map((f, i) => ({ event_id: ev.id, golfer_id: f.id, managed: f.managed, slot0: Math.floor(Math.random() * 3), odds0: probs[i] }));
  const { error } = await sb.from('event_players').insert(rows);
  if (error) throw new Error('field: ' + error.message);
  await sb.from('events').update({ field: rows.length }).eq('id', ev.id);
  for (const mid in news) await addNews(mid, news[mid]);
  done.push(`locked ${ev.name}: ${rows.length} golfers, ${field.filter((f) => f.managed).length} managed`);
}
async function loadField(ev: any) {
  const { data: eps } = await sb.from('event_players').select('*').eq('event_id', ev.id);
  const ids = (eps || []).map((e: any) => e.golfer_id);
  const { data: gs } = await sb.from('golfers').select('id,name,manager_id,sk,eq,fatigue,conf,carry,tour,yr,best,stats,hist,trophies,s_pts,career').in('id', ids);
  const { data: secs } = await sb.from('golfer_secrets').select('golfer_id,peak,agg,ce').in('golfer_id', ids);
  const gm = new Map((gs || []).map((g: any) => [g.id, g])), sm = new Map((secs || []).map((x: any) => [x.golfer_id, x]));
  return (eps || []).map((ep: any) => { const g: any = { ...gm.get(ep.golfer_id) }, x: any = sm.get(ep.golfer_id) || {}; g.peak = x.peak ?? 1; g.agg = x.agg ?? 0; g.ce = x.ce; return { ep, g }; });
}
async function simNext(s: any, done: string[]) {
  const { data: evs } = await sb.from('events').select('*').eq('status', 'locked').order('starts_at').limit(8);
  const ev = (evs || []).find((e: any) => e.rounds_done < (e.rounds || 4)); if (!ev) return false;
  await simRound(ev); done.push(`played ${ev.name} round ${ev.rounds_done + 1}`); return true;
}
const r1 = (v: number) => Math.round(v * 10) / 10;
async function simRound(ev: any) {
  const r = ev.rounds_done, F = await loadField(ev);
  const eng: any = {
    ci: ev.ci, course: E.COURSES[ev.ci], round: r, hole: 0, cutLine: ev.cut_line, noCut: isQ(ev.tour), last: (ev.rounds || 4) - 1,
    players: F.map(({ ep, g }: any) => ({ g, ep, managed: ep.managed, evPar: ep.ev_par, rounds: [], cut: ep.cut, weekForm: ep.week_form, slot0: ep.slot0, slot: ep.slot ?? undefined, st: r ? { mood: ep.mood } : undefined })),
  };
  if (r === 0) eng.players.forEach((p: any) => (p.weekForm = E.gauss() * (6 - p.g.sk.mental * 0.035) * 0.9));
  E.beginRound(eng);
  const act = eng.players.filter((p: any) => !p.cut), card = new Map<any, number[]>(act.map((p: any) => [p, [] as number[]])), shots: any[] = [];
  const quick = isQ(ev.tour), ext = new Map<any, any>(eng.players.map((p: any) => [p, { gir: 0, drive: 0, aces: 0, ...(p.ep.extra || {}) }]));
  for (let h = 0; h < E.HOLES; h++) {
    eng.hole = h;
    const out = E.simHole(eng);
    for (const [p, res] of out as Map<any, any>) {
      card.get(p)!.push(res.score);
      if (quick) { const x = holeExtras(res, eng.course.holes[h].par), o = ext.get(p); o.gir += x.gir; o.aces += x.ace; o.drive = Math.max(o.drive, x.drive); }
      if (p.managed) shots.push({
        event_id: ev.id, golfer_id: p.g.id, round: r, hole: h, mood: r1(p.st.mood), run: p.st.run,
        shots: res.shots.map((x: any) => ({ k: x.k, from: x.from.map(r1), to: x.to.map(r1), text: x.text, holed: !!x.holed })),
      });
    }
  }
  eng.hole = E.HOLES;
  E.endRound(eng);
  const rows = eng.players.map((p: any) => ({
    event_id: ev.id, golfer_id: p.g.id, managed: p.managed, slot0: p.slot0, slot: p.slot ?? null, week_form: p.weekForm,
    mood: p.st ? p.st.mood : p.ep.mood, ev_par: p.evPar, cut: p.cut,
    scores: card.has(p) ? (p.ep.scores || []).concat([card.get(p)]) : p.ep.scores,
    ...(quick ? { extra: ext.get(p) } : {}),
  }));
  const { error } = await sb.from('event_players').upsert(rows);
  if (error) throw new Error('round save: ' + error.message);
  for (let i = 0; i < shots.length; i += 500) await sb.from('event_shots').upsert(shots.slice(i, i + 500));
  await sb.from('events').update({ rounds_done: r + 1, cut_line: r === 1 ? eng.cutLine : ev.cut_line, meta: { ...ev.meta, wind: [...(ev.meta?.wind || []), eng.wind] } }).eq('id', ev.id);
}
async function finalizeDue(s: any, done: string[]) {
  const { data: evs } = await sb.from('events').select('*').eq('status', 'locked').lte('starts_at', new Date().toISOString()).order('starts_at').limit(10);
  const due = (evs || []).filter((ev: any) => ev.rounds_done >= (ev.rounds || 4) && Date.parse(ev.starts_at) + (ev.rounds || 4) * Number(ev.round_min || s.round_min) * 60e3 <= Date.now()).slice(0, 2);
  for (const ev of due) await (isQ(ev.tour) ? finalizeQuick(ev, s, done) : finalize(ev, s, done));
}
async function finalize(ev: any, s: any, done: string[]) {
  const { data: claimed } = await sb.from('events').update({ status: 'final' }).eq('id', ev.id).eq('status', 'locked').select('id');
  if (!claimed?.length) return;
  const F = await loadField(ev), pars = E.COURSES[ev.ci].holes.map((h: any) => h.par);
  const eng: any = { ci: ev.ci, course: E.COURSES[ev.ci], round: 3, hole: 0, cutLine: ev.cut_line, wind: (ev.meta?.wind || []).at(-1) || { mph: 8, dir: 0 } };
  eng.players = F.map(({ ep, g }: any) => {
    const p: any = { g, ep, managed: ep.managed, evPar: ep.ev_par, rounds: (ep.scores || []).map(sumA), cut: ep.cut, weekForm: ep.week_form, slot: ep.slot ?? 1 };
    p.st = E.initState(g, p.slot, (ep.mood || 0) * 0.3, ep.week_form);
    return p;
  });
  E.finishEvent(eng);
  for (const p of eng.players) { p.fpts = Math.round((p.pts || 0) * ev.pm * 10) / 10; p.pay = Math.round((p.payf || 0) * ev.purse); }
  await sb.from('event_players').upsert(eng.players.map((p: any) => ({ event_id: ev.id, golfer_id: p.g.id, pos: p.pos, pos_n: p.posN, pts: p.fpts, pay: p.pay, won: !!p.won })));
  if (!ev.test) {
    const ids = eng.players.filter((p: any) => p.fpts || p.won || p.pay).map((p: any) => p.g.id);
    const { data: old } = await sb.from('standings').select('*').eq('tour', ev.tour).eq('season', ev.season).in('golfer_id', ids);
    const om = new Map((old || []).map((x: any) => [x.golfer_id, x]));
    const st = eng.players.filter((p: any) => ids.includes(p.g.id)).map((p: any) => {
      const o: any = om.get(p.g.id) || { pts: 0, wins: 0, earn: 0 };
      return { tour: ev.tour, season: ev.season, golfer_id: p.g.id, pts: r1(o.pts + p.fpts), wins: o.wins + (p.won ? 1 : 0), earn: o.earn + p.pay };
    });
    if (st.length) await sb.from('standings').upsert(st);
  }
  const win = eng.order[0], news: Record<string, string[]> = {};
  for (const p of eng.players) {
    const g = p.g; if (!g.manager_id) continue;
    const say = (t: string) => (news[g.manager_id] ??= []).push(t);
    const line = `${g.name} ${p.won ? 'won' : p.cut ? 'missed the cut at' : 'finished ' + p.pos + ' at'} the ${ev.name}${ev.test ? ' (test event)' : ''}${p.pay && !ev.test ? `: ${fmt$(p.pay)}` : ''}.`;
    if (ev.test) { say(line); continue; }
    const S = { ev: 0, cuts: 0, wins: 0, top10: 0, earn: 0, rounds: 0, par: 0, low: null as number | null, ...(g.stats || {}) };
    S.ev++; if (!p.cut) S.cuts++; S.earn += p.pay;
    (p.ep.scores || []).forEach((sc: number[]) => { if (sc.length === 18) { const tp = sumA(sc) - sumA(pars); S.rounds++; S.par += tp; if (S.low === null || tp < S.low) S.low = tp; } });
    const trophies = g.trophies || [], ce = g.ce;
    if (p.won) { S.wins++; S.top10++; trophies.push({ s: ev.season, n: ev.name, t: ev.tour }); addSkill(g, ce, 'clutch', 0.8); addSkill(g, ce, 'mental', 0.5); addSkill(g, ce, 'momentum', 0.5); g.conf = 2.5; }
    else if (p.posN <= 10) { S.top10++; addSkill(g, ce, 'momentum', 0.4); addSkill(g, ce, 'mental', 0.2); g.conf = 1.5; }
    else if (p.cut) { addSkill(g, ce, 'mental', -0.3); addSkill(g, ce, 'momentum', -0.2); g.conf = -1.5; }
    else g.conf = p.posN <= 25 ? 0.5 : 0;
    const hist = [{ s: g.yr, gs: ev.season, n: ev.name, t: ev.tour, r: p.rounds, par: p.evPar, pos: p.pos, pts: p.fpts, pay: p.pay, eid: ev.id }].concat(g.hist || []).slice(0, 40);
    await sb.from('golfers').update({
      sk: g.sk, stats: S, hist, trophies, conf: g.conf, carry: p.won ? 0.3 : p.posN <= 10 ? 0.15 : p.cut ? -0.15 : 0,
      fatigue: Math.min(100, (g.fatigue || 0) + s.event_fatigue), best: Math.max(g.best || 0, E.ovr(g.sk)), s_pts: r1((g.s_pts || 0) + p.fpts),
    }).eq('id', g.id);
    if (p.pay > 0) await cash(g.manager_id, p.pay, 'prize', `${g.name}: ${p.pos} at the ${ev.name}`);
    say(line);
  }
  for (const mid in news) await addNews(mid, news[mid]);
  done.push(`final ${ev.name}: won by ${win?.g?.name}`);
}

// A Quick-Fire Open pays the top third of the field, plus bonuses. No points, no stamina, no effect on skills or career records.
async function finalizeQuick(ev: any, s: any, done: string[]) {
  const { data: claimed } = await sb.from('events').update({ status: 'final' }).eq('id', ev.id).eq('status', 'locked').select('id');
  if (!claimed?.length) return;
  const F = await loadField(ev), last = (ev.rounds || 2) - 1;
  const paid = Math.max(1, Math.floor(F.length / 3)), base = E.PAYF.slice(0, paid), tot = sumA(base);
  const eng: any = { ci: ev.ci, course: E.COURSES[ev.ci], round: last, last, noCut: true, hole: 0, wind: (ev.meta?.wind || []).at(-1) || { mph: 8, dir: 0 }, payf: base.map((x: number) => x / tot).concat(Array(F.length).fill(0)) };
  eng.players = F.map(({ ep, g }: any) => {
    const p: any = { g, ep, managed: ep.managed, evPar: ep.ev_par, rounds: (ep.scores || []).map(sumA), cut: false, weekForm: ep.week_form, slot: ep.slot ?? 1, x: ep.extra || { gir: 0, drive: 0, aces: 0 } };
    p.st = E.initState(g, p.slot, (ep.mood || 0) * 0.3, ep.week_form);
    return p;
  });
  E.finishEvent(eng);
  // bonuses: most greens in regulation and the longest drive (ties share), and every ace
  const top = (k: string) => { const m = Math.max(...eng.players.map((p: any) => p.x[k] || 0)); return m > 0 ? eng.players.filter((p: any) => (p.x[k] || 0) === m) : []; };
  const gw = top('gir'), dw = top('drive'), bonus = new Map<any, string[]>();
  for (const p of eng.players) { p.pay = Math.round((p.payf || 0) * ev.purse); p.bon = 0; }
  const give = (p: any, amt: number, why: string) => { p.bon += amt; (bonus.get(p) || bonus.set(p, []).get(p))!.push(why); };
  gw.forEach((p: any) => give(p, Math.round(s.qf_bonus / gw.length), `most greens hit (${p.x.gir})`));
  dw.forEach((p: any) => give(p, Math.round(s.qf_bonus / dw.length), `long drive (${p.x.drive} yards)`));
  eng.players.forEach((p: any) => { if (p.x.aces) give(p, s.qf_ace * p.x.aces, p.x.aces > 1 ? `${p.x.aces} holes in one` : 'a hole in one'); });
  await sb.from('event_players').upsert(eng.players.map((p: any) => ({ event_id: ev.id, golfer_id: p.g.id, pos: p.pos, pos_n: p.posN, pts: 0, pay: p.pay + p.bon, won: !!p.won, extra: { ...p.x, prize: p.pay, bonus: p.bon, why: bonus.get(p) || [] } })));
  await sb.from('events').update({ meta: { ...ev.meta, bonus: { gir: gw.map((p: any) => p.g.id), drive: dw.map((p: any) => p.g.id), aces: eng.players.filter((p: any) => p.x.aces).map((p: any) => p.g.id) } } }).eq('id', ev.id);
  const news: Record<string, string[]> = {};
  for (const p of eng.players) {
    const g = p.g; if (!g.manager_id) continue;
    const total = p.pay + p.bon, why = bonus.get(p);
    if (total > 0) await cash(g.manager_id, total, 'prize', `${g.name}: ${p.pos} at the Quick-Fire Open${p.bon ? ' plus bonuses' : ''}`);
    const S = { ...(g.stats || {}) }; S.qf_ev = (S.qf_ev || 0) + 1; S.qf_wins = (S.qf_wins || 0) + (p.won ? 1 : 0); S.qf_earn = (S.qf_earn || 0) + total; S.qf_aces = (S.qf_aces || 0) + (p.x.aces || 0);
    await sb.from('golfers').update({ stats: S }).eq('id', g.id);
    (news[g.manager_id] ??= []).push(`${g.name} ${p.won ? 'won' : 'finished ' + p.pos + ' in'} the Quick-Fire Open${total ? `: ${fmt$(total)}` : ''}.${why ? ` Bonus for ${why.join(' and ')}.` : ''}`);
  }
  for (const mid in news) await addNews(mid, news[mid]);
  done.push(`final Quick-Fire: won by ${eng.order[0]?.g?.name}`);
}

// Coaching ratings are public once a golfer coaches; keep a copy on the coaching record.
async function fillCoachRatings(done: string[]) {
  const { data: cs } = await sb.from('golfers').select('id,sk,best,cr').eq('retired', true).not('cr', 'is', null).is('cr->o', null).limit(40);
  if (!cs?.length) return;
  const { data: sec } = await sb.from('golfer_secrets').select('golfer_id,co').in('golfer_id', cs.map((c: any) => c.id));
  const m = new Map((sec || []).map((x: any) => [x.golfer_id, x.co]));
  for (const c of cs) await sb.from('golfers').update({ cr: { ...c.cr, o: coachRatings(c, m.get(c.id) || rawCo(c.id)) } }).eq('id', c.id);
  done.push(`coach ratings for ${cs.length}`);
}

// ---------- the daily refresh ----------
async function dailyIfDue(s: any, done: string[]) {
  const { data: w } = await sb.from('world').select('*').single();
  if (!w || w.meta?.setting_up) return;
  const today = etDate();
  if (w.last_daily === today) return;
  const { data: cl } = await sb.from('world').update({ last_daily: today }).eq('id', 1).or(`last_daily.is.null,last_daily.neq.${today}`).select('id');
  if (!cl?.length) return;
  if (today > w.season_end) await rollover(w, s, done);
  await dailyRefresh(s, done);
}
function weakest(g: any) { return 'smlx'.split('').sort((a, b) => E.um(g.sk, a) - E.um(g.sk, b))[0]; }
async function dailyRefresh(s: any, done: string[]) {
  const news: Record<string, string[]> = {};
  const say = (mid: string, t: string) => (news[mid] ??= []).push(t);
  // your golfers: standing orders spend any unused session, then everything refreshes
  const { data: gs } = await sb.from('golfers').select('*').not('manager_id', 'is', null).eq('retired', false);
  const ids = (gs || []).map((g: any) => g.id);
  const { data: secs } = ids.length ? await sb.from('golfer_secrets').select('golfer_id,ce').in('golfer_id', ids) : { data: [] };
  const cem = new Map((secs || []).map((x: any) => [x.golfer_id, x.ce]));
  for (const g of gs || []) {
    const ce = cem.get(g.id);
    if (g.orders && g.sessions > 0 && ce) {
      for (let i = 0; i < g.sessions; i++) {
        const o = g.orders, what = o.rest_below && stam(g) < o.rest_below ? 'rest' : o.focus === 'auto' || !o.focus ? weakest(g) : o.focus;
        const L = await lesson(g, what, s);
        if (L.clear) g.coach_id = null;
        const msg = trainOnce(g, ce, what, L.cm, s);
        if (o.report) say(g.manager_id, `${g.name}'s standing orders: ${msg}${L.note}`);
      }
    }
    for (const u of 'sml') if (!g.trained?.[u]) for (const k of E.SUB[u]) g.sk[k] = Math.max(20, g.sk[k] - s.rust_per_day);
    await sb.from('golfers').update({ sk: g.sk, trained: {}, sessions: s.sessions_per_day, fatigue: Math.max(0, g.fatigue - s.recovery_per_day), carry: g.carry, coach_id: g.coach_id }).eq('id', g.id);
  }
  // coaches: rival managers book what's left of each coach's day
  const { data: cs } = await sb.from('golfers').select('id,name,manager_id,sk,best,stats,trophies,seasons,tour,cr,stable').eq('retired', true).not('cr', 'is', null);
  const cids = (cs || []).map((c: any) => c.id);
  const { data: csec } = cids.length ? await sb.from('golfer_secrets').select('golfer_id,co').in('golfer_id', cids) : { data: [] };
  const com = new Map((csec || []).map((x: any) => [x.golfer_id, x.co]));
  const L = s.lessons_per_day;
  for (const c of cs || []) {
    const o = coachRatings(c, com.get(c.id) || rawCo(c.id)), cr = { ...c.cr, o }, fair = fairPrice(o, fameOf(c));
    if (c.manager_id) {
      const n = binom(Math.max(0, cr.left), pBook(cr.price / fair)), inc = n * cr.price;
      if (inc) await cash(c.manager_id, inc, 'coaching', `${c.name}: ${n} lesson${n === 1 ? '' : 's'} for rival managers`);
      cr.earn = (cr.earn || 0) + inc; cr.given = (cr.given || 0) + n; cr.last = n; cr.left = L;
      say(c.manager_id, n ? `${c.name} gave ${n} lesson${n === 1 ? '' : 's'} to rival managers' golfers and earned ${fmt$(inc)}.` : `Nobody booked ${c.name} at ${fmt$(cr.price)} a lesson.`);
    } else {
      const n = binom(Math.max(0, cr.left), pBook(cr.price / fair) * 0.85);
      cr.given = (cr.given || 0) + n; cr.earn = (cr.earn || 0) + n * cr.price;
      if (cr.left - n <= 0) cr.price = Math.round(cr.price * 1.08 / 50) * 50; else if (n === 0) cr.price = Math.max(250, Math.round(cr.price * 0.95 / 50) * 50);
      cr.left = L - binom(L, pBook(cr.price / fair) * 0.45);
    }
    await sb.from('golfers').update({ cr }).eq('id', c.id);
  }
  // the transfer market: rival coaches buy listed golfers, and list a few of their own
  const { data: listed } = await sb.from('golfers').select('id,name,manager_id,sk,yr,ask,tour').not('manager_id', 'is', null).not('ask', 'is', null).eq('retired', false);
  for (const g of listed || []) {
    const val = valueOf(g.sk, g.yr);
    if (canSell(g) && Math.random() < saleChanceDay(g.ask, val, s.sale_chance_mult)) {
      const rival = E.pick(RIVALS);
      await cash(g.manager_id, g.ask, 'transfer', `Sold ${g.name} to ${rival}`);
      await sb.from('golfers').update({ manager_id: null, stable: rival, ask: null, listed_at: null, coach_id: null, career: true, orders: null }).eq('id', g.id);
      say(g.manager_id, `${rival} met your price: ${g.name} is sold for ${fmt$(g.ask)}. He stays on the ${E.TOURS[g.tour].name}, so you'll still see him in the field.`);
    } else if (g.ask > val * 1.45) say(g.manager_id, `No coach will go near ${fmt$(g.ask)} for ${g.name}. The market has him at ${fmt$(val)}.`);
  }
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  await sb.from('golfers').update({ ask: null, listed_at: null }).is('manager_id', null).not('ask', 'is', null).lt('listed_at', week);
  const { count } = await sb.from('golfers').select('id', { count: 'exact', head: true }).is('manager_id', null).not('ask', 'is', null).eq('retired', false);
  const want = Math.max(0, 6 - (count || 0)), kinds = [['col', 3, 63], ['p3', 6, 67], ['p2', 8, 72], ['p1', 9, 77]];
  if (want) {
    const rows: any[] = [], sx: any[] = [];
    for (let i = 0; i < want; i++) {
      const [t, yr, mu] = kinds[Math.floor(Math.random() * kinds.length)] as [string, number, number];
      const tour = t === 'col' ? 'col' + Math.floor(Math.random() * 3) : t, m = marketProspect(tour, yr, mu);
      const ask = Math.round(valueOf(m.p.sk, yr) * (0.85 + Math.random() * 0.45) / 500) * 500;
      rows.push(golferRow({ ...m, arch: m.p.arch, sk: m.p.sk }, { stable: E.pick(RIVALS), career: true, ask, listed_at: new Date().toISOString(), color: Math.floor(Math.random() * 6) }));
      sx.push({ ce: m.p.ce, peak: m.p.peak, agg: m.p.agg });
    }
    await insertGolfers(rows, sx);
  }
  for (const mid in news) await addNews(mid, news[mid]);
  done.push(`daily refresh: ${(gs || []).length} golfers, ${(cs || []).length} coaches`);
}

// ---------- the end of a season ----------
async function rollover(w: any, s: any, done: string[]) {
  const season = w.season, news: Record<string, string[]> = {};
  const say = (mid: string, t: string) => (news[mid] ??= []).push(t);
  const moves: any[] = [];
  for (const tour of TORDER) {
    const col = E.isCol(tour), T = E.TOURS[tour];
    const { data: st } = await sb.from('standings').select('golfer_id,pts,wins,earn').eq('tour', tour).eq('season', season);
    const sm = new Map((st || []).map((x: any) => [x.golfer_id, x]));
    const { data: car } = await sb.from('golfers').select('*').eq('tour', tour).eq('retired', false).eq('career', true);
    let pq = sb.from('golfers').select('id,sk').eq('tour', tour).eq('career', false).eq('retired', false);
    pq = col ? pq.eq('pool_season', season) : pq.is('pool_season', null);
    const { data: pool } = await pq;
    const all: any[] = [...(car || []), ...(pool || [])].map((g: any) => ({ g, pts: sm.get(g.id)?.pts || 0, wins: sm.get(g.id)?.wins || 0, earn: sm.get(g.id)?.earn || 0 }));
    all.sort((a, b) => b.pts - a.pts || E.ovr(b.g.sk) - E.ovr(a.g.sk));
    all.forEach((x, i) => (x.rank = i + 1));
    for (const x of all) {
      const g = x.g; if (!g.career) continue;
      const rank = x.rank, y = g.yr, top = rank <= ZONE, bot = rank > all.length - ZONE;
      let next = tour, note = '', retire = false;
      if (y === 4) { next = top ? 'p2' : 'p3'; note = `He turns professional on the ${E.TOURS[next].name}.`; }
      else if (y === 20) { next = tour === 'p1' || (tour === 'p2' && top) ? 'c1' : 'c2'; note = `He moves to the senior game on the ${E.TOURS[next].name}.`; }
      else if (y >= 30) { retire = true; note = 'That was his 30th and final season. He retires and opens a coaching practice.'; }
      else if (col) note = `He comes back for his ${E.CLASS[y].toLowerCase()} year.`;
      else if (top && E.UP[tour]) { next = E.UP[tour]; note = `Promoted to the ${E.TOURS[next].name}.`; }
      else if (bot && E.DOWN[tour]) { next = E.DOWN[tour]; note = `Relegated to the ${E.TOURS[next].name}.`; }
      else note = `He stays on the ${T.name}.`;
      const bonus = g.manager_id ? Math.round(T.purse * s.purse_mult * (rank === 1 ? 0.5 : rank <= 5 ? 0.2 : rank <= 10 ? 0.1 : top ? 0.04 : 0)) : 0;
      const trophies = g.trophies || [];
      if (rank === 1 && x.pts > 0) trophies.push({ s: season, n: T.name + ' season title', t: tour, title: true });
      const seasons = (g.seasons || []).concat([{ s: y, gs: season, tour, rank, pts: x.pts, wins: x.wins, earn: x.earn + bonus }]);
      if (!retire && y >= 15) { const k = y >= 20 ? 1 : 0.5; g.sk.pow = Math.max(20, g.sk.pow - 0.8 * k); g.sk.lacc = Math.max(20, g.sk.lacc - 0.3 * k); if (y >= 20) for (const q of ['wedge', 'pitch', 'chip', 'bunker', 'sputt', 'lputt', 'iacc', 'idist']) g.sk[q] = Math.max(20, g.sk[q] - 0.3); }
      const upd: any = { yr: y + 1, tour: next, seasons, trophies, sk: g.sk, s_pts: 0, conf: 0 };
      if (retire) {
        const { data: sec } = await sb.from('golfer_secrets').select('co').eq('golfer_id', g.id).single();
        const o = coachRatings(g, sec?.co || rawCo(g.id));
        Object.assign(upd, { retired: true, ret_age: ageOf(y), ask: null, coach_id: null, cr: { price: fairPrice(o, fameOf({ ...g, trophies, seasons })), left: s.lessons_per_day, earn: 0, given: 0, own: 0, last: null, o } });
      }
      moves.push({ id: g.id, upd });
      if (g.manager_id) {
        if (bonus) await cash(g.manager_id, bonus, 'bonus', `${g.name}: season bonus, ${T.name}`);
        say(g.manager_id, `${g.name} finished ${rank}${['th', 'st', 'nd', 'rd'][rank % 10 > 3 || [11, 12, 13].includes(rank % 100) ? 0 : rank % 10]} on the ${T.name}. ${note}${bonus ? ` Season bonus: ${fmt$(bonus)}.` : ''}`);
      }
    }
  }
  for (const m of moves) await sb.from('golfers').update(m.upd).eq('id', m.id);
  const next = season + 1, d0 = new Date(Date.parse(w.season_end + 'T12:00:00Z') + 864e5);
  const y = d0.getUTCFullYear(), m = d0.getUTCMonth() + 1, start = iso(y, m, 1), end = iso(y, m, lastDay(y, m));
  await fixedPools(next, ['col0', 'col1', 'col2']);
  await sb.from('world').update({ season: next, season_start: start, season_end: end }).eq('id', 1);
  await scheduleSeason(s, next, start, end);
  for (const mid in news) await addNews(mid, news[mid]);
  done.push(`season ${season} closed; season ${next} scheduled`);
}
