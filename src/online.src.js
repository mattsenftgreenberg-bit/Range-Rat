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
const DEFAULTS={start_cash:75000,max_golfers:8,sessions_per_day:1,lessons_per_day:5,coach_max:1.5,deadline_min:5,round_min:7.5,events_per_season:8,hours:[18,19,20,21],gain_mult:1,rust_per_day:.025,recovery_per_day:15,event_fatigue:20,train_fatigue:15,purse_mult:1,fee_mult:1,sale_chance_mult:1,coach_age_yr:18,recruit_cost:5000,mp_on:true,mp_fee:200,mp_fee_jr:50,mp_base:5000,market_size:14,market_new:4,ai_coaches:30,market_prodigy_pct:1,weekends:true,qf_on:true,qf_every_min:20,qf_fee:200,qf_base:20000,qf_add:200,qf_bonus:1000,qf_ace:1000000};
const SETN={mp_on:'Match Play running (true or false)',mp_fee:'Match Play entry fee',mp_fee_jr:'Match Play entry fee (juniors)',mp_base:'Match Play guaranteed pot (college; other levels scale)',market_prodigy_pct:'Chance a market golfer is a Prodigy (%, at most 5)',market_size:'Golfers for sale from rival coaches',market_new:'New faces on the market each hour',ai_coaches:'Computer coaches available',recruit_cost:'Cost to sign a junior',qf_on:'Quick-Fire Opens running (true or false)',qf_every_min:'Minutes between Quick-Fire Opens',qf_fee:'Quick-Fire entry fee',qf_base:'Quick-Fire base pot',qf_add:'Added to the pot per entry',qf_bonus:'Most greens / up and downs / long drive bonus',qf_ace:'Hole-in-one bonus',start_cash:'Starting money for a new roster',max_golfers:'Most active golfers per roster',sessions_per_day:'Range sessions per golfer per day',lessons_per_day:'Lessons each coach gives per day',coach_max:'Best coach multiplier',deadline_min:'Entry deadline, minutes before the start',round_min:'Minutes per round',weekends:'Tour events on weekends too (true or false)',events_per_season:'(not used: there is now an event every night)',hours:'Start hours (New York time)',gain_mult:'Training gain multiplier',rust_per_day:'Rust per skipped day',recovery_per_day:'Fatigue recovered per day',event_fatigue:'Fatigue from playing an event',train_fatigue:'Fatigue from a range session',purse_mult:'Purse multiplier (new events)',fee_mult:'Entry fee multiplier (new events)',sale_chance_mult:'How keen rival coaches are to buy',coach_age_yr:'Career year a golfer may retire to coach'};
const ui={view:'loading',sel:null,msg:'',err:'',busy:false,auth:{mode:'in',email:'',msg:'',err:false,busy:false},tour:null,ev:null,watch:null,board:null,feed:null,pros:{name:'',country:'US',college:'',color:0},full:false};
const D={user:null,me:null,golfers:[],events:[],entries:[],world:null,settings:{...DEFAULTS},coaches:[],market:[],names:{}};
let poll=null,boardPoll=null;

/* ---------- small helpers ---------- */
const S=()=>D.settings;
const mine=()=>D.golfers.filter(g=>!g.retired);
const G=()=>D.golfers.find(g=>g.id===ui.sel)||mine()[0]||D.golfers[0];
const qfBase=lv=>Math.round(S().qf_base*TOURS[lv==='col'?'col0':lv].purse/TOURS.col0.purse/1000)*1000;
const QF='qf',isQ=e=>!!e&&String(e.tour).startsWith('qf'),MP='mp',isM=e=>!!e&&String(e.tour).startsWith('mp:');
const mpBase=lv=>Math.round(S().mp_base*TOURS[lv==='col'?'col0':lv].purse/TOURS.col0.purse/100)*100;
const qLevel=g=>isCol(g.tour)?'col':g.tour,lvName=lv=>lv==='col'?'College':lv==='jr'?'Junior':(TOURS[lv]||{name:lv}).name;
const canPlay=(e,g)=>isQ(e)||isM(e)?e.tour.slice(3)===qLevel(g):e.tour===g.tour;
const T=t=>t===QF?{name:'Quick-Fire Opens'}:t===MP?{name:'Match Play'}:String(t).startsWith('qf:')?{name:'Quick-Fire · '+lvName(t.slice(3))}:String(t).startsWith('mp:')?{name:'Match Play · '+lvName(t.slice(3))}:TOURS[t]||{name:t};
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
function inField(e,g){const x=entryOf(e,g);if(x)return x.status==='in';if(isQ(e)||isM(e))return false;return e.test||g.enter_rule==='all'||(g.enter_rule==='signature'&&['Signature','Finale'].includes(e.type));}
const subRowO=(g,k,ro,kid)=>`<div class="sn${kid?' kid':''}">${SUBN[k]}<small>${SUBD[k]}</small></div><div class="track"><i style="width:${clamp(g.sk[k],0,100)}%;background:${barC(g.sk[k])}"></i></div><div class="sv">${Math.round(g.sk[k])}</div>${ro?'':`<button class="btn xs" data-act="train" data-v="${k}" ${g.sessions>0?'':'disabled'}>Drill</button>`}`;
function umbO(g,u,ro){const v=um(g.sk,u);let rows;
  if(u==='s'){const pv=(g.sk.sputt+g.sk.lputt)/2;rows=['wedge','pitch','chip','bunker'].map(k=>subRowO(g,k,ro)).join('')+`<div class="sn grp">Putting</div><div class="track"><i style="width:${pv}%;background:${barC(pv)}"></i></div><div class="sv">${Math.round(pv)}</div>${ro?'':'<span></span>'}`+subRowO(g,'sputt',ro,1)+subRowO(g,'lputt',ro,1);}
  else rows=SUB[u].map(k=>subRowO(g,k,ro)).join('');
  const c=!ro&&g.coach_id&&D.coaches.find(x=>x.id===g.coach_id),m=c&&c.cr.o?coMultC(c.cr.o[u]):0;
  return `<div class="umb"><div class="uhead"><div><h2>${UMB[u]}</h2><small>${UMBD[u]}${m?` <span class="tag">×${m.toFixed(2)} with ${esc(c.name)}</span>`:''}</small></div><b>${Math.round(v)}</b></div><div class="track thick"><i style="width:${v}%;background:${barC(v)}"></i></div><div class="subs${ro?' ro':''}">${rows}</div>${ro?'':`<button class="btn sm" data-act="train" data-v="${u}" ${g.sessions>0?'':'disabled'} style="align-self:flex-start">General ${UMB[u].toLowerCase()} session</button>`}</div>`;}
