/* ===== UI ===== */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='rangerat.v1',SESSIONS=4,MAXG=8,START_CASH=25000;
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
/* What the market pays: rating first, then how many good years are left. */
/* What rival coaches would pay. College golfers are worth a fraction of a professional of the same rating, and nobody bids on freshmen or sophomores. */
function valueOf(sk,yr){const o=ovr(sk),a=yr<=4?[.2,.3,.45,.7][yr-1]:yr<=12?1.15-(yr-5)*.02:yr<=20?1-(yr-12)*.07:Math.max(.04,.3-(yr-21)*.03);return Math.max(1000,Math.round(50000*Math.pow(5,(o-64)/6)*a/500)*500);}
const canSell=g=>g.yr>=3;
const clk=t=>{const c=save.cal||(save.cal={});return c[t]||(c[t]={s:1,w:0});};
const place=g=>{if(g.tour==='col')g.tour='col'+confOf(collegeOf(g));return g;};
/* A golfer landing on a tour mid-season: if none of yours are there, that tour starts a fresh season for him; otherwise he plays out a part-season that doesn't count. */
function arriveAll(list){
  const by={};list.forEach(g=>{if(!g.retired)(by[g.tour]=by[g.tour]||[]).push(g);});
  for(const t in by){const c=clk(t),res=active().some(g=>g.tour===t&&!by[t].includes(g));
    if(c.w>0&&!res){c.s++;c.w=0;delete save.stand[t];}
    by[t].forEach(g=>{g.late=c.w>0;g.sPts=0;g.sWins=0;g.sEarn=0;});}
}
/* ---- coaching: every golfer carries four coaching traits from birth; a great playing career lifts the floor ---- */
const CU={s:'Short game',m:'Irons',l:'Long game',x:'Mental'},LESSONS=5,COACH_AGE_YR=15,TRANK={p3:1,c2:2,p2:3,c1:4,p1:5};
function rawCo(seed){const r=mulberry32(hash('coach-'+seed)),o={},star='smlx'[Math.floor(r()*4)],has=r()<.22;
  for(const u of'smlx')o[u]=Math.round(clamp(28+r()*44+gaussR(r)*7+(has&&u===star?18:0),12,97));return o;}
const coFloor=best=>clamp((best-62)*2.3,0,72);
const coLift=(raw,best)=>{const f=coFloor(best),o={};for(const u of'smlx')o[u]=Math.round(clamp(Math.max(raw[u],f-3+(raw[u]%7)),12,97));return o;};
const coachRatings=g=>coLift(g.co||rawCo(g.id),Math.max(g.best||0,ovr(g.sk)));
const coOvr=o=>(o.s+o.m+o.l+o.x)/4;
/* range gains multiplier: nothing below 35, up to x1.50 at 95 and above */
const coMult=v=>1+.5*Math.pow(clamp((v-35)/60,0,1),1.2);
const pBook=ratio=>clamp(1.25-.6*ratio,0,.95);
function binom(n,p){let k=0;for(let i=0;i<n;i++)if(R()<p)k++;return k;}
function bestTour(g){return(g.seasons||[]).map(x=>x.tour).concat([g.tour]).filter(t=>TRANK[t]).sort((a,b)=>TRANK[b]-TRANK[a])[0]||'col0';}
const fameOf=g=>({wins:g.stats.wins,titles:g.trophies.filter(t=>t.title).length,best:bestTour(g),top10:g.stats.top10,low:g.stats.low,peak:Math.round(Math.max(g.best||0,ovr(g.sk)))});
function fairPrice(o,f){return Math.max(250,Math.round(350*Math.pow(1.065,coOvr(o)-40)*(1+.03*Math.min(f.wins||0,25)+.12*(f.titles||0)+(f.best==='p1'?.3:f.best==='c1'||f.best==='p2'?.1:0))/50)*50);}
function aiCoach(seed){
  const r=mulberry32(hash('aic-'+seed)),c=r()<.34?'US':CN[Math.floor(r()*CN.length)],N=NAMES[c],name=N[0][Math.floor(r()*N[0].length)]+' '+N[1][Math.floor(r()*N[1].length)];
  const best=['p1','p1','p2','c1','p2','p3','p1','c2'][Math.floor(r()*8)],peak=Math.round({p1:78,c1:74,p2:73,c2:69,p3:68}[best]+gaussR(r)*4);
  const wins=Math.round({p1:4,c1:5,p2:3,c2:3,p3:2}[best]*r()*r()*3),titles=r()<.2?1+Math.floor(r()*2):0,fame={wins,titles,best},co=coLift(rawCo('ai'+seed),peak);
  const price=Math.max(250,Math.round(fairPrice(co,fame)*(.75+r()*.6)/50)*50),given=Math.floor(r()*400);
  return{id:'ai'+seed,name,country:c,age:48+Math.floor(r()*24),co,fame,peak,earn:Math.round(TOURS[best].purse*(.05+r()*.4)*(4+r()*14)/1000)*1000,seasons:22+Math.floor(r()*9),mgr:RIVALS[Math.floor(r()*RIVALS.length)],price,left:LESSONS,given,cearn:Math.round(given*price*.8)};
}
function ensureCoaches(){if(!save.coaches)save.coaches=[];while(save.coaches.length<14)save.coaches.push(aiCoach(Math.floor(R()*1e9)));}
function coachObj(id){
  if(!id||!save)return null;const g=save.golfers.find(x=>x.id===id&&x.retired&&x.cr);
  if(g)return{id,own:true,g,name:g.name,co:coachRatings(g),price:0,left:g.cr.left};
  ensureCoaches();const c=save.coaches.find(x=>x.id===id);return c?{id,ai:c,name:c.name,co:c.co,price:c.price,left:c.left}:null;
}
function useLesson(c){if(c.own){c.g.cr.left--;c.g.cr.own=(c.g.cr.own||0)+1;}else{c.ai.left--;c.ai.given++;c.ai.cearn+=c.ai.price;}}
function allCoaches(){ensureCoaches();return save.golfers.filter(g=>g.retired&&g.cr).map(g=>coachObj(g.id)).concat(save.coaches.map(c=>coachObj(c.id)));}
function retireToCoach(g){
  g.best=Math.max(g.best||0,ovr(g.sk));if(!g.co)g.co=rawCo(g.id);g.retired=true;g.ask=null;g.retAge=ageOf(g.yr);
  g.cr={price:fairPrice(coachRatings(g),fameOf(g)),left:LESSONS,earn:0,given:0,own:0,last:null};
}
/* a week passes for every coach: rival managers book the lessons that are still free */
function coachWeek(news){
  ensureCoaches();
  save.golfers.filter(g=>g.retired&&g.cr).forEach(g=>{const cr=g.cr,fair=fairPrice(coachRatings(g),fameOf(g)),n=binom(Math.max(0,cr.left),pBook(cr.price/fair)),inc=n*cr.price;
    save.cash+=inc;cr.earn+=inc;cr.given+=n;cr.last=n;cr.left=LESSONS;
    news.push(n?`${g.name} gave ${n} lesson${n===1?'':'s'} to rival managers' golfers and earned ${fmt$(inc)}.`:`Nobody booked ${g.name} at ${fmt$(cr.price)} a lesson.`);});
  save.coaches.forEach(c=>{const fair=fairPrice(c.co,c.fame),n=binom(Math.max(0,c.left),pBook(c.price/fair)*.85);c.given+=n;c.cearn+=n*c.price;
    if(c.left-n<=0)c.price=Math.round(c.price*1.08/50)*50;else if(n===0)c.price=Math.max(250,Math.round(c.price*.95/50)*50);
    c.left=LESSONS-binom(LESSONS,pBook(c.price/fair)*.45);});
  save.coaches=save.coaches.filter(()=>R()>.02);ensureCoaches();
}
const cobars=o=>`<div class="cobars">${'smlx'.split('').map(u=>`<span>${CU[u]}</span><div class="track"><i style="width:${o[u]}%"></i></div><b>${o[u]}</b><span class="mx">×${coMult(o[u]).toFixed(2)}</span>`).join('')}</div>`;
function achChips(f){const a=[];if(f.best&&TOURS[f.best])a.push('Best tour: '+TOURS[f.best].name);a.push(`${f.wins||0} win${f.wins===1?'':'s'}`);if(f.titles)a.push(`${f.titles} season title${f.titles===1?'':'s'}`);if(f.top10)a.push(`${f.top10} top tens`);if(f.low!==null&&f.low!==undefined)a.push('Low round '+fmtPar(f.low));if(f.peak)a.push('Peak rating '+f.peak);return `<div class="chips">${a.map(x=>`<span class="tag">${x}</span>`).join('')}</div>`;}
function coachBlock(g){const o=coachRatings(g);return `<div class="sec"><div class="uhead"><div><h2>Coaching ability</h2><small>${g.retired&&g.cr?`Coaching now, ${fmt$(g.cr.price)} a lesson`:g.yr>=COACH_AGE_YR?'Old enough to retire into coaching now':'What he could teach once he retires (age 40 or later)'}</small></div><b>${Math.round(coOvr(o))}</b></div>${cobars(o)}<p class="muted small">The multiplier is what a lesson from him does to a range session. A strong playing career raises the floor on all four.</p></div>`;}
function coachPick(g){
  const list=allCoaches().filter(Boolean).sort((a,b)=>(b.own?1:0)-(a.own?1:0)||coOvr(b.co)-coOvr(a.co)),c=coachObj(g.coachId);
  return `<div class="row" style="justify-content:flex-start;align-items:flex-end"><label class="field" for="coachSel"><span>Lessons this week</span><select id="coachSel"><option value="">Work alone, no fee</option>${list.map(x=>`<option value="${x.id}"${g.coachId===x.id?' selected':''}>${esc(x.name)} (${Math.round(coOvr(x.co))}): S ×${coMult(x.co.s).toFixed(2)}, I ×${coMult(x.co.m).toFixed(2)}, L ×${coMult(x.co.l).toFixed(2)}, M ×${coMult(x.co.x).toFixed(2)}. ${x.own?'Yours, free':fmt$(x.price)+' a lesson'}, ${x.left} left</option>`).join('')}</select></label><button class="btn sm" data-act="go" data-v="coaches">Browse coaches</button></div>
 <p class="muted small">${c?`Each range session uses one of ${esc(c.name)}'s lessons${c.own?'':` and costs ${fmt$(c.price)}`}. ${c.left} of ${LESSONS} left this week. A day off doesn't use one.`:'No coach booked. Range sessions run at normal speed.'}</p>`;
}
function viewCoaches(){
  ensureCoaches();const mine=save.golfers.filter(g=>g.retired&&g.cr),act=active(),elig=act.filter(g=>g.yr>=COACH_AGE_YR),ai=save.coaches.slice().sort((a,b)=>coOvr(b.co)-coOvr(a.co));
  const users=id=>act.filter(g=>g.coachId===id).map(g=>esc(g.name));
  const bookSel=(id,name)=>act.length?`<div class="row" style="justify-content:flex-start"><select id="book-${id}" aria-label="Golfer to book ${esc(name)} for">${act.map(g=>`<option value="${g.id}">${esc(g.name)}${g.coachId===id?' (booked)':''}</option>`).join('')}</select><button class="btn sm" data-act="bookCoach" data-v="${id}">Book for this golfer</button></div>`:'';
  return `<section class="intro"><p class="eyebrow">Coaches</p><h1>Lessons from retired players</h1>
<p class="lede">Book a coach for a golfer and each range session he takes becomes a lesson. It costs the coach's fee and multiplies that session's gains by the coach's rating for that part of the game, up to ×1.50. A coach gives ${LESSONS} lessons a week, shared with every other manager's golfers.</p></section>
<section class="sec"><h2>Your coaching staff</h2>
${mine.length?`<div class="gcards">${mine.map(g=>{const o=coachRatings(g),f=fameOf(g),fair=fairPrice(o,f),cr=g.cr,exp=LESSONS*pBook(cr.price/fair),u=users(g.id);return `<div class="gcard"><div class="row"><div class="who">${avatarHTML(g)}<div><p class="eyebrow">${flagHTML(g.country)}Retired at ${g.retAge||ageOf(g.yr)}</p><h2>${esc(g.name)}</h2></div></div><span class="bignum" title="Coaching rating">${Math.round(coOvr(o))}</span></div>
 ${cobars(o)}${achChips(f)}
 <div class="stats"><div><b>${fmt$(g.stats.earn)}</b><span>Playing earnings</span></div><div><b>${fmt$(cr.earn)}</b><span>Coaching earnings</span></div><div><b>${fmt$(g.stats.earn+cr.earn)}</b><span>Lifetime</span></div><div><b>${cr.given}</b><span>Lessons for rivals</span></div><div><b>${cr.own||0}</b><span>Lessons for yours</span></div></div>
 <p class="muted small">${cr.left} of ${LESSONS} lessons left this week${u.length?`. Booked by ${u.join(', ')}, free of charge`:''}.${cr.last!==null&&cr.last!==undefined?` Last week rival managers booked ${cr.last}.`:''}</p>
 <div class="row" style="justify-content:flex-start;align-items:flex-end"><label class="field" for="cprice-${g.id}"><span>Fee per lesson</span><input type="number" id="cprice-${g.id}" min="250" step="250" value="${cr.price}"></label><button class="btn sm" data-act="setPrice" data-v="${g.id}">Set fee</button></div>
 <p class="muted small">Rival managers reckon he's worth about ${fmt$(fair)} a lesson. At ${fmt$(cr.price)} expect about ${exp.toFixed(1)} bookings a week from his spare lessons, roughly ${fmt$(exp*cr.price)}.</p>
 ${bookSel(g.id,g.name)}</div>`}).join('')}</div>`:'<p class="muted">Nobody yet. A golfer who retires joins your staff as a coach.</p>'}
 <p class="muted small">${elig.length?`Old enough to retire into coaching now: ${elig.map(g=>`${esc(g.name)} (age ${ageOf(g.yr)}, coaching ${Math.round(coOvr(coachRatings(g)))})`).join(', ')}. Retire them from their Manage page.`:'Golfers can retire into coaching from age 40, which is career season 15. Everyone retires after 30 seasons and opens a practice then.'}</p>
</section>
<section class="sec"><h2>Coaches for hire</h2>
<div class="gcards">${ai.map(c=>{const d=c.price/fairPrice(c.co,c.fame),u=users(c.id);return `<div class="gcard"><div class="row"><div><p class="eyebrow">${flagHTML(c.country)}Age ${c.age}. With ${esc(c.mgr)}</p><h2>${esc(c.name)}</h2></div><span class="bignum" title="Coaching rating">${Math.round(coOvr(c.co))}</span></div>
 ${cobars(c.co)}${achChips(Object.assign({peak:c.peak},c.fame))}
 <p class="muted small">${c.former?'Played for your stable before you sold him. ':''}${c.seasons} seasons, ${fmt$(c.earn)} career earnings. ${c.given.toLocaleString()} lessons given, ${fmt$(c.cearn)} from coaching.</p>
 <div class="row"><span><b class="cash">${fmt$(c.price)}</b> a lesson. <span class="muted small">${d<.9?'Under the going rate':d>1.15?'Over the going rate':'Around the going rate'}</span></span><span class="muted small">${c.left} of ${LESSONS} left this week</span></div>
 ${u.length?`<p class="muted small">Booked by ${u.join(', ')}.</p>`:''}${bookSel(c.id,c.name)}</div>`}).join('')}</div>
</section>`;
}
function up5(s){
  if(!s.cal)s.cal={};if(!s.sold)s.sold=[];if(!s.stand)s.stand={};
  s.golfers.concat(s.sold).forEach(g=>{if(g.tour==='col')g.tour='col'+confOf(collegeOf(g));});
  delete s.stand.col;
  let refund=0;s.golfers.forEach(g=>{if(g.coach)refund+=[0,15000,75000,350000][g.coach]||0;delete g.coach;if(!g.co)g.co=rawCo(g.id);g.best=Math.max(g.best||0,ovr(g.sk));if(g.coachId===undefined)g.coachId=null;
    if(g.retired&&!g.cr){g.retAge=g.retAge||ageOf(g.yr);g.cr={price:fairPrice(coachRatings(g),fameOf(g)),left:LESSONS,earn:0,given:0,own:0,last:null};}});
  if(refund){s.cash+=refund;s.news=(s.news||[]).concat([`The old coaching packages are gone. ${fmt$(refund)} was refunded. Book lessons from retired players on the Coaches page.`]);}
  s.golfers.forEach(g=>{if(!s.cal[g.tour])s.cal[g.tour]={s:s.season||1,w:Math.min(s.week||0,WEEKS-1)};if(g.yr<3)g.ask=null;});
  return s;
}

