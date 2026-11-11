// GENERATED from js/core.js by tools/sync-engine.sh. Edit js/core.js, then re-run the script.
/* ===== CORE: skills, golfers, courses, shot simulation, tournaments, tours. No DOM in here. ===== */
const R=Math.random;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function gaussR(r){let u=0;while(!u)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283185*r())}
const gauss=()=>gaussR(R);
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const pick=a=>a[Math.floor(R()*a.length)];
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const sum=a=>a.reduce((x,y)=>x+y,0);

const HOLES=18,ROUNDS=4,FIELD=120,CUT=60,ZONE=Math.round(FIELD*.2);
/* FedEx Cup regular-event points: 500 to the winner. Ties split the points for the places they cover. */
const PTS=[500,300,190,135,110,100,90,85,80,75,70,65,60,57,55,53,51,49,47,45,43,41,39,37,35.5,34,32.5,31,29.5,28,26.5,25,23.5,22,21,20,19,18,17,16];
while(PTS.length<100)PTS.push(Math.max(3,PTS[PTS.length-1]-.5));
/* Prize money: the standard top-heavy tour split, 18% to the winner. */
const PAYF=(()=>{const a=[18,10.9,6.9,4.9,4.1,3.625,3.375,3.125,2.925,2.725];let v=2.5;while(a.length<CUT){a.push(v);v*=.955;}const s=sum(a);return a.map(x=>x/s);})();
const SLOTS=[{k:'Morning',t:'7:40 AM',w:.7,note:'Calmest wind'},{k:'Midday',t:'11:10 AM',w:1,note:'Typical wind'},{k:'Afternoon',t:'2:30 PM',w:1.35,note:'Windiest'}];

/* ---- skills: four umbrellas, sixteen sub-skills ---- */
const UMB={s:'Short game',m:'Irons',l:'Long game',x:'Miscellaneous'};
const UMBD={s:'Inside wedge range and on the green',m:'Approach shots',l:'Driver and woods',x:'Head, heart and feel'};
const SUB={s:['wedge','pitch','chip','bunker','sputt','lputt'],m:['iacc','idist','iwind'],l:['pow','lacc'],x:['mental','momentum','wind','attitude','clutch','iq']};
const SUBW={wedge:.15,pitch:.15,chip:.15,bunker:.1,sputt:.25,lputt:.2,iacc:.4,idist:.4,iwind:.2,pow:.5,lacc:.5,mental:1/6,momentum:1/6,wind:1/6,attitude:1/6,clutch:1/6,iq:1/6};
const SUBN={wedge:'Full wedges',pitch:'Pitches',chip:'Chips',bunker:'Bunker shots',sputt:'Short putts',lputt:'Lag putts',iacc:'Accuracy',idist:'Distance control',iwind:'Wind performance',pow:'Power',lacc:'Accuracy',mental:'Mental game',momentum:'Momentum',wind:'Wind performance',attitude:'Attitude',clutch:'Clutchness',iq:'Intelligence'};
const SUBD={wedge:'Full swings inside about 125 yards',pitch:'20 to 45 yards from the pin',chip:'Around the green',bunker:'Greenside sand',sputt:'Holing out inside ten feet',lputt:'Getting long putts close',iacc:'Starting irons on line',idist:'Pin-high or not',iwind:'Irons when it blows',pow:'Distance off the tee',lacc:'Fairways hit',mental:'How little a bad hole rattles him',momentum:'How far a good run carries him',wind:'Driver, wedges and touch in wind',attitude:'Bounce-back and work on the range',clutch:'Late on Sunday, and on the cut line',iq:'When to attack a pin and when to play safe'};
const KEYS=[].concat(SUB.s,SUB.m,SUB.l,SUB.x);
const um=(sk,u)=>SUB[u].reduce((a,k)=>a+sk[k]*SUBW[k],0);
const ovr=sk=>um(sk,'s')*.35+um(sk,'m')*.3+um(sk,'l')*.25+um(sk,'x')*.1;

/* ---- tours ---- */
const TOURS={
 col:{name:'College Circuit',mu:61,purse:60000,fee:0},
 p3:{name:'Mini Tour',mu:66,purse:150000,fee:1200},
 p2:{name:'Challenger Tour',mu:71,purse:700000,fee:2500},
 p1:{name:'Premier Tour',mu:76,purse:4000000,fee:0},
 c2:{name:'Senior Qualifying Tour',mu:65,purse:300000,fee:1500},
 c1:{name:'Champions Tour',mu:70,purse:1500000,fee:0}};
