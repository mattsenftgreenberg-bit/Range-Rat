/* Range Rat online. Helpers shared with the solo game come first. */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS=['#c2362a','#1f5fa8','#e08a1a','#6b3fa0','#16806a','#333c44','#b81d6e','#0f8a9e','#7a5c1e','#5d8f1c','#d9577c','#0d1114'];
const MAP={tree:'#24492f',dot:'#1b3a25',rough:'#3d7848',fair:'#6dac5a',fringe:'#86c06a',green:'#a3d67f',sand:'#eadca6',water:'#3c8cbd',tee:'#8cc474'};
const COUNTRIES={US:'United States',AR:'Argentina',AU:'Australia',BR:'Brazil',CA:'Canada',CL:'Chile',CN:'China',CO:'Colombia',CZ:'Czechia',DK:'Denmark',ENG:'England',FI:'Finland',FR:'France',DE:'Germany',IN:'India',IE:'Ireland',IT:'Italy',JP:'Japan',MX:'Mexico',NL:'Netherlands',NZ:'New Zealand',NG:'Nigeria',NO:'Norway',PL:'Poland',SCO:'Scotland',ZA:'South Africa',KR:'South Korea',ES:'Spain',SE:'Sweden',TH:'Thailand',DZ:'Algeria',AO:'Angola',BJ:'Benin',BW:'Botswana',BF:'Burkina Faso',BI:'Burundi',CV:'Cape Verde',CM:'Cameroon',CF:'Central African Republic',TD:'Chad',KM:'Comoros',CG:'Congo',CD:'DR Congo',CI:'Côte d\'Ivoire',DJ:'Djibouti',EG:'Egypt',GQ:'Equatorial Guinea',ER:'Eritrea',SZ:'Eswatini',ET:'Ethiopia',GA:'Gabon',GM:'Gambia',GH:'Ghana',GN:'Guinea',GW:'Guinea-Bissau',KE:'Kenya',LS:'Lesotho',LR:'Liberia',LY:'Libya',MG:'Madagascar',MW:'Malawi',ML:'Mali',MR:'Mauritania',MU:'Mauritius',MA:'Morocco',MZ:'Mozambique',NA:'Namibia',NE:'Niger',RW:'Rwanda',ST:'São Tomé and Príncipe',SN:'Senegal',SC:'Seychelles',SL:'Sierra Leone',SO:'Somalia',SS:'South Sudan',SD:'Sudan',TZ:'Tanzania',TG:'Togo',TN:'Tunisia',UG:'Uganda',ZM:'Zambia',ZW:'Zimbabwe'};
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
const DEFAULTS={start_cash:75000,max_golfers:8,sessions_per_day:1,lessons_per_day:5,coach_max:1.5,deadline_min:5,round_min:7.5,events_per_season:8,hours:[18,19,20,21],gain_mult:1,rust_per_day:.025,recovery_per_day:15,event_fatigue:20,train_fatigue:15,purse_mult:1,fee_mult:1,sale_chance_mult:1,coach_age_yr:15,qf_on:true,qf_every_min:20,qf_fee:200,qf_base:20000,qf_add:200,qf_bonus:1000,qf_ace:1000000};
const SETN={qf_on:'Quick-Fire Opens running (true or false)',qf_every_min:'Minutes between Quick-Fire Opens',qf_fee:'Quick-Fire entry fee',qf_base:'Quick-Fire base pot',qf_add:'Added to the pot per entry',qf_bonus:'Most greens / long drive bonus',qf_ace:'Hole-in-one bonus',start_cash:'Starting money for a new roster',max_golfers:'Most active golfers per roster',sessions_per_day:'Range sessions per golfer per day',lessons_per_day:'Lessons each coach gives per day',coach_max:'Best coach multiplier',deadline_min:'Entry deadline, minutes before the start',round_min:'Minutes per round',events_per_season:'Events per tour per month',hours:'Start hours (New York time)',gain_mult:'Training gain multiplier',rust_per_day:'Rust per skipped day',recovery_per_day:'Fatigue recovered per day',event_fatigue:'Fatigue from playing an event',train_fatigue:'Fatigue from a range session',purse_mult:'Purse multiplier (new events)',fee_mult:'Entry fee multiplier (new events)',sale_chance_mult:'How keen rival coaches are to buy',coach_age_yr:'Career year a golfer may retire to coach'};
const ui={view:'loading',sel:null,msg:'',err:'',busy:false,auth:{mode:'in',email:'',msg:'',err:false,busy:false},tour:null,ev:null,watch:null,board:null,feed:null,pros:{name:'',country:'US',college:'',color:0},full:false};
const D={user:null,me:null,golfers:[],events:[],entries:[],world:null,settings:{...DEFAULTS},coaches:[],market:[],names:{}};
let poll=null,boardPoll=null;