const coMultC=v=>1+(S().coach_max-1)*Math.pow(clamp((v-35)/60,0,1),1.2);
const coOvrC=o=>(o.s+o.m+o.l+o.x)/4;
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
  const [me,gs,ev,en,w,st,co,mk,qk]=await Promise.all([
    SB.from('managers').select('*').eq('id',uid).maybeSingle(),
    SB.from('golfers').select('*').eq('manager_id',uid).order('created_at'),
    // tour events from the last three days, and the quick events (Quick-Fire, Match Play) only from the last six hours:
    // there are dozens of those an hour, and one shared list would crowd the Finales out
    SB.from('events').select(EVCOLS).gte('starts_at',new Date(Date.now()-3*864e5).toISOString()).not('tour','like','qf:%').not('tour','like','mp:%').order('starts_at').limit(400),
    SB.from('entries').select('*').eq('manager_id',uid),
    SB.from('world').select('*').maybeSingle(),
    SB.from('settings').select('key,value'),
    SB.from('golfers').select('id,name,country,manager_id,stable,cr,best,tour,stats,trophies,ret_age,color').eq('retired',true).not('cr','is',null),
    SB.from('golfers').select('id,name,country,manager_id,stable,sk,yr,tour,college,ask,arch,stats,listed_at,color').not('ask','is',null).eq('retired',false).order('ask'),
    SB.from('events').select(EVCOLS).gte('starts_at',new Date(Date.now()-6*36e5).toISOString()).or('tour.like.qf:*,tour.like.mp:*').order('starts_at').limit(400),
  ]);
  D.me=me.data;D.golfers=gs.data||[];D.events=(ev.data||[]).concat(qk.data||[]).filter(e=>e.tour!=='col1'&&e.tour!=='col2').sort((a,b)=>a.starts_at<b.starts_at?-1:a.starts_at>b.starts_at?1:0);/* the old college circuits are gone */D.entries=en.data||[];D.world=w.data;D.coaches=co.data||[];D.market=mk.data||[];
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
<section class="sec"><h2>Equipment</h2><div class="shop">${'sml'.split('').map(u=>{const l=g.eq[u];return `<div class="item"><b>${EQN[u]}</b><span>Now: ${EQL[l]}.${l<3?` Next: ${EQL[l+1]}.`:''}</span>${l<3?`<button class="btn sm" data-act="gear" data-v="${u}" ${D.me.cash<EQC[l]||ui.busy?'disabled':''}>Upgrade for ${fmt$(EQC[l])}</button>`:'<span class="tag">Best available</span>'}</div>`;}).join('')}</div></section>
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
  const tours=[...new Set(D.events.map(e=>isQ(e)?QF:isM(e)?MP:e.tour))].sort((a,b)=>TORDER_ON.indexOf(a)-TORDER_ON.indexOf(b));
  const t=ui.tour||'all',list=D.events.filter(e=>t==='all'||(t===QF?isQ(e):t===MP?isM(e):e.tour===t));
  const qn=D.events.filter(e=>isQ(e)&&phase(e)==='open')[0],qset=qn?D.events.filter(e=>isQ(e)&&e.starts_at===qn.starts_at).sort((a,b)=>['jr','col','p3','p2','p1','c2','c1'].indexOf(a.tour.slice(3))-['jr','col','p3','p2','p1','c2','c1'].indexOf(b.tour.slice(3))):[];
  const quick=e=>t==='all'&&(isQ(e)||isM(e)),live=list.filter(e=>['live','closed'].includes(phase(e))&&e.status!=='final'&&!quick(e)),next=list.filter(e=>phase(e)==='open'&&!isQ(e)&&!isM(e)).slice(0,12),done=list.filter(e=>e.status==='final'&&!quick(e)).reverse().slice(0,12);
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
  const head=`<section class="intro"><p class="eyebrow">${T(e.tour).name}${e.test?' · test event':''}</p><h1>${esc(e.name)}</h1><p class="lede">${COURSES[e.ci].name}: ${COURSES[e.ci].blurb} Starts ${when(e.starts_at)}. ${isM(e)?`Knockout match play, nine holes a match. ${e.status==='open'?`Pot so far ${fmt$(mpBase(e.tour.slice(3))+e.fee*((ui.preview&&ui.preview.eid===e.id)?ui.preview.rows.length:0))}`:`Pot ${fmt$(e.purse)}`}.`:isQ(e)?`Two rounds, no cut. ${e.status==='open'?`Pot so far ${fmt$(qfBase(e.tour.slice(3))+S().qf_add*((ui.preview&&ui.preview.eid===e.id)?ui.preview.rows.length:0))}`:`Pot ${fmt$(e.purse)}`}.`:`Purse ${fmt$(e.purse)}.`}</p>${back}</section>`;
  if(isM(e)&&ph!=='open')return head+mpView(e);
  if(ph==='open'){const gs=mine().filter(g=>canPlay(e,g)),todo=gs.filter(g=>!inField(e,g)),cost=(e.test?0:e.fee)*todo.length;
    return head+`<section class="sec"><h2>Entries close in ${until(new Date(deadline(e)).toISOString())}</h2>${todo.length>1?`<div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin-bottom:8px"><button class="btn primary sm" data-act="enterAll" data-v="${e.id}" ${ui.busy||D.me.cash<cost?'disabled':''}>Enter all ${todo.length}${cost?` for ${fmt$(cost)}`:''}</button>${D.me.cash<cost?'<span class="muted small">Not enough money for all of them.</span>':''}</div>`:''}${gs.length?`<div class="shop">${gs.map(g=>evItem(e,g,true)).join('')}</div>`:'<p class="muted">None of your golfers play on this tour.</p>'}${flash()}</section><div class="fieldpay">${previewHTML(e)}${isM(e)?mpPayHTML(e):payoutHTML(e)}</div>`;}
  if(ph==='closed')return head+teeHTML(e,b);
  if(!b||!b.players)return head+'<section class="sec"><p class="muted">Loading the board…</p></section>';
  if(!b.players.length)return head+`<section class="sec"><p class="muted">Setting the field. The first tee time is ${until(e.starts_at)} away.</p></section>`;
  return head+(e.status==='final'?podiumHTML(b,e):'')+watchHTML(b,e)+`<div id="boardBox">${boxHTML(b,e)}</div>`;},