/* ---- saving: this browser, the signed-in Claude account when it allows writes, and a copyable save code ---- */
function blankStats(){return{ev:0,cuts:0,wins:0,top10:0,earn:0,rounds:0,par:0,low:null,slot:[[0,0],[0,0],[0,0]],ab:[0,0],all:[0,0],cl:[0,0]}}
function newGolfer(p,name,country,color){const g={id:Date.now().toString(36)+Math.floor(R()*1e5).toString(36),name,country,color,arch:p.arch,sk:p.sk,ce:p.ce,peak:p.peak,agg:p.agg||0,college:p.college||null,fatigue:10,carry:0,conf:0,slot:1,eq:{s:0,m:0,l:0},coachId:null,yr:p.yr||1,tour:p.tour||'col',sPts:0,sWins:0,sEarn:0,sessions:SESSIONS,trained:{},enter:true,played:false,ask:null,stats:blankStats(),seasons:[],hist:[],trophies:[],retired:false};g.co=p.co||rawCo(g.id);g.best=ovr(g.sk);return g;}
function newSave(){return{v:4,t:Date.now(),cash:START_CASH,cos:{colors:false,ring:false,trophy:0},rec:{low:null,cheque:0},season:1,week:0,golfers:[],sold:[],stand:{},market:null,news:[],cur:0}}
function migrate(s){
  if(!s||typeof s!=='object')return null;
  if(s.v===4)return Array.isArray(s.golfers)&&s.golfers.length?up5(s):null;
  const n=newSave();
  if(s.v===3&&Array.isArray(s.golfers)&&s.golfers.length){
    n.cash=s.cash;n.cos=s.cos||n.cos;n.rec=s.rec||n.rec;n.cur=0;
    n.golfers=s.golfers.map(g=>{const x=SUB.x.filter(k=>k!=='iq'),iq=Math.round(avg(x.map(k=>g.sk[k])));g.sk.iq=iq;g.ce.iq=Math.min(97,iq+12+Math.floor(R()*14));
      g.yr=g.season||1;g.sPts=0;g.sWins=0;g.sEarn=0;g.agg=clamp(gauss()*.6,-1,1);g.enter=true;g.played=false;g.ask=null;g.sessions=SESSIONS;g.trained={};
      delete g.season;delete g.ev;delete g.pts;delete g.wins;delete g.style;return g;});
    return up5(n);
  }
  if(!s.g||!s.g.skills)return null;
  const o=s.g,p={arch:o.arch||'All-rounder',sk:{},ce:{},peak:o.peak||0};
  const mis={ice:[80,45,60,70,60,70],steady:[62,55,55,60,50,58],streaky:[40,80,50,50,45,45],hothead:[30,55,50,35,35,40],closer:[60,62,55,60,85,62]}[o.temp]||[55,55,55,55,55,55];
  for(const u of'sml')for(const k of SUB[u]){p.sk[k]=Math.round(o.skills[u]);p.ce[k]=Math.round((o.ceil||{})[u]||80);}
  SUB.x.forEach((k,i)=>{p.sk[k]=mis[i];p.ce[k]=Math.min(97,mis[i]+18);});
  const g=newGolfer(p,o.name||'Tucker Hale',o.country||'US',o.color||0);g.fatigue=o.fatigue||10;n.golfers=[g];return up5(n);
}
function loadLocal(){try{const s=localStorage.getItem(KEY);return s?JSON.parse(s):null}catch(e){return null}}
/* ---- saving: always in this browser; to your Range Rat account when signed in; save codes as a backup ---- */
const SB=window.supabase&&window.RR_CONFIG?window.supabase.createClient(RR_CONFIG.url,RR_CONFIG.key):null;
const BACKUP='rangerat.backup';
let save=migrate(loadLocal()),localOK=true;
const acct={user:null,state:SB?'checking':'off',busy:false,next:null,timer:null,tries:0};
function persist(){
  if(!save)return;save.t=Date.now();if(acct.user)save.owner=acct.user.id;const json=JSON.stringify(save);
  try{localStorage.setItem(KEY,json);localOK=true}catch(e){localOK=false}
  if(acct.user){acct.next=save;clearTimeout(acct.timer);acct.timer=setTimeout(flushCloud,1200);}
  paintSave();
}
async function flushCloud(){
  if(acct.busy||!acct.next||!acct.user)return;const s=acct.next,uid=acct.user.id;acct.next=null;acct.busy=true;
  let error=null;try{({error}=await SB.from('saves').upsert({user_id:uid,data:s,saved_at:s.t||Date.now()}));}catch(e){error=e;}
  if(error){acct.state='retry';acct.tries++;if(!acct.next)acct.next=s;}else{acct.state='ok';acct.tries=0;}
  acct.busy=false;paintSave();
  if(acct.next&&acct.tries<6)acct.timer=setTimeout(flushCloud,acct.state==='retry'?8000:1200);
}
/* On sign-in: an account's own career wins, unless this browser holds a newer copy of that same career.
   A guest career is uploaded to an account that has none, and set aside (not lost) when the account already has one. */
async function pullCloud(){
  const u=acct.user;if(!u)return;
  let res;try{res=await SB.from('saves').select('data').eq('user_id',u.id).maybeSingle();}catch(e){res={error:e};}
  if(acct.user!==u)return;
  if(res.error){acct.state='retry';paintSave();return;}
  const remote=res.data?migrate(res.data.data):null,midEvent=['round','break','results','season'].includes(ui.view);
  if(remote&&!(save&&save.owner===u.id&&(save.t||0)>=(remote.t||0))){
    if(midEvent){acct.state='ok';paintSave();return;}
    if(save&&!save.owner){try{localStorage.setItem(BACKUP,JSON.stringify(save))}catch(e){}}
    save=remote;save.owner=u.id;try{localStorage.setItem(KEY,JSON.stringify(save))}catch(e){}
    ui.odds={};ui.ev=null;ui.res=null;ui.view='stable';
  }else if(save&&save.owner&&save.owner!==u.id){
    save=null;try{localStorage.removeItem(KEY)}catch(e){}ui.view='new';
  }else if(save){save.owner=u.id;acct.next=save;flushCloud();}
  acct.state='ok';render();
}
function saveText(){
  if(!SB)return localOK?'Saved in this browser after every week, range session and deal. To move to another device, copy a save code.':'This browser is not keeping saves. Copy a save code before you leave and load it next time.';
  if(acct.user){if(acct.state==='checking')return'Checking your account for a saved career.';
    return acct.state==='retry'?`Signed in as ${acct.user.email}. The last save hasn't reached the server yet. It will keep trying, and this browser has a copy.`:`Signed in as ${acct.user.email}. Your career saves to your account after every week, range session and deal, so you can carry on from any device.`;}
  if(acct.state==='checking')return'Checking whether you are signed in.';
  return localOK?'Saved in this browser only. Sign in or create an account to keep your career safe and play it on any device.':'This browser is not keeping saves. Sign in, or copy a save code before you leave.';
}
function paintSave(){const el=$('#saveState');if(el)el.textContent=saveText();}
function friendly(m){m=String(m||'');
  if(/invalid login/i.test(m))return"That email and password don't match an account.";
  if(/not confirmed/i.test(m))return'Confirm your email first: click the link in the email we sent, then sign in.';
  if(/already registered|already been registered/i.test(m))return'That email already has an account. Sign in instead.';
  if(/rate limit|too many/i.test(m))return'Too many attempts or emails just now. Wait a few minutes and try again.';
  if(/password/i.test(m)&&/(characters|short|weak)/i.test(m))return'Choose a longer password: at least 8 characters.';
  if(/fetch|network/i.test(m))return"Couldn't reach the server. Check your connection and try again.";
  return m||'Something went wrong. Try again.';}
function viewAuth(){const a=ui.auth,m=a.mode;
  const head={in:'Sign in',up:'Create an account',forgot:'Reset your password',newpass:'Choose a new password'}[m];
  const lede={in:'Sign in to load your career on this device.',up:'Your career saves to your account, so you can pick it up on any phone or computer.',forgot:"Enter your email and we'll send a link to set a new password.",newpass:'Enter a new password for your account.'}[m];
  const btn={in:'Sign in',up:'Create account',forgot:'Send reset link',newpass:'Save password'}[m];
  return `<section class="intro"><p class="eyebrow">Your Range Rat account</p><h1>${head}</h1><p class="lede">${lede}</p></section>
<form class="stack authform" id="authForm" novalidate>
 ${m!=='newpass'?`<label class="field" for="aEmail"><span>Email</span><input id="aEmail" type="email" autocomplete="email" required value="${esc(a.email||'')}"></label>`:''}
 ${m!=='forgot'?`<label class="field" for="aPass"><span>Password</span><input id="aPass" type="password" autocomplete="${m==='in'?'current-password':'new-password'}" minlength="8" required></label>${m!=='in'?'<p class="muted small">At least 8 characters.</p>':''}`:''}
 ${a.msg?`<p class="${a.err?'under':'hand'}" role="status">${esc(a.msg)}</p>`:''}
 <div class="row" style="justify-content:flex-start"><button class="btn primary" type="submit" ${a.busy?'disabled':''}>${a.busy?'Working…':btn}</button></div>
 <div class="row" style="justify-content:flex-start">${m==='in'?'<button class="btn sm" type="button" data-act="authMode" data-v="up">Create an account</button><button class="btn sm" type="button" data-act="authMode" data-v="forgot">Forgot password</button>':m!=='newpass'?'<button class="btn sm" type="button" data-act="authMode" data-v="in">Back to sign in</button>':''}${m!=='newpass'?`<button class="btn sm" type="button" data-act="go" data-v="${save?'stable':'new'}">Play without an account</button>`:''}</div>
</form>`;}
async function submitAuth(){
  const a=ui.auth;if(a.busy||!SB)return;
  const email=(($('#aEmail')||{}).value||a.email||'').trim(),pass=($('#aPass')||{}).value||'';a.email=email;a.busy=true;a.msg='';a.err=false;render();
  const back=location.origin+location.pathname;let r={};
  try{
    if(a.mode==='in')r=await SB.auth.signInWithPassword({email,password:pass});
    else if(a.mode==='up'){if(pass.length<8)r={error:{message:'password too short'}};else{r=await SB.auth.signUp({email,password:pass,options:{emailRedirectTo:back}});
      if(!r.error&&!(r.data&&r.data.session)){a.mode='in';a.msg='Almost done. Click the confirmation link we just emailed you, then sign in here.';}}}
    else if(a.mode==='forgot'){r=await SB.auth.resetPasswordForEmail(email,{redirectTo:back});if(!r.error)a.msg='If that email has an account, a reset link is on its way.';}
    else if(a.mode==='newpass'){if(pass.length<8)r={error:{message:'password too short'}};else{r=await SB.auth.updateUser({password:pass});if(!r.error){a.mode='in';a.msg='';a.busy=false;go(save?'stable':'new');return;}}}
  }catch(e){r={error:e};}
  a.busy=false;if(r.error){a.err=true;a.msg=friendly(r.error.message);}render();
}
async function signOut(){
  if(!SB)return;try{await SB.auth.signOut();}catch(e){}
  save=null;try{localStorage.removeItem(KEY)}catch(e){}acct.user=null;acct.next=null;acct.state='out';
  ui.auth={mode:'in',email:'',msg:'Signed out.',err:false,busy:false};ui.ev=null;ui.res=null;ui.odds={};go('auth');
}
if(SB)SB.auth.onAuthStateChange((event,session)=>{
  const u=session?session.user:null,was=acct.user&&acct.user.id;acct.user=u;
  if(event==='PASSWORD_RECOVERY'){ui.auth.mode='newpass';ui.auth.msg='';ui.view='auth';}
  if(u&&u.id!==was){acct.state='checking';if(ui.view==='auth'&&ui.auth.mode!=='newpass')ui.view=save?'stable':'new';setTimeout(pullCloud,0);}
  if(!u)acct.state='out';
  setTimeout(()=>{if(['auth','new','stable'].includes(ui.view))render();else{paintNav();paintSave();}},0);
});
const toCode=()=>btoa(unescape(encodeURIComponent(JSON.stringify(save))));
function fromCode(t){try{return migrate(JSON.parse(decodeURIComponent(escape(atob(t.trim())))))}catch(e){return null}}

const ui={view:save?'stable':'new',tab:'range',prospect:rollProspect(),rerolls:3,name:'Tucker Hale',color:0,country:'US',msg:'',ev:null,res:null,sea:null,confirm:null,fullBoard:false,fullStand:false,codeOpen:false,codeMsg:'',odds:{},auth:{mode:'in',email:'',msg:'',err:false,busy:false}};
const G=()=>save.golfers[Math.min(save.cur,save.golfers.length-1)];
const colorsOwned=()=>save&&save.cos.colors?COLORS.length:6;
const active=()=>save.golfers.filter(g=>!g.retired);
const calNow=tour=>calendar(tour,clk(tour).s)[clk(tour).w];
const canSkip=g=>!isCol(g.tour);

/* ---- fields: everyone on a tour, including your other golfers and the ones you sold ---- */
function tourCast(tour){
  const mine=active().filter(g=>g.tour===tour),sold=save.sold.filter(s=>s.tour===tour);
  return{mine,sold,ai:pool(tour,clk(tour).s).slice(0,Math.max(0,FIELD-mine.length-sold.length))};
}
/* Odds before a ball is struck, from ratings alone. */
function preOdds(tour){
  const c=tourCast(tour),cal=calNow(tour),ent=c.mine.filter(g=>g.enter||!canSkip(g)),all=ent.concat(c.sold,c.ai);
  const key=[clk(tour).s,clk(tour).w,tour].concat(ent.map(g=>g.id+':'+ratingFor(g,cal.ci).toFixed(1))).join('|');
  if(ui.odds.key!==key||!ui.odds[tour]||ui.odds[tour].key!==key){const pr=winProbs(all.map(g=>({r:ratingFor(g,cal.ci),cur:0,H:72})),700);ui.odds[tour]={key,list:all.map((g,i)=>({g,p:pr[i]})).sort((a,b)=>b.p-a.p)};}
  return ui.odds[tour].list;
}
function oddsOf(g){if(g.retired)return'';const row=preOdds(g.tour).find(x=>x.g===g);return row?oddsLabel(row.p):'';}

