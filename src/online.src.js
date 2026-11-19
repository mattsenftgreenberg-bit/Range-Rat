/* ===== Range Rat online: the shared world =====
   Everything here reads the shared tables (read-only for players) and sends every change to the `game` server function. */
// Career years: 1-3 junior (15-17), 4-7 college (18-21), 8-23 pro (22-49), 24-33 senior (50-59).
const Y={col:4,pro:8,sen:24,last:33};
const ageOf=y=>y<=7?14+y:y<=23?Math.round(22+(y-8)*1.8):26+y;
const classOf=y=>CLASS[y-Y.col]||'';
TOURS.jr={name:'Junior Tour',mu:50,purse:15000,fee:0};TOURS.col0.name='Collegiate Tour';
const TORDER_ON=['jr','col0','p3','p2','p1','c2','c1'];
const SB=window.supabase&&window.RR_CONFIG?window.supabase.createClient(RR_CONFIG.url,RR_CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const FN=RR_CONFIG.url+'/functions/v1/game';
const CADL=['No caddy','Beginner caddy','Advanced caddy','Expert caddy'];
const DEFAULTS={mp_hole_mult:1.4,tm_on:true,tm_fee_jr:1000,tm_fee_col:2000,tm_fee_p3:4000,tm_fee_c2:5000,tm_fee_p2:8000,tm_fee_c1:12000,tm_fee_p1:20000,tm_hole_mult:3.5,tm_size:2,ace_bonus:100000,start_cash:75000,max_golfers:8,sessions_per_day:1,lessons_per_day:5,coach_max:1.5,deadline_min:5,round_min:7.5,events_per_season:8,hours:[18,19,20,21],gain_mult:1,rust_per_day:.025,recovery_per_day:15,event_fatigue:20,train_fatigue:15,purse_mult:1,fee_mult:1,sale_chance_mult:1,coach_age_yr:18,recruit_cost:5000,mp_on:true,mp_fee_jr:250,mp_fee_col:500,mp_fee_p3:1000,mp_fee_c2:1250,mp_fee_p2:2000,mp_fee_c1:3000,mp_fee_p1:5000,mp_base:0,market_size:14,market_new:4,ai_coaches:30,market_prodigy_pct:1,weekends:true,qf_on:true,qf_every_min:20,qf_fee:200,qf_base:20000,qf_add:200,qf_bonus:1000,qf_ace:1000000};
const SETN={mp_hole_mult:'Match Play: hole time (times a normal hole)',tm_on:'Team Match Play on',tm_fee_jr:'Team Match Play fee: Junior',tm_fee_col:'Team Match Play fee: College',tm_fee_p3:'Team Match Play fee: Mini Tour',tm_fee_c2:'Team Match Play fee: Senior Qualifying',tm_fee_p2:'Team Match Play fee: Challenger',tm_fee_c1:'Team Match Play fee: Champions',tm_fee_p1:'Team Match Play fee: Premier',tm_hole_mult:'Team Match Play: hole time (times a normal hole)',tm_size:'Team Match Play: golfers per team',ace_bonus:'Hole-in-one bonus in tour events and Match Play (managers\' golfers)',mp_on:'Match Play running (true or false)',mp_fee_jr:'Match Play entry fee: Junior',mp_fee_col:'Match Play entry fee: College',mp_fee_p3:'Match Play entry fee: Mini Tour',mp_fee_c2:'Match Play entry fee: Senior Qualifying',mp_fee_p2:'Match Play entry fee: Challenger',mp_fee_c1:'Match Play entry fee: Champions',mp_fee_p1:'Match Play entry fee: Premier',mp_base:'Match Play guaranteed pot added at college (other levels scale; 0 = entry fees only)',market_prodigy_pct:'Chance a market golfer is a Prodigy (%, at most 5)',market_size:'Golfers for sale from rival coaches',market_new:'New faces on the market each hour',ai_coaches:'Computer coaches available',recruit_cost:'Cost to sign a junior',qf_on:'Quick-Fire Opens running (true or false)',qf_every_min:'Minutes between Quick-Fire Opens',qf_fee:'Quick-Fire entry fee',qf_base:'Quick-Fire base pot',qf_add:'Added to the pot per entry',qf_bonus:'Most greens / up and downs / long drive bonus',qf_ace:'Hole-in-one bonus',start_cash:'Starting money for a new roster',max_golfers:'Most active golfers per roster',sessions_per_day:'Range sessions per golfer per day',lessons_per_day:'Lessons each coach gives per day',coach_max:'Best coach multiplier',deadline_min:'Entry deadline, minutes before the start',round_min:'Minutes per round',weekends:'Tour events on weekends too (true or false)',events_per_season:'(not used: there is now an event every night)',hours:'Start hours (New York time)',gain_mult:'Training gain multiplier',rust_per_day:'Rust per skipped day',recovery_per_day:'Fatigue recovered per day',event_fatigue:'Fatigue from playing an event',train_fatigue:'Fatigue from a range session',purse_mult:'Purse multiplier (new events)',fee_mult:'Entry fee multiplier (new events)',sale_chance_mult:'How keen rival coaches are to buy',coach_age_yr:'Career year a golfer may retire to coach'};
const ui={view:'loading',sel:null,msg:'',err:'',busy:false,auth:{mode:'in',email:'',msg:'',err:false,busy:false},tour:null,ev:null,watch:null,board:null,feed:null,pros:{name:'',country:'US',college:'',color:0},full:false};
const D={user:null,me:null,golfers:[],events:[],entries:[],world:null,settings:{...DEFAULTS},coaches:[],market:[],names:{}};
let poll=null,boardPoll=null;

/* ---------- small helpers ---------- */
const S=()=>D.settings;
const mine=()=>D.golfers.filter(g=>!g.retired);
const G=()=>D.golfers.find(g=>g.id===ui.sel)||mine()[0]||D.golfers[0];
const qfBase=lv=>Math.round(S().qf_base*TOURS[lv==='col'?'col0':lv].purse/TOURS.col0.purse/1000)*1000;
const QF='qf',isQ=e=>!!e&&String(e.tour).startsWith('qf'),MP='mp',isM=e=>!!e&&String(e.tour).startsWith('mp:'),TM='tm',isT=e=>!!e&&String(e.tour).startsWith('tm:'),isB=e=>isM(e)||isT(e);
const mpBase=lv=>Math.round(S().mp_base*TOURS[lv==='col'?'col0':lv].purse/TOURS.col0.purse/100)*100;
const qLevel=g=>isCol(g.tour)?'col':g.tour,lvName=lv=>lv==='col'?'College':lv==='jr'?'Junior':(TOURS[lv]||{name:lv}).name;
const canPlay=(e,g)=>isQ(e)||isB(e)?e.tour.slice(3)===qLevel(g):e.tour===g.tour;
const T=t=>t===QF?{name:'Quick-Fire Opens'}:t===MP?{name:'Match Play'}:t===TM?{name:'Team Match Play'}:String(t).startsWith('tm:')?{name:'Team Match Play · '+lvName(t.slice(3))}:String(t).startsWith('qf:')?{name:'Quick-Fire · '+lvName(t.slice(3))}:String(t).startsWith('mp:')?{name:'Match Play · '+lvName(t.slice(3))}:TOURS[t]||{name:t};
const nR=e=>(e&&e.rounds)||4;
const etFmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const when=iso=>etFmt.format(new Date(iso))+' ET';
function until(iso){let s=Math.round((Date.parse(iso)-Date.now())/1000);if(s<=0)return'now';const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d?`${d}d ${h}h`:h?`${h}h ${m}m`:m?`${m}m ${s%60}s`:`${s}s`;}
const deadline=e=>Date.parse(e.starts_at)-S().deadline_min*60e3;
const rmin=e=>Number(e&&e.round_min)||S().round_min;
const endsAt=e=>Date.parse(e.starts_at)+nR(e)*rmin(e)*60e3;
const evNow=()=>{const d=D.events.find(x=>x.id===ui.ev),s=ui.board&&ui.board.event&&ui.board.event.id===ui.ev?ui.board.event:null;return d||s?Object.assign({},d||{},s||{}):null;};
function phase(e){if(e.status==='final')return'final';const now=Date.now();if(now<deadline(e))return'open';if(now<Date.parse(e.starts_at))return'closed';return'live';}
const entryOf=(e,g)=>D.entries.find(x=>x.event_id===e.id&&x.golfer_id===g.id);
function inField(e,g){const x=entryOf(e,g);if(x)return x.status==='in';if(isQ(e)||isB(e))return false;return e.test||g.enter_rule==='all'||(g.enter_rule==='signature'&&['Signature','Finale'].includes(e.type));}
const subRowO=(g,k,ro,kid)=>`<div class="sn${kid?' kid':''}">${SUBN[k]}<small>${SUBD[k]}</small></div><div class="track"><i style="width:${clamp(g.sk[k],0,100)}%;background:${barC(g.sk[k])}"></i></div><div class="sv">${Math.round(g.sk[k])}</div>${ro?'':`<button class="btn xs" data-act="train" data-v="${k}" ${g.sessions>0?'':'disabled'}>Drill</button>`}`;
function umbO(g,u,ro){const v=um(g.sk,u);let rows;
  if(u==='s'){const pv=(g.sk.sputt+g.sk.lputt)/2;rows=['wedge','pitch','chip','bunker'].map(k=>subRowO(g,k,ro)).join('')+`<div class="sn grp">Putting</div><div class="track"><i style="width:${pv}%;background:${barC(pv)}"></i></div><div class="sv">${Math.round(pv)}</div>${ro?'':'<span></span>'}`+subRowO(g,'sputt',ro,1)+subRowO(g,'lputt',ro,1);}
  else rows=SUB[u].map(k=>subRowO(g,k,ro)).join('');
  const c=!ro&&g.coach_id&&D.coaches.find(x=>x.id===g.coach_id),m=c&&c.cr.o?coMultC(c.cr.o[u]):0;
  return `<div class="umb"><div class="uhead"><div><h2>${UMB[u]}</h2><small>${UMBD[u]}${m?` <span class="tag">×${m.toFixed(2)} with ${esc(c.name)}</span>`:''}</small></div><b>${Math.round(v)}</b></div><div class="track thick"><i style="width:${v}%;background:${barC(v)}"></i></div><div class="subs${ro?' ro':''}">${rows}</div>${ro?'':`<button class="btn sm" data-act="train" data-v="${u}" ${g.sessions>0?'':'disabled'} style="align-self:flex-start">General ${UMB[u].toLowerCase()} session</button>`}</div>`;}
const coMultC=v=>1+(S().coach_max-1)*Math.pow(clamp((v-35)/60,0,1),1.2);
const coOvrC=o=>(o.s+o.m+o.l+o.x)/4;
// what a coach is worth to buy (mirrors coachValue on the server): about 45 lessons at a fair fee for his ratings
const coachValC=o=>Math.max(5000,Math.round(350*Math.pow(1.065,coOvrC(o)-40)*45/500)*500);
const avatarO=g=>`<div class="avatar" style="--c:${COLORS[g.color]||COLORS[0]}">${esc(initials(g.name))}</div>`;
const pips=(n,of)=>`<span class="pips">${Array.from({length:of},(x,i)=>`<i class="${i<n?'f':''}"></i>`).join('')}</span>`;
const tourOf=g=>g.retired?'Retired':isCol(g.tour)?`${g.college?esc(g.college):'Choosing a college'}, college ${classOf(g.yr).toLowerCase()}`:T(g.tour).name;

/* ---------- talking to the server ---------- */
async function call(action,args){
  const {data:{session}}=await SB.auth.getSession();if(!session){go('auth');throw new Error('Please sign in.');}
  let r;try{r=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,apikey:RR_CONFIG.key},body:JSON.stringify({action,...(args||{})})});}catch(e){throw new Error("Couldn't reach the server. Check your connection.");}
  const j=await r.json().catch(()=>({error:'The server sent something odd. Try again.'}));if(!r.ok||j.error)throw new Error(j.error||'Something went wrong.');return j;
}
async function act(action,args,after){
  if(ui.busy)return;ui.busy=true;ui.err='';render();
  try{const r=await call(action,args);if(r.msg)ui.msg=r.msg;if(after)await after(r);await load();}
  catch(e){ui.err=e.message;}
  ui.busy=false;render();
}
const EVCOLS='id,tour,season,week,name,ci,type,purse,fee,pm,starts_at,status,rounds_done,field,test,round_min,rounds';
async function load(){
  const uid=D.user.id;
  const [me,gs,ev,en,w,st,co,mk,qk,qe]=await Promise.all([
    SB.from('managers').select('*').eq('id',uid).maybeSingle(),
    SB.from('golfers').select('*').eq('manager_id',uid).order('created_at'),
    // tour events from the last three days, and the quick events (Quick-Fire, Match Play) only from the last six hours:
    // there are dozens of those an hour, and one shared list would crowd the Finales out
    SB.from('events').select(EVCOLS).gte('starts_at',new Date(Date.now()-3*864e5).toISOString()).not('tour','like','qf:%').not('tour','like','mp:%').not('tour','like','tm:%').order('starts_at').limit(400),
    // only entries for the events loaded below: a busy manager has thousands of old Quick-Fire entries,
    // and the server returns at most 1,000 rows, so loading them all used to drop the newest ones
    SB.from('entries').select('*,events!inner(starts_at,tour)').eq('manager_id',uid).gte('events.starts_at',new Date(Date.now()-3*864e5).toISOString()).not('events.tour','like','qf:%').not('events.tour','like','mp:%').not('events.tour','like','tm:%'),
    SB.from('world').select('*').maybeSingle(),
    SB.from('settings').select('key,value'),
    SB.from('golfers').select('id,name,country,manager_id,stable,cr,best,tour,stats,trophies,ret_age,color,ask,listed_at').eq('retired',true).not('cr','is',null),
    SB.from('golfers').select('id,name,country,manager_id,stable,sk,yr,tour,college,ask,arch,stats,listed_at,color').not('ask','is',null).eq('retired',false).order('ask'),
    SB.from('events').select(EVCOLS).gte('starts_at',new Date(Date.now()-6*36e5).toISOString()).or('tour.like.qf:*,tour.like.mp:*,tour.like.tm:*').order('starts_at').limit(600),
    SB.from('entries').select('*,events!inner(starts_at,tour)').eq('manager_id',uid).gte('events.starts_at',new Date(Date.now()-6*36e5).toISOString()).or('tour.like.qf:*,tour.like.mp:*,tour.like.tm:*',{referencedTable:'events'}),
  ]);
  D.me=me.data;D.golfers=gs.data||[];D.events=(ev.data||[]).concat(qk.data||[]).filter(e=>e.tour!=='col1'&&e.tour!=='col2').sort((a,b)=>a.starts_at<b.starts_at?-1:a.starts_at>b.starts_at?1:0);/* the old college circuits are gone */D.entries=(en.data||[]).concat(qe.data||[]);if(en.error||qe.error){const f=await SB.from('entries').select('*').eq('manager_id',uid).order('created_at',{ascending:false}).limit(1000);D.entries=f.data||D.entries;}
  // how many golfers other managers have entered in each open Quick-Fire and Match Play, for the Events page
  D.qIn={};const qOpen=D.events.filter(e=>(isQ(e)||isB(e))&&phase(e)==='open').map(e=>e.id);
  if(qOpen.length){const {data:qa}=await SB.from('entries').select('event_id,manager_id').in('event_id',qOpen).eq('status','in').neq('manager_id',uid);
    for(const x of qa||[]){const o=D.qIn[x.event_id]||(D.qIn[x.event_id]={n:0,m:new Set(),c:{},t:0});o.n++;o.m.add(x.manager_id);o.c[x.manager_id]=(o.c[x.manager_id]||0)+1;}
    for(const id in D.qIn){const o=D.qIn[id];o.t=Object.values(o.c).reduce((a,n)=>a+Math.ceil(n/(S().tm_size||2)),0);}}
  D.world=w.data;D.coaches=co.data||[];D.market=mk.data||[];
  D.settings={...DEFAULTS};(st.data||[]).forEach(r=>D.settings[r.key]=r.value);
  if(!D.me)ui.view='join';else if(ui.view==='join'||ui.view==='loading')ui.view=mine().length?'stable':'scout';
}