/* ---------- small helpers ---------- */
const S=()=>D.settings;
const mine=()=>D.golfers.filter(g=>!g.retired);
const G=()=>D.golfers.find(g=>g.id===ui.sel)||mine()[0]||D.golfers[0];
const QF='qf',isQ=e=>!!e&&String(e.tour).startsWith('qf');
const qLevel=g=>isCol(g.tour)?'col':g.tour,lvName=lv=>lv==='col'?'College':(TOURS[lv]||{name:lv}).name;
const canPlay=(e,g)=>isQ(e)?e.tour==='qf:'+qLevel(g):e.tour===g.tour;
const T=t=>t===QF?{name:'Quick-Fire Opens'}:String(t).startsWith('qf:')?{name:'Quick-Fire · '+lvName(t.slice(3))}:TOURS[t]||{name:t};
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
function inField(e,g){const x=entryOf(e,g);if(x)return x.status==='in';if(isQ(e))return false;return e.test||g.enter_rule==='all'||(g.enter_rule==='signature'&&['Signature','Finale'].includes(e.type));}
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
    SB.from('events').select('id,tour,season,week,name,ci,type,purse,fee,pm,starts_at,status,rounds_done,field,test,round_min,rounds').gte('starts_at',new Date(Date.now()-3*864e5).toISOString()).order('starts_at').limit(400),
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
  const tabs=[['stable','Roster'],['events','Events'],['standings','Standings'],['market','Market'],['coaches','Coaches'],['news','News'],['guide','How it works']].concat(D.me.is_admin?[['admin','Admin']]:[]);
  n.innerHTML=`<span class="cash${D.me.cash<0?' red':''}">${fmt$(D.me.cash)}</span>`+tabs.map(([v,l])=>`<button class="btn sm${ui.view===v||(v==='events'&&ui.view==='board')?' on':''}" data-act="go" data-v="${v}">${l}</button>`).join('')+`<button class="btn sm" data-act="signOut">Sign out</button>`;
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
  if(!P.college)P.college=pick(COLLEGES);
  if(!p)return `<section class="intro"><h1>Scout a junior</h1><p class="lede">A junior costs nothing and starts as a college freshman.</p></section><section class="sec">${flash()}<button class="btn primary" data-act="scout" data-v="fresh" ${full||ui.busy?'disabled':''}>Send the scouts out</button>${full?`<p class="muted small">Your roster is full at ${S().max_golfers} active golfers.</p>`:''}</section>`;
  const g={sk:p.sk,sessions:0};
  return `<section class="intro"><p class="eyebrow">Junior prospect</p><h1>${esc(p.arch)}</h1><p class="lede">Free. He starts as a college freshman: four college seasons, sixteen as a professional, ten on the senior circuit. One season is one calendar month.</p></section>
<section class="sec prospect stack">
 <label class="field" for="gname"><span>Name</span><input id="gname" type="text" maxlength="22" value="${esc(P.name)}" placeholder="Tucker Hale"></label>
 <label class="field" for="gcountry"><span>Country</span><select id="gcountry">${Object.keys(COUNTRIES).sort((a,b)=>COUNTRIES[a].localeCompare(COUNTRIES[b])).map(c=>`<option value="${c}"${c===P.country?' selected':''}>${COUNTRIES[c]}</option>`).join('')}</select></label>
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
  const ups=D.events.filter(e=>isQ(e)&&canPlay(e,g)&&phase(e)==='open').slice(0,2).concat(D.events.filter(e=>e.tour===g.tour&&e.status!=='final').slice(0,5));
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
 <h2>His events</h2>
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
  const tours=[...new Set(D.events.map(e=>isQ(e)?QF:e.tour))].sort((a,b)=>TORDER.indexOf(a)-TORDER.indexOf(b));
  const t=ui.tour||'all',list=D.events.filter(e=>t==='all'||(t===QF?isQ(e):e.tour===t));
  const qn=D.events.filter(e=>isQ(e)&&phase(e)==='open')[0],qset=qn?D.events.filter(e=>isQ(e)&&e.starts_at===qn.starts_at).sort((a,b)=>['col','p3','p2','p1','c2','c1'].indexOf(a.tour.slice(3))-['col','p3','p2','p1','c2','c1'].indexOf(b.tour.slice(3))):[];
  const live=list.filter(e=>['live','closed'].includes(phase(e))&&e.status!=='final'),next=list.filter(e=>phase(e)==='open'&&!isQ(e)).slice(0,12),done=list.filter(e=>e.status==='final').reverse().slice(0,12);
  const row=e=>`<div class="item"><b>${esc(e.name)}${e.test?' <span class="tag">Test</span>':''}</b><span>${T(e.tour).name}. ${COURSES[e.ci].name}. ${when(e.starts_at)}. Purse ${fmt$(e.purse)}${e.fee?`, entry ${fmt$(e.fee)}`:''}.</span><span>${mineIn(e)}</span><button class="btn sm" data-act="board" data-v="${e.id}">${e.status==='final'?'Results':phase(e)==='open'?'Field':'Watch'}</button></div>`;
  return `<section class="intro"><p class="eyebrow">Season ${D.world?D.world.season:1}${D.world?`, through ${new Date(D.world.season_end+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric'})}`:''}</p><h1>Events</h1><p class="lede">Every event starts on the clock and takes about ${Math.round(4*S().round_min)} minutes: four rounds, one hole every ${Math.round(S().round_min*60/18)} seconds. Everyone watches the same holes at the same time.</p></section>