function ratingsHTML(sk){return `<div class="ratings"><span class="lead">Overall<b>${Math.round(ovr(sk))}</b></span>${'smlx'.split('').map(u=>`<span>${u==='x'?'Misc':UMB[u]}<b>${Math.round(um(sk,u))}</b></span>`).join('')}</div>`}
function avatarHTML(g){return `<div class="avatar${save&&save.cos.ring?' ring':''}" style="--c:${COLORS[g.color]||COLORS[0]}">${esc(initials(g.name))}</div>`}
function subRow(g,k,ro,kid){return `<div class="sn${kid?' kid':''}">${SUBN[k]}<small>${SUBD[k]}</small></div><div class="track"><i style="width:${clamp(g.sk[k],0,100)}%"></i></div><div class="sv">${Math.round(g.sk[k])}</div>${ro?'':`<button class="btn xs" data-act="train" data-v="${k}" ${g.sessions?'':'disabled'}>Drill</button>`}`}
function umbBlock(g,u,ro){
  const v=um(g.sk,u);let rows;
  if(u==='s'){const pv=(g.sk.sputt+g.sk.lputt)/2;rows=['wedge','pitch','chip','bunker'].map(k=>subRow(g,k,ro)).join('')+`<div class="sn grp">Putting</div><div class="track"><i style="width:${pv}%"></i></div><div class="sv">${Math.round(pv)}</div>${ro?'':'<span></span>'}`+subRow(g,'sputt',ro,1)+subRow(g,'lputt',ro,1);}
  else rows=SUB[u].map(k=>subRow(g,k,ro)).join('');
  const lc=!ro&&g.coachId&&coachObj(g.coachId);
  return `<div class="umb"><div class="uhead"><div><h2>${UMB[u]}</h2><small>${UMBD[u]}${lc?` <span class="tag">\u00d7${coMult(lc.co[u]).toFixed(2)} with ${esc(lc.name)}</span>`:''}</small></div><b>${Math.round(v)}</b></div><div class="track thick"><i style="width:${v}%"></i></div><div class="subs${ro?' ro':''}">${rows}</div>${ro?'':`<button class="btn sm" data-act="train" data-v="${u}" ${g.sessions?'':'disabled'} style="align-self:flex-start">General ${UMB[u].toLowerCase()} session</button>`}</div>`;
}

function viewNew(){const p=ui.prospect,full=save&&active().length>=MAXG;return `
<section class="intro"><p class="eyebrow">${save?'Free signing':'New career'}</p><h1>Sign a junior</h1>
<p class="lede">You're the coach. He hits every shot and makes every decision himself. A junior costs nothing and starts as a college freshman: four college seasons, sixteen as a professional, ten on the senior circuit, then retirement.</p>${SB&&!acct.user&&!save?'<p class="muted">Already have a career? <button class="btn xs" data-act="signin">Sign in</button></p>':''}</section>
<section class="cols">
 <div class="stack">
  <label class="field" for="gname"><span>Golfer's name</span><input id="gname" type="text" maxlength="22" value="${esc(ui.name)}"></label>
  <label class="field" for="gcountry"><span>Plays for</span><select id="gcountry">${Object.keys(COUNTRIES).map(c=>`<option value="${c}"${c===ui.country?' selected':''}>${COUNTRIES[c]}</option>`).join('')}</select></label>
  <label class="field" for="gcollege"><span>College</span><select id="gcollege">${collegeOpts(ui.college||(ui.college=pick(COLLEGES)))}</select></label>
  <div class="field"><span>Shirt</span><div class="swatches">${COLORS.slice(0,colorsOwned()).map((c,i)=>`<button class="sw${i===ui.color?' on':''}" data-act="color" data-v="${i}" style="--c:${c}" aria-label="Shirt colour ${i+1}"></button>`).join('')}</div></div>
  <p class="muted small" style="max-width:46ch">Every sub-skill has a ceiling you can't see, and every golfer has a time of day when he plays his best. You find out by watching and by how fast the range work pays off.</p>
 </div>
 <div class="prospect">
  <div class="row"><h2>${flagHTML(ui.country)}${p.arch}</h2><span class="tag">Scouting report</span></div>
  ${ratingsHTML(p.sk)}
  <p class="hand">Ceiling grades: short game ${p.grade.s}, irons ${p.grade.m}, long game ${p.grade.l}, the head ${p.grade.x}. The scouts have been wrong before.</p>
  <div class="row"><button class="btn" data-act="reroll" ${ui.rerolls?'':'disabled'}>Scout another (${ui.rerolls} left)</button><span>${save?'<button class="btn" data-act="go" data-v="market">Cancel</button> ':''}<button class="btn primary" data-act="sign" ${full?'disabled':''}>Sign him</button></span></div>
 </div>
</section>`}

function eventLine(g){
  if(g.retired)return'';const c=calNow(g.tour),T=TOURS[g.tour];
  return `<div class="evline"><span class="lab">${T.name}, week ${clk(g.tour).w+1} of ${WEEKS}, ${c.type.toLowerCase()} event${g.late?' (joined part-way through)':''}</span><b>${c.name}</b><span class="muted">${COURSES[c.ci].name}. Purse ${fmt$(c.purse)}${c.fee?', entry '+fmt$(c.fee):''}. ${g.enter||!canSkip(g)?`Win odds ${oddsOf(g)}.`:'Sitting this one out.'}</span></div>`;
}
function playHTML(){
  const tours=[...new Set(active().map(g=>g.tour))].sort((a,b)=>TORDER.indexOf(a)-TORDER.indexOf(b));if(!tours.length)return'';
  return `<section class="sec"><h2>Play an event</h2><p class="muted">Playing a tour's event moves that tour on one week. Nothing changes for golfers on the other tours.</p>
 <div class="shop">${tours.map(t=>{const c=clk(t),e=calNow(t),ent=active().filter(g=>g.tour===t&&(g.enter||!canSkip(g)));
  return `<div class="item"><span class="lab">${TOURS[t].name}: season ${c.s}, week ${c.w+1} of ${WEEKS}</span><b>${e.name}</b><span>${COURSES[e.ci].name}, ${e.type.toLowerCase()} event. ${ent.length?ent.map(g=>esc(g.name)).join(', ')+(ent.length===1?' is':' are')+' entered':'Nobody is entered, so this is a rest week'}${e.fee&&ent.length?`, ${fmt$(e.fee*ent.length)} in entry fees`:''}.</span>
  <div class="ctrl">${ent.map(g=>`<button class="btn primary sm" data-act="playWeek" data-v="${g.id}">Watch ${esc(g.name)}</button>`).join('')}<button class="btn sm" data-act="simTour" data-v="${t}">Simulate</button></div></div>`}).join('')}</div>
 ${tours.length>1?`<div class="row" style="justify-content:flex-start"><button class="btn" data-act="simTour" data-v="">Simulate every tour's week</button></div>`:''}</section>`;
}
function viewStable(){
  const gs=save.golfers,cos=save.cos,tr=[];gs.forEach(g=>g.trophies.forEach(t=>tr.push(Object.assign({g:g.name},t))));
  const wins=tr.filter(t=>!t.title),titles=tr.filter(t=>t.title),ent=active().filter(g=>g.enter||!canSkip(g)),fees=sum(ent.map(g=>calNow(g.tour).fee));
  return `
<section class="intro"><p class="eyebrow">Your stable</p><h1>${gs.length} golfer${gs.length===1?'':'s'} under contract</h1>
<p class="lede">${fmt$(save.cash)} in the bank. Each tour runs on its own calendar and only moves on when you play its event. Golfers you leave alone keep their range sessions and their place in the season.</p>
${(save.news||[]).map(n=>`<p class="hand">${esc(n)}</p>`).join('')}</section>
<section class="gcards">${gs.map((g,i)=>`<div class="gcard"><div class="who">${avatarHTML(g)}<div><p class="eyebrow">${flagHTML(g.country)}${esc(tourLabel(g))}</p><h1>${esc(g.name)}</h1></div></div>
 ${ratingsHTML(g.sk)}
 <p class="muted small">${g.retired?(g.cr?`Coach, retired at ${g.retAge||ageOf(g.yr)}. Coaching ${Math.round(coOvr(coachRatings(g)))}, ${fmt$(g.cr.price)} a lesson. ${fmt$(g.cr.earn)} from coaching, ${fmt$(g.stats.earn)} from playing.`:`Retired. ${g.stats.wins} wins, ${fmt$(g.stats.earn)} earned.`):`Age ${ageOf(g.yr)}, career season ${g.yr} of 30. Stamina ${stam(g)}/5. Market value ${fmt$(valueOf(g.sk,g.yr))}${g.ask?`, listed at ${fmt$(g.ask)}`:''}.`}</p>
 ${eventLine(g)}
 <div class="row"><span class="meters">${g.retired?'':`<span class="meter"><span class="lab">Stamina</span><span class="pips">${[0,1,2,3,4].map(j=>`<i class="${j<stam(g)?'f':''}"></i>`).join('')}</span><b>${stam(g)}/5</b></span><span class="meter"><span class="lab">Range sessions</span><span class="pips">${Array.from({length:SESSIONS},(x,j)=>`<i class="${j<g.sessions?'f':''}"></i>`).join('')}</span><b>${g.sessions}/${SESSIONS}</b></span>`}</span><span>${!g.retired&&canSkip(g)?`<button class="btn sm" data-act="enter" data-v="${i}">${g.enter?'Skip this event':'Enter this event'}</button> `:''}<button class="btn primary sm" data-act="manage" data-v="${i}">${g.retired?'View':'Manage'}</button></span></div></div>`).join('')}</section>
${playHTML()}
<section class="cols">
 <div class="sec"><h2>${TROPHY[cos.trophy].n}</h2>
  ${tr.length?`<p class="muted">${wins.length} tournament win${wins.length===1?'':'s'} and ${titles.length} season title${titles.length===1?'':'s'}.</p>`:'<p class="muted">Empty so far. The first win goes here.</p>'}
  ${cos.trophy>=1&&wins.length?`<div class="scroll tall"><table class="tbl"><thead><tr><th>Event</th><th>Tour</th><th>Golfer</th><th class="num">Season</th></tr></thead><tbody>${wins.slice().reverse().map(t=>`<tr><td>${esc(t.n)}</td><td>${TOURS[t.t].name}</td><td>${esc(t.g)}</td><td class="num">${t.s}</td></tr>`).join('')}</tbody></table></div>`:wins.length?`<p class="muted small">Latest: ${wins.slice(-3).reverse().map(t=>esc(t.n)+' ('+esc(t.g)+')').join(', ')}.</p>`:''}
  ${cos.trophy>=2?`<p class="hand">Season titles: ${titles.length?titles.map(t=>`${esc(t.g)}, ${TOURS[t.t].name} season ${t.s}`).join('; '):'none yet'}. Lowest round: ${save.rec.low===null?'none yet':fmtPar(save.rec.low)}. Biggest cheque: ${fmt$(save.rec.cheque)}.</p>`:''}
 </div>
 <div class="sec"><h2>Clubhouse extras</h2><p class="muted small">None of these change how anyone plays.</p>
  <div class="shop">
   <div class="item"><b>Wardrobe</b><span>Six more shirt colours for every golfer.</span>${cos.colors?'<span class="tag">Owned</span>':`<button class="btn sm" data-act="cos" data-v="colors" ${save.cash<5000?'disabled':''}>Buy for ${fmt$(5000)}</button>`}</div>
   <div class="item"><b>Gold trim</b><span>A gold ring around every golfer's badge.</span>${cos.ring?'<span class="tag">Owned</span>':`<button class="btn sm" data-act="cos" data-v="ring" ${save.cash<25000?'disabled':''}>Buy for ${fmt$(25000)}</button>`}</div>
   ${cos.trophy<2?`<div class="item"><b>${TROPHY[cos.trophy+1].n}</b><span>${TROPHY[cos.trophy+1].d}</span><button class="btn sm" data-act="cos" data-v="trophy" ${save.cash<TROPHY[cos.trophy+1].c?'disabled':''}>Build for ${fmt$(TROPHY[cos.trophy+1].c)}</button></div>`:''}
  </div>
 </div>
</section>
<section class="sec"><h2>Saved game</h2><p class="muted" id="saveState">${saveText()}</p>
 <div class="row" style="justify-content:flex-start">${SB?(acct.user?'<button class="btn sm" data-act="signout">Sign out</button>':'<button class="btn sm primary" data-act="signin">Sign in or create an account</button>'):''}${(()=>{try{return localStorage.getItem(BACKUP)}catch(e){return null}})()?'<button class="btn sm" data-act="restoreBackup">Restore the career from before you signed in</button>':''}<button class="btn sm" data-act="copyCode">Copy save code</button><button class="btn sm" data-act="openCode">Load a save code</button>
 ${ui.confirm==='reset'?`<span>Release everyone and start over?</span><button class="btn sm" data-act="resetYes">Yes, start over</button><button class="btn sm" data-act="resetNo">Cancel</button>`:`<button class="btn sm" data-act="reset">Start over</button>`}</div>
 ${ui.codeMsg?`<p class="muted small">${esc(ui.codeMsg)}</p>`:''}
 ${ui.codeOpen?`<label class="field" for="codeBox"><span>Save code</span><textarea id="codeBox" spellcheck="false" placeholder="Paste a save code here, or copy the one shown."></textarea></label><div class="row" style="justify-content:flex-start"><button class="btn sm primary" data-act="loadCode">Load this code</button></div>`:''}
</section>`}