['Atlantic','Southern','Western'].forEach((n,i)=>TOURS['col'+i]=Object.assign({},TOURS.col,{name:n+' College Circuit'}));
const isCol=t=>!!t&&t.slice(0,3)==='col',TORDER=['col0','col1','col2','p3','p2','p1','c2','c1'];
const UP={p3:'p2',p2:'p1',c2:'c1'},DOWN={p1:'p2',p2:'p3',c1:'c2'};
const CLASS=['Freshman','Sophomore','Junior','Senior'];
const WEEKS=8,FIT=['m','l','s'];
const EVN=[['Cypress Slough Classic','Blackwater Championship','Slough Summer Open'],['Longleaf Open','Ridge Runner Classic','Longleaf Championship'],['Kettle Hollow Invitational','Sandpit Shootout','The Hollow Cup']];
const CALS={};
/* Each tour's season: eight events with different purses, entry fees, points and courses. Fixed per tour and season. */
function calendar(tour,season){
  const key=tour+'-'+season;if(CALS[key])return CALS[key];
  const r=mulberry32(hash('cal-'+key)),T=TOURS[tour],m=[1,.6,1,1.6,.6,1,1],used=[0,0,0],off=Math.floor(r()*3);
  for(let i=m.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[m[i],m[j]]=[m[j],m[i]];}m.push(2.2);
  return CALS[key]=m.map((mult,i)=>{const ci=(i+off+(r()<.3?1:0))%3,last=i===WEEKS-1;
    return{name:last?T.name+' Finale':EVN[ci][used[ci]++%3],ci,type:last?'Finale':mult>=1.6?'Signature':mult<1?'Small':'Standard',purse:Math.round(T.purse*mult/1000)*1000,fee:Math.round(T.fee*Math.pow(mult,1.3)/50)*50,pm:last?1.5:mult>=1.6?1.25:mult<1?.6:1};});
}
const NAMES={
US:['Cole Tucker Brady Wyatt Mason Reid Grant Hank Beau Chase Dalton Trey','Hale Mercer Dawkins Pruitt Calloway Sutter Boone Whitfield Tanner Briggs Thibodeaux Kessler'],
CA:['Liam Gus Owen Nolan Brett Carter','Halloran Tremblay MacKay Fortin Dumont Leduc'],
MX:['Diego Emilio Raul Javier Hector Ramon','Fonseca Ibarra Salazar Cordero Montoya Beltran'],
ENG:['Oliver Monty Alfie George Harry Miles','Pemberton Graves Ashdown Whitlock Fenwick Holloway'],
SCO:['Callum Wes Ewan Fraser Angus Blair','Abernathy Drummond Kinloch Sinclair Buchanan Lennox'],
IE:['Declan Finn Cormac Padraig Shane Niall','Rourke Gallagher Brennan Tierney Mulcahy Devlin'],
FR:['Fabien Luc Mathieu Remy Julien Bastien','Leclair Moreau Garnier Delmas Rousseau Chabert'],
ES:['Pablo Alvaro Ignacio Sergio Marcos Adrian','Ibanez Medina Carrasco Zubiri Olmedo Requena'],
IT:['Bing Marco Luca Matteo Enzo Dario','Castellano Bellini Ferraro Rinaldi Vitale Marchetti'],
DE:['Hugo Lukas Jonas Felix Moritz Tobias','Brandt Keller Vogel Reinhardt Lindner Hartmann'],
SE:['Viktor Emil Axel Oskar Nils Anton','Lindqvist Lindahl Sandberg Nystrom Ekstrom Hedlund'],
NO:['Lars Magnus Henrik Sindre Eirik Tor','Halvorsen Bakken Solberg Dahl Lunde Myhre'],
DK:['Mads Rasmus Soren Jeppe Mikkel Anders','Hvid Thorup Norgaard Lauritsen Skov Bruun'],
NL:['Pieter Daan Sem Joost Ruben Bram','Vos Dekker Brouwer Hendriks Postma Kuiper'],
ZA:['Thabo Odell Ruan Dewald Sipho Jaco','Nkosi Voss Botha Dlamini Venter Mokoena'],
AU:['Jack Dax Lachlan Cooper Mitch Jarrah','Tanner Renner Hollis Maddock Carew Whelan'],
NZ:['Tane Kieran Josh Wiremu Ben Hamish','Parata Ngata Tuhoe Rangi Fairlie Mackie'],
JP:['Kenji Yuto Haruki Daichi Ren Sota','Morimoto Arai Kuroda Hayashi Nomura Ogawa'],
KR:['Seo-jun Jae-won Min-ho Tae-yang Ji-hoon Dong-hyun','Bae Shin Kwon Yoon Jang Seo'],
CN:['Wei Hao Jun Lei Bo Cheng','Zhang Liu Xu Gao Tang Luo'],
TH:['Somchai Kiet Anan Preecha Narong Chai','Prasert Wongsa Charoen Suwan Thongdee Rattana'],
IN:['Arjun Rohan Kabir Vikram Aditya Nikhil','Mehta Bhatia Sandhu Rao Chopra Gill'],
CO:['Mateo Camilo Santiago Andres Felipe Julian','Quintero Restrepo Cardona Ospina Zapata Arango'],
AR:['Nico Tomas Franco Lautaro Joaquin Bruno','Santoro Paredes Ledesma Quiroga Sosa Villalba']};
for(const c in NAMES)NAMES[c]=NAMES[c].map(s=>s.split(' '));
const CN=Object.keys(NAMES);
function makeSkills(r,mu){const sk={};for(const u of'smlx'){const base=mu+gaussR(r)*(u==='x'?6:4);for(const k of SUB[u])sk[k]=Math.round(clamp(base+gaussR(r)*4,20,97));}return sk;}
/* three college circuits; a golfer's college decides which one he plays on */
const CONFS=[['Duke','North Carolina','NC State','Wake Forest','Clemson','Virginia','Georgia Tech','Notre Dame','Ohio State','Michigan','Illinois','Purdue','Northwestern','Kentucky','South Carolina','Vanderbilt'],
 ['Florida','Florida State','Georgia','Alabama','Auburn','Tennessee','LSU','Ole Miss','Arkansas','UCF','South Florida','Miami','Florida Tech','North Florida','Texas A&M','Baylor'],
 ['Oklahoma State','Texas','Stanford','Arizona State','Texas Tech','Oklahoma','Pepperdine','UCLA','USC','Oregon','Arizona','BYU','TCU','SMU','Washington','California']];