<section class="sec"><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn sm${t==='all'?' on':''}" data-act="tour" data-v="all">All tours</button>${tours.map(x=>`<button class="btn sm${t===x?' on':''}" data-act="tour" data-v="${x}">${T(x).name}</button>`).join('')}</div></section>
${qn&&(t==='all'||t===QF)?`<section class="sec qfban"><p class="eyebrow">Every ${S().qf_every_min} minutes, all day</p><h2>Quick-Fire Open</h2><p>Two rounds, no cut, about ${Math.round(2*rmin(qn))} minutes. ${fmt$(S().qf_fee)} to enter; the pot starts at ${fmt$(S().qf_base)} and grows ${fmt$(S().qf_add)} with every entry. The top third of the field get paid. ${fmt$(S().qf_bonus)} for most greens hit, ${fmt$(S().qf_bonus)} for the long drive, and ${fmt$(S().qf_ace)} for a hole in one. Only managers\u2019 golfers can win the bonuses, not the tour regulars. It doesn't tire your golfers.</p><p><b>Next ones ${when(qn.starts_at)}. Entries close in ${until(new Date(deadline(qn)).toISOString())}.</b> One event for each level, so every golfer plays his own peers.</p><div class="shop">${qset.map(e=>{const n=mine().filter(g=>canPlay(e,g)).length;return `<div class="item"><b>${lvName(e.tour.slice(3))}</b><span>${n?`${n} of your golfers can play.`:'None of your golfers play at this level.'}</span><button class="btn sm${n?' primary':''}" data-act="board" data-v="${e.id}">${n?'Enter golfers':'See the field'}</button></div>`;}).join('')}</div></section>`:''}
${live.length?`<section class="sec"><h2>On the course now</h2><div class="shop">${live.map(row).join('')}</div></section>`:''}
<section class="sec"><h2>Coming up</h2>${next.length?`<div class="shop">${next.map(row).join('')}</div>`:'<p class="muted">Nothing scheduled.</p>'}</section>
${done.length?`<section class="sec"><h2>Finished</h2><div class="shop">${done.map(row).join('')}</div></section>`:''}`;},
board(){const b=ui.board,e=evNow();
  if(!e)return '<section class="sec"><p class="muted">Loading the board…</p></section>';
  const back='<button class="btn sm" data-act="go" data-v="events">← Events</button>';
  const ph=phase(e);
  const head=`<section class="intro"><p class="eyebrow">${T(e.tour).name}${e.test?' · test event':''}</p><h1>${esc(e.name)}</h1><p class="lede">${COURSES[e.ci].name}: ${COURSES[e.ci].blurb} Starts ${when(e.starts_at)}. ${isQ(e)?`Two rounds, no cut. ${e.status==='open'?`Pot so far ${fmt$(S().qf_base+S().qf_add*((ui.preview&&ui.preview.eid===e.id)?ui.preview.rows.length:0))}`:`Pot ${fmt$(e.purse)}`}.`:`Purse ${fmt$(e.purse)}.`}</p>${back}</section>`;
  if(ph==='open'){const gs=mine().filter(g=>canPlay(e,g));
    return head+`<section class="sec"><h2>Entries close in ${until(new Date(deadline(e)).toISOString())}</h2>${gs.length?`<div class="shop">${gs.map(g=>evItem(e,g,true)).join('')}</div>`:'<p class="muted">None of your golfers play on this tour.</p>'}${flash()}</section>${previewHTML(e)}`;}
  if(ph==='closed')return head+teeHTML(e,b);
  if(!b||!b.players)return head+'<section class="sec"><p class="muted">Loading the board…</p></section>';
  if(!b.players.length)return head+`<section class="sec"><p class="muted">Setting the field. The first tee time is ${until(e.starts_at)} away.</p></section>`;
  return head+(e.status==='final'?podiumHTML(b,e):'')+watchHTML(b,e)+`<div id="boardBox">${boxHTML(b,e)}</div>`;},
standings(){const tours=TORDER,t=ui.tour&&ui.tour!=='all'?ui.tour:(G()&&!G().retired?G().tour:'p1');ui.tour=t;
  const rows=ui.stand&&ui.stand.t===t?ui.stand.rows:null;if(!rows)loadStand(t);
  return `<section class="intro"><p class="eyebrow">Season ${D.world?D.world.season:1}</p><h1>Standings</h1><p class="lede">Points from finished events this season. At the end of the month the top ${Math.round(FIELD*.2)} on each pro tour go up and the bottom ${Math.round(FIELD*.2)} go down.</p></section>
