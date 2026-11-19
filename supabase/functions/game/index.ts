// Every player action in the shared world. The browser can read the tables but can't change them;
// it calls this with { action, ...args } and the signed-in player's token.
import {
  sb, E, settings, json, CORS, cash, addNews, fmt$, valueOf, canSell, coachRatings, rawCo, fairPrice, fameOf,
  golferRow, insertGolfers, COLLEGE_TOUR, trainOnce, lesson, EQC, coOvr, DEFAULTS,
  gradeOf,
} from '../_shared/common.ts';

class Oops extends Error {}
function no(m: string): never { throw new Oops(m); }
const clean = (x: any, n = 22) => String(x ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = await sb.auth.getUser(tok);
    if (!u?.user) return json({ error: 'Please sign in again.' }, 401);
    const uid = u.user.id, body = await req.json().catch(() => ({})), s = await settings();
    const fn = (A as any)[body.action];
    if (!fn) no('Unknown action.');
    let me: any = null;
    if (body.action !== 'join') {
      const { data } = await sb.from('managers').select('*').eq('id', uid).maybeSingle();
      if (!data) no('Set up your roster first.');
      me = data;
    }
    if (String(body.action).startsWith('admin') && !me.is_admin) no('Admins only.');
    const out = await fn({ uid, me, b: body, s });
    return json({ ok: true, ...(out || {}) });
  } catch (e) {
    if (e instanceof Oops) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Something went wrong on the server. Try again in a moment.' }, 500);
  }
});

// Team Match Play: golfers per team, and putting each team's fee on its first golfer (entry order) so the books stay straight
const tmSize = (s: any) => Math.max(1, Number(s.tm_size) || 2);
async function tmRefee(ev: any, uid: string, s: any) {
  const { data: mine } = await sb.from('entries').select('golfer_id,fee,created_at').eq('event_id', ev.id).eq('manager_id', uid).eq('status', 'in').order('created_at');
  const unit = ev.test ? 0 : ev.fee, TS = tmSize(s);
  await Promise.all((mine || []).map((x: any, i: number) => { const f = i % TS === 0 ? unit : 0; return x.fee === f ? null : sb.from('entries').update({ fee: f }).eq('event_id', ev.id).eq('golfer_id', x.golfer_id); }));
}
async function myGolfer(uid: string, id: string, active = true) {
  const { data: g } = await sb.from('golfers').select('*').eq('id', id).maybeSingle();
  if (!g || g.manager_id !== uid) no("That golfer isn't in your stable.");
  if (active && g.retired) no("He's retired.");
  return g;
}
async function activeCount(uid: string) {
  const { count } = await sb.from('golfers').select('id', { count: 'exact', head: true }).eq('manager_id', uid).eq('retired', false);
  return count || 0;
}
const scoutView = (p: any) => ({ arch: p.arch, sk: p.sk, grade: p.grade });
async function newScout(uid: string, rerolls: number) {
  // juniors are 15: a few points behind where a college freshman would be
  const p = E.rollProspect();
  for (const k in p.sk) p.sk[k] = Math.max(25, p.sk[k] - 6);
  for (const u of 'smlx') p.grade[u] = gradeOf(E.um(p.ce, u), Math.random);
  await sb.from('manager_secrets').upsert({ id: uid, prospect: p });
  await sb.from('managers').update({ prospect: scoutView(p), rerolls }).eq('id', uid);
  return scoutView(p);
}