const COLLEGES=[].concat(...CONFS),confOf=c=>Math.max(0,CONFS.findIndex(x=>x.includes(c)));
const POOLS={};
/* The other 119 golfers on a tour. Built from a fixed seed, so the same rivals come back every time. College rosters turn over each year. */
function pool(tour,season){
  const col=isCol(tour),key=col?tour+season:tour;if(POOLS[key])return POOLS[key];
  const r=mulberry32(hash('range-rat-'+key)),used={},out=[];
  for(let i=0;i<FIELD-1;i++){
    const c=r()<.34?'US':CN[Math.floor(r()*CN.length)],N=NAMES[c];let name='';
    for(let t=0;t<30;t++){name=N[0][Math.floor(r()*N[0].length)]+' '+N[1][Math.floor(r()*N[1].length)];if(!used[name])break;}
    if(used[name])name+=' II';used[name]=1;
    const yr=col?1+Math.floor(r()*4):0,mu=col?56+(yr-1)*3.5:TOURS[tour].mu;
    out.push({id:i,name,country:c,yr,college:col?(CONFS[+tour[3]]||COLLEGES)[hash(name+i)%16]:null,sk:makeSkills(r,mu),peak:Math.floor(r()*3),agg:clamp(gaussR(r)*.6,-1,1),fatigue:0});
  }
  return POOLS[key]=out;
}

/* ---- courses ---- */
function buildHole(rng,sp,c){
  const par=sp.par,len=sp.len,dog=sp.dog||0,rad=d=>d*Math.PI/180,pts=[[0,0]];
  if(par===3){const a=rad(dog*10);pts.push([Math.sin(a)*len,Math.cos(a)*len]);}
  else if(par===4){const l1=len*.58,l2=len-l1,a=rad(dog*38);pts.push([0,l1]);pts.push([Math.sin(a)*l2,l1+Math.cos(a)*l2]);}
  else{const l1=len*.46,l2=len*.3,l3=len-l1-l2,a1=rad(dog*24),a2=a1+rad((sp.dog2===undefined?dog:sp.dog2)*22);pts.push([0,l1]);const p2=[Math.sin(a1)*l2,l1+Math.cos(a1)*l2];pts.push(p2);pts.push([p2[0]+Math.sin(a2)*l3,p2[1]+Math.cos(a2)*l3]);}
  const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+dist(pts[i-1],pts[i]));
  const h={par,len,pts,cum,gr:c.gr,fw:par===3?9:c.fw,tree:c.tree,sand:[],water:[],trees:[]};
  h.green=pts[pts.length-1];
  const pa=rng()*6.283,prad=(.2+rng()*.4)*h.gr;h.pin=[h.green[0]+Math.cos(pa)*prad,h.green[1]+Math.sin(pa)*prad];
  h.fs0=par===3?len-48:Math.min(170,len*.42);h.fs1=len-h.gr-9;
  const off=(s,o)=>{const q=pointAt(h,s);return{p:[q.p[0]+q.d[1]*o,q.p[1]-q.d[0]*o],d:q.d}};
  const addW=(s,o,rx,ry)=>{const q=off(s,o);h.water.push({x:q.p[0],y:q.p[1],rx,ry,d:q.d,rot:Math.atan2(q.d[0],q.d[1])})};
  for(const w of [].concat(sp.water||[])){
    if(w==='front')addW(len-h.gr-24,0,36,10);
    else if(w==='carry'){const a=32,b=len-h.gr-8;addW((a+b)/2,0,48,(b-a)/2);}
    else if(w==='left'||w==='right')addW(len-62,(w==='left'?-1:1)*Math.max(h.gr+22,h.fw+24),19,95);
    else if(w==='pond')addW(250,(rng()<.5?-1:1)*(h.fw+17),15,32);
  }
  const gs=sp.gs||0,a0=rng()*6.283;
  for(let i=0;i<gs;i++){const br=5+rng()*3,a=a0+i*6.283/gs+(rng()-.5)*.6,dd=h.gr+br+1;h.sand.push({x:h.green[0]+Math.cos(a)*dd,y:h.green[1]+Math.sin(a)*dd,r:br});}
  for(let i=0;i<(sp.fs||0);i++){const br=6+rng()*3;let s=(par===5&&i%2)?len-115-rng()*40:232+rng()*55;if(s>len-65)s=len-70-rng()*15;const q=off(s,(rng()<.5?-1:1)*(h.fw+br-2));h.sand.push({x:q.p[0],y:q.p[1],r:br});}
  h.sand=h.sand.filter(b=>!h.water.some(w=>inEll(w,[b.x,b.y])));
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const p of pts){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  const pad=h.tree+22;h.box=[x0-pad,y0-pad*.6,x1+pad,y1+pad];
  for(let i=0;i<260;i++){const p=[h.box[0]+rng()*(h.box[2]-h.box[0]),h.box[1]+rng()*(h.box[3]-h.box[1])];if(project(h,p).d>h.tree+4&&!h.water.some(w=>inEll(w,p)))h.trees.push([p[0],p[1],3+rng()*3]);}
  return h;
}
function pointAt(h,s){const P=h.pts,C=h.cum;let i=0;if(s>=C[C.length-1])i=P.length-2;else if(s>0)while(C[i+1]<s)i++;
  const a=P[i],b=P[i+1],L=C[i+1]-C[i],d=[(b[0]-a[0])/L,(b[1]-a[1])/L],t=s-C[i];return{p:[a[0]+d[0]*t,a[1]+d[1]*t],d};}