<section class="sec"><div class="row" style="justify-content:flex-start;flex-wrap:wrap">${tours.map(x=>`<button class="btn sm${t===x?' on':''}" data-act="stour" data-v="${x}">${T(x).name}</button>`).join('')}</div></section>
<section class="sec">${!rows?'<p class="muted">Loading…</p>':!rows.length?'<p class="muted">No finished events on this tour yet this season.</p>':`<div class="scroll tall"><table class="tbl"><thead><tr><th class="num">#</th><th>Golfer</th><th>Roster</th><th class="num">Points</th><th class="num">Wins</th><th class="num">Earned</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.golfers&&r.golfers.manager_id===D.user.id?'me':r.golfers&&r.golfers.manager_id?'now':''}"><td class="num">${i+1}</td><td>${r.golfers?flagHTML(r.golfers.country)+esc(r.golfers.name)+ageTag(r.golfers.yr,t):'?'}</td><td class="small">${esc(r.golfers&&r.golfers.stable||'Tour regular')}</td><td class="num">${fmtPts(r.pts)}</td><td class="num">${r.wins||''}</td><td class="num">${fmt$(r.earn)}</td></tr>`).join('')}</tbody></table></div>`}</section>`;},
market(){const full=mine().length>=S().max_golfers,list=D.market.filter(m=>m.manager_id!==D.user.id);
  return `<section class="intro"><h1>Transfer market</h1><p class="lede">Golfers listed by rival coaches and by other managers. Buying from a manager pays them directly.</p></section>
<section class="sec">${flash()}${ui.msg?`<p class="hand">${esc(ui.msg)}</p>`:''}<div class="shop">
 <div class="item"><b>Junior prospect</b><span>Free. Starts as a college freshman and is yours to develop.</span><button class="btn sm" data-act="go" data-v="scout" ${full?'disabled':''}>Scout juniors</button></div>
 ${list.map(m=>{const val=valueOfC(m.sk,m.yr),d=m.ask/val;return `<div class="item"><b>${flagHTML(m.country)}${esc(m.name)}</b><span>${esc(m.arch||'Golfer')}, age ${ageOf(m.yr)}. ${isCol(m.tour)?`${esc(m.college||'')}, college ${(CLASS[m.yr-1]||'').toLowerCase()}`:T(m.tour).name}. Overall ${Math.round(ovr(m.sk))}: short ${Math.round(um(m.sk,'s'))}, irons ${Math.round(um(m.sk,'m'))}, long ${Math.round(um(m.sk,'l'))}, misc ${Math.round(um(m.sk,'x'))}.</span><span>Seller: ${esc(m.stable||'Unknown')}${m.manager_id?' <span class="tag">Manager</span>':''}. Market value ${fmt$(val)}. <b style="font-size:.86rem">${d<.93?'Priced under value':d>1.1?'Priced over value':'Fair price'}</b></span><button class="btn sm" data-act="buy" data-v="${m.id}" ${full||D.me.cash<m.ask||ui.busy?'disabled':''}>Sign for ${fmt$(m.ask)}</button></div>`;}).join('')}
</div><p class="muted small">${full?`Your roster is full at ${S().max_golfers} active golfers. `:''}Rival coaches buy listed golfers too, so the list changes day to day.</p></section>`;},
coaches(){const list=D.coaches.slice().sort((a,b)=>(b.cr.o?coOvrC(b.cr.o):0)-(a.cr.o?coOvrC(a.cr.o):0));
  return `<section class="intro"><h1>Coaches</h1><p class="lede">Retired players coach. Each gives ${S().lessons_per_day} lessons a day across every manager, so the good ones book up. The best coaching multiplies a range session by up to ×${S().coach_max}. Pick a coach for a golfer on his Roster page.</p></section>
<section class="sec">${flash()}<div class="scroll tall"><table class="tbl"><thead><tr><th>Coach</th><th class="num">Short</th><th class="num">Irons</th><th class="num">Long</th><th class="num">Head</th><th class="num">Fee</th><th class="num">Left today</th></tr></thead><tbody>${list.map(c=>{const o=c.cr.o||{};return `<tr class="${c.manager_id===D.user.id?'me':''}"><td>${flagHTML(c.country)}${esc(c.name)} <span class="muted small">${esc(c.stable||'')}</span></td>${'smlx'.split('').map(u=>`<td class="num">${o[u]??'–'}</td>`).join('')}<td class="num">${c.manager_id===D.user.id?'Yours':fmt$(c.cr.price)}</td><td class="num">${c.cr.left}</td></tr>`;}).join('')}</tbody></table></div></section>`;},
guide:()=>guideHTML(),
news:()=>`<section class="intro"><h1>News</h1><p class="lede">${esc(D.me.name)}</p></section><section class="sec">${(D.me.news||[]).length?(D.me.news||[]).map(n=>`<p>${esc(n.t)} <span class="muted small">${when(n.at)}</span></p>`).join(''):'<p class="muted">Nothing yet.</p>'}
 <h2>Roster name</h2><div class="row" style="justify-content:flex-start"><input id="stName" type="text" maxlength="30" value="${esc(D.me.name)}"><button class="btn sm" data-act="rename">Rename</button></div>${flash()}</section>`,
admin(){const s=S();
  return `<section class="intro"><p class="eyebrow">Admin</p><h1>World settings</h1><p class="lede">Changes apply from the next clock tick. Money settings apply to events scheduled after the change. Every change is logged.</p></section>
<section class="sec">${flash()}${ui.msg?`<p class="hand">${esc(ui.msg)}</p>`:''}<div class="shop">${Object.keys(DEFAULTS).map(k=>`<div class="item"><b>${SETN[k]}</b><span class="muted small">Default ${esc(JSON.stringify(DEFAULTS[k]))}</span><input type="text" id="set_${k}" value="${esc(Array.isArray(s[k])?s[k].join(', '):s[k])}"><button class="btn sm" data-act="aset" data-v="${k}">Save</button></div>`).join('')}</div></section>
<section class="sec"><h2>Test event</h2><p class="muted small">Pays no money and no points. All managers' golfers on that tour are entered.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><select id="tTour">${TORDER.map(t=>`<option value="${t}">${T(t).name}</option>`).join('')}</select><label class="field" for="tMin"><span>Starts in (minutes)</span><input id="tMin" type="number" min="6" value="7"></label><button class="btn sm" data-act="atest">Create</button></div></section>
<section class="sec"><h2>Change log</h2><button class="btn sm" data-act="alog">Load</button>${ui.log?`<div class="scroll"><table class="tbl"><tbody>${ui.log.map(l=>`<tr><td class="small">${when(l.at)}</td><td>${SETN[l.key]||l.key}</td><td class="small">${esc(JSON.stringify(l.old))} → ${esc(JSON.stringify(l.new))}</td></tr>`).join('')}</tbody></table></div>`:''}</section>`;},
};
function valueOfC(sk,yr){const o=ovr(sk),a=yr<=4?[.2,.3,.45,.7][yr-1]:yr<=12?1.15-(yr-5)*.02:yr<=20?1-(yr-12)*.07:Math.max(.04,.3-(yr-21)*.03);return Math.max(1000,Math.round(50000*Math.pow(5,(o-64)/6)*a/500)*500);}
function mineIn(e){const gs=mine().filter(g=>canPlay(e,g));if(!gs.length)return'';const inn=gs.filter(g=>inField(e,g));return inn.length?`Yours in: ${inn.map(g=>esc(g.name)).join(', ')}.`:'None of yours entered.';}
function evItem(e,g,full){const ph=phase(e),inn=inField(e,g),x=entryOf(e,g);
  const state=ph!=='open'?(e.status==='final'?'Finished':'Entries closed'):inn?(x&&x.status==='in'?'Entered':'Entered automatically'):'Not entered';
  return `<div class="item"><b>${full?esc(g.name):esc(e.name)}${e.test?' <span class="tag">Test</span>':''}</b><span>${full?'':`${COURSES[e.ci].name}. ${when(e.starts_at)}. `}${e.type}. ${e.fee&&!e.test?`Entry ${fmt$(e.fee)}. `:'No entry fee. '}${ph==='open'?`Closes in ${until(new Date(deadline(e)).toISOString())}.`:''}</span><span class="tag${inn&&ph==='open'?' hot':''}">${state}</span>${ph==='open'?(inn?`<button class="btn sm" data-act="withdraw" data-v="${e.id}" data-g="${g.id}" ${ui.busy?'disabled':''}>Withdraw</button>`:`<button class="btn sm" data-act="enter" data-v="${e.id}" data-g="${g.id}" ${ui.busy?'disabled':''}>Enter</button>`):`<button class="btn sm" data-act="board" data-v="${e.id}">${e.status==='final'?'Results':'Watch'}</button>`}</div>`;}
