/* Range Rat online. Helpers shared with the solo game come first. */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS=['#c2362a','#1f5fa8','#e08a1a','#6b3fa0','#16806a','#333c44','#b81d6e','#0f8a9e','#7a5c1e','#5d8f1c','#d9577c','#0d1114'];
const MAP={tree:'#24492f',dot:'#1b3a25',rough:'#3d7848',fair:'#6dac5a',fringe:'#86c06a',green:'#a3d67f',sand:'#eadca6',water:'#3c8cbd',tee:'#8cc474'};
const COUNTRIES={US:'United States',AR:'Argentina',AU:'Australia',BR:'Brazil',CA:'Canada',CL:'Chile',CN:'China',CO:'Colombia',CZ:'Czechia',DK:'Denmark',ENG:'England',FI:'Finland',FR:'France',DE:'Germany',IN:'India',IE:'Ireland',IT:'Italy',JP:'Japan',MX:'Mexico',NL:'Netherlands',NZ:'New Zealand',NG:'Nigeria',NO:'Norway',PL:'Poland',SCO:'Scotland',ZA:'South Africa',KR:'South Korea',ES:'Spain',SE:'Sweden',TH:'Thailand'};
const EQN={s:'Wedges and putter',m:'Irons',l:'Driver and woods'},EQL=['Stock','Fitted','Tour issue','Prototype'],EQC=[8000,40000,200000];
const TROPHY=[{n:'Trophy shelf'},{n:'Trophy room',c:40000,d:'Lists every win.'},{n:'Hall of champions',c:400000,d:'Adds season titles and stable records.'}];
const RIVALS=['Dunmore Golf Group','Halcyon Sports','Ironwood Academy','Bayshore Stable','Tenth Tee Management','Old Orchard Golf'];
function flag(c){
  if(c==='ENG'||c==='SCO')return String.fromCodePoint(0x1F3F4,...[...(c==='ENG'?'gbeng':'gbsct')].map(ch=>0xE0000+ch.charCodeAt(0)),0xE007F);
  return String.fromCodePoint(...[...c].map(ch=>0x1F1E6+ch.charCodeAt(0)-65));
}
const flagHTML=c=>`<span class="flag" title="${COUNTRIES[c]||c}">${flag(c||'US')}</span>`;
const fmtPar=n=>n===0?'E':n>0?'+'+n:'−'+Math.abs(n);
const fmt1=n=>(n>0?'+':n<0?'−':'')+Math.abs(n).toFixed(1);
const fmtPts=n=>(Math.round(n*10)/10).toLocaleString();
const fmt$=n=>(n<0?'−':'')+'$'+Math.abs(Math.round(n)).toLocaleString();
const initials=n=>n.trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
const ord=n=>n+(n%100>10&&n%100<14?'th':['th','st','nd','rd'][n%10]||'th');
const posWords=(pos,posN)=>(pos[0]==='T'?'tied ':'')+ord(posN);
const moodWord=m=>m>.5?'Locked in':m>.2?'Confident':m>-.2?'Steady':m>-.5?'Frustrated':'Rattled';
const fatigueWord=f=>f<25?'Fresh':f<50?'Working hard':f<75?'Tired':'Running on fumes';
const confWord=c=>c>=2?'Sky high':c>=1?'High':c>-1?'Level':'Shaken';
const ageOf=y=>y<=4?17+y:y<=20?Math.round(22+(y-5)*1.8):29+y;
const collegeOf=g=>g.college||(g.college=COLLEGES[hash(g.name)%COLLEGES.length]),stam=g=>clamp(5-Math.round((g.fatigue||0)/20),0,5),CLS=['Fr','So','Jr','Sr'];
const tourLabel=g=>g.retired?'Retired':isCol(g.tour)?`${collegeOf(g)}, college ${CLASS[g.yr-1].toLowerCase()}`:TOURS[g.tour].name;
const umbOf=k=>'smlx'.split('').find(u=>SUB[u].includes(k));
/* ===== Range Rat online: the shared world =====
   Everything here reads the shared tables (read-only for players) and sends every change to the `game` server function. */