/* ---------- views ---------- */
function nav(){
  const n=document.getElementById('nav');if(!n)return;
  if(!D.me||ui.view==='auth'){n.innerHTML='';return;}
  const tabs=[['stable','Roster'],['range','Range'],['events','Events'],['standings','Standings'],['market','Market'],['news','News'],['league','League'],['guide','How it works']].concat(D.me.is_admin?[['admin','Admin']]:[]);
  n.innerHTML=`<span class="cash${D.me.cash<0?' red':''}">${fmt$(D.me.cash)}</span>`+tabs.map(([v,l])=>`<button class="btn sm${ui.view===v||(v==='league'&&ui.view==='mgr')||(v==='events'&&ui.view==='board')||(v==='stable'&&ui.view==='golfer')?' on':''}" data-act="go" data-v="${v}">${l}</button>`).join('')+`<button class="btn sm" data-act="signOut">Sign out</button>`;
}
function flash(){return `${ui.err?`<p class="under" role="alert">${esc(ui.err)}</p>`:''}`;}
const V={
loading:()=>`<section class="intro"><p class="lede">Loading the world…</p></section>`,
auth(){const a=ui.auth,m=a.mode;
  const head={in:'Sign in',up:'Create an account',forgot:'Reset your password',newpass:'Choose a new password'}[m];
  const lede={in:'Range Rat is now one shared world. Your golfers play in the same timed events as everyone else, on weeknight evenings.',up:'One account, one roster. Your friends sign up the same way and you meet them in the field.',forgot:"Enter your email and we'll send a link to set a new password.",newpass:'Enter a new password for your account.'}[m];
  const btn={in:'Sign in',up:'Create account',forgot:'Send reset link',newpass:'Save password'}[m];
  return `<section class="intro"><p class="eyebrow">Range Rat online</p><h1>${head}</h1><p class="lede">${lede}</p></section>
<form class="stack authform" id="authForm" novalidate>
 ${m!=='newpass'?`<label class="field" for="aEmail"><span>Email</span><input id="aEmail" type="email" autocomplete="email" required value="${esc(a.email||'')}"></label>`:''}
 ${m!=='forgot'?`<label class="field" for="aPass"><span>Password</span><input id="aPass" type="password" autocomplete="${m==='in'?'current-password':'new-password'}" minlength="8" required></label>`:''}
 ${a.msg?`<p class="${a.err?'under':'hand'}" role="status">${esc(a.msg)}</p>`:''}
 <div class="row" style="justify-content:flex-start"><button class="btn primary" type="submit" ${a.busy?'disabled':''}>${a.busy?'Working…':btn}</button></div>
 <div class="row" style="justify-content:flex-start">${m==='in'?'<button class="btn sm" type="button" data-act="authMode" data-v="up">Create an account</button><button class="btn sm" type="button" data-act="authMode" data-v="forgot">Forgot password</button>':m!=='newpass'?'<button class="btn sm" type="button" data-act="authMode" data-v="in">Back to sign in</button>':''}</div>
 <p class="muted small"><button class="linkbtn" type="button" data-act="go" data-v="guide">How the game works</button> · Your old single-player career is still at <a href="solo/">the solo game</a>.</p>
</form>`;},
join:()=>`<section class="intro"><p class="eyebrow">Welcome to the shared world</p><h1>Name your roster</h1><p class="lede">Everyone starts fresh with ${fmt$(S().start_cash)}. Events run on weeknight evenings, 6 to 10pm New York time, and everyone's golfers play in the same fields.</p></section>
<section class="sec stack"><label class="field" for="stName"><span>Roster name</span><input id="stName" type="text" maxlength="30" value="${esc(ui.pros.stable||'')}" placeholder="e.g. Back Nine Management"></label>${flash()}<div class="row" style="justify-content:flex-start"><button class="btn primary" data-act="join" ${ui.busy?'disabled':''}>Open the roster</button></div><p class="muted small"><button class="linkbtn" type="button" data-act="go" data-v="guide">How the game works</button> · Your old single-player career is still at <a href="solo/">the solo game</a>.</p></section>`,
scout(){const p=D.me.prospect,full=mine().length>=S().max_golfers,P=ui.pros;
  if(!p)return `<section class="intro"><h1>Scout a junior</h1><p class="lede">Signing a junior costs ${fmt$(S().recruit_cost)}. He starts at 15 on the Junior Tour.</p></section><section class="sec">${flash()}<button class="btn primary" data-act="scout" data-v="fresh" ${full||ui.busy?'disabled':''}>Send the scouts out</button>${full?`<p class="muted small">Your roster is full at ${S().max_golfers} active golfers.</p>`:''}</section>`;
  const g={sk:p.sk,sessions:0};
  return `<section class="intro"><p class="eyebrow">Junior prospect</p><h1>${esc(p.arch)}</h1><p class="lede">Signing fee ${fmt$(S().recruit_cost)}. He starts at 15: three seasons on the Junior Tour, then college offers at 18, four college seasons, sixteen as a pro and ten on the senior circuit. One season is one week.</p></section>
<section class="sec prospect stack">
 <label class="field" for="gname"><span>Name</span><input id="gname" type="text" maxlength="22" value="${esc(P.name)}" placeholder="Tucker Hale"></label>
 <label class="field" for="gcountry"><span>Country</span><select id="gcountry">${Object.keys(COUNTRIES).sort((a,b)=>COUNTRIES[a].localeCompare(COUNTRIES[b])).map(c=>`<option value="${c}"${c===P.country?' selected':''}>${COUNTRIES[c]}</option>`).join('')}</select></label>
 <div class="field"><span>Shirt</span><div class="swatches">${COLORS.slice(0,6).map((c,i)=>`<button class="sw${i===P.color?' on':''}" style="background:${c}" data-act="pcolor" data-v="${i}" aria-label="Shirt colour ${i+1}"></button>`).join('')}</div></div>
 <p class="hand">Ceiling grades: short game ${p.grade.s}, irons ${p.grade.m}, long game ${p.grade.l}, the head ${p.grade.x}. The scouts have been wrong before.</p>
 ${flash()}
 <div class="row"><button class="btn" data-act="scout" ${D.me.rerolls&&!ui.busy?'':'disabled'}>Scout another (${D.me.rerolls} left)</button><button class="btn primary" data-act="sign" ${full||ui.busy||D.me.cash<S().recruit_cost?'disabled':''}>Sign him for ${fmt$(S().recruit_cost)}</button></div>
</section><section class="umbs">${'smlx'.split('').map(u=>umbO(g,u,true)).join('')}</section>`;},
stable(){
  if(!D.golfers.length)return V.scout();
  const act=mine(),coaches=D.golfers.filter(x=>x.retired);
  const card=g=>`<button class="rcard" data-act="golfer" data-v="${g.id}"><div class="rtop">${avatarO(g)}<div class="rwho"><b>${flagHTML(g.country)}${esc(g.name)}</b><span>Age ${ageOf(g.yr)} \u00b7 ${tourOf(g)}</span></div><div class="rovr"><b>${Math.round(ovr(g.sk))}</b><span>OVR</span></div></div>
  <div class="rbars">${'smlx'.split('').map(u=>{const v=um(g.sk,u);return `<span class="rl">${UMB[u]}</span><span class="track"><i style="width:${clamp(v,0,100)}%;background:${barC(v)}"></i></span><b>${Math.round(v)}</b>`;}).join('')}</div>
  ${g.offers?'<span class="tag hot">College offers waiting</span>':g.sessions>0?`<span class="tag">${g.sessions} range session${g.sessions>1?'s':''} left today</span>`:''}</button>`;
  return `<section class="intro"><p class="eyebrow">Locker room</p><h1>${esc(D.me.name)}</h1><p class="lede">${act.length} of ${S().max_golfers} roster spots used. Tap a golfer for his full page.</p><div class="row" style="justify-content:flex-start"><button class="btn primary sm" data-act="go" data-v="range">Range and lessons</button>${act.length<S().max_golfers?'<button class="btn sm" data-act="go" data-v="scout">+ Scout a junior</button>':''}</div></section>
<section class="roster">${act.map(card).join('')}</section>
${coaches.length?`<section class="sec"><h2>Your coaches</h2><div class="shop">${coaches.map(c=>`<div class="item"><b>${flagHTML(c.country)}${esc(c.name)}</b><span>${c.cr&&c.cr.o?`Short ${c.cr.o.s}, irons ${c.cr.o.m}, long ${c.cr.o.l}, head ${c.cr.o.x}.`:'Retired.'} ${c.cr?`${c.cr.left} lessons left today.`:''}</span><button class="btn sm" data-act="golfer" data-v="${c.id}">His page</button></div>`).join('')}</div></section>`:''}`;},
golfer(){
  if(!D.golfers.length)return V.scout();
  const g=G();ui.sel=g.id;
  const picker=`<div class="row" style="justify-content:flex-start;flex-wrap:wrap">${D.golfers.map(x=>`<button class="btn sm${x.id===g.id?' on':''}" data-act="sel" data-v="${x.id}">${esc(x.name)}${x.retired?' (coach)':''}</button>`).join('')}${mine().length<S().max_golfers?'<button class="btn sm" data-act="go" data-v="scout">+ Scout a junior</button>':''}</div>`;
  const head=`<section class="sec"><button class="btn sm" data-act="go" data-v="stable">\u2190 Roster</button><div class="who">${avatarO(g)}<div><h1>${flagHTML(g.country)} ${esc(g.name)}</h1><p class="muted">${g.arch?esc(g.arch)+'. ':''}Age ${ageOf(g.yr)}. ${tourOf(g)}. Overall ${Math.round(ovr(g.sk))}.</p></div></div>${picker}</section>`;
  if(g.retired)return head+coachMine(g);
  if(!ui.myRep||ui.myRep.id!==g.id)loadMyReport(g.id);
  const scout=`<section class="sec"><h2>Scouting report</h2>${reportBody(g,ui.myRep&&ui.myRep.id===g.id?ui.myRep.r:null)}</section>`;
  const ups=D.events.filter(e=>isQ(e)&&canPlay(e,g)&&phase(e)==='open').slice(0,2).concat(D.events.filter(e=>e.tour===g.tour&&e.status!=='final').slice(0,5));
  return head+scout+`
<section class="sec"><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn primary sm" data-act="go" data-v="range">Range and lessons</button><span class="muted small">${g.sessions>0?`${g.sessions} range session${g.sessions>1?'s':''} left today.`:'Done on the range for today.'} ${g.coach_id&&D.coaches.find(x=>x.id===g.coach_id)?`Coach: ${esc(D.coaches.find(x=>x.id===g.coach_id).name)}.`:'No coach.'}</span></div></section>
<section class="sec">
 <h2>His events</h2>
 <label class="field" for="eRule"><span>Enter him automatically in</span><select id="eRule" data-change="rule">${[['all','Every event'],['signature','Signature events and the Finale only'],['none','Nothing: I enter him by hand']].map(([v,l])=>`<option value="${v}"${g.enter_rule===v?' selected':''}>${l}</option>`).join('')}</select></label>
 ${ups.length?`<div class="shop">${ups.map(e=>evItem(e,g)).join('')}</div>`:'<p class="muted">Nothing scheduled yet on his tour.</p>'}
 <p class="muted small">Entries close ${S().deadline_min} minutes before the start. Auto entries pay the fee when entries close.</p>
</section>
<section class="sec"><h2>Equipment and caddy</h2><div class="shop">${'smlx'.split('').map(u=>{const l=(g.eq||{})[u]||0,N=u==='x'?CADL:EQL;return `<div class="item"><b>${u==='x'?'Caddy':EQN[u]}</b><span>Now: ${N[l]}.${l<3?` Next: ${N[l+1]}.`:''}${u==='x'?' Steadies the mental game: course management, nerve under pressure, composure and bouncing back.':''}</span>${l<3?`<button class="btn sm" data-act="gear" data-v="${u}" ${D.me.cash<EQC[l]||ui.busy?'disabled':''}>Upgrade for ${fmt$(EQC[l])}</button>`:'<span class="tag">Best available</span>'}</div>`;}).join('')}</div></section>
<section class="sec"><h2>His career</h2>${careerHTML(g)}</section>
<section class="sec"><h2>Transfer</h2>${sellHTML(g)}</section>
${g.yr>=S().coach_age_yr?`<section class="sec"><h2>Retire to coach</h2><p class="muted">He's old enough to hang up his spikes and coach. His lessons are free for your golfers, and other managers pay you to book him.</p>${ui.confirm==='retire'?`<div class="row" style="justify-content:flex-start"><button class="btn primary sm" data-act="retire">Yes, retire him</button><button class="btn sm" data-act="confirm" data-v="">Keep playing</button></div>`:'<button class="btn sm" data-act="confirm" data-v="retire">Retire him</button>'}</section>`:''}
${offersHTML(g)}${isCol(g.tour)&&!g.offers?`<section class="sec"><h2>College</h2><label class="field" for="hcollege"><span>Plays for</span><select id="hcollege" data-change="college">${g.college?'':'<option selected disabled>Choose from his offers</option>'}${COLLEGES.slice().sort().map(x=>`<option${x===g.college?' selected':''}>${esc(x)}</option>`).join('')}</select></label></section>`:''}`;},
range(){
  const act=mine();if(!act.length)return `<section class="intro"><h1>The range</h1><p class="lede">Sign a junior first, then bring him here to practise.</p><button class="btn primary" data-act="go" data-v="scout">Scout a junior</button></section>`;
  const g=G()&&!G().retired?G():act[0];ui.sel=g.id;
  const st=clamp(5-Math.round((g.fatigue||0)/20),0,5),o=g.orders||{};
  const picker=`<div class="row" style="justify-content:flex-start;flex-wrap:wrap">${act.map(x=>`<button class="btn sm${x.id===g.id?' on':''}" data-act="sel" data-v="${x.id}">${esc(x.name)}${x.sessions>0?` \u00b7 ${x.sessions}`:' \u2713'}</button>`).join('')}</div>`;
  return `<section class="intro"><p class="eyebrow">Range and lessons</p><h1>${flagHTML(g.country)} ${esc(g.name)}</h1><p class="muted">Age ${ageOf(g.yr)}. ${tourOf(g)}. Overall ${Math.round(ovr(g.sk))}. <button class="linkbtn" data-act="golfer" data-v="${g.id}">His page</button></p>${picker}<p class="muted small">The number by each name is range sessions left today.</p></section>
<section class="sec">
 <h2>Today on the range</h2>
 <div class="row"><span class="meters"><span class="meter"><span class="lab">Stamina</span>${pips(st,5)}<b>${st}/5</b></span><span class="meter"><span class="lab">Range session</span>${pips(Math.max(0,g.sessions),S().sessions_per_day)}<b>${Math.max(0,g.sessions)}/${S().sessions_per_day}</b></span></span></div>
 <p class="hand trainlog">${esc(ui.msg||(g.sessions>0?'One session a day. A drill pushes one skill hard; a general session lifts a whole area a little. Gains shrink as he nears his ceiling.':'He has had his session today. A new one comes at midnight New York time. If you leave it unused, his standing orders spend it.'))}</p>
 ${flash()}
 <div class="row" style="justify-content:flex-start"><button class="btn sm" data-act="train" data-v="rest" ${g.sessions>0&&!ui.busy?'':'disabled'}>Give him a day off</button><span class="muted small">Areas he doesn't work on get slightly rusty each day.</span></div>
</section>
${coachBoard(g)}
<section class="umbs">${'smlx'.split('').map(u=>umbO(g,u)).join('')}</section>
<section class="sec">
 <h2>Standing orders</h2>
 <p class="muted small">If his session goes unused by midnight, he follows these on his own.</p>
 <div class="row" style="justify-content:flex-start;flex-wrap:wrap">
  <label class="field" for="oFocus"><span>Work on</span><select id="oFocus"><option value="">Nothing (session is wasted)</option><option value="auto"${o.focus==='auto'?' selected':''}>His weakest area</option>${'smlx'.split('').map(u=>`<option value="${u}"${o.focus===u?' selected':''}>${UMB[u]} (general)</option>`).join('')}${KEYS.map(k=>`<option value="${k}"${o.focus===k?' selected':''}>Drill: ${SUBN[k]} (${UMB[umbOf(k)]})</option>`).join('')}<option value="rest"${o.focus==='rest'?' selected':''}>Rest</option></select></label>
  <label class="field" for="oRest"><span>Rest instead when stamina is below</span><select id="oRest">${[0,1,2,3].map(n=>`<option value="${n}"${(o.rest_below||0)===n?' selected':''}>${n?n+'/5':'never'}</option>`).join('')}</select></label>
 </div>
 <div class="row" style="justify-content:flex-start"><button class="btn sm" data-act="orders" ${ui.busy?'disabled':''}>Save orders</button></div>
</section>
`;},
events(){
  const tours=[...new Set(D.events.map(e=>isQ(e)?QF:isM(e)?MP:isT(e)?TM:e.tour))].sort((a,b)=>TORDER_ON.indexOf(a)-TORDER_ON.indexOf(b));
  const t=ui.tour||'all',list=D.events.filter(e=>t==='all'||(t===QF?isQ(e):t===MP?isM(e):t===TM?isT(e):e.tour===t));
  const qn=D.events.filter(e=>isQ(e)&&phase(e)==='open')[0],qset=qn?D.events.filter(e=>isQ(e)&&e.starts_at===qn.starts_at).sort((a,b)=>['jr','col','p3','p2','p1','c2','c1'].indexOf(a.tour.slice(3))-['jr','col','p3','p2','p1','c2','c1'].indexOf(b.tour.slice(3))):[];
  const quick=e=>t==='all'&&(isQ(e)||isB(e)),live=list.filter(e=>['live','closed'].includes(phase(e))&&e.status!=='final'&&!quick(e)),next=list.filter(e=>phase(e)==='open'&&!isQ(e)&&!isB(e)).slice(0,12),done=list.filter(e=>e.status==='final'&&!quick(e)).reverse().slice(0,12);
  const row=e=>`<div class="item"><b>${esc(e.name)}${e.test?' <span class="tag">Test</span>':''}</b><span>${T(e.tour).name}. ${COURSES[e.ci].name}. ${when(e.starts_at)}. Purse ${fmt$(e.purse)}${e.fee?`, entry ${fmt$(e.fee)}`:''}.</span><span>${mineIn(e)}</span><button class="btn sm" data-act="board" data-v="${e.id}">${e.status==='final'?'Results':phase(e)==='open'?'Field':'Watch'}</button></div>`;
  return `<section class="intro"><p class="eyebrow">Season ${D.world?D.world.season:1}${D.world?`, through ${new Date(D.world.season_end+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric'})}`:''}</p><h1>Events</h1><p class="lede">Every event starts on the clock and takes about ${Math.round(4*S().round_min)} minutes: four rounds, one hole every ${Math.round(S().round_min*60/18)} seconds. Everyone watches the same holes at the same time.</p></section>
<section class="sec"><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn sm${t==='all'?' on':''}" data-act="tour" data-v="all">All tours</button>${tours.map(x=>`<button class="btn sm${t===x?' on':''}" data-act="tour" data-v="${x}">${T(x).name}</button>`).join('')}</div></section>
${quickBoard(t)}
${live.length?`<section class="sec"><h2>On the course now</h2><div class="shop">${live.map(row).join('')}</div></section>`:''}
<section class="sec"><h2>Coming up</h2>${next.length?`<div class="shop">${next.map(row).join('')}</div>`:'<p class="muted">Nothing scheduled.</p>'}</section>
${done.length?`<section class="sec"><h2>Finished</h2><div class="shop">${done.map(row).join('')}</div></section>`:''}`;},
board(){const b=ui.board,e=evNow();
  if(!e)return '<section class="sec"><p class="muted">Loading the board…</p></section>';
  const back='<button class="btn sm" data-act="go" data-v="events">← Events</button>';
  const ph=phase(e);
  const head=`<section class="intro"><p class="eyebrow">${T(e.tour).name}${e.test?' · test event':''}</p><h1>${esc(e.name)}</h1><p class="lede">${COURSES[e.ci].name}: ${COURSES[e.ci].blurb} Starts ${when(e.starts_at)}. ${isT(e)?`Teams of ${(S().tm_size||2)===2?"two":S().tm_size}, best ball: each hole the team's lowest score counts. Nine holes a match, knockout. ${e.status==='open'?`Pot so far ${fmt$(e.fee*tmTeams(e).teams)}`:`Pot ${fmt$(e.purse)}`}.`:isM(e)?`Knockout match play, nine holes a match. ${e.status==='open'?`Pot so far ${fmt$((e.purse||0)+e.fee*((ui.preview&&ui.preview.eid===e.id)?ui.preview.rows.length:0))}`:`Pot ${fmt$(e.purse)}`}.`:isQ(e)?`Two rounds, no cut. ${e.status==='open'?`Pot so far ${fmt$(qfBase(e.tour.slice(3))+S().qf_add*((ui.preview&&ui.preview.eid===e.id)?ui.preview.rows.length:0))}`:`Pot ${fmt$(e.purse)}`}.`:`Purse ${fmt$(e.purse)}.`}${!isQ(e)&&S().ace_bonus>0?` Any hole in one by a manager's golfer earns a ${fmt$(S().ace_bonus)} bonus.`:''}</p>${back}</section>`;
  if(isB(e)&&ph!=='open')return head+mpView(e);
  if(ph==='open'&&isT(e))return head+tmOpenHTML(e);
  if(ph==='open'){const gs=mine().filter(g=>canPlay(e,g)),todo=gs.filter(g=>!inField(e,g)),cost=(e.test?0:e.fee)*todo.length;
    return head+`<section class="sec"><h2>Entries close in ${until(new Date(deadline(e)).toISOString())}</h2>${todo.length>1?`<div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin-bottom:8px"><button class="btn primary sm" data-act="enterAll" data-v="${e.id}" ${ui.busy||D.me.cash<cost?'disabled':''}>Enter all ${todo.length}${cost?` for ${fmt$(cost)}`:''}</button>${D.me.cash<cost?'<span class="muted small">Not enough money for all of them.</span>':''}</div>`:''}${gs.length?`<div class="shop">${gs.map(g=>evItem(e,g,true)).join('')}</div>`:'<p class="muted">None of your golfers play on this tour.</p>'}${flash()}</section><div class="fieldpay">${previewHTML(e)}${isM(e)?mpPayHTML(e):payoutHTML(e)}</div>`;}
  if(ph==='closed')return head+teeHTML(e,b);
  if(!b||!b.players)return head+'<section class="sec"><p class="muted">Loading the board…</p></section>';
  if(!b.players.length)return head+`<section class="sec"><p class="muted">Setting the field. The first tee time is ${until(e.starts_at)} away.</p></section>`;
  return head+(e.status==='final'?podiumHTML(b,e):'')+watchHTML(b,e)+`<div id="boardBox">${boxHTML(b,e)}</div>`;},
standings(){const tours=TORDER_ON,t=ui.tour&&ui.tour!=='all'?ui.tour:(G()&&!G().retired?G().tour:'p1');ui.tour=t;
  const rows=ui.stand&&ui.stand.t===t?ui.stand.rows:null;if(!rows)loadStand(t);
  return `<section class="intro"><p class="eyebrow">Season ${D.world?D.world.season:1}</p><h1>Standings</h1><p class="lede">Points from finished events this season. The season ends at midnight after Sunday's Finale (New York time). Then everyone ages a year, season bonuses are paid, the top ${Math.round(FIELD*.2)} on each pro tour go up and the bottom ${Math.round(FIELD*.2)} go down, and college seniors turn pro: the top ${Math.round(FIELD*.2)} in the Collegiate standings start on the Challenger Tour, the rest on the Mini Tour.</p></section>
<section class="sec"><div class="row" style="justify-content:flex-start;flex-wrap:wrap">${tours.map(x=>`<button class="btn sm${t===x?' on':''}" data-act="stour" data-v="${x}">${T(x).name}</button>`).join('')}</div></section>
<section class="sec">${!rows?'<p class="muted">Loading…</p>':!rows.length?'<p class="muted">No finished events on this tour yet this season.</p>':`<div class="scroll tall"><table class="tbl"><thead><tr><th class="num">#</th><th>Golfer</th><th>Roster</th><th class="num">Points</th><th class="num">Wins</th><th class="num">Earned</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.golfers&&r.golfers.manager_id===D.user.id?'me':r.golfers&&r.golfers.manager_id?'now':''}"><td class="num">${i+1}</td><td>${r.golfers?flagHTML(r.golfers.country)+esc(r.golfers.name)+ageTag(r.golfers.yr,t):'?'}</td><td class="small">${esc(r.golfers&&r.golfers.stable||'Tour regular')}</td><td class="num">${fmtPts(r.pts)}</td><td class="num">${r.wins||''}</td><td class="num">${fmt$(r.earn)}</td></tr>`).join('')}</tbody></table></div>`}</section>`;},
market(){const full=mine().length>=S().max_golfers,list=D.market.filter(m=>m.manager_id!==D.user.id),own=D.market.filter(m=>m.manager_id===D.user.id),cl=D.coaches.filter(c=>c.ask&&c.manager_id!==D.user.id).sort((a,b)=>a.ask-b.ask),cown=D.coaches.filter(c=>c.ask&&c.manager_id===D.user.id);
  return `<section class="intro"><h1>Transfer market</h1><p class="lede">Golfers already playing on the tours, looking for a manager, plus any listed by other managers. Buying from a manager pays them directly.</p></section>
${own.length||cown.length?`<section class="sec mine-list"><h2>Your listings</h2><div class="shop">${cown.map(c=>`<div class="item"><b><button class="linkbtn" data-act="golfer" data-v="${c.id}">${flagHTML(c.country)}${esc(c.name)}</button></b><span>Coach. Coaching overall ${Math.round(coOvrC(c.cr.o||{s:0,m:0,l:0,x:0}))}. Worth about ${fmt$(coachValC(c.cr.o||{s:0,m:0,l:0,x:0}))}.</span><span class="tag hot">${fmt$(c.ask)}</span><button class="btn sm" data-act="golfer" data-v="${c.id}">Change price</button></div>`).join('')}${own.map(m=>{const val=valueOfC(m.sk,m.yr);return `<div class="item"><b><button class="linkbtn" data-act="golfer" data-v="${m.id}">${flagHTML(m.country)}${esc(m.name)}</button></b><span>Age ${ageOf(m.yr)}. ${isCol(m.tour)?`College ${classOf(m.yr).toLowerCase()}`:T(m.tour).name}. Overall ${Math.round(ovr(m.sk))}. Market value ${fmt$(val)}.</span><span>Listed ${until(new Date(Date.now()+(Date.now()-Date.parse(m.listed_at))).toISOString())} ago. Other managers and rival coaches can see him.</span><span class="tag hot">${fmt$(m.ask)}</span><button class="btn sm" data-act="golfer" data-v="${m.id}">Change price</button><button class="btn sm" data-act="unlistid" data-v="${m.id}" ${ui.busy?'disabled':''}>Take him off</button></div>`;}).join('')}</div></section>`:''}
<section class="sec">${flash()}${ui.msg?`<p class="hand">${esc(ui.msg)}</p>`:''}
<div class="shop"><div class="item"><b>Junior prospect</b><span>${fmt$(S().recruit_cost)}. Starts at 15 on the Junior Tour and is yours to develop.</span><button class="btn sm" data-act="go" data-v="scout" ${full?'disabled':''}>Scout juniors</button></div></div>
 <div class="roster mkt">${list.map(m=>{const val=valueOfC(m.sk,m.yr),d=m.ask/val;return `<div class="rcard"><div class="rtop">${avatarO(m)}<div class="rwho"><b><button class="linkbtn" data-act="player" data-v="${m.id}">${flagHTML(m.country)}${esc(m.name)}</button></b><span>Age ${ageOf(m.yr)} \u00b7 ${isCol(m.tour)?`College ${(classOf(m.yr)||'').toLowerCase()}`:T(m.tour).name}</span><span>${m.manager_id?`Sold by ${esc(m.stable||'a manager')} <span class="tag">Manager</span>`:m.stable?`Sold by ${esc(m.stable)}`:`Unsigned ${isCol(m.tour)&&m.college?esc(m.college)+' player':'tour regular'}`}</span></div><div class="rovr"><b>${Math.round(ovr(m.sk))}</b><span>OVR</span></div></div>
  <div class="rbars">${'smlx'.split('').map(u=>{const v=um(m.sk,u);return `<span class="rl">${UMB[u]}</span><span class="track"><i style="width:${clamp(v,0,100)}%;background:${barC(v)}"></i></span><b>${Math.round(v)}</b>`;}).join('')}</div>
  <div class="mprice"><b>${fmt$(m.ask)}</b><span class="tag${d<.93?' hot':''}">${d<.93?'Under value':d>1.1?'Over value':'Fair price'}</span></div>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn sm" data-act="player" data-v="${m.id}">Scouting report</button>${buyBtn(m,full,'Sign him')}</div></div>`;}).join('')}</div>
<p class="muted small">${full?`Your roster is full at ${S().max_golfers} active golfers. `:''}Rival coaches buy listed golfers too, so the list changes day to day.</p></section>
<section class="sec"><h2>Coaches for sale</h2><p class="muted small">Retired players who coach. A coach doesn't take a roster place: he teaches your golfers for free and earns his lesson fee from other rosters. He'll never play again, so he costs less than a player.</p>
 ${cl.length?`<div class="cgrid">${cl.map(c=>{const o=c.cr.o||{s:0,m:0,l:0,x:0};return `<div class="ccard"><div class="chead"><b>${flagHTML(c.country)}${esc(c.name)}</b><span class="muted small">${c.manager_id?`Sold by ${esc(c.stable||'a manager')} <span class="tag">Manager</span>`:esc(c.stable||'Computer coach')}</span></div><div class="cbars">${[['s','Short'],['m','Irons'],['l','Long'],['x','Head']].map(([u,l])=>`<span>${l}</span><span class="track"><i style="width:${o[u]||0}%;background:${barC(o[u]||0)}"></i></span><b>${o[u]??'\u2013'}</b>`).join('')}</div><p class="small">Coaching overall <b>${Math.round(coOvrC(o))}</b>. Lesson fee ${fmt$(c.cr.price)}; ${c.cr.given||0} lessons given. Worth about ${fmt$(coachValC(o))}.</p><div class="cfoot"><b>${fmt$(c.ask)}</b>${buyBtn(c,false,'Hire him')}</div></div>`;}).join('')}</div>`:'<p class="muted">No coaches for sale right now. A computer coach comes up for sale most hours.</p>'}</section>`;},
guide:()=>guideHTML(),
league:()=>leagueHTML(),
mgr:()=>mgrHTML(),
player:()=>playerHTML(),
news:()=>`<section class="intro"><h1>News</h1><p class="lede">${esc(D.me.name)}</p></section><section class="sec">${(D.me.news||[]).length?(D.me.news||[]).map(n=>`<p>${esc(n.t)} <span class="muted small">${when(n.at)}</span></p>`).join(''):'<p class="muted">Nothing yet.</p>'}
 <h2>Roster name</h2><div class="row" style="justify-content:flex-start"><input id="stName" type="text" maxlength="30" value="${esc(D.me.name)}"><button class="btn sm" data-act="rename">Rename</button></div>${flash()}</section>`,
admin(){const s=S();
  return `<section class="intro"><p class="eyebrow">Admin</p><h1>World settings</h1><p class="lede">Changes apply from the next clock tick. Money settings apply to events scheduled after the change. Every change is logged.</p></section>
<section class="sec">${flash()}${ui.msg?`<p class="hand">${esc(ui.msg)}</p>`:''}<div class="shop">${Object.keys(DEFAULTS).map(k=>`<div class="item"><b>${SETN[k]}</b><span class="muted small">Default ${esc(JSON.stringify(DEFAULTS[k]))}</span><input type="text" id="set_${k}" value="${esc(Array.isArray(s[k])?s[k].join(', '):s[k])}"><button class="btn sm" data-act="aset" data-v="${k}">Save</button></div>`).join('')}</div></section>
<section class="sec"><h2>Test event</h2><p class="muted small">Pays no money and no points. All managers' golfers on that tour are entered.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><select id="tTour">${TORDER_ON.map(t=>`<option value="${t}">${T(t).name}</option>`).join('')}</select><label class="field" for="tMin"><span>Starts in (minutes)</span><input id="tMin" type="number" min="6" value="7"></label><button class="btn sm" data-act="atest">Create</button></div></section>
<section class="sec"><h2>Change log</h2><button class="btn sm" data-act="alog">Load</button>${ui.log?`<div class="scroll"><table class="tbl"><tbody>${ui.log.map(l=>`<tr><td class="small">${when(l.at)}</td><td>${SETN[l.key]||l.key}</td><td class="small">${esc(JSON.stringify(l.old))} → ${esc(JSON.stringify(l.new))}</td></tr>`).join('')}</tbody></table></div>`:''}</section>`;},
};
function valueOfC(sk,yr){const o=ovr(sk),a=yr<=3?[.1,.14,.18][yr-1]:yr<=7?[.2,.3,.45,.7][yr-4]:yr<=15?1.15-(yr-8)*.02:yr<=23?1-(yr-15)*.07:Math.max(.04,.3-(yr-24)*.03);return Math.max(1000,Math.round(50000*Math.pow(5,(o-64)/6)*a/500)*500);}
function mineIn(e){const gs=mine().filter(g=>canPlay(e,g));if(!gs.length)return'';const inn=gs.filter(g=>inField(e,g));return inn.length?`Yours in: ${inn.map(g=>esc(g.name)).join(', ')}.`:'None of yours entered.';}
function evItem(e,g,full){const ph=phase(e),inn=inField(e,g),x=entryOf(e,g);
  const state=ph!=='open'?(e.status==='final'?'Finished':'Entries closed'):inn?(x&&x.status==='in'?'Entered':'Entered automatically'):'Not entered';
  return `<div class="item"><b>${full?esc(g.name):esc(e.name)}${e.test?' <span class="tag">Test</span>':''}</b><span>${full?'':`${COURSES[e.ci].name}. ${when(e.starts_at)}. `}${e.type}. ${e.fee&&!e.test?`Entry ${fmt$(e.fee)}. `:'No entry fee. '}${ph==='open'?`Closes in ${until(new Date(deadline(e)).toISOString())}.`:''}</span><span class="tag${inn&&ph==='open'?' hot':''}">${state}</span>${ph==='open'?(inn?`<button class="btn sm" data-act="withdraw" data-v="${e.id}" data-g="${g.id}" ${ui.busy?'disabled':''}>Withdraw</button>`:`<button class="btn sm" data-act="enter" data-v="${e.id}" data-g="${g.id}" ${ui.busy?'disabled':''}>Enter</button>`):`<button class="btn sm" data-act="board" data-v="${e.id}">${e.status==='final'?'Results':'Watch'}</button>`}</div>`;}
function careerHTML(g){const s=Object.assign({ev:0,cuts:0,wins:0,top10:0,earn:0,rounds:0,par:0,low:null},g.stats);
  return `${s.qf_ev?`<p class="muted small">Quick-Fire Opens: ${s.qf_ev} played, ${s.qf_wins||0} won, ${fmt$(s.qf_earn||0)} earned${s.qf_aces?`, ${s.qf_aces} hole${s.qf_aces>1?'s':''} in one`:''}. These don't count toward his career record.</p>`:''}<div class="stats"><div><b>${s.ev}</b><span>Events</span></div><div><b>${s.wins}</b><span>Wins</span></div><div><b>${s.top10}</b><span>Top tens</span></div><div><b>${s.ev?s.cuts+'/'+s.ev:'–'}</b><span>Cuts made</span></div><div><b>${s.low===null?'–':fmtPar(s.low)}</b><span>Low round</span></div><div><b>${fmt$(s.earn)}</b><span>Earned</span></div><div><b>${s.holes?Math.round(100*s.gir/s.holes)+'%':'\u2013'}</b><span>Greens in reg.</span></div><div><b>${s.fwc?Math.round(100*s.fw/s.fwc)+'%':'\u2013'}</b><span>Fairways hit</span></div><div><b>${s.holes?(s.putts/s.holes).toFixed(2):'\u2013'}</b><span>Putts per hole</span></div><div><b>${(s.aces||0)+(s.qf_aces||0)}</b><span>Holes in one</span></div></div>
  ${(g.hist||[]).length?`<div class="scroll"><table class="tbl"><thead><tr><th>Event</th><th class="num">R1</th><th class="num">R2</th><th class="num">R3</th><th class="num">R4</th><th class="num">Par</th><th class="num">Pos</th><th class="num">Won</th></tr></thead><tbody>${g.hist.slice(0,12).map(x=>`<tr><td>${esc(x.n)}</td>${[0,1,2,3].map(j=>`<td class="num">${x.r[j]||''}</td>`).join('')}<td class="num${x.par<0?' under':''}">${fmtPar(x.par)}</td><td class="num">${x.pos}</td><td class="num">${x.pay?fmt$(x.pay):''}</td></tr>`).join('')}</tbody></table></div>`:''}`;}
function sellHTML(g){if(!canSellC(g))return '<p class="muted">Junior Tour golfers can’t be sold until they reach college at 18.</p>';const val=valueOfC(g.sk,g.yr);
  return g.ask?`<p>Listed at ${fmt$(g.ask)} (market value ${fmt$(val)}). Rival coaches look once a day; other managers can buy him any time.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><input id="askIn" type="number" min="1000" step="500" value="${g.ask}"><button class="btn sm" data-act="list">Change price</button><button class="btn sm" data-act="unlist">Take him off the market</button></div>`
  :`<p class="muted">Market value about ${fmt$(val)}. A rival coach will take him now for ${fmt$(Math.round(val*.6/100)*100)}.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><input id="askIn" type="number" min="1000" step="500" value="${val}"><button class="btn sm" data-act="list">List him</button>${ui.confirm==='qs'?'<button class="btn sm primary" data-act="quicksell">Yes, sell now</button>':'<button class="btn sm" data-act="confirm" data-v="qs">Quick sale</button>'}</div>`;}
const canSellC=g=>g.yr>=4;
function coachMine(g){const cr=g.cr;if(!cr)return '<section class="sec"><p class="muted">Retired.</p></section>';const o=cr.o||{};
  return `<section class="sec"><h2>Coaching</h2><p class="lede">${esc(g.name)} coaches for you. His lessons are free for your golfers. ${cr.given||0} lessons to other rosters so far, for ${fmt$(cr.earn||0)}.</p>
  <p>Short game ${o.s??'–'}, irons ${o.m??'–'}, long game ${o.l??'–'}, the head ${o.x??'–'}. ${cr.left} lessons left today.</p>
  <div class="row" style="justify-content:flex-start"><label class="field" for="feeIn"><span>Fee per lesson</span><input id="feeIn" type="number" min="50" step="50" value="${cr.price}"></label><button class="btn sm" data-act="fee">Set fee</button></div>${flash()}
  <p class="muted small">Other managers book him from the range for their own golfers; a fee near what he's worth books best.</p></section>
  <section class="sec"><h2>Sell him</h2>${coachSellHTML(g)}</section>`;}
function coachSellHTML(g){const val=g.cr&&g.cr.o?coachValC(g.cr.o):5000;
  return g.ask?`<p>Listed at ${fmt$(g.ask)} (worth about ${fmt$(val)} as a coach). Other managers can hire him from the transfer market any time.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><input id="askIn" type="number" min="1000" step="500" value="${g.ask}"><button class="btn sm" data-act="list">Change price</button><button class="btn sm" data-act="unlist">Take him off the market</button></div>`
  :`<p class="muted">As a coach he's worth about ${fmt$(val)}: less than a player, since he'll never compete again, but he earns lesson fees from other rosters and coaches your own golfers for free. List him and other managers can buy him.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><input id="askIn" type="number" min="1000" step="500" value="${val}"><button class="btn sm" data-act="list">List him</button></div>`;}

/* ---------- the live board ---------- */
async function loadBoard(){if(!ui.ev)return;const {data,error}=await SB.rpc('event_board',{eid:ui.ev});if(!error&&data){ui.board=data;if(ui.watch){await loadWatch();syncAnim();}}}
async function loadWatch(){const {data}=await SB.rpc('event_watch',{eid:ui.ev,gid:ui.watch});ui.feed=data||[];}
function boardRows(b,e){const pars=COURSES[e.ci].holes.map(h=>h.par);
  return b.players.map(p=>{let tot=0,thru=0,rd=0,strokes=[];(p.scores||[]).forEach((r,i)=>{r.forEach((s,h)=>tot+=s-pars[h]);if(r.length){rd=i;thru=r.length;}strokes.push(r.reduce((a,c)=>a+c,0));});return{p,tot,thru,rd,strokes};});}
const COLG='<colgroup><col style="width:2.7em"><col><col style="width:4.4em"><col style="width:2.9em"><col style="width:2.5em"></colgroup>';
const COLG10='<colgroup><col style="width:2.4em"><col><col style="width:3.9em"><col style="width:3.3em"><col style="width:2.8em"><col style="width:2.3em"></colgroup>';
function boardHTML(b,e){const rows=boardRows(b,e),fin=e.status==='final',cutDone=fin||(b.vis&&b.vis[1]===18);
  const R=Math.max(0,...rows.map(r=>r.rd));
  rows.sort((a,c)=>fin?((a.p.pos_n||999)-(c.p.pos_n||999)):((a.p.cut?1:0)-(c.p.cut?1:0)||a.tot-c.tot||c.thru-a.thru));
  let pos=0;rows.forEach((r,i)=>{if(fin){r.pos=r.p.pos||'';return;}if(i===0||r.tot!==rows[i-1].tot||r.p.cut!==rows[i-1].p.cut)pos=i+1;r.pos=r.p.cut?'MC':(rows.filter(x=>!x.p.cut&&x.tot===r.tot).length>1?'T':'')+pos;});
  if(!fin){const act=rows.filter(r=>!r.p.cut),list=act.map(r=>({r:ratingFor(r.p,e.ci),cur:r.tot,H:Math.max(0,(nR(e)-1-r.rd)*18+(18-r.thru))}));const P=placeProbs(list,1500,10);act.forEach((r,i)=>{r.odds=oddsLabel(P.win[i]);r.t10=oddsLabel(P.top[i]);});}
  const proj=!isQ(e)&&!cutDone&&rows.length>CUT?rows[CUT-1].tot:null,lastIn=proj===null?-1:rows.filter(r=>r.tot<=proj).length-1;
  const cutTxt=proj!==null?`Projected cut ${fmtPar(proj)}`:b.event&&b.event.cut_line!==null&&b.event.cut_line!==undefined?`Cut fell at ${fmtPar(b.event.cut_line)}`:'';
  ui.posMap=new Map(rows.map(r=>[r.p.id,r.p.cut?'Missed cut':`${r.pos} at ${fmtPar(r.tot)}`]));
  const live=!fin&&phase(e)==='live';
  const row=(r,cl)=>{const i=rows.indexOf(r),chip=proj!==null&&!r.p.cut&&(r.p.managed)?(i>lastIn?'<span class="chip out">Outside the cut</span>':'<span class="chip">Inside the cut</span>'):r.p.cut&&r.p.managed?'<span class="chip">Missed the cut</span>':'';
    const o0=r.p.odds0?oddsLabel(r.p.odds0):'';
    return `<tr class="${r.p.mine?'me':r.p.managed?'mine':''}${cl?' cutline':''}"><td class="num">${r.pos}</td><td class="nm">${flagHTML(r.p.country)}${esc(r.p.name)}${ageTag(r.p.yr,e.tour.startsWith('qf:col')?'col0':e.tour)}${r.p.managed?`<small class="sch">${esc(r.p.stable||'')}</small>`:isCol(e.tour)?`<small class="sch">${esc(r.p.college||'')}</small>`:''}${chip}${r.p.managed?` <button class="btn xs" data-act="watch" data-v="${r.p.id}">${ui.watch===r.p.id?'Watching':'Watch'}</button>`:''}</td><td class="num odds">${fin?(r.p.pay?`${fmt$(r.p.pay)}${r.p.pts?`<small class="o0">${fmtPts(r.p.pts)} pts</small>`:''}`:''):`${r.odds||(r.p.cut?'':'–')}${o0?`<small class="o0">from ${o0}</small>`:''}`}</td>${fin?'':`<td class="num odds t10">${r.t10||(r.p.cut?'':'–')}</td>`}<td class="num${r.tot<0?' under':''}">${fmtPar(r.tot)}</td><td class="num">${fin?r.strokes.reduce((a,c)=>a+c,0)||'':r.thru===18&&r.rd===R?'F':r.thru||'–'}</td></tr>`;};
  const mineR=rows.filter(r=>r.p.mine),others=rows.filter(r=>r.p.managed&&!r.p.mine),full=ui.full,show=full?rows:rows.slice(0,10);
  const head=`<tr><th class="num">Pos</th><th>Golfer</th><th class="num">${fin?'Won':'Win'}</th>${fin?'':'<th class="num">Top 10</th>'}<th class="num">Par</th><th class="num">${fin?'Tot':'Thru'}</th></tr>`,NC=fin?5:6;
  return `<section class="board"><div class="row"><h2>${fin?'Final leaderboard':live?`Round ${R+1}${isQ(e)?' of '+nR(e):''}, live`:'Waiting for the first tee shot'}</h2><span class="chip cutchip">${cutTxt}</span></div>
 <table>${fin?COLG:COLG10}<thead>${head}</thead><tbody>
 ${mineR.length?`<tr class="sep"><td colspan="${NC}">Your golfer${mineR.length>1?'s':''}</td></tr>${mineR.map(r=>row(r)).join('')}`:''}
 ${others.length?`<tr class="sep"><td colspan="${NC}">Other managers’ golfers</td></tr>${others.map(r=>row(r)).join('')}`:''}
 <tr class="sep"><td colspan="${NC}">${full?'Full field':'Leaders'}</td></tr></tbody></table>
 <div class="${full?'bscroll':''}" id="bscroll"><table>${fin?COLG:COLG10}<tbody>${show.map(r=>row(r,rows.indexOf(r)===lastIn)).join('')}</tbody></table></div>
 <div class="row"><span class="muted small">${live?'Updates every few seconds.':proj!==null?'':''}${proj!==null?' Dashed line: the projected cut. Top '+CUT+' and ties play the weekend.':''}</span><button class="btn sm" data-act="fullBoard">${full?'Show top 10':'Show all '+rows.length}</button></div></section>`;}
function boxHTML(b,e){return (isQ(e)&&e.status!=='final'?qfLiveHTML(b,e):'')+(!isQ(e)?aceWatchHTML(tourAces(b),S().ace_bonus):'')+boardHTML(b,e);}
// Ace watch: every hole in one so far, gold when there's one; a new one flashes the first time it appears
function tourAces(b){const out=[];(b.players||[]).forEach(p=>(p.scores||[]).forEach((rd,ri)=>rd.forEach((s,h)=>{if(s===1)out.push({p,key:p.id+':'+ri+':'+h,where:`R${ri+1} #${h+1}`});})));return out;}
function aceCard(aces,bonus,title){ui.aceSeen=ui.aceSeen||new Set();const fresh=aces.some(a=>!ui.aceSeen.has(a.key));aces.forEach(a=>ui.aceSeen.add(a.key));
  return `<div class="qfcard acecard${aces.length?' hot':''}${fresh&&ui.aceInit?' flash':''}"><h3>${title||'Ace watch'}</h3><p class="small${aces.length?'':' muted'}">${bonus>0?`${fmt$(bonus)} for each hole in one by a manager's golfer`:'Holes in one'}</p><ol>${aces.length?aces.map(a=>`<li class="${a.p.mine?'me':''}">${flagHTML(a.p.country)}${esc(a.p.name)}${a.p.managed?` <small>(${esc(a.p.stable||'')})</small>`:''}<b>${a.where}</b></li>`).join(''):'<li class="muted">None yet</li>'}</ol></div>`;}
function aceWatchHTML(aces,bonus){const h=`<section class="qflive acewatch">${aceCard(aces,bonus)}</section>`;ui.aceInit=true;return h;}
/* Quick-Fire: the bonus races so far (only holes already played) */
function qfLiveHTML(b,e){const P=b.players.filter(p=>p.managed),L=p=>p.live||{},aces=[];
  P.forEach(p=>(p.scores||[]).forEach((rd,ri)=>rd.forEach((s,h)=>{if(s===1)aces.push({p,ri,h});})));
  const top=(k,f)=>P.filter(p=>L(p)[k]>0).sort((a,c)=>L(c)[k]-L(a)[k]).slice(0,3).map((p,i)=>`<li class="${p.mine?'me':p.managed?'mine':''}"><span>${i+1}.</span> ${flagHTML(p.country)}${esc(p.name)}<b>${f(L(p)[k])}</b></li>`).join('');
  const dr=top('drive',v=>v+' yds'),gi=top('gir',v=>v),ud=top('ud',v=>v);
  return `<section class="qflive"><div class="qfcard"><h3>Long drive</h3><p class="muted small">${fmt$(S().qf_bonus)} bonus</p><ol>${dr||'<li class="muted">No drives yet from managers\u2019 golfers</li>'}</ol></div>
 <div class="qfcard"><h3>Greens hit</h3><p class="muted small">${fmt$(S().qf_bonus)} bonus for the most</p><ol>${gi||'<li class="muted">No greens yet from managers\u2019 golfers</li>'}</ol></div>
 <div class="qfcard"><h3>Up and downs</h3><p class="muted small">${fmt$(S().qf_bonus)} bonus for the most</p><ol>${ud||'<li class="muted">None yet</li>'}</ol></div>
 ${(()=>{const c=aceCard(aces.map(a=>({p:a.p,key:a.p.id+':'+a.ri+':'+a.h,where:`R${a.ri+1} #${a.h+1}`})),S().qf_ace,'Holes in one');ui.aceInit=true;return c;})()}</section>`;}
/* the last minutes before the first tee shot */
function teeHTML(e,b){const P=b&&b.players||[],mineP=P.filter(p=>p.mine),fav=P.slice().sort((a,c)=>(c.odds0||0)-(a.odds0||0)).slice(0,5);
  const li=p=>`<li class="${p.mine?'me':p.managed?'mine':''}">${flagHTML(p.country)}${esc(p.name)}${p.managed?` <span class="muted small">${esc(p.stable||'')}</span>`:''}<b>${p.odds0?oddsLabel(p.odds0):''}</b></li>`;
  return `<section class="teebox"><p class="eyebrow">Entries are closed</p><h2>Tees off in</h2><div class="teeclock" id="teeClock" data-at="${e.starts_at}">${clockTxt(e.starts_at)}</div><p class="muted">${P.length?`${P.length} golfers in the field.`:'Setting the field…'} ${isQ(e)?`Pot ${fmt$(e.purse)}.`:`Purse ${fmt$(e.purse)}.`}</p></section>
 ${P.length?`<section class="qflive">${mineP.length?`<div class="qfcard"><h3>Your golfers</h3><p class="muted small">Starting odds</p><ol>${mineP.map(li).join('')}</ol></div>`:''}<div class="qfcard"><h3>Favourites</h3><p class="muted small">Starting odds</p><ol>${fav.map(li).join('')}</ol></div></section>`:''}`;}
function clockTxt(iso){let s=Math.max(0,Math.ceil((Date.parse(iso)-Date.now())/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
setInterval(()=>{const c=document.getElementById('teeClock');if(!c)return;c.textContent=clockTxt(c.dataset.at);if(Date.parse(c.dataset.at)<=Date.now()&&!c.dataset.done){c.dataset.done=1;setTimeout(()=>{loadBoard().then(render);},1500);}},1000);
/* the end of an event: the podium and the week in numbers */
function bonusHTML(rows){rows=rows.filter(r=>r.p.managed);const X=r=>r.p.extra||{},best=k=>{const m=Math.max(0,...rows.map(r=>X(r)[k]||0));return m?{m,w:rows.filter(r=>(X(r)[k]||0)===m)}:null;};
  const gi=best('gir'),dr=best('drive'),ud=best('ud'),aces=rows.filter(r=>X(r).aces);const nm=w=>w.map(r=>`${flagHTML(r.p.country)}${esc(r.p.name)}${r.p.managed?` <span class="muted small">(${esc(r.p.stable||'')})</span>`:''}`).join(', ');
  return `${aces.length?`<div class="ace"><b>Hole in one!</b> ${nm(aces)}${aces.some(r=>r.p.managed)?` collects ${fmt$(S().qf_ace)}.`:'.'}</div>`:''}<div class="shop">${gi?`<div class="item"><b>Most greens hit: ${gi.m} of 36</b><span>${nm(gi.w)}</span><span class="tag hot">${fmt$(S().qf_bonus)}${gi.w.length>1?' shared':''}</span></div>`:''}${ud?`<div class="item"><b>Most up and downs: ${ud.m}</b><span>${nm(ud.w)}</span><span class="tag hot">${fmt$(S().qf_bonus)}${ud.w.length>1?' shared':''}</span></div>`:''}${dr?`<div class="item"><b>Long drive: ${dr.m} yards</b><span>${nm(dr.w)}</span><span class="tag hot">${fmt$(S().qf_bonus)}${dr.w.length>1?' shared':''}</span></div>`:''}</div>`;}
function podiumHTML(b,e){const rows=boardRows(b,e).filter(r=>r.p.pos_n).sort((a,c)=>a.p.pos_n-c.p.pos_n);if(!rows.length)return '';
  const par=COURSES[e.ci].par||COURSES[e.ci].holes.reduce((a,h)=>a+h.par,0),top=rows.slice(0,3),win=rows[0],second=rows[1];
  const margin=second?second.tot-win.tot:0,how=margin>0?`by ${margin} stroke${margin>1?'s':''}`:'in a playoff';
  const step=(r,place)=>r?`<div class="pod p${place}"><div class="pname">${flagHTML(r.p.country)}${esc(r.p.name)}</div><div class="psub">${r.p.managed?esc(r.p.stable||''):isCol(e.tour)?esc(r.p.college||''):'Tour regular'}</div><div class="pblock"><b>${r.p.pos}</b><span>${fmtPar(r.tot)}</span><small>${r.p.pay?fmt$(r.p.pay):''}</small></div></div>`:'';
  let low=null,best4=null;rows.forEach(r=>(r.p.scores||[]).forEach((rd,i)=>{if(rd.length!==18)return;const s=sum(rd);if(!low||s<low.s)low={r,s,i};if(i===nR(e)-1&&(!best4||s<best4.s))best4={r,s};}));
  const bon=isQ(e)?bonusHTML(rows):'';
  const mineR=rows.filter(r=>r.p.mine),oth=rows.filter(r=>r.p.managed&&!r.p.mine),cutM=boardRows(b,e).filter(r=>r.p.managed&&r.p.cut);
  const line=r=>`<div class="item"><b>${flagHTML(r.p.country)}${esc(r.p.name)}</b><span>${r.p.cut?'Missed the cut':`Finished ${r.p.pos} at ${fmtPar(r.tot)}`}${r.p.odds0&&!r.p.cut?`, starting at ${oddsLabel(r.p.odds0)}`:''}.</span>${r.p.pay||r.p.pts?`<span class="tag hot">${r.p.pay?fmt$(r.p.pay):''}${r.p.pts?` · ${fmtPts(r.p.pts)} pts`:''}</span>`:''}</div>`;
  const allMine=boardRows(b,e).filter(r=>r.p.mine).map(r=>Object.assign(r,{tot:r.tot})),allOth=boardRows(b,e).filter(r=>r.p.managed&&!r.p.mine);
  return `<section class="podium-wrap"><p class="eyebrow">Final</p><h2 class="champ">${flagHTML(win.p.country)}${esc(win.p.name)} wins ${how}</h2>
 <p class="lede">${fmtPar(win.tot)} for the week${win.p.odds0?`, from ${oddsLabel(win.p.odds0)} at the start`:''}.${win.p.pay?` He takes ${fmt$(win.p.pay)}${win.p.pts?` and ${fmtPts(win.p.pts)} points`:''}.`:''}</p>
 <div class="podium">${step(top[1],2)}${step(top[0],1)}${step(top[2],3)}</div>${bon}
 <div class="stats">${low?`<div><b>${fmtPar(low.s-par)}</b><span>Low round: ${esc(low.r.p.name)}, R${low.i+1}</span></div>`:''}${best4?`<div><b>${fmtPar(best4.s-par)}</b><span>Best final round: ${esc(best4.r.p.name)}</span></div>`:''}${b.event.cut_line!==null&&b.event.cut_line!==undefined?`<div><b>${fmtPar(b.event.cut_line)}</b><span>Cut line</span></div>`:''}</div>
 ${allMine.length?`<h3>Your golfers</h3><div class="shop">${allMine.sort((a,c)=>(a.p.pos_n||999)-(c.p.pos_n||999)).map(line).join('')}</div>`:''}
 ${allOth.length?`<h3>Other managers</h3><div class="shop">${allOth.sort((a,c)=>(a.p.pos_n||999)-(c.p.pos_n||999)).map(line).join('')}</div>`:''}
</section>`;}
// What each finishing place pays, so you know what you're playing for before you enter.
function payoutHTML(e){const q=isQ(e),n=ui.preview&&ui.preview.eid===e.id?ui.preview.rows.length:0;
  const purse=q?qfBase(e.tour.slice(3))+S().qf_add*n:e.purse,paid=q?Math.floor(FIELD/3):PAYF.length;
  const base=PAYF.slice(0,paid),tot=q?base.reduce((a,b)=>a+b,0):1,pay=i=>Math.round(purse*base[i]/tot),pts=i=>Math.round((PTS[i]||3)*e.pm*10)/10;
  const groups=ui.payAll?Array.from({length:paid},(x,i)=>[i,i]):[[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[7,7],[8,8],[9,9],[10,14],[15,19],[20,29],[30,39]].concat(q?[]:[[40,49],[50,59]]).filter(([a])=>a<paid);
  const ord=i=>{const n=i+1,s=['th','st','nd','rd'][n%10>3||[11,12,13].includes(n%100)?0:n%10];return n+s;};
  const row=([a,b])=>`<tr><td>${a===b?ord(a):`${ord(a)}\u2013${ord(b)}`}</td><td class="num">${a===b?fmt$(pay(a)):`${fmt$(pay(b))}\u2013${fmt$(pay(a))}`}</td>${q?'':`<td class="num">${a===b?fmtPts(pts(a)):`${fmtPts(pts(b))}\u2013${fmtPts(pts(a))}`}</td>`}</tr>`;
  return `<section class="sec paysec"><h2>Prize money</h2><p class="muted small">${q?`Pot so far ${fmt$(purse)}; it grows ${fmt$(S().qf_add)} with every entry. The top ${paid} get paid.`:`Purse ${fmt$(purse)}. The top ${CUT} and ties make the cut and get paid.`}</p>
 <div class="scroll"><table class="tbl"><thead><tr><th>Finish</th><th class="num">Prize</th>${q?'':'<th class="num">Points</th>'}</tr></thead><tbody>${groups.map(row).join('')}</tbody></table></div>
 <p class="muted small">${q?`Plus ${fmt$(S().qf_bonus)} each for most greens, most up and downs and the long drive, and ${fmt$(S().qf_ace)} for a hole in one (managers' golfers only).`:`Tied golfers share the money for the places they cover. Missing the cut pays nothing.${e.fee?` Entry costs ${fmt$(e.fee)}.`:''}`} <button class="linkbtn" data-act="payAll">${ui.payAll?'Show fewer places':'Show every place'}</button></p></section>`;}
async function loadPreview(e){
  if(isQ(e)||isB(e)){const en=await SB.from('entries').select('golfer_id').eq('event_id',e.id).eq('status','in');const ids=(en.data||[]).map(x=>x.golfer_id);const gs=ids.length?await SB.from('golfers').select('id,name,country,college,stable,manager_id,sk,yr,tour').in('id',ids):{data:[]};const rows=(gs.data||[]).map(g=>({g,how:'Entered'}));rows.sort((a,b)=>ovr(b.g.sk)-ovr(a.g.sk));ui.preview={eid:e.id,rows};return;}
  const [gs,en]=await Promise.all([SB.from('golfers').select('id,name,country,college,stable,manager_id,sk,yr,enter_rule').eq('tour',e.tour).eq('retired',false).not('manager_id','is',null),SB.from('entries').select('golfer_id,status').eq('event_id',e.id)]);
  const st=new Map((en.data||[]).map(x=>[x.golfer_id,x.status]));
  const rows=(gs.data||[]).map(g=>{const s=st.get(g.id),auto=e.test||g.enter_rule==='all'||(g.enter_rule==='signature'&&['Signature','Finale'].includes(e.type));return{g,how:s==='in'?'Entered':s==='out'?null:auto?'Entered automatically':null};}).filter(r=>r.how);
  rows.sort((a,b)=>ovr(b.g.sk)-ovr(a.g.sk));ui.preview={eid:e.id,rows};}
function previewHTML(e){const P=ui.preview&&ui.preview.eid===e.id?ui.preview.rows:null;
  return `<section class="sec"><h2>The field so far</h2>${!P?'<p class="muted">Loading…</p>':!P.length?'<p class="muted">No managers\u2019 golfers are in yet.</p>':`<div class="scroll"><table class="tbl"><thead><tr><th>Golfer</th><th>Roster</th><th class="num">Overall</th></tr></thead><tbody>${P.map(r=>`<tr class="${r.g.manager_id===D.user.id?'me':'now'}"><td>${flagHTML(r.g.country)}${esc(r.g.name)}${ageTag(r.g.yr,r.g.tour)}${isCol(e.tour)?` <span class="muted small">${esc(r.g.college||'')}</span>`:''}${r.how==='Entered automatically'?' <span class="muted small">(auto)</span>':''}</td><td class="small">${esc(r.g.stable||'')}</td><td class="num">${Math.round(ovr(r.g.sk))}</td></tr>`).join('')}</tbody></table></div>`}
  <p class="muted small">${P?`${P.length} golfer${P.length===1?'':'s'} from managers\u2019 rosters so far. `:''}${isT(e)?`Each roster\u2019s golfers here pair up into teams of ${S().tm_size||2} in the order they were entered.`:isM(e)?'No tour regulars: only these golfers play.':`When entries close, tour regulars fill the rest of the ${FIELD} spots. Auto entries can still withdraw before then.`}</p></section>`;}
async function loadStand(t){const {data}=await SB.from('standings').select('pts,wins,earn,golfers(name,country,stable,manager_id,yr)').eq('tour',t).eq('season',D.world?D.world.season:1).order('pts',{ascending:false}).limit(200);ui.stand={t,rows:data||[]};if(ui.view==='standings')render();}

/* ---------- watching a golfer: the hole map, played on the clock ---------- */
// The server reveals each hole when it's reached on the clock. Live, we animate each new hole as it arrives;
// tapping a hole on the scorecard replays it.
// the holing-out line in the commentary says what it was for: "Taps in for par."
function holedFor(text,sc,par){if(sc===undefined||sc===null)return text;const d=sc-par,t=String(text).replace(/[.!]\s*$/,'');
  return `${t} ${sc===1?'for a hole in one!':d<=-3?'for albatross!':d===-2?'for eagle!':d===-1?'for birdie.':d===0?'for par.':d===1?'for bogey.':d===2?'for double bogey.':d===3?'for triple bogey.':`for a ${sc}.`}`;}
const SCORE_NAMES={'-3':'Albatross','-2':'Eagle','-1':'Birdie','0':'Par','1':'Bogey','2':'Double bogey','3':'Triple bogey'};
// each shot: a short swing by the golfer, then the ball's flight
const swingMs=s=>s.k==='full'?1500:s.k==='chip'?1000:s.k==='putt'?850:s.k==='drop'||s.k==='pick'?0:450;
const flightMs=s=>s.k==='full'?900+dist(s.from,s.to)*2.4:s.k==='chip'?800:s.k==='putt'?750:s.k==='drop'?350:500;
const shotDur=s=>swingMs(s)+flightMs(s);
// how far through the swing (0-1) and the flight (0-1) a shot is, from its overall progress t
const shotPhase=(s,t)=>{const sw=swingMs(s),tot=sw+flightMs(s),ms=t*tot;return {sw:sw?Math.min(1,ms/sw):1,f:Math.max(0,Math.min(1,(ms-sw)/(tot-sw)))};};
const hkey=(r,h)=>r*18+h;
function watchHTML(b,e){if(!ui.watch)return '';const p=b.players.find(x=>x.id===ui.watch);if(!p)return '';const A=ui.anim||{};
  return `<section class="round" id="watchBox"><div>
  <div class="holebar"><span><b id="hTitle">${esc(p.name)}</b></span><span id="hMeta"></span><span class="wind"><i id="windArrow">↑</i><span id="windTxt"></span></span></div>
  <canvas id="cv" aria-label="Top-down map of the hole"></canvas>
  <div class="ctrl"><button class="btn sm" data-act="wPause" id="pauseBtn">${A.paused?'Play':'Pause'}</button>${[1,2,4].map(s=>`<button class="btn sm${(A.speed||1)===s?' on':''}" data-act="wSpeed" data-v="${s}">${s}×</button>`).join('')}<span class="sp"></span><button class="btn sm${A.live!==false?' on':''}" data-act="wLive">Live</button><button class="btn sm" data-act="wStop">Close</button></div>
 </div><div>
  <div class="status"><span class="lab">${flagHTML(p.country)}${esc(p.name)}</span><span class="tag" id="posTag"></span><span class="tag" id="moodTag"></span><span id="runTag"></span></div>
  <div class="feed" id="feed" aria-live="polite"></div>
  <div id="wcard"></div>
  <p class="muted small">Holes appear as he plays them on the clock, about one every ${Math.round(rmin(e)*60/18)} seconds. Tap a score to replay that hole.</p>
 </div></section>`;}
function watchScores(){const b=ui.board,p=b&&b.players.find(x=>x.id===ui.watch);return p?p.scores||[]:[];}
function syncAnim(){
  const F=(ui.feed||[]).slice().sort((a,b)=>hkey(a.round,a.hole)-hkey(b.round,b.hole));
  let A=ui.anim;
  if(!A||A.gid!==ui.watch){A=ui.anim={gid:ui.watch,speed:1,paused:false,live:true,cur:null,phase:'idle',feed:[],trail:[],cam:null,cardR:null};
    const last=F[F.length-1];if(last)beginHole(last,true);else{A.feed=[{text:'He hasn’t teed off yet. His first hole appears here as he plays it.',cls:''}];}}
  else if(A.live&&A.phase==='idle'&&A.cur){const nx=F.find(x=>hkey(x.round,x.hole)>hkey(A.cur.round,A.cur.hole));if(nx)beginHole(nx);}
  else if(A.live&&!A.cur&&F.length)beginHole(F[F.length-1],true);
}
function beginHole(x,first){const A=ui.anim,e=D.events.find(q=>q.id===ui.ev)||ui.board.event,h=COURSES[e.ci].holes[x.hole];
  A.cur=x;A.h=h;A.si=0;A.t=0;A.w=0;A.trail=[];A.cam=null;A.phase=x.shots.length?'shot':'idle';A.cardR=x.round;
  if(first){A.feed=[];A.shown=hkey(x.round,x.hole)-1;}
  feedA(`Round ${x.round+1}, hole ${x.hole+1}. Par ${h.par}, ${h.len} yards.`,'big');paintHUD();paintSide();}
function feedA(text,cls){const A=ui.anim;A.feed.push({text,cls:cls||''});if(A.feed.length>6)A.feed.shift();paintFeed();}
function paintFeed(){const el=document.getElementById('feed');if(!el||!ui.anim)return;const f=ui.anim.feed;el.innerHTML=f.map((x,i)=>`<p class="${x.cls}${i===f.length-1?' now':''}">${esc(x.text)}</p>`).join('');}
function paintHUD(){const A=ui.anim,x=A&&A.cur;if(!x||!document.getElementById('hTitle'))return;
  document.getElementById('hTitle').textContent=`R${x.round+1} · Hole ${x.hole+1}`;document.getElementById('hMeta').textContent=`Par ${A.h.par}, ${A.h.len} yards`;
  const w=ui.board&&ui.board.wind&&ui.board.wind[x.round];if(w){document.getElementById('windArrow').style.transform=`rotate(${w.dir}rad)`;document.getElementById('windTxt').textContent=`${Math.round(w.mph)} mph`;}}
function wcardHTML(course,scores,R){const half=(a,label)=>{const hs=course.holes.slice(a,a+9),done=scores.length>=a+9,cur=ui.anim&&ui.anim.cur;
    return `<div class="scroll"><table class="card"><tr><th>Hole</th>${hs.map((h,i)=>`<th>${a+i+1}</th>`).join('')}<th>${label}</th></tr>
    <tr><td>Par</td>${hs.map(h=>`<td>${h.par}</td>`).join('')}<td>${sum(hs.map(h=>h.par))}</td></tr>
    <tr><td>Score</td>${hs.map((h,i)=>{const s=scores[a+i];if(s===undefined)return'<td></td>';const d=s-h.par,on=cur&&cur.round===R&&cur.hole===a+i;return `<td class="${d<=-2?'eg':d===-1?'bd':d===1?'bg':d>=2?'db':''}" data-act="wHole" data-v="${R}-${a+i}" style="cursor:pointer${on?';outline:2px solid var(--flag)':''}"><s>${s}</s></td>`}).join('')}<td><b>${done?sum(scores.slice(a,a+9)):''}</b></td></tr></table></div>`};
  return `<div class="cards">${half(0,'Out')}${half(9,'In')}</div>`;}
function paintSide(){const A=ui.anim,el=document.getElementById('wcard');if(!A||!el)return;const e=D.events.find(q=>q.id===ui.ev)||ui.board.event,sc=watchScores();
  const rounds=sc.map((r,i)=>i).filter(i=>sc[i]&&sc[i].length),R=A.cardR!==null&&A.cardR!==undefined?A.cardR:rounds[rounds.length-1]||0;
  el.innerHTML=(rounds.length>1?`<div class="ctrl">${rounds.map(i=>`<button class="btn sm${i===R?' on':''}" data-act="wRound" data-v="${i}">R${i+1}: ${sum(sc[i])}</button>`).join('')}</div>`:'')+wcardHTML(COURSES[e.ci],A.live?(sc[R]||[]).filter((s,j)=>hkey(R,j)<=(A.shown??-1)):(sc[R]||[]),R);
  const pt=document.getElementById('posTag');if(pt)pt.textContent=ui.posMap&&ui.posMap.get(ui.watch)||'';
  const x=A.cur,mt=document.getElementById('moodTag');if(mt)mt.textContent=x&&x.mood!==null&&x.mood!==undefined?moodWord(x.mood):'';
  const rt=document.getElementById('runTag');if(rt)rt.innerHTML=x&&x.run>=2?'<span class="tag hot">Hot streak</span>':x&&x.run<=-2?'<span class="tag">Gone cold</span>':'';
  const pb=document.getElementById('pauseBtn');if(pb)pb.textContent=A.paused?'Play':'Pause';
  paintFeed();}
function totThrough(r,h){const e=D.events.find(q=>q.id===ui.ev)||ui.board.event,pars=COURSES[e.ci].holes.map(x=>x.par),sc=watchScores();let t=0;
  sc.forEach((rd,i)=>{if(i>r)return;rd.forEach((s,j)=>{if(i<r||j<=h)t+=s-pars[j];});});return t;}
function endHoleA(){const A=ui.anim,x=A.cur,sc=watchScores(),s=sc[x.round]&&sc[x.round][x.hole];
  if(s!==undefined){const d=s-A.h.par,t=totThrough(x.round,x.hole);feedA(`${SCORE_NAMES[d]||'A '+s}. He is ${t===0?'level par':fmtPar(t)}${x.round?' for the week':''} through ${x.hole+1}.`,'big');}
  A.phase='post';A.w=0;A.shown=Math.max(A.shown??-1,hkey(x.round,x.hole));paintSide();}
function fitCanvas(){const cv=document.getElementById('cv');if(!cv)return;const dpr=Math.min(2,window.devicePixelRatio||1),r=cv.getBoundingClientRect();cv.width=Math.max(200,Math.round(r.width*dpr));cv.height=Math.max(250,Math.round(r.height*dpr));if(ui.anim)ui.anim.cam=null;}
function camFor(A,green,cv){cv=cv||document.getElementById('cv');const W=cv.width,H=cv.height,h=A.h;
  if(green)return{x:h.green[0],y:h.green[1],s:Math.min(W,H)/110};const b=h.box;return{x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,s:Math.min(W/(b[2]-b[0]),H/(b[3]-b[1]))};}
let rafOn=false,lastTs=0;
function startLoop(){fitCanvas();paintHUD();paintSide();if(!rafOn){rafOn=true;lastTs=performance.now();requestAnimationFrame(frame);}}
function frame(ts){const A=ui.anim;if(ui.view!=='board'||!ui.watch||!A||!document.getElementById('cv')){rafOn=false;return;}
  const dt=A.paused?0:Math.min(60,ts-lastTs)*A.speed;lastTs=ts;
  if(A.cur&&A.cur.shots.length){
    if(A.phase==='shot'){const sh=A.cur.shots[A.si];A.t+=dt/shotDur(sh);if(A.t>=1){A.t=1;feedA(sh.holed?holedFor(sh.text,(watchScores()[A.cur.round]||[])[A.cur.hole],A.h.par):sh.text);A.trail.push(sh);A.phase='wait';A.w=0;}}
    else if(A.phase==='wait'){A.w+=dt;if(A.w>(A.cur.shots[A.si].holed?1000:750)){A.si++;if(A.si>=A.cur.shots.length){A.si=A.cur.shots.length-1;endHoleA();}else{A.phase='shot';A.t=0;}}}
    else if(A.phase==='post'){A.w+=dt;if(A.w>1700){A.phase='idle';if(A.live)syncAnim();}}
    A.panel=null;drawMap(dt);const cvp=document.getElementById('cv');if(A.panel&&cvp&&(A.phase==='shot'||A.phase==='wait')){const q=A.panel;drawShotPanels(cvp.getContext('2d'),cvp.width,cvp.height,q.u,q.sh,q.P,q.live,q.col);}
  }
  requestAnimationFrame(frame);}
/* ---------- the hole map: shapes, tracers and the golfer ---------- */
// a repeatable random number per hole and feature, so a hole always looks the same
const hRand=(h,k)=>{let x=Math.sin((h.len||1)*12.9898+(h.green?h.green[0]*78.233+h.green[1]*3.71:0)+k*37.719)*43758.5453;return x-Math.floor(x);};
// an organic outline around (cx,cy): radius r, stretched by `el` along angle `rot`, edges wobbling by `amp`
function blobPath(c,X,Y,Sc,cx,cy,r,h,k,amp,el,rot){const ph=[0,1,2,3].map(i=>hRand(h,k*7+i)*6.28),n=36;c.beginPath();
  for(let i=0;i<=n;i++){const a=i/n*6.283,w=1+amp*(.55*Math.sin(2*a+ph[0])+.3*Math.sin(3*a+ph[1])+.15*Math.sin(5*a+ph[2])),
    lx=Math.cos(a)*r*w*Math.sqrt(el||1),ly=Math.sin(a)*r*w/Math.sqrt(el||1),ca=Math.cos(rot||0),sa=Math.sin(rot||0),x=cx+lx*ca-ly*sa,y=cy+lx*sa+ly*ca;
    i?c.lineTo(X(x),Y(y)):c.moveTo(X(x),Y(y));}c.closePath();}
// mowing stripes across whatever shape is currently the clip
function stripes(c,X,Y,Sc,cx,cy,ang,step,span,col){c.fillStyle=col;const ca=Math.cos(ang),sa=Math.sin(ang);
  for(let d=-span;d<span;d+=step*2){const p=[[d,-span],[d+step,-span],[d+step,span],[d,span]].map(([u,v])=>[cx+u*ca-v*sa,cy+u*sa+v*ca]);
    c.beginPath();p.forEach((q,i)=>i?c.lineTo(X(q[0]),Y(q[1])):c.moveTo(X(q[0]),Y(q[1])));c.closePath();c.fill();}}
function drawCourse(c,W,H,h,X,Y,Sc){
  c.fillStyle=MAP.tree;c.fillRect(0,0,W,H);
  c.lineCap='round';c.lineJoin='round';
  const path=pts=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));};
  // rough corridor and the area round the green
  c.strokeStyle=MAP.rough;c.lineWidth=2*h.tree*Sc;path(h.pts);c.stroke();
  blobPath(c,X,Y,Sc,h.green[0],h.green[1],h.tree,h,1,.12,1.15,hRand(h,2)*3);c.fillStyle=MAP.rough;c.fill();
  // fairway: a ribbon whose width breathes along the hole, with mowing stripes
  const fp=[pointAt(h,h.fs0).p];for(let i=1;i<h.pts.length-1;i++)if(h.cum[i]>h.fs0&&h.cum[i]<h.fs1)fp.push(h.pts[i]);fp.push(pointAt(h,h.fs1).p);
  const L=[],Rr=[],stepY=6;for(let d=h.fs0;d<=h.fs1+.01;d+=stepY){const q=pointAt(h,Math.min(d,h.fs1)).p,q2=pointAt(h,Math.min(d+2,h.cum[h.cum.length-1])).p,dx=q2[0]-q[0],dy=q2[1]-q[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
    const ends=Math.min(1,(d-h.fs0)/18,(h.fs1-d)/18),w=h.fw*(1+.16*Math.sin(d/31+hRand(h,3)*6)+.08*Math.sin(d/13+hRand(h,4)*6))*(.55+.45*ends);
    L.push([q[0]+nx*w,q[1]+ny*w]);Rr.push([q[0]-nx*w,q[1]-ny*w]);}
  const ring=L.concat(Rr.reverse());c.beginPath();ring.forEach((q,i)=>i?c.lineTo(X(q[0]),Y(q[1])):c.moveTo(X(q[0]),Y(q[1])));c.closePath();c.fillStyle=MAP.fair;c.fill();
  c.save();c.clip();const mid=pointAt(h,(h.fs0+h.fs1)/2).p,end=pointAt(h,h.fs1).p,st=pointAt(h,h.fs0).p;
  stripes(c,X,Y,Sc,mid[0],mid[1],Math.atan2(end[1]-st[1],end[0]-st[0]),9,600,'rgba(255,255,255,.07)');c.restore();
  // tee box
  c.fillStyle=MAP.tee;c.beginPath();if(c.roundRect)c.roundRect(X(-6),Y(5),12*Sc,10*Sc,3*Sc);else c.rect(X(-6),Y(5),12*Sc,10*Sc);c.fill();
  c.fillStyle='rgba(255,255,255,.12)';c.fillRect(X(-6),Y(1),12*Sc,2*Sc);
  // water: an organic pond with a darker edge and a glint
  h.water.forEach((w,i)=>{blobPath(c,X,Y,Sc,w.x,w.y,w.ry,h,20+i,.14,w.rx/w.ry,w.rot);c.fillStyle=MAP.water;c.fill();c.lineWidth=Math.max(1.5,1.6*Sc);c.strokeStyle='rgba(10,40,70,.45)';c.stroke();
    c.save();c.clip();c.fillStyle='rgba(255,255,255,.12)';c.beginPath();c.ellipse(X(w.x-w.rx*.25),Y(w.y+w.ry*.3),w.rx*.5*Sc,w.ry*.18*Sc,w.rot,0,6.3);c.fill();c.restore();});
  // the green: fringe and putting surface, with fine stripes
  const gRot=hRand(h,5)*3.1,gEl=1+hRand(h,6)*.18;
  blobPath(c,X,Y,Sc,h.green[0],h.green[1],h.gr+3,h,7,.09,gEl,gRot);c.fillStyle=MAP.fringe;c.fill();
  blobPath(c,X,Y,Sc,h.green[0],h.green[1],h.gr,h,7,.09,gEl,gRot);c.fillStyle=MAP.green;c.fill();
  c.save();c.clip();stripes(c,X,Y,Sc,h.green[0],h.green[1],gRot+.6,2.6,h.gr*2,'rgba(255,255,255,.08)');c.restore();
  // bunkers: kidney shapes with a darker lip and a shaded face
  h.sand.forEach((bk,i)=>{const rot=hRand(h,30+i)*6.28,el=1.3+hRand(h,40+i)*.5;
    blobPath(c,X,Y,Sc,bk.x,bk.y,bk.r*1.04,h,50+i,.16,el,rot);c.fillStyle='rgba(60,50,20,.35)';c.lineWidth=Math.max(1.5,1.3*Sc);c.strokeStyle='rgba(120,100,50,.55)';c.fill();
    blobPath(c,X,Y,Sc,bk.x,bk.y,bk.r*.96,h,50+i,.16,el,rot);c.fillStyle=MAP.sand;c.fill();c.stroke();
    c.save();c.clip();c.fillStyle='rgba(150,120,60,.18)';c.beginPath();c.ellipse(X(bk.x+bk.r*.35),Y(bk.y-bk.r*.3),bk.r*.9*Sc,bk.r*.55*Sc,rot,0,6.3);c.fill();c.restore();});
  // trees: a shadow, a dark crown and a lit side
  for(const t of h.trees){const r=Math.max(1.6,t[2]*Sc),x=X(t[0]),y=Y(t[1]);
    c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.arc(x+r*.35,y+r*.35,r,0,6.3);c.fill();
    c.fillStyle=MAP.dot;c.beginPath();c.arc(x,y,r,0,6.3);c.fill();
    c.fillStyle='rgba(120,170,90,.22)';c.beginPath();c.arc(x-r*.3,y-r*.3,r*.55,0,6.3);c.fill();}
}
// the shape of a shot seen from above: a gentle curve (draw or fade) for full shots, nearly straight for chips, straight putts
function shotCtl(sh){const dx=sh.to[0]-sh.from[0],dy=sh.to[1]-sh.from[1],l=Math.hypot(dx,dy)||1;
  let k=Math.sin((sh.from[0]*12.99+sh.to[1]*78.23+l)*.7)*43758.55;k=k-Math.floor(k);
  const bend=sh.k==='full'?(k-.5)*.22:sh.k==='chip'?(k-.5)*.06:0;
  return [(sh.from[0]+sh.to[0])/2-dy/l*bend*l,(sh.from[1]+sh.to[1])/2+dx/l*bend*l];}
const shotAt=(sh,f)=>{const q=shotCtl(sh),a=1-f;return [a*a*sh.from[0]+2*a*f*q[0]+f*f*sh.to[0],a*a*sh.from[1]+2*a*f*q[1]+f*f*sh.to[1]];};
// how high the ball is (in screen pixels) at flight fraction f
const shotLift=(sh,f,Sc,H)=>sh.k==='putt'||sh.k==='drop'||sh.k==='pick'?0:Math.sin(Math.PI*f)*Math.min(H*(sh.k==='full'?.13:.05),dist(sh.from,sh.to)*Sc*(sh.k==='full'?.22:.12));
// a tracer from the start of the shot to flight fraction f: an arc through the air. Bright and glowing while live, faint afterwards
function drawTracer(c,X,Y,Sc,H,u,sh,f,col,live){if(sh.k==='drop'||sh.k==='pick'||f<=0)return;const n=Math.max(4,Math.round(28*f)),pts=[];
  for(let i=0;i<=n;i++){const g=f*i/n,p=shotAt(sh,g);pts.push([X(p[0]),Y(p[1])-shotLift(sh,g,Sc,H)]);}
  c.lineCap='round';c.lineJoin='round';
  if(live){c.save();c.shadowColor=col;c.shadowBlur=u*.9;}
  c.beginPath();pts.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));
  c.strokeStyle=live?'rgba(255,255,255,.9)':'rgba(16,32,26,.35)';c.lineWidth=live?Math.max(2.4,u*.3):Math.max(2,u*.26);c.stroke();
  c.strokeStyle=col;c.globalAlpha=live?1:.7;c.lineWidth=live?Math.max(1.4,u*.16):Math.max(1.2,u*.14);c.stroke();c.globalAlpha=1;
  if(live)c.restore();}
// ----- the swing: one timeline T from 0 (address) through the top (.58) to impact (.75) and the finish (1) -----
// keyframes: A = lead arm angle from straight down (positive = back, away from the target), W = wrist hinge,
// X = hips sliding (negative back, positive toward the target), U = shoulder turn (0-1), Hl = trail heel up (0-1)
const SWING={full:[[0,0,0,0,0,0],[.2,38,8,-1,.25,0],[.45,118,78,-3,.8,0],[.58,152,96,-3,1,0],[.62,146,98,-1,.95,0],[.7,62,96,3,.45,0],[.75,0,4,4,0,.2],[.83,-85,-15,6,-.5,.6],[.93,-195,-95,7,-1,1],[1,-205,-108,7,-1,1]],
  chip:[[0,0,0,0,0,0],[.3,30,18,0,.2,0],[.58,62,42,-1,.45,0],[.66,52,40,0,.35,0],[.75,0,0,1,0,0],[.88,-45,-10,2,-.35,.1],[1,-62,-18,2,-.45,.15]],
  putt:[[0,0,0,0,0,0],[.58,20,0,0,.08,0],[.75,0,0,0,0,0],[1,-24,0,0,-.08,0]]};
function swingPose(T,k){const K=SWING[k==='full'?'full':k==='putt'?'putt':'chip'];let i=0;while(i<K.length-2&&T>K[i+1][0])i++;
  const a=K[i],b=K[i+1],u=Math.max(0,Math.min(1,(T-a[0])/(b[0]-a[0]))),e=u*u*(3-2*u),L=j=>a[j]+(b[j]-a[j])*e;return {A:L(1),W:L(2),X:L(3),U:L(4),Hl:L(5)};}
// where a shot is on that timeline: the backswing and downswing take the swing time, the follow-through runs on as the ball leaves
const swingT=(P,live)=>!live?1:P.f<=0?P.sw*.75:.75+Math.min(1,P.f*2)*.25;
const isWood=sh=>/^(Driver|\d-wood|Hybrid)/i.test(sh.text||'');
// the golfer from above, standing beside the ball: feet, hips and shoulders turning, arms and club swinging round him
function drawGolfer(c,X,Y,u,sh,T,col,fade){if(fade<=0||sh.k==='drop'||sh.k==='pick')return;
  const dx=sh.to[0]-sh.from[0],dy=sh.to[1]-sh.from[1],a=Math.atan2(-dy,dx),P=swingPose(T,sh.k);
  const bx=X(sh.from[0]),by=Y(sh.from[1]),s=u*1.9,tx=Math.cos(a),ty=Math.sin(a),fx=-ty,fy=tx; // t: toward the target, f: from the golfer toward the ball
  const gx=bx-fx*s*.85+tx*P.X*s*.03,gy=by-fy*s*.85+ty*P.X*s*.03;c.save();c.globalAlpha=fade;
  const rot=(v,ang)=>[v[0]*Math.cos(ang)-v[1]*Math.sin(ang),v[0]*Math.sin(ang)+v[1]*Math.cos(ang)],turn=P.U*1.45;
  // shadow and feet
  c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(gx+s*.15,gy+s*.2,s*.62,s*.5,a,0,6.3);c.fill();
  c.fillStyle='#222';for(const sd of [-1,1]){c.beginPath();c.ellipse(gx+tx*sd*s*.32+fx*s*.12,gy+ty*sd*s*.32+fy*s*.12,s*.15,s*.09,a+Math.PI/2*.15,0,6.3);c.fill();}
  // hips (trousers) then shoulders (shirt), each turned by the swing
  const hp=rot([tx,ty],-turn*.45),sp=rot([tx,ty],-turn);
  c.strokeStyle='#2d3436';c.lineWidth=s*.34;c.lineCap='round';c.beginPath();c.moveTo(gx-hp[0]*s*.26,gy-hp[1]*s*.26);c.lineTo(gx+hp[0]*s*.26,gy+hp[1]*s*.26);c.stroke();
  c.strokeStyle=col;c.lineWidth=s*.4;c.beginPath();c.moveTo(gx-sp[0]*s*.36,gy-sp[1]*s*.36);c.lineTo(gx+sp[0]*s*.36,gy+sp[1]*s*.36);c.stroke();
  // arms and club: they hang toward the ball at address and swing round the body
  const swingAng=-(P.A+P.W*.5)*Math.PI/180*.8,lift=Math.min(.8,Math.abs(P.A)/220),dir=rot([fx,fy],swingAng);
  const hx=gx+dir[0]*s*.55*(1-lift*.4),hy=gy+dir[1]*s*.55*(1-lift*.4),cd=rot(dir,-P.W*Math.PI/180*.6),cl=s*(sh.k==='putt'?.75:isWood(sh)?1.3:1.1)*(1-lift*.55);
  c.strokeStyle='#e5c09b';c.lineWidth=s*.12;for(const sd of [-1,1]){c.beginPath();c.moveTo(gx+sp[0]*sd*s*.3,gy+sp[1]*sd*s*.3);c.lineTo(hx,hy);c.stroke();}
  c.strokeStyle='#bfc5c9';c.lineWidth=Math.max(1,s*.06);c.beginPath();c.moveTo(hx,hy);c.lineTo(hx+cd[0]*cl,hy+cd[1]*cl);c.stroke();
  c.fillStyle='#3a3f44';c.beginPath();c.arc(hx+cd[0]*cl,hy+cd[1]*cl,Math.max(1.3,s*.09),0,6.3);c.fill();
  // head with a cap, peak pointing at the ball
  c.fillStyle='#e5c09b';c.beginPath();c.arc(gx,gy,s*.2,0,6.3);c.fill();
  c.fillStyle='#f4f4f4';c.beginPath();c.arc(gx,gy,s*.2,a+Math.PI*.15,a+Math.PI*1.85,true);c.fill();
  c.restore();}
// a panel in a corner of the map: dark glass with a small heading
function panel(c,x,y,w,h,title,u){c.save();c.fillStyle='rgba(12,22,17,.72)';c.strokeStyle='rgba(255,255,255,.18)';c.lineWidth=1;c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,u*.5);else c.rect(x,y,w,h);c.fill();c.stroke();
  c.fillStyle='rgba(255,255,255,.7)';c.font=`600 ${Math.round(u*.85)}px 'Barlow Condensed','Arial Narrow',sans-serif`;c.textAlign='left';c.textBaseline='top';c.fillText(title,x+u*.5,y+u*.35);c.restore();}
// the swing camera: the golfer side-on (facing us), the full swing from address to the finish
function drawSwingCam(c,x,y,w,h,u,sh,T,col){if(sh.k==='drop'||sh.k==='pick')return;if(drawSwing3D(c,x,y,w,h,u,sh,T,col))return;panel(c,x,y,w,h,'SWING',u);
  const P=swingPose(T,sh.k),k=h/118,gy=y+h-8*k,cx=x+w*.5,rad=v=>v*Math.PI/180;
  c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.lineCap='round';c.lineJoin='round';
  c.strokeStyle='rgba(140,196,116,.6)';c.lineWidth=2*k;c.beginPath();c.moveTo(x+4*k,gy);c.lineTo(x+w-4*k,gy);c.stroke();
  const hipX=cx+P.X*k,hipY=gy-44*k,shX=hipX-4*k*(1-Math.abs(P.U)*.3),shY=gy-74*k,sw=13*k*(1-Math.abs(P.U)*.55);
  // legs: trail (screen left) and lead, trail heel lifting through the finish
  c.strokeStyle='#2d3436';c.lineWidth=7*k;
  c.beginPath();c.moveTo(hipX-5*k,hipY);c.lineTo(cx-11*k+P.Hl*4*k,gy-20*k);c.lineTo(cx-14*k+P.Hl*6*k,gy-P.Hl*6*k);c.stroke();
  c.beginPath();c.moveTo(hipX+5*k,hipY);c.lineTo(cx+12*k,gy-21*k);c.lineTo(cx+14*k,gy);c.stroke();
  c.fillStyle='#222';c.beginPath();c.ellipse(cx-14*k+P.Hl*6*k,gy-P.Hl*6*k,5*k,2.2*k,P.Hl*.6,0,6.3);c.fill();c.beginPath();c.ellipse(cx+15*k,gy,5*k,2.2*k,0,0,6.3);c.fill();
  // body: hips to shoulders in the shirt colour
  c.strokeStyle=col;c.lineWidth=15*k;c.beginPath();c.moveTo(hipX,hipY-3*k);c.lineTo(shX,shY+5*k);c.stroke();
  c.lineWidth=8*k;c.beginPath();c.moveTo(shX-sw,shY);c.lineTo(shX+sw,shY);c.stroke();
  // head and cap, eyes down on the ball until after impact
  const hdX=shX-2*k+(T>.8?3*k:0),hdY=shY-12*k;c.fillStyle='#e5c09b';c.beginPath();c.arc(hdX,hdY,7*k,0,6.3);c.fill();
  c.fillStyle='#f4f4f4';c.beginPath();c.arc(hdX,hdY-1.5*k,7.2*k,Math.PI*1.02,Math.PI*1.98);c.fill();c.fillRect(hdX-(T>.8?-2:9)*k,hdY-2.5*k,7*k,2*k);
  // arms from the shoulders to the hands, then the club, hinging at the wrists
  const La=31*k,A=rad(P.A),hx=shX-Math.sin(A)*La,hy=shY+Math.cos(A)*La;
  c.strokeStyle='#e5c09b';c.lineWidth=4.5*k;c.beginPath();c.moveTo(shX-sw*.7,shY+1*k);c.lineTo(hx,hy);c.moveTo(shX+sw*.7,shY+1*k);c.lineTo(hx,hy);c.stroke();
  const Lc=(sh.k==='putt'?30:isWood(sh)?46:40)*k,C=rad(P.A+P.W),chx=hx-Math.sin(C)*Lc,chy=hy+Math.cos(C)*Lc;
  c.strokeStyle='#cfd5d9';c.lineWidth=1.8*k;c.beginPath();c.moveTo(hx,hy);c.lineTo(chx,chy);c.stroke();
  c.fillStyle='#3a3f44';c.beginPath();c.ellipse(chx,chy,(isWood(sh)?5:3.5)*k,2.6*k,C,0,6.3);c.fill();
  // the ball, sitting at address and gone after impact
  if(T<.75){c.fillStyle='#fff';c.beginPath();c.arc(shX+1*k,gy-2.2*k,2.2*k,0,6.3);c.fill();}
  else if(T<.9&&sh.k!=='putt'){const q=(T-.75)/.15;c.fillStyle='#fff';c.beginPath();c.arc(shX+1*k+q*w*.5,gy-2.2*k-q*h*(sh.k==='full'?.7:.3),2*k*(1-q*.4),0,6.3);c.fill();}
  c.restore();}
/* ---------- the swing camera in 3D: a lit, shaded golfer posed through a real swing ----------
   three.js is loaded only when someone first watches a shot. The golfer is built from simple solids; his arms
   and legs are placed with two-joint IK, so his feet stay planted and his hands follow the club through the swing.
   Units are metres. He stands at the origin facing the camera (+z), the ball in front of him, the target to his left (+x). */
const THREE_URL='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
let G3=null,g3Loading=false;
function loadThree(){if(window.THREE||g3Loading)return;g3Loading=true;const sc=document.createElement('script');sc.src=THREE_URL;sc.async=true;sc.onerror=()=>{g3Loading=false;};document.head.appendChild(sc);}
function g3Init(){if(G3)return G3;if(!window.THREE)return null;const T3=window.THREE;
  let rd;try{rd=new T3.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});}catch(e){G3={fail:true};return G3;}
  rd.setPixelRatio(1);rd.setSize(240,300,false);rd.shadowMap.enabled=true;rd.shadowMap.type=T3.PCFSoftShadowMap;
  const scene=new T3.Scene();scene.background=new T3.Color('#9fc4de');scene.fog=new T3.Fog('#9fc4de',9,26);
  const cam=new T3.PerspectiveCamera(27,240/300,.1,50);cam.position.set(2.2,1.5,5.5);cam.lookAt(.12,1.02,.1);
  scene.add(new T3.HemisphereLight('#dfefff','#3d6b38',.7));
  const sun=new T3.DirectionalLight('#fff4e0',.95);sun.position.set(2.5,5,3.5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-2,right:2,top:2.5,bottom:-1,near:.5,far:15});sun.shadow.radius=4;scene.add(sun);
  // ground: fairway in front, with a mown stripe and a distant tree line
  const gr=new T3.Mesh(new T3.PlaneGeometry(30,30),new T3.MeshStandardMaterial({color:'#4f8f43',roughness:1}));gr.rotation.x=-Math.PI/2;gr.receiveShadow=true;scene.add(gr);
  const strip=new T3.Mesh(new T3.PlaneGeometry(30,1.6),new T3.MeshStandardMaterial({color:'#5a9b4d',roughness:1}));strip.rotation.x=-Math.PI/2;strip.position.set(0,.002,.9);strip.receiveShadow=true;scene.add(strip);
  for(let i=0;i<14;i++){const t=new T3.Mesh(new T3.SphereGeometry(.9+Math.random()*.6,10,8),new T3.MeshStandardMaterial({color:i%2?'#2f5a34':'#386a3d',roughness:1}));t.position.set(-9+i*1.4,1.3+Math.random()*.6,-9-Math.random()*2);scene.add(t);}
  const M=(c,o)=>new T3.MeshStandardMaterial(Object.assign({color:c,roughness:.75},o||{}));
  const mat={shirt:M('#c2362a'),pants:M('#2d3436',{roughness:.85}),skin:M('#d9a57e',{roughness:.6}),shoe:M('#f2f2f2',{roughness:.5}),cap:M('#f4f4f4',{roughness:.6}),glove:M('#ffffff',{roughness:.5}),
    shaft:M('#c9ced3',{metalness:.85,roughness:.25}),head:M('#2b2f33',{metalness:.7,roughness:.3}),ball:M('#ffffff',{roughness:.35}),belt:M('#1a1a1a')};
  const add=(geo,m)=>{const x=new T3.Mesh(geo,m);x.castShadow=true;x.receiveShadow=true;scene.add(x);return x;};
  // limbs: a unit cylinder stretched between two points; joints: spheres
  const limb=(r0,r1,m)=>add(new T3.CylinderGeometry(r1,r0,1,14),m),ball=(r,m)=>add(new T3.SphereGeometry(r,16,12),m);
  const P={thighL:limb(.085,.07,mat.pants),thighR:limb(.085,.07,mat.pants),shinL:limb(.065,.05,mat.pants),shinR:limb(.065,.05,mat.pants),
    kneeL:ball(.07,mat.pants),kneeR:ball(.07,mat.pants),footL:add(new T3.BoxGeometry(.11,.08,.28),mat.shoe),footR:add(new T3.BoxGeometry(.11,.08,.28),mat.shoe),
    pelvis:add(new T3.CylinderGeometry(.16,.15,.2,16),mat.pants),belt:add(new T3.CylinderGeometry(.162,.162,.04,16),mat.belt),
    torso:add(new T3.CylinderGeometry(.2,.155,.52,18),mat.shirt),neck:limb(.055,.05,mat.skin),headM:ball(.105,mat.skin),
    cap:add(new T3.SphereGeometry(.112,16,10,0,Math.PI*2,0,Math.PI*.5),mat.cap),brim:add(new T3.CylinderGeometry(.11,.11,.012,16,1,false,-Math.PI*.5,Math.PI),mat.cap),
    upL:limb(.055,.047,mat.shirt),upR:limb(.055,.047,mat.shirt),foreL:limb(.044,.036,mat.skin),foreR:limb(.044,.036,mat.skin),
    shL:ball(.07,mat.shirt),shR:ball(.07,mat.shirt),elL:ball(.045,mat.skin),elR:ball(.045,mat.skin),hands:ball(.05,mat.glove),
    shaft:limb(.009,.006,mat.shaft),clubHead:add(new T3.BoxGeometry(.1,.05,.06),mat.head),ballM:ball(.0215,mat.ball)};
  P.torso.scale.set(1.25,1,.78);P.pelvis.scale.set(1.2,1,.85);P.belt.scale.set(1.2,1,.85);
  G3={T3,rd,scene,cam,P,mat,cv:rd.domElement};return G3;}
// place a unit cylinder between points a and b
function g3Seg(m,a,b){const T3=G3.T3,d=new T3.Vector3().subVectors(b,a),l=d.length();m.position.copy(a).addScaledVector(d,.5);m.scale.set(m.scale.x,l,m.scale.z);
  m.quaternion.setFromUnitVectors(new T3.Vector3(0,1,0),d.normalize());}
// two-joint IK: the middle joint for a limb from a to c with segment lengths l1,l2, bending toward `hint`
function g3IK(a,c,l1,l2,hint){const T3=G3.T3,ac=new T3.Vector3().subVectors(c,a),d=Math.min(ac.length(),l1+l2-1e-4),u=ac.clone().normalize();
  const x=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-x*x)),side=hint.clone().sub(u.clone().multiplyScalar(hint.dot(u))).normalize();
  return a.clone().addScaledVector(u,x).addScaledVector(side,h);}