const A: Record<string, (c: any) => Promise<any>> = {
  // ---- your stable ----
  async join({ uid, b, s }) {
    const { data: ex } = await sb.from('managers').select('id').eq('id', uid).maybeSingle();
    if (ex) return {};
    const name = clean(b.name, 30) || 'New Roster';
    const { error } = await sb.from('managers').insert({ id: uid, name, cash: s.start_cash, news: [{ t: `Welcome to Range Rat. You have ${fmt$(s.start_cash)} to start. Scout a junior to sign your first golfer.`, at: new Date().toISOString() }] });
    if (error) no('Could not set up your stable.');
    await newScout(uid, 3);
    return {};
  },
  async rename({ uid, b }) {
    const name = clean(b.name, 30); if (!name) no('Give the roster a name.');
    await sb.from('managers').update({ name }).eq('id', uid);
    await sb.from('golfers').update({ stable: name }).eq('manager_id', uid);
  },
  async scout({ uid, me, b }) {
    if (b.fresh) return { prospect: await newScout(uid, 3) };
    if (me.rerolls <= 0) no('No scouting trips left for this prospect.');
    return { prospect: await newScout(uid, me.rerolls - 1) };
  },
  async sign({ uid, me, b, s }) {
    if ((await activeCount(uid)) >= s.max_golfers) no(`Your roster is full at ${s.max_golfers} active golfers.`);
    const { data: sec } = await sb.from('manager_secrets').select('prospect').eq('id', uid).maybeSingle();
    const p = sec?.prospect; if (!p) no('Scout a junior first.');
    const cost = s.recruit_cost || 0;
    if (cost) await cash(uid, -cost, 'recruit', `Signing fee: ${clean(b.name) || 'Tucker Hale'}`, false);
    const country = /^[A-Z]{2,3}$/.test(String(b.country)) ? b.country : 'US';
    const [id] = await insertGolfers([golferRow({ name: clean(b.name) || 'Tucker Hale', country, college: null, arch: p.arch, sk: p.sk, tour: 'jr', yr: 1 },
      { manager_id: uid, stable: me.name, career: true, color: E.clamp(+b.color || 0, 0, 5), sessions: s.sessions_per_day })], [{ ce: p.ce, peak: p.peak, agg: p.agg }]);
    await sb.from('manager_secrets').update({ prospect: null }).eq('id', uid);
    await sb.from('managers').update({ prospect: null }).eq('id', uid);
    await addNews(uid, [`${clean(b.name) || 'Tucker Hale'} signs with you at 15 and starts on the Junior Tour.${cost ? ` Signing fee ${fmt$(cost)}.` : ''}`]);
    return { id };
  },

  // ---- the range ----
  async train({ uid, b, s }) {
    const g = await myGolfer(uid, b.id), what = String(b.what);
    if (!(what === 'rest' || E.SUB[what] || E.KEYS.includes(what))) no('Pick something to work on.');
    if (g.sessions <= 0) no(`${g.name} has had his range session today. More tomorrow.`);
    const { data: claimed } = await sb.from('golfers').update({ sessions: g.sessions - 1 }).eq('id', g.id).eq('sessions', g.sessions).select('id');
    if (!claimed?.length) no('Try that again.');
    const { data: sec } = await sb.from('golfer_secrets').select('ce').eq('golfer_id', g.id).single();
    const L = await lesson(g, what, s);
    if (L.clear) g.coach_id = null;
    const msg = trainOnce(g, sec!.ce, what, L.cm, s) + L.note;
    await sb.from('golfers').update({ sk: g.sk, fatigue: g.fatigue, carry: g.carry, trained: g.trained, coach_id: g.coach_id }).eq('id', g.id);
    return { msg };
  },
  async orders({ uid, b }) {
    const g = await myGolfer(uid, b.id);
    let o: any = null;
    if (b.orders) {
      const f = String(b.orders.focus || 'auto');
      if (!(f === 'auto' || f === 'rest' || E.SUB[f] || E.KEYS.includes(f))) no('Pick a focus.');
      o = { focus: f, rest_below: E.clamp(+b.orders.rest_below || 0, 0, 5), report: !!b.orders.report };
    }
    await sb.from('golfers').update({ orders: o }).eq('id', g.id);
  },
  async coach({ uid, b }) {
    const g = await myGolfer(uid, b.id);
    if (!b.coach) { await sb.from('golfers').update({ coach_id: null }).eq('id', g.id); return {}; }
    const { data: c } = await sb.from('golfers').select('id,retired,cr').eq('id', b.coach).maybeSingle();
    if (!c?.retired || !c.cr) no("That coach isn't taking pupils.");
    await sb.from('golfers').update({ coach_id: c.id }).eq('id', g.id);
  },
  async gear({ uid, me, b }) {
    const g = await myGolfer(uid, b.id), u = String(b.u);
    if (!'smlx'.includes(u) || u.length !== 1) no('Pick a set of clubs or a caddy.');
    const lvl = (g.eq || {})[u] || 0, c = EQC[lvl]; if (c === undefined) no('Already the best available.');
    await cash(uid, -c, 'gear', `${g.name}: ${u === 'x' ? 'a new caddy' : 'new clubs'}`, false);
    await sb.from('golfers').update({ eq: { ...g.eq, [u]: lvl + 1 } }).eq('id', g.id);
  },
  async shirt({ uid, b }) { const g = await myGolfer(uid, b.id); await sb.from('golfers').update({ color: E.clamp(+b.color || 0, 0, 5) }).eq('id', g.id); },
  // pick one of his college offers and bank the NIL money
  async commit({ uid, b }) {
    const g = await myGolfer(uid, b.id), list = g.offers?.list || [], o = list[+b.i];
    if (!o) no('That offer has gone.');
    const { data: claimed } = await sb.from('golfers').update({ college: o.college, offers: null }).eq('id', g.id).not('offers', 'is', null).select('id');
    if (!claimed?.length) no('He has already signed.');
    await cash(uid, o.nil, 'nil', `${g.name}: NIL deal with ${o.college}`);
    await addNews(uid, [`${g.name} commits to ${o.college} with a ${fmt$(o.nil)} NIL deal.`]);
    return { msg: `${g.name} commits to ${o.college}. ${fmt$(o.nil)} is in the bank.` };
  },
  async college({ uid, b }) {
    const g = await myGolfer(uid, b.id);
    if (!E.isCol(g.tour)) no('Only college golfers change schools.');
    if (g.offers) no('Pick one of his offers first.');
    if (!E.COLLEGES.includes(b.college)) no('Pick a college.');
    await sb.from('golfers').update({ college: b.college, tour: COLLEGE_TOUR(b.college) }).eq('id', g.id);
  },

  // ---- events ----
  async enter({ uid, b, s }) {
    const g = await myGolfer(uid, b.id);
    const { data: ev } = await sb.from('events').select('*').eq('id', b.event).maybeSingle();
    if (!ev || ev.status !== 'open') no('Entries are closed for that event.');
    if (Date.parse(ev.starts_at) - s.deadline_min * 60e3 <= Date.now()) no('Entries are closed for that event.');
    const q = /^(qf|mp|tm):/.test(String(ev.tour)), level = E.isCol(g.tour) ? 'col' : g.tour;
    if (q ? ev.tour.slice(3) !== level : ev.tour !== g.tour) no(`${g.name} doesn't play at that level.`);
    const { data: ex } = await sb.from('entries').select('*').eq('event_id', ev.id).eq('golfer_id', g.id).maybeSingle();
    if (ex?.status === 'in') return {};
    let fee = ev.test ? 0 : ev.fee;
    // Team Match Play: a manager's golfers make teams of tm_size in the order they were entered, and each new team pays the fee once
    const tm = String(ev.tour).startsWith('tm:');
    if (tm) {
      const { count } = await sb.from('entries').select('golfer_id', { count: 'exact', head: true }).eq('event_id', ev.id).eq('manager_id', uid).eq('status', 'in');
      if ((count || 0) % tmSize(s)) fee = 0;
    }
    if (fee) await cash(uid, -fee, 'entry', `Entry: ${ev.name}${tm ? ' (new team)' : ''}`, false);
    await sb.from('entries').upsert({ event_id: ev.id, golfer_id: g.id, manager_id: uid, status: 'in', fee, created_at: new Date().toISOString() });
    if (tm) await tmRefee(ev, uid, s);
  },
  // Enter every golfer who can play this event and isn't in yet. Stops if the money runs out.
  async enterAll({ uid, b, s }) {
    const { data: ev } = await sb.from('events').select('*').eq('id', b.event).maybeSingle();
    if (!ev || ev.status !== 'open' || Date.parse(ev.starts_at) - s.deadline_min * 60e3 <= Date.now()) no('Entries are closed for that event.');
    const q = /^(qf|mp|tm):/.test(String(ev.tour)), team = String(ev.tour).startsWith('tm:');
    const { data: gs } = await sb.from('golfers').select('id,name,tour,sk').eq('manager_id', uid).eq('retired', false);
    const { data: ex } = await sb.from('entries').select('golfer_id,status').eq('event_id', ev.id).eq('manager_id', uid);
    const inn = new Set((ex || []).filter((x: any) => x.status === 'in').map((x: any) => x.golfer_id));
    let todo = (gs || []).filter((g: any) => (q ? ev.tour.slice(3) === (E.isCol(g.tour) ? 'col' : g.tour) : ev.tour === g.tour) && !inn.has(g.id));
    // a team: the best of those not yet in, enough to finish the team being made or make a new one (one fee per team)
    const TS = tmSize(s);
    if (team) todo = todo.sort((a: any, b: any) => E.ovr(b.sk) - E.ovr(a.sk)).slice(0, TS - (inn.size % TS));
    if (!todo.length) no(team ? 'No more of your golfers can play at this level.' : 'All your golfers who can play are already in.');
    let fee = ev.test ? 0 : ev.fee, n = 0, short = 0, paid = 0;
    for (const g of todo) {
      const f = team && (inn.size + n) % TS ? 0 : fee;
      if (f) { try { await cash(uid, -f, 'entry', `Entry: ${ev.name} (${team ? 'new team' : g.name})`, false); paid += f; } catch { short++; if (team) break; continue; } }
      await sb.from('entries').upsert({ event_id: ev.id, golfer_id: g.id, manager_id: uid, status: 'in', fee: f, created_at: new Date(Date.now() + n).toISOString() }); n++;
    }
    if (team) await tmRefee(ev, uid, s);
    if (team && short && !n) no(`Not enough money for the ${fmt$(fee)} team fee.`);
    return { msg: `${n} golfer${n === 1 ? '' : 's'} entered${paid ? ` for ${fmt$(paid)}` : ''}.${short && !team ? ` ${short} left out: not enough money.` : ''}` };
  },
  // Match Play bracket, revealed hole by hole on the clock: a match's result shows once its last hole has been played,
  // and a later-round pairing appears once both matches feeding it are decided.
  async mpBoard({ uid, b }) {
    const { data: ev } = await sb.from('events').select('*').eq('id', b.event).maybeSingle();
    if (!ev || !/^(mp|tm):/.test(String(ev.tour))) no('No such Match Play.');
    const mp = ev.meta?.mp, base = { id: ev.id, tour: ev.tour, name: ev.name, ci: ev.ci, purse: ev.purse, fee: ev.fee, status: ev.status, starts_at: ev.starts_at, field: ev.field, round_min: ev.round_min };
    if (!mp) return { board: { event: base, rounds: [] } };
    const fin = ev.status === 'final', t = (Date.now() - Date.parse(ev.starts_at)) / 1000, done = new Map<string, boolean>();
    const view = (x: any, r: number, R: any, shown: boolean, v: number) => {
      const h = shown ? x.h.slice(0, Math.max(0, v)) : [], over = shown && v >= x.h.length && (x.b === null ? t >= R.start || fin : true);
      return { a: shown ? x.a : null, b: shown ? x.b : null, h, ms: shown && x.ms ? x.ms.slice(0, h.length) : undefined, over, w: over ? x.w : null, res: over ? x.res : null };
    };
    const rounds = mp.rounds.map((R: any, r: number) => {
      const v = fin ? 1e9 : Math.max(-1, Math.floor((t - R.start) / mp.T));
      const m = R.m.map((x: any, i: number) => {
        const shown = r === 0 || (done.get(`${r - 1}:${2 * i}`) && done.get(`${r - 1}:${2 * i + 1}`));
        const o = view(x, r, R, !!shown, v); done.set(`${r}:${i}`, !!o.over); return o;
      });
      const out: any = { start: R.start, len: R.len, m };
      // third-place match: its golfers are known once both semifinals are over
      if (R.third) out.third = view(R.third, r, R, !!(done.get(`${r - 1}:0`) && done.get(`${r - 1}:1`)), v);
      return out;
    });
    // the shots for one match being watched: only holes already played on the clock, from hole `from` on
    let shots: any = null;
    if (b.watch && typeof b.watch === 'string') {
      const [rs, is] = b.watch.split(':'), r = +rs, R = mp.rounds[r], vis = rounds[r];
      const x = R && (is === 't' ? R.third : R.m[+is]), xv = vis && (is === 't' ? vis.third : vis.m[+is]);
      if (x && xv && xv.a && x.s) { const from = Math.max(0, Math.floor(+b.from || 0)); shots = { key: b.watch, from, s: x.s.slice(from, xv.h.length) }; }
    }
    const players: any = {}; for (const id in mp.players) players[id] = { ...mp.players[id], mine: mp.players[id].mid === uid };
    return { board: { event: base, rounds, players, team: !!mp.team, vsBot: !!mp.vsBot, T: mp.T, wind: mp.wind, pay: fin ? mp.pay : null, champ: fin ? mp.champ : null, places: fin ? mp.places || null : null, shots, now: new Date().toISOString() } };
  },
  async withdraw({ uid, b, s }) {
    const g = await myGolfer(uid, b.id);
    const { data: ev } = await sb.from('events').select('*').eq('id', b.event).maybeSingle();
    if (!ev || ev.status !== 'open' || Date.parse(ev.starts_at) - s.deadline_min * 60e3 <= Date.now()) no('Too late to withdraw.');
    const { data: ex } = await sb.from('entries').select('*').eq('event_id', ev.id).eq('golfer_id', g.id).maybeSingle();
    if (String(ev.tour).startsWith('tm:')) {
      // Team Match Play: refund a team fee only if taking him out leaves one team fewer; the rest re-pair in entry order
      if (ex?.status !== 'in') return {};
      const { data: mine } = await sb.from('entries').select('golfer_id,fee').eq('event_id', ev.id).eq('manager_id', uid).eq('status', 'in');
      const n = (mine || []).length, paidAll = (mine || []).reduce((a: number, x: any) => a + (x.fee || 0), 0), unit = ev.test ? 0 : ev.fee;
      const back = paidAll - Math.ceil((n - 1) / tmSize(s)) * unit;
      await sb.from('entries').upsert({ event_id: ev.id, golfer_id: g.id, manager_id: uid, status: 'out', fee: 0 });
      if (back > 0) await cash(uid, back, 'refund', `Withdrew a team from ${ev.name}`);
      await tmRefee(ev, uid, s);
      return {};
    }
    if (ex?.status === 'in' && ex.fee) await cash(uid, ex.fee, 'refund', `Withdrew from ${ev.name}`);
    await sb.from('entries').upsert({ event_id: ev.id, golfer_id: g.id, manager_id: uid, status: 'out', fee: 0 });
  },
  async rule({ uid, b }) {
    const g = await myGolfer(uid, b.id);
    if (!['all', 'signature', 'none'].includes(b.rule)) no('Pick an entry rule.');
    await sb.from('golfers').update({ enter_rule: b.rule }).eq('id', g.id);
  },

  // ---- the transfer market ----
  async list({ uid, b }) {
    const g = await myGolfer(uid, b.id, false);
    if (g.retired && !g.cr) no("He's retired and isn't coaching.");
    if (!g.retired && !canSell(g)) no('Junior Tour golfers can’t be sold until they reach college.');
    const ask = Math.round(+b.ask); if (!(ask >= 1000 && ask <= 1e9)) no('Set a price of at least $1,000.');
    await sb.from('golfers').update({ ask, listed_at: new Date().toISOString() }).eq('id', g.id);
  },
  async unlist({ uid, b }) { const g = await myGolfer(uid, b.id, false); await sb.from('golfers').update({ ask: null, listed_at: null }).eq('id', g.id); },
  async quicksell({ uid, b }) {
    const g = await myGolfer(uid, b.id);
    if (!canSell(g)) no('Junior Tour golfers can’t be sold until they reach college.');
    const price = Math.round(valueOf(g.sk, g.yr) * 0.6 / 100) * 100, rival = E.pick(['Halcyon Sports', 'Old Orchard Golf', 'Bayshore Stable', 'Ironwood Academy']);
    const { data: claimed } = await sb.from('golfers').update({ manager_id: null, stable: rival, ask: null, listed_at: null, coach_id: null, orders: null }).eq('id', g.id).eq('manager_id', uid).select('id');
    if (!claimed?.length) no('Try that again.');
    await cash(uid, price, 'transfer', `Quick sale: ${g.name} to ${rival}`);
    return { msg: `${rival} takes ${g.name} for ${fmt$(price)}.` };
  },
  async buy({ uid, b, s }) {
    const { data: g } = await sb.from('golfers').select('id,name,manager_id,ask,retired,cr').eq('id', b.id).maybeSingle();
    if (!g?.ask) no("He's no longer for sale.");
    if (g.manager_id === uid) no("He's already yours.");
    // a coach: he doesn't take a place on the roster
    if (g.retired) {
      const { data: ok, error } = await sb.rpc('transfer_coach', { gid: g.id, buyer: uid, price: g.ask });
      if (error) no(error.message.includes('insufficient_funds') ? 'Not enough money in the bank for that.' : 'That sale fell through.');
      if (!ok) no('The price changed or he was sold. Have another look.');
      if (g.manager_id) { const { data: m } = await sb.from('managers').select('name').eq('id', uid).single(); await addNews(g.manager_id, [`${m?.name || 'Another manager'} hired your coach ${g.name} for ${fmt$(g.ask)}.`]); }
      await addNews(uid, [`${g.name} now coaches for you: free lessons for your golfers, and fees from other rosters.`]);
      return { msg: `${g.name} coaches for you now.` };
    }
    if ((await activeCount(uid)) >= s.max_golfers) no(`Your roster is full at ${s.max_golfers} active golfers.`);
    const { data: ok, error } = await sb.rpc('transfer_golfer', { gid: g.id, buyer: uid, price: g.ask });
    if (error) no(error.message.includes('insufficient_funds') ? 'Not enough money in the bank for that.' : 'That sale fell through.');
    if (!ok) no('The price changed or he was sold. Have another look.');
    // a tour regular signed straight off the tour: he can train from today
    if (!g.manager_id) await sb.from('golfers').update({ sessions: s.sessions_per_day, trained: {} }).eq('id', g.id);
    if (g.manager_id) {
      const { data: m } = await sb.from('managers').select('name').eq('id', uid).single();
      await addNews(g.manager_id, [`${m?.name || 'Another manager'} signed ${g.name} from you for ${fmt$(g.ask)}.`]);
    }
    return { msg: `${g.name} signs for ${fmt$(g.ask)}.` };
  },

  // A scouting report on a golfer for sale (or one of yours): letter grades for his ceilings and how much room he has left.
  // The scouts aren't perfect, but the same scout gives the same answer about the same golfer.
  async report({ uid, b }) {
    const { data: g } = await sb.from('golfers').select('id,name,manager_id,ask,sk,retired').eq('id', b.id).maybeSingle();
    if (!g || g.retired) no('No report on him.');
    if (!g.ask && g.manager_id !== uid) no('The scouts only report on golfers for sale.');
    const { data: sec } = await sb.from('golfer_secrets').select('ce').eq('golfer_id', g.id).single();
    const ce = sec!.ce, r = E.mulberry32(E.hash('report-' + g.id)), out: any = {};
    for (const u of 'smlx') {
      const cv = E.um(ce, u), room = cv - E.um(g.sk, u);
      const grade = gradeOf(cv, r);
      let ri = room > 8 ? 0 : room > 3 ? 1 : 2; if (r() < 0.2) ri = E.clamp(ri + (r() < 0.5 ? -1 : 1), 0, 2);
      out[u] = { grade, room: ['Plenty of room to grow', 'Some room left', 'Close to his ceiling'][ri] };
    }
    return { report: out };
  },

  // ---- retirement and coaching ----
  async retire({ uid, b, s }) {
    const g = await myGolfer(uid, b.id);
    if (g.yr < s.coach_age_yr) no('He can retire to coach from age 40.');
    const { data: sec } = await sb.from('golfer_secrets').select('co').eq('golfer_id', g.id).single();
    const o = coachRatings(g, sec?.co || rawCo(g.id));
    await sb.from('golfers').update({ retired: true, ret_age: 0, ask: null, listed_at: null, coach_id: null, orders: null,
      cr: { price: fairPrice(o, fameOf(g)), left: s.lessons_per_day, earn: 0, given: 0, own: 0, last: null, o } }).eq('id', g.id);
    return { msg: `${g.name} hangs up his spikes and opens a coaching practice. Coaching overall ${Math.round(coOvr(o))}.` };
  },
  async fee({ uid, b }) {
    const g = await myGolfer(uid, b.id, false);
    if (!g.retired || !g.cr) no("He isn't coaching.");
    const price = Math.round(+b.price / 50) * 50; if (!(price >= 50 && price <= 1e6)) no('Set a fee of at least $50.');
    await sb.from('golfers').update({ cr: { ...g.cr, price } }).eq('id', g.id);
  },

  // ---- admin ----
  async adminSet({ uid, b }) {
    const key = String(b.key);
    if (!(key in DEFAULTS)) no('Unknown setting.');
    const v = b.value; if (typeof v !== typeof DEFAULTS[key]) no('That value is the wrong kind.');
    const { data: old } = await sb.from('settings').select('value').eq('key', key).maybeSingle();
    await sb.from('settings').upsert({ key, value: v, updated_at: new Date().toISOString() });
    await sb.from('settings_log').insert({ key, old: old?.value ?? DEFAULTS[key], new: v, by: uid });
  },
  async adminLog() { const { data } = await sb.from('settings_log').select('*').order('at', { ascending: false }).limit(50); return { log: data }; },
  async adminTest({ b, s }) {
    const tour = String(b.tour || 'col0'); if (!E.TOURS[tour]) no('Unknown tour.');
    const mins = E.clamp(Math.round(+b.mins || 7), 6, 600);
    const { data: w } = await sb.from('world').select('season').single();
    const c = E.calendar(tour, w!.season)[Math.floor(Math.random() * 7)];
    const { data, error } = await sb.from('events').insert({ tour, season: w!.season, week: 0, name: 'Test: ' + c.name, ci: c.ci, type: c.type, purse: c.purse, fee: 0, pm: c.pm, test: true,
      starts_at: new Date(Date.now() + mins * 60e3).toISOString(), round_min: s.round_min }).select('id').single();
    if (error) no(error.message);
    return { id: data!.id };
  },
};