const SB=window.supabase&&window.RR_CONFIG?window.supabase.createClient(RR_CONFIG.url,RR_CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const FN=RR_CONFIG.url+'/functions/v1/game';
const DEFAULTS={start_cash:25000,max_golfers:8,sessions_per_day:1,lessons_per_day:5,coach_max:1.5,deadline_min:5,round_min:15,events_per_season:8,hours:[18,19,20,21],gain_mult:1,rust_per_day:.025,recovery_per_day:15,event_fatigue:20,train_fatigue:15,purse_mult:1,fee_mult:1,sale_chance_mult:1,coach_age_yr:15};
const SETN={start_cash:'Starting money for a new stable',max_golfers:'Most active golfers per stable',sessions_per_day:'Range sessions per golfer per day',lessons_per_day:'Lessons each coach gives per day',coach_max:'Best coach multiplier',deadline_min:'Entry deadline, minutes before the start',round_min:'Minutes per round',events_per_season:'Events per tour per month',hours:'Start hours (New York time)',gain_mult:'Training gain multiplier',rust_per_day:'Rust per skipped day',recovery_per_day:'Fatigue recovered per day',event_fatigue:'Fatigue from playing an event',train_fatigue:'Fatigue from a range session',purse_mult:'Purse multiplier (new events)',fee_mult:'Entry fee multiplier (new events)',sale_chance_mult:'How keen rival coaches are to buy',coach_age_yr:'Career year a golfer may retire to coach'};
const ui={view:'loading',sel:null,msg:'',err:'',busy:false,auth:{mode:'in',email:'',msg:'',err:false,busy:false},tour:null,ev:null,watch:null,board:null,feed:null,pros:{name:'',country:'US',college:'',color:0},full:false};
const D={user:null,me:null,golfers:[],events:[],entries:[],world:null,settings:{...DEFAULTS},coaches:[],market:[],names:{}};
let poll=null,boardPoll=null;

/* ---------- small helpers ---------- */
const S=()=>D.settings;
const mine=()=>D.golfers.filter(g=>!g.retired);
const G=()=>D.golfers.find(g=>g.id===ui.sel)||mine()[0]||D.golfers[0];
const T=t=>TOURS[t]||{name:t};
const etFmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const when=iso=>etFmt.format(new Date(iso))+' ET';
function until(iso){let s=Math.round((Date.parse(iso)-Date.now())/1000);if(s<=0)return'now';const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d?`${d}d ${h}h`:h?`${h}h ${m}m`:m?`${m}m ${s%60}s`:`${s}s`;}
const deadline=e=>Date.parse(e.starts_at)-S().deadline_min*60e3;
const endsAt=e=>Date.parse(e.starts_at)+4*S().round_min*60e3;
function phase(e){if(e.status==='final')return'final';const now=Date.now();if(now<deadline(e))return'open';if(now<Date.parse(e.starts_at))return'closed';return'live';}
const entryOf=(e,g)=>D.entries.find(x=>x.event_id===e.id&&x.golfer_id===g.id);
function inField(e,g){const x=entryOf(e,g);if(x)return x.status==='in';return e.test||g.enter_rule==='all'||(g.enter_rule==='signature'&&['Signature','Finale'].includes(e.type));}
const subRowO=(g,k,ro,kid)=>`<div class="sn${kid?' kid':''}">${SUBN[k]}<small>${SUBD[k]}</small></div><div class="track"><i style="width:${clamp(g.sk[k],0,100)}%"></i></div><div class="sv">${Math.round(g.sk[k])}</div>${ro?'':`<button class="btn xs" data-act="train" data-v="${k}" ${g.sessions>0?'':'disabled'}>Drill</button>`}`;
function umbO(g,u,ro){const v=um(g.sk,u);let rows;
  if(u==='s'){const pv=(g.sk.sputt+g.sk.lputt)/2;rows=['wedge','pitch','chip','bunker'].map(k=>subRowO(g,k,ro)).join('')+`<div class="sn grp">Putting</div><div class="track"><i style="width:${pv}%"></i></div><div class="sv">${Math.round(pv)}</div>${ro?'':'<span></span>'}`+subRowO(g,'sputt',ro,1)+subRowO(g,'lputt',ro,1);}
  else rows=SUB[u].map(k=>subRowO(g,k,ro)).join('');
  const c=!ro&&g.coach_id&&D.coaches.find(x=>x.id===g.coach_id),m=c&&c.cr.o?coMultC(c.cr.o[u]):0;
  return `<div class="umb"><div class="uhead"><div><h2>${UMB[u]}</h2><small>${UMBD[u]}${m?` <span class="tag">×${m.toFixed(2)} with ${esc(c.name)}</span>`:''}</small></div><b>${Math.round(v)}</b></div><div class="track thick"><i style="width:${v}%"></i></div><div class="subs${ro?' ro':''}">${rows}</div>${ro?'':`<button class="btn sm" data-act="train" data-v="${u}" ${g.sessions>0?'':'disabled'} style="align-self:flex-start">General ${UMB[u].toLowerCase()} session</button>`}</div>`;}
const coMultC=v=>1+(S().coach_max-1)*Math.pow(clamp((v-35)/60,0,1),1.2);
const coOvrC=o=>(o.s+o.m+o.l+o.x)/4;
const avatarO=g=>`<div class="avatar" style="--c:${COLORS[g.color]||COLORS[0]}">${esc(initials(g.name))}</div>`;
const pips=(n,of)=>`<span class="pips">${Array.from({length:of},(x,i)=>`<i class="${i<n?'f':''}"></i>`).join('')}</span>`;
const tourOf=g=>g.retired?'Retired':isCol(g.tour)?`${esc(g.college||'')}, college ${(CLASS[g.yr-1]||'').toLowerCase()}`:T(g.tour).name;

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
async function load(){
  const uid=D.user.id;
  const [me,gs,ev,en,w,st,co,mk]=await Promise.all([
    SB.from('managers').select('*').eq('id',uid).maybeSingle(),
    SB.from('golfers').select('*').eq('manager_id',uid).order('created_at'),
    SB.from('events').select('id,tour,season,week,name,ci,type,purse,fee,pm,starts_at,status,rounds_done,field,test').gte('starts_at',new Date(Date.now()-3*864e5).toISOString()).order('starts_at').limit(400),
    SB.from('entries').select('*').eq('manager_id',uid),
    SB.from('world').select('*').maybeSingle(),
    SB.from('settings').select('key,value'),
    SB.from('golfers').select('id,name,country,manager_id,stable,cr,best,tour,stats,trophies,ret_age,color').eq('retired',true).not('cr','is',null),
    SB.from('golfers').select('id,name,country,manager_id,stable,sk,yr,tour,college,ask,arch,stats,listed_at,color').not('ask','is',null).eq('retired',false).order('ask'),
  ]);
  D.me=me.data;D.golfers=gs.data||[];D.events=ev.data||[];D.entries=en.data||[];D.world=w.data;D.coaches=co.data||[];D.market=mk.data||[];
  D.settings={...DEFAULTS};(st.data||[]).forEach(r=>D.settings[r.key]=r.value);
  if(!D.me)ui.view='join';else if(ui.view==='join'||ui.view==='loading')ui.view=mine().length?'stable':'scout';
}

/* ---------- views ---------- */
function nav(){
  const n=document.getElementById('nav');if(!n)return;
  if(!D.me||ui.view==='auth'){n.innerHTML='';return;}
  const tabs=[['stable','Stable'],['events','Events'],['standings','Standings'],['market','Market'],['coaches','Coaches'],['news','News']].concat(D.me.is_admin?[['admin','Admin']]:[]);
  n.innerHTML=`<span class="cash${D.me.cash<0?' red':''}">${fmt$(D.me.cash)}</span>`+tabs.map(([v,l])=>`<button class="btn sm${ui.view===v||(v==='events'&&ui.view==='board')?' on':''}" data-act="go" data-v="${v}">${l}</button>`).join('')+`<button class="btn sm" data-act="signOut">Sign out</button>`;
}
function flash(){return `${ui.err?`<p class="under" role="alert">${esc(ui.err)}</p>`:''}`;}
const V={
loading:()=>`<section class="intro"><p class="lede">Loading the world…</p></section>`,
auth(){const a=ui.auth,m=a.mode;
  const head={in:'Sign in',up:'Create an account',forgot:'Reset your password',newpass:'Choose a new password'}[m];
  const lede={in:'Range Rat is now one shared world. Your golfers play in the same timed events as everyone else, on weeknight evenings.',up:'One account, one stable. Your friends sign up the same way and you meet them in the field.',forgot:"Enter your email and we'll send a link to set a new password.",newpass:'Enter a new password for your account.'}[m];
  const btn={in:'Sign in',up:'Create account',forgot:'Send reset link',newpass:'Save password'}[m];
  return `<section class="intro"><p class="eyebrow">Range Rat online</p><h1>${head}</h1><p class="lede">${lede}</p></section>
<form class="stack authform" id="authForm" novalidate>
 ${m!=='newpass'?`<label class="field" for="aEmail"><span>Email</span><input id="aEmail" type="email" autocomplete="email" required value="${esc(a.email||'')}"></label>`:''}
 ${m!=='forgot'?`<label class="field" for="aPass"><span>Password</span><input id="aPass" type="password" autocomplete="${m==='in'?'current-password':'new-password'}" minlength="8" required></label>`:''}
 ${a.msg?`<p class="${a.err?'under':'hand'}" role="status">${esc(a.msg)}</p>`:''}
 <div class="row" style="justify-content:flex-start"><button class="btn primary" type="submit" ${a.busy?'disabled':''}>${a.busy?'Working…':btn}</button></div>
 <div class="row" style="justify-content:flex-start">${m==='in'?'<button class="btn sm" type="button" data-act="authMode" data-v="up">Create an account</button><button class="btn sm" type="button" data-act="authMode" data-v="forgot">Forgot password</button>':m!=='newpass'?'<button class="btn sm" type="button" data-act="authMode" data-v="in">Back to sign in</button>':''}</div>
 <p class="muted small">Your old single-player career is still at <a href="solo/">the solo game</a>.</p>
</form>`;},
join:()=>`<section class="intro"><p class="eyebrow">Welcome to the shared world</p><h1>Name your stable</h1><p class="lede">Everyone starts fresh with ${fmt$(S().start_cash)}. Events run on weeknight evenings, 6 to 10pm New York time, and everyone's golfers play in the same fields.</p></section>
<section class="sec stack"><label class="field" for="stName"><span>Stable name</span><input id="stName" type="text" maxlength="30" value="${esc(ui.pros.stable||'')}" placeholder="e.g. Back Nine Management"></label>${flash()}<div class="row" style="justify-content:flex-start"><button class="btn primary" data-act="join" ${ui.busy?'disabled':''}>Open the stable</button></div><p class="muted small">Your old single-player career is still at <a href="solo/">the solo game</a>.</p></section>`,
scout(){const p=D.me.prospect,full=mine().length>=S().max_golfers,P=ui.pros;
  if(!P.college)P.college=pick(COLLEGES);
  if(!p)return `<section class="intro"><h1>Scout a junior</h1><p class="lede">A junior costs nothing and starts as a college freshman.</p></section><section class="sec">${flash()}<button class="btn primary" data-act="scout" data-v="fresh" ${full||ui.busy?'disabled':''}>Send the scouts out</button>${full?`<p class="muted small">Your stable is full at ${S().max_golfers} active golfers.</p>`:''}</section>`;
  const g={sk:p.sk,sessions:0};
  return `<section class="intro"><p class="eyebrow">Junior prospect</p><h1>${esc(p.arch)}</h1><p class="lede">Free. He starts as a college freshman: four college seasons, sixteen as a professional, ten on the senior circuit. One season is one calendar month.</p></section>
<section class="sec prospect stack">
 <label class="field" for="gname"><span>Name</span><input id="gname" type="text" maxlength="22" value="${esc(P.name)}" placeholder="Tucker Hale"></label>
 <label class="field" for="gcountry"><span>Country</span><select id="gcountry">${Object.keys(COUNTRIES).filter(c=>CN.includes(c)).sort((a,b)=>COUNTRIES[a].localeCompare(COUNTRIES[b])).map(c=>`<option value="${c}"${c===P.country?' selected':''}>${COUNTRIES[c]}</option>`).join('')}</select></label>
 <label class="field" for="gcollege"><span>College</span><select id="gcollege">${CONFS.map((c,i)=>`<optgroup label="${TOURS['col'+i].name}">${c.slice().sort().map(x=>`<option${x===P.college?' selected':''}>${esc(x)}</option>`).join('')}</optgroup>`).join('')}</select></label>
 <div class="field"><span>Shirt</span><div class="swatches">${COLORS.slice(0,6).map((c,i)=>`<button class="sw${i===P.color?' on':''}" style="background:${c}" data-act="pcolor" data-v="${i}" aria-label="Shirt colour ${i+1}"></button>`).join('')}</div></div>
 <p class="hand">Ceiling grades: short game ${p.grade.s}, irons ${p.grade.m}, long game ${p.grade.l}, the head ${p.grade.x}. The scouts have been wrong before.</p>
 ${flash()}
 <div class="row"><button class="btn" data-act="scout" ${D.me.rerolls&&!ui.busy?'':'disabled'}>Scout another (${D.me.rerolls} left)</button><button class="btn primary" data-act="sign" ${full||ui.busy?'disabled':''}>Sign him</button></div>
</section><section class="umbs">${'smlx'.split('').map(u=>umbO(g,u,true)).join('')}</section>`;},
stable(){
  if(!D.golfers.length)return V.scout();
  const g=G();ui.sel=g.id;
  const picker=`<div class="row" style="justify-content:flex-start;flex-wrap:wrap">${D.golfers.map(x=>`<button class="btn sm${x.id===g.id?' on':''}" data-act="sel" data-v="${x.id}">${esc(x.name)}${x.retired?' (coach)':''}</button>`).join('')}${mine().length<S().max_golfers?'<button class="btn sm" data-act="go" data-v="scout">+ Scout a junior</button>':''}</div>`;
  const head=`<section class="sec"><div class="who">${avatarO(g)}<div><h1>${flagHTML(g.country)} ${esc(g.name)}</h1><p class="muted">${g.arch?esc(g.arch)+'. ':''}Age ${ageOf(g.yr)}. ${tourOf(g)}. Overall ${Math.round(ovr(g.sk))}.</p></div></div>${picker}</section>`;
  if(g.retired)return head+coachMine(g);
  const ups=D.events.filter(e=>e.tour===g.tour&&e.status!=='final').slice(0,6);
  const st=clamp(5-Math.round((g.fatigue||0)/20),0,5);
  const c=g.coach_id&&D.coaches.find(x=>x.id===g.coach_id),o=g.orders||{};
  return head+`
<section class="sec">
 <h2>Today on the range</h2>
 <div class="row"><span class="meters"><span class="meter"><span class="lab">Stamina</span>${pips(st,5)}<b>${st}/5</b></span><span class="meter"><span class="lab">Range session</span>${pips(Math.max(0,g.sessions),S().sessions_per_day)}<b>${Math.max(0,g.sessions)}/${S().sessions_per_day}</b></span></span></div>
 <p class="hand trainlog">${esc(ui.msg||(g.sessions>0?'One session a day. A drill pushes one skill hard; a general session lifts a whole area a little. Gains shrink as he nears his ceiling.':'He has had his session today. A new one comes at midnight New York time. If you leave it unused, his standing orders spend it.'))}</p>
 ${flash()}
 <div class="row" style="justify-content:flex-start"><button class="btn sm" data-act="train" data-v="rest" ${g.sessions>0&&!ui.busy?'':'disabled'}>Give him a day off</button><span class="muted small">Areas he doesn't work on get slightly rusty each day.</span></div>
 <label class="field" for="coachSel"><span>Coach</span><select id="coachSel" data-change="coach"><option value="">No coach (free)</option>${D.coaches.slice().sort((a,b)=>(b.cr.o?coOvrC(b.cr.o):0)-(a.cr.o?coOvrC(a.cr.o):0)).map(x=>`<option value="${x.id}"${x.id===g.coach_id?' selected':''}>${esc(x.name)}: ${x.cr.o?`short ${x.cr.o.s}, irons ${x.cr.o.m}, long ${x.cr.o.l}, head ${x.cr.o.x}`:'ratings pending'}, ${x.manager_id===D.user.id?'yours, free':fmt$(x.cr.price)+' a lesson'}, ${x.cr.left} left today</option>`).join('')}</select></label>
 ${c?`<p class="muted small">Each session with ${esc(c.name)} ${c.manager_id===D.user.id?'is free':'costs '+fmt$(c.cr.price)}. If he's booked up for the day, your golfer works alone.</p>`:''}
</section>
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
<section class="sec">
 <h2>Events on the ${T(g.tour).name}</h2>
 <label class="field" for="eRule"><span>Enter him automatically in</span><select id="eRule" data-change="rule">${[['all','Every event'],['signature','Signature events and the Finale only'],['none','Nothing: I enter him by hand']].map(([v,l])=>`<option value="${v}"${g.enter_rule===v?' selected':''}>${l}</option>`).join('')}</select></label>
 ${ups.length?`<div class="shop">${ups.map(e=>evItem(e,g)).join('')}</div>`:'<p class="muted">Nothing scheduled yet on his tour.</p>'}
 <p class="muted small">Entries close ${S().deadline_min} minutes before the start. Auto entries pay the fee when entries close.</p>
</section>
<section class="sec"><h2>Equipment</h2><div class="shop">${'sml'.split('').map(u=>{const l=g.eq[u];return `<div class="item"><b>${EQN[u]}</b><span>Now: ${EQL[l]}.${l<3?` Next: ${EQL[l+1]}.`:''}</span>${l<3?`<button class="btn sm" data-act="gear" data-v="${u}" ${D.me.cash<EQC[l]||ui.busy?'disabled':''}>Upgrade for ${fmt$(EQC[l])}</button>`:'<span class="tag">Best available</span>'}</div>`;}).join('')}</div></section>
<section class="sec"><h2>His career</h2>${careerHTML(g)}</section>
<section class="sec"><h2>Transfer</h2>${sellHTML(g)}</section>
${g.yr>=S().coach_age_yr?`<section class="sec"><h2>Retire to coach</h2><p class="muted">He's old enough to hang up his spikes and coach. His lessons are free for your golfers, and other managers pay you to book him.</p>${ui.confirm==='retire'?`<div class="row" style="justify-content:flex-start"><button class="btn primary sm" data-act="retire">Yes, retire him</button><button class="btn sm" data-act="confirm" data-v="">Keep playing</button></div>`:'<button class="btn sm" data-act="confirm" data-v="retire">Retire him</button>'}</section>`:''}
${isCol(g.tour)?`<section class="sec"><h2>College</h2><label class="field" for="hcollege"><span>Plays for</span><select id="hcollege" data-change="college">${CONFS.map((c,i)=>`<optgroup label="${TOURS['col'+i].name}">${c.slice().sort().map(x=>`<option${x===g.college?' selected':''}>${esc(x)}</option>`).join('')}</optgroup>`).join('')}</select></label></section>`:''}`;},
events(){
  const tours=[...new Set(D.events.map(e=>e.tour))].sort((a,b)=>TORDER.indexOf(a)-TORDER.indexOf(b));
  const t=ui.tour||'all',list=D.events.filter(e=>t==='all'||e.tour===t);
  const live=list.filter(e=>['live','closed'].includes(phase(e))&&e.status!=='final'),next=list.filter(e=>phase(e)==='open').slice(0,12),done=list.filter(e=>e.status==='final').reverse().slice(0,12);
  const row=e=>`<div class="item"><b>${esc(e.name)}${e.test?' <span class="tag">Test</span>':''}</b><span>${T(e.tour).name}. ${COURSES[e.ci].name}. ${when(e.starts_at)}. Purse ${fmt$(e.purse)}${e.fee?`, entry ${fmt$(e.fee)}`:''}.</span><span>${mineIn(e)}</span><button class="btn sm" data-act="board" data-v="${e.id}">${e.status==='final'?'Results':phase(e)==='open'?'Field':'Watch'}</button></div>`;
  return `<section class="intro"><p class="eyebrow">Season ${D.world?D.world.season:1}${D.world?`, through ${new Date(D.world.season_end+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric'})}`:''}</p><h1>Events</h1><p class="lede">Every event starts on the clock. Each round takes ${S().round_min} minutes, one hole every ${Math.round(S().round_min*60/18)} seconds, and everyone watches the same holes at the same time.</p></section>
<section class="sec"><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn sm${t==='all'?' on':''}" data-act="tour" data-v="all">All tours</button>${tours.map(x=>`<button class="btn sm${t===x?' on':''}" data-act="tour" data-v="${x}">${T(x).name}</button>`).join('')}</div></section>
${live.length?`<section class="sec"><h2>On the course now</h2><div class="shop">${live.map(row).join('')}</div></section>`:''}
<section class="sec"><h2>Coming up</h2>${next.length?`<div class="shop">${next.map(row).join('')}</div>`:'<p class="muted">Nothing scheduled.</p>'}</section>
${done.length?`<section class="sec"><h2>Finished</h2><div class="shop">${done.map(row).join('')}</div></section>`:''}`;},
board(){const b=ui.board,e=D.events.find(x=>x.id===ui.ev)||(b&&b.event);
  if(!e)return '<section class="sec"><p class="muted">Loading the board…</p></section>';
  const back='<button class="btn sm" data-act="go" data-v="events">← Events</button>';
  const ph=phase(e);
  const head=`<section class="intro"><p class="eyebrow">${T(e.tour).name}${e.test?' · test event':''}</p><h1>${esc(e.name)}</h1><p class="lede">${COURSES[e.ci].name}: ${COURSES[e.ci].blurb} Starts ${when(e.starts_at)}. Purse ${fmt$(e.purse)}.</p>${back}</section>`;
  if(ph==='open'){const gs=mine().filter(g=>g.tour===e.tour);
    return head+`<section class="sec"><h2>Entries close in ${until(new Date(deadline(e)).toISOString())}</h2>${gs.length?`<div class="shop">${gs.map(g=>evItem(e,g,true)).join('')}</div>`:'<p class="muted">None of your golfers play on this tour.</p>'}${flash()}</section>${previewHTML(e)}`;}
  if(!b||!b.players)return head+'<section class="sec"><p class="muted">Loading the board…</p></section>';
  if(!b.players.length)return head+`<section class="sec"><p class="muted">Setting the field. The first tee time is ${until(e.starts_at)} away.</p></section>`;
  return head+boardHTML(b,e)+watchHTML(b,e);},
standings(){const tours=TORDER,t=ui.tour&&ui.tour!=='all'?ui.tour:(G()&&!G().retired?G().tour:'p1');ui.tour=t;
  const rows=ui.stand&&ui.stand.t===t?ui.stand.rows:null;if(!rows)loadStand(t);
  return `<section class="intro"><p class="eyebrow">Season ${D.world?D.world.season:1}</p><h1>Standings</h1><p class="lede">Points from finished events this season. At the end of the month the top ${Math.round(FIELD*.2)} on each pro tour go up and the bottom ${Math.round(FIELD*.2)} go down.</p></section>
<section class="sec"><div class="row" style="justify-content:flex-start;flex-wrap:wrap">${tours.map(x=>`<button class="btn sm${t===x?' on':''}" data-act="stour" data-v="${x}">${T(x).name}</button>`).join('')}</div></section>
<section class="sec">${!rows?'<p class="muted">Loading…</p>':!rows.length?'<p class="muted">No finished events on this tour yet this season.</p>':`<div class="scroll tall"><table class="tbl"><thead><tr><th class="num">#</th><th>Golfer</th><th>Stable</th><th class="num">Points</th><th class="num">Wins</th><th class="num">Earned</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.golfers&&r.golfers.manager_id===D.user.id?'me':r.golfers&&r.golfers.manager_id?'now':''}"><td class="num">${i+1}</td><td>${r.golfers?flagHTML(r.golfers.country)+esc(r.golfers.name):'?'}</td><td class="small">${esc(r.golfers&&r.golfers.stable||'Tour regular')}</td><td class="num">${fmtPts(r.pts)}</td><td class="num">${r.wins||''}</td><td class="num">${fmt$(r.earn)}</td></tr>`).join('')}</tbody></table></div>`}</section>`;},
market(){const full=mine().length>=S().max_golfers,list=D.market.filter(m=>m.manager_id!==D.user.id);
  return `<section class="intro"><h1>Transfer market</h1><p class="lede">Golfers listed by rival coaches and by other managers. Buying from a manager pays them directly.</p></section>
<section class="sec">${flash()}${ui.msg?`<p class="hand">${esc(ui.msg)}</p>`:''}<div class="shop">
 <div class="item"><b>Junior prospect</b><span>Free. Starts as a college freshman and is yours to develop.</span><button class="btn sm" data-act="go" data-v="scout" ${full?'disabled':''}>Scout juniors</button></div>
 ${list.map(m=>{const val=valueOfC(m.sk,m.yr),d=m.ask/val;return `<div class="item"><b>${flagHTML(m.country)}${esc(m.name)}</b><span>${esc(m.arch||'Golfer')}, age ${ageOf(m.yr)}. ${isCol(m.tour)?`${esc(m.college||'')}, college ${(CLASS[m.yr-1]||'').toLowerCase()}`:T(m.tour).name}. Overall ${Math.round(ovr(m.sk))}: short ${Math.round(um(m.sk,'s'))}, irons ${Math.round(um(m.sk,'m'))}, long ${Math.round(um(m.sk,'l'))}, misc ${Math.round(um(m.sk,'x'))}.</span><span>Seller: ${esc(m.stable||'Unknown')}${m.manager_id?' <span class="tag">Manager</span>':''}. Market value ${fmt$(val)}. <b style="font-size:.86rem">${d<.93?'Priced under value':d>1.1?'Priced over value':'Fair price'}</b></span><button class="btn sm" data-act="buy" data-v="${m.id}" ${full||D.me.cash<m.ask||ui.busy?'disabled':''}>Sign for ${fmt$(m.ask)}</button></div>`;}).join('')}
</div><p class="muted small">${full?`Your stable is full at ${S().max_golfers} active golfers. `:''}Rival coaches buy listed golfers too, so the list changes day to day.</p></section>`;},
coaches(){const list=D.coaches.slice().sort((a,b)=>(b.cr.o?coOvrC(b.cr.o):0)-(a.cr.o?coOvrC(a.cr.o):0));
  return `<section class="intro"><h1>Coaches</h1><p class="lede">Retired players coach. Each gives ${S().lessons_per_day} lessons a day across every manager, so the good ones book up. The best coaching multiplies a range session by up to ×${S().coach_max}. Pick a coach for a golfer on his Stable page.</p></section>
<section class="sec">${flash()}<div class="scroll tall"><table class="tbl"><thead><tr><th>Coach</th><th class="num">Short</th><th class="num">Irons</th><th class="num">Long</th><th class="num">Head</th><th class="num">Fee</th><th class="num">Left today</th></tr></thead><tbody>${list.map(c=>{const o=c.cr.o||{};return `<tr class="${c.manager_id===D.user.id?'me':''}"><td>${flagHTML(c.country)}${esc(c.name)} <span class="muted small">${esc(c.stable||'')}</span></td>${'smlx'.split('').map(u=>`<td class="num">${o[u]??'–'}</td>`).join('')}<td class="num">${c.manager_id===D.user.id?'Yours':fmt$(c.cr.price)}</td><td class="num">${c.cr.left}</td></tr>`;}).join('')}</tbody></table></div></section>`;},
news:()=>`<section class="intro"><h1>News</h1><p class="lede">${esc(D.me.name)}</p></section><section class="sec">${(D.me.news||[]).length?(D.me.news||[]).map(n=>`<p>${esc(n.t)} <span class="muted small">${when(n.at)}</span></p>`).join(''):'<p class="muted">Nothing yet.</p>'}
 <h2>Stable name</h2><div class="row" style="justify-content:flex-start"><input id="stName" type="text" maxlength="30" value="${esc(D.me.name)}"><button class="btn sm" data-act="rename">Rename</button></div>${flash()}</section>`,
admin(){const s=S();
  return `<section class="intro"><p class="eyebrow">Admin</p><h1>World settings</h1><p class="lede">Changes apply from the next clock tick. Money settings apply to events scheduled after the change. Every change is logged.</p></section>
<section class="sec">${flash()}${ui.msg?`<p class="hand">${esc(ui.msg)}</p>`:''}<div class="shop">${Object.keys(DEFAULTS).map(k=>`<div class="item"><b>${SETN[k]}</b><span class="muted small">Default ${esc(JSON.stringify(DEFAULTS[k]))}</span><input type="text" id="set_${k}" value="${esc(Array.isArray(s[k])?s[k].join(', '):s[k])}"><button class="btn sm" data-act="aset" data-v="${k}">Save</button></div>`).join('')}</div></section>
<section class="sec"><h2>Test event</h2><p class="muted small">Pays no money and no points. All managers' golfers on that tour are entered.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><select id="tTour">${TORDER.map(t=>`<option value="${t}">${T(t).name}</option>`).join('')}</select><label class="field" for="tMin"><span>Starts in (minutes)</span><input id="tMin" type="number" min="6" value="7"></label><button class="btn sm" data-act="atest">Create</button></div></section>
<section class="sec"><h2>Change log</h2><button class="btn sm" data-act="alog">Load</button>${ui.log?`<div class="scroll"><table class="tbl"><tbody>${ui.log.map(l=>`<tr><td class="small">${when(l.at)}</td><td>${SETN[l.key]||l.key}</td><td class="small">${esc(JSON.stringify(l.old))} → ${esc(JSON.stringify(l.new))}</td></tr>`).join('')}</tbody></table></div>`:''}</section>`;},
};
function valueOfC(sk,yr){const o=ovr(sk),a=yr<=4?[.2,.3,.45,.7][yr-1]:yr<=12?1.15-(yr-5)*.02:yr<=20?1-(yr-12)*.07:Math.max(.04,.3-(yr-21)*.03);return Math.max(1000,Math.round(50000*Math.pow(5,(o-64)/6)*a/500)*500);}
function mineIn(e){const gs=mine().filter(g=>g.tour===e.tour);if(!gs.length)return'';const inn=gs.filter(g=>inField(e,g));return inn.length?`Yours in: ${inn.map(g=>esc(g.name)).join(', ')}.`:'None of yours entered.';}
function evItem(e,g,full){const ph=phase(e),inn=inField(e,g),x=entryOf(e,g);
  const state=ph!=='open'?(e.status==='final'?'Finished':'Entries closed'):inn?(x&&x.status==='in'?'Entered':'Entered automatically'):'Not entered';
  return `<div class="item"><b>${full?esc(g.name):esc(e.name)}${e.test?' <span class="tag">Test</span>':''}</b><span>${full?'':`${COURSES[e.ci].name}. ${when(e.starts_at)}. `}${e.type}. ${e.fee&&!e.test?`Entry ${fmt$(e.fee)}. `:'No entry fee. '}${ph==='open'?`Closes in ${until(new Date(deadline(e)).toISOString())}.`:''}</span><span class="tag${inn&&ph==='open'?' hot':''}">${state}</span>${ph==='open'?(inn?`<button class="btn sm" data-act="withdraw" data-v="${e.id}" data-g="${g.id}" ${ui.busy?'disabled':''}>Withdraw</button>`:`<button class="btn sm" data-act="enter" data-v="${e.id}" data-g="${g.id}" ${ui.busy?'disabled':''}>Enter</button>`):`<button class="btn sm" data-act="board" data-v="${e.id}">${e.status==='final'?'Results':'Watch'}</button>`}</div>`;}