function project(h,p){let bd=1e9,bs=0;const P=h.pts,C=h.cum;for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],L=C[i+1]-C[i];
  const t=clamp(((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/(L*L),0,1),d=dist(p,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);if(d<bd){bd=d;bs=C[i]+t*L;}}return{d:bd,s:bs};}
function inEll(w,p){const rx=p[0]-w.x,ry=p[1]-w.y,al=rx*w.d[0]+ry*w.d[1],la=rx*w.d[1]-ry*w.d[0];return (la*la)/(w.rx*w.rx)+(al*al)/(w.ry*w.ry)<=1;}
function lieAt(h,p){
  for(const w of h.water)if(inEll(w,p))return'water';
  const dg=dist(p,h.green);if(dg<=h.gr)return'green';
  for(const b of h.sand)if(Math.hypot(p[0]-b.x,p[1]-b.y)<=b.r)return'sand';
  if(dg<=h.gr+3)return'fringe';
  const pr=project(h,p);
  if(pr.s<10&&pr.d<6)return'tee';
  if(pr.s>=h.fs0&&pr.s<=h.fs1&&pr.d<=h.fw)return'fairway';
  if(pr.d>h.tree&&dg>h.tree)return'trees';
  return'rough';
}
const COURSE_SPECS=[
 {name:'Cypress Slough',seed:4107,tree:40,fw:17,gr:12,blurb:'Water in play on every hole. Punishes the bold.',rewards:'Irons and nerve',
  holes:[{par:4,len:385,dog:.4,water:'right',fs:1,gs:1},{par:3,len:165,water:'carry',gs:1},{par:5,len:525,dog:-.6,water:'left',gs:2,fs:1},{par:4,len:410,water:'pond',fs:1,gs:2},{par:4,len:345,dog:.8,water:'front',gs:1},{par:3,len:190,water:'left',gs:2},{par:4,len:430,dog:-.5,water:'right',gs:1,fs:1},{par:5,len:545,dog:.5,dog2:-.8,water:'front',gs:2,fs:1},{par:4,len:400,dog:-.3,water:'left',gs:2,fs:1},
   {par:4,len:420,dog:.3,water:'left',fs:1,gs:2},{par:5,len:560,dog:-.5,dog2:.6,water:'right',gs:2,fs:1},{par:3,len:150,water:'carry',gs:2},{par:4,len:365,dog:-.7,water:'front',gs:1,fs:1},{par:4,len:445,dog:.2,water:'pond',fs:1,gs:1},{par:3,len:205,water:'right',gs:1},{par:4,len:395,dog:.6,water:'right',gs:2,fs:1},{par:5,len:515,dog:-.4,water:'front',gs:2,fs:1},{par:4,len:455,dog:-.5,water:'left',gs:2,fs:1}]},
 {name:'Longleaf Ridge',seed:9231,tree:50,fw:21,gr:14,blurb:'Long and wide open. Room to swing, and a long way home.',rewards:'Long game',
  holes:[{par:4,len:445,dog:.2,fs:1,gs:1},{par:5,len:585,dog:-.4,fs:2,gs:1},{par:3,len:215,gs:1},{par:4,len:470,dog:.5,fs:1,gs:1},{par:4,len:425,dog:-.3,fs:1,gs:2},{par:5,len:610,dog:.4,dog2:.4,fs:2,gs:2},{par:3,len:235,gs:2},{par:4,len:460,fs:2,gs:1},{par:4,len:480,dog:-.6,fs:1,gs:1,water:'pond'},
   {par:4,len:455,dog:-.3,fs:1,gs:1},{par:3,len:225,gs:2},{par:5,len:595,dog:.5,fs:2,gs:1},{par:4,len:485,dog:.3,fs:1,gs:2},{par:4,len:430,dog:-.5,fs:2,gs:1},{par:5,len:620,dog:-.4,dog2:-.3,fs:2,gs:2},{par:3,len:245,gs:1},{par:4,len:475,fs:1,gs:2},{par:4,len:495,dog:.6,fs:2,gs:2,water:'pond'}]},
 {name:'Kettle Hollow',seed:5512,tree:25,fw:12,gr:8,blurb:'Short, tight and ringed with sand. Tiny greens.',rewards:'Short game',
  holes:[{par:4,len:335,dog:.7,gs:3,fs:1},{par:4,len:360,dog:-.5,gs:3,fs:1},{par:3,len:135,gs:4},{par:4,len:455,dog:.6,gs:3,fs:2},{par:4,len:310,dog:-.9,gs:3,fs:1},{par:3,len:155,gs:3},{par:4,len:375,dog:.4,gs:4,fs:1},{par:5,len:495,dog:-.7,gs:3,fs:2},{par:4,len:350,dog:.6,gs:4,fs:1,water:'front'},
   {par:4,len:345,dog:-.6,gs:3,fs:1},{par:3,len:145,gs:4},{par:4,len:385,dog:.5,gs:3,fs:2},{par:5,len:505,dog:.7,dog2:.5,gs:3,fs:2},{par:4,len:320,dog:.9,gs:4,fs:1},{par:3,len:170,gs:3,water:'front'},{par:4,len:365,dog:-.4,gs:3,fs:1},{par:4,len:440,dog:-.6,gs:4,fs:1},{par:4,len:395,dog:.3,gs:4,fs:1,water:'front'}]}
];
const COURSES=COURSE_SPECS.map(c=>{const rng=mulberry32(c.seed);const holes=c.holes.map(sp=>buildHole(rng,sp,c));return{name:c.name,blurb:c.blurb,rewards:c.rewards,holes,par:sum(holes.map(h=>h.par)),yards:sum(holes.map(h=>h.len))}});