function careerHTML(g){const s=Object.assign({ev:0,cuts:0,wins:0,top10:0,earn:0,rounds:0,par:0,low:null},g.stats);
  return `${s.qf_ev?`<p class="muted small">Quick-Fire Opens: ${s.qf_ev} played, ${s.qf_wins||0} won, ${fmt$(s.qf_earn||0)} earned${s.qf_aces?`, ${s.qf_aces} hole${s.qf_aces>1?'s':''} in one`:''}. These don't count toward his career record.</p>`:''}<div class="stats"><div><b>${s.ev}</b><span>Events</span></div><div><b>${s.wins}</b><span>Wins</span></div><div><b>${s.top10}</b><span>Top tens</span></div><div><b>${s.ev?s.cuts+'/'+s.ev:'–'}</b><span>Cuts made</span></div><div><b>${s.low===null?'–':fmtPar(s.low)}</b><span>Low round</span></div><div><b>${fmt$(s.earn)}</b><span>Earned</span></div></div>
  ${(g.hist||[]).length?`<div class="scroll"><table class="tbl"><thead><tr><th>Event</th><th class="num">R1</th><th class="num">R2</th><th class="num">R3</th><th class="num">R4</th><th class="num">Par</th><th class="num">Pos</th><th class="num">Won</th></tr></thead><tbody>${g.hist.slice(0,12).map(x=>`<tr><td>${esc(x.n)}</td>${[0,1,2,3].map(j=>`<td class="num">${x.r[j]||''}</td>`).join('')}<td class="num${x.par<0?' under':''}">${fmtPar(x.par)}</td><td class="num">${x.pos}</td><td class="num">${x.pay?fmt$(x.pay):''}</td></tr>`).join('')}</tbody></table></div>`:''}`;}
function sellHTML(g){if(!canSellC(g))return '<p class="muted">College freshmen and sophomores can’t be sold.</p>';const val=valueOfC(g.sk,g.yr);
  return g.ask?`<p>Listed at ${fmt$(g.ask)} (market value ${fmt$(val)}). Rival coaches look once a day; other managers can buy him any time.</p><button class="btn sm" data-act="unlist">Take him off the market</button>`
  :`<p class="muted">Market value about ${fmt$(val)}. A rival coach will take him now for ${fmt$(Math.round(val*.6/100)*100)}.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><input id="askIn" type="number" min="1000" step="500" value="${val}"><button class="btn sm" data-act="list">List him</button>${ui.confirm==='qs'?'<button class="btn sm primary" data-act="quicksell">Yes, sell now</button>':'<button class="btn sm" data-act="confirm" data-v="qs">Quick sale</button>'}</div>`;}
const canSellC=g=>g.yr>=3;
function coachMine(g){const cr=g.cr;if(!cr)return '<section class="sec"><p class="muted">Retired.</p></section>';const o=cr.o||{};
  return `<section class="sec"><h2>Coaching</h2><p class="lede">${esc(g.name)} coaches for you. His lessons are free for your golfers. ${cr.given||0} lessons to other rosters so far, for ${fmt$(cr.earn||0)}.</p>
  <p>Short game ${o.s??'–'}, irons ${o.m??'–'}, long game ${o.l??'–'}, the head ${o.x??'–'}. ${cr.left} lessons left today.</p>
  <div class="row" style="justify-content:flex-start"><label class="field" for="feeIn"><span>Fee per lesson</span><input id="feeIn" type="number" min="50" step="50" value="${cr.price}"></label><button class="btn sm" data-act="fee">Set fee</button></div>${flash()}
  <p class="muted small">Rival managers book what's left of his day each night; a fee near what he's worth books best.</p></section>`;}

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
  const dr=top('drive',v=>v+' yds'),gi=top('gir',v=>v);
  return `<section class="qflive"><div class="qfcard"><h3>Long drive</h3><p class="muted small">${fmt$(S().qf_bonus)} bonus</p><ol>${dr||'<li class="muted">No drives yet from managers\u2019 golfers</li>'}</ol></div>
 <div class="qfcard"><h3>Greens hit</h3><p class="muted small">${fmt$(S().qf_bonus)} bonus for the most</p><ol>${gi||'<li class="muted">No greens yet from managers\u2019 golfers</li>'}</ol></div>
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
  const gi=best('gir'),dr=best('drive'),aces=rows.filter(r=>X(r).aces);const nm=w=>w.map(r=>`${flagHTML(r.p.country)}${esc(r.p.name)}${r.p.managed?` <span class="muted small">(${esc(r.p.stable||'')})</span>`:''}`).join(', ');
  return `${aces.length?`<div class="ace"><b>Hole in one!</b> ${nm(aces)}${aces.some(r=>r.p.managed)?` collects ${fmt$(S().qf_ace)}.`:'.'}</div>`:''}<div class="shop">${gi?`<div class="item"><b>Most greens hit: ${gi.m} of 36</b><span>${nm(gi.w)}</span><span class="tag hot">${fmt$(S().qf_bonus)}${gi.w.length>1?' shared':''}</span></div>`:''}${dr?`<div class="item"><b>Long drive: ${dr.m} yards</b><span>${nm(dr.w)}</span><span class="tag hot">${fmt$(S().qf_bonus)}${dr.w.length>1?' shared':''}</span></div>`:''}</div>`;}
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
async function loadPreview(e){
  if(isQ(e)){const en=await SB.from('entries').select('golfer_id').eq('event_id',e.id).eq('status','in');const ids=(en.data||[]).map(x=>x.golfer_id);const gs=ids.length?await SB.from('golfers').select('id,name,country,college,stable,manager_id,sk,yr,tour').in('id',ids):{data:[]};const rows=(gs.data||[]).map(g=>({g,how:'Entered'}));rows.sort((a,b)=>ovr(b.g.sk)-ovr(a.g.sk));ui.preview={eid:e.id,rows};return;}
  const [gs,en]=await Promise.all([SB.from('golfers').select('id,name,country,college,stable,manager_id,sk,yr,enter_rule').eq('tour',e.tour).eq('retired',false).not('manager_id','is',null),SB.from('entries').select('golfer_id,status').eq('event_id',e.id)]);
  const st=new Map((en.data||[]).map(x=>[x.golfer_id,x.status]));
  const rows=(gs.data||[]).map(g=>{const s=st.get(g.id),auto=e.test||g.enter_rule==='all'||(g.enter_rule==='signature'&&['Signature','Finale'].includes(e.type));return{g,how:s==='in'?'Entered':s==='out'?null:auto?'Entered automatically':null};}).filter(r=>r.how);
  rows.sort((a,b)=>ovr(b.g.sk)-ovr(a.g.sk));ui.preview={eid:e.id,rows};}