/* ---- the transfer market ---- */
function listing(){
  const[tour,y0,y1,m0,m1]=pick([['col',2,4,58,65],['col',2,4,58,65],['p3',5,9,64,69],['p3',5,10,64,69],['p2',6,12,69,74],['p2',6,12,69,74],['p1',7,14,75,80],['c2',21,24,65,71]]);
  const yr=y0+Math.floor(R()*(y1-y0+1)),p=rollProspect(m0+R()*(m1-m0)),c=R()<.34?'US':pick(CN),N=NAMES[c],val=valueOf(p.sk,yr);
  return{p,tour,yr,country:c,name:pick(N[0])+' '+pick(N[1]),seller:pick(RIVALS),ask:Math.max(1000,Math.round(val*(.8+R()*.5)/500)*500)};
}
function ensureMarket(){if(!save.market)save.market=[];while(save.market.length<8)save.market.push(listing());}
function viewMarket(){
  ensureMarket();const full=active().length>=MAXG;
  return `
<section class="intro"><p class="eyebrow">Transfer market</p><h1>Buy and sell golfers</h1>
<p class="lede">Market value is what rival coaches reckon a golfer is worth: his overall rating, adjusted for how many good years he has left. They pay around it, so price near it to sell quickly and above it if you can wait.</p></section>
<section class="sec"><h2>For sale</h2>
 <div class="shop">
  <div class="item"><b>Junior prospect</b><span>Free. Starts as a college freshman and is yours to develop.</span><button class="btn sm" data-act="junior" ${full?'disabled':''}>Scout juniors</button></div>
  ${save.market.map((m,i)=>{const val=valueOf(m.p.sk,m.yr),d=m.ask/val;return `<div class="item"><b>${flagHTML(m.country)}${esc(m.name)}</b><span>${m.p.arch}, age ${ageOf(m.yr)}. ${isCol(m.tour)?'College '+CLASS[m.yr-1].toLowerCase()+' at '+COLLEGES[hash(m.name)%COLLEGES.length]:TOURS[m.tour].name}. Overall ${Math.round(ovr(m.p.sk))}: short ${Math.round(um(m.p.sk,'s'))}, irons ${Math.round(um(m.p.sk,'m'))}, long ${Math.round(um(m.p.sk,'l'))}, misc ${Math.round(um(m.p.sk,'x'))}.</span><span>Ceilings, per the scouts: ${'smlx'.split('').map(u=>m.p.grade[u]).join(' ')}. Coaching potential ${Math.round(coOvr(rawCo('m'+m.name)))}. Seller: ${m.seller}.</span><span>Market value ${fmt$(val)}. <b style="font-size:.86rem">${d<.93?'Priced under value':d>1.1?'Priced over value':'Fair price'}</b></span><button class="btn sm" data-act="buyGolfer" data-v="${i}" ${full||save.cash<m.ask?'disabled':''}>Sign for ${fmt$(m.ask)}</button></div>`}).join('')}
 </div><p class="muted small">${full?`The stable is full at ${MAXG} active golfers. `:''}Rival coaches sign from this list too, so it changes week to week.</p></section>
<section class="sec"><h2>Your golfers</h2>
 ${active().length<2?'<p class="muted">You need at least two active golfers before you can sell one.</p>':''}
 <p class="muted small">College freshmen and sophomores can't be sold: rival coaches only bid on juniors, seniors and professionals, and they pay far less for a college golfer than for a professional with the same rating.</p>
 <div class="scroll"><table class="tbl"><thead><tr><th>Golfer</th><th>Tour</th><th class="num">Overall</th><th class="num">Market value</th><th>Asking price</th><th></th></tr></thead><tbody>
 ${active().map(g=>{const val=valueOf(g.sk,g.yr),can=active().length>1&&canSell(g);return `<tr><td>${flagHTML(g.country)}${esc(g.name)}</td><td>${esc(tourLabel(g))}</td><td class="num">${Math.round(ovr(g.sk))}</td><td class="num">${fmt$(val)}</td>
  <td>${g.ask?`${fmt$(g.ask)} <span class="muted small">(${saleChance(g.ask,val)}% a week)</span>`:`<input type="number" id="ask-${g.id}" min="500" step="500" value="${val}" aria-label="Asking price for ${esc(g.name)}" ${can?'':'disabled'}>`}</td>
  <td>${g.ask?`<button class="btn xs" data-act="unlist" data-v="${g.id}">Take off the market</button>`:`<button class="btn xs" data-act="list" data-v="${g.id}" ${can?'':'disabled'}>List</button> <button class="btn xs" data-act="quickSell" data-v="${g.id}" ${can?'':'disabled'}>Sell now for ${fmt$(val*.8)}</button>`}</td></tr>`}).join('')}
 </tbody></table></div>
 <p class="muted small">A listed golfer keeps playing for you until a rival coach meets the price. Once sold he stays on his tour and you'll see him in the field.</p></section>
${save.sold.length?`<section class="sec"><h2>Sold on</h2><div class="scroll"><table class="tbl"><thead><tr><th>Golfer</th><th>Now with</th><th>Tour</th><th class="num">Overall</th><th class="num">Sold for</th></tr></thead><tbody>${save.sold.slice().reverse().map(s=>`<tr><td>${flagHTML(s.country)}${esc(s.name)}</td><td>${esc(s.coach)}</td><td>${isCol(s.tour)?'College':TOURS[s.tour].name}</td><td class="num">${Math.round(ovr(s.sk))}</td><td class="num">${fmt$(s.price)}</td></tr>`).join('')}</tbody></table></div></section>`:''}`}
const saleChance=(ask,val)=>Math.round(100*(ask<=val*.9?.9:clamp(1.5-ask/val,0,.9)));
function sell(g,price,coach){
  save.cash+=price;save.golfers=save.golfers.filter(x=>x!==g);save.cur=0;
  save.sold.push({id:g.id,co:g.co,best:g.best,name:g.name,country:g.country,sk:g.sk,ce:g.ce,peak:g.peak,agg:g.agg,tour:g.tour,yr:g.yr,coach,price});
  if(g.sPts){const st=tourStand(g.tour);st.pts['s_'+g.id]=g.sPts;if(g.sWins)st.wins['s_'+g.id]=g.sWins;}
  if(save.sold.length>16)save.sold.shift();ui.odds={};
}