// pose the golfer at swing time T (0 address, .58 top, .75 impact, 1 finish) for a shot of kind k
function g3Pose(T,k,wood,col){const {T3,P,mat}=G3,V=(x,y,z)=>new T3.Vector3(x,y,z),S=swingPose(T,k),putt=k==='putt',rad=Math.PI/180;
  mat.shirt.color.set(col);
  // posture: spine tilted toward the ball, knees flexed; hips and shoulders turn about the spine
  const tilt=(putt?40:k==='chip'?36:32)*rad,shift=S.X*.012,hipTurn=-S.U*45*rad,shTurn=-S.U*(putt?10:92)*rad;
  const pelvisC=V(shift,.89,-.05),feet=[V(.2,.04,.02),V(-.2,.04,.02)];
  if(S.Hl>0)feet[1].y+=S.Hl*.06;
  const hips=[0,1].map(i=>pelvisC.clone().add(V((i?-1:1)*.1,-.05,0).applyAxisAngle(V(0,1,0),hipTurn)));
  // legs
  [[hips[0],feet[0],P.thighL,P.shinL,P.kneeL,P.footL,0],[hips[1],feet[1],P.thighR,P.shinR,P.kneeR,P.footR,1]].forEach(([h,f,th,sh,kn,ft,i])=>{
    const kneeHint=V(i?-.05+S.Hl*.4:.12,0,1).normalize(),knee=g3IK(h,f.clone().add(V(0,.04,0)),.46,.46,kneeHint);
    g3Seg(th,h,knee);g3Seg(sh,knee,f.clone().add(V(0,.04,0)));kn.position.copy(knee);
    ft.position.set(f.x,f.y,f.z+.05);ft.rotation.set(i&&S.Hl>0?-S.Hl*.9:0,i?.25:-.25,0);});
  P.pelvis.position.copy(pelvisC);P.pelvis.rotation.set(0,hipTurn,0);P.belt.position.copy(pelvisC).add(V(0,.1,0));P.belt.rotation.set(0,hipTurn,0);
  // spine frame: tilt forward about x, then the shoulder turn about the tilted spine
  const qT=new T3.Quaternion().setFromAxisAngle(V(1,0,0),tilt),spineUp=V(0,1,0).applyQuaternion(qT),qS=new T3.Quaternion().setFromAxisAngle(spineUp,shTurn).multiply(qT);
  const base=pelvisC.clone().add(V(0,.1,0)),chestC=base.clone().addScaledVector(spineUp,.3);
  P.torso.position.copy(chestC);P.torso.quaternion.copy(qS);
  const neckB=base.clone().addScaledVector(spineUp,.56),headC=neckB.clone().addScaledVector(spineUp,.13).add(V(0,.02,0)).add(V(T>.82?.03:0,0,0));
  g3Seg(P.neck,neckB,headC);P.headM.position.copy(headC);P.cap.position.copy(headC).add(V(0,.02,0));
  const look=T>.82?Math.min(1,(T-.82)/.15):0;P.cap.rotation.set(tilt*.6-look*.5,look*.9,0);P.brim.position.copy(headC).add(V(look*.06,.04,.1-look*.04));P.brim.rotation.set(tilt*.4,look*1.2,0);
  const sh=[V(.19,.5,0),V(-.19,.5,0)].map(v=>base.clone().add(v.applyQuaternion(qS)));P.shL.position.copy(sh[0]);P.shR.position.copy(sh[1]);
  // the hands travel on the swing plane: a circle through the address hands, tilted to contain the target line
  const ballP=V(0,.0215,putt?.62:wood?.78:.7),C=base.clone().addScaledVector(spineUp,.42),d=ballP.clone().sub(C).normalize(),e1=V(-1,0,0);
  const armL=putt?.5:.62,cl=C.distanceTo(ballP)-armL,th=S.A*(putt?.7:S.A>0?.76:.8)*rad,ph=th+S.W*(putt||S.W<0?1:1.5)*rad;
  // the swing plane turns with the shoulders, so at the top and the finish the hands and club go round behind him
  const yAx=V(0,1,0),pr=shTurn*.5;
  const off=d.clone().multiplyScalar(Math.cos(th)*armL).addScaledVector(e1,Math.sin(th)*armL);
  if(!putt)off.addScaledVector(d,-Math.abs(Math.sin(th))*.08);off.applyAxisAngle(yAx,pr);
  const hands=C.clone().add(off);
  const sdir=d.clone().multiplyScalar(Math.cos(ph)).addScaledVector(e1,Math.sin(ph)).normalize().applyAxisAngle(yAx,pr*1.2),headP=hands.clone().addScaledVector(sdir,cl);
  P.hands.position.copy(hands);
  // arms: shoulders to hands, elbows bending down and out
  [[sh[0],P.upL,P.foreL,P.elL,1],[sh[1],P.upR,P.foreR,P.elR,-1]].forEach(([s0,up,fo,el,sd])=>{const hint=V(sd*.6,-1,.3).normalize(),elb=g3IK(s0,hands,.3,.29,hint);g3Seg(up,s0,elb);g3Seg(fo,elb,hands);el.position.copy(elb);});
  g3Seg(P.shaft,hands,headP);P.clubHead.position.copy(headP);P.clubHead.scale.set(putt?.9:wood?1.4:1,wood?1.6:1,wood?1.5:.8);P.clubHead.quaternion.copy(P.shaft.quaternion);
  // the ball: at address, then off toward the target after impact
  if(T<.75)P.ballM.position.copy(ballP);else{const q=Math.min(1,(T-.75)/.12);P.ballM.position.set(ballP.x+q*(putt?.8:3),ballP.y+q*(putt?0:k==='full'?2.2:.8),ballP.z-q*1.5);P.ballM.visible=q<1;}
  if(T<.75)P.ballM.visible=true;}