function previewHTML(e){const P=ui.preview&&ui.preview.eid===e.id?ui.preview.rows:null;
  return `<section class="sec"><h2>The field so far</h2>${!P?'<p class="muted">Loading…</p>':!P.length?'<p class="muted">No managers\u2019 golfers are in yet.</p>':`<div class="scroll"><table class="tbl"><thead><tr><th>Golfer</th><th>Roster</th><th class="num">Overall</th></tr></thead><tbody>${P.map(r=>`<tr class="${r.g.manager_id===D.user.id?'me':'now'}"><td>${flagHTML(r.g.country)}${esc(r.g.name)}${ageTag(r.g.yr,r.g.tour)}${isCol(e.tour)?` <span class="muted small">${esc(r.g.college||'')}</span>`:''}${r.how==='Entered automatically'?' <span class="muted small">(auto)</span>':''}</td><td class="small">${esc(r.g.stable||'')}</td><td class="num">${Math.round(ovr(r.g.sk))}</td></tr>`).join('')}</tbody></table></div>`}
  <p class="muted small">${P?`${P.length} golfer${P.length===1?'':'s'} from managers\u2019 rosters so far. `:''}When entries close, tour regulars fill the rest of the ${FIELD} spots. Auto entries can still withdraw before then.</p></section>`;}
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
function camFor(A,green){const cv=document.getElementById('cv'),W=cv.width,H=cv.height,h=A.h;
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
function drawMap(dt){
  const A=ui.anim,cv=document.getElementById('cv');if(!cv||!A.h)return;const c=cv.getContext('2d'),W=cv.width,H=cv.height,h=A.h,shots=A.cur.shots,sh=shots[Math.min(A.si,shots.length-1)];
  const moving=A.phase==='shot',e=moving?1-Math.pow(1-A.t,2.2):1,ball=moving?lerp(sh.from,sh.to,e):sh.to;
  const tgt=camFor(A,dist(moving?sh.from:sh.to,h.green)<=52);
  if(!A.cam)A.cam=tgt;else{const k=1-Math.exp(-(dt||16)/260);A.cam={x:A.cam.x+(tgt.x-A.cam.x)*k,y:A.cam.y+(tgt.y-A.cam.y)*k,s:A.cam.s+(tgt.s-A.cam.s)*k};}
  const cam=A.cam,X=x=>(x-cam.x)*cam.s+W/2,Y=y=>H/2-(y-cam.y)*cam.s,Sc=cam.s;
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
const ageTag=(yr,tour)=>yr?`<small class="age">${isCol(tour)?`${ageOf(yr)} · ${CLS[yr-1]||''}`:`Age ${ageOf(yr)}`}</small>`:'';
function guideHTML(){const s=S(),ev=Math.round(4*s.round_min),Z=Math.round(FIELD*.2),cy=s.coach_age_yr,ca=ageOf(cy);
  const stage=(cls,name,yrs,ages,body)=>`<div class="gstage ${cls}"><div class="ghead"><b>${name}</b><span>${yrs}</span><span class="gage">${ages}</span></div><div class="gbody">${body}</div></div>`;
  return `<section class="intro"><p class="eyebrow">How it works</p><h1>The game in five minutes</h1><p class="lede">Range Rat is a golf management game. You never hit a shot. You sign young golfers, decide how they train, pick their events and watch them play on the clock alongside everyone else's golfers. Each golfer has hidden ceilings, a temperament and good and bad days, so no two careers go the same way.</p>${D.me?'':'<button class="btn sm" data-act="go" data-v="auth">← Back to sign in</button>'}</section>

<section class="sec gsec"><h2>Time in Range Rat</h2>
<div class="gfacts">
 <div><b>1 month</b><span>One season. A new one starts on the 1st.</span></div>
 <div><b>30 seasons</b><span>A full career, about two and a half years of real time.</span></div>
 <div><b>~${s.events_per_season}</b><span>Events per tour each season, on weeknight evenings, 6 to 10pm New York time.</span></div>
 <div><b>~${ev} min</b><span>One event: four rounds, one hole every ${Math.round(s.round_min*60/18)} seconds, played live for everyone at once.</span></div>
</div>
<p>Every night at midnight New York time the world refreshes: each golfer gets a new range session, recovers some stamina, and coaches open their diaries for the next day.</p></section>

<section class="sec gsec"><h2>The life of a golfer</h2><p class="muted">A golfer moves up a year at the end of every season, so one calendar month is one year of his life on the course.</p>
<div class="gline">
${stage('col','College','Seasons 1 to 4','Ages 18 to 21',`<p>Every junior you sign starts as a college <b>freshman</b>, then plays his sophomore, junior and senior years. His school decides his circuit: the ${TOURS.col0.name}, ${TOURS.col1.name} or ${TOURS.col2.name} (16 schools each). You can change schools while he's in college.</p><p>When his senior year ends, the top ${Z} in his circuit's standings turn pro on the <b>${TOURS.p2.name}</b>. Everyone else starts on the <b>${TOURS.p3.name}</b>.</p>`)}
${stage('pro','Professional','Seasons 5 to 20','Ages 22 to 49',`<p>Three tours, from bottom to top: <b>${TOURS.p3.name}</b>, <b>${TOURS.p2.name}</b> and <b>${TOURS.p1.name}</b>. At the end of every season the top ${Z} in the standings are promoted a tour and the bottom ${Z} are relegated.</p><p>From about age 40 his power and driving accuracy slowly start to fade.</p>`)}
${stage('sen','Senior','Seasons 21 to 30','Ages 50 to 59',`<p>At 50 he moves to the senior game. Golfers coming off the ${TOURS.p1.name}, and the top ${Z} from the ${TOURS.p2.name}, start on the <b>${TOURS.c1.name}</b>. Everyone else starts on the <b>${TOURS.c2.name}</b>. The same promotion and relegation applies between the two.</p><p>His short game and irons now fade a little each season too.</p>`)}
${stage('ret','Retirement','After season 30','Age 59 on',`<p>After his 30th season he retires and opens a coaching practice. You can also retire him early, any time from age ${ca} (season ${cy}).</p>`)}
</div>
<div class="scroll"><table class="tbl gtable"><thead><tr><th>Tour</th><th>Level</th><th class="num">Usual purse</th><th class="num">Entry fee</th></tr></thead><tbody>
${['col','p3','p2','p1','c2','c1'].map(t=>`<tr><td>${t==='col'?'College circuits':TOURS[t].name}</td><td class="small">${{col:'Seasons 1–4',p3:'Pro, bottom',p2:'Pro, middle',p1:'Pro, top',c2:'Senior, lower',c1:'Senior, top'}[t]}</td><td class="num">${fmt$(TOURS[t].purse*s.purse_mult)}</td><td class="num">${TOURS[t].fee?fmt$(TOURS[t].fee*s.fee_mult):'Free'}</td></tr>`).join('')}
</tbody></table></div><p class="muted small">Signature events and the season Finale pay more than a standard event; smaller events pay less.</p></section>

<section class="sec gsec"><h2>Training</h2>
<p>Each golfer gets <b>${s.sessions_per_day} range session${s.sessions_per_day>1?'s':''} a day</b>. A <b>drill</b> works one skill hard; a <b>general session</b> lifts a whole area (short game, irons, long game or the mental side) a little. A day off restores stamina.</p>
<p>Every skill has a hidden <b>ceiling</b>. The scouts' grades hint at it, and gains shrink as he gets close. Areas he doesn't work on get slightly rusty each day. Tired golfers train and play worse, and every event costs some stamina.</p>
<p><b>Standing orders</b> spend a session he didn't use by midnight, so a golfer keeps improving even on days you don't log in.</p></section>

<section class="sec gsec"><h2>Events</h2>
<p>Enter golfers by hand, or set an automatic rule for each one (every event, or only the big ones). Entries close <b>${s.deadline_min} minutes</b> before the start, then the field is set: managers' golfers first, then tour regulars, ${FIELD} in all.</p>
<p>Four rounds. After two, the top ${CUT} and ties make the <b>cut</b>. Finishing positions earn prize money and <b>season points</b>. At the end of the month the season standings decide promotion and relegation and pay a bonus to the leaders: half a standard purse for the winner, then smaller bonuses down to the top ${Z}.</p>
<p><b>Quick-Fire Opens</b> run every ${s.qf_every_min} minutes, all day, one for each level: college, each pro tour and each senior tour. They're two rounds with no cut and cost ${fmt$(s.qf_fee)} to enter. The pot starts at ${fmt$(s.qf_base)} and grows with every entry, and the top third of the field get paid. There are bonuses for most greens hit, the long drive and holes in one, for managers' golfers only. They don't tire golfers or count toward their career.</p></section>

<section class="sec gsec"><h2>Retirement and coaching</h2>
<p>A retired golfer becomes a <b>coach</b> rated in four areas: short game, irons, long game and the head. Coaching talent is partly luck, but the better he played, the higher his floor: a former ${TOURS.p1.name} winner is never a bad coach.</p>
<div class="gfacts">
 <div><b>×${s.coach_max}</b><span>The most a great coach multiplies a range session by, in his best area.</span></div>
 <div><b>${s.lessons_per_day} a day</b><span>Lessons each coach gives, shared across every manager. Good coaches book up.</span></div>
 <div><b>Free</b><span>Lessons from your own retired golfers, for your own roster.</span></div>
 <div><b>You set it</b><span>The fee other managers pay to book your coaches. Rival stables book his spare lessons each night, and the fees come to you.</span></div>
</div>
<p>Pick a coach for any golfer on his Roster page. Booking is per session: if the coach is full that day, your golfer trains alone.</p></section>

<section class="sec gsec"><h2>Money and the market</h2>
<p>New rosters start with ${fmt$(s.start_cash)} and up to ${s.max_golfers} active golfers. Money comes from prize money, season bonuses, coaching fees and sales. It goes on entry fees, lessons and equipment (${EQC.map(fmt$).join(', ')} for each upgrade).</p>
<p>Juniors are free to sign. College juniors and seniors and anyone older can be sold: list a golfer at your price for other managers and rival coaches, or take a quick sale at about 60% of his market value. Golfers you sell keep playing, so you'll meet them in the field.</p></section>`;}

/* ---------- render and events ---------- */
function keepScroll(fn){const bs=document.getElementById('bscroll'),top=bs?bs.scrollTop:0,y=window.scrollY;fn();const b2=document.getElementById('bscroll');if(b2&&top)b2.scrollTop=top;if(Math.abs(window.scrollY-y)>2)window.scrollTo(0,y);}
function route(){const v=ui.view;if(['loading','auth','join'].includes(v))return '';
  return '#'+(v==='board'&&ui.ev?'board/'+ui.ev+(ui.watch?'/'+ui.watch:''):v==='stable'&&ui.sel?'stable/'+ui.sel:(v==='standings'||v==='events')&&ui.tour?v+'/'+ui.tour:v);}
function applyRoute(){const h=decodeURIComponent(location.hash.slice(1));if(!h||h.includes('=')||!D.me)return false;const [v,a,b]=h.split('/');
  if(!V[v]||['loading','auth','join'].includes(v)||(v==='admin'&&!D.me.is_admin))return false;
  ui.view=v;if(v==='stable'&&a)ui.sel=a;if((v==='standings'||v==='events')&&a)ui.tour=a;
  if(v==='board'){if(!a)return false;ui.ev=a;ui.watch=b||null;ui.anim=null;ui.board=null;
    loadBoard().then(()=>{const e=evNow();if(e&&phase(e)==='open')return loadPreview(e).then(render);render();});}
  return true;}
function render(){nav();const v=document.getElementById('view');const f=V[ui.view]||V.loading;
  const r=route();if(r&&location.hash!==r)history.replaceState(null,'',r);
  const a=document.activeElement,id=a&&a.id,val=a&&a.value;keepScroll(()=>{v.innerHTML=f();});
  if(id){const n=document.getElementById(id);if(n&&n!==a){n.focus();if(n.type==='text'&&val!==undefined)n.value=val;}}
  if(ui.view==='board'&&ui.watch&&document.getElementById('cv'))startLoop();
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
  if(a==='watch'){ui.watch=v;ui.anim=null;loadWatch().then(()=>{syncAnim();render();window.scrollTo(0,0);});return;}
  if(a==='wStop'){ui.watch=null;ui.anim=null;return render();}
  if(a==='wPause'&&ui.anim){ui.anim.paused=!ui.anim.paused;return paintSide();}
  if(a==='wSpeed'&&ui.anim){ui.anim.speed=+v;document.querySelectorAll('[data-act=wSpeed]').forEach(x=>x.classList.toggle('on',x.dataset.v===v));return;}
  if(a==='wLive'&&ui.anim){ui.anim.live=true;const F=(ui.feed||[]).slice().sort((p,q)=>hkey(p.round,p.hole)-hkey(q.round,q.hole)),l=F[F.length-1];if(l)beginHole(l);b.classList.add('on');return;}
  if(a==='wRound'&&ui.anim){ui.anim.cardR=+v;return paintSide();}
  if(a==='wHole'&&ui.anim){const [r,h]=v.split('-').map(Number),x=(ui.feed||[]).find(q=>q.round===r&&q.hole===h);if(x){ui.anim.live=false;const lb=document.querySelector('[data-act=wLive]');if(lb)lb.classList.remove('on');beginHole(x);}return;}
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
  if(a==='aset'){let raw=val('set_'+v),x;const d=DEFAULTS[v];x=Array.isArray(d)?raw.split(/[ ,]+/).filter(Boolean).map(Number):typeof d==='number'?Number(raw):typeof d==='boolean'?/^(true|yes|on|1)$/i.test(raw.trim()):raw;if(Array.isArray(x)?x.some(isNaN):typeof x==='number'&&isNaN(x)){ui.err='That needs a number.';return render();}return act('adminSet',{key:v,value:x},()=>{ui.msg='Saved.';});}
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
    if(e&&phase(e)==='open'){(Date.now()%15000<5000?loadPreview(e):Promise.resolve()).then(()=>{const a=document.activeElement;if(!(a&&a.tagName==='SELECT'))keepScroll(render);});return;}
    const was=ui.board&&ui.board.event&&ui.board.event.status,hadPlayers=ui.board&&ui.board.players&&ui.board.players.length;
    loadBoard().then(()=>{const a=document.activeElement;if(a&&a.tagName==='SELECT')return;const e2=evNow(),bb=document.getElementById('boardBox');
      const changed=!ui.board||ui.board.event.status!==was||!hadPlayers;
      if(bb&&ui.board&&e2&&!changed){keepScroll(()=>{bb.innerHTML=boxHTML(ui.board,e2);});paintSide();}
      else{if(e2&&ui.board&&ui.board.event.status==='final'){const d=D.events.find(x=>x.id===ui.ev);if(d)d.status='final';}render();}});},5000);
}else document.getElementById('view').innerHTML='<p class="lede">Couldn’t load the game. Refresh to try again.</p>';
window.addEventListener('resize',()=>{if(document.getElementById('cv'))fitCanvas();});