function careerHTML(g){const s=Object.assign({ev:0,cuts:0,wins:0,top10:0,earn:0,rounds:0,par:0,low:null},g.stats);
  return `<div class="stats"><div><b>${s.ev}</b><span>Events</span></div><div><b>${s.wins}</b><span>Wins</span></div><div><b>${s.top10}</b><span>Top tens</span></div><div><b>${s.ev?s.cuts+'/'+s.ev:'–'}</b><span>Cuts made</span></div><div><b>${s.low===null?'–':fmtPar(s.low)}</b><span>Low round</span></div><div><b>${fmt$(s.earn)}</b><span>Earned</span></div></div>
  ${(g.hist||[]).length?`<div class="scroll"><table class="tbl"><thead><tr><th>Event</th><th class="num">R1</th><th class="num">R2</th><th class="num">R3</th><th class="num">R4</th><th class="num">Par</th><th class="num">Pos</th><th class="num">Won</th></tr></thead><tbody>${g.hist.slice(0,12).map(x=>`<tr><td>${esc(x.n)}</td>${[0,1,2,3].map(j=>`<td class="num">${x.r[j]||''}</td>`).join('')}<td class="num${x.par<0?' under':''}">${fmtPar(x.par)}</td><td class="num">${x.pos}</td><td class="num">${x.pay?fmt$(x.pay):''}</td></tr>`).join('')}</tbody></table></div>`:''}`;}
