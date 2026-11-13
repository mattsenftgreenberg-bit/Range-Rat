// Shared by the `game` (player actions) and `clock` (the world's timekeeper) server functions.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import * as E0 from './engine.js';
export const E: any = E0;

export const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Every number the admin page can change. Values in the settings table override these.
export const DEFAULTS: Record<string, any> = {
  start_cash: 75000, max_golfers: 8, sessions_per_day: 1, lessons_per_day: 5, coach_max: 1.5,
  deadline_min: 5, round_min: 7.5, events_per_season: 8, hours: [18, 19, 20, 21],
  gain_mult: 1, rust_per_day: 0.025, recovery_per_day: 15, event_fatigue: 20, train_fatigue: 15,
  purse_mult: 1, fee_mult: 1, sale_chance_mult: 1, coach_age_yr: 15,
  weekends: true,
  qf_on: true, qf_every_min: 20, qf_fee: 200, qf_base: 20000, qf_add: 200, qf_bonus: 1000, qf_ace: 1000000,
};
export async function settings() {
  const { data } = await sb.from('settings').select('key,value');
  const s: Record<string, any> = { ...DEFAULTS };
  for (const r of data || []) s[r.key] = r.value;
  return s;
}

export const TORDER = ['col0', 'col1', 'col2', 'p3', 'p2', 'p1', 'c2', 'c1'];
export const RIVALS = ['Halcyon Sports', 'Old Orchard Golf', 'Bayshore Stable', 'Ironwood Academy', 'Tenth Tee Management', 'Dunmore Golf Group', 'Pinecrest Athletes', 'Fairway Partners'];
export const SESSIONS_NAME: Record<string, string> = { s: 'Short game', m: 'Irons', l: 'Long game', x: 'Miscellaneous' };
export const EQC = [8000, 40000, 200000];
export const MAXG = 8;

export const nowISO = () => new Date().toISOString();
export function etParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24 };
}
export const etDate = (d = new Date()) => { const p = etParts(d); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };
// A wall-clock time in New York as a real instant.
export function etInstant(y: number, m: number, d: number, h: number) {
  const guess = Date.UTC(y, m - 1, d, h), p = etParts(new Date(guess));
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h) - guess; // New York minus UTC, e.g. -5 hours
  return new Date(guess - offset);
}

export const fmt$ = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');

export async function addNews(mid: string, lines: string[]) {
  if (!lines.length) return;
  const { data } = await sb.from('managers').select('news').eq('id', mid).single();
  const news = (lines.map((t) => ({ t, at: nowISO() }))).concat(data?.news || []).slice(0, 15);
  await sb.from('managers').update({ news }).eq('id', mid);
}
export async function cash(mid: string, amt: number, kind: string, note: string, allowNegative = true) {
  const { data, error } = await sb.rpc('adjust_cash', { mid, amt: Math.round(amt), kind, note, allow_negative: allowNegative });
  if (error) throw new Error(error.message.includes('insufficient_funds') ? 'Not enough money in the bank for that.' : error.message);
  return data as number;
}

// ---- market value ----
export function valueOf(sk: any, yr: number) {
  const o = E.ovr(sk), a = yr <= 4 ? [0.2, 0.3, 0.45, 0.7][yr - 1] : yr <= 12 ? 1.15 - (yr - 5) * 0.02 : yr <= 20 ? 1 - (yr - 12) * 0.07 : Math.max(0.04, 0.3 - (yr - 21) * 0.03);
  return Math.max(1000, Math.round(50000 * Math.pow(5, (o - 64) / 6) * a / 500) * 500);
}
export const canSell = (g: any) => g.yr >= 3;
// chance a rival coach meets the asking price on a given day
export const saleChanceDay = (ask: number, val: number, mult = 1) => {
  const wk = ask <= val * 0.9 ? 0.9 : E.clamp(1.5 - ask / val, 0, 0.9);
  return E.clamp((1 - Math.pow(1 - wk, 1 / 3.75)) * mult, 0, 0.95);
};