// the motion-captured golfer (a Mixamo character and swings): loaded once, the first time someone watches; the mannequin stands in until then.
// Each swing is mapped onto the game's swing timeline by four moments in the capture: address, top, impact and finish (seconds).
// keys: moments in each capture with where the shaft points then ('ball' = at the ball; otherwise a direction, target = +x, toward the ball = +z)
const G3M={Drive:{f:'drive',k:[6.6,8.0,8.39,9.2],ry:-Math.PI/2,keys:[[6.6,'ball'],[7.4,[-1,.15,.12]],[8.0,[1,.05,-.25]],[8.39,'ball'],[8.62,[.55,.8,.12]],[9.2,[-.6,-.55,-.55]]]},
  Chip:{f:'chip',k:[.45,1.1,1.42,1.9],ry:Math.PI/2,keys:[[.45,'ball'],[.85,[-1,.2,.12]],[1.1,[-.35,.93,-.1]],[1.42,'ball'],[1.6,[.7,.6,.2]],[1.9,[.15,.95,-.25]]]},
  Putt:{f:'putt',k:[.45,1.0,1.28,1.55],ry:Math.PI/2,keys:[]}};
// real-looking clubs, built in the club's own frame: the hosel at the origin, the shaft up +y to the butt, the face looking along +x, the toe out along +z
const G3CLUB={driver:{L:1.14,lie:56},wood:{L:1.07,lie:57},iron:{L:.96,lie:62},wedge:{L:.9,lie:64},putter:{L:.86,lie:70}};
function g3Club(type){const T3=G3.T3,c=G3CLUB[type],L=c.L,gp=new T3.Group(),M=(col,o)=>new T3.MeshStandardMaterial(Object.assign({color:col,roughness:.35,metalness:.85},o||{}));
  const add=(geo,m,par,pos)=>{const x=new T3.Mesh(geo,m);x.castShadow=true;if(pos)x.position.set(...pos);(par||gp).add(x);return x;};
  const steel=M('#c9ced3',{roughness:.3,metalness:.4}),chrome=M('#d7dce0',{roughness:.28,metalness:.35}),dark=M('#23272c',{roughness:.25,metalness:.25}),grip=M('#1a1a1a',{roughness:.9,metalness:0});
  add(new T3.CylinderGeometry(.0072,.0045,L-.33,10),type==='driver'||type==='wood'?M('#2a2d33',{roughness:.4,metalness:.3}):steel,gp,[0,.07+(L-.33)/2,0]);
  add(new T3.CylinderGeometry(.0125,.0105,.26,12),grip,gp,[0,L-.13,0]);
  add(new T3.CylinderGeometry(.0085,.0068,.075,10),type==='driver'||type==='wood'?dark:chrome,gp,[0,.035,0]);
  const hd=new T3.Group();hd.rotation.x=(90-c.lie)*Math.PI/180;gp.add(hd);
  if(type==='driver'||type==='wood'){const k=type==='driver'?1:.78,b=add(new T3.SphereGeometry(.5,24,16),dark,hd,[-.052*k,.03*k,.06*k]);b.scale.set(.11*k,.058*k,.12*k);
    add(new T3.BoxGeometry(.004,.044*k,.095*k),M('#5a6068',{roughness:.5}),hd,[.002,.028*k,.06*k]);}
  else if(type==='putter'){add(new T3.BoxGeometry(.028,.024,.11),M('#b9bfc5',{roughness:.3,metalness:.35}),hd,[-.014,.013,.05]);add(new T3.BoxGeometry(.03,.002,.004),M('#111',{metalness:0}),hd,[-.014,.026,.05]);}
  else{// an iron's blade: low at the heel, rising to a rounded toe
    const h=type==='wedge'?1.15:1,sp=new T3.Shape();sp.moveTo(0,.004);sp.lineTo(.07,0);sp.quadraticCurveTo(.086,.002,.085,.028*h);sp.quadraticCurveTo(.083,.05*h,.064,.053*h);sp.lineTo(.008,.037*h);sp.quadraticCurveTo(0,.035*h,0,.02);sp.lineTo(0,.004);
    const bl=add(new T3.ExtrudeGeometry(sp,{depth:.016,bevelEnabled:true,bevelThickness:.003,bevelSize:.002,bevelSegments:2,curveSegments:8}),chrome,hd,[-.003,0,.004]);bl.rotation.y=-Math.PI/2;
    const gr=add(new T3.PlaneGeometry(.06,.03*h),M('#aab0b6',{roughness:.6,metalness:.2}),hd,[.0005,.022*h,.044]);gr.rotation.y=Math.PI/2;}
  gp.visible=false;G3.scene.add(gp);return gp;}