function sellHTML(g){if(!canSellC(g))return '<p class="muted">College freshmen and sophomores can’t be sold.</p>';const val=valueOfC(g.sk,g.yr);
  return g.ask?`<p>Listed at ${fmt$(g.ask)} (market value ${fmt$(val)}). Rival coaches look once a day; other managers can buy him any time.</p><button class="btn sm" data-act="unlist">Take him off the market</button>`
  :`<p class="muted">Market value about ${fmt$(val)}. A rival coach will take him now for ${fmt$(Math.round(val*.6/100)*100)}.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><input id="askIn" type="number" min="1000" step="500" value="${val}"><button class="btn sm" data-act="list">List him</button>${ui.confirm==='qs'?'<button class="btn sm primary" data-act="quicksell">Yes, sell now</button>':'<button class="btn sm" data-act="confirm" data-v="qs">Quick sale</button>'}</div>`;}
const canSellC=g=>g.yr>=3;
function coachMine(g){const cr=g.cr;if(!cr)return '<section class="sec"><p class="muted">Retired.</p></section>';const o=cr.o||{};
  return `<section class="sec"><h2>Coaching</h2><p class="lede">${esc(g.name)} coaches for you. His lessons are free for your golfers. ${cr.given||0} lessons to other stables so far, for ${fmt$(cr.earn||0)}.</p>
  <p>Short game ${o.s??'–'}, irons ${o.m??'–'}, long game ${o.l??'–'}, the head ${o.x??'–'}. ${cr.left} lessons left today.</p>
  <div class="row" style="justify-content:flex-start"><label class="field" for="feeIn"><span>Fee per lesson</span><input id="feeIn" type="number" min="50" step="50" value="${cr.price}"></label><button class="btn sm" data-act="fee">Set fee</button></div>${flash()}
  <p class="muted small">Rival managers book what's left of his day each night; a fee near what he's worth books best.</p></section>`;}