standings(){const tours=TORDER_ON,t=ui.tour&&ui.tour!=='all'?ui.tour:(G()&&!G().retired?G().tour:'p1');ui.tour=t;
  const rows=ui.stand&&ui.stand.t===t?ui.stand.rows:null;if(!rows)loadStand(t);
  return `<section class="intro"><p class="eyebrow">Season ${D.world?D.world.season:1}</p><h1>Standings</h1><p class="lede">Points from finished events this season. At the end of the month the top ${Math.round(FIELD*.2)} on each pro tour go up and the bottom ${Math.round(FIELD*.2)} go down.</p></section>
<section class="sec"><div class="row" style="justify-content:flex-start;flex-wrap:wrap">${tours.map(x=>`<button class="btn sm${t===x?' on':''}" data-act="stour" data-v="${x}">${T(x).name}</button>`).join('')}</div></section>
<section class="sec">${!rows?'<p class="muted">Loading…</p>':!rows.length?'<p class="muted">No finished events on this tour yet this season.</p>':`<div class="scroll tall"><table class="tbl"><thead><tr><th class="num">#</th><th>Golfer</th><th>Roster</th><th class="num">Points</th><th class="num">Wins</th><th class="num">Earned</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.golfers&&r.golfers.manager_id===D.user.id?'me':r.golfers&&r.golfers.manager_id?'now':''}"><td class="num">${i+1}</td><td>${r.golfers?flagHTML(r.golfers.country)+esc(r.golfers.name)+ageTag(r.golfers.yr,t):'?'}</td><td class="small">${esc(r.golfers&&r.golfers.stable||'Tour regular')}</td><td class="num">${fmtPts(r.pts)}</td><td class="num">${r.wins||''}</td><td class="num">${fmt$(r.earn)}</td></tr>`).join('')}</tbody></table></div>`}</section>`;},
market(){const full=mine().length>=S().max_golfers,list=D.market.filter(m=>m.manager_id!==D.user.id),own=D.market.filter(m=>m.manager_id===D.user.id);
  return `<section class="intro"><h1>Transfer market</h1><p class="lede">Golfers listed by rival coaches and by other managers. Buying from a manager pays them directly.</p></section>
${own.length?`<section class="sec mine-list"><h2>Your listings</h2><div class="shop">${own.map(m=>{const val=valueOfC(m.sk,m.yr);return `<div class="item"><b><button class="linkbtn" data-act="golfer" data-v="${m.id}">${flagHTML(m.country)}${esc(m.name)}</button></b><span>Age ${ageOf(m.yr)}. ${isCol(m.tour)?`College ${classOf(m.yr).toLowerCase()}`:T(m.tour).name}. Overall ${Math.round(ovr(m.sk))}. Market value ${fmt$(val)}.</span><span>Listed ${until(new Date(Date.now()+(Date.now()-Date.parse(m.listed_at))).toISOString())} ago. Other managers and rival coaches can see him.</span><span class="tag hot">${fmt$(m.ask)}</span><button class="btn sm" data-act="golfer" data-v="${m.id}">Change price</button><button class="btn sm" data-act="unlistid" data-v="${m.id}" ${ui.busy?'disabled':''}>Take him off</button></div>`;}).join('')}</div></section>`:''}
<section class="sec">${flash()}${ui.msg?`<p class="hand">${esc(ui.msg)}</p>`:''}
<div class="shop"><div class="item"><b>Junior prospect</b><span>${fmt$(S().recruit_cost)}. Starts at 15 on the Junior Tour and is yours to develop.</span><button class="btn sm" data-act="go" data-v="scout" ${full?'disabled':''}>Scout juniors</button></div></div>
 <div class="roster mkt">${list.map(m=>{const val=valueOfC(m.sk,m.yr),d=m.ask/val;return `<div class="rcard"><div class="rtop">${avatarO(m)}<div class="rwho"><b><button class="linkbtn" data-act="player" data-v="${m.id}">${flagHTML(m.country)}${esc(m.name)}</button></b><span>Age ${ageOf(m.yr)} \u00b7 ${isCol(m.tour)?`College ${(classOf(m.yr)||'').toLowerCase()}`:T(m.tour).name}</span><span>Sold by ${esc(m.stable||'Unknown')}${m.manager_id?' <span class="tag">Manager</span>':''}</span></div><div class="rovr"><b>${Math.round(ovr(m.sk))}</b><span>OVR</span></div></div>
  <div class="rbars">${'smlx'.split('').map(u=>{const v=um(m.sk,u);return `<span class="rl">${UMB[u]}</span><span class="track"><i style="width:${clamp(v,0,100)}%;background:${barC(v)}"></i></span><b>${Math.round(v)}</b>`;}).join('')}</div>
  <div class="mprice"><b>${fmt$(m.ask)}</b><span class="tag${d<.93?' hot':''}">${d<.93?'Under value':d>1.1?'Over value':'Fair price'}</span></div>
  <div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn sm" data-act="player" data-v="${m.id}">Scouting report</button><button class="btn sm primary" data-act="buy" data-v="${m.id}" ${full||D.me.cash<m.ask||ui.busy?'disabled':''}>Sign him</button></div></div>`;}).join('')}</div>
<p class="muted small">${full?`Your roster is full at ${S().max_golfers} active golfers. `:''}Rival coaches buy listed golfers too, so the list changes day to day.</p></section>`;},
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
  <p class="muted small">Other managers book him from the range for their own golfers; a fee near what he's worth books best.</p></section>`;}

/* ---------- the live board ---------- */
async function loadBoard(){if(!ui.ev)return;const {data,error}=await SB.rpc('event_board',{eid:ui.ev});if(!error&&data){ui.board=data;if(ui.watch){await loadWatch();syncAnim();}}}
async function loadWatch(){const {data}=await SB.rpc('event_watch',{eid:ui.ev,gid:ui.watch});ui.feed=data||[];}
function boardRows(b,e){const pars=COURSES[e.ci].holes.map(h=>h.par);
  return b.players.map(p=>{let tot=0,thru=0,rd=0,strokes=[];(p.scores||[]).forEach((r,i)=>{r.forEach((s,h)=>tot+=s-pars[h]);if(r.length){rd=i;thru=r.length;}strokes.push(r.reduce((a,c)=>a+c,0));});return{p,tot,thru,rd,strokes};});}
const COLG='<colgroup><col style="width:2.7em"><col><col style="width:4.4em"><col style="width:2.9em"><col style="width:2.5em"></colgroup>';
function boardHTML(b,e){const rows=boardRows(b,e),fin=e.status==='final',cutDone=fin||(b.vis&&b.vis[1]===18);
  const R=Math.max(0,...rows.map(r=>r.rd));
  rows.sort((a,c)=>fin?((a.p.pos_n||999)-(c.p.pos_n||999)):((a.p.cut?1:0)-(c.p.cut?1:0)||a.tot-c.tot||c.thru-a.thru));
  let pos=0;rows.forEach((r,i)=>{if(fin){r.pos=r.p.pos||'';return;}if(i===0||r.tot!==rows[i-1].tot||r.p.cut!==rows[i-1].p.cut)pos=i+1;r.pos=r.p.cut?'MC':(rows.filter(x=>!x.p.cut&&x.tot===r.tot).length>1?'T':'')+pos;});
  if(!fin){const act=rows.filter(r=>!r.p.cut),list=act.map(r=>({r:ratingFor(r.p,e.ci),cur:r.tot,H:Math.max(0,(nR(e)-1-r.rd)*18+(18-r.thru))}));const w=winProbs(list,1500);act.forEach((r,i)=>r.odds=oddsLabel(w[i]));}
  const proj=!isQ(e)&&!cutDone&&rows.length>CUT?rows[CUT-1].tot:null,lastIn=proj===null?-1:rows.filter(r=>r.tot<=proj).length-1;
  const cutTxt=proj!==null?`Projected cut ${fmtPar(proj)}`:b.event&&b.event.cut_line!==null&&b.event.cut_line!==undefined?`Cut fell at ${fmtPar(b.event.cut_line)}`:'';
  ui.posMap=new Map(rows.map(r=>[r.p.id,r.p.cut?'Missed cut':`${r.pos} at ${fmtPar(r.tot)}`]));
  const live=!fin&&phase(e)==='live';
  const row=(r,cl)=>{const i=rows.indexOf(r),chip=proj!==null&&!r.p.cut&&(r.p.managed)?(i>lastIn?'<span class="chip out">Outside the cut</span>':'<span class="chip">Inside the cut</span>'):r.p.cut&&r.p.managed?'<span class="chip">Missed the cut</span>':'';
    const o0=r.p.odds0?oddsLabel(r.p.odds0):'';
    return `<tr class="${r.p.mine?'me':r.p.managed?'mine':''}${cl?' cutline':''}"><td class="num">${r.pos}</td><td class="nm">${flagHTML(r.p.country)}${esc(r.p.name)}${ageTag(r.p.yr,e.tour.startsWith('qf:col')?'col0':e.tour)}${r.p.managed?`<small class="sch">${esc(r.p.stable||'')}</small>`:isCol(e.tour)?`<small class="sch">${esc(r.p.college||'')}</small>`:''}${chip}${r.p.managed?` <button class="btn xs" data-act="watch" data-v="${r.p.id}">${ui.watch===r.p.id?'Watching':'Watch'}</button>`:''}</td><td class="num odds">${fin?(r.p.pay?`${fmt$(r.p.pay)}${r.p.pts?`<small class="o0">${fmtPts(r.p.pts)} pts</small>`:''}`:''):`${r.odds||(r.p.cut?'':'–')}${o0?`<small class="o0">from ${o0}</small>`:''}`}</td><td class="num${r.tot<0?' under':''}">${fmtPar(r.tot)}</td><td class="num">${fin?r.strokes.reduce((a,c)=>a+c,0)||'':r.thru===18&&r.rd===R?'F':r.thru||'–'}</td></tr>`;};
  const mineR=rows.filter(r=>r.p.mine),others=rows.filter(r=>r.p.managed&&!r.p.mine),full=ui.full,show=full?rows:rows.slice(0,10);
  const head=`<tr><th class="num">Pos</th><th>Golfer</th><th class="num">${fin?'Won':'Odds'}</th><th class="num">Par</th><th class="num">${fin?'Tot':'Thru'}</th></tr>`;
  return `<section class="board"><div class="row"><h2>${fin?'Final leaderboard':live?`Round ${R+1}${isQ(e)?' of '+nR(e):''}, live`:'Waiting for the first tee shot'}</h2><span class="chip cutchip">${cutTxt}</span></div>
 <table>${COLG}<thead>${head}</thead><tbody>
 ${mineR.length?`<tr class="sep"><td colspan="5">Your golfer${mineR.length>1?'s':''}</td></tr>${mineR.map(r=>row(r)).join('')}`:''}
 ${others.length?`<tr class="sep"><td colspan="5">Other managers’ golfers</td></tr>${others.map(r=>row(r)).join('')}`:''}
 <tr class="sep"><td colspan="5">${full?'Full field':'Leaders'}</td></tr></tbody></table>
 <div class="${full?'bscroll':''}" id="bscroll"><table>${COLG}<tbody>${show.map(r=>row(r,rows.indexOf(r)===lastIn)).join('')}</tbody></table></div>
 <div class="row"><span class="muted small">${live?'Updates every few seconds.':proj!==null?'':''}${proj!==null?' Dashed line: the projected cut. Top '+CUT+' and ties play the weekend.':''}</span><button class="btn sm" data-act="fullBoard">${full?'Show top 10':'Show all '+rows.length}</button></div></section>`;}
function boxHTML(b,e){return (isQ(e)&&e.status!=='final'?qfLiveHTML(b,e):'')+boardHTML(b,e);}
/* Quick-Fire: the bonus races so far (only holes already played) */
function qfLiveHTML(b,e){const P=b.players.filter(p=>p.managed),L=p=>p.live||{},aces=[];
  P.forEach(p=>(p.scores||[]).forEach((rd,ri)=>rd.forEach((s,h)=>{if(s===1)aces.push({p,ri,h});})));
  const top=(k,f)=>P.filter(p=>L(p)[k]>0).sort((a,c)=>L(c)[k]-L(a)[k]).slice(0,3).map((p,i)=>`<li class="${p.mine?'me':p.managed?'mine':''}"><span>${i+1}.</span> ${flagHTML(p.country)}${esc(p.name)}<b>${f(L(p)[k])}</b></li>`).join('');
  const dr=top('drive',v=>v+' yds'),gi=top('gir',v=>v),ud=top('ud',v=>v);
  return `<section class="qflive"><div class="qfcard"><h3>Long drive</h3><p class="muted small">${fmt$(S().qf_bonus)} bonus</p><ol>${dr||'<li class="muted">No drives yet from managers\u2019 golfers</li>'}</ol></div>
 <div class="qfcard"><h3>Greens hit</h3><p class="muted small">${fmt$(S().qf_bonus)} bonus for the most</p><ol>${gi||'<li class="muted">No greens yet from managers\u2019 golfers</li>'}</ol></div>
 <div class="qfcard"><h3>Up and downs</h3><p class="muted small">${fmt$(S().qf_bonus)} bonus for the most</p><ol>${ud||'<li class="muted">None yet</li>'}</ol></div>
 <div class="qfcard${aces.length?' hot':''}"><h3>Holes in one</h3><p class="muted small">${fmt$(S().qf_ace)} each</p><ol>${aces.length?aces.map(a=>`<li class="${a.p.mine?'me':a.p.managed?'mine':''}">${flagHTML(a.p.country)}${esc(a.p.name)}<b>R${a.ri+1} #${a.h+1}</b></li>`).join(''):'<li class="muted">None yet</li>'}</ol></div></section>`;}
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
  if(isQ(e)||isM(e)){const en=await SB.from('entries').select('golfer_id').eq('event_id',e.id).eq('status','in');const ids=(en.data||[]).map(x=>x.golfer_id);const gs=ids.length?await SB.from('golfers').select('id,name,country,college,stable,manager_id,sk,yr,tour').in('id',ids):{data:[]};const rows=(gs.data||[]).map(g=>({g,how:'Entered'}));rows.sort((a,b)=>ovr(b.g.sk)-ovr(a.g.sk));ui.preview={eid:e.id,rows};return;}
  const [gs,en]=await Promise.all([SB.from('golfers').select('id,name,country,college,stable,manager_id,sk,yr,enter_rule').eq('tour',e.tour).eq('retired',false).not('manager_id','is',null),SB.from('entries').select('golfer_id,status').eq('event_id',e.id)]);
  const st=new Map((en.data||[]).map(x=>[x.golfer_id,x.status]));
  const rows=(gs.data||[]).map(g=>{const s=st.get(g.id),auto=e.test||g.enter_rule==='all'||(g.enter_rule==='signature'&&['Signature','Finale'].includes(e.type));return{g,how:s==='in'?'Entered':s==='out'?null:auto?'Entered automatically':null};}).filter(r=>r.how);
  rows.sort((a,b)=>ovr(b.g.sk)-ovr(a.g.sk));ui.preview={eid:e.id,rows};}
function previewHTML(e){const P=ui.preview&&ui.preview.eid===e.id?ui.preview.rows:null;
  return `<section class="sec"><h2>The field so far</h2>${!P?'<p class="muted">Loading…</p>':!P.length?'<p class="muted">No managers\u2019 golfers are in yet.</p>':`<div class="scroll"><table class="tbl"><thead><tr><th>Golfer</th><th>Roster</th><th class="num">Overall</th></tr></thead><tbody>${P.map(r=>`<tr class="${r.g.manager_id===D.user.id?'me':'now'}"><td>${flagHTML(r.g.country)}${esc(r.g.name)}${ageTag(r.g.yr,r.g.tour)}${isCol(e.tour)?` <span class="muted small">${esc(r.g.college||'')}</span>`:''}${r.how==='Entered automatically'?' <span class="muted small">(auto)</span>':''}</td><td class="small">${esc(r.g.stable||'')}</td><td class="num">${Math.round(ovr(r.g.sk))}</td></tr>`).join('')}</tbody></table></div>`}
  <p class="muted small">${P?`${P.length} golfer${P.length===1?'':'s'} from managers\u2019 rosters so far. `:''}${isM(e)?'No tour regulars: only these golfers play.':`When entries close, tour regulars fill the rest of the ${FIELD} spots. Auto entries can still withdraw before then.`}</p></section>`;}
async function loadStand(t){const {data}=await SB.from('standings').select('pts,wins,earn,golfers(name,country,stable,manager_id,yr)').eq('tour',t).eq('season',D.world?D.world.season:1).order('pts',{ascending:false}).limit(200);ui.stand={t,rows:data||[]};if(ui.view==='standings')render();}

/* ---------- watching a golfer: the hole map, played on the clock ---------- */
// The server reveals each hole when it's reached on the clock. Live, we animate each new hole as it arrives;
// tapping a hole on the scorecard replays it.
const SCORE_NAMES={'-3':'Albatross','-2':'Eagle','-1':'Birdie','0':'Par','1':'Bogey','2':'Double bogey','3':'Triple bogey'};
const shotDur=s=>s.k==='full'?900+dist(s.from,s.to)*2.4:s.k==='chip'?800:s.k==='putt'?750:s.k==='drop'?350:500;
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
    if(A.phase==='shot'){const sh=A.cur.shots[A.si];A.t+=dt/shotDur(sh);if(A.t>=1){A.t=1;feedA(sh.text);A.trail.push(sh);A.phase='wait';A.w=0;}}
    else if(A.phase==='wait'){A.w+=dt;if(A.w>(A.cur.shots[A.si].holed?1000:750)){A.si++;if(A.si>=A.cur.shots.length){A.si=A.cur.shots.length-1;endHoleA();}else{A.phase='shot';A.t=0;}}}
    else if(A.phase==='post'){A.w+=dt;if(A.w>1700){A.phase='idle';if(A.live)syncAnim();}}
    drawMap(dt);
  }
  requestAnimationFrame(frame);}
