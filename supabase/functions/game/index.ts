// Every player action in the shared world. The browser can read the tables but can't change them;
// it calls this with { action, ...args } and the signed-in player's token.
import {
  sb, E, settings, json, CORS, cash, addNews, fmt$, valueOf, canSell, coachRatings, rawCo, fairPrice, fameOf,
  golferRow, insertGolfers, COLLEGE_TOUR, trainOnce, lesson, EQC, coOvr, DEFAULTS,
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
  const p = E.rollProspect();
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
    const college = E.COLLEGES.includes(b.college) ? b.college : E.pick(E.COLLEGES);
    const country = E.CN.includes(b.country) ? b.country : 'US';
    const [id] = await insertGolfers([golferRow({ name: clean(b.name) || 'Tucker Hale', country, college, arch: p.arch, sk: p.sk, tour: COLLEGE_TOUR(college), yr: 1 },
      { manager_id: uid, stable: me.name, career: true, color: E.clamp(+b.color || 0, 0, 5), sessions: s.sessions_per_day })], [{ ce: p.ce, peak: p.peak, agg: p.agg }]);
    await sb.from('manager_secrets').update({ prospect: null }).eq('id', uid);
    await sb.from('managers').update({ prospect: null }).eq('id', uid);
    await addNews(uid, [`${clean(b.name) || 'Tucker Hale'} signs with you and joins ${college} as a freshman.`]);
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
    if (!'sml'.includes(u) || u.length !== 1) no('Pick a set of clubs.');
    const lvl = g.eq[u], c = EQC[lvl]; if (c === undefined) no('Already the best available.');
    await cash(uid, -c, 'gear', `${g.name}: new clubs`, false);
    await sb.from('golfers').update({ eq: { ...g.eq, [u]: lvl + 1 } }).eq('id', g.id);
  },
  async shirt({ uid, b }) { const g = await myGolfer(uid, b.id); await sb.from('golfers').update({ color: E.clamp(+b.color || 0, 0, 5) }).eq('id', g.id); },
  async college({ uid, b }) {
    const g = await myGolfer(uid, b.id);
    if (!E.isCol(g.tour)) no('Only college golfers change schools.');
    if (!E.COLLEGES.includes(b.college)) no('Pick a college.');
    await sb.from('golfers').update({ college: b.college, tour: COLLEGE_TOUR(b.college) }).eq('id', g.id);
  },

  // ---- events ----
  async enter({ uid, b, s }) {
    const g = await myGolfer(uid, b.id);
    const { data: ev } = await sb.from('events').select('*').eq('id', b.event).maybeSingle();
    if (!ev || ev.status !== 'open') no('Entries are closed for that event.');
    if (Date.parse(ev.starts_at) - s.deadline_min * 60e3 <= Date.now()) no('Entries are closed for that event.');
    if (ev.tour !== g.tour) no(`${g.name} doesn't play on that tour.`);
    const { data: ex } = await sb.from('entries').select('*').eq('event_id', ev.id).eq('golfer_id', g.id).maybeSingle();
    if (ex?.status === 'in') return {};
    const fee = ev.test ? 0 : ev.fee;
    if (fee) await cash(uid, -fee, 'entry', `Entry: ${ev.name}`, false);
    await sb.from('entries').upsert({ event_id: ev.id, golfer_id: g.id, manager_id: uid, status: 'in', fee });
  },
  async withdraw({ uid, b, s }) {
    const g = await myGolfer(uid, b.id);
    const { data: ev } = await sb.from('events').select('*').eq('id', b.event).maybeSingle();
    if (!ev || ev.status !== 'open' || Date.parse(ev.starts_at) - s.deadline_min * 60e3 <= Date.now()) no('Too late to withdraw.');
    const { data: ex } = await sb.from('entries').select('*').eq('event_id', ev.id).eq('golfer_id', g.id).maybeSingle();
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
    const g = await myGolfer(uid, b.id);
    if (!canSell(g)) no('College freshmen and sophomores can’t be sold.');
    const ask = Math.round(+b.ask); if (!(ask >= 1000 && ask <= 1e9)) no('Set a price of at least $1,000.');
    await sb.from('golfers').update({ ask, listed_at: new Date().toISOString() }).eq('id', g.id);
  },
  async unlist({ uid, b }) { const g = await myGolfer(uid, b.id); await sb.from('golfers').update({ ask: null, listed_at: null }).eq('id', g.id); },
  async quicksell({ uid, b }) {
    const g = await myGolfer(uid, b.id);
    if (!canSell(g)) no('College freshmen and sophomores can’t be sold.');
    const price = Math.round(valueOf(g.sk, g.yr) * 0.6 / 100) * 100, rival = E.pick(['Halcyon Sports', 'Old Orchard Golf', 'Bayshore Stable', 'Ironwood Academy']);
    const { data: claimed } = await sb.from('golfers').update({ manager_id: null, stable: rival, ask: null, listed_at: null, coach_id: null, orders: null }).eq('id', g.id).eq('manager_id', uid).select('id');
    if (!claimed?.length) no('Try that again.');
    await cash(uid, price, 'transfer', `Quick sale: ${g.name} to ${rival}`);
    return { msg: `${rival} takes ${g.name} for ${fmt$(price)}.` };
  },
  async buy({ uid, b, s }) {
    if ((await activeCount(uid)) >= s.max_golfers) no(`Your roster is full at ${s.max_golfers} active golfers.`);
    const { data: g } = await sb.from('golfers').select('id,name,manager_id,ask').eq('id', b.id).maybeSingle();
    if (!g?.ask) no("He's no longer for sale.");
    if (g.manager_id === uid) no("He's already yours.");
    const { data: ok, error } = await sb.rpc('transfer_golfer', { gid: g.id, buyer: uid, price: g.ask });
    if (error) no(error.message.includes('insufficient_funds') ? 'Not enough money in the bank for that.' : 'That sale fell through.');
    if (!ok) no('The price changed or he was sold. Have another look.');
    if (g.manager_id) {
      const { data: m } = await sb.from('managers').select('name').eq('id', uid).single();
      await addNews(g.manager_id, [`${m?.name || 'Another manager'} signed ${g.name} from you for ${fmt$(g.ask)}.`]);
    }
    return { msg: `${g.name} signs for ${fmt$(g.ask)}.` };
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