function g3LoadModel(){const g=G3;if(!g||g.fail||g.M||g.mLoading)return;const T3=g.T3;
  if(!T3.GLTFLoader){if(!g.ldr){g.ldr=1;const s=document.createElement('script');s.src='vendor/GLTFLoader-r128.js';s.onload=()=>g3LoadModel();s.onerror=()=>{g.mLoading=true;};document.head.appendChild(s);}return;}
  g.mLoading=true;const L=new T3.GLTFLoader(),get=f=>new Promise((ok,no)=>L.load('models/'+f+'.glb',ok,undefined,no));
  Promise.all([get('golfer'),...Object.values(G3M).map(c=>get(c.f))]).then(([gl,...an])=>{
    const root=new T3.Group(),m=gl.scene;root.add(m);root.visible=false;g.scene.add(root);const shirt=[];
    m.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;const mt=o.material=o.material.clone();mt.roughness=Math.max(mt.roughness||0,.8);mt.metalness=0;
      if(/Hair|Eyelash/.test(o.name)){mt.transparent=false;mt.alphaTest=.45;}
      if(/Shirt/.test(o.name))shirt.push(mt);if(/Shorts/.test(o.name))mt.color.set('#4a5260');});
    const mix=new T3.AnimationMixer(m),clips={};
    Object.keys(G3M).forEach((n,i)=>{const a=mix.clipAction(an[i].animations[0]);a.play();a.enabled=false;clips[n]=a;});
    g.M={root,m,mix,clips,shirt,B:n=>m.getObjectByName('mixamorig'+n),cal:{}};}).catch(()=>{});}
function g3At(n,t){const M=G3.M;Object.keys(M.clips).forEach(x=>{M.clips[x].enabled=x===n;});M.clips[n].time=t;M.mix.update(0);M.root.updateMatrixWorld(true);}
// the grip: between the two hands, a little along the fingers
function g3Grip(){const M=G3.M,T3=G3.T3,w=n=>M.B(n).getWorldPosition(new T3.Vector3());return w('LeftHandMiddle1').add(w('RightHandMiddle1')).multiplyScalar(.5);}
// stand him on the ground at the origin; then, at each key moment, note how the shaft sits in his left hand, so between keys it turns with his wrists
function g3Cal(n,type){const M=G3.M,T3=G3.T3,c=G3M[n],L=G3CLUB[type].L,w=b=>M.B(b).getWorldPosition(new T3.Vector3()),qh=()=>M.B('LeftHand').getWorldQuaternion(new T3.Quaternion());
  M.root.rotation.set(0,c.ry,0);M.root.position.set(0,0,0);g3At(n,c.k[0]);const lf=w('LeftToeBase'),rf=w('RightToeBase'),mid=lf.clone().add(rf).multiplyScalar(.5);
  const off=new T3.Vector3(-mid.x,-(Math.min(lf.y,rf.y)-.035),-mid.z);M.root.position.copy(off);g3At(n,c.k[0]);
  const grip=g3Grip(),R=L-.09,hy=grip.y-.012,dir=new T3.Vector3(0,-Math.min(hy,R*.97),0);dir.z=Math.sqrt(Math.max(0,R*R-dir.y*dir.y));dir.normalize();
  const aim=grip.clone().addScaledVector(dir,R),ball=aim.clone().add(new T3.Vector3(0,0,type==='driver'?.055:.035));ball.y=type==='driver'?.05:.0215;const qa=qh();
  const keys=c.keys.map(([t,d])=>{g3At(n,t);const gp=g3Grip(),v=d==='ball'?aim.clone().sub(gp).normalize():new T3.Vector3(...d).normalize();return {t,l:v.applyQuaternion(qh().invert())};});
  return {off,ball,aim,grip,qa,keys,R};}
function g3PoseModel(T,k,sh,col){const g=G3,M=g.M,T3=g.T3,P=g.P,n=k==='putt'?'Putt':k==='chip'?'Chip':'Drive',c=G3M[n],K=c.k;
  const type=k==='putt'?'putter':k==='chip'?'wedge':/^Driver/i.test(sh.text||'')?'driver':isWood(sh)?'wood':/wedge|^PW|^SW|^LW|^GW/i.test(sh.text||'')?'wedge':'iron';
  const key=n+type,cal=M.cal[key]||(M.cal[key]=g3Cal(n,type));M.clubs=M.clubs||{};const club=M.clubs[type]||(M.clubs[type]=g3Club(type));
  Object.values(M.clubs).forEach(x=>{x.visible=x===club;});P.shaft.visible=P.clubHead.visible=false;
  const t=T<=.58?K[0]+(K[1]-K[0])*T/.58:T<=.75?K[1]+(K[2]-K[1])*(T-.58)/.17:K[2]+(K[3]-K[2])*Math.min(1,(T-.75)/.25);
  M.root.rotation.set(0,c.ry,0);M.root.position.copy(cal.off);g3At(n,t);M.shirt.forEach(mt=>mt.color.set(col));
  const grip=g3Grip(),qh=M.B('LeftHand').getWorldQuaternion(new T3.Quaternion()),ks=cal.keys;let dir,org;
  if(k==='putt'){// a putter rides with the hands like a pendulum, low to the ground
    org=cal.aim.clone().addScaledVector(grip.clone().sub(cal.grip),1.25);org.y=Math.min(.14,Math.max(cal.aim.y,cal.aim.y+(grip.y-cal.grip.y)*1.25));dir=org.clone().sub(grip).normalize();}
  else{let i=0;while(i<ks.length-2&&t>ks[i+1].t)i++;const u=Math.max(0,Math.min(1,(t-ks[i].t)/(ks[i+1].t-ks[i].t))),e=u*u*(3-2*u);
    dir=ks[i].l.clone().lerp(ks[i+1].l,e).normalize().applyQuaternion(qh);
    const wz=Math.max(0,1-Math.abs(T-.75)/.05);if(wz>0)dir.lerp(cal.aim.clone().sub(grip).normalize(),wz).normalize();
    org=grip.clone().addScaledVector(dir,cal.R);}
  // the face: square at address and impact, turning with the hands in between
  const f=new T3.Vector3(1,0,0).applyQuaternion(qh.clone().multiply(cal.qa.clone().invert())),sq=k==='putt'?1:Math.max(0,1-Math.min(Math.abs(T)/.25,Math.abs(T-.75)/.12));
  f.lerp(new T3.Vector3(1,0,0),sq);const Y=dir.clone().negate(),X=f.sub(Y.clone().multiplyScalar(f.dot(Y)));if(X.lengthSq()<1e-6)X.set(0,0,1);X.normalize();const Z=X.clone().cross(Y);
  club.quaternion.setFromRotationMatrix(new T3.Matrix4().makeBasis(X,Y,Z));club.position.copy(org);
  if(!M.tee){M.tee=new T3.Mesh(new T3.CylinderGeometry(.004,.0015,.045,8),new T3.MeshStandardMaterial({color:'#f3f0e6',roughness:.6}));M.tee.castShadow=true;g.scene.add(M.tee);}
  M.tee.visible=type==='driver';M.tee.position.set(cal.ball.x,.0175,cal.ball.z);
  const b=cal.ball;if(T<.75){P.ballM.position.copy(b);P.ballM.visible=true;}else{const q=Math.min(1,(T-.75)/.12);P.ballM.position.set(b.x+q*(k==='putt'?.8:3),b.y+q*(k==='putt'?0:k==='full'?2.2:.8),b.z-q*1.5);P.ballM.visible=q<1;}}
// render the 3D swing into a panel; returns false if 3D isn't available (the flat drawing is used instead)
function drawSwing3D(c,x,y,w,h,u,sh,T,col){loadThree();const g=g3Init();if(!g||g.fail)return false;
  g3LoadModel();const real=!!g.M;Object.keys(g.P).forEach(n=>{if(!/^(shaft|clubHead|ballM)$/.test(n))g.P[n].visible=!real;});
  if(real){g.M.root.visible=true;g3PoseModel(T,sh.k,sh,col);}else{g.P.shaft.visible=g.P.clubHead.visible=true;g3Pose(T,sh.k,isWood(sh),col);}g.rd.render(g.scene,g.cam);
  c.save();c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,u*.5);else c.rect(x,y,w,h);c.clip();
  const sw=g.cv.width,shh=g.cv.height,s=Math.max(w/sw,h/shh);c.drawImage(g.cv,x+(w-sw*s)/2,y+(h-shh*s)/2,sw*s,shh*s);c.restore();
  c.save();c.strokeStyle='rgba(255,255,255,.25)';c.lineWidth=1;c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,u*.5);else c.rect(x,y,w,h);c.stroke();
  c.fillStyle='rgba(12,22,17,.55)';c.fillRect(x+u*.3,y+u*.25,u*3.6,u*1.2);c.fillStyle='#fff';c.font=`600 ${Math.round(u*.85)}px 'Barlow Condensed','Arial Narrow',sans-serif`;c.textBaseline='top';c.textAlign='left';c.fillText('SWING',x+u*.5,y+u*.35);c.restore();
  return true;}

// how the strike felt, in words, from where it hit the face
function strikeTag(q){const [x,y,r,f]=q;if(f==='f')return 'Fat';if(f==='w')return x>0?'Off the toe':'Shank';if(r>=92)return 'Pure';if(r>=80)return 'Flush';if(r>=65)return 'Solid';
  return Math.abs(x)>=Math.abs(y)?(x>0?'Off the toe':'Off the heel'):(y<0?'Thin':'High on the face');}
// the clubface heat map: the sweet spot glows green, cooling through yellow to red at the edges; the white mark is where it hit
function drawFaceMap(c,x,y,w,h,u,sh,show){if(!sh.q||sh.k==='putt'||sh.k==='drop'||sh.k==='pick')return;panel(c,x,y,w,h,'STRIKE',u);if(!show)return;
  const q=sh.q,wood=sh.k==='full'&&isWood(sh),fw=w*.78,fh=h*(wood?.42:.36),cx=x+w/2,cy=y+h*.48;
  c.save();c.beginPath();
  if(wood){c.ellipse(cx,cy,fw/2,fh/2,0,0,6.3);}
  else{const l=cx-fw/2,r=cx+fw/2,t=cy-fh/2,b=cy+fh/2;c.moveTo(l+fh*.25,b);c.lineTo(r-fh*.15,b);c.quadraticCurveTo(r,b,r,b-fh*.25);c.lineTo(r-fh*.1,t+fh*.05);c.quadraticCurveTo(r-fh*.2,t-fh*.08,r-fh*.5,t);c.lineTo(l+fh*.2,t+fh*.32);c.quadraticCurveTo(l,t+fh*.4,l,b-fh*.2);c.quadraticCurveTo(l,b,l+fh*.25,b);c.closePath();}
  const g=c.createRadialGradient(cx,cy,0,cx,cy,fw*.55);g.addColorStop(0,'#2fb36b');g.addColorStop(.28,'#9bd14e');g.addColorStop(.5,'#f2c84b');g.addColorStop(.75,'#f08a3c');g.addColorStop(1,'#d64533');
  c.fillStyle=g;c.fill();c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1.2;c.stroke();c.clip();
  if(!wood){c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=1;for(let i=-3;i<=3;i++){c.beginPath();c.moveTo(cx-fw*.4,cy+i*fh*.12);c.lineTo(cx+fw*.4,cy+i*fh*.12);c.stroke();}}
  c.restore();
  const mx=cx+q[0]*fw*.46,my=cy-q[1]*fh*.46,mr=Math.max(3,u*.42);
  c.fillStyle='rgba(255,255,255,.95)';c.strokeStyle='#10201a';c.lineWidth=1.5;c.beginPath();c.arc(mx,my,mr,0,6.3);c.fill();c.stroke();
  const tag=strikeTag(q),good=q[2]>=80,ok=q[2]>=60;c.font=`700 ${Math.round(u*1.05)}px 'Barlow Condensed','Arial Narrow',sans-serif`;c.textAlign='center';c.textBaseline='alphabetic';
  c.fillStyle=good?'#7ee08f':ok?'#f2c84b':'#f08a6c';c.fillText(`${tag.toUpperCase()} · ${q[2]}`,cx,y+h-u*.45);}
// both panels for the shot being played: swing camera bottom left, strike map bottom right
function drawShotPanels(c,W,H,u,sh,P,live,col){if(!sh||sh.k==='drop'||sh.k==='pick')return;const pw=Math.min(W*.28,H*.23),sw=Math.min(W*.34,H*.27),T=swingT(P,live);
  drawSwingCam(c,u*.5,H-sw*1.25-u*.5,sw,sw*1.25,u,sh,T,col);
  drawFaceMap(c,W-pw-u*.5,H-pw*.95-u*.5,pw,pw*.95,u,sh,!live||P.f>0);}
function drawFlag(c,px,py,u){c.strokeStyle='#10201a';c.lineWidth=Math.max(1.5,u*.14);c.beginPath();c.moveTo(px,py);c.lineTo(px,py-u*2.2);c.stroke();
  c.fillStyle='#e3b420';c.beginPath();c.moveTo(px,py-u*2.2);c.lineTo(px+u*1.3,py-u*1.75);c.lineTo(px,py-u*1.3);c.fill();}
function drawMap(dt){
  const A=ui.anim,cv=document.getElementById('cv');if(!cv||!A.h)return;const c=cv.getContext('2d'),W=cv.width,H=cv.height,h=A.h,shots=A.cur.shots,sh=shots[Math.min(A.si,shots.length-1)];
  const moving=A.phase==='shot',P=moving?shotPhase(sh,A.t):{sw:1,f:1},e=1-Math.pow(1-P.f,2.2),ball=moving?shotAt(sh,e):sh.to;
  const tgt=camFor(A,dist(moving?sh.from:sh.to,h.green)<=52);
  if(!A.cam)A.cam=tgt;else{const k=1-Math.exp(-(dt||16)/260);A.cam={x:A.cam.x+(tgt.x-A.cam.x)*k,y:A.cam.y+(tgt.y-A.cam.y)*k,s:A.cam.s+(tgt.s-A.cam.s)*k};}
  const cam=A.cam,X=x=>(x-cam.x)*cam.s+W/2,Y=y=>H/2-(y-cam.y)*cam.s,Sc=cam.s;
  drawCourse(c,W,H,h,X,Y,Sc);
  const px=X(h.pin[0]),py=Y(h.pin[1]),u=Math.max(W/55,5);
  const holed=!!sh.holed,sunk=holed&&!moving,hw=sunk?(A.phase==='wait'?A.w/1000:1):0;
  c.fillStyle='#10201a';c.beginPath();c.arc(px,py,Math.max(2.5,.45*Sc),0,6.3);c.fill();
  if(sunk&&hw<1){c.strokeStyle=`rgba(255,255,255,${1-hw})`;c.lineWidth=Math.max(2,u*.22);c.beginPath();c.arc(px,py,u*(.6+hw*3.2),0,6.3);c.stroke();
    c.strokeStyle=`rgba(227,180,32,${1-hw})`;c.beginPath();c.arc(px,py,u*(.3+hw*1.8),0,6.3);c.stroke();}
  c.strokeStyle='#10201a';c.lineWidth=Math.max(1.5,u*.14);c.beginPath();c.moveTo(px,py);c.lineTo(px,py-u*2.2);c.stroke();
  c.fillStyle='#e3b420';c.beginPath();c.moveTo(px,py-u*2.2);c.lineTo(px+u*1.3,py-u*1.75);c.lineTo(px,py-u*1.3);c.fill();
  const wg=(D.golfers.find(g=>g.id===ui.watch)||(ui.board&&(ui.board.players||[]).find(p=>p.id===ui.watch))||{}),gcol=COLORS[wg.color]||'#c2362a';
  for(const s of A.trail)drawTracer(c,X,Y,Sc,H,u,s,1,gcol,false);
  if(moving){drawTracer(c,X,Y,Sc,H,u,sh,e,gcol,true);drawGolfer(c,X,Y,u,sh,swingT(P,true),gcol,P.f<.35?1:Math.max(0,1-(P.f-.35)/.3));}
  A.panel={sh,P,live:moving,col:gcol,u};
  if(sunk){if(hw<1){c.fillStyle=`rgba(255,255,255,${Math.min(1,2.2*(1-hw))})`;c.font=`700 ${Math.round(u*1.5)}px 'Barlow Condensed','Arial Narrow',sans-serif`;c.textAlign='center';
      c.strokeStyle=`rgba(16,32,26,${Math.min(1,2.2*(1-hw))})`;c.lineWidth=u*.3;const ty=Math.max(u*2,py-u*3.4-hw*u);c.strokeText('IN THE HOLE',px,ty);c.fillText('IN THE HOLE',px,ty);}
    return;}
  const lift=moving?shotLift(sh,e,Sc,H):0,air=lift?lift/Math.max(1,H*.13):0;
  const drop=holed&&P.f>.88?Math.max(0,1-(P.f-.88)/.12):1,br=u*.42*(1+air*.9)*drop;
  const bx=X(ball[0]),by=Y(ball[1]);if(br<=.2)return;
  const mineG=D.golfers.find(g=>g.id===ui.watch);
  c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(bx+lift*.3,by+u*.12,br,br*.6,0,0,6.3);c.fill();
  c.fillStyle='#fff';c.strokeStyle=gcol;c.lineWidth=Math.max(1.5,u*.16);c.beginPath();c.arc(bx,by-lift,br,0,6.3);c.fill();c.stroke();
}