function drawCourse(c,W,H,h,X,Y,Sc){
  c.fillStyle=MAP.tree;c.fillRect(0,0,W,H);
  c.fillStyle=MAP.dot;for(const t of h.trees){c.beginPath();c.arc(X(t[0]),Y(t[1]),Math.max(1.5,t[2]*Sc),0,6.3);c.fill();}
  c.lineCap='round';c.lineJoin='round';
  const path=pts=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));};
  c.strokeStyle=MAP.rough;c.lineWidth=2*h.tree*Sc;path(h.pts);c.stroke();
  c.fillStyle=MAP.rough;c.beginPath();c.arc(X(h.green[0]),Y(h.green[1]),h.tree*Sc,0,6.3);c.fill();
  const fp=[pointAt(h,h.fs0).p];for(let i=1;i<h.pts.length-1;i++)if(h.cum[i]>h.fs0&&h.cum[i]<h.fs1)fp.push(h.pts[i]);fp.push(pointAt(h,h.fs1).p);
  c.strokeStyle=MAP.fair;c.lineWidth=2*h.fw*Sc;path(fp);c.stroke();
  c.fillStyle=MAP.tee;c.fillRect(X(-5),Y(4),10*Sc,8*Sc);
  c.fillStyle=MAP.water;for(const w of h.water){c.beginPath();c.ellipse(X(w.x),Y(w.y),w.rx*Sc,w.ry*Sc,w.rot,0,6.3);c.fill();}
  c.fillStyle=MAP.fringe;c.beginPath();c.arc(X(h.green[0]),Y(h.green[1]),(h.gr+3)*Sc,0,6.3);c.fill();
  c.fillStyle=MAP.green;c.beginPath();c.arc(X(h.green[0]),Y(h.green[1]),h.gr*Sc,0,6.3);c.fill();
  c.fillStyle=MAP.sand;for(const b of h.sand){c.beginPath();c.arc(X(b.x),Y(b.y),b.r*Sc,0,6.3);c.fill();}
}
function drawFlag(c,px,py,u){c.strokeStyle='#10201a';c.lineWidth=Math.max(1.5,u*.14);c.beginPath();c.moveTo(px,py);c.lineTo(px,py-u*2.2);c.stroke();
  c.fillStyle='#e3b420';c.beginPath();c.moveTo(px,py-u*2.2);c.lineTo(px+u*1.3,py-u*1.75);c.lineTo(px,py-u*1.3);c.fill();}