/* ---------- the live board ---------- */
async function loadBoard(){if(!ui.ev)return;const {data,error}=await SB.rpc('event_board',{eid:ui.ev});if(!error&&data){ui.board=data;if(ui.watch)await loadWatch();}}
async function loadWatch(){const {data}=await SB.rpc('event_watch',{eid:ui.ev,gid:ui.watch});ui.feed=data||[];}
function boardRows(b,e){const pars=COURSES[e.ci].holes.map(h=>h.par);
  return b.players.map(p=>{let tot=0,thru=0,rd=0,strokes=[];(p.scores||[]).forEach((r,i)=>{r.forEach((s,h)=>tot+=s-pars[h]);if(r.length){rd=i;thru=r.length;}strokes.push(r.reduce((a,c)=>a+c,0));});return{p,tot,thru,rd,strokes};});}
function boardHTML(b,e){const rows=boardRows(b,e),fin=e.status==='final',cutR=b.vis&&b.vis[1]===18;
  const R=Math.max(0,...rows.map(r=>r.rd));
  rows.sort((a,c)=>fin?((a.p.pos_n||999)-(c.p.pos_n||999)):((a.p.cut?1:0)-(c.p.cut?1:0)||a.tot-c.tot||c.thru-a.thru));
  let pos=0;rows.forEach((r,i)=>{if(fin){r.pos=r.p.pos;return;}if(i===0||r.tot!==rows[i-1].tot||r.p.cut!==rows[i-1].p.cut)pos=i+1;r.pos=r.p.cut?'MC':String(pos);});
  if(!fin){const act=rows.filter(r=>!r.p.cut),H=r=>(4-r.rd)*18-r.thru;const list=act.map(r=>({r:ratingFor(r.p,e.ci),cur:r.tot,H:Math.max(0,(3-r.rd)*18+(18-r.thru))}));const w=winProbs(list,300);act.forEach((r,i)=>r.odds=oddsLabel(w[i]));}
  const show=ui.full?rows:rows.filter((r,i)=>i<15||r.p.managed);
  const live=!fin&&phase(e)==='live';
  return `<section class="board"><div class="row"><h2>${fin?'Final':live?`Round ${R+1}, live`:'Waiting for the first tee shot'}</h2><span class="chip">${cutR&&!fin?'Cut made':''}</span></div>
 <div class="bscroll"><table><thead><tr><th class="num">Pos</th><th>Golfer</th>${fin?'<th class="num">Pts</th>':'<th class="num">Odds</th>'}<th class="num">Par</th><th class="num">${fin?'Total':'Thru'}</th></tr></thead><tbody>
 ${show.map((r,i)=>`${i>0&&rows.indexOf(r)-rows.indexOf(show[i-1])>1?'<tr class="gap"><td colspan="5">⋮</td></tr>':''}<tr class="${r.p.mine?'me':r.p.managed?'mine':''}"><td class="num">${r.pos||''}</td><td class="nm">${flagHTML(r.p.country)}${esc(r.p.name)}${r.p.managed?`<small class="sch">${esc(r.p.stable||'')}</small>`:isCol(e.tour)?`<small class="sch">${esc(r.p.college||'')}</small>`:''}${fin&&r.p.pay?`<small class="sch">${fmt$(r.p.pay)}</small>`:''}${r.p.managed?` <button class="btn xs" data-act="watch" data-v="${r.p.id}">Watch</button>`:''}</td>${fin?`<td class="num">${r.p.pts?fmtPts(r.p.pts):''}</td>`:`<td class="num odds">${r.odds||''}</td>`}<td class="num${r.tot<0?' under':''}">${fmtPar(r.tot)}</td><td class="num">${fin?r.strokes.reduce((a,c)=>a+c,0)||'':r.thru===18&&r.rd===R?'F':r.thru||'–'}</td></tr>`).join('')}
 </tbody></table></div><div class="row"><span class="muted small">${live?'Updates every few seconds.':''}</span><button class="btn sm" data-act="fullBoard">${ui.full?'Show fewer':'Show all '+rows.length}</button></div></section>`;}