/* ---- shots ---- */
const LIE={tee:{c:1,a:1},fairway:{c:.9,a:1},fringe:{c:.9,a:1},green:{c:.9,a:1},rough:{c:.84,a:1.3},sand:{c:.72,a:1.5},trees:{c:.5,a:1.7}};
const NOEQ={s:0,m:0,l:0},c5=v=>clamp(v,5,99);
const driveDist=g=>205+g.sk.pow*.95;
/* Everything that moves a golfer off his ratings for one hole: form, mood, streaks, time of day, legs, pressure, confidence, equipment. */
function effective(g,st,ctx){
  const sk=g.sk,eq=g.eq||NOEQ;
  const adj=st.form+st.mood*10+(st.run>=2?2+sk.momentum*.06:st.run<=-2?-(8-sk.mental*.06):0)+st.timeAdj-(g.fatigue||0)*.07+(ctx.pressure?(sk.clutch-50)/50*6:0)+(g.conf||0);
  return{s:adj+eq.s*1.5,m:adj+eq.m*1.5,l:adj+eq.l*1.5,mood:st.mood};
}
function swing(g,e,from,target,lie,wind,mc){
  const sk=g.sk,D=driveDist(g),L=Math.max(1,dist(from,target)),lf=LIE[lie].a;
  let type,aS,dS,wS;
  if(L>.78*D){type='l';aS=dS=c5(sk.lacc+e.l);wS=sk.wind;}
  else if(L<.5*D){type='w';aS=dS=c5(sk.wedge+e.s);wS=sk.wind;}
  else{type='m';aS=c5(sk.iacc+e.m);dS=c5(sk.idist+e.m);wS=sk.iwind;}
  const wk=1.6-wS*.012,wf=1+wind.mph/50*wk;
  const aSd=(type==='l'?7.6-.056*aS:6.4-.048*aS)*lf*wf,dSd=(type==='l'?.07-.0004*dS:.075-.0005*dS)*lf;
  let ang=gauss()*aSd,df=1+gauss()*dSd,mis=null;
  if(!mc){const pm=clamp((.065-.0005*aS)*lf+(e.mood<0?-e.mood*.04:0),.005,.25);
    if(R()<pm){if(R()<.5){df*=.5+R()*.3;mis='chunk';}else{ang=(R()<.5?-1:1)*(aSd*2.2+4+R()*5);mis='wild';}}}
  const ux=(target[0]-from[0])/L,uy=(target[1]-from[1])/L,wx=Math.sin(wind.dir)*wind.mph,wy=Math.cos(wind.dir)*wind.mph;
  const tail=wx*ux+wy*uy,cross=wx*uy-wy*ux;let lat=0;
  if(L>60){df*=1+tail*.0014*wk;lat=cross*.0016*L*wk;}
  const a=ang*Math.PI/180,c=Math.cos(a),s=Math.sin(a),vx=ux*c+uy*s,vy=uy*c-ux*s,LL=L*df;
  return{p:[from[0]+vx*LL+uy*lat,from[1]+vy*LL-ux*lat],type,mis,L};
}
function puttExp(ft){return ft<3?1.04:2-1/(1+Math.pow(ft/7,2.2))+ft*.002}
function cost(h,p,risk){
  const lie=lieAt(h,p),d=dist(p,h.pin);
  if(lie==='green')return puttExp(d*3);
  const base=d<30?2.2+d*.009:2.35+d*.0042;
  if(lie==='rough')return base+.2;
  if(lie==='sand')return base+(d<40?.35:.5)*Math.sqrt(risk);
  if(lie==='trees')return base+.8*risk;
  if(lie==='water')return base+1.3*risk;
  return base;
}

/* He picks his own target. Intelligence sets how well he reads the options and whether he adapts to the leaderboard;
   a golfer who doesn't think just follows his natural lean toward attacking or playing safe. */