function notebook(st){
  if(st.rounds<2)return['Two rounds in the book and the patterns start to show.'];
  const L=[],parts=[0,1,2].map(s=>{const[a,n]=st.slot[s];if(!n)return null;const v=a/n;return `${SLOTS[s].k.toLowerCase()} ${Math.abs(v).toFixed(1)} ${v<=0?'better':'worse'} (${n})`}).filter(Boolean);
  L.push('Against the field by tee time, per round: '+parts.join(', ')+'.');
  if(st.ab[1]>=3)L.push(`Hole after a dropped shot: ${fmt1(st.ab[0]/st.ab[1])} a hole. Normal: ${fmt1(st.all[0]/st.all[1])}.`);
  if(st.cl[1])L.push(`Closing three holes: ${fmt1(st.cl[0]/st.cl[1])} a hole.`);
  return L;
}
function tourStand(tour){return save.stand[tour]||(save.stand[tour]={pts:{},wins:{}});}
function standRows(tour){
  const st=tourStand(tour),c=tourCast(tour);
  const all=c.ai.map(a=>({name:a.name,c:a.country,yr:a.yr,o:ovr(a.sk),pts:st.pts[a.id]||0,wins:st.wins[a.id]||0}));
  c.sold.forEach(s=>all.push({sold:s,name:s.name,c:s.country,yr:s.yr,o:ovr(s.sk),pts:st.pts['s_'+s.id]||0,wins:st.wins['s_'+s.id]||0}));
  c.mine.forEach(g=>all.push({g,mine:true,name:g.name,c:g.country,yr:g.yr,o:ovr(g.sk),pts:g.sPts||0,wins:g.sWins||0}));
  all.sort((a,b)=>b.pts-a.pts||b.o-a.o);all.forEach((r,i)=>r.rank=i+1);return all;
}
const canUp=g=>!!UP[g.tour]||g.yr===4||(g.yr===20&&g.tour==='p2'),canDown=g=>!!DOWN[g.tour]&&g.yr!==20;
function standHTML(g){
  const rows=standRows(g.tour),full=ui.fullStand;let show=full?rows:rows.filter((r,i)=>i<10||r.mine||r.sold);
  const up=canUp(g),dn=canDown(g),col=isCol(g.tour),sch={};if(col)pool(g.tour,clk(g.tour).s).forEach(a=>sch[a.name]=a.college);
  return `<div class="scroll${full?' tall':''}"><table class="tbl"><thead><tr><th class="num">#</th><th>Golfer</th>${col?'<th>College</th>':''}<th class="num">Points</th><th class="num">Wins</th><th class="num">Overall</th></tr></thead><tbody>
  ${show.map((r,i)=>`${!full&&i>0&&r.rank-show[i-1].rank>1?'<tr class="gap"><td colspan="6">⋮</td></tr>':''}<tr class="${r.g===g?'me':r.mine?'now':''}${up&&r.rank<=ZONE?' promo':''}${dn&&r.rank>FIELD-ZONE?' releg':''}"><td class="num">${clk(g.tour).w?r.rank:'–'}</td><td>${flagHTML(r.c)}${esc(r.name)}${r.mine&&r.g!==g?' <span class="tag">Yours</span>':r.sold?' <span class="tag">Sold</span>':''}</td>${col?`<td>${esc(r.g?collegeOf(r.g):r.sold?collegeOf(r.sold):sch[r.name]||'')} <span class="muted small">${CLS[r.yr-1]||''}</span></td>`:''}<td class="num">${fmtPts(r.pts)}</td><td class="num">${r.wins||''}</td><td class="num">${Math.round(r.o)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="row"><p class="muted small">${g.yr===4?`Finish in the top ${ZONE} as a senior and he turns pro on the Challenger Tour. Otherwise it's the Mini Tour.`:col?'College results build him up for his senior year. Nobody is promoted or relegated yet.':`${up?`Top ${ZONE} ${g.yr===20?'start on the Champions Tour':'go up to the '+TOURS[UP[g.tour]].name}. `:''}${dn?`Bottom ${ZONE} go down to the ${TOURS[DOWN[g.tour]].name}.`:''}${!up&&!dn?'This is the top of the ladder.':''}`}</p><button class="btn sm" data-act="fullStand">${full?'Show fewer':'Show all '+rows.length}</button></div>`;
}
function viewHub(){
  const g=G(),T=TOURS[g.tour],tab=g.retired?'stand':ui.tab;
  let body='';
  if(g.retired)body=g.cr?`<section class="sec">${coachBlock(g)}<p class="lede">${esc(g.name)} retired at ${g.retAge||ageOf(g.yr)} and coaches for you. ${g.cr.given} lessons to rival managers' golfers for ${fmt$(g.cr.earn)}, and ${g.cr.own||0} to yours.</p><div class="row" style="justify-content:flex-start"><button class="btn primary sm" data-act="go" data-v="coaches">Set his fee on the Coaches page</button></div></section>`:`<section class="sec"><h2>Retired</h2><p class="lede">His full record is on the Profiles page.</p></section>`;
  else if(tab==='range')body=`
<section class="sec">
 <div class="row"><span class="lab">Before this week's event</span><span class="meters"><span class="meter"><span class="lab">Stamina</span><span class="pips">${[0,1,2,3,4].map(i=>`<i class="${i<stam(g)?'f':''}"></i>`).join('')}</span><b>${stam(g)}/5</b></span><span class="meter"><span class="lab">Range sessions</span><span class="pips">${Array.from({length:SESSIONS},(x,i)=>`<i class="${i<g.sessions?'f':''}"></i>`).join('')}</span><b>${g.sessions}/${SESSIONS}</b></span></span></div>
 <p class="hand trainlog">${esc(ui.msg||'A drill pushes one sub-skill hard. A general session lifts everything under that umbrella a little. Gains shrink as he nears a ceiling.')}</p>
 <div class="row" style="justify-content:flex-start"><button class="btn sm" data-act="train" data-v="rest" ${g.sessions?'':'disabled'}>Give him a day off</button><span class="muted small">Umbrellas he skips this week get slightly rusty.</span></div>
 ${coachPick(g)}
</section>
<section class="umbs">${'smlx'.split('').map(u=>umbBlock(g,u)).join('')}</section>`;
  else if(tab==='event'){const cal=calendar(g.tour,clk(g.tour).s),c=cal[clk(g.tour).w],course=COURSES[c.ci],fav=preOdds(g.tour),inField=g.enter||!canSkip(g),top=fav.slice(0,6);if(inField&&!top.some(x=>x.g===g))top.push(fav.find(x=>x.g===g));
   body=`
<section class="sec">
 <div class="event"><span class="lab">${T.name}, week ${clk(g.tour).w+1} of ${WEEKS}. ${c.type} event</span><b>${c.name}</b><span class="muted">${course.name}. Par ${course.par}, ${course.yards.toLocaleString()} yards. ${course.blurb} Rewards: ${course.rewards.toLowerCase()}.</span><span class="muted">Purse ${fmt$(c.purse)}, ${fmt$(c.purse*PAYF[0])} to the winner, who gets ${Math.round(500*c.pm)} points. ${c.fee?`Entry fee ${fmt$(c.fee)}.`:'No entry fee.'}</span></div>
 <div class="cols">
  <div class="stack">${canSkip(g)?`<span class="lab">This week</span><div class="opts"><button class="opt${g.enter?' on':''}" data-act="enterSet" data-v="1"><b>Enter</b><span>${c.fee?'Pay '+fmt$(c.fee)+' and play':'Play'}</span></button><button class="opt${g.enter?'':' on'}" data-act="enterSet" data-v="0"><b>Skip</b><span>Rest the legs, keep the fee, score no points</span></button></div>`:'<p class="muted small">College golfers play every event on the schedule.</p>'}
   <span class="lab">Round 1 tee time</span><div class="opts">${SLOTS.map((s,i)=>`<button class="opt${g.slot===i?' on':''}" data-act="slot" data-v="${i}"><b>${s.k}</b><span>${s.t}. ${s.note}</span></button>`).join('')}</div><p class="muted small">Round 2 flips the draw. On the weekend the leaders tee off last. He makes his own decisions on the course.</p></div>
  <div class="stack"><span class="lab">Odds to win</span><div class="scroll"><table class="tbl"><tbody>${top.map(x=>`<tr class="${x.g===g?'me':''}"><td>${flagHTML(x.g.country)}${esc(x.g.name)}${x.g!==g&&save.golfers.includes(x.g)?' <span class="tag">Yours</span>':save.sold.includes(x.g)?' <span class="tag">Sold</span>':''}</td><td class="num">${oddsLabel(x.p)}</td></tr>`).join('')}</tbody></table></div><p class="muted small">Set from ratings, course fit, confidence and legs. They move hole by hole once play starts.</p></div>
 </div>
</section>
<section class="sec"><h2>Season ${clk(g.tour).s} schedule</h2><div class="scroll"><table class="tbl"><thead><tr><th class="num">Wk</th><th>Event</th><th>Course</th><th>Type</th><th class="num">Purse</th><th class="num">Entry</th><th class="num">Win pts</th><th class="num">His finish</th></tr></thead><tbody>
 ${cal.map((e,i)=>{const h=g.hist.find(x=>x.gs===clk(g.tour).s&&x.w===i&&x.t===g.tour);return `<tr class="${i===clk(g.tour).w?'now':''}"><td class="num">${i+1}</td><td>${e.name}</td><td>${COURSES[e.ci].name}</td><td>${e.type}</td><td class="num">${fmt$(e.purse)}</td><td class="num">${e.fee?fmt$(e.fee):'–'}</td><td class="num">${Math.round(500*e.pm)}</td><td class="num">${h?h.pos:i<clk(g.tour).w?'Skipped':''}</td></tr>`}).join('')}</tbody></table></div>
 <p class="muted small">Play a week from the Stable page.</p></section>`;}
  else if(tab==='stand')body=`<section class="sec"><h2>${T.name}, season ${clk(g.tour).s} standings</h2>${standHTML(g)}</section>`;
  else body=`
<section class="sec"><h2>Equipment</h2><p class="muted small">Each upgrade adds about a point and a half to every shot played with those clubs.</p>
 <div class="shop">${'sml'.split('').map(u=>{const l=g.eq[u];return `<div class="item"><b>${EQN[u]}</b><span>Now: ${EQL[l]}.${l<3?` Next: ${EQL[l+1]}.`:''}</span>${l<3?`<button class="btn sm" data-act="buyEq" data-v="${u}" ${save.cash<EQC[l]?'disabled':''}>Upgrade for ${fmt$(EQC[l])}</button>`:'<span class="tag">Best available</span>'}</div>`}).join('')}</div></section>
${isCol(g.tour)?`<section class="sec"><h2>College</h2><label class="field" for="hcollege"><span>Plays for</span><select id="hcollege">${collegeOpts(collegeOf(g))}</select></label><p class="muted small">Moving to a college in another circuit resets his season points there.</p></section>`:''}
<section class="sec"><h2>Shirt</h2><div class="swatches">${COLORS.slice(0,colorsOwned()).map((c,i)=>`<button class="sw${i===g.color?' on':''}" data-act="shirt" data-v="${i}" style="--c:${c}" aria-label="Shirt colour ${i+1}"></button>`).join('')}</div></section>`;
  return `
<section class="sec">
 <div class="who">${avatarHTML(g)}<div><p class="eyebrow">${flagHTML(g.country)}${esc(g.arch)}</p><h1>${esc(g.name)}</h1></div></div>
 <p class="muted">Age ${g.retired?(g.retAge||ageOf(g.yr)):ageOf(g.yr)}. ${esc(tourLabel(g))}${g.retired?'':`, career season ${Math.min(g.yr,30)} of 30`}. Confidence: ${confWord(g.conf).toLowerCase()}. Stamina ${stam(g)}/5. Market value ${fmt$(valueOf(g.sk,g.yr))}.</p>
 ${ratingsHTML(g.sk)}
 ${!g.retired&&g.yr>=COACH_AGE_YR?(()=>{const o=coachRatings(g);return `<div class="retire"><div class="row"><div><span class="lab">Retire into coaching</span><p class="muted small">He's ${ageOf(g.yr)}, old enough to hang up the clubs and coach. Rival managers would pay about ${fmt$(fairPrice(o,fameOf(g)))} a lesson.</p></div><span class="bignum" title="Coaching rating">${Math.round(coOvr(o))}</span></div>${cobars(o)}<div class="row"><span class="muted small">This ends his playing career for good.</span><button class="btn sm" data-act="retireCoach" data-v="${g.id}">Retire and start coaching</button></div></div>`})():''}
</section>
${g.retired?'':`<div class="tabs">${[['range','Range'],['event','This week and schedule'],['stand','Standings'],['gear','Gear']].map(([k,n])=>`<button class="btn sm${tab===k?' on':''}" data-act="tab" data-v="${k}">${n}</button>`).join('')}</div>`}
${body}`}

function viewProfiles(){
  return `<section class="intro"><p class="eyebrow">Profiles</p><h1>Everyone on the books</h1></section>
${save.golfers.map((g,i)=>{const s=g.stats;return `<section class="profile">
 <div class="row"><div class="who">${avatarHTML(g)}<div><p class="eyebrow">${flagHTML(g.country)}${esc(g.arch)}</p><h1>${esc(g.name)}</h1></div></div><button class="btn sm" data-act="manage" data-v="${i}">${g.retired?'View':'Manage'}</button></div>
 <p class="muted">Age ${ageOf(g.yr)}. ${esc(tourLabel(g))}${g.retired?'':`, career season ${g.yr} of 30. Market value ${fmt$(valueOf(g.sk,g.yr))}`}. Lessons: ${coachObj(g.coachId)?esc(coachObj(g.coachId).name):'none booked'}. Gear: ${'sml'.split('').map(u=>EQN[u].toLowerCase()+' '+EQL[g.eq[u]].toLowerCase()).join(', ')}.</p>
 ${ratingsHTML(g.sk)}
 <div class="stats">
  <div><b>${s.ev}</b><span>Events</span></div><div><b>${s.cuts}</b><span>Cuts made</span></div><div><b>${s.wins}</b><span>Wins</span></div><div><b>${s.top10}</b><span>Top tens</span></div>
  <div><b>${s.rounds?fmt1(s.par/s.rounds):'–'}</b><span>Average round, to par</span></div><div><b>${s.low===null?'–':fmtPar(s.low)}</b><span>Lowest round</span></div><div><b>${fmt$(s.earn)}</b><span>Career earnings</span></div><div><b>${g.trophies.filter(t=>t.title).length}</b><span>Season titles</span></div>
 </div>
 <div class="umbs">${'smlx'.split('').map(u=>umbBlock(g,u,true)).join('')}${coachBlock(g)}</div>
 <div class="cols">
  <div class="sec"><h2>Season by season</h2>${g.seasons.length?`<div class="scroll tall"><table class="tbl"><thead><tr><th class="num">Year</th><th>Tour</th><th class="num">Rank</th><th class="num">Points</th><th class="num">Wins</th><th class="num">Earned</th></tr></thead><tbody>${g.seasons.slice().reverse().map(x=>`<tr><td class="num">${x.s}</td><td>${TOURS[x.tour].name}</td><td class="num">${x.rank}</td><td class="num">${fmtPts(x.pts)}</td><td class="num">${x.wins||''}</td><td class="num">${fmt$(x.earn)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No completed seasons yet.</p>'}
   <h2>Coach's notebook</h2><div class="notes">${notebook(s).map(l=>`<p class="hand">${esc(l)}</p>`).join('')}</div></div>
  <div class="sec"><h2>Play history</h2>${g.hist.length?`<div class="scroll tall"><table class="tbl"><thead><tr><th class="num">Yr</th><th>Event</th><th class="num">R1</th><th class="num">R2</th><th class="num">R3</th><th class="num">R4</th><th class="num">Par</th><th class="num">Pos</th><th class="num">Won</th></tr></thead><tbody>${g.hist.slice().reverse().map(x=>`<tr><td class="num">${x.s}</td><td>${esc(x.n)}</td>${[0,1,2,3].map(j=>`<td class="num">${x.r[j]||''}</td>`).join('')}<td class="num${x.par<0?' under':''}">${fmtPar(x.par)}</td><td class="num">${x.pos}</td><td class="num">${x.pay?fmt$(x.pay):''}</td></tr>`).join('')}</tbody></table></div><p class="muted small">The last ${g.hist.length} events. Career totals above cover everything.</p>`:'<p class="muted">No events played yet.</p>'}</div>
 </div>
</section>`}).join('')}`}

function cardHTML(course,scores){
  const half=(a,label)=>{const hs=course.holes.slice(a,a+9),done=scores.length>=a+9;
    return `<div class="scroll"><table class="card"><tr><th>Hole</th>${hs.map((h,i)=>`<th>${a+i+1}</th>`).join('')}<th>${label}</th></tr>
    <tr><td>Par</td>${hs.map(h=>`<td>${h.par}</td>`).join('')}<td>${sum(hs.map(h=>h.par))}</td></tr>
    <tr><td>Score</td>${hs.map((h,i)=>{const s=scores[a+i];if(s===undefined)return'<td></td>';const d=s-h.par;return `<td class="${d<=-2?'eg':d===-1?'bd':d===1?'bg':d>=2?'db':''}"><s>${s}</s></td>`}).join('')}<td><b>${done?sum(scores.slice(a,a+9)):''}</b></td></tr></table></div>`};
  return `<div class="cards">${half(0,'Out')}${half(9,'In')}</div>`}
function liveRows(ev){
  const rows=ev.players.filter(p=>!p.cut).map(p=>({p,tot:p.disp.tot}));
  rows.sort((a,b)=>(b.p.won?1:0)-(a.p.won?1:0)||a.tot-b.tot||(b.p.me?1:0)-(a.p.me?1:0));
  let i=0;while(i<rows.length){let j=i;if(!rows[i].p.won)while(j+1<rows.length&&!rows[j+1].p.won&&rows[j+1].tot===rows[i].tot)j++;for(let q=i;q<=j;q++){rows[q].posN=i+1;rows[q].pos=(j>i?'T':'')+(i+1);}i=j+1;}
  return rows;
}
const COLG='<colgroup><col style="width:3.3em"><col><col style="width:4.7em"><col style="width:3.3em"><col style="width:3.1em"></colgroup>';
function boardRow(ev,r,cutline){
  const d=r.p.disp,chip=d.run>=2?'<span class="chip hot">Hot</span>':d.run<=-2?'<span class="chip">Cold</span>':d.thru?`<span class="chip">${moodWord(d.mood)}</span>`:'';
  return `<tr class="${r.p.me?'me':r.p.mine?'mine':''}${cutline?' cutline':''}"><td class="num">${r.pos}</td><td class="nm">${flagHTML(r.p.g.country)}${esc(r.p.g.name)}${isCol(ev.tour)?`<small class="sch">${esc(collegeOf(r.p.g))}</small>`:''}${chip}</td><td class="num odds">${d.odds||''}</td><td class="num${r.tot<0?' under':''}">${fmtPar(r.tot)}</td><td class="num">${d.thru||'\u2013'}</td></tr>`;
}
/* Your golfers are pinned above the leaders, so their position is always on screen. */
function boardHTML(ev,title){
  const rows=liveRows(ev),full=ui.fullBoard,mine=rows.filter(r=>r.p.mine),show=full?rows:rows.slice(0,10);
  const cut=ev.round===1&&ev.cutLine===null&&rows.length>CUT?rows[CUT-1].tot:null;
  const lastIn=cut===null?-1:rows.filter(r=>r.tot<=cut).length-1;
  return `<div class="board"><div class="row"><h2>${title}</h2><span class="chip">${cut!==null?'Projected cut '+fmtPar(cut):ev.round>=2?'Cut fell at '+fmtPar(ev.cutLine):''}</span></div>
  <table>${COLG}<thead><tr><th class="num">Pos</th><th>Golfer</th><th class="num">Odds</th><th class="num">Par</th><th class="num">Thru</th></tr></thead><tbody>
  ${mine.length?`<tr class="sep"><td colspan="5">Your golfer${mine.length>1?'s':''}</td></tr>${mine.map(r=>boardRow(ev,r)).join('')}`:''}<tr class="sep"><td colspan="5">${full?'Full field':'Leaders'}</td></tr></tbody></table>
  <div class="${full?'bscroll':''}"><table>${COLG}<tbody>${show.map(r=>boardRow(ev,r,full&&rows.indexOf(r)===lastIn)).join('')}</tbody></table></div>
  <button class="btn sm" data-act="fullBoard">${full?'Show top 10':'Show all '+rows.length}</button></div>`}
function followBar(ev){
  const ms=ev.players.filter(p=>p.mine);if(ms.length<2)return'';
  return `<div class="status"><span class="lab">Watching</span>${ms.map(p=>`<button class="btn xs${p===ev.me?' on':''}" data-act="follow" data-v="${p.g.id}" ${p.cut&&p!==ev.me?'disabled':''}>${flagHTML(p.g.country)}${esc(p.g.name)}${p.cut?' (cut)':''}</button>`).join('')}</div>`;
}
function follow(id){
  const ev=ui.ev,p=ev&&ev.players.find(q=>q.mine&&q.g.id===id);if(!p||p===ev.me||p.cut)return;
  ev.players.forEach(q=>q.me=q===p);ev.me=p;ev.notes=p.notes||[];
  if(ui.view==='round'&&ev.resAll){ev.res=ev.resAll.get(p);ev.shots=ev.res.shots;ev.prevMood=p.st.mood;ev.cam=null;
    if(ev.phase==='post'){ev.si=ev.shots.length-1;ev.trail=ev.shots.slice();}else{ev.si=0;ev.phase='shot';ev.t=0;ev.w=0;ev.trail=[];}
    ev.feed.push({text:`Now watching ${p.g.name}.`,cls:'big'});if(ev.feed.length>6)ev.feed.shift();}
  render();
}
const collegeOpts=sel=>CONFS.map((c,i)=>`<optgroup label="${TOURS['col'+i].name}">${c.slice().sort().map(x=>`<option value="${esc(x)}"${x===sel?' selected':''}>${esc(x)}</option>`).join('')}</optgroup>`).join('');

function viewRound(){const ev=ui.ev,me=ev.me;return `
<section class="round">
 <div>
  <div class="holebar"><span><b id="hTitle"></b></span><span id="hMeta"></span><span class="wind"><i id="windArrow">↑</i><span id="windTxt"></span></span></div>
  <canvas id="cv" aria-label="Top-down map of the hole"></canvas>
  <div class="ctrl">
   <button class="btn sm" data-act="pause" id="pauseBtn">Pause</button>
   ${[1,2,4,8].map(s=>`<button class="btn sm spd${ev.speed===s?' on':''}" data-act="speed" data-v="${s}">${s}×</button>`).join('')}
   <span class="sp"></span>
   <button class="btn sm" data-act="skip">Skip hole</button><button class="btn sm" data-act="skipRound">Skip round</button>
  </div>
 </div>
 <div>
  ${followBar(ev)}
  <div class="status"><span class="lab">${flagHTML(me.g.country)}${esc(me.g.name)}</span><span class="tag" id="posTag"></span><span class="tag" id="moodTag"></span><span class="tag" id="oddsTag"></span><span id="runTag"></span></div>
  <div class="feed" id="feed" aria-live="polite"></div>
  <div id="board"></div>
  <div id="card"></div>
  <p class="muted small">${ev.name}, ${TOURS[ev.tour].name}. Round ${ev.round+1} of ${ROUNDS}. ${SLOTS[me.slot].k} tee time.</p>
 </div>
</section>`}

function viewBreak(){
  const ev=ui.ev,me=ev.me,g=me.g,rn=ev.round+1;
  let head,sub;
  if(me.cut){const by=me.evPar-ev.cutLine;head=`${esc(g.name)} misses the cut`;sub=`${fmtPar(me.evPar)} after 36 holes. The cut fell at ${fmtPar(ev.cutLine)}, so he is out by ${by} shot${by===1?'':'s'}. No points and no cheque this week.`;}
  else{const rows=liveRows(ev),row=rows.find(r=>r.p.me),lead=rows[0].tot;head=`${esc(g.name)} is ${posWords(row.pos,row.posN)}`;
    sub=`${me.rounds[ev.round]} today, ${fmtPar(me.evPar)} for the week${row.posN===1?'':', '+(me.evPar-lead)+' back'}. Odds to win: ${me.disp.odds}.${rn===2?` He made the cut, which fell at ${fmtPar(ev.cutLine)}.`:''}`;}
  const nextSlot=me.cut?null:rn>=2?(()=>{const s=ev.players.filter(p=>!p.cut).sort((a,b)=>b.evPar-a.evPar);return Math.min(2,Math.floor(s.indexOf(me)*3/s.length));})():2-me.slot0;
  return `
<section class="intro"><p class="eyebrow">${ev.name}, after round ${rn}</p><h1>${head}</h1><p class="lede">${sub}</p>${followBar(ev)}</section>
<section class="cols">
 <div class="sec">${boardHTML(ev,'After round '+rn)}</div>
 <div class="sec"><h2>Round ${rn} card</h2>${cardHTML(ev.course,me.st.scores)}
  <h2>What the coach saw</h2><div class="notes">${ev.notes.map(n=>`<p class="hand">${esc(n)}</p>`).join('')}</div>
  ${me.cut?`<div class="row"><span></span><button class="btn primary" data-act="simRest">See how it finishes</button></div>`:`
  <div class="row"><p class="muted small">Round ${rn+1}: ${SLOTS[nextSlot].k.toLowerCase()} tee time, ${SLOTS[nextSlot].t}.${rn>=2?' The draw goes by position.':''}</p><button class="btn primary" data-act="nextRound">Start round ${rn+1}</button></div>`}
 </div>
</section>`}

function viewResults(){
  const r=ui.res,last=r.tours.some(t=>clk(t).w+1>=WEEKS),played=r.all.filter(q=>!q.rested),x=played.find(q=>q.id===r.sel)||played[0];
  const next=`<button class="btn primary" data-act="afterResults">${last?'Close out the season':'On to the next week'}</button>`;
  let detail='';
  if(x){
    const ev=x.ev,p=x.p,cards=p.cards||[],rd=r.rd!==null&&r.rd<cards.length?r.rd:cards.length-1,notes=(p.notes||[]).concat(x.after);
    const line=(q,cls)=>`<tr class="${q===p?'me':q.mine?'now':''}${cls}"><td class="num">${q.pos}</td><td>${flagHTML(q.g.country)}${esc(q.g.name)}${isCol(ev.tour)?` <span class="muted small">${esc(collegeOf(q.g))}</span>`:''}</td>${[0,1,2,3].map(i=>`<td class="num">${q.rounds[i]||''}</td>`).join('')}<td class="num${q.evPar<0&&!q.cut?' under':''}">${fmtPar(q.evPar)}</td><td class="num">${q.fpts?fmtPts(q.fpts):''}</td><td class="num">${q.pay?fmt$(q.pay):''}</td></tr>`;
    detail=`<section class="sec" id="resDetail"><h2>${flagHTML(x.country)}${esc(x.name)} at the ${esc(ev.name)}</h2>
 <p class="lede">${TOURS[ev.tour].name}, ${COURSES[ev.cal.ci].name}. ${x.cut?`Missed the cut at ${fmtPar(x.toPar)} through 36 holes. No points, no cheque.`:`${x.posN===1?'Won':'Finished '+posWords(x.pos,x.posN)} at ${x.total} (${fmtPar(x.toPar)}). ${fmtPts(x.pts)} points and ${fmt$(x.pay)}.`} ${esc(x.story)}</p></section>
<section class="cols">
 <div class="sec"><h2>Final leaderboard</h2><div class="scroll tall"><table class="tbl"><thead><tr><th class="num">Pos</th><th>Golfer</th><th class="num">R1</th><th class="num">R2</th><th class="num">R3</th><th class="num">R4</th><th class="num">Total</th><th class="num">Pts</th><th class="num">Prize</th></tr></thead><tbody>
 ${ev.order.map(q=>line(q,'')).join('')}${ev.players.filter(q=>q.cut).sort((a,b)=>a.evPar-b.evPar).map(q=>line(q,' mc')).join('')}</tbody></table></div></div>
 <div class="sec"><h2>His rounds</h2>
  <div class="ctrl">${cards.map((c,i)=>`<button class="btn sm${i===rd?' on':''}" data-act="pickRd" data-v="${i}">R${i+1}: ${p.rounds[i]} (${fmtPar(p.rounds[i]-ev.course.par)})</button>`).join('')}</div>
  ${cards.length?cardHTML(ev.course,cards[rd]):''}
  <h2>What the coach saw</h2><div class="notes">${notes.map(n=>`<p class="hand">${esc(n)}</p>`).join('')||'<p class="muted">Nothing to report.</p>'}</div>
 </div>
</section>`;
  }
  return `
<section class="intro"><p class="eyebrow">${r.tours.map(t=>`${TOURS[t].name}, week ${clk(t).w+1}`).join(' \u00b7 ')}</p>
<h1>${played.length===1?`${esc(played[0].name)} ${played[0].cut?'misses the cut':played[0].posN===1?'wins':'finishes '+posWords(played[0].pos,played[0].posN)}`:'The week is in the books'}</h1>
<p class="lede">The stable won ${fmt$(sum(r.all.map(q=>q.pay||0)))} this week.${played.length>1?' Pick a golfer to see his event, his rounds and the full leaderboard.':''}</p></section>
<section class="sec"><h2>Your stable this week</h2><div class="scroll"><table class="tbl"><thead><tr><th>Golfer</th><th>Event</th><th class="num">Finish</th><th class="num">To par</th><th class="num">Points</th><th class="num">Prize</th><th class="num">Season rank</th></tr></thead><tbody>
 ${r.all.map(q=>`<tr class="${x&&q.id===x.id?'me':''}"><td>${q.rested?flagHTML(q.country)+esc(q.name):`<button class="btn xs${x&&q.id===x.id?' on':''}" data-act="pickRes" data-v="${q.id}">${flagHTML(q.country)}${esc(q.name)}</button>`}</td><td>${esc(q.event)}</td><td class="num">${q.rested?'Rested':q.pos}</td><td class="num">${q.rested?'':fmtPar(q.toPar)}</td><td class="num">${q.pts?fmtPts(q.pts):''}</td><td class="num">${q.pay?fmt$(q.pay):''}</td><td class="num">${q.rank||''}</td></tr>`).join('')}</tbody></table></div>
 <div class="row"><span></span>${next}</div></section>
${detail}`}

function viewSeason(){
  const s=ui.sea;return `
<section class="intro"><p class="eyebrow">Season complete</p><h1>How the stable finished</h1>
<p class="lede">${s.bonus?`${fmt$(s.bonus)} in season bonuses went into the account.`:'No season bonuses this year; those go to golfers in the top '+ZONE+' of their tour.'}</p></section>
<section class="gcards">${s.list.map(x=>`<div class="gcard"><div><p class="eyebrow">${flagHTML(x.country)}${TOURS[x.tour].name}</p><h2>${esc(x.name)}</h2></div>
 <div class="stats"><div><b>${ord(x.rank)}</b><span>of ${FIELD}</span></div><div><b>${fmtPts(x.pts)}</b><span>Points</span></div><div><b>${x.wins}</b><span>Wins</span></div></div>
 <div class="notes">${x.lines.map(n=>`<p class="hand">${esc(n)}</p>`).join('')}</div></div>`).join('')}</section>
<section class="sec"><h2>Season champions</h2><div class="scroll"><table class="tbl"><tbody>${s.champs.map(c=>`<tr><td>${TOURS[c.tour].name}, season ${c.s}</td><td>${flagHTML(c.c)}${esc(c.name)}${c.mine?' <span class="tag">Yours</span>':''}</td><td class="num">${fmtPts(c.pts)} pts</td></tr>`).join('')}</tbody></table></div>
 ${s.soldNews.map(n=>`<p class="hand">${esc(n)}</p>`).join('')}
 <div class="row"><span></span><button class="btn primary" data-act="go" data-v="stable">Back to the stable</button></div></section>`}

function paintNav(){
  const n=$('#nav'),acc=SB&&!acct.user&&acct.state!=='checking'&&ui.view!=='auth'?'<button class="btn sm" data-act="signin">Sign in</button>':'';
  if(!save||!save.golfers.length){n.innerHTML=acc;return;}
  const busy=['round','break','results','season'].includes(ui.view);
  n.innerHTML=(busy?'':[['stable','Stable'],['market','Market'],['coaches','Coaches'],['profiles','Profiles']].map(([k,l])=>`<button class="btn sm${ui.view===k?' on':''}" data-act="go" data-v="${k}">${l}</button>`).join(''))+(busy?'':acc)+`<span class="cash${save.cash<0?' red':''}" title="Bank balance">${fmt$(save.cash)}</span>`;
}
function render(){
  const v=$('#view');paintNav();
  if(ui.view==='new')v.innerHTML=viewNew();
  else if(ui.view==='auth')v.innerHTML=viewAuth();
  else if(ui.view==='stable')v.innerHTML=viewStable();
  else if(ui.view==='market')v.innerHTML=viewMarket();
  else if(ui.view==='coaches')v.innerHTML=viewCoaches();
  else if(ui.view==='hub')v.innerHTML=viewHub();
  else if(ui.view==='profiles')v.innerHTML=viewProfiles();
  else if(ui.view==='break')v.innerHTML=viewBreak();
  else if(ui.view==='results')v.innerHTML=viewResults();
  else if(ui.view==='season')v.innerHTML=viewSeason();
  else{v.innerHTML=viewRound();setupRound();}
}
function go(view){ui.view=view;ui.confirm=null;render();window.scrollTo(0,0);}

/* ---- range work ---- */
function gainFor(g,k,mult){const room=clamp(1-Math.pow(g.sk[k]/g.ce[k],3),0,1);return(1.6+R()*1.8)*mult*room*(1-g.fatigue/160)*(.8+g.sk.attitude/250);}
function addSkill(g,k,x){const b=g.sk[k];g.sk[k]=clamp(b+x,20,Math.max(b,g.ce[k]));return g.sk[k]-b;}
function train(v){
  const g=G();if(g.sessions<=0||g.retired)return;
  let cm=1,cnote='';
  if(v!=='rest'&&g.coachId){const c=coachObj(g.coachId),u=SUB[v]?v:umbOf(v);
    if(!c)g.coachId=null;
    else if(c.left<=0)cnote=` ${c.name} has no lessons left this week, so he worked alone.`;
    else if(!c.own&&save.cash<c.price)cnote=` You can't cover ${c.name}'s ${fmt$(c.price)} fee, so he worked alone.`;
    else{cm=coMult(c.co[u]);useLesson(c);if(!c.own)save.cash-=c.price;cnote=` Lesson with ${c.name}: \u00d7${cm.toFixed(2)}${c.own?'':', '+fmt$(c.price)}.`;}}
  g.sessions--;
  if(v==='rest'){g.fatigue=Math.max(0,g.fatigue-30);g.carry=clamp((g.carry||0)+.05,-.4,.4);ui.msg='Day off. He comes back looser.';}
  else if(SUB[v]){
    const b=um(g.sk,v);for(const k of SUB[v])addSkill(g,k,gainFor(g,k,.5*cm));
    const capped=SUB[v].filter(k=>g.sk[k]>=g.ce[k]-.05).length,d=um(g.sk,v)-b;g.trained[v]=1;g.fatigue=Math.min(100,g.fatigue+15);
    ui.msg=`${UMB[v]} +${d.toFixed(1)}.`+(capped===SUB[v].length?' Every part of it has topped out.':capped?` ${capped} of its ${SUB[v].length} parts have topped out.`:d<.35?' The gains are getting thin.':'');
  }else{
    const room=clamp(1-Math.pow(g.sk[v]/g.ce[v],3),0,1),d=addSkill(g,v,gainFor(g,v,2.2*cm));g.trained[umbOf(v)]=1;g.fatigue=Math.min(100,g.fatigue+15);
    ui.msg=g.sk[v]>=g.ce[v]-.05?`${SUBN[v]}: he's topped out. This is as good as it gets.`:`${SUBN[v]} +${d.toFixed(1)}.`+(room<.3?' The gains are getting thin. He may be near his limit.':d<.8&&g.fatigue>55?' He looked tired out there.':'');
  }
  ui.msg+=cnote;persist();render();
}

/* ---- the week: one event per tour, your golfers in their fields ---- */
function setDisp(ev,thru){
  const act=ev.players.filter(p=>!p.cut),left=(ROUNDS-1-ev.round)*HOLES+(thru==='F'?0:HOLES-thru);
  act.forEach(p=>{p.disp={tot:evTot(ev,p),thru,mood:p.st.mood,run:thru==='F'?0:p.st.run};});
  if(left>0){const pr=winProbs(act.map(p=>({r:p.rate,cur:p.disp.tot,H:left})),500);act.forEach((p,i)=>{p.disp.wp=pr[i];p.disp.odds=oddsLabel(pr[i]);});}
}
function buildEvent(tour,watch){
  const cal=calNow(tour),c=tourCast(tour),ent=c.mine.filter(g=>g.enter||!canSkip(g)).sort((a,b)=>(b===watch?1:0)-(a===watch?1:0));
  ent.forEach(g=>{save.cash-=cal.fee;g.played=true;});
  const ev=makeEvent(cal.ci,ent.map(g=>({g,mine:true,me:g===watch})).concat(c.sold.map(g=>({g})),c.ai.map(g=>({g}))));
  ev.name=cal.name;ev.tour=tour;ev.cal=cal;ev.me=ev.players.find(p=>p.me)||null;ev.notes=[];ev.feed=[];ev.paused=false;
  ev.speed=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches?4:1;
  ev.players.forEach(p=>p.rate=ratingFor(p.g,cal.ci));setDisp(ev,0);return ev;
}
/* per-round numbers behind each golfer's notebook; the watched golfer also gets the coach's notes */
function recordRound(ev,p){
  if(p.rounds.length!==ev.round+1)return;
  const g=p.g,st=g.stats,sc=p.st.scores,pars=ev.course.holes.map(h=>h.par);(p.cards=p.cards||[]).push(sc.slice());
  const others=ev.players.filter(q=>q!==p&&q.rounds.length===ev.round+1),fa=avg(others.map(q=>q.st.toPar));
  st.rounds++;st.par+=p.st.toPar;if(st.low===null||p.st.toPar<st.low)st.low=p.st.toPar;
  if(save.rec.low===null||p.st.toPar<save.rec.low)save.rec.low=p.st.toPar;
  st.slot[p.slot][0]+=p.st.toPar-fa;st.slot[p.slot][1]++;
  sc.forEach((s,i)=>{const d=s-pars[i];st.all[0]+=d;st.all[1]++;if(i>=15){st.cl[0]+=d;st.cl[1]++;}if(i>0&&sc[i-1]-pars[i-1]>=1){st.ab[0]+=d;st.ab[1]++;}});
  const notes=[];
  for(let i=0;i<HOLES-1;i++){const d=sc[i]-pars[i],n=sc[i+1]-pars[i+1];
    if(d>=2&&n>=1){notes.push(`The ${d===2?'double':'mess'} on ${i+1} stayed with him. He dropped another shot on ${i+2}.`);break;}
    if(d>=1&&n<=-1){notes.push(`Shook off the bogey on ${i+1} with a birdie on ${i+2}.`);break;}}
  const last3=sum(sc.slice(15))-sum(pars.slice(15));
  notes.push(`Played the closing three holes in ${last3===0?'level par':fmtPar(last3)}.`);
  notes.push(`${SLOTS[p.slot].k} tee time: ${Math.abs(p.st.toPar-fa).toFixed(1)} shots ${p.st.toPar<=fa?'better':'worse'} than the field today.`);
  if(g.fatigue>=50)notes.push('His legs looked heavy. A day off next week might help.');
  p.notes=notes;if(p.me)ev.notes=notes;
}
const recordAll=ev=>ev.players.forEach(p=>{if(p.mine)recordRound(ev,p);});
function simOut(ev){for(;;){playRound(ev);recordAll(ev);if(ev.round>=ROUNDS-1)break;ev.round++;beginRound(ev);}}
/* points, prize money and what the result does to each of your golfers */
function settle(ev){
  finishEvent(ev);const cal=ev.cal,st=tourStand(ev.tour),win=ev.order[0],po=ev.playoff,out=[];
  ev.players.forEach(p=>{
    p.fpts=Math.round(p.pts*cal.pm*10)/10;p.pay=Math.round(p.payf*cal.purse);
    if(!p.mine){const id=typeof p.g.id==='number'?p.g.id:'s_'+p.g.id;if(p.fpts)st.pts[id]=Math.round(((st.pts[id]||0)+p.fpts)*10)/10;if(p.won)st.wins[id]=(st.wins[id]||0)+1;return;}
    const g=p.g,s=g.stats,after=[];let story;g.best=Math.max(g.best||0,ovr(g.sk));
    if(p.won)story=po?`He won it in a playoff over ${po.losers.map(q=>q.g.name).join(' and ')}.`:`He won by ${ev.order[1].evPar-p.evPar}.`;
    else story=po?(po.losers.includes(p)?`He lost a playoff to ${win.g.name}.`:`${win.g.name} won in a playoff at ${fmtPar(win.evPar)}.`):`${win.g.name} won at ${fmtPar(win.evPar)}.`;
    g.sPts=Math.round(((g.sPts||0)+p.fpts)*10)/10;save.cash+=p.pay;g.sEarn+=p.pay;s.earn+=p.pay;s.ev++;if(!p.cut)s.cuts++;if(p.pay>save.rec.cheque)save.rec.cheque=p.pay;
    if(p.posN===1){s.wins++;g.sWins++;s.top10++;g.trophies.push({s:clk(ev.tour).s,n:ev.name,t:ev.tour});addSkill(g,'clutch',.8);addSkill(g,'mental',.5);addSkill(g,'momentum',.5);g.conf=2.5;after.push(`${g.name}: a win changes a golfer. Clutchness, mental game and momentum ticked up, and his confidence is sky high.`);}
    else if(p.posN<=10){s.top10++;addSkill(g,'momentum',.4);addSkill(g,'mental',.2);g.conf=1.5;after.push(`${g.name}: a top ten. Momentum and mental game ticked up, and he goes to the next event confident.`);}
    else if(p.cut){addSkill(g,'mental',-.3);addSkill(g,'momentum',-.2);g.conf=-1.5;after.push(`${g.name}: the missed cut stings. Mental game and momentum slipped a touch, and his confidence is shaken.`);}
    else g.conf=p.posN<=25?.5:0;
    g.hist.push({s:g.yr,gs:clk(ev.tour).s,w:clk(ev.tour).w,n:ev.name,t:ev.tour,r:p.rounds.slice(),par:p.evPar,pos:p.pos,pts:p.fpts,pay:p.pay});if(g.hist.length>40)g.hist.shift();
    g.carry=p.posN===1?.3:p.posN<=10?.15:p.cut?-.15:0;
    out.push({id:g.id,g,ev,p,name:g.name,country:g.country,event:ev.name,tour:ev.tour,pos:p.pos,posN:p.posN,cut:p.cut,total:sum(p.rounds),toPar:p.evPar,pts:p.fpts,pay:p.pay,story,after});
  });
  return out;
}
function playWeek(watchId,only){
  const watch=watchId?save.golfers.find(g=>g.id===watchId):null,all=[...new Set(active().map(g=>g.tour))],tours=watch?[watch.tour]:only?[only]:all;
  ui.res={all:[],notes:[],ev:null,watched:null,tours};ui.ev=null;ui.fullBoard=false;
  active().forEach(g=>{if(tours.includes(g.tour))g.played=false;});
  for(const tour of tours){const ev=buildEvent(tour,watch);if(ev.me)ui.ev=ev;else{simOut(ev);finishTour(ev);}}
  if(ui.ev)go('round');else showResults();
}
function finishTour(ev){
  const out=settle(ev);ui.res.all.push(...out);out.forEach(o=>ui.res.notes.push(...o.after));
  if(ev.me){ui.res.ev=ev;ui.res.watched=out.find(o=>o.g===ev.me.g);ui.res.notes=ev.notes.concat(ui.res.notes);}
  else if(!ui.res.ev&&out.length)ui.res.ev=ev;
}
function showResults(){
  const r=ui.res;
  active().forEach(g=>{if(!g.played&&r.tours.includes(g.tour))r.all.push({id:g.id,name:g.name,country:g.country,event:calNow(g.tour).name,rested:true});});
  r.all.forEach(x=>{const g=save.golfers.find(q=>q.id===x.id);if(g)x.rank=standRows(g.tour).find(q=>q.g===g).rank;});
  const first=r.watched||r.all.find(x=>!x.rested);r.sel=first?first.id:null;r.rd=null;
  go('results');
}
function afterRound(){const ev=ui.ev;ev.loop=false;recordAll(ev);setDisp(ev,'F');if(ev.round===ROUNDS-1){finishTour(ev);showResults();}else go('break');}
function nextRound(){const ev=ui.ev;ev.round++;beginRound(ev);setDisp(ev,0);ev.feed=[];go('round');}
function simRest(){const ev=ui.ev;while(ev.round<ROUNDS-1){ev.round++;beginRound(ev);playRound(ev);recordAll(ev);}setDisp(ev,'F');finishTour(ev);showResults();}
/* week over: legs, rust, the market, and the season if that was the last event */
function advanceWeek(){
  const news=[],tours=(ui.res&&ui.res.tours)||[],here=active().filter(g=>tours.includes(g.tour));
  here.forEach(g=>{
    g.fatigue=clamp(g.fatigue-(g.played?14:40),0,100);
    for(const u of'sml')if(!g.trained[u])for(const k of SUB[u])g.sk[k]=Math.max(20,g.sk[k]-.1);
    g.sessions=SESSIONS;g.trained={};g.enter=true;g.played=false;
  });
  here.filter(g=>g.ask).forEach(g=>{const val=valueOf(g.sk,g.yr);
    if(canSell(g)&&active().length>1&&R()*100<saleChance(g.ask,val)){const c=pick(RIVALS);news.push(`${c} met your price: ${g.name} is sold for ${fmt$(g.ask)}. He stays on the ${TOURS[g.tour].name}.`);sell(g,g.ask,c);}
    else if(g.ask>val*1.45)news.push(`No coach will go near ${fmt$(g.ask)} for ${g.name}. The market has him at ${fmt$(val)}.`);});
  ensureMarket();save.market=save.market.filter(()=>R()>.25);ensureMarket();
  coachWeek(news);
  save.news=news;ui.ev=null;ui.res=null;ui.msg='';ui.odds={};
  tours.forEach(t=>clk(t).w++);const done=tours.filter(t=>clk(t).w>=WEEKS);
  if(done.length)closeSeason(done);else{persist();go('stable');}
}
/* a tour's season ends on its own schedule; only the golfers on that tour move on a year */
function closeSeason(done){
  const list=[],champs=[],soldNews=[],moved=[],rowsBy={};let total=0;
  done.forEach(t=>{rowsBy[t]=standRows(t);const c=rowsBy[t][0];champs.push({tour:t,s:clk(t).s,name:c.name,c:c.c,pts:c.pts,mine:!!c.mine});});
  active().filter(g=>done.includes(g.tour)).forEach(g=>{
    const me=rowsBy[g.tour].find(r=>r.g===g),rank=me.rank,tour=g.tour,T=TOURS[tour],y=g.yr,top=rank<=ZONE,bot=rank>FIELD-ZONE,lines=[];
    if(g.late){g.late=false;lines.push('He joined part-way through, so this season does not count against his 30 and he could not be promoted or relegated. A full season starts now.');
      list.push({name:g.name,country:g.country,tour,rank,pts:me.pts,wins:g.sWins,lines});g.sPts=0;g.sWins=0;g.sEarn=0;g.conf=0;return;}
    const bonus=Math.round(T.purse*(rank===1?.5:rank<=5?.2:rank<=10?.1:top?.04:0));save.cash+=bonus;g.stats.earn+=bonus;total+=bonus;
    let next=tour,note;
    if(y===4){next=top?'p2':'p3';note=`He turns professional on the ${TOURS[next].name}.`;}
    else if(y===20){next=(tour==='p1'||(tour==='p2'&&top))?'c1':'c2';note=`He moves to the senior game on the ${TOURS[next].name}.`;}
    else if(y>=30){retireToCoach(g);note='That was his 30th and final season. He retires and opens a coaching practice.';}
    else if(isCol(tour))note=`He comes back for his ${CLASS[y].toLowerCase()} year.`;
    else if(top&&UP[tour]){next=UP[tour];note=`Promoted to the ${TOURS[next].name}.`;}
    else if(bot&&DOWN[tour]){next=DOWN[tour];note=`Relegated to the ${TOURS[next].name}.`;}
    else note=`He stays on the ${T.name}.`;
    if(rank===1)g.trophies.push({s:clk(tour).s,n:T.name+' season title',t:tour,title:true});
    g.seasons.push({s:y,tour,rank,pts:me.pts,wins:g.sWins,earn:g.sEarn+bonus});
    lines.push(note);if(bonus)lines.push(`${fmt$(bonus)} season bonus.`);
    if(!g.retired&&y>=15){const k=y>=20?1:.5;addSkill(g,'pow',-.8*k);addSkill(g,'lacc',-.3*k);if(y>=20)for(const x of['wedge','pitch','chip','bunker','sputt','lputt','iacc','idist'])addSkill(g,x,-.3);lines.push(y>=20?'Another year older. He lost a little length and a little touch.':'He lost a yard or two off the tee this winter.');}
    list.push({name:g.name,country:g.country,tour,rank,pts:me.pts,wins:g.sWins,lines});
    g.yr++;g.tour=next;g.sPts=0;g.sWins=0;g.sEarn=0;g.conf=0;if(next!==tour&&!g.retired)moved.push(g);
  });
  /* golfers you sold keep their careers going under their new coaches */
  save.sold=save.sold.filter(s=>{
    if(!done.includes(s.tour))return true;
    const rows=rowsBy[s.tour],r=rows&&rows.find(x=>x.sold===s),old=s.tour;
    if(s.yr>=30){ensureCoaches();const co=coLift(s.co||rawCo(s.id),Math.max(s.best||0,ovr(s.sk))),fame={wins:0,titles:0,best:TRANK[old]?old:'p3'};
      save.coaches.push({id:'sold'+s.id,name:s.name,country:s.country,age:59,co,fame,peak:Math.round(Math.max(s.best||0,ovr(s.sk))),earn:0,seasons:30,mgr:s.coach,price:fairPrice(co,fame),left:LESSONS,given:0,cearn:0,former:true});
      soldNews.push(`${s.name} has retired and now coaches for ${s.coach}. You can book him on the Coaches page.`);return false;}
    if(r){if(s.yr===4)s.tour=r.rank<=ZONE?'p2':'p3';else if(s.yr===20)s.tour=(old==='p1'||(old==='p2'&&r.rank<=ZONE))?'c1':'c2';else if(r.rank<=ZONE&&UP[old])s.tour=UP[old];else if(r.rank>FIELD-ZONE&&DOWN[old])s.tour=DOWN[old];
      if(s.tour!==old&&!isCol(old))soldNews.push(`${s.name}, now with ${s.coach}, ${UP[old]===s.tour?'went up to':'moved to'} the ${TOURS[s.tour].name}.`);}
    else if(s.yr===4)s.tour='p3';else if(s.yr===20)s.tour='c2';
    for(const k of KEYS)s.sk[k]=clamp(s.sk[k]+(s.yr<18?(s.ce[k]-s.sk[k])*.12:-.4),20,99);
    s.yr++;return true;});
  done.forEach(t=>{delete save.stand[t];const c=clk(t);c.s++;c.w=0;});
  arriveAll(moved);
  moved.forEach(g=>{const x=list.find(q=>q.name===g.name);if(x)x.lines.push(g.late?`The ${TOURS[g.tour].name} is already in week ${clk(g.tour).w+1}, so he joins part-way through. That part-season won't count against his career.`:`He starts at week 1 of the ${TOURS[g.tour].name} season.`);});
  ui.sea={list,champs,bonus:total,soldNews};ui.tab='range';ui.odds={};
  persist();go('season');
}

/* ---- watching a round ---- */
function setupRound(){
  const ev=ui.ev;fitCanvas();
  if(!ev.loop){ev.loop=true;beginHole();ev.last=performance.now();requestAnimationFrame(frame);}
  else{paintHUD();paintSide();}
}
function fitCanvas(){const cv=$('#cv');if(!cv)return;const dpr=Math.min(2,window.devicePixelRatio||1),r=cv.getBoundingClientRect();cv.width=Math.max(200,Math.round(r.width*dpr));cv.height=Math.max(250,Math.round(r.height*dpr));if(ui.ev)ui.ev.cam=null;}
function camFor(ev,green){const cv=$('#cv'),W=cv.width,H=cv.height,h=ev.h;
  if(green)return{x:h.green[0],y:h.green[1],s:Math.min(W,H)/110};
  const b=h.box;return{x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,s:Math.min(W/(b[2]-b[0]),H/(b[3]-b[1]))};}
function feed(text,cls){const ev=ui.ev;ev.feed.push({text,cls:cls||''});if(ev.feed.length>6)ev.feed.shift();paintFeed();}
function paintFeed(){const el=$('#feed');if(!el)return;const f=ui.ev.feed;el.innerHTML=f.map((x,i)=>`<p class="${x.cls}${i===f.length-1?' now':''}">${esc(x.text)}</p>`).join('');}
function paintHUD(){const ev=ui.ev,h=ev.h;if(!$('#hTitle'))return;
  $('#hTitle').textContent=`R${ev.round+1} · Hole ${ev.hole+1}`;$('#hMeta').textContent=`Par ${h.par}, ${h.len} yards`;
  const w=windOf(ev,ev.me);$('#windArrow').style.transform=`rotate(${w.dir}rad)`;$('#windTxt').textContent=`${Math.round(w.mph)} mph`;}
function paintSide(){const ev=ui.ev,me=ev.me;if(!$('#board'))return;
  $('#board').innerHTML=boardHTML(ev,'Leaderboard');$('#card').innerHTML=cardHTML(ev.course,me.st.scores.slice(0,me.disp.thru||0));
  const row=liveRows(ev).find(r=>r.p===me);$('#posTag').textContent=row?`${row.pos} at ${fmtPar(row.tot)}`:'';$('#moodTag').textContent=moodWord(me.disp.mood);$('#oddsTag').textContent='To win '+(me.disp.odds||'');
  $('#runTag').innerHTML=me.disp.run>=2?'<span class="tag hot">Hot streak</span>':me.disp.run<=-2?'<span class="tag cold">Gone cold</span>':'';
  paintFeed();$('#pauseBtn').textContent=ev.paused?'Play':'Pause';}
function leaderName(ev){const rows=liveRows(ev);return rows.length>1&&rows[0].tot===rows[1].tot?null:rows[0].p.g.name;}
function favName(ev){let b=null;ev.players.forEach(p=>{if(!p.cut&&p.disp.wp!==undefined&&(!b||p.disp.wp>b.disp.wp))b=p;});return b?b.g.name:null;}
function beginHole(){
  const ev=ui.ev,me=ev.me;ev.h=ev.course.holes[ev.hole];ev.prevMood=me.st.mood;ev.prevLead=leaderName(ev);ev.prevFav=favName(ev);
  ev.resAll=simHole(ev);ev.res=ev.resAll.get(me);ev.shots=ev.res.shots;ev.si=0;ev.phase='shot';ev.t=0;ev.w=0;ev.trail=[];ev.cam=null;
  paintHUD();paintSide();feed(`Hole ${ev.hole+1}. Par ${ev.h.par}, ${ev.h.len} yards.`,'big');
}
const SCORE_NAMES={'-3':'Albatross','-2':'Eagle','-1':'Birdie','0':'Par','1':'Bogey','2':'Double bogey','3':'Triple bogey'};
function endHole(quiet){
  const ev=ui.ev,me=ev.me,h=ev.h;setDisp(ev,ev.hole+1);
  if(!quiet){
    const d=ev.res.score-h.par,tot=evTot(ev,me);
    feed(`${SCORE_NAMES[d]||'A '+ev.res.score}. ${me.g.name} is ${tot===0?'level par':fmtPar(tot)}${ev.round?' for the week':''} through ${ev.hole+1}.`,'big');
    const dm=me.st.mood-ev.prevMood;
    if(dm<=-.3)feed(pick(['He slams the club back into the bag.','Jaw tight on the walk to the next tee.','He is talking to himself now.']));
    else if(dm>=.25)feed(pick(['A small fist pump. He liked that one.','He is walking taller.','Loose shoulders, quick step.']));
    const nl=leaderName(ev),nf=favName(ev);
    if(nl&&nl!==ev.prevLead&&nl!==me.g.name)feed(`${nl} moves into the lead.`);
    else if(nl===me.g.name&&ev.prevLead!==nl)feed(`${me.g.name} has the lead.`,'big');
    else if(nf&&nf!==ev.prevFav)feed(nf===me.g.name?`${nf} is now the favourite at ${me.disp.odds}.`:`The odds have a new favourite: ${nf}.`);
  }
  ev.phase='post';ev.w=0;paintSide();
}
function nextHole(){const ev=ui.ev;ev.hole++;if(ev.hole>=HOLES){endRound(ev);afterRound();}else beginHole();}
function skipRound(){const ev=ui.ev;ev.hole++;playRound(ev);afterRound();}
const shotDur=s=>s.k==='full'?900+dist(s.from,s.to)*2.4:s.k==='chip'?800:s.k==='putt'?750:s.k==='drop'?350:500;
function frame(ts){
  const ev=ui.ev;if(ui.view!=='round'||!ev||!ev.loop)return;
  const dt=ev.paused?0:Math.min(60,ts-ev.last)*ev.speed;ev.last=ts;
  if(ev.phase==='shot'){const sh=ev.shots[ev.si];ev.t+=dt/shotDur(sh);if(ev.t>=1){ev.t=1;feed(sh.text);ev.trail.push(sh);ev.phase='wait';ev.w=0;}}
  else if(ev.phase==='wait'){ev.w+=dt;if(ev.w>(ev.shots[ev.si].holed?1000:750)){ev.si++;if(ev.si>=ev.shots.length){ev.si=ev.shots.length-1;endHole();}else{ev.phase='shot';ev.t=0;}}}
  else if(ev.phase==='post'){ev.w+=dt;if(ev.w>1700){nextHole();if(ui.view!=='round')return;}}
  drawMap(dt);requestAnimationFrame(frame);
}
function drawMap(dt){
  const ev=ui.ev,cv=$('#cv');if(!cv||!ev.h)return;const c=cv.getContext('2d'),W=cv.width,H=cv.height,h=ev.h,sh=ev.shots[ev.si];
  const e=ev.phase==='shot'?1-Math.pow(1-ev.t,2.2):1,ball=ev.phase==='shot'?lerp(sh.from,sh.to,e):sh.to;
  const tgt=camFor(ev,dist(ev.phase==='shot'?sh.from:sh.to,h.green)<=52);
  if(!ev.cam)ev.cam=tgt;else{const k=1-Math.exp(-(dt||16)/260);ev.cam={x:ev.cam.x+(tgt.x-ev.cam.x)*k,y:ev.cam.y+(tgt.y-ev.cam.y)*k,s:ev.cam.s+(tgt.s-ev.cam.s)*k};}
  const cam=ev.cam,X=x=>(x-cam.x)*cam.s+W/2,Y=y=>H/2-(y-cam.y)*cam.s,S=cam.s;
  c.fillStyle=MAP.tree;c.fillRect(0,0,W,H);
  c.fillStyle=MAP.dot;for(const t of h.trees){c.beginPath();c.arc(X(t[0]),Y(t[1]),Math.max(1.5,t[2]*S),0,6.3);c.fill();}
  c.lineCap='round';c.lineJoin='round';
  const path=pts=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));};
  c.strokeStyle=MAP.rough;c.lineWidth=2*h.tree*S;path(h.pts);c.stroke();
  c.fillStyle=MAP.rough;c.beginPath();c.arc(X(h.green[0]),Y(h.green[1]),h.tree*S,0,6.3);c.fill();
  const fp=[pointAt(h,h.fs0).p];for(let i=1;i<h.pts.length-1;i++)if(h.cum[i]>h.fs0&&h.cum[i]<h.fs1)fp.push(h.pts[i]);fp.push(pointAt(h,h.fs1).p);
  c.strokeStyle=MAP.fair;c.lineWidth=2*h.fw*S;path(fp);c.stroke();
  c.fillStyle=MAP.tee;c.fillRect(X(-5),Y(4),10*S,8*S);
  c.fillStyle=MAP.water;for(const w of h.water){c.beginPath();c.ellipse(X(w.x),Y(w.y),w.rx*S,w.ry*S,w.rot,0,6.3);c.fill();}
  c.fillStyle=MAP.fringe;c.beginPath();c.arc(X(h.green[0]),Y(h.green[1]),(h.gr+3)*S,0,6.3);c.fill();
  c.fillStyle=MAP.green;c.beginPath();c.arc(X(h.green[0]),Y(h.green[1]),h.gr*S,0,6.3);c.fill();
  c.fillStyle=MAP.sand;for(const b of h.sand){c.beginPath();c.arc(X(b.x),Y(b.y),b.r*S,0,6.3);c.fill();}
  const px=X(h.pin[0]),py=Y(h.pin[1]),u=Math.max(W/55,5);
  /* holed: the ball drops out of sight, the cup flashes and a ring spreads from it */
  const holed=!!sh.holed,sunk=holed&&ev.phase!=='shot',hw=sunk?(ev.phase==='wait'?ev.w/1000:1):0;
  c.fillStyle='#10201a';c.beginPath();c.arc(px,py,Math.max(2.5,.45*S),0,6.3);c.fill();
  if(sunk&&hw<1){c.strokeStyle=`rgba(255,255,255,${1-hw})`;c.lineWidth=Math.max(2,u*.22);c.beginPath();c.arc(px,py,u*(.6+hw*3.2),0,6.3);c.stroke();
    c.strokeStyle=`rgba(227,180,32,${1-hw})`;c.beginPath();c.arc(px,py,u*(.3+hw*1.8),0,6.3);c.stroke();}
  c.strokeStyle='#10201a';c.lineWidth=Math.max(1.5,u*.14);c.beginPath();c.moveTo(px,py);c.lineTo(px,py-u*2.2);c.stroke();
  c.fillStyle='#e3b420';c.beginPath();c.moveTo(px,py-u*2.2);c.lineTo(px+u*1.3,py-u*1.75);c.lineTo(px,py-u*1.3);c.fill();
  c.lineWidth=Math.max(1.5,u*.16);c.strokeStyle='rgba(255,255,255,.6)';c.setLineDash([u*.6,u*.5]);
  for(const s of ev.trail){if(s.k==='drop'||s.k==='pick')continue;c.beginPath();c.moveTo(X(s.from[0]),Y(s.from[1]));c.lineTo(X(s.to[0]),Y(s.to[1]));c.stroke();}
  if(ev.phase==='shot'&&sh.k!=='drop'){c.beginPath();c.moveTo(X(sh.from[0]),Y(sh.from[1]));c.lineTo(X(ball[0]),Y(ball[1]));c.stroke();}
  c.setLineDash([]);
  if(sunk){
    if(hw<1){c.fillStyle=`rgba(255,255,255,${Math.min(1,2.2*(1-hw))})`;c.font=`700 ${Math.round(u*1.5)}px 'Barlow Condensed','Arial Narrow',sans-serif`;c.textAlign='center';
      c.strokeStyle=`rgba(16,32,26,${Math.min(1,2.2*(1-hw))})`;c.lineWidth=u*.3;const ty=Math.max(u*2,py-u*3.4-hw*u);c.strokeText('IN THE HOLE',px,ty);c.fillText('IN THE HOLE',px,ty);}
    return;
  }
  const air=ev.phase==='shot'&&sh.k!=='putt'&&sh.k!=='drop'?Math.sin(Math.PI*ev.t):0,lift=air*Math.min(H*.09,dist(sh.from,sh.to)*S*.16);
  const drop=holed&&ev.t>.88?Math.max(0,1-(ev.t-.88)/.12):1,br=u*.42*(1+air*.7)*drop;
  const bx=X(ball[0]),by=Y(ball[1]);if(br<=.2)return;
  c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(bx+lift*.3,by+u*.12,br,br*.6,0,0,6.3);c.fill();
  c.fillStyle='#fff';c.strokeStyle=COLORS[ev.players[0].g.color]||'#222';c.lineWidth=Math.max(1.5,u*.16);c.beginPath();c.arc(bx,by-lift,br,0,6.3);c.fill();c.stroke();
}