// ---- coaching ----
export const CU: Record<string, string> = { s: 'Short game', m: 'Irons', l: 'Long game', x: 'Mental' };
const TRANK: Record<string, number> = { p3: 1, c2: 2, p2: 3, c1: 4, p1: 5 };
export function rawCo(seed: string) {
  const r = E.mulberry32(E.hash('coach-' + seed)), o: any = {}, star = 'smlx'[Math.floor(r() * 4)], has = r() < 0.22;
  for (const u of 'smlx') o[u] = Math.round(E.clamp(28 + r() * 44 + E.gaussR(r) * 7 + (has && u === star ? 18 : 0), 12, 97));
  return o;
}
const coFloor = (best: number) => E.clamp((best - 62) * 2.3, 0, 72);
export const coLift = (raw: any, best: number) => { const f = coFloor(best), o: any = {}; for (const u of 'smlx') o[u] = Math.round(E.clamp(Math.max(raw[u], f - 3 + (raw[u] % 7)), 12, 97)); return o; };
export const coachRatings = (g: any, co: any) => coLift(co, Math.max(g.best || 0, E.ovr(g.sk)));
export const coOvr = (o: any) => (o.s + o.m + o.l + o.x) / 4;
export const coMult = (v: number, max = 1.5) => 1 + (max - 1) * Math.pow(E.clamp((v - 35) / 60, 0, 1), 1.2);
export const pBook = (ratio: number) => E.clamp(1.25 - 0.6 * ratio, 0, 0.95);
export function bestTour(g: any) { return ((g.seasons || []).map((x: any) => x.tour).concat([g.tour])).filter((t: string) => TRANK[t]).sort((a: string, b: string) => TRANK[b] - TRANK[a])[0] || 'col0'; }
export const fameOf = (g: any) => ({ wins: g.stats?.wins || 0, titles: (g.trophies || []).filter((t: any) => t.title).length, best: bestTour(g) });
export function fairPrice(o: any, f: any) {
  return Math.max(250, Math.round(350 * Math.pow(1.065, coOvr(o) - 40) * (1 + 0.03 * Math.min(f.wins || 0, 25) + 0.12 * (f.titles || 0) + (f.best === 'p1' ? 0.3 : f.best === 'c1' || f.best === 'p2' ? 0.1 : 0)) / 50) * 50);
}

// ---- training ----
export const umbOf = (k: string) => 'smlx'.split('').find((u) => E.SUB[u].includes(k))!;
function gain(g: any, ce: any, k: string, mult: number, s: any) {
  const room = E.clamp(1 - Math.pow(g.sk[k] / ce[k], 3), 0, 1);
  return (1.6 + Math.random() * 1.8) * mult * room * (1 - g.fatigue / 160) * (0.8 + g.sk.attitude / 250) * (s.gain_mult || 1);
}
export function addSkill(g: any, ce: any, k: string, x: number) {
  const b = g.sk[k]; g.sk[k] = E.clamp(b + x, 20, Math.max(b, ce ? ce[k] : 99)); return g.sk[k] - b;
}
// One range session. Returns the message to show. `coach` is {name, co, own} or null.
export function trainOnce(g: any, ce: any, what: string, cm: number, s: any) {
  if (what === 'rest') { g.fatigue = Math.max(0, g.fatigue - 30); g.carry = E.clamp((g.carry || 0) + 0.05, -0.4, 0.4); return 'Day off. He comes back looser.'; }
  g.fatigue = Math.min(100, g.fatigue + (s.train_fatigue || 15));
  if (E.SUB[what]) {
    const b = E.um(g.sk, what); for (const k of E.SUB[what]) addSkill(g, ce, k, gain(g, ce, k, 0.5 * cm, s));
    g.trained = { ...(g.trained || {}), [what]: 1 };
    const capped = E.SUB[what].filter((k: string) => g.sk[k] >= ce[k] - 0.05).length, d = E.um(g.sk, what) - b;
    return `${E.UMB[what]} +${d.toFixed(1)}.` + (capped === E.SUB[what].length ? ' Every part of it has topped out.' : capped ? ` ${capped} of its ${E.SUB[what].length} parts have topped out.` : d < 0.35 ? ' The gains are getting thin.' : '');
  }
  const room = E.clamp(1 - Math.pow(g.sk[what] / ce[what], 3), 0, 1), d = addSkill(g, ce, what, gain(g, ce, what, 2.2 * cm, s));
  g.trained = { ...(g.trained || {}), [umbOf(what)]: 1 };
  return g.sk[what] >= ce[what] - 0.05 ? `${E.SUBN[what]}: he's topped out. This is as good as it gets.` : `${E.SUBN[what]} +${d.toFixed(1)}.` + (room < 0.3 ? ' The gains are getting thin. He may be near his limit.' : '');
}