function chooseTarget(g,e,h,pos,lie,wind,st,ctx){
  const iq=g.sk.iq,mc=driveDist(g)*LIE[lie].c,d=dist(pos,h.pin);
  let risk=Math.exp(-(g.agg||0)*.6*(1-iq/100));
  if(st.mood<-.4&&g.sk.mental<45)risk*=.6;
  if(ctx.sit==='chase')risk*=1-.4*iq/100;else if(ctx.sit==='protect')risk*=1+.6*iq/100;
  const n=Math.round(4+iq*.1),noise=(1-iq/100)*.3,c=[];
  if(d<=mc*1.03){c.push(h.pin,lerp(h.pin,h.green,.5),h.green);}
  const pr=project(h,pos);
  for(const f of[1,.9,.8,.68,.55]){const s=pr.s+mc*f;if(s<h.len-h.gr-25)c.push(pointAt(h,s).p);}
  if(d>mc){c.push(lerp(pos,h.pin,mc/d),lerp(pos,h.pin,mc*.85/d));}
  if(!c.length)c.push(h.green);
  let best=c[0],bc=1e9;
  for(let t of c){const L=dist(pos,t);if(L>mc)t=lerp(pos,t,mc/L);let s=0;for(let i=0;i<n;i++)s+=cost(h,swing(g,e,pos,t,lie,wind,1).p,risk);s=s/n+gauss()*noise;if(s<bc){bc=s;best=t;}}
  return best;
}
function chip(g,e,from,h,lie){
  const d=dist(from,h.pin),sk=c5((lie==='sand'?g.sk.bunker:d>20?g.sk.pitch:g.sk.chip)+e.s),lf={sand:1.7,rough:1.3,trees:1.6}[lie]||1;
  if(R()<(.045-.0004*sk)*lf+(e.mood<0?-e.mood*.03:0))return{p:lerp(from,h.pin,.35+R()*.25),mis:'chunk'};
  if(R()<(.004+sk*.00025)*(d<25?1:.5)/lf)return{holed:true};
  const r=Math.abs(gauss())*d*(.2-.0014*sk)*lf+.25,a=R()*6.283;
  return{p:[h.pin[0]+Math.cos(a)*r,h.pin[1]+Math.sin(a)*r]};
}
function putt(g,e,ft){
  const sp=c5(g.sk.sputt+e.s),lp=c5(g.sk.lputt+e.s),w=clamp((ft-8)/12,0,1),sk=sp*(1-w)+lp*w;
  const d50=3.2+sk*.05,p=ft<=1.6?.995:1/(1+Math.pow(ft/d50,2.2));
  if(R()<p)return 0;
  return Math.max(1,Math.min(Math.abs(gauss())*ft*(.13-.0008*lp)+1,ft*.8+1));
}
function clubName(g,L,lie){
  const f=L/driveDist(g);if(lie==='tee'&&f>.93)return'Driver';if(f>.86)return'3-wood';if(f>.78)return'Hybrid';
  for(const[t,n]of[[.74,'4-iron'],[.7,'5-iron'],[.66,'6-iron'],[.61,'7-iron'],[.56,'8-iron'],[.51,'9-iron'],[.45,'Pitching wedge'],[.38,'Gap wedge']])if(f>t)return n;
  return'Wedge';
}
function fullText(g,h,from,lieFrom,to,lieTo,mis,L){
  const club=clubName(g,L,lieFrom),d0=Math.round(dist(from,h.pin)),carry=Math.round(dist(from,to));
  const pre=lieFrom==='tee'&&h.par>3?`${club} off the tee, ${carry} yards.`:lieFrom==='trees'?`Punches out from the trees.`:`${club} from ${d0} yards.`;
  let post;const ft=Math.round(dist(to,h.pin)*3);
  switch(lieTo){
    case'green':post=ft<=6?`Stuffs it to ${ft} feet.`:ft<=22?`On the green, ${ft} feet away.`:`Finds the green, ${ft} feet out.`;break;
    case'fairway':post=mis==='chunk'?'Catches it heavy but stays in the fairway.':pick(['Finds the fairway.','Splits the fairway.','In the short grass.']);break;
    case'fringe':post='Just on the fringe.';break;
    case'rough':post=mis==='chunk'?'Catches it heavy. Short, in the rough.':pick(['Drifts into the rough.','Settles in the rough.']);break;
    case'sand':post=dist(to,h.green)<h.gr+18?'Finds the greenside bunker.':'Catches the fairway bunker.';break;
    case'trees':post=mis==='wild'?'Sprays it deep into the trees.':'Runs into the trees.';break;
    case'water':post='Splash. That one is wet.';break;
    default:post='Safely in play.';
  }
  return pre+' '+post;
}