function watchHTML(b,e){if(!ui.watch)return '';const p=b.players.find(x=>x.id===ui.watch);if(!p)return '';const f=(ui.feed||[]).slice().reverse().slice(0,18),pars=COURSES[e.ci].holes.map(h=>h.par);
  return `<section class="sec"><h2>Following ${esc(p.name)}</h2><div class="feed">${f.length?f.map((h,i)=>{const sc=h.shots.length&&h.shots.filter(s=>s.k!=='drop').length,d=sc-pars[h.hole];return `<p class="${i===0?'now':''}"><b>R${h.round+1} hole ${h.hole+1}</b> (par ${pars[h.hole]}): ${h.shots.map(s=>esc(s.text)).join(' ')} <span class="tag">${d===0?'Par':d===-1?'Birdie':d===-2?'Eagle':d===1?'Bogey':d===2?'Double':d<0?d:'+'+d}</span></p>`;}).join(''):'<p class="muted">He hasn’t teed off yet.</p>'}</div></section>`;}
async function loadPreview(e){
  const [gs,en]=await Promise.all([SB.from('golfers').select('id,name,country,college,stable,manager_id,sk,yr,enter_rule').eq('tour',e.tour).eq('retired',false).not('manager_id','is',null),SB.from('entries').select('golfer_id,status').eq('event_id',e.id)]);
  const st=new Map((en.data||[]).map(x=>[x.golfer_id,x.status]));
  const rows=(gs.data||[]).map(g=>{const s=st.get(g.id),auto=e.test||g.enter_rule==='all'||(g.enter_rule==='signature'&&['Signature','Finale'].includes(e.type));return{g,how:s==='in'?'Entered':s==='out'?null:auto?'Entered automatically':null};}).filter(r=>r.how);
  rows.sort((a,b)=>ovr(b.g.sk)-ovr(a.g.sk));ui.preview={eid:e.id,rows};}