/* ---------- the guide: how Range Rat works ---------- */
// "19 · So" for college, "Age 34" otherwise
const ageTag=(yr,tour)=>yr?`<small class="age">${isCol(tour)?`${ageOf(yr)} · ${CLS[yr-Y.col]||''}`:`Age ${ageOf(yr)}`}</small>`:'';
function guideHTML(){const s=S(),ev=Math.round(4*s.round_min),Z=Math.round(FIELD*.2),cy=s.coach_age_yr,ca=ageOf(cy);
  const stage=(cls,name,yrs,ages,body)=>`<div class="gstage ${cls}"><div class="ghead"><b>${name}</b><span>${yrs}</span><span class="gage">${ages}</span></div><div class="gbody">${body}</div></div>`;
  return `<section class="intro"><p class="eyebrow">How it works</p><h1>The game in five minutes</h1><p class="lede">Range Rat is a golf management game. You never hit a shot. You sign young golfers, decide how they train, pick their events and watch them play on the clock alongside everyone else's golfers. Each golfer has hidden ceilings, a temperament and good and bad days, so no two careers go the same way.</p>${D.me?'':'<button class="btn sm" data-act="go" data-v="auth">← Back to sign in</button>'}</section>

<section class="sec gsec"><h2>Time in Range Rat</h2>
<div class="gfacts">
 <div><b>1 week</b><span>One season, Monday to Sunday. Every golfer turns a year older each Monday.</span></div>
 <div><b>Mon–Sat</b><span>A qualifying event every night on every tour, 6 to 10pm New York time.</span></div>
 <div><b>Sunday</b><span>The Finale: bigger purse, more points. Then the season closes at midnight.</span></div>
 <div><b>~${ev} min</b><span>One event: four rounds, one hole every ${Math.round(s.round_min*60/18)} seconds, played live for everyone at once.</span></div>
</div>
<p>A full career is ${Y.last} seasons, about eight months of real time. Every night at midnight New York time each golfer gets new range sessions and recovers some stamina, and coaches open their diaries for the next day.</p></section>

<section class="sec gsec"><h2>The life of a golfer</h2><p class="muted">One season is one year of his life, so he ages a year every week.</p>
<div class="gline">
${stage('jr','Junior','Seasons 1 to 3','Ages 15 to 17',`<p>Every golfer you sign (${fmt$(s.recruit_cost)}) starts at 15 on the <b>Junior Tour</b>. Junior events are free to enter and pay small purses, but what really counts is his <b>ranking</b>: it decides how much the colleges will offer him.</p>`)}
${stage('rec','Recruiting','End of season 3','Age 18',`<p>When he turns 18 he gets <b>three college offers</b>, each with an <b>NIL payment</b> that goes straight into your bank. The best juniors (high ranking, wins, strong ratings) get far bigger offers. Pick one on his Roster page; if you don't within 2 days, he takes the best.</p>`)}
${stage('col','College','Seasons 4 to 7','Ages 18 to 21',`<p>Freshman, sophomore, junior and senior years, all on the one <b>Collegiate Tour</b> with every college player in the game.</p><p>When his senior year ends, the top ${Z} in the collegiate standings turn pro on the <b>${TOURS.p2.name}</b>. Everyone else starts on the <b>${TOURS.p3.name}</b>.</p>`)}
${stage('pro','Professional','Seasons 8 to 23','Ages 22 to 49',`<p>Three tours, from bottom to top: <b>${TOURS.p3.name}</b>, <b>${TOURS.p2.name}</b> and <b>${TOURS.p1.name}</b>. At the end of every season the top ${Z} in the standings are promoted a tour and the bottom ${Z} are relegated.</p><p>From about age 40 his power and driving accuracy slowly start to fade.</p>`)}
${stage('sen','Senior','Seasons 24 to 33','Ages 50 to 59',`<p>At 50 he moves to the senior game. Golfers coming off the ${TOURS.p1.name}, and the top ${Z} from the ${TOURS.p2.name}, start on the <b>${TOURS.c1.name}</b>. Everyone else starts on the <b>${TOURS.c2.name}</b>. The same promotion and relegation applies between the two.</p><p>His short game and irons now fade a little each season too.</p>`)}
${stage('ret','Retirement','After season 33','Age 59 on',`<p>After his last season he retires and opens a coaching practice. You can also retire him early, any time from age ${ca} (season ${cy}).</p>`)}
</div>
<div class="scroll"><table class="tbl gtable"><thead><tr><th>Tour</th><th>Level</th><th class="num">Usual purse</th><th class="num">Entry fee</th></tr></thead><tbody>
${['jr','col0','p3','p2','p1','c2','c1'].map(t=>`<tr><td>${TOURS[t].name}</td><td class="small">${{jr:'Ages 15–17',col0:'Ages 18–21',p3:'Pro, bottom',p2:'Pro, middle',p1:'Pro, top',c2:'Senior, lower',c1:'Senior, top'}[t]}</td><td class="num">${fmt$(TOURS[t].purse*s.purse_mult)}</td><td class="num">${TOURS[t].fee?fmt$(TOURS[t].fee*s.fee_mult):'Free'}</td></tr>`).join('')}
</tbody></table></div><p class="muted small">Signature events and the Sunday Finale pay more than a standard event; smaller events pay less.</p></section>

<section class="sec gsec"><h2>Training</h2>
<p>Each golfer gets <b>${s.sessions_per_day} range session${s.sessions_per_day>1?'s':''} a day</b>. A <b>drill</b> works one skill hard; a <b>general session</b> lifts a whole area (short game, irons, long game or the mental side) a little. A day off restores stamina.</p>
<p>Every skill has a hidden <b>ceiling</b>. The scouts' grades, A down to F, hint at it, and gains shrink as he gets close. Areas he doesn't work on get slightly rusty each day. Tired golfers train and play worse, and every event costs some stamina.</p>
<p><b>Standing orders</b> spend a session he didn't use by midnight, so a golfer keeps improving even on days you don't log in.</p></section>

<section class="sec gsec"><h2>What each skill does</h2><p class="muted">Ratings run up to 99. Green is 75 and up, yellow 60 to 74, red 59 and below.</p><div class="gskills"><div><h3>Short game</h3><dl><dt>Full wedges</dt><dd>Sharper approaches from inside about 125 yards.</dd><dt>Pitches</dt><dd>Gets it close from 20 to 45 yards out.</dd><dt>Chips</dt><dd>Saves strokes when he misses a green.</dd><dt>Bunker shots</dt><dd>Gets him out of greenside sand and near the hole.</dd><dt>Short putts</dt><dd>Holes the ones inside ten feet.</dd><dt>Lag putts</dt><dd>Leaves long putts close, so fewer three-putts.</dd></dl></div><div><h3>Irons</h3><dl><dt>Accuracy</dt><dd>Keeps approach shots on line with the flag.</dd><dt>Distance control</dt><dd>Finishes approaches pin-high instead of short or long.</dd><dt>Wind performance</dt><dd>Holds his iron shots steady when it blows.</dd></dl></div><div><h3>Long game</h3><dl><dt>Power</dt><dd>More yards off the tee, so shorter clubs into greens.</dd><dt>Accuracy</dt><dd>Finds more fairways and stays out of trouble.</dd></dl></div><div><h3>Miscellaneous</h3><dl><dt>Mental game</dt><dd>Keeps a bad hole from turning into a bad round.</dd><dt>Momentum</dt><dd>Lets a good run grow into a hot streak.</dd><dt>Wind performance</dt><dd>Helps his driver, wedges and touch shots when it\u2019s windy.</dd><dt>Attitude</dt><dd>Helps him bounce back and get more out of the range.</dd><dt>Clutchness</dt><dd>Raises his game under pressure, late on Sunday and on the cut line.</dd><dt>Intelligence</dt><dd>Better decisions: when to attack, when to play safe and which club to hit.</dd></dl></div></div></section>

<section class="sec gsec"><h2>Events</h2>
<p>Enter golfers by hand, or set an automatic rule for each one (every event, or only the big ones). Entries close <b>${s.deadline_min} minutes</b> before the start, then the field is set: managers' golfers first, then tour regulars, ${FIELD} in all.</p>
<p>Four rounds. After two, the top ${CUT} and ties make the <b>cut</b>. Finishing positions earn prize money and <b>season points</b>. After Sunday's Finale the standings decide promotion and relegation and pay a bonus to the leaders: half a standard purse for the winner, then smaller bonuses down to the top ${Z}.</p>
<p><b>Team Match Play</b> runs alongside them: ${s.tm_size===2?'two':s.tm_size} of your golfers from one level make a team and play best ball (each hole the team's lowest score counts), nine holes a match, knockout between teams. Computer regulars fill any empty places. One fee per team, from ${fmt$(s.tm_fee_jr)} for juniors up to ${fmt$(s.tm_fee_p1)} on the Premier Tour; and you can enter as many teams as you have golfers for. If only your teams enter, each plays a computer team and the house matches the fee, so a win doubles it.</p>
<p><b>Holes in one.</b> Any hole in one by a manager's golfer, in a tour event or a Match Play, earns a ${fmt$(s.ace_bonus)} bonus. In a Quick-Fire Open it's worth ${fmt$(s.qf_ace)}.</p>
<p><b>Quick-Fire Opens</b> run every ${s.qf_every_min} minutes, all day, one for each level: juniors, college, each pro tour and each senior tour. They're two rounds with no cut and cost ${fmt$(s.qf_fee)} to enter. Each pot is scaled like its main tour, from ${fmt$(qfBase('jr'))} for juniors and ${fmt$(qfBase('col'))} for college up to ${fmt$(qfBase('p1'))} on the ${TOURS.p1.name}, and grows with every entry, and the top third of the field get paid. There are bonuses for most greens hit, most up and downs (on the green from 40 yards or closer, then one putt), the long drive and holes in one, for managers' golfers only. They don't tire golfers or count toward their career.</p>
<p><b>Match Play</b> runs alongside them, one bracket per level: head to head over nine holes, with sudden death if it's tied, and the winner moves on until one golfer is left. Only managers' golfers play, and it needs at least two rosters to go ahead. Entry costs more the higher the level, from ${fmt$(s.mp_fee_jr)} for juniors to ${fmt$(s.mp_fee_p1)} on the Premier Tour, and the pot is made up of the entry fees. The champion takes 40%, the runner-up 20%, and the semifinalists and quarterfinalists share the rest.</p></section>

<section class="sec gsec"><h2>The tour regulars</h2>
<p>The computer golfers who fill the fields live careers of their own. Juniors and college players move up a class each season and improve as they go; the best junior seniors become college freshmen, and graduating college seniors turn pro, the top ${Math.round(FIELD*.2)} on the Challenger Tour and the rest on the Mini Tour.</p>
<p>Computer pros get a little better in their first few years, then hold steady, and from 40 they start to slip, like everyone else. They're promoted and relegated on the standings, move to the senior tours at 50 and retire at 60, like everyone else. Only as many college graduates turn pro as there's room for; the others give up the game. A dominant veteran won't stay on top forever.</p>
</section>
<section class="sec gsec"><h2>Retirement and coaching</h2>
<p>A retired golfer becomes a <b>coach</b> rated in four areas: short game, irons, long game and the head. Coaching talent is partly luck, but the better he played, the higher his floor: a former ${TOURS.p1.name} winner is never a bad coach. Coaches can be bought and sold on the transfer market too: list yours from his page, and a few computer coaches are always for sale. A coach is priced on his coaching ratings, well below a player, since he'll never compete again.</p>
<div class="gfacts">
 <div><b>×${s.coach_max}</b><span>The most a great coach multiplies a range session by, in his best area.</span></div>
 <div><b>${s.lessons_per_day} a day</b><span>Lessons each coach gives, shared across every manager. Good coaches book up.</span></div>
 <div><b>Free</b><span>Lessons from your own retired golfers, for your own roster.</span></div>
 <div><b>You set it</b><span>The fee other managers pay to book your coaches. Other managers book him for their golfers' sessions, and the fees come to you.</span></div>
</div>
<p>Pick a coach for any golfer on his Roster page. Booking is per session: if the coach is full that day, your golfer trains alone.</p></section>

<section class="sec gsec"><h2>Money and the market</h2>
<p>New rosters start with ${fmt$(s.start_cash)} and up to ${s.max_golfers} active golfers. Signing a junior costs ${fmt$(s.recruit_cost)}. Money comes from prize money, season bonuses, NIL deals, coaching fees and sales. It goes on signings, entry fees, lessons and equipment (${EQC.map(fmt$).join(', ')} for each upgrade). There are three sets of clubs (wedges and putter, irons, driver and woods), each worth 1.5 rating points per level on those shots, and a caddy: Beginner, Advanced or Expert, at the same prices. A caddy steadies the mental game, as if each level added 5 to course management, mental, clutch, attitude and momentum while he plays.</p>
<p>Anyone from college freshman up can be sold: list a golfer at your price for other managers and rival coaches, or take a quick sale at about 60% of his market value. Golfers you sell keep playing, so you'll meet them in the field.</p></section>`;}

function offersHTML(g){const L=g.offers&&g.offers.list;if(!L||!L.length)return '';const left=Math.max(0,Date.parse(g.offers.at)+2*864e5-Date.now());
  return `<section class="sec offers"><h2>College offers</h2><p>${esc(g.name)} turned 18 and the colleges want him. Each offer comes with an NIL payment to you. Pick one${left?` within ${until(new Date(Date.now()+left).toISOString())}`:''}, or he takes the best.</p><div class="shop">${L.map((o,i)=>`<div class="item"><b>${esc(o.college)}</b><span>NIL deal</span><span class="tag hot">${fmt$(o.nil)}</span><button class="btn sm${i===0?' primary':''}" data-act="commit" data-v="${i}" ${ui.busy?'disabled':''}>Commit to ${esc(o.college)}</button></div>`).join('')}</div>${flash()}</section>`;}
// The coach board on the range: pick who coaches this golfer's sessions, or work alone.
function coachBoard(g){const cur=g.coach_id&&D.coaches.find(x=>x.id===g.coach_id),L=S().lessons_per_day;
  const list=D.coaches.slice().sort((a,b)=>(b.cr.o?coOvrC(b.cr.o):0)-(a.cr.o?coOvrC(a.cr.o):0));
  const bars=o=>`<div class="cbars">${[['s','Short'],['m','Irons'],['l','Long'],['x','Head']].map(([u,l])=>`<span>${l}</span><span class="track"><i style="width:${o[u]||0}%;background:${barC(o[u]||0)}"></i></span><b>${o[u]??'\u2013'}</b>`).join('')}</div>`;
  const fee=c=>c.manager_id===D.user.id?'Free (yours)':fmt$(c.cr.price)+' a lesson';
  const card=c=>{const on=c.id===g.coach_id,full=c.cr.left<=0&&!on,o=c.cr.o||{};return `<div class="ccard${on?' on':''}${full?' full':''}"><div class="chead"><b>${flagHTML(c.country)}${esc(c.name)}</b><span class="muted small">${esc(c.stable||'')}</span></div>${bars(o)}<div class="cfoot"><span>${fee(c)}</span><span class="muted small">${c.cr.left} of ${L} left today</span>${on?'<span class="tag hot">His coach</span>':`<button class="btn sm" data-act="coachpick" data-v="${c.id}" ${full||ui.busy?'disabled':''}>${full?'Booked up':'Use him'}</button>`}</div></div>`;};
  return `<section class="sec"><h2>Coach</h2>
 ${cur?`<p>${esc(g.name)} works with <b>${esc(cur.name)}</b> (${fee(cur)}). In his best area a coach multiplies a session by up to \u00d7${S().coach_max}. If he's booked up for the day, your golfer works alone.</p>`:`<p>${esc(g.name)} is working alone. That's free; a coach makes each session count for more.</p>`}
 <details class="cpick"${cur?'':' open'}><summary>${cur?'Change coach':'Choose a coach'} (${list.filter(c=>c.cr.left>0).length} available today)</summary>
 <div class="cgrid"><div class="ccard${cur?'':' on'}"><div class="chead"><b>Work alone</b></div><p class="muted small">No lessons, no fee.</p><div class="cfoot"><span>Free</span>${cur?'<button class="btn sm" data-act="coachpick" data-v="">Work alone</button>':'<span class="tag hot">Current</span>'}</div></div>${list.map(card).join('')}</div></details></section>`;}
/* ---------- Match Play: the bracket ---------- */
// Quick-Fire and Match Play side by side: one row per level, with the next event to enter and the one playing now
function quickBoard(t){const showQ=t==='all'||t===QF,showM=t==='all'||t===MP,showT=t==='all'||t===TM;if(!showQ&&!showM&&!showT)return '';
  const L=['jr','col','p3','p2','p1','c2','c1'],kinds=[showQ&&{k:'q',is:isQ,name:'Quick-Fire'},showM&&{k:'m',is:isM,name:'Match Play'},showT&&{k:'t',is:isT,name:'Team'}].filter(Boolean);
  const nextOf=K=>{const q=D.events.filter(e=>K.is(e)&&phase(e)==='open')[0];return q?D.events.filter(e=>K.is(e)&&e.starts_at===q.starts_at):[];};
  const nowOf=K=>D.events.filter(e=>K.is(e)&&e.status!=='final'&&['live','closed'].includes(phase(e)));
  kinds.forEach(K=>{K.next=nextOf(K);K.now=nowOf(K);});if(!kinds.some(K=>K.next.length||K.now.length))return '';
  const lvs=L.filter(lv=>kinds.some(K=>K.next.concat(K.now).some(e=>e.tour.slice(3)===lv)));
  const short=lv=>lvName(lv).replace(/ Tour$/,'');
  const cell=(K,lv)=>{const nx=K.next.find(e=>e.tour.slice(3)===lv),lv2=K.now.filter(e=>e.tour.slice(3)===lv).pop();
    let h='',tail='';if(nx){const can=mine().filter(g=>canPlay(nx,g)),inn=can.filter(g=>{const x=entryOf(nx,g);return x&&x.status==='in';}).length;
      h+=`<button class="btn xs${can.length&&!inn?' primary':''}${inn?' on':''}" data-act="board" data-v="${nx.id}" title="${esc(lvName(lv))} ${K.name}, ${when(nx.starts_at)}">${inn?(K.k==='t'?`Teams: ${Math.ceil(inn/(S().tm_size||2))}`:`In: ${inn}`):can.length?'Enter':'Field'}</button>`;const oth=(D.qIn||{})[nx.id];if(oth&&oth.n)tail=K.k==='t'?`<small class="qin">${oth.t} other team${oth.t>1?'s':''}</small>`:`<small class="qin" title="${oth.n} golfer${oth.n>1?'s':''} from ${oth.m.size} other roster${oth.m.size>1?'s':''}">${oth.n} other${oth.n>1?'s':''} in</small>`;}
    if(lv2){const mineN=mine().filter(g=>{const x=entryOf(lv2,g);return x&&x.status==='in';}).length;
      h+=`<button class="btn xs qlive${mineN?' mine':''}" data-act="board" data-v="${lv2.id}" title="Playing now"><i></i>${phase(lv2)==='closed'?'Soon':'Live'}</button>`;}
    return `<td>${h||'<span class="muted">–</span>'}${tail}</td>`;};
  const head=K=>`<th>${K.name}</th>`,nx0=kinds.map(K=>K.next[0]).filter(Boolean).sort((a,b)=>a.starts_at<b.starts_at?-1:1)[0];
  return `<section class="sec qfban qboard"><div class="qhead"><h2>Quick events</h2><p class="eyebrow">Every ${S().qf_every_min} minutes, all day</p></div>
 ${nx0?`<p class="small qnext">Next round tees off at <b>${when(nx0.starts_at).replace(' ET','')}</b>; entries close in ${until(new Date(deadline(nx0)).toISOString())}.</p>`:''}
 <div class="scroll"><table class="qtbl"><thead><tr><th>Level</th>${kinds.map(head).join('')}</tr></thead><tbody>
 ${lvs.map(lv=>`<tr><th scope="row">${esc(short(lv))}</th>${kinds.map(K=>cell(K,lv)).join('')}</tr>`).join('')}
 </tbody></table></div>
 <p class="muted small">Enter takes you to the next one at that level; Live opens the one being played now (gold when one of yours is in it). "Others in" counts golfers other managers have entered; under Team, it's other managers' teams.</p>
 <details class="qhow"><summary>How they work</summary>
 ${showQ?`<p><b>Quick-Fire Open.</b> Two rounds, no cut, about ${Math.round(2*S().round_min)} minutes. ${fmt$(S().qf_fee)} to enter; each level's pot is scaled like the main tours (${fmt$(qfBase('col'))} for college) and grows ${fmt$(S().qf_add)} with every entry. The top third of the field get paid. ${fmt$(S().qf_bonus)} each for most greens hit, most up and downs (on the green from 40 yards or closer, then one putt) and the long drive, and ${fmt$(S().qf_ace)} for a hole in one. Only managers’ golfers can win the bonuses. It doesn't tire your golfers.</p>`:''}
 ${showM?`<p><b>Match Play.</b> Head to head, nine holes a match, knockout until one golfer is left; a tie after nine goes to sudden death, and the beaten semifinalists play for third. Only managers' golfers play, and it only goes ahead if at least two rosters enter. Entry runs from ${fmt$(S().mp_fee_jr)} for juniors up to ${fmt$(S().mp_fee_p1)} on the Premier Tour. The pot is the entry fees, and most of it goes to the deep runs.</p>`:''}
 ${showT?`<p><b>Team Match Play.</b> Pairs: ${S().tm_size===2?'two':S().tm_size} of your golfers from one level play as a team, best ball: on each hole the team's lowest score counts. Nine holes a match, knockout between teams, computer regulars filling empty places. One fee per team, from ${fmt$(S().tm_fee_jr)} for juniors up to ${fmt$(S().tm_fee_p1)} on the Premier Tour. Enter as many teams as you like. If only your teams enter, each plays one match against a computer team and the house matches the fee: win and you double it.</p>`:''}
 </details></section>`;}
// The prize plan for a bracket of n golfers: who gets what share of the pot.
const MPC=['#f2c230','#5b8cff']; // top golfer gold, bottom golfer blue: tracers, balls, scorecard and bracket dots
function mpPlan(n){n=Math.max(2,n);let R=0;while((1<<R)<n)R++;
  const L=[{place:'1st',how:'Wins the final',sh:.4,c:1},{place:'2nd',how:'Loses the final',sh:.2,c:1}];
  if(R>=2){if(n>=4)L.push({place:'3rd',how:'Wins the third-place match',sh:.12,c:1},{place:'4th',how:'Loses the third-place match',sh:.08,c:1});else L.push({place:'3rd',how:'Loses in the semifinals',sh:.1,c:1});}
  if(R>=3){const q=R===3?n-4:4;if(q>0)L.push({place:q>1?`5th–${4+q}th`:'5th',how:`Loses in the quarterfinals${q>1?' (each)':''}`,sh:.05,c:q});}
  const tot=L.reduce((a,x)=>a+x.sh*x.c,0);L.forEach(x=>x.pct=x.sh/tot);return {L,paid:L.reduce((a,x)=>a+x.c,0),n};}
function mpPlanTable(n,pot){const {L,paid}=mpPlan(n);
  return `<div class="scroll"><table class="tbl mppay"><thead><tr><th>Place</th><th>How</th><th class="num">Prize</th></tr></thead><tbody>${L.map(x=>`<tr><td><b>${x.place}</b></td><td>${x.how}</td><td class="num"><b>${fmt$(Math.round(pot*x.pct))}</b>${x.c>1?'<small> each</small>':''}<small class="pct">${Math.round(x.pct*1000)/10}% of the pot</small></td></tr>`).join('')}${n>paid?`<tr class="nopay"><td>${paid+1}th–${n}th</td><td>Out before the quarterfinals</td><td class="num">$0</td></tr>`:''}</tbody></table></div>`;}
function mpPayHTML(e){const n=ui.preview&&ui.preview.eid===e.id?ui.preview.rows.length:0,base=e.purse||0;
  const k=ui.mpIf&&ui.mpIf.eid===e.id?ui.mpIf.n:Math.max(2,n),pot=base+e.fee*k;
  const opts=[...new Set([Math.max(2,n),4,8,16,32])].filter(x=>x>=Math.max(2,n)).sort((a,c)=>a-c);
  return `<section class="sec paysec"><h2>Prize money</h2>
 <p class="small"><b>Pot ${fmt$(base+e.fee*n)} right now</b>: ${base?`${fmt$(base)} guaranteed plus `:''}${fmt$(e.fee)} for each of the ${n} entr${n===1?'y':'ies'}. Every new entry adds ${fmt$(e.fee)}.</p>
 <div class="ctrl mpif"><span class="muted small">Prizes if this many play:</span>${opts.map(x=>`<button class="btn sm${x===k?' on':''}" data-act="mpIf" data-v="${e.id}|${x}">${x===Math.max(2,n)&&x===n?`${x} (now)`:x}</button>`).join('')}</div>
 ${mpPlanTable(k,pot)}
 <p class="muted small">Pot for ${k} golfers: ${fmt$(pot)}. The two beaten semifinalists play a third-place match alongside the final. Golfers from the same roster are kept apart in round one where the numbers allow. If only one roster enters, it's called off and fees are refunded.</p></section>`;}
async function loadMp(){if(!ui.ev)return;const k=ui.mpw,have=k&&ui.mps&&ui.mps.key===k?ui.mps.s.length:0;
  try{const r=await call('mpBoard',{event:ui.ev,watch:k||undefined,from:have});ui.mpb=r.board;
    const sh=r.board&&r.board.shots;if(sh&&sh.key===ui.mpw){if(!ui.mps||ui.mps.key!==sh.key)ui.mps={key:sh.key,s:[]};if(sh.from===ui.mps.s.length)ui.mps.s.push(...sh.s);}
  }catch(e){ui.mpb={err:e.message};}}
// one match out of the board by its key: "round:index", or "round:t" for the third-place match
function mpGet(b,key){if(!b||!key)return null;const [r,i]=key.split(':'),R=b.rounds&&b.rounds[+r];if(!R)return null;return i==='t'?R.third||null:R.m[+i]||null;}
const mpDiff=(h,n)=>{let d=0;h.slice(0,n).forEach(([s1,s2])=>{if(s1<s2)d++;else if(s2<s1)d--;});return d;};
const lastName=n=>String(n||'').split(' ').slice(-1)[0];
function mpStatus(P,a,b,d,n){return d===0?`All square${n?` thru ${n}`:''}`:`${esc(lastName(P[d>0?a:b].name))} ${Math.abs(d)} up thru ${n}`;}
// names in a bracket: a golfer, or a team (its roster's name, with its golfers listed small)
const pShort=p=>p?(p.team?p.name:lastName(p.name)):'';
const pFlag=p=>p&&!p.team?flagHTML(p.country):'';
const pMembers=(p,num)=>p&&p.team?`<small class="sch">${p.members.map((m,j)=>(num?`${j+1} `:'')+esc(lastName(m.name))+(m.bot?'*':'')).join(', ')}</small>`:'';
// Team Match Play before entries close: your team (up to tm_size golfers, one fee), the teams entered and the prize money
// teams entered so far: each manager's golfers make teams of tm_size in entry order
function tmTeams(e){const P=ui.preview&&ui.preview.eid===e.id?ui.preview.rows:[],TS=S().tm_size||2,c=new Map();P.forEach(r=>{const k=r.g.manager_id||r.g.stable;c.set(k,(c.get(k)||0)+1);});
  let teams=0;c.forEach(n=>teams+=Math.ceil(n/TS));return {teams,managers:c.size};}
function tmOpenHTML(e){const TS=S().tm_size||2,gs=mine().filter(g=>canPlay(e,g)),fee=e.test?0:e.fee;
  // your golfers in entry order, cut into teams
  const ins=D.entries.filter(x=>x.event_id===e.id&&x.status==='in').sort((a,b)=>String(a.created_at)<String(b.created_at)?-1:1).map(x=>gs.find(g=>g.id===x.golfer_id)).filter(Boolean);
  const teams=[];ins.forEach((g,i)=>{(teams[Math.floor(i/TS)]=teams[Math.floor(i/TS)]||[]).push(g);});
  const rest=gs.filter(g=>!ins.includes(g)),open=ins.length%TS,newTeam=!open,k=Math.min(rest.length,newTeam?TS:TS-open),cant=newTeam&&D.me.cash<fee;
  const T0=tmTeams(e),word=TS===2?'two':TS;
  const item=(g,inn)=>`<div class="item"><b>${esc(g.name)}${ageTag(g.yr,g.tour)}</b><span>Overall ${Math.round(ovr(g.sk))}.</span>${inn?`<button class="btn sm" data-act="withdraw" data-v="${e.id}" data-g="${g.id}" ${ui.busy?'disabled':''}>Take out</button>`:`<button class="btn sm" data-act="enter" data-v="${e.id}" data-g="${g.id}" ${ui.busy||cant?'disabled':''}>${newTeam?`New team${fee?` (${fmt$(fee)})`:''}`:`Add to team ${teams.length}`}</button>`}</div>`;
  return `<section class="sec"><h2>Entries close in ${until(new Date(deadline(e)).toISOString())}</h2>
 <p>Teams of ${word} of your golfers from this level, ${fee?`${fmt$(fee)} per team, paid when its first golfer goes in`:'no entry fee'}. Enter as many teams as you like: your golfers pair up in the order you add them. A team still a golfer short is made up by a computer regular from the tour.</p>
 ${!gs.length?'<p class="muted">None of your golfers play at this level.</p>':`
 ${k?`<div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin-bottom:8px"><button class="btn primary sm" data-act="enterAll" data-v="${e.id}" ${ui.busy||cant?'disabled':''}>${newTeam?`${teams.length?'Enter another team':'Enter a team'}: my best ${k===1?'golfer':k}${fee?` for ${fmt$(fee)}`:''}`:`Finish team ${teams.length}: add my best ${k===1?'golfer':k}`}</button>${cant?'<span class="muted small">Not enough money for another team fee.</span>':''}</div>`:''}
 ${teams.length?teams.map((t,i)=>`<h3>Team ${i+1}${t.length<TS?` <span class="muted small">(${TS-t.length} short: a computer regular fills in unless you add one)</span>`:''}</h3><div class="shop">${t.map(g=>item(g,true)).join('')}</div>`).join(''):'<p class="muted small">No teams entered yet.</p>'}
 ${rest.length?`<h3>Not entered</h3><div class="shop">${rest.map(g=>item(g,false)).join('')}</div>`:''}
 ${teams.length?`<p class="muted small">Taking a golfer out re-pairs the rest in the order they went in; a whole team's fee comes back when you end up with one team fewer.</p>`:''}`}
 ${flash()}</section>
 <div class="fieldpay">${previewHTML(e)}<section class="sec paysec"><h2>Prize money</h2>${tmPayHTML(e,T0)}</section></div>`;}
function tmPayHTML(e,T0){const fee=e.fee,n=T0.teams;
  const solo=`<p><b>If only your teams enter:</b> each plays one nine-hole match against a team of computer regulars. The house matches the fee, so every team that wins takes ${fmt$(2*fee)}; a loss pays nothing.</p>`;
  if(T0.managers<2)return `${solo}<p class="muted small">${n?`${n} team${n>1?'s':''} entered so far, all from one roster.`:'No teams entered yet.'} Once another manager's team enters, it becomes a knockout between all the teams for the entry fees, with most of the money going to the deep runs (teams from the same roster are kept apart in round one where possible).</p>`;
  return `<p><b>Pot ${fmt$(fee*n)} right now</b>: ${n} teams at ${fmt$(fee)}. Every new team adds ${fmt$(fee)}.</p>${mpPlanTable(n,fee*n)}<p class="muted small">With ${n} teams it's a knockout; the two beaten semifinalists play for third.</p>`;}
function mpView(e){const b=ui.mpb&&ui.mpb.event&&ui.mpb.event.id===e.id?ui.mpb:null;if(!b){loadMp().then(()=>{if(ui.view==='board')render();});return '<section class="sec"><p class="muted">Loading the bracket…</p></section>';}
  if(b.err)return `<section class="sec"><p class="muted">${esc(b.err)}</p></section>`;
  if(!(b.rounds||[]).length)return `<section class="teebox"><p class="eyebrow">Entries are closed</p><h2>Drawing the bracket</h2><div class="teeclock" id="teeClock" data-at="${e.starts_at}">${clockTxt(e.starts_at)}</div></section>`;
  if(!ui.mpw&&!ui.mpwAuto){ui.mpwAuto=1;const k=mpMineLive(b);if(k){ui.mpw=k;setTimeout(()=>loadMp().then(mpPoll),50);}}
  return `<div id="mpTop" data-fin="${b.event.status==='final'?1:0}">${mpTopHTML(b,e)}</div>${mpWatchHTML(b,e)}<div id="mpBracket">${mpBracketHTML(b,e)}</div>`;}
// a live match with one of your golfers in it, to open on arrival
function mpMineLive(b){const P=b.players||{};for(let r=b.rounds.length-1;r>=0;r--){const R=b.rounds[r],all=R.m.map((x,i)=>[x,`${r}:${i}`]).concat(R.third?[[R.third,`${r}:t`]]:[]);
  for(const [x,k] of all)if(x.a&&x.b&&!x.over&&((P[x.a]||{}).mine||(P[x.b]||{}).mine))return k;}return null;}
// holes in one so far in a Match Play bracket (only holes already played)
function mpAces(b){const P=b.players||{},out=[];(b.rounds||[]).forEach((Rd,r)=>Rd.m.map((x,i)=>[x,i]).concat(Rd.third?[[Rd.third,'t']]:[]).forEach(([x,i])=>(x.h||[]).forEach((hs,h)=>[0,1].forEach(sd=>{const id=sd?x.b:x.a;if(hs[sd]===1&&P[id])out.push({p:{...P[id],id,managed:true},key:`mp:${r}:${i}:${h}:${sd}`,where:`#${h+1}`});}))));return out;}
function mpTopHTML(b,e){const P=b.players||{},fin=b.event.status==='final',started=Date.now()>=Date.parse(b.event.starts_at);
  if(!started&&!fin)return `<section class="teebox"><p class="eyebrow">The bracket is drawn</p><h2>Tees off in</h2><div class="teeclock" id="teeClock" data-at="${e.starts_at}">${clockTxt(e.starts_at)}</div><p class="muted">${Object.keys(P).length} ${b.team?'teams':'golfers'}. Pot ${fmt$(b.event.purse)}.${b.vsBot?' Against a computer team the house matches the fee: winner takes the pot.':''}</p></section>`;
  const ace=aceWatchHTML(mpAces(b),S().ace_bonus);
  if(fin)return mpResultsHTML(b,e)+ace;
  return ace+(b.vsBot?`<section class="sec"><p><b>Pot ${fmt$(b.event.purse)}</b>: your fees plus the house's match. Every team that beats its computer team takes double its fee.</p></section>`:`<details class="sec mppaybox"><summary>Prize money: pot ${fmt$(b.event.purse)}, ${Object.keys(P).length} ${b.team?'teams':'golfers'}</summary>${mpPlanTable(Object.keys(P).length,b.event.purse)}</details>`);}
// against computer teams: each of your teams' own match, and what it won
function tmBotResultsHTML(b){const P=b.players||{},ms=(b.rounds[0]||{m:[]}).m,pay=b.pay||{},won=ms.filter(x=>pay[x.a]).length,tot=Object.values(pay).reduce((a,v)=>a+v,0);
  return `<section class="podium-wrap"><p class="eyebrow">Final \u00b7 against computer teams</p><h2 class="champ">${won?`${won} of ${ms.length} won: ${fmt$(tot)}`:`${ms.length>1?'All':'Your team'} beaten this time`}</h2>
 <div class="scroll"><table class="tbl mpres"><thead><tr><th>Team</th><th>Result</th><th class="num">Prize</th></tr></thead><tbody>
 ${ms.map(x=>`<tr class="${P[x.a]&&P[x.a].mine?'me':''}${pay[x.a]?'':' nopay'}"><td>${esc(P[x.a].name)}${pMembers(P[x.a])}</td><td>${x.w===0?'Beat':'Lost to'} the ${esc(P[x.b].name)}, ${esc(x.res||'')}</td><td class="num"><b>${fmt$(pay[x.a]||0)}</b></td></tr>`).join('')}
 </tbody></table></div></section>`;}
function mpResultsHTML(b,e){if(b.vsBot)return tmBotResultsHTML(b);const P=b.players||{},ids=Object.keys(P),tl=e.tour.slice(3)==='col'?'col0':e.tour.slice(3);
  let pl=b.places;if(!pl){pl=Object.keys(b.pay||{}).sort((x,y)=>b.pay[y]-b.pay[x]).map((id,i)=>({id,place:id===b.champ?'1st':i===1?'2nd':'T3',amt:b.pay[id]}));}
  if(!pl.length)return '<section class="sec"><p class="muted">Final. Working out the prize money\u2026</p></section>';
  const paid=new Set(pl.map(x=>x.id)),R=b.rounds;
  const outIn=id=>{for(let r=0;r<R.length;r++){if(R[r].m.some(x=>x.b!==null&&x.a&&x.b&&(x.w?x.a:x.b)===id))return r;}return -1;};
  const rest=ids.filter(id=>!paid.has(id)).map(id=>({id,r:outIn(id)})).sort((x,y)=>y.r-x.r);
  const rn=r=>{const k=R[r].m.length;return k===1?'the final':k===2?'the semifinals':k===4?'the quarterfinals':`round ${r+1}`;};
  const fm=R[R.length-1].m[0],fin=fm&&fm.res?`beat ${esc(P[fm.w?fm.a:fm.b].name)} ${esc(fm.res)}${b.vsBot?'':' in the final'}`:'';
  const c=pl[0],cp=P[c.id];
  const who=id=>P[id].team?`${esc(P[id].name)}${pMembers(P[id])}`:`${flagHTML(P[id].country)}${esc(P[id].name)}${ageTag(P[id].yr,tl)}<small class="sch">${esc(P[id].stable||'')}</small>`;
  const step=(x,k)=>x?`<div class="pod p${k}"><div class="pname">${pFlag(P[x.id])}${esc(P[x.id].name)}</div><div class="psub">${P[x.id].team?(P[x.id].mid?'Team':'Computer team'):esc(P[x.id].stable||'')}</div><div class="pblock"><b>${x.place}</b><span>${fmt$(x.amt)}</span></div></div>`:'';
  const mineWon=pl.filter(x=>P[x.id].mine).reduce((a,x)=>a+x.amt,0),mineN=ids.filter(id=>P[id].mine).length;
  return `<section class="podium-wrap"><p class="eyebrow">Final · pot ${fmt$(b.event.purse)}</p><h2 class="champ">${pFlag(cp)}${esc(cp.name)} ${c.amt?`wins ${fmt$(c.amt)}`:'win'}</h2>
 <p class="lede">${cp.team?`${cp.members.map(m=>esc(m.name)).join(', ')} ${fin}.`:`${esc(cp.stable||'')}'s golfer ${fin}.`}</p>
 <div class="podium">${step(pl[1],2)}${step(pl[0],1)}${step(pl[2],3)}</div>
 ${mineN?`<p class="mpyou">${mineWon?`${b.team?'Your team':'Your golfers'} won <b>${fmt$(mineWon)}</b>${b.team?'':' between them'}.`:b.team?'Your team didn\u2019t win any money this time.':'None of your golfers reached the paying places this time.'}</p>`:''}
 <h3>Results and prize money</h3>
 <div class="scroll"><table class="tbl mpres"><thead><tr><th>Place</th><th>${b.team?'Team':'Golfer'}</th><th class="num">Prize</th></tr></thead><tbody>
 ${pl.map(x=>`<tr class="${P[x.id].mine?'me':''}"><td><b>${x.place}</b></td><td>${who(x.id)}</td><td class="num"><b>${fmt$(x.amt)}</b></td></tr>`).join('')}
 ${rest.map(x=>`<tr class="nopay${P[x.id].mine?' me':''}"><td>Out</td><td>${who(x.id)}<small class="sch">Lost in ${x.r>=0?rn(x.r):'the first round'}</small></td><td class="num">$0</td></tr>`).join('')}
 </tbody></table></div></section>`;}
function mpBracketHTML(b,e){const P=b.players||{},R=b.rounds||[],tl=e.tour.slice(3)==='col'?'col0':e.tour.slice(3);
  const nm=id=>{const p=P[id];return p?(p.team?esc(p.name):`${flagHTML(p.country)}${esc(p.name)}${ageTag(p.yr,tl)}`):'';};
  const st=id=>P[id]?(P[id].team?pMembers(P[id]):`<small class="sch">${esc(P[id].stable||'')}</small>`):'';
  const rname=r=>{const k=R[r].m.length;return b.vsBot?(k>1?'Against computer teams':'Against a computer team'):k===1?'Final':k===2?'Semifinals':k===4?'Quarterfinals':`Round ${r+1}`;};
  const match=(x,r,key,label)=>{
    if(!x.a)return `<div class="mcard wait">${label?`<p class="mlab">${label}</p>`:''}<p class="muted small">Waiting for the round before to finish.</p></div>`;
    if(x.b===null)return `<div class="mcard"><div class="mrow win${P[x.a]&&P[x.a].mine?' me':''}"><span>${nm(x.a)}${st(x.a)}</span><b>Bye</b></div></div>`;
    const n=x.h.length,d=mpDiff(x.h,n),at=Date.parse(b.event.starts_at)+R[r].start*1000;
    const status=x.over?`${esc(P[x.w?x.b:x.a].name)} wins ${esc(x.res)}`:!n?(Date.now()<at?`Tees off in ${until(new Date(at).toISOString())}`:'On the first tee'):n>=9&&d===0?`All square after ${n}: sudden death`:mpStatus(P,x.a,x.b,d,n);
    const dots=x.h.map(([s1,s2],i)=>`<i class="${s1<s2?'a':s2<s1?'b':'h'}" title="Hole ${i+1}: ${s1}-${s2}"></i>`).join('');
    const row=(id,side)=>`<div class="mrow${x.over&&((side===0)===(x.w===0))?' win':''}${P[id]&&P[id].mine?' me':''}"><span><i class="sw s${side}"></i>${nm(id)}${st(id)}</span><b>${x.h.filter(([s1,s2])=>side===0?s1<s2:s2<s1).length}</b></div>`;
    const on=ui.mpw===key,canW=Date.now()>=at||n;
    return `<div class="mcard${x.over?' done':n?' live':''}${on?' watching':''}">${label?`<p class="mlab">${label}</p>`:''}${row(x.a,0)}${row(x.b,1)}<div class="mdots">${dots}</div><div class="mfoot"><p class="mstat">${status}</p>${canW?`<button class="btn xs${on?' on':''}" data-act="mpWatch" data-v="${key}">${on?'Watching':x.over?'Replay':'Watch'}</button>`:''}</div></div>`;};
  return `${R.map((Rd,r)=>`<section class="sec mround"><h2>${Rd.third?'Final and third place':rname(r)}</h2><div class="mgrid">${Rd.m.map((x,i)=>match(x,r,`${r}:${i}`,Rd.third?'Final':'')).join('')}${Rd.third?match(Rd.third,r,`${r}:t`,'Third-place match'):''}</div></section>`).join('')}
<p class="muted small">${b.team?'* marks a computer golfer filling a place in a team. ':''}Each dot is a hole: gold for the top ${b.team?'team':'golfer'}, blue for the bottom one, grey for a half. Holes appear as they're played, about one every ${Math.round(b.T)} seconds. Tap Watch to follow a match shot by shot.</p>`;}

/* ---------- Match Play: watching one match on the hole map ---------- */
function mpWatchHTML(b,e){const k=ui.mpw,x=mpGet(b,k);if(!x||!x.a||!x.b)return '';const P=b.players||{},M=ui.ma&&ui.ma.key===k?ui.ma:{};
  const chip=(id,side)=>`<div class="mpchip s${side}"><i class="sw s${side}"></i><span>${pFlag(P[id])}<b>${esc(P[id].name)}</b>${P[id].team?pMembers(P[id],1):`<small>${esc(P[id].stable||'')}</small>`}</span></div>`;
  const [kr,ki]=k.split(':'),nR=b.rounds[+kr].m.length,lab=ki==='t'?'Third-place match':nR===1?'The final':nR===2?'Semifinal':nR===4?'Quarterfinal':`Round ${+kr+1}`;
  return `<section class="round mpwatch" id="mpWatchBox" data-k="${k}"><div>
  <p class="eyebrow mpeye">Watching \u00b7 ${lab}</p>
  <div class="holebar"><span><b id="mHole">Hole 1</b></span><span id="mMeta"></span><span class="wind"><i id="windArrow">↑</i><span id="windTxt">${b.wind?Math.round(b.wind.mph)+' mph':''}</span></span></div>
  <canvas id="mcv" aria-label="Top-down map of the hole with both golfers' shots"></canvas>
  <div class="ctrl"><button class="btn sm" data-act="mPause" id="mPauseBtn">${M.paused?'Play':'Pause'}</button>${[1,2,4].map(s=>`<button class="btn sm${(M.speed||1)===s?' on':''}" data-act="mSpeed" data-v="${s}">${s}×</button>`).join('')}<span class="sp"></span><button class="btn sm${M.live!==false?' on':''}" data-act="mLive">Live</button><button class="btn sm" data-act="mStop">Close</button></div>
 </div><div>
  <div class="mpvs">${chip(x.a,0)}<div class="mpst" id="mStat"></div>${chip(x.b,1)}</div>
  <div class="feed" id="mFeed" aria-live="polite"></div>
  <div id="mCard"></div>
  <p class="muted small">Gold is ${esc(P[x.a].name)}, blue is ${esc(P[x.b].name)}. ${b.team?'Everyone plays every hole and each team counts its best score; whoever is farthest from the hole plays first.':'The golfer farther from the hole plays first.'} Tap a hole on the card to replay it.</p>
 </div></section>`;}
// the order the shots are played on one hole: tee shots by honour, then whoever is farther from the flag
// (each ball is one golfer: two in Match Play, four in Team Match Play)
function mpOrder(balls,h,honor){const idx=balls.map(()=>0),out=[],pos=balls.map(B=>(B.shots[0]||{from:[0,0]}).from),n=balls.length;
  const tee=[...balls.keys()].filter(i=>balls[i].side===honor).concat([...balls.keys()].filter(i=>balls[i].side!==honor));
  while(idx.some((k,i)=>k<balls[i].shots.length)){let p=tee.find(i=>idx[i]===0&&balls[i].shots.length);
    if(p===undefined){let best=-1;for(let i=0;i<n;i++)if(idx[i]<balls[i].shots.length){const d=dist(pos[i],h.pin);if(best<0||d>dist(pos[best],h.pin))best=i;}p=best;}
    do{const sh=balls[p].shots[idx[p]++];out.push({p,side:balls[p].side,sh});pos[p]=sh.to;if(!(sh.k==='drop'||sh.k==='pick'))break;}while(idx[p]<balls[p].shots.length);}
  return out;}
// the pause after each shot, long enough to read it; longer in Team Match Play, where four golfers share the hole
const mWait=sh=>(ui.mpb&&ui.mpb.team?1.6:1)*(sh.holed?1000:750);
function mpBegin(i,first){const M=ui.ma,b=ui.mpb,e=b.event,x=mpGet(b,M.key),sh=ui.mps&&ui.mps.key===M.key?ui.mps.s[i]:null;if(!x||!sh)return;
  const hole=COURSES[e.ci].holes[i%18],prev=i?x.h[i-1]:null,P=b.players;
  let honor=0;for(let j=i-1;j>=0;j--){const [p,q]=x.h[j];if(p!==q){honor=p<q?0:1;break;}}
  const balls=b.team?[0,1].flatMap(k=>(sh[k]||[]).map((shots,m)=>({side:k,mem:m,shots:shots||[]}))):[0,1].map(k=>({side:k,shots:sh[k]||[]}));
  M.balls=balls;M.i=i;M.h=hole;M.seq=mpOrder(balls,hole,honor);M.si=0;M.t=0;M.w=0;M.cam=null;M.trail=balls.map(()=>[]);M.holed=balls.map(()=>false);
  M.pos=balls.map(B=>(B.shots[0]||{from:[0,0]}).from);M.phase=M.seq.length?'shot':'post';
  const tot=M.seq.reduce((a,q)=>a+shotDur(q.sh)+mWait(q.sh),0)+1700;M.fit=Math.max(b.team?0.8:1,tot/(0.85*(b.T||16)*1000));
  if(first){M.shown=i-1;M.feed=[];}
  mFeed(`Hole ${i+1}${i>=9?' (sudden death)':''}. Par ${hole.par}, ${hole.len} yards. ${esc(pShort(P[honor?x.b:x.a]))} ${b.team?'have':'has'} the honour.`,'big');mHUD();mSide();}
function mFeed(text,cls,side){const M=ui.ma;M.feed.push({text,cls:cls||'',side});if(M.feed.length>7)M.feed.shift();mPaintFeed();}
function mPaintFeed(){const M=ui.ma,el=document.getElementById('mFeed');
  if(M&&el)el.innerHTML=M.feed.map((q,i)=>`<p class="${q.cls}${q.side!==undefined?' s'+q.side:''}${i===M.feed.length-1?' now':''}">${q.side!==undefined?`<i class="sw s${q.side}"></i>`:''}${q.text}</p>`).join('');}
function mHUD(){const M=ui.ma;if(!M||!M.h)return;const t=document.getElementById('mHole');if(!t)return;t.textContent=`Hole ${M.i+1}`;document.getElementById('mMeta').textContent=`Par ${M.h.par}, ${M.h.len} yards`;
  const w=ui.mpb&&ui.mpb.wind,wa=document.getElementById('windArrow');if(w&&wa)wa.style.transform=`rotate(${w.dir}rad)`;}
function mEndHole(){const M=ui.ma,b=ui.mpb,x=mpGet(b,M.key),P=b.players;if(!x)return;const [s1,s2]=x.h[M.i]||[];
  if(s1!==undefined){const A=esc(pShort(P[x.a])),B=esc(pShort(P[x.b])),d=mpDiff(x.h,M.i+1),n=M.i+1;
    const won=s1<s2?0:s2<s1?1:-1;
    mFeed(won<0?`Halved in ${s1}s. ${d===0?`All square thru ${n}`:`${d>0?A:B} ${Math.abs(d)} up thru ${n}`}.`:`${won?B:A} wins the hole, ${Math.min(s1,s2)} to ${Math.max(s1,s2)}. ${d===0?`All square thru ${n}`:`${d>0?A:B} ${Math.abs(d)} up thru ${n}`}.`,'big',won<0?undefined:won);
    if(x.over&&M.i===x.h.length-1)mFeed(`${esc(P[x.w?x.b:x.a].name)} wins the match ${esc(x.res)}.`,'big win',x.w);}
  M.phase='post';M.w=0;M.shown=Math.max(M.shown??-1,M.i);mSide();}
function mCardHTML(){const M=ui.ma,b=ui.mpb,x=mpGet(b,M.key),P=b.players,e=b.event;if(!x)return '';
  const holes=COURSES[e.ci].holes,n=Math.max(9,x.h.length),vis=M.live?(M.shown??-1)+1:x.h.length,cols=[...Array(n).keys()];
  const cell=(i,side)=>{if(i>=vis||!x.h[i])return '<td></td>';const [s1,s2]=x.h[i],s=side?s2:s1,o=side?s1:s2,d=s-holes[i%18].par,on=M.i===i;
    return `<td class="${d<=-2?'eg':d===-1?'bd':d===1?'bg':d>=2?'db':''}${s<o?' won s'+side:''}" data-act="mHole" data-v="${i}" style="cursor:pointer${on?';outline:2px solid var(--flag)':''}"><s>${s}</s></td>`;};
  // a team's golfers under its best-ball line, the counting score marked
  const mem=(id,side)=>P[id]&&P[id].team&&x.ms?P[id].members.map((m,j)=>`<tr class="mmem"><td>${j+1} ${esc(lastName(m.name))}${m.bot?'*':''}</td>${cols.map(i=>{if(i>=vis||!x.ms[i])return '<td></td>';const v=x.ms[i][side][j];return `<td class="${v===x.h[i][side]?'best':''}">${v}</td>`;}).join('')}</tr>`).join(''):'';
  const stat=i=>{if(i>=vis||!x.h[i])return '<td></td>';const d=mpDiff(x.h,i+1);return d===0?'<td class="mst">AS</td>':`<td class="mst s${d>0?0:1}">${Math.abs(d)}<small>up</small></td>`;};
  return `<div class="scroll"><table class="card mpcard"><tr><th>Hole</th>${cols.map(i=>`<th>${i+1}</th>`).join('')}</tr>
  <tr><td>Par</td>${cols.map(i=>`<td>${holes[i%18].par}</td>`).join('')}</tr>
  <tr class="pa"><td><i class="sw s0"></i>${esc(pShort(P[x.a]))}</td>${cols.map(i=>cell(i,0)).join('')}</tr>${mem(x.a,0)}
  <tr class="pb"><td><i class="sw s1"></i>${esc(pShort(P[x.b]))}</td>${cols.map(i=>cell(i,1)).join('')}</tr>${mem(x.b,1)}
  <tr><td>Match</td>${cols.map(stat).join('')}</tr></table></div>`;}
function mSide(){const M=ui.ma,el=document.getElementById('mCard');if(!M||!el)return;el.innerHTML=mCardHTML();
  const b=ui.mpb,x=mpGet(b,M.key),st=document.getElementById('mStat');
  if(x&&st){const vis=M.live?(M.shown??-1)+1:x.h.length,d=mpDiff(x.h,vis),P=b.players;
    st.innerHTML=x.over&&vis>=x.h.length?`<b class="s${x.w}">${esc(pShort(P[x.w?x.b:x.a]))} win${P[x.a].team?'':'s'} ${esc(x.res)}</b>`:d===0?`<b>${vis?'All square':'All square'}</b><small>${vis?`thru ${vis}`:'first tee'}</small>`:`<b class="s${d>0?0:1}">${Math.abs(d)} up</b><small>${esc(pShort(P[d>0?x.a:x.b]))} thru ${vis}</small>`;}
  const pb=document.getElementById('mPauseBtn');if(pb)pb.textContent=M.paused?'Play':'Pause';}
// keep the animation in step with the holes the bracket has revealed so far
function mpSync(){const k=ui.mpw;if(!k||!document.getElementById('mcv')){return;}
  const b=ui.mpb,x=mpGet(b,k),S=ui.mps&&ui.mps.key===k?ui.mps.s:[];if(!x)return;const avail=Math.min(x.h.length,S.length);
  let M=ui.ma;
  if(!M||M.key!==k){M=ui.ma={key:k,speed:1,paused:false,live:true,feed:[],phase:'idle',i:-1,shown:-1};
    if(avail)mpBegin(x.over?0:avail-1,true);else{M.h=COURSES[b.event.ci].holes[0];M.i=0;mFeed(x.h.length?'Loading the shots…':'They haven’t teed off yet. Each hole plays out here as it happens.');mHUD();mSide();}}
  else if(M.live&&!M.seq&&avail)mpBegin(avail-1,true);
  else if(M.live&&M.phase==='idle'&&M.i+1<avail)mpBegin(M.i+1);
  mStart();}
// every five seconds: refresh the bracket and the results without touching the map
function mpPoll(){const e=evNow(),b=ui.mpb;if(ui.view!=='board'||!e||!b||!b.event||b.event.id!==e.id)return keepScroll(render);
  const top=document.getElementById('mpTop'),br=document.getElementById('mpBracket'),w=document.getElementById('mpWatchBox');
  const want=ui.mpw&&mpGet(b,ui.mpw)&&mpGet(b,ui.mpw).a?ui.mpw:null,wasFin=top&&top.dataset.fin==='1',isFin=b.event.status==='final';
  if(!top||!br||(w?w.dataset.k:null)!==want||wasFin!==isFin)return keepScroll(render);
  keepScroll(()=>{top.innerHTML=mpTopHTML(b,e);br.innerHTML=mpBracketHTML(b,e);});if(want)mpSync();}
let mRaf=false,mTs=0;
function mFit(){const cv=document.getElementById('mcv');if(!cv)return;const dpr=Math.min(2,window.devicePixelRatio||1),r=cv.getBoundingClientRect();cv.width=Math.max(200,Math.round(r.width*dpr));cv.height=Math.max(250,Math.round(r.height*dpr));if(ui.ma)ui.ma.cam=null;}
function mStart(){if(!mRaf){mFit();mRaf=true;mTs=performance.now();requestAnimationFrame(mFrame);}}
function mFrame(ts){const M=ui.ma,cv=document.getElementById('mcv');if(ui.view!=='board'||!ui.mpw||!M||!cv){mRaf=false;return;}
  const b=ui.mpb,x=mpGet(b,M.key),avail=x?Math.min(x.h.length,(ui.mps&&ui.mps.key===M.key?ui.mps.s.length:0)):0,behind=M.live&&x&&!x.over&&avail-1>M.i+1;
  const dt=M.paused?0:Math.min(60,ts-mTs)*(M.speed||1)*(M.live?(M.fit||1)*(behind?2:1):1);mTs=ts;
  if(M.seq&&M.seq.length){const q=M.seq[M.si];
    if(M.phase==='shot'){M.t+=dt/shotDur(q.sh);if(M.t>=1){M.t=1;const Bq=M.balls[q.p],tp=b.team&&b.players[Bq.side?x.b:x.a];const hs=q.sh.holed&&x?(b.team?(x.ms&&x.ms[M.i]?x.ms[M.i][q.side][Bq.mem]:undefined):(x.h[M.i]||[])[q.side]):undefined;
      mFeed(`${tp?`<b>${Bq.mem+1} ${esc(lastName(tp.members[Bq.mem].name))}:</b> `:''}${esc(q.sh.holed?holedFor(q.sh.text,hs,M.h.par):q.sh.text)}`,'',q.side);if(q.sh.k!=='drop'&&q.sh.k!=='pick')M.trail[q.p].push(q.sh);M.pos[q.p]=q.sh.to;if(q.sh.holed)M.holed[q.p]=true;M.phase='wait';M.w=0;}}
    else if(M.phase==='wait'){M.w+=dt;if(M.w>mWait(q.sh)){M.si++;if(M.si>=M.seq.length){M.si=M.seq.length-1;mEndHole();}else{M.phase='shot';M.t=0;}}}
    else if(M.phase==='post'){M.w+=dt;if(M.w>1700){M.phase='idle';if(M.live)mpSync();}}}
  else if(M.phase==='post'){M.w+=dt;if(M.w>1700){M.phase='idle';if(M.live)mpSync();}}
  mDraw(dt);if(M.panel){const q=M.panel;drawShotPanels(cv.getContext('2d'),cv.width,cv.height,q.u,q.sh,q.P,q.live,q.col);}requestAnimationFrame(mFrame);}
function mDraw(dt){const M=ui.ma,cv=document.getElementById('mcv');if(!cv||!M.h)return;const c=cv.getContext('2d'),W=cv.width,H=cv.height,h=M.h;
  const q=M.seq&&M.seq.length?M.seq[Math.min(M.si,M.seq.length-1)]:null,moving=!!q&&M.phase==='shot',P=moving?shotPhase(q.sh,M.t):{sw:1,f:1},ez=1-Math.pow(1-P.f,2.2);
  const focus=q?(moving?q.sh.from:q.sh.to):[0,0],nearG=M.pos?M.pos.every((pp,p)=>M.holed[p]||dist(pp,h.green)<=52)&&dist(focus,h.green)<=52:false;
  const tgt=camFor({h},nearG,cv);if(!M.cam)M.cam=tgt;else{const k=1-Math.exp(-(dt||16)/260);M.cam={x:M.cam.x+(tgt.x-M.cam.x)*k,y:M.cam.y+(tgt.y-M.cam.y)*k,s:M.cam.s+(tgt.s-M.cam.s)*k};}
  const cam=M.cam,X=v=>(v-cam.x)*cam.s+W/2,Y=v=>H/2-(v-cam.y)*cam.s,Sc=cam.s,u=Math.max(W/55,5);
  drawCourse(c,W,H,h,X,Y,Sc);
  const px=X(h.pin[0]),py=Y(h.pin[1]);c.fillStyle='#10201a';c.beginPath();c.arc(px,py,Math.max(2.5,.45*Sc),0,6.3);c.fill();drawFlag(c,px,py,u);
  // each golfer's earlier shots as faint arcs in his side's colour; the shot in the air glows, with the golfer swinging at it
  if(M.trail)M.trail.forEach((tr,p)=>{for(const s of tr)drawTracer(c,X,Y,Sc,H,u,s,1,MPC[M.balls[p].side],false);});
  let ball=null;if(moving&&q.sh.k!=='drop'&&q.sh.k!=='pick'){ball=shotAt(q.sh,ez);drawTracer(c,X,Y,Sc,H,u,q.sh,ez,MPC[q.side],true);drawGolfer(c,X,Y,u,q.sh,swingT(P,true),MPC[q.side],P.f<.35?1:Math.max(0,1-(P.f-.35)/.3));}
  M.panel=q&&(M.phase==='shot'||M.phase==='wait')?{sh:q.sh,P,live:moving,col:MPC[q.side],u}:null;
  if(!M.pos)return;
  for(let p=0;p<M.pos.length;p++){if(M.holed[p]&&!(moving&&q.p===p))continue;const at=moving&&q.p===p?(ball||q.sh.from):M.pos[p];
    const lift=moving&&q.p===p?shotLift(q.sh,ez,Sc,H):0,air=lift?lift/Math.max(1,H*.13):0;
    const drop=moving&&q.p===p&&q.sh.holed&&P.f>.88?Math.max(0,1-(P.f-.88)/.12):1,br=u*.42*(1+air*.9)*drop;if(br<=.2)continue;
    const bx=X(at[0]),by=Y(at[1]);c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(bx+lift*.3,by+u*.12,br,br*.6,0,0,6.3);c.fill();
    c.fillStyle='#fff';c.strokeStyle=MPC[M.balls[p].side];c.lineWidth=Math.max(2,u*.22);c.beginPath();c.arc(bx,by-lift,br,0,6.3);c.fill();c.stroke();
    // in a team match, each ball carries its golfer's number in the team (1 to 4)
    if(M.balls[p].mem!==undefined&&br>u*.3){c.fillStyle='#10201a';c.font=`700 ${Math.round(br*1.25)}px system-ui,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(String(M.balls[p].mem+1),bx,by-lift+br*.05);}}
  if(q&&q.sh.holed&&M.phase==='wait'&&M.w<1000){const hw=M.w/1000;c.strokeStyle=MPC[q.side];c.globalAlpha=1-hw;c.lineWidth=Math.max(2,u*.22);c.beginPath();c.arc(px,py,u*(.6+hw*3.2),0,6.3);c.stroke();c.globalAlpha=1;}}
// Buying takes two taps: "Sign him", then a confirm button with the price on it.
function buyBtn(m,full,label){const off=full||D.me.cash<m.ask||ui.busy;
  if(ui.buyAsk===m.id&&!off)return `<span class="buyask"><span>${m.cr?'Hire':'Sign'} ${esc(m.name)} for <b>${fmt$(m.ask)}</b>?</span><button class="btn sm primary" data-act="buyOk" data-v="${m.id}">Confirm buy</button><button class="btn sm" data-act="buyNo">Cancel</button></span>`;
  return `<button class="btn sm primary" data-act="buy" data-v="${m.id}" ${off?'disabled':''}>${label}</button>`;}
/* ---------- the league: every manager's record and roster ---------- */
async function loadLeague(){const {data}=await SB.rpc('league');ui.league=data||[];if(ui.view==='league'||ui.view==='mgr')render();}
async function loadMgr(id){ui.mgrG=null;const {data}=await SB.from('golfers').select('*').eq('manager_id',id).order('created_at');ui.mgrG=data||[];if(!ui.league)await loadLeague();ui.mgr=(ui.league||[]).find(m=>m.id===id)||null;if(ui.view==='mgr')render();}
function leagueHTML(){const L=ui.league;if(!L){loadLeague();return '<section class="sec"><p class="muted">Loading the league\u2026</p></section>';}
  return `<section class="intro"><p class="eyebrow">League</p><h1>Every manager</h1><p class="lede">Ranked by prize money won. Tap a manager to see his roster. Bank balances stay private.</p></section>
<section class="roster">${L.map((m,i)=>`<button class="rcard${m.mine?' me':''}" data-act="mgr" data-v="${m.id}"><div class="rtop"><div class="lrank">${i+1}</div><div class="rwho"><b>${esc(m.name)}${m.mine?' <span class="tag">You</span>':''}</b><span>${m.golfers} golfer${m.golfers===1?'':'s'}${m.coaches?`, ${m.coaches} coach${m.coaches>1?'es':''}`:''} \u00b7 joined ${new Date(m.joined).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div></div>
 <div class="lstats"><div><b>${fmt$(m.prizes)}</b><span>Prize money</span></div><div><b>${m.wins}</b><span>Tour wins</span></div><div><b>${m.qf_wins}</b><span>Quick-Fire wins</span></div><div><b>${m.top10}</b><span>Top tens</span></div><div><b>${m.events}</b><span>Events</span></div><div><b>${fmt$(m.other)}</b><span>NIL, coaching, sales</span></div></div></button>`).join('')}</section>`;}
function mgrHTML(){const m=ui.mgr,G=ui.mgrG;const back='<button class="btn sm" data-act="go" data-v="league">\u2190 League</button>';
  if(!G)return `<section class="sec">${back}<p class="muted">Loading the roster\u2026</p></section>`;
  const act=G.filter(g=>!g.retired),co=G.filter(g=>g.retired);
  const card=g=>`<button class="rcard" data-act="player" data-v="${g.id}"><div class="rtop">${avatarO(g)}<div class="rwho"><b>${flagHTML(g.country)}${esc(g.name)}</b><span>Age ${ageOf(g.yr)} \u00b7 ${tourOf(g)}</span><span>${(g.stats&&g.stats.wins)||0} wins \u00b7 ${fmt$((g.stats&&g.stats.earn)||0)} earned</span></div><div class="rovr"><b>${Math.round(ovr(g.sk))}</b><span>OVR</span></div></div>
  <div class="rbars">${'smlx'.split('').map(u=>{const v=um(g.sk,u);return `<span class="rl">${UMB[u]}</span><span class="track"><i style="width:${clamp(v,0,100)}%;background:${barC(v)}"></i></span><b>${Math.round(v)}</b>`;}).join('')}</div>${g.ask?`<span class="tag hot">For sale: ${fmt$(g.ask)}</span>`:''}</button>`;
  return `<section class="intro"><p class="eyebrow">Roster</p><h1>${esc(m?m.name:'Manager')}</h1>${m?`<div class="lstats wide"><div><b>${fmt$(m.prizes)}</b><span>Prize money</span></div><div><b>${m.wins}</b><span>Tour wins</span></div><div><b>${m.qf_wins}</b><span>Quick-Fire wins</span></div><div><b>${m.top10}</b><span>Top tens</span></div><div><b>${m.events}</b><span>Events</span></div><div><b>${fmt$(m.other)}</b><span>NIL, coaching, sales</span></div></div>`:''}${back}</section>
<section class="roster">${act.length?act.map(card).join(''):'<p class="muted">No active golfers.</p>'}</section>
${co.length?`<section class="sec"><h2>Coaches</h2><div class="shop">${co.map(c=>`<div class="item"><b>${flagHTML(c.country)}${esc(c.name)}</b><span>${c.cr&&c.cr.o?`Short ${c.cr.o.s}, irons ${c.cr.o.m}, long ${c.cr.o.l}, head ${c.cr.o.x}. ${fmt$(c.cr.price)} a lesson.`:'Retired.'}</span></div>`).join('')}</div></section>`:''}`;}
// Scouting report: the scouts' grade for how high he can go in each area, and where he is now.
function reportBody(g,R){if(!R)return '<p class="muted">Asking the scouts\u2026</p>';if(R.err)return `<p class="muted">${esc(R.err)}</p>`;
  return `<p class="muted small">How high the scouts think he can go in each area (A is the highest, then B, C, D, and F the lowest), with his rating now. They're right most of the time.</p><div class="gfacts">${'smlx'.split('').map(u=>`<div><b class="grade g${R[u].grade}">${R[u].grade}</b><span><b style="font-size:.95rem">${UMB[u]}</b><br>Now ${Math.round(um(g.sk,u))}</span></div>`).join('')}</div>`;}
async function loadMyReport(id){ui.myRep={id,r:null};try{const r=await call('report',{id});ui.myRep={id,r:r.report};}catch(e){ui.myRep={id,r:{err:e.message}};}if(ui.view==='golfer')render();}
/* ---------- a golfer's full profile: for the market (with a scouting report) or anyone you click ---------- */
const barC=v=>{v=Math.round(v);return v>=75?'var(--good)':v>=60?'var(--mid)':'var(--bad)';};
async function loadPlayer(id){ui.pl=null;ui.rep=null;const {data}=await SB.from('golfers').select('*').eq('id',id).maybeSingle();ui.pl=data;
  if(data&&!data.retired&&(data.ask||data.manager_id===D.user.id)){try{const r=await call('report',{id});ui.rep=r.report;}catch(e){ui.rep={err:e.message};}}
  if(ui.view==='player')render();}
function scoringAvg(s){return s&&s.rounds?s.par/s.rounds:null;}
function playerHTML(){const g=ui.pl;const back=ui.from==='mgr'&&ui.mid?`<button class="btn sm" data-act="mgr" data-v="${ui.mid}">← ${esc((ui.mgr&&ui.mgr.name)||'Roster')}</button>`:`<button class="btn sm" data-act="go" data-v="${ui.from||'market'}">← ${{events:'Events',league:'League'}[ui.from]||'Market'}</button>`;
  if(!g)return `<section class="sec">${back}<p class="muted">Loading his file…</p></section>`;
  const val=valueOfC(g.sk,g.yr),mineG=g.manager_id===D.user.id,full=mine().length>=S().max_golfers,sa=scoringAvg(g.stats),R=ui.rep;
  const seasons=(g.seasons||[]).slice().reverse();
  return `<section class="intro"><p class="eyebrow">${g.ask&&!mineG?'For sale':'Player file'}</p><div class="who">${avatarO(g)}<div><h1>${flagHTML(g.country)} ${esc(g.name)}</h1><p class="muted">${g.arch?esc(g.arch)+'. ':''}Age ${ageOf(g.yr)}. ${tourOf(g)}. Overall ${Math.round(ovr(g.sk))}. ${esc(g.stable||'Tour regular')}.</p></div></div>${back}</section>
${g.ask&&!mineG?`<section class="sec"><div class="row" style="justify-content:flex-start;flex-wrap:wrap;gap:12px"><b style="font-size:1.3rem">${fmt$(g.ask)}</b><span class="muted">Market value ${fmt$(val)}. ${g.ask/val<.93?'Priced under value.':g.ask/val>1.1?'Priced over value.':'A fair price.'}</span>${buyBtn(g,full,`Sign him for ${fmt$(g.ask)}`)}</div>${flash()}${ui.msg?`<p class="hand">${esc(ui.msg)}</p>`:''}</section>`:''}
${R?`<section class="sec"><h2>Scouting report</h2>${reportBody(g,R)}</section>`:''}
<section class="sec"><h2>Record</h2><div class="stats"><div><b>${sa===null?'–':(sa>=0?'+':'')+sa.toFixed(1)}</b><span>Scoring avg (to par)</span></div><div><b>${(g.stats&&g.stats.rounds)||0}</b><span>Rounds</span></div></div>${careerHTML(g)}
${seasons.length?`<h3>Seasons</h3><div class="scroll"><table class="tbl"><thead><tr><th>Season</th><th>Tour</th><th class="num">Rank</th><th class="num">Pts</th><th class="num">Wins</th><th class="num">Earned</th></tr></thead><tbody>${seasons.map(x=>`<tr><td>${x.s} (age ${ageOf(x.s)})</td><td class="small">${T(x.tour).name}</td><td class="num">${x.rank}</td><td class="num">${fmtPts(x.pts)}</td><td class="num">${x.wins||''}</td><td class="num">${fmt$(x.earn)}</td></tr>`).join('')}</tbody></table></div>`:''}</section>
<section class="umbs">${'smlx'.split('').map(u=>umbO(g,u,true)).join('')}</section>`;}

/* ---------- render and events ---------- */
function keepScroll(fn){const bs=document.getElementById('bscroll'),top=bs?bs.scrollTop:0,y=window.scrollY;fn();const b2=document.getElementById('bscroll');if(b2&&top)b2.scrollTop=top;if(Math.abs(window.scrollY-y)>2)window.scrollTo(0,y);}
function route(){const v=ui.view;if(['loading','auth','join'].includes(v))return '';
  return '#'+(v==='board'&&ui.ev?'board/'+ui.ev+(ui.watch?'/'+ui.watch:''):(v==='golfer'||v==='range')&&ui.sel?v+'/'+ui.sel:v==='mgr'&&ui.mid?'mgr/'+ui.mid:v==='player'&&ui.pid?'player/'+ui.pid:(v==='standings'||v==='events')&&ui.tour?v+'/'+ui.tour:v);}
function applyRoute(){const h=decodeURIComponent(location.hash.slice(1));if(!h||h.includes('=')||!D.me)return false;const [v,a,b]=h.split('/');
  if(!V[v]||['loading','auth','join'].includes(v)||(v==='admin'&&!D.me.is_admin))return false;
  if(v==='coaches')ui.view='range';else if(v==='stable'&&a){ui.view='golfer';ui.sel=a;}else ui.view=v;if((v==='golfer'||v==='range')&&a)ui.sel=a;if(v==='mgr'){if(!a)return false;ui.mid=a;loadMgr(a);}if(v==='player'){if(!a)return false;ui.pid=a;ui.from='market';loadPlayer(a);}if((v==='standings'||v==='events')&&a)ui.tour=a;
  if(v==='board'){if(!a)return false;ui.ev=a;ui.watch=b||null;ui.anim=null;ui.board=null;
    loadBoard().then(()=>{const e=evNow();if(e&&phase(e)==='open')return loadPreview(e).then(render);render();});}
  return true;}
function render(){nav();const v=document.getElementById('view');const f=V[ui.view]||V.loading;
  const r=route();if(r&&location.hash!==r)history.replaceState(null,'',r);
  const a=document.activeElement,id=a&&a.id,val=a&&a.value;keepScroll(()=>{v.innerHTML=f();});
  if(id){const n=document.getElementById(id);if(n&&n!==a){n.focus();if(n.type==='text'&&val!==undefined)n.value=val;}}
  if(ui.view==='board'&&ui.watch&&document.getElementById('cv'))startLoop();
  if(ui.view==='board'&&ui.mpw&&document.getElementById('mcv')){mFit();if(ui.ma&&ui.ma.key===ui.mpw){mHUD();mSide();mPaintFeed();}mpSync();}
  const af=document.getElementById('authForm');if(af)af.onsubmit=ev=>{ev.preventDefault();submitAuth();};}
function go(v){if(v==='league')ui.league=null;ui.view=v;ui.err='';ui.msg='';ui.confirm=null;if(v!=='board'){ui.ev=null;ui.board=null;ui.watch=null;}if(v==='standings')ui.stand=null;render();window.scrollTo(0,0);}
const val=id=>{const n=document.getElementById(id);return n?n.value:'';};
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,v=b.dataset.v;
  if(a==='go')return go(v);
  if(a==='player'){ui.from=ui.view==='player'?ui.from:ui.view;ui.pid=v;ui.view='player';ui.err='';ui.msg='';render();window.scrollTo(0,0);loadPlayer(v);return;}
  if(a==='authMode'){ui.auth={...ui.auth,mode:v,msg:'',err:false};return render();}
  if(a==='signOut')return signOut();
  if(a==='mgr'){ui.mid=v;ui.view='mgr';ui.mgr=(ui.league||[]).find(m=>m.id===v)||null;render();window.scrollTo(0,0);loadMgr(v);return;}
  if(a==='golfer'){ui.sel=v;ui.view='golfer';ui.msg='';ui.err='';ui.confirm=null;render();window.scrollTo(0,0);return;}
  if(a==='coachpick'){const gg=G();return act('coach',{id:gg.id,coach:v||null},()=>{ui.msg=v?'Coach booked for his sessions.':'He will work alone.';});}
  if(a==='sel'){ui.sel=v;ui.msg='';ui.err='';ui.confirm=null;return render();}
  if(a==='confirm'){ui.confirm=v||null;return render();}
  if(a==='pcolor'){ui.pros.color=+v;return render();}
  if(a==='tour'){ui.tour=v;return render();}
  if(a==='stour'){ui.tour=v;ui.stand=null;return render();}
  if(a==='payAll'){ui.payAll=!ui.payAll;return render();}
  if(a==='fullBoard'){ui.full=!ui.full;return render();}
  if(a==='board'){ui.aceInit=false;ui.mpb=null;ui.mpw=null;ui.ma=null;ui.mps=null;ui.mpwAuto=0;ui.mpIf=null;ui.view='board';ui.ev=v;ui.board=null;ui.watch=null;ui.full=false;ui.preview=null;render();window.scrollTo(0,0);const e=D.events.find(x=>x.id===v);if(e&&phase(e)==='open')loadPreview(e).then(render);loadBoard().then(render);return;}
  if(a==='mpWatch'){if(ui.mpw===v)return;ui.mpw=v;ui.ma=null;ui.mps=null;loadMp().then(()=>{render();const w=document.getElementById('mpWatchBox');if(w)w.scrollIntoView({block:'start'});});return;}
  if(a==='mStop'){ui.mpw=null;ui.ma=null;ui.mps=null;return keepScroll(render);}
  if(a==='mPause'&&ui.ma){ui.ma.paused=!ui.ma.paused;return mSide();}
  if(a==='mSpeed'&&ui.ma){ui.ma.speed=+v;document.querySelectorAll('[data-act=mSpeed]').forEach(x=>x.classList.toggle('on',x.dataset.v===v));return;}
  if(a==='mLive'&&ui.ma){const M=ui.ma;M.live=true;b.classList.add('on');const x=mpGet(ui.mpb,M.key),n=x?Math.min(x.h.length,(ui.mps||{s:[]}).s.length):0;if(n){M.shown=n-2;mpBegin(n-1);}return;}
  if(a==='mHole'&&ui.ma){ui.ma.live=false;const lb=document.querySelector('[data-act=mLive]');if(lb)lb.classList.remove('on');mpBegin(+v);return;}
  if(a==='mpIf'){const [eid,n]=v.split('|');ui.mpIf={eid,n:+n};return keepScroll(render);}
  if(a==='watch'){ui.watch=v;ui.anim=null;loadWatch().then(()=>{syncAnim();render();window.scrollTo(0,0);});return;}
  if(a==='wStop'){ui.watch=null;ui.anim=null;return render();}
  if(a==='wPause'&&ui.anim){ui.anim.paused=!ui.anim.paused;return paintSide();}
  if(a==='wSpeed'&&ui.anim){ui.anim.speed=+v;document.querySelectorAll('[data-act=wSpeed]').forEach(x=>x.classList.toggle('on',x.dataset.v===v));return;}
  if(a==='wLive'&&ui.anim){ui.anim.live=true;const F=(ui.feed||[]).slice().sort((p,q)=>hkey(p.round,p.hole)-hkey(q.round,q.hole)),l=F[F.length-1];if(l)beginHole(l);b.classList.add('on');return;}
  if(a==='wRound'&&ui.anim){ui.anim.cardR=+v;return paintSide();}
  if(a==='wHole'&&ui.anim){const [r,h]=v.split('-').map(Number),x=(ui.feed||[]).find(q=>q.round===r&&q.hole===h);if(x){ui.anim.live=false;const lb=document.querySelector('[data-act=wLive]');if(lb)lb.classList.remove('on');beginHole(x);}return;}
  if(a==='join')return act('join',{name:val('stName')});
  if(a==='scout'){keepPros();return act('scout',{fresh:v==='fresh'});}
  if(a==='sign'){keepPros();const P=ui.pros;return act('sign',{name:P.name||'Tucker Hale',country:P.country,color:P.color},r=>{ui.sel=r.id;ui.pros={name:'',country:'US',college:'',color:0};ui.view='golfer';});}
  const g=G();
  if(a==='train'){ui.msg='';return act('train',{id:g.id,what:v});}
  if(a==='orders'){const f=val('oFocus');return act('orders',{id:g.id,orders:f?{focus:f,rest_below:+val('oRest'),report:true}:null},()=>{ui.msg='Standing orders saved.';});}
  if(a==='gear')return act('gear',{id:g.id,u:v});
  if(a==='commit')return act('commit',{id:g.id,i:+v});
  if(a==='enterAll')return act('enterAll',{event:v},async()=>{const e=D.events.find(x=>x.id===v);if(e&&ui.view==='board')await loadPreview(e);});
  if(a==='enter'||a==='withdraw')return act(a,{id:b.dataset.g,event:v},async()=>{const e=D.events.find(x=>x.id===v);if(e&&ui.view==='board')await loadPreview(e);});
  if(a==='list')return act('list',{id:g.id,ask:+val('askIn')});
  if(a==='unlist')return act('unlist',{id:g.id});
  if(a==='unlistid')return act('unlist',{id:v},()=>{ui.msg='Taken off the market.';});
  if(a==='quicksell'){ui.confirm=null;return act('quicksell',{id:g.id},()=>{ui.sel=null;ui.view='stable';});}
  if(a==='buy'){ui.buyAsk=v;return keepScroll(render);}
  if(a==='buyNo'){ui.buyAsk=null;return keepScroll(render);}
  if(a==='buyOk'){ui.buyAsk=null;return act('buy',{id:v});}
  if(a==='retire'){ui.confirm=null;return act('retire',{id:g.id});}
  if(a==='fee')return act('fee',{id:g.id,price:+val('feeIn')});
  if(a==='rename')return act('rename',{name:val('stName')});
  if(a==='aset'){let raw=val('set_'+v),x;const d=DEFAULTS[v];x=Array.isArray(d)?raw.split(/[ ,]+/).filter(Boolean).map(Number):typeof d==='number'?Number(raw):typeof d==='boolean'?/^(true|yes|on|1)$/i.test(raw.trim()):raw;if(Array.isArray(x)?x.some(isNaN):typeof x==='number'&&isNaN(x)){ui.err='That needs a number.';return render();}return act('adminSet',{key:v,value:x},()=>{ui.msg='Saved.';});}
  if(a==='atest')return act('adminTest',{tour:val('tTour'),mins:+val('tMin')},()=>{ui.msg='Test event created. It appears on the Events page.';});
  if(a==='alog')return act('adminLog',{},r=>{ui.log=r.log;});
});
document.addEventListener('change',ev=>{const n=ev.target,c=n.dataset&&n.dataset.change;
  if(n.id==='gname'||n.id==='gcountry'||n.id==='gcollege')keepPros();
  if(!c)return;const g=G();
  if(c==='rule')act('rule',{id:g.id,rule:n.value});
  if(c==='college')act('college',{id:g.id,college:n.value});
});
function keepPros(){const P=ui.pros;if(document.getElementById('gname')){P.name=val('gname').trim();P.country=val('gcountry');P.college=val('gcollege');}}

/* ---------- accounts ---------- */
function friendly(m){m=String(m||'');
  if(/invalid login|invalid credentials/i.test(m))return'That email and password don’t match an account.';
  if(/not confirmed/i.test(m))return'Confirm your email first: click the link in the email we sent, then sign in.';
  if(/already registered|already been registered/i.test(m))return'That email already has an account. Sign in instead.';
  if(/rate limit|too many/i.test(m))return'Too many attempts just now. Wait a few minutes and try again.';
  if(/password/i.test(m)&&/(characters|short|weak)/i.test(m))return'Choose a longer password: at least 8 characters.';
  if(/fetch|network/i.test(m))return"Couldn't reach the server. Check your connection and try again.";
  return m||'Something went wrong. Try again.';}
async function submitAuth(){const a=ui.auth;if(a.busy)return;
  const email=(val('aEmail')||a.email||'').trim(),pass=val('aPass');a.email=email;a.busy=true;a.msg='';a.err=false;render();
  const back=location.origin+location.pathname;let r={};
  try{
    if(a.mode==='in')r=await SB.auth.signInWithPassword({email,password:pass});
    else if(a.mode==='up'){if(pass.length<8)r={error:{message:'password too short'}};else{r=await SB.auth.signUp({email,password:pass,options:{emailRedirectTo:back}});if(!r.error&&!(r.data&&r.data.session)){a.mode='in';a.msg='Almost done. Click the confirmation link we just emailed you, then sign in here.';}}}
    else if(a.mode==='forgot'){r=await SB.auth.resetPasswordForEmail(email,{redirectTo:back});if(!r.error)a.msg='If that email has an account, a reset link is on its way.';}
    else if(a.mode==='newpass'){if(pass.length<8)r={error:{message:'password too short'}};else{r=await SB.auth.updateUser({password:pass});if(!r.error){a.mode='in';a.busy=false;await start();return;}}}
  }catch(e){r={error:e};}
  a.busy=false;if(r.error){a.err=true;a.msg=friendly(r.error.message);}render();}
async function signOut(){try{await SB.auth.signOut();}catch(e){}D.user=null;D.me=null;ui.auth={mode:'in',email:'',msg:'Signed out.',err:false,busy:false};go('auth');}
async function start(){
  const {data:{session}}=await SB.auth.getSession();D.user=session?session.user:null;
  if(!D.user){ui.view='auth';return render();}
  try{await load();applyRoute();}catch(e){ui.err="Couldn't load the world. Refresh to try again.";}
  render();
}
if(SB){
  SB.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY'){ui.auth.mode='newpass';ui.view='auth';render();return;}
    const u=session?session.user:null;if(u&&(!D.user||D.user.id!==u.id)&&ui.auth.mode!=='newpass'){D.user=u;ui.view='loading';render();load().then(()=>{applyRoute();render();}).catch(()=>{});}
  });
  start();
  // keep things fresh: the world every 30 seconds, an open board every 5
  setInterval(()=>{if(D.user&&D.me&&!ui.busy&&!['auth','join','scout','admin','news'].includes(ui.view)&&!document.hidden){const a=document.activeElement;if(a&&/INPUT|SELECT/.test(a.tagName))return;load().then(()=>{if(ui.view!=='board')render();}).catch(()=>{});}},30000);
  setInterval(()=>{if(ui.view!=='board'||document.hidden)return;const e=evNow();
    if(e&&isB(e)&&phase(e)!=='open'){loadMp().then(mpPoll);return;}
    if(e&&phase(e)==='open'){(Date.now()%15000<5000?loadPreview(e):Promise.resolve()).then(()=>{const a=document.activeElement;if(!(a&&a.tagName==='SELECT'))keepScroll(render);});return;}
    const was=ui.board&&ui.board.event&&ui.board.event.status,hadPlayers=ui.board&&ui.board.players&&ui.board.players.length;
    loadBoard().then(()=>{const a=document.activeElement;if(a&&a.tagName==='SELECT')return;const e2=evNow(),bb=document.getElementById('boardBox');
      const changed=!ui.board||ui.board.event.status!==was||!hadPlayers;
      if(bb&&ui.board&&e2&&!changed){keepScroll(()=>{bb.innerHTML=boxHTML(ui.board,e2);});paintSide();}
      else{if(e2&&ui.board&&ui.board.event.status==='final'){const d=D.events.find(x=>x.id===ui.ev);if(d)d.status='final';}render();}});},5000);
}else document.getElementById('view').innerHTML='<p class="lede">Couldn’t load the game. Refresh to try again.</p>';
window.addEventListener('resize',()=>{if(document.getElementById('cv'))fitCanvas();if(document.getElementById('mcv'))mFit();});