function playHole(g,st,h,ctx){
  const e=effective(g,st,ctx),w=ctx.wind,shots=[];let pos=[0,0],lie='tee',n=0,putts=0,wet=0,holeOut=false;
  for(let guard=0;guard<40;guard++){
    if(n>=10){shots.push({k:'pick',from:pos,to:pos,text:'Picks up. Mark it a 10.'});break;}
    const d=dist(pos,h.pin);
    if(lie==='green'){
      const ft=Math.max(1,d*3),left=putt(g,e,ft);n++;putts++;
      if(!left){shots.push({k:'putt',from:pos,to:h.pin,holed:true,text:ft<=2.5?'Taps in.':`Holes it from ${Math.round(ft)} feet.`});if(ft>=20)holeOut=true;break;}
      const a=R()*6.283,np=[h.pin[0]+Math.cos(a)*left/3,h.pin[1]+Math.sin(a)*left/3];
      shots.push({k:'putt',from:pos,to:np,text:`Putt from ${Math.round(ft)} feet stays out. ${Math.round(left)<=1?'A foot':Math.round(left)+' feet'} left.`});pos=np;continue;
    }
    let land,text,kind;
    if(d<=45&&lie!=='tee'){
      const c=chip(g,e,pos,h,lie);n++;kind='chip';
      if(c.holed){shots.push({k:'chip',from:pos,to:h.pin,holed:true,text:lie==='sand'?'Holes the bunker shot!':'Chips in!'});holeOut=true;break;}
      land=c.p;const nl=lieAt(h,land),ft=Math.round(dist(land,h.pin)*3);
      text=c.mis?'Chunks it. Still short.':nl==='green'?(lie==='sand'?`Splashes out to ${ft} feet.`:d>20?`Pitches to ${ft} feet.`:`Chips to ${ft} feet.`):nl==='water'?'Skulls it into the water.':`Chip runs through into the ${nl==='sand'?'bunker':nl}.`;
    }else{
      const t=chooseTarget(g,e,h,pos,lie,w,st,ctx),sw=swing(g,e,pos,t,lie,w);n++;kind='full';land=sw.p;
      if(dist(land,h.pin)<.35){shots.push({k:'full',from:pos,to:h.pin,holed:true,text:`${clubName(g,sw.L,lie)} from ${Math.round(d)} yards. It's in the hole!`});holeOut=true;break;}
      text=fullText(g,h,pos,lie,land,lieAt(h,land),sw.mis,sw.L);
    }
    let nl=lieAt(h,land);
    if(nl==='water'){
      shots.push({k:kind,from:pos,to:land,text});n++;wet++;
      let drop=pos;for(let t=1;t>=0;t-=.02){const q=lerp(pos,land,t);if(lieAt(h,q)!=='water'){drop=lerp(pos,land,Math.max(0,t-.02));if(lieAt(h,drop)==='water')drop=q;break;}}
      nl=lieAt(h,drop);shots.push({k:'drop',from:land,to:drop,text:'Takes a penalty drop.'});pos=drop;lie=nl==='water'?'rough':nl;continue;
    }
    shots.push({k:kind,from:pos,to:land,text});pos=land;lie=nl;
  }
  return{score:n,shots,putts,wet,holeOut};
}
const timeAdj=(peak,slot)=>[4,-.5,-4.5][Math.abs(peak-slot)];
const formSd=g=>6-g.sk.mental*.035;
function initState(g,slot,carry,weekForm){return{mood:clamp((carry||0)+gauss()*.12,-.6,.6),run:0,form:(weekForm||0)+gauss()*formSd(g)*.8,timeAdj:timeAdj(g.peak,slot),scores:[],total:0,toPar:0};}
function afterHole(g,st,h,res){
  const sk=g.sk,d=res.score-h.par,up=.4+sk.momentum*.012,down=1.7-sk.mental*.014,rec=.05+sk.attitude*.004;
  let dm=d<=-2?.5:d===-1?.3:d===0?.04:d===1?-.25:d===2?-.45:-.6;
  dm*=dm>0?up:down;dm-=.1*res.wet*down;if(res.holeOut)dm+=.15*up;
  st.mood=clamp(st.mood*(1-rec)+dm,-1,1);
  if(d<0)st.run=Math.max(st.run,0)+1;else if(d>0)st.run=Math.min(st.run,0)-1;else st.run-=Math.sign(st.run)*.5;
  st.scores.push(res.score);st.total+=res.score;st.toPar+=d;
}
/* ---- tournament: four rounds, cut to the low 60 and ties after 36 holes ---- */
const windOf=(ev,p)=>({mph:ev.wind.mph*SLOTS[p.slot].w,dir:ev.wind.dir});
const evTot=(ev,p)=>p.evPar+(ev.live&&!p.cut?p.st.toPar:0);
function makeEvent(ci,entries){
  const ev={ci,course:COURSES[ci],round:0,hole:0,cutLine:null,players:entries.map(e=>({g:e.g,mine:!!e.mine,me:!!e.me}))};
  ev.players.forEach(p=>{p.weekForm=gauss()*formSd(p.g)*.9;p.evPar=0;p.rounds=[];p.cut=false;p.slot0=p.mine&&p.g.slot!==undefined?p.g.slot:Math.floor(R()*3);});
  beginRound(ev);return ev;
}
function beginRound(ev){
  ev.hole=0;ev.wind={mph:Math.round(3+R()*13),dir:R()*6.283};
  const act=ev.players.filter(p=>!p.cut);
  if(ev.round>=2){const s=act.slice().sort((a,b)=>b.evPar-a.evPar);s.forEach((p,i)=>p.slot=Math.min(2,Math.floor(i*3/s.length)));}
  else act.forEach(p=>p.slot=ev.round===0?p.slot0:2-p.slot0);
  act.forEach(p=>{p.st=initState(p.g,p.slot,p.st?p.st.mood*.3:(p.g.carry||0),p.weekForm);});
  ev.live=true;
}
function simHole(ev){
  const h=ev.course.holes[ev.hole],act=ev.players.filter(p=>!p.cut),tots=act.map(p=>evTot(ev,p)),lead=Math.min(...tots);
  let cl=null;if(ev.round===1){const s=tots.slice().sort((a,b)=>a-b);cl=s[Math.min(s.length,CUT)-1];}
  const out=new Map(),late=ev.round===3&&ev.hole>=9,second=late?tots.slice().sort((a,b)=>a-b)[1]:0;
  act.forEach((p,i)=>{const gap=tots[i]-lead,sit=!late?null:gap>=2&&gap<=6?'chase':gap===0&&second-lead>=2?'protect':null,pressure=(ev.round===3&&ev.hole>=9&&tots[i]-lead<=3)||(cl!==null&&ev.hole>=11&&Math.abs(tots[i]-cl)<=1);
    const res=playHole(p.g,p.st,h,{wind:windOf(ev,p),pressure,sit});afterHole(p.g,p.st,h,res);out.set(p,res);});
  return out;
}
function endRound(ev){
  const act=ev.players.filter(p=>!p.cut);
  act.forEach(p=>{p.evPar+=p.st.toPar;p.rounds.push(p.st.total);});ev.live=false;
  if(ev.round===1){const s=act.map(p=>p.evPar).sort((a,b)=>a-b);ev.cutLine=s[Math.min(s.length,CUT)-1];act.forEach(p=>{if(p.evPar>ev.cutLine)p.cut=true;});}
}
function playRound(ev){for(;ev.hole<HOLES;ev.hole++)simHole(ev);endRound(ev);}
function finishEvent(ev){
  const act=ev.players.filter(p=>!p.cut),min=Math.min(...act.map(p=>p.evPar)),tied=act.filter(p=>p.evPar===min);ev.playoff=null;
  if(tied.length>1){let t=tied.slice();const h=ev.course.holes[HOLES-1];
    for(let i=0;i<10&&t.length>1;i++){const sc=t.map(p=>playHole(p.g,p.st,h,{wind:windOf(ev,p),pressure:true}).score),m=Math.min(...sc);t=t.filter((p,j)=>sc[j]===m);}
    t[0].won=true;ev.playoff={winner:t[0],losers:tied.filter(p=>p!==t[0])};}
  else tied[0].won=true;
  const order=act.slice().sort((a,b)=>(b.won?1:0)-(a.won?1:0)||a.evPar-b.evPar),last=PAYF[PAYF.length-1];
  let i=0;while(i<order.length){let j=i;if(!order[i].won)while(j+1<order.length&&order[j+1].evPar===order[i].evPar)j++;
    const k=j-i+1;let s=0,f=0;for(let q=i;q<=j;q++){s+=PTS[q]||3;f+=PAYF[q]||last;}
    for(let q=i;q<=j;q++){order[q].posN=i+1;order[q].pos=(k>1?'T':'')+(i+1);order[q].pts=Math.round(s/k*10)/10;order[q].payf=f/k;}i=j+1;}
  ev.players.filter(p=>p.cut).forEach(p=>{p.pos='MC';p.posN=999;p.pts=0;p.payf=0;});
  ev.order=order;ev.done=true;return order;
}
/* ---- prospects: sub-skills and hidden ceilings ---- */
function rollProspect(mu){
  const arch=[['All-rounder',32,null],['Bomber',19,'l'],['Iron player',19,'m'],['Short-game artist',19,'s'],['Head case with talent',6,null],['Prodigy',5,null]];
  let r=R()*100,a=arch[0];for(const x of arch){if(r<x[1]){a=x;break;}r-=x[1];}
  const sk={},ce={},grade={},lvl=mu||0;
  for(const u of'smlx'){
    let base=53+R()*8,cu=a[0]==='Prodigy'?86+R()*9:a[0]==='Head case with talent'?(u==='x'?58+R()*10:84+R()*9):72+R()*14;
    if(a[2]===u){base+=7;cu=86+R()*9;}if(a[0]==='Prodigy')base+=3;if(a[0]==='Head case with talent'&&u==='x')base-=8;
    for(const k of SUB[u]){ce[k]=Math.round(clamp(cu+gauss()*5,45,99));sk[k]=Math.round(clamp(base+gauss()*4,25,90));
      if(lvl)sk[k]=Math.round(clamp(lvl+(a[2]===u?4:0)+gauss()*4,30,ce[k]));
      ce[k]=Math.max(ce[k],Math.min(99,sk[k]+(lvl?3:8)));}
    const cv=um(ce,u);let gi=cv>=86?0:cv>=79?1:2;if(R()<.25)gi=clamp(gi+(R()<.5?-1:1),0,2);grade[u]='ABC'[gi];
  }
  return{arch:a[0],sk,ce,grade,peak:Math.floor(R()*3),agg:clamp(gauss()*.6,-1,1)};
}
/* ---- odds: a quick projection of everyone's finish from ratings, score so far and holes left ---- */
function ratingFor(g,ci){const sk=g.sk,eq=g.eq||NOEQ;return ovr(sk)*.75+um(sk,FIT[ci])*.25+(g.conf||0)-(g.fatigue||0)*.07+(eq.s+eq.m+eq.l)*.5;}
const ODDS={k:.0165,v:.52,f:.055};
function winProbs(list,N){
  const n=list.length,mean=avg(list.map(x=>x.r)),mu=list.map(x=>x.cur-(x.r-mean)*ODDS.k*x.H),sd=list.map(x=>Math.sqrt(ODDS.v*x.H+Math.pow(ODDS.f*x.H,2))),w=new Array(n).fill(0);
  N=N||400;for(let s=0;s<N;s++){let b=1e9,bi=0;for(let i=0;i<n;i++){const t=mu[i]+gauss()*sd[i]+R()*.01;if(t<b){b=t;bi=i;}}w[bi]++;}
  return w.map(x=>(x+.15)/(N+.15*n));
}
const LADDER=[[1,10],[1,5],[1,4],[1,3],[2,5],[1,2],[4,6],[4,5],[1,1],[6,5],[5,4],[6,4],[7,4],[2,1],[9,4],[5,2],[3,1],[7,2],[4,1],[9,2],[5,1],[6,1],[7,1],[8,1],[10,1],[12,1],[14,1],[16,1],[20,1],[25,1],[33,1],[40,1],[50,1],[66,1],[80,1],[100,1],[150,1],[200,1],[250,1],[500,1]];
function oddsLabel(p){const o=(1-p)/Math.max(p,1e-6);let best=LADDER[0],bd=1e9;for(const l of LADDER){const d=Math.abs(Math.log(l[0]/l[1])-Math.log(Math.max(o,.01)));if(d<bd){bd=d;best=l;}}return best[0]===best[1]?'Evens':best[0]+'/'+best[1];}

export { R, mulberry32, gaussR, gauss, hash, clamp, avg, sum, pick, HOLES, PTS, PAYF, SLOTS, UMB, SUB, SUBW, SUBN, KEYS, um, ovr, TOURS, isCol, UP, DOWN, CLASS, WEEKS, calendar, NAMES, CN, CONFS, COLLEGES, confOf, pool, COURSES, makeEvent, beginRound, simHole, endRound, finishEvent, initState, playHole, afterHole, windOf, rollProspect, ratingFor, winProbs, oddsLabel, FIELD, CUT };