function previewHTML(e){const P=ui.preview&&ui.preview.eid===e.id?ui.preview.rows:null;
  return `<section class="sec"><h2>The field so far</h2>${!P?'<p class="muted">Loading…</p>':!P.length?'<p class="muted">No managers\u2019 golfers are in yet.</p>':`<div class="scroll"><table class="tbl"><thead><tr><th>Golfer</th><th>Stable</th><th class="num">Overall</th></tr></thead><tbody>${P.map(r=>`<tr class="${r.g.manager_id===D.user.id?'me':'now'}"><td>${flagHTML(r.g.country)}${esc(r.g.name)}${isCol(e.tour)?` <span class="muted small">${esc(r.g.college||'')}</span>`:''}${r.how==='Entered automatically'?' <span class="muted small">(auto)</span>':''}</td><td class="small">${esc(r.g.stable||'')}</td><td class="num">${Math.round(ovr(r.g.sk))}</td></tr>`).join('')}</tbody></table></div>`}
  <p class="muted small">${P?`${P.length} golfer${P.length===1?'':'s'} from managers\u2019 stables so far. `:''}When entries close, tour regulars fill the rest of the ${FIELD} spots. Auto entries can still withdraw before then.</p></section>`;}
async function loadStand(t){const {data}=await SB.from('standings').select('pts,wins,earn,golfers(name,country,stable,manager_id)').eq('tour',t).eq('season',D.world?D.world.season:1).order('pts',{ascending:false}).limit(200);ui.stand={t,rows:data||[]};if(ui.view==='standings')render();}