/* ---- events ---- */
function busyThen(b,fn){b.disabled=true;b.textContent='Working…';setTimeout(fn,30);}
const byId=id=>save.golfers.find(g=>g.id===id);
document.addEventListener('submit',e=>{if(e.target.id==='authForm'){e.preventDefault();submitAuth();}});
document.addEventListener('input',e=>{if(e.target.id==='gname')ui.name=e.target.value;});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='gcountry'){ui.country=t.value;render();}else if(t.id==='gcollege')ui.college=t.value;else if(t.id==='coachSel'){G().coachId=t.value||null;ui.msg='';persist();render();}else if(t.id==='hcollege'){const g=G(),nt='col'+confOf(t.value);g.college=t.value;if(nt!==g.tour){g.tour=nt;arriveAll([g]);ui.odds={};}persist();render();}});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;const act=b.dataset.act,v=b.dataset.v,ev=ui.ev;
  if(act==='go')go(v);
  else if(act==='signin'){ui.auth.mode='in';ui.auth.msg='';ui.auth.err=false;go('auth');}
  else if(act==='authMode'){ui.auth.mode=v;ui.auth.msg='';ui.auth.err=false;render();}
  else if(act==='signout')signOut();
  else if(act==='restoreBackup'){let s=null;try{s=migrate(JSON.parse(localStorage.getItem(BACKUP)))}catch(e){}if(!s)return;
    if(ui.confirm!=='rb'){ui.confirm='rb';b.textContent='Tap again: this replaces the career you have now';return;}
    try{localStorage.removeItem(BACKUP)}catch(e){}save=s;ui.confirm=null;ui.odds={};save.news=['The career from before you signed in is back.'];persist();go('stable');}
  else if(act==='color'){ui.color=+v;render();}
  else if(act==='reroll'){if(ui.rerolls>0){ui.rerolls--;ui.prospect=rollProspect();render();}}
  else if(act==='junior'){ui.prospect=rollProspect();ui.rerolls=3;ui.name=pick(NAMES.US[0])+' '+pick(NAMES.US[1]);go('new');}
  else if(act==='sign'){if(!save)save=newSave();if(active().length>=MAXG)return;save.golfers.push(newGolfer(Object.assign({},ui.prospect,{college:ui.college}),(ui.name.trim()||'Tucker Hale').slice(0,22),ui.country,ui.color));save.cur=save.golfers.length-1;arriveAll([place(save.golfers[save.cur])]);ui.msg='';ui.tab='range';ui.odds={};persist();go('hub');}
  else if(act==='buyGolfer'){const m=save.market[+v];if(!m||save.cash<m.ask||active().length>=MAXG)return;save.cash-=m.ask;save.golfers.push(newGolfer(Object.assign({yr:m.yr,tour:m.tour,co:rawCo('m'+m.name)},m.p),m.name,m.country,Math.floor(R()*6)));save.market.splice(+v,1);arriveAll([place(save.golfers[save.golfers.length-1])]);ui.odds={};persist();render();}
  else if(act==='list'){const g=byId(v),box=$('#ask-'+v),a=Math.round(+box.value);if(!g||!canSell(g)||!(a>=500))return;g.ask=a;persist();render();}
  else if(act==='unlist'){const g=byId(v);if(g){g.ask=null;persist();render();}}
  else if(act==='quickSell'){const g=byId(v);if(!g||!canSell(g)||active().length<2)return;if(ui.confirm!=='qs'+v){ui.confirm='qs'+v;b.textContent='Tap again to confirm';return;}const c=pick(RIVALS),p=Math.round(valueOf(g.sk,g.yr)*.8);sell(g,p,c);save.news=[`${g.name} is sold to ${c} for ${fmt$(p)}.`];ui.confirm=null;persist();render();}
  else if(act==='manage'){save.cur=+v;ui.tab='range';ui.msg='';ui.fullStand=false;go('hub');}
  else if(act==='enter'){const g=save.golfers[+v];g.enter=!g.enter;ui.odds={};persist();render();}
  else if(act==='enterSet'){G().enter=v==='1';ui.odds={};persist();render();}
  else if(act==='slot'){G().slot=+v;persist();render();}
  else if(act==='tab'){ui.tab=v;render();}
  else if(act==='train')train(v);
  else if(act==='playWeek')busyThen(b,()=>playWeek(v));
  else if(act==='simTour')busyThen(b,()=>playWeek('',v));
  else if(act==='follow')follow(v);
  else if(act==='nextRound')nextRound();
  else if(act==='simRest')busyThen(b,simRest);
  else if(act==='afterResults')advanceWeek();
  else if(act==='pickRes'){ui.res.sel=v;ui.res.rd=null;render();const el=$('#resDetail');if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest'});}
  else if(act==='pickRd'){ui.res.rd=+v;render();}
  else if(act==='buyEq'){const g=G(),c=EQC[g.eq[v]];if(c===undefined||save.cash<c)return;save.cash-=c;g.eq[v]++;ui.odds={};persist();render();}
  else if(act==='bookCoach'){const sel=$('#book-'+v),g=sel&&byId(sel.value);if(g&&coachObj(v)){g.coachId=v;ui.msg='';persist();render();}}
  else if(act==='setPrice'){const g=byId(v),a=Math.round(+($('#cprice-'+v)||{}).value);if(g&&g.cr&&a>=250){g.cr.price=a;persist();render();}}
  else if(act==='retireCoach'){const g=byId(v);if(!g||g.retired||g.yr<COACH_AGE_YR)return;if(ui.confirm!=='rt'+v){ui.confirm='rt'+v;b.textContent='Tap again to retire him';return;}
    retireToCoach(g);save.golfers.forEach(x=>{if(x.coachId===g.id&&x===g)x.coachId=null;});save.news=[`${g.name} has retired from playing at ${g.retAge} and opened a coaching practice.`];ui.confirm=null;ui.odds={};persist();go('coaches');}
  else if(act==='shirt'){G().color=+v;persist();render();}
  else if(act==='cos'){const c=save.cos;if(v==='colors'&&!c.colors&&save.cash>=5000){save.cash-=5000;c.colors=true;}else if(v==='ring'&&!c.ring&&save.cash>=25000){save.cash-=25000;c.ring=true;}else if(v==='trophy'&&c.trophy<2&&save.cash>=TROPHY[c.trophy+1].c){save.cash-=TROPHY[c.trophy+1].c;c.trophy++;}persist();render();}
  else if(act==='fullStand'){ui.fullStand=!ui.fullStand;render();}
  else if(act==='fullBoard'){ui.fullBoard=!ui.fullBoard;if(ui.view==='round')paintSide();else render();}
  else if(act==='pause'){ev.paused=!ev.paused;paintSide();}
  else if(act==='speed'){ev.speed=+v;document.querySelectorAll('.spd').forEach(x=>x.classList.toggle('on',x.dataset.v===v));}
  else if(act==='skip'){if(ev.phase!=='post'){ev.si=ev.shots.length-1;ev.t=1;ev.trail=ev.shots.slice();endHole();}else ev.w=1e9;}
  else if(act==='skipRound')busyThen(b,skipRound);
  else if(act==='copyCode'){const code=toCode();ui.codeOpen=true;ui.codeMsg='Save code shown below. Keep it somewhere safe.';render();const box=$('#codeBox');box.value=code;box.select();
    if(navigator.clipboard)navigator.clipboard.writeText(code).then(()=>{ui.codeMsg='Save code copied. Paste it somewhere safe.';}).catch(()=>{});}
  else if(act==='openCode'){ui.codeOpen=!ui.codeOpen;ui.codeMsg='';render();}
  else if(act==='loadCode'){const s=fromCode($('#codeBox').value);if(!s){ui.codeMsg="That code didn't load. Check that you pasted all of it.";render();}else{save=s;ui.codeOpen=false;ui.codeMsg='Save loaded.';ui.odds={};persist();go('stable');}}
  else if(act==='reset'){ui.confirm='reset';render();}
  else if(act==='resetNo'){ui.confirm=null;render();}
  else if(act==='resetYes'){save=null;try{localStorage.removeItem(KEY)}catch(x){}if(acct.user)SB.from('saves').delete().eq('user_id',acct.user.id).then(()=>{},()=>{});ui.prospect=rollProspect();ui.rerolls=3;go('new');}
});
window.addEventListener('resize',()=>{if(ui.view==='round')fitCanvas();});
render();