function drawMap(dt){
  const A=ui.anim,cv=document.getElementById('cv');if(!cv||!A.h)return;const c=cv.getContext('2d'),W=cv.width,H=cv.height,h=A.h,shots=A.cur.shots,sh=shots[Math.min(A.si,shots.length-1)];
  const moving=A.phase==='shot',e=moving?1-Math.pow(1-A.t,2.2):1,ball=moving?lerp(sh.from,sh.to,e):sh.to;
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
  c.lineWidth=Math.max(1.5,u*.16);c.strokeStyle='rgba(255,255,255,.6)';c.setLineDash([u*.6,u*.5]);
  for(const s of A.trail){if(s.k==='drop'||s.k==='pick')continue;c.beginPath();c.moveTo(X(s.from[0]),Y(s.from[1]));c.lineTo(X(s.to[0]),Y(s.to[1]));c.stroke();}
  if(moving&&sh.k!=='drop'){c.beginPath();c.moveTo(X(sh.from[0]),Y(sh.from[1]));c.lineTo(X(ball[0]),Y(ball[1]));c.stroke();}
  c.setLineDash([]);
  if(sunk){if(hw<1){c.fillStyle=`rgba(255,255,255,${Math.min(1,2.2*(1-hw))})`;c.font=`700 ${Math.round(u*1.5)}px 'Barlow Condensed','Arial Narrow',sans-serif`;c.textAlign='center';
      c.strokeStyle=`rgba(16,32,26,${Math.min(1,2.2*(1-hw))})`;c.lineWidth=u*.3;const ty=Math.max(u*2,py-u*3.4-hw*u);c.strokeText('IN THE HOLE',px,ty);c.fillText('IN THE HOLE',px,ty);}
    return;}
  const air=moving&&sh.k!=='putt'&&sh.k!=='drop'?Math.sin(Math.PI*A.t):0,lift=air*Math.min(H*.09,dist(sh.from,sh.to)*Sc*.16);
  const drop=holed&&A.t>.88?Math.max(0,1-(A.t-.88)/.12):1,br=u*.42*(1+air*.7)*drop;
  const bx=X(ball[0]),by=Y(ball[1]);if(br<=.2)return;
  const mineG=D.golfers.find(g=>g.id===ui.watch);
  c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(bx+lift*.3,by+u*.12,br,br*.6,0,0,6.3);c.fill();
  c.fillStyle='#fff';c.strokeStyle=mineG?COLORS[mineG.color]||'#222':'#222';c.lineWidth=Math.max(1.5,u*.16);c.beginPath();c.arc(bx,by-lift,br,0,6.3);c.fill();c.stroke();
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
<p>Every skill has a hidden <b>ceiling</b>. The scouts' grades hint at it, and gains shrink as he gets close. Areas he doesn't work on get slightly rusty each day. Tired golfers train and play worse, and every event costs some stamina.</p>
<p><b>Standing orders</b> spend a session he didn't use by midnight, so a golfer keeps improving even on days you don't log in.</p></section>

<section class="sec gsec"><h2>What each skill does</h2><p class="muted">Ratings run up to 99. Green is 75 and up, yellow 60 to 74, red 59 and below.</p><div class="gskills"><div><h3>Short game</h3><dl><dt>Full wedges</dt><dd>Sharper approaches from inside about 125 yards.</dd><dt>Pitches</dt><dd>Gets it close from 20 to 45 yards out.</dd><dt>Chips</dt><dd>Saves strokes when he misses a green.</dd><dt>Bunker shots</dt><dd>Gets him out of greenside sand and near the hole.</dd><dt>Short putts</dt><dd>Holes the ones inside ten feet.</dd><dt>Lag putts</dt><dd>Leaves long putts close, so fewer three-putts.</dd></dl></div><div><h3>Irons</h3><dl><dt>Accuracy</dt><dd>Keeps approach shots on line with the flag.</dd><dt>Distance control</dt><dd>Finishes approaches pin-high instead of short or long.</dd><dt>Wind performance</dt><dd>Holds his iron shots steady when it blows.</dd></dl></div><div><h3>Long game</h3><dl><dt>Power</dt><dd>More yards off the tee, so shorter clubs into greens.</dd><dt>Accuracy</dt><dd>Finds more fairways and stays out of trouble.</dd></dl></div><div><h3>Miscellaneous</h3><dl><dt>Mental game</dt><dd>Keeps a bad hole from turning into a bad round.</dd><dt>Momentum</dt><dd>Lets a good run grow into a hot streak.</dd><dt>Wind performance</dt><dd>Helps his driver, wedges and touch shots when it\u2019s windy.</dd><dt>Attitude</dt><dd>Helps him bounce back and get more out of the range.</dd><dt>Clutchness</dt><dd>Raises his game under pressure, late on Sunday and on the cut line.</dd><dt>Intelligence</dt><dd>Better decisions: when to attack, when to play safe and which club to hit.</dd></dl></div></div></section>

<section class="sec gsec"><h2>Events</h2>
<p>Enter golfers by hand, or set an automatic rule for each one (every event, or only the big ones). Entries close <b>${s.deadline_min} minutes</b> before the start, then the field is set: managers' golfers first, then tour regulars, ${FIELD} in all.</p>
<p>Four rounds. After two, the top ${CUT} and ties make the <b>cut</b>. Finishing positions earn prize money and <b>season points</b>. After Sunday's Finale the standings decide promotion and relegation and pay a bonus to the leaders: half a standard purse for the winner, then smaller bonuses down to the top ${Z}.</p>
<p><b>Quick-Fire Opens</b> run every ${s.qf_every_min} minutes, all day, one for each level: juniors, college, each pro tour and each senior tour. They're two rounds with no cut and cost ${fmt$(s.qf_fee)} to enter. Each pot is scaled like its main tour, from ${fmt$(qfBase('jr'))} for juniors and ${fmt$(qfBase('col'))} for college up to ${fmt$(qfBase('p1'))} on the ${TOURS.p1.name}, and grows with every entry, and the top third of the field get paid. There are bonuses for most greens hit, most up and downs (on the green from 40 yards or closer, then one putt), the long drive and holes in one, for managers' golfers only. They don't tire golfers or count toward their career.</p>
<p><b>Match Play</b> runs alongside them, one bracket per level: head to head over nine holes, with sudden death if it's tied, and the winner moves on until one golfer is left. Only managers' golfers play, and it needs at least two rosters to go ahead. Entry is ${fmt$(s.mp_fee)} (${fmt$(s.mp_fee_jr)} for juniors); the pot is a guaranteed ${fmt$(s.mp_base)} at college level, scaled like the main tours, plus every entry fee. The champion takes 40%, the runner-up 20%, and the semifinalists and quarterfinalists share the rest.</p></section>

<section class="sec gsec"><h2>Retirement and coaching</h2>
<p>A retired golfer becomes a <b>coach</b> rated in four areas: short game, irons, long game and the head. Coaching talent is partly luck, but the better he played, the higher his floor: a former ${TOURS.p1.name} winner is never a bad coach.</p>
<div class="gfacts">
 <div><b>×${s.coach_max}</b><span>The most a great coach multiplies a range session by, in his best area.</span></div>
 <div><b>${s.lessons_per_day} a day</b><span>Lessons each coach gives, shared across every manager. Good coaches book up.</span></div>
 <div><b>Free</b><span>Lessons from your own retired golfers, for your own roster.</span></div>
 <div><b>You set it</b><span>The fee other managers pay to book your coaches. Other managers book him for their golfers' sessions, and the fees come to you.</span></div>
</div>
<p>Pick a coach for any golfer on his Roster page. Booking is per session: if the coach is full that day, your golfer trains alone.</p></section>

<section class="sec gsec"><h2>Money and the market</h2>
<p>New rosters start with ${fmt$(s.start_cash)} and up to ${s.max_golfers} active golfers. Signing a junior costs ${fmt$(s.recruit_cost)}. Money comes from prize money, season bonuses, NIL deals, coaching fees and sales. It goes on signings, entry fees, lessons and equipment (${EQC.map(fmt$).join(', ')} for each upgrade).</p>
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
function quickBoard(t){const showQ=t==='all'||t===QF,showM=t==='all'||t===MP;if(!showQ&&!showM)return '';
  const L=['jr','col','p3','p2','p1','c2','c1'],kinds=[showQ&&{k:'q',is:isQ,name:'Quick-Fire'},showM&&{k:'m',is:isM,name:'Match Play'}].filter(Boolean);
  const nextOf=K=>{const q=D.events.filter(e=>K.is(e)&&phase(e)==='open')[0];return q?D.events.filter(e=>K.is(e)&&e.starts_at===q.starts_at):[];};
  const nowOf=K=>D.events.filter(e=>K.is(e)&&e.status!=='final'&&['live','closed'].includes(phase(e)));
  kinds.forEach(K=>{K.next=nextOf(K);K.now=nowOf(K);});if(!kinds.some(K=>K.next.length||K.now.length))return '';
  const lvs=L.filter(lv=>kinds.some(K=>K.next.concat(K.now).some(e=>e.tour.slice(3)===lv)));
  const short=lv=>lvName(lv).replace(/ Tour$/,'');
  const cell=(K,lv)=>{const nx=K.next.find(e=>e.tour.slice(3)===lv),lv2=K.now.filter(e=>e.tour.slice(3)===lv).pop();
    let h='';if(nx){const can=mine().filter(g=>canPlay(nx,g)),inn=can.filter(g=>{const x=entryOf(nx,g);return x&&x.status==='in';}).length;
      h+=`<button class="btn xs${can.length&&!inn?' primary':''}${inn?' on':''}" data-act="board" data-v="${nx.id}" title="${esc(lvName(lv))} ${K.name}, ${when(nx.starts_at)}">${inn?`In: ${inn}`:can.length?'Enter':'Field'}</button>`;}
    if(lv2){const mineN=mine().filter(g=>{const x=entryOf(lv2,g);return x&&x.status==='in';}).length;
      h+=`<button class="btn xs qlive${mineN?' mine':''}" data-act="board" data-v="${lv2.id}" title="Playing now"><i></i>${phase(lv2)==='closed'?'Soon':'Live'}</button>`;}
    return `<td>${h||'<span class="muted">–</span>'}</td>`;};
  const head=K=>{const nx=K.next[0];return `<th>${K.name}<small>${nx?`Next ${when(nx.starts_at).replace(' ET','')}, closes in ${until(new Date(deadline(nx)).toISOString())}`:'None open'}</small></th>`;};
  return `<section class="sec qfban qboard"><div class="qhead"><h2>Quick events</h2><p class="eyebrow">Every ${S().qf_every_min} minutes, all day</p></div>
 <div class="scroll"><table class="qtbl"><thead><tr><th>Level</th>${kinds.map(head).join('')}</tr></thead><tbody>
 ${lvs.map(lv=>`<tr><th scope="row">${esc(short(lv))}</th>${kinds.map(K=>cell(K,lv)).join('')}</tr>`).join('')}
 </tbody></table></div>
 <p class="muted small">Enter takes you to the next one at that level; Live opens the one being played now (gold when one of yours is in it).</p>
 <details class="qhow"><summary>How they work</summary>
 ${showQ?`<p><b>Quick-Fire Open.</b> Two rounds, no cut, about ${Math.round(2*S().round_min)} minutes. ${fmt$(S().qf_fee)} to enter; each level's pot is scaled like the main tours (${fmt$(qfBase('col'))} for college) and grows ${fmt$(S().qf_add)} with every entry. The top third of the field get paid. ${fmt$(S().qf_bonus)} each for most greens hit, most up and downs (on the green from 40 yards or closer, then one putt) and the long drive, and ${fmt$(S().qf_ace)} for a hole in one. Only managers’ golfers can win the bonuses. It doesn't tire your golfers.</p>`:''}
 ${showM?`<p><b>Match Play.</b> Head to head, nine holes a match, knockout until one golfer is left; a tie after nine goes to sudden death, and the beaten semifinalists play for third. Only managers' golfers play, and it only goes ahead if at least two rosters enter. ${fmt$(S().mp_fee)} to enter (${fmt$(S().mp_fee_jr)} for juniors). The pot is a guaranteed amount (${fmt$(mpBase('col'))} for college) plus every entry fee, and most of it goes to the deep runs.</p>`:''}
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
function mpPayHTML(e){const n=ui.preview&&ui.preview.eid===e.id?ui.preview.rows.length:0,base=mpBase(e.tour.slice(3));
  const k=ui.mpIf&&ui.mpIf.eid===e.id?ui.mpIf.n:Math.max(2,n),pot=base+e.fee*k;
  const opts=[...new Set([Math.max(2,n),4,8,16,32])].filter(x=>x>=Math.max(2,n)).sort((a,c)=>a-c);
  return `<section class="sec paysec"><h2>Prize money</h2>
 <p class="small"><b>Pot ${fmt$(base+e.fee*n)} right now</b>: ${fmt$(base)} guaranteed plus ${fmt$(e.fee)} for each of the ${n} entr${n===1?'y':'ies'}. Every new entry adds ${fmt$(e.fee)}.</p>
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
function mpView(e){const b=ui.mpb&&ui.mpb.event&&ui.mpb.event.id===e.id?ui.mpb:null;if(!b){loadMp().then(()=>{if(ui.view==='board')render();});return '<section class="sec"><p class="muted">Loading the bracket…</p></section>';}
  if(b.err)return `<section class="sec"><p class="muted">${esc(b.err)}</p></section>`;
  if(!(b.rounds||[]).length)return `<section class="teebox"><p class="eyebrow">Entries are closed</p><h2>Drawing the bracket</h2><div class="teeclock" id="teeClock" data-at="${e.starts_at}">${clockTxt(e.starts_at)}</div></section>`;
  if(!ui.mpw&&!ui.mpwAuto){ui.mpwAuto=1;const k=mpMineLive(b);if(k){ui.mpw=k;setTimeout(()=>loadMp().then(mpPoll),50);}}
  return `<div id="mpTop" data-fin="${b.event.status==='final'?1:0}">${mpTopHTML(b,e)}</div>${mpWatchHTML(b,e)}<div id="mpBracket">${mpBracketHTML(b,e)}</div>`;}
// a live match with one of your golfers in it, to open on arrival
function mpMineLive(b){const P=b.players||{};for(let r=b.rounds.length-1;r>=0;r--){const R=b.rounds[r],all=R.m.map((x,i)=>[x,`${r}:${i}`]).concat(R.third?[[R.third,`${r}:t`]]:[]);
  for(const [x,k] of all)if(x.a&&x.b&&!x.over&&((P[x.a]||{}).mine||(P[x.b]||{}).mine))return k;}return null;}
function mpTopHTML(b,e){const P=b.players||{},fin=b.event.status==='final',started=Date.now()>=Date.parse(b.event.starts_at);
  if(!started&&!fin)return `<section class="teebox"><p class="eyebrow">The bracket is drawn</p><h2>Tees off in</h2><div class="teeclock" id="teeClock" data-at="${e.starts_at}">${clockTxt(e.starts_at)}</div><p class="muted">${Object.keys(P).length} golfers. Pot ${fmt$(b.event.purse)}.</p></section>`;
  if(fin)return mpResultsHTML(b,e);
  return `<details class="sec mppaybox"><summary>Prize money: pot ${fmt$(b.event.purse)}, ${Object.keys(P).length} golfers</summary>${mpPlanTable(Object.keys(P).length,b.event.purse)}</details>`;}
function mpResultsHTML(b,e){const P=b.players||{},ids=Object.keys(P),tl=e.tour.slice(3)==='col'?'col0':e.tour.slice(3);
  let pl=b.places;if(!pl){pl=Object.keys(b.pay||{}).sort((x,y)=>b.pay[y]-b.pay[x]).map((id,i)=>({id,place:id===b.champ?'1st':i===1?'2nd':'T3',amt:b.pay[id]}));}
  const paid=new Set(pl.map(x=>x.id)),R=b.rounds;
  const outIn=id=>{for(let r=0;r<R.length;r++){if(R[r].m.some(x=>x.b!==null&&x.a&&x.b&&(x.w?x.a:x.b)===id))return r;}return -1;};
  const rest=ids.filter(id=>!paid.has(id)).map(id=>({id,r:outIn(id)})).sort((x,y)=>y.r-x.r);
  const rn=r=>{const k=R[r].m.length;return k===1?'the final':k===2?'the semifinals':k===4?'the quarterfinals':`round ${r+1}`;};
  const fm=R[R.length-1].m[0],fin=fm&&fm.res?`beat ${esc(P[fm.w?fm.a:fm.b].name)} ${esc(fm.res)} in the final`:'';
  const c=pl[0],cp=P[c.id];
  const who=id=>`${flagHTML(P[id].country)}${esc(P[id].name)}${ageTag(P[id].yr,tl)}<small class="sch">${esc(P[id].stable||'')}</small>`;
  const step=(x,k)=>x?`<div class="pod p${k}"><div class="pname">${flagHTML(P[x.id].country)}${esc(P[x.id].name)}</div><div class="psub">${esc(P[x.id].stable||'')}</div><div class="pblock"><b>${x.place}</b><span>${fmt$(x.amt)}</span></div></div>`:'';
  const mineWon=pl.filter(x=>P[x.id].mine).reduce((a,x)=>a+x.amt,0),mineN=ids.filter(id=>P[id].mine).length;
  return `<section class="podium-wrap"><p class="eyebrow">Final · pot ${fmt$(b.event.purse)}</p><h2 class="champ">${flagHTML(cp.country)}${esc(cp.name)} wins ${fmt$(c.amt)}</h2>
 <p class="lede">${esc(cp.stable||'')}'s golfer ${fin}.</p>
 <div class="podium">${step(pl[1],2)}${step(pl[0],1)}${step(pl[2],3)}</div>
 ${mineN?`<p class="mpyou">${mineWon?`Your golfers won <b>${fmt$(mineWon)}</b> between them.`:'None of your golfers reached the paying places this time.'}</p>`:''}
 <h3>Results and prize money</h3>
 <div class="scroll"><table class="tbl mpres"><thead><tr><th>Place</th><th>Golfer</th><th class="num">Prize</th></tr></thead><tbody>
 ${pl.map(x=>`<tr class="${P[x.id].mine?'me':''}"><td><b>${x.place}</b></td><td>${who(x.id)}</td><td class="num"><b>${fmt$(x.amt)}</b></td></tr>`).join('')}
 ${rest.map(x=>`<tr class="nopay${P[x.id].mine?' me':''}"><td>Out</td><td>${who(x.id)}<small class="sch">Lost in ${x.r>=0?rn(x.r):'the first round'}</small></td><td class="num">$0</td></tr>`).join('')}
 </tbody></table></div></section>`;}
function mpBracketHTML(b,e){const P=b.players||{},R=b.rounds||[],tl=e.tour.slice(3)==='col'?'col0':e.tour.slice(3);
  const nm=id=>{const p=P[id];return p?`${flagHTML(p.country)}${esc(p.name)}${ageTag(p.yr,tl)}`:'';};
  const st=id=>P[id]?`<small class="sch">${esc(P[id].stable||'')}</small>`:'';
  const rname=r=>{const k=R[r].m.length;return k===1?'Final':k===2?'Semifinals':k===4?'Quarterfinals':`Round ${r+1}`;};
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
<p class="muted small">Each dot is a hole: gold for the top golfer, blue for the bottom one, grey for a half. Holes appear as they're played, about one every ${Math.round(b.T)} seconds. Tap Watch to follow a match shot by shot.</p>`;}

/* ---------- Match Play: watching one match on the hole map ---------- */
function mpWatchHTML(b,e){const k=ui.mpw,x=mpGet(b,k);if(!x||!x.a||!x.b)return '';const P=b.players||{},M=ui.ma&&ui.ma.key===k?ui.ma:{};
  const chip=(id,side)=>`<div class="mpchip s${side}"><i class="sw s${side}"></i><span>${flagHTML(P[id].country)}<b>${esc(P[id].name)}</b><small>${esc(P[id].stable||'')}</small></span></div>`;
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
  <p class="muted small">Gold is ${esc(P[x.a].name)}, blue is ${esc(P[x.b].name)}. The golfer farther from the hole plays first. Tap a hole on the card to replay it.</p>
 </div></section>`;}
// the order the shots are played on one hole: tee shots by honour, then whoever is farther from the flag
function mpOrder(SA,SB,h,honor){const S=[SA||[],SB||[]],idx=[0,0],out=[],pos=[(S[0][0]||{from:[0,0]}).from,(S[1][0]||{from:[0,0]}).from];
  while(idx[0]<S[0].length||idx[1]<S[1].length){let p;
    if(idx[honor]===0&&S[honor].length)p=honor;else if(idx[1-honor]===0&&S[1-honor].length)p=1-honor;
    else{const left=[0,1].filter(i=>idx[i]<S[i].length);p=left.length===1?left[0]:dist(pos[0],h.pin)>=dist(pos[1],h.pin)?0:1;}
    do{const sh=S[p][idx[p]++];out.push({p,sh});pos[p]=sh.to;if(!(sh.k==='drop'||sh.k==='pick'))break;}while(idx[p]<S[p].length);}
  return out;}
const mWait=sh=>sh.holed?1000:750;
function mpBegin(i,first){const M=ui.ma,b=ui.mpb,e=b.event,x=mpGet(b,M.key),sh=ui.mps&&ui.mps.key===M.key?ui.mps.s[i]:null;if(!x||!sh)return;
  const hole=COURSES[e.ci].holes[i%18],prev=i?x.h[i-1]:null,P=b.players;
  let honor=0;for(let j=i-1;j>=0;j--){const [p,q]=x.h[j];if(p!==q){honor=p<q?0:1;break;}}
  M.i=i;M.h=hole;M.seq=mpOrder(sh[0],sh[1],hole,honor);M.si=0;M.t=0;M.w=0;M.cam=null;M.trail=[[],[]];M.holed=[false,false];
  M.pos=[(sh[0][0]||{from:[0,0]}).from,(sh[1][0]||{from:[0,0]}).from];M.phase=M.seq.length?'shot':'post';
  const tot=M.seq.reduce((a,q)=>a+shotDur(q.sh)+mWait(q.sh),0)+1700;M.fit=Math.max(1,tot/(0.85*(b.T||16)*1000));
  if(first){M.shown=i-1;M.feed=[];}
  mFeed(`Hole ${i+1}${i>=9?' (sudden death)':''}. Par ${hole.par}, ${hole.len} yards. ${esc(lastName(P[honor?x.b:x.a].name))} has the honour.`,'big');mHUD();mSide();}
function mFeed(text,cls,side){const M=ui.ma;M.feed.push({text,cls:cls||'',side});if(M.feed.length>7)M.feed.shift();mPaintFeed();}
function mPaintFeed(){const M=ui.ma,el=document.getElementById('mFeed');
  if(M&&el)el.innerHTML=M.feed.map((q,i)=>`<p class="${q.cls}${q.side!==undefined?' s'+q.side:''}${i===M.feed.length-1?' now':''}">${q.side!==undefined?`<i class="sw s${q.side}"></i>`:''}${q.text}</p>`).join('');}
function mHUD(){const M=ui.ma;if(!M||!M.h)return;const t=document.getElementById('mHole');if(!t)return;t.textContent=`Hole ${M.i+1}`;document.getElementById('mMeta').textContent=`Par ${M.h.par}, ${M.h.len} yards`;
  const w=ui.mpb&&ui.mpb.wind,wa=document.getElementById('windArrow');if(w&&wa)wa.style.transform=`rotate(${w.dir}rad)`;}
function mEndHole(){const M=ui.ma,b=ui.mpb,x=mpGet(b,M.key),P=b.players;if(!x)return;const [s1,s2]=x.h[M.i]||[];
  if(s1!==undefined){const A=esc(lastName(P[x.a].name)),B=esc(lastName(P[x.b].name)),d=mpDiff(x.h,M.i+1),n=M.i+1;
    const won=s1<s2?0:s2<s1?1:-1;
    mFeed(won<0?`Halved in ${s1}s. ${d===0?`All square thru ${n}`:`${d>0?A:B} ${Math.abs(d)} up thru ${n}`}.`:`${won?B:A} wins the hole, ${Math.min(s1,s2)} to ${Math.max(s1,s2)}. ${d===0?`All square thru ${n}`:`${d>0?A:B} ${Math.abs(d)} up thru ${n}`}.`,'big',won<0?undefined:won);
    if(x.over&&M.i===x.h.length-1)mFeed(`${esc(P[x.w?x.b:x.a].name)} wins the match ${esc(x.res)}.`,'big win',x.w);}
  M.phase='post';M.w=0;M.shown=Math.max(M.shown??-1,M.i);mSide();}
function mCardHTML(){const M=ui.ma,b=ui.mpb,x=mpGet(b,M.key),P=b.players,e=b.event;if(!x)return '';
  const holes=COURSES[e.ci].holes,n=Math.max(9,x.h.length),vis=M.live?(M.shown??-1)+1:x.h.length,cols=[...Array(n).keys()];
  const cell=(i,side)=>{if(i>=vis||!x.h[i])return '<td></td>';const [s1,s2]=x.h[i],s=side?s2:s1,o=side?s1:s2,d=s-holes[i%18].par,on=M.i===i;
    return `<td class="${d<=-2?'eg':d===-1?'bd':d===1?'bg':d>=2?'db':''}${s<o?' won s'+side:''}" data-act="mHole" data-v="${i}" style="cursor:pointer${on?';outline:2px solid var(--flag)':''}"><s>${s}</s></td>`;};
  const stat=i=>{if(i>=vis||!x.h[i])return '<td></td>';const d=mpDiff(x.h,i+1);return d===0?'<td class="mst">AS</td>':`<td class="mst s${d>0?0:1}">${Math.abs(d)}<small>up</small></td>`;};
  return `<div class="scroll"><table class="card mpcard"><tr><th>Hole</th>${cols.map(i=>`<th>${i+1}</th>`).join('')}</tr>
  <tr><td>Par</td>${cols.map(i=>`<td>${holes[i%18].par}</td>`).join('')}</tr>
  <tr class="pa"><td><i class="sw s0"></i>${esc(lastName(P[x.a].name))}</td>${cols.map(i=>cell(i,0)).join('')}</tr>
  <tr class="pb"><td><i class="sw s1"></i>${esc(lastName(P[x.b].name))}</td>${cols.map(i=>cell(i,1)).join('')}</tr>
  <tr><td>Match</td>${cols.map(stat).join('')}</tr></table></div>`;}
function mSide(){const M=ui.ma,el=document.getElementById('mCard');if(!M||!el)return;el.innerHTML=mCardHTML();
  const b=ui.mpb,x=mpGet(b,M.key),st=document.getElementById('mStat');
  if(x&&st){const vis=M.live?(M.shown??-1)+1:x.h.length,d=mpDiff(x.h,vis),P=b.players;
    st.innerHTML=x.over&&vis>=x.h.length?`<b class="s${x.w}">${esc(lastName(P[x.w?x.b:x.a].name))} wins ${esc(x.res)}</b>`:d===0?`<b>${vis?'All square':'All square'}</b><small>${vis?`thru ${vis}`:'first tee'}</small>`:`<b class="s${d>0?0:1}">${Math.abs(d)} up</b><small>${esc(lastName(P[d>0?x.a:x.b].name))} thru ${vis}</small>`;}
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
    if(M.phase==='shot'){M.t+=dt/shotDur(q.sh);if(M.t>=1){M.t=1;mFeed(esc(q.sh.text),'',q.p);if(q.sh.k!=='drop'&&q.sh.k!=='pick')M.trail[q.p].push(q.sh);M.pos[q.p]=q.sh.to;if(q.sh.holed)M.holed[q.p]=true;M.phase='wait';M.w=0;}}
    else if(M.phase==='wait'){M.w+=dt;if(M.w>mWait(q.sh)){M.si++;if(M.si>=M.seq.length){M.si=M.seq.length-1;mEndHole();}else{M.phase='shot';M.t=0;}}}
    else if(M.phase==='post'){M.w+=dt;if(M.w>1700){M.phase='idle';if(M.live)mpSync();}}}
  else if(M.phase==='post'){M.w+=dt;if(M.w>1700){M.phase='idle';if(M.live)mpSync();}}
  mDraw(dt);requestAnimationFrame(mFrame);}
function mDraw(dt){const M=ui.ma,cv=document.getElementById('mcv');if(!cv||!M.h)return;const c=cv.getContext('2d'),W=cv.width,H=cv.height,h=M.h;
  const q=M.seq&&M.seq.length?M.seq[Math.min(M.si,M.seq.length-1)]:null,moving=!!q&&M.phase==='shot',ez=moving?1-Math.pow(1-M.t,2.2):1;
  const focus=q?(moving?q.sh.from:q.sh.to):[0,0],nearG=M.pos?[0,1].every(p=>M.holed[p]||dist(M.pos[p],h.green)<=52)&&dist(focus,h.green)<=52:false;
  const tgt=camFor({h},nearG,cv);if(!M.cam)M.cam=tgt;else{const k=1-Math.exp(-(dt||16)/260);M.cam={x:M.cam.x+(tgt.x-M.cam.x)*k,y:M.cam.y+(tgt.y-M.cam.y)*k,s:M.cam.s+(tgt.s-M.cam.s)*k};}
  const cam=M.cam,X=v=>(v-cam.x)*cam.s+W/2,Y=v=>H/2-(v-cam.y)*cam.s,Sc=cam.s,u=Math.max(W/55,5);
  drawCourse(c,W,H,h,X,Y,Sc);
  const px=X(h.pin[0]),py=Y(h.pin[1]);c.fillStyle='#10201a';c.beginPath();c.arc(px,py,Math.max(2.5,.45*Sc),0,6.3);c.fill();drawFlag(c,px,py,u);
  // tracers: a dark edge under each golfer's colour so both read on grass, sand and water
  const seg=(s,to,col)=>{c.beginPath();c.moveTo(X(s.from[0]),Y(s.from[1]));c.lineTo(X(to[0]),Y(to[1]));c.strokeStyle='rgba(16,32,26,.55)';c.lineWidth=Math.max(3,u*.34);c.stroke();c.strokeStyle=col;c.lineWidth=Math.max(2,u*.2);c.stroke();};
  c.lineCap='round';
  if(M.trail)for(const p of [0,1])for(const s of M.trail[p])seg(s,s.to,MPC[p]);
  let ball=null;if(moving&&q.sh.k!=='drop'&&q.sh.k!=='pick'){ball=lerp(q.sh.from,q.sh.to,ez);seg(q.sh,ball,MPC[q.p]);}
  if(!M.pos)return;
  for(const p of [0,1]){if(M.holed[p]&&!(moving&&q.p===p))continue;const at=moving&&q.p===p?(ball||q.sh.from):M.pos[p];
    const air=moving&&q.p===p&&q.sh.k!=='putt'&&q.sh.k!=='drop'?Math.sin(Math.PI*M.t):0,lift=air*Math.min(H*.09,dist(q.sh.from,q.sh.to)*Sc*.16);
    const drop=moving&&q.p===p&&q.sh.holed&&M.t>.88?Math.max(0,1-(M.t-.88)/.12):1,br=u*.42*(1+air*.7)*drop;if(br<=.2)continue;
    const bx=X(at[0]),by=Y(at[1]);c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(bx+lift*.3,by+u*.12,br,br*.6,0,0,6.3);c.fill();
    c.fillStyle='#fff';c.strokeStyle=MPC[p];c.lineWidth=Math.max(2,u*.22);c.beginPath();c.arc(bx,by-lift,br,0,6.3);c.fill();c.stroke();}
  if(q&&q.sh.holed&&M.phase==='wait'&&M.w<1000){const hw=M.w/1000;c.strokeStyle=MPC[q.p];c.globalAlpha=1-hw;c.lineWidth=Math.max(2,u*.22);c.beginPath();c.arc(px,py,u*(.6+hw*3.2),0,6.3);c.stroke();c.globalAlpha=1;}}
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
  return `<p class="muted small">How high the scouts think he can go in each area (A is the highest), with his rating now. They're right most of the time.</p><div class="gfacts">${'smlx'.split('').map(u=>`<div><b class="grade g${R[u].grade}">${R[u].grade}</b><span><b style="font-size:.95rem">${UMB[u]}</b><br>Now ${Math.round(um(g.sk,u))}</span></div>`).join('')}</div>`;}
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
${g.ask&&!mineG?`<section class="sec"><div class="row" style="justify-content:flex-start;flex-wrap:wrap;gap:12px"><b style="font-size:1.3rem">${fmt$(g.ask)}</b><span class="muted">Market value ${fmt$(val)}. ${g.ask/val<.93?'Priced under value.':g.ask/val>1.1?'Priced over value.':'A fair price.'}</span><button class="btn primary sm" data-act="buy" data-v="${g.id}" ${full||D.me.cash<g.ask||ui.busy?'disabled':''}>Sign him for ${fmt$(g.ask)}</button></div>${flash()}${ui.msg?`<p class="hand">${esc(ui.msg)}</p>`:''}</section>`:''}
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
  if(a==='board'){ui.mpb=null;ui.mpw=null;ui.ma=null;ui.mps=null;ui.mpwAuto=0;ui.mpIf=null;ui.view='board';ui.ev=v;ui.board=null;ui.watch=null;ui.full=false;ui.preview=null;render();window.scrollTo(0,0);const e=D.events.find(x=>x.id===v);if(e&&phase(e)==='open')loadPreview(e).then(render);loadBoard().then(render);return;}
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
  if(a==='buy')return act('buy',{id:v});
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
    if(e&&isM(e)&&phase(e)!=='open'){loadMp().then(mpPoll);return;}
    if(e&&phase(e)==='open'){(Date.now()%15000<5000?loadPreview(e):Promise.resolve()).then(()=>{const a=document.activeElement;if(!(a&&a.tagName==='SELECT'))keepScroll(render);});return;}
    const was=ui.board&&ui.board.event&&ui.board.event.status,hadPlayers=ui.board&&ui.board.players&&ui.board.players.length;
    loadBoard().then(()=>{const a=document.activeElement;if(a&&a.tagName==='SELECT')return;const e2=evNow(),bb=document.getElementById('boardBox');
      const changed=!ui.board||ui.board.event.status!==was||!hadPlayers;
      if(bb&&ui.board&&e2&&!changed){keepScroll(()=>{bb.innerHTML=boxHTML(ui.board,e2);});paintSide();}
      else{if(e2&&ui.board&&ui.board.event.status==='final'){const d=D.events.find(x=>x.id===ui.ev);if(d)d.status='final';}render();}});},5000);
}else document.getElementById('view').innerHTML='<p class="lede">Couldn’t load the game. Refresh to try again.</p>';
window.addEventListener('resize',()=>{if(document.getElementById('cv'))fitCanvas();if(document.getElementById('mcv'))mFit();});