/* ---------- render and events ---------- */
function render(){nav();const v=document.getElementById('view');const f=V[ui.view]||V.loading;
  const a=document.activeElement,id=a&&a.id,val=a&&a.value;v.innerHTML=f();
  if(id){const n=document.getElementById(id);if(n&&n!==a){n.focus();if(n.type==='text'&&val!==undefined)n.value=val;}}
  const af=document.getElementById('authForm');if(af)af.onsubmit=ev=>{ev.preventDefault();submitAuth();};}
function go(v){ui.view=v;ui.err='';ui.msg='';ui.confirm=null;if(v!=='board'){ui.ev=null;ui.board=null;ui.watch=null;}if(v==='standings')ui.stand=null;render();window.scrollTo(0,0);}
const val=id=>{const n=document.getElementById(id);return n?n.value:'';};
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,v=b.dataset.v;
  if(a==='go')return go(v);
  if(a==='authMode'){ui.auth={...ui.auth,mode:v,msg:'',err:false};return render();}
  if(a==='signOut')return signOut();
  if(a==='sel'){ui.sel=v;ui.msg='';ui.err='';ui.confirm=null;return render();}
  if(a==='confirm'){ui.confirm=v||null;return render();}
  if(a==='pcolor'){ui.pros.color=+v;return render();}
  if(a==='tour'){ui.tour=v;return render();}
  if(a==='stour'){ui.tour=v;ui.stand=null;return render();}
  if(a==='fullBoard'){ui.full=!ui.full;return render();}
  if(a==='board'){ui.view='board';ui.ev=v;ui.board=null;ui.watch=null;ui.full=false;ui.preview=null;render();const e=D.events.find(x=>x.id===v);if(e&&phase(e)==='open')loadPreview(e).then(render);loadBoard().then(render);return;}
  if(a==='watch'){ui.watch=v;loadWatch().then(render);return;}
  if(a==='join')return act('join',{name:val('stName')});
  if(a==='scout'){keepPros();return act('scout',{fresh:v==='fresh'});}
  if(a==='sign'){keepPros();const P=ui.pros;return act('sign',{name:P.name||'Tucker Hale',country:P.country,college:P.college,color:P.color},r=>{ui.sel=r.id;ui.pros={name:'',country:'US',college:'',color:0};ui.view='stable';});}
  const g=G();
  if(a==='train'){ui.msg='';return act('train',{id:g.id,what:v});}
  if(a==='orders'){const f=val('oFocus');return act('orders',{id:g.id,orders:f?{focus:f,rest_below:+val('oRest'),report:true}:null},()=>{ui.msg='Standing orders saved.';});}
  if(a==='gear')return act('gear',{id:g.id,u:v});
  if(a==='enter'||a==='withdraw')return act(a,{id:b.dataset.g,event:v},async()=>{const e=D.events.find(x=>x.id===v);if(e&&ui.view==='board')await loadPreview(e);});
  if(a==='list')return act('list',{id:g.id,ask:+val('askIn')});
  if(a==='unlist')return act('unlist',{id:g.id});
  if(a==='quicksell'){ui.confirm=null;return act('quicksell',{id:g.id},()=>{ui.sel=null;});}
  if(a==='buy')return act('buy',{id:v});
  if(a==='retire'){ui.confirm=null;return act('retire',{id:g.id});}
  if(a==='fee')return act('fee',{id:g.id,price:+val('feeIn')});
  if(a==='rename')return act('rename',{name:val('stName')});
  if(a==='aset'){let raw=val('set_'+v),x;const d=DEFAULTS[v];x=Array.isArray(d)?raw.split(/[ ,]+/).filter(Boolean).map(Number):typeof d==='number'?Number(raw):raw;if(Array.isArray(x)?x.some(isNaN):typeof x==='number'&&isNaN(x)){ui.err='That needs a number.';return render();}return act('adminSet',{key:v,value:x},()=>{ui.msg='Saved.';});}
  if(a==='atest')return act('adminTest',{tour:val('tTour'),mins:+val('tMin')},()=>{ui.msg='Test event created. It appears on the Events page.';});
  if(a==='alog')return act('adminLog',{},r=>{ui.log=r.log;});
});
document.addEventListener('change',ev=>{const n=ev.target,c=n.dataset&&n.dataset.change;
  if(n.id==='gname'||n.id==='gcountry'||n.id==='gcollege')keepPros();
  if(!c)return;const g=G();
  if(c==='coach')act('coach',{id:g.id,coach:n.value||null});
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
  try{await load();}catch(e){ui.err="Couldn't load the world. Refresh to try again.";}
  render();
}
if(SB){
  SB.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY'){ui.auth.mode='newpass';ui.view='auth';render();return;}
    const u=session?session.user:null;if(u&&(!D.user||D.user.id!==u.id)&&ui.auth.mode!=='newpass'){D.user=u;ui.view='loading';render();load().then(render).catch(()=>{});}
  });
  start();
  // keep things fresh: the world every 30 seconds, an open board every 5
  setInterval(()=>{if(D.user&&D.me&&!ui.busy&&!['auth','join','scout','admin','news'].includes(ui.view)&&!document.hidden){const a=document.activeElement;if(a&&/INPUT|SELECT/.test(a.tagName))return;load().then(render).catch(()=>{});}},30000);
  setInterval(()=>{if(ui.view==='board'&&!document.hidden){const e=D.events.find(x=>x.id===ui.ev);if(e&&phase(e)==='open'){(Date.now()%15000<5000?loadPreview(e):Promise.resolve()).then(()=>{const a=document.activeElement;if(!(a&&a.tagName==='SELECT'))render();});return;}loadBoard().then(()=>{const a=document.activeElement;if(!(a&&a.tagName==='SELECT'))render();});}},5000);
}else document.getElementById('view').innerHTML='<p class="lede">Couldn’t load the game. Refresh to try again.</p>';