// A lesson from the golfer's booked coach, if any. Uses one of the coach's lessons for the day,
// charges the golfer's manager (unless they own the coach) and pays the coach's owner.
// Returns the multiplier, a note for the message, and whether the booking should be cleared.
export async function lesson(g: any, what: string, s: any) {
  if (!g.coach_id || what === 'rest') return { cm: 1, note: '', clear: false };
  const { data: c } = await sb.from('golfers').select('id,name,manager_id,sk,best,cr').eq('id', g.coach_id).maybeSingle();
  if (!c || !c.cr) return { cm: 1, note: ' (His coach is no longer taking lessons.)', clear: true };
  const cr = { ...c.cr };
  if ((cr.left || 0) <= 0) return { cm: 1, note: ` (${c.name} was fully booked today, so he worked alone.)`, clear: false };
  const own = c.manager_id && c.manager_id === g.manager_id, price = own ? 0 : cr.price;
  if (price) {
    try { await cash(g.manager_id, -price, 'lesson', `${c.name}: lesson for ${g.name}`, false); }
    catch { return { cm: 1, note: ` (Not enough money for ${c.name}'s ${fmt$(price)} fee, so he worked alone.)`, clear: false }; }
    if (c.manager_id) { await cash(c.manager_id, price, 'coaching', `${c.name}: lesson for ${g.name}`); await addNews(c.manager_id, [`${c.name} gave a lesson to ${g.name} and earned ${fmt$(price)}.`]); }
  }
  cr.left -= 1; if (own) cr.own = (cr.own || 0) + 1; else { cr.given = (cr.given || 0) + 1; cr.earn = (cr.earn || 0) + price; }
  await sb.from('golfers').update({ cr }).eq('id', c.id);
  const { data: sec } = await sb.from('golfer_secrets').select('co').eq('golfer_id', c.id).maybeSingle();
  const o = coachRatings(c, sec?.co || rawCo(c.id)), u = E.SUB[what] ? what : umbOf(what);
  const cm = coMult(o[u], s.coach_max || 1.5);
  return { cm, note: ` Coached by ${c.name} (×${cm.toFixed(2)}${price ? `, ${fmt$(price)}` : ''}).`, clear: false };
}

// ---- creating golfers ----
export function golferRow(p: any, extra: any) {
  return { name: p.name, country: p.country, college: p.college || null, arch: p.arch || null, sk: p.sk, yr: p.yr || 1, tour: p.tour, best: E.ovr(p.sk), stats: { ev: 0, cuts: 0, wins: 0, top10: 0, earn: 0, rounds: 0, par: 0, low: null }, ...extra };
}
export async function insertGolfers(rows: any[], secrets: any[]) {
  const out: any[] = [];
  for (let i = 0; i < rows.length; i += 400) {
    const { data, error } = await sb.from('golfers').insert(rows.slice(i, i + 400)).select('id');
    if (error) throw new Error('insert golfers: ' + error.message);
    data!.forEach((d: any, j: number) => out.push({ golfer_id: d.id, ...secrets[i + j], co: secrets[i + j].co || rawCo(d.id) }));
  }
  for (let i = 0; i < out.length; i += 400) { const { error } = await sb.from('golfer_secrets').insert(out.slice(i, i + 400)); if (error) throw new Error('insert secrets: ' + error.message); }
  return out.map((o) => o.golfer_id);
}
export const COLLEGE_TOUR = (college: string) => 'col' + E.confOf(college);

// A rival-coach transfer listing: a ready-made golfer on a given tour.
export function marketProspect(tour: string, yr: number, mu: number) {
  const p = E.rollProspect(mu), c = Math.random() < 0.34 ? 'US' : E.pick(E.CN), N = E.NAMES[c];
  const name = E.pick(N[0]) + ' ' + E.pick(N[1]);
  const college = E.isCol(tour) ? E.pick(E.CONFS[+tour[3]]) : null;
  return { p, name, country: c, tour, yr, college };
}
export const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-clock-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export async function clockSecretOk(req: Request) {
  const h = req.headers.get('x-clock-secret'); if (!h) return false;
  const { data } = await sb.rpc('clock_secret'); return !!data && h === data;
}
