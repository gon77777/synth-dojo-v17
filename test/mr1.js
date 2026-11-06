// MR-1 の検査: node test/mr1.js
// ①リミッター(ワークレット): 入力ゲイン・天井・リリースが効く/既定は従来どおり ②バスの配線(out→OUT TRIM→出口コンプ→MAKEUP→リミッター)
// ③既定値=従来の固定値(古い保存は同じ音) ④つまみの定義・LIM GR・測定目標 grLim
const fs=require('fs'),path=require('path'),vm=require('vm');
let err=0;const ok=(c,m)=>{if(!c){console.error('NG: '+m);err++}};
const db=v=>20*Math.log10(Math.max(v,1e-12));

/* ---- ①ワークレット単体 ---- */
const SR=48000,procs={};
global.sampleRate=SR;global.currentTime=0;global.currentFrame=0;
global.AudioWorkletProcessor=class{constructor(){this.port={postMessage(m){this.last=m},onmessage:null}}};
global.registerProcessor=(n,c)=>{procs[n]=c};
new Function(fs.readFileSync(path.join(__dirname,'..','fx-src','limiter.js'),'utf8'))();
function run(x,over){
 const C=procs['sd-limiter'],p=new C(),params={};
 C.parameterDescriptors.forEach(d=>{params[d.name]=[d.defaultValue]});Object.keys(over||{}).forEach(k=>{params[k]=[over[k]]});
 const y=new Float32Array(x.length),oL=new Float32Array(128),oR=new Float32Array(128);let gr=0;
 for(let s=0;s+128<=x.length;s+=128){p.process([[x.subarray(s,s+128),x.subarray(s,s+128)]],[[oL,oR]],params);y.set(oL,s);if(p.port.last){gr=Math.min(gr,p.port.last.gr);p.port.last=null}}
 return{y,gr};
}
const N=SR,sine=a=>Float32Array.from({length:N},(_,i)=>a*Math.sin(2*Math.PI*220*i/SR));
const peak=y=>{let m=0;for(let i=4800;i<y.length;i++)m=Math.max(m,Math.abs(y[i]));return m};
{
 const D=procs['sd-limiter'].parameterDescriptors.find(d=>d.name==='gain');
 ok(D&&D.defaultValue===0&&D.minValue===0&&D.maxValue===18,'limiter: gain は 0〜18 dB・既定 0');
 const x=sine(.5),a=run(x),b=run(x,{gain:0});
 let same=true;for(let i=0;i<N;i++)if(a.y[i]!==b.y[i]){same=false;break}
 ok(same,'limiter: gain 0 は gain 指定なしと同じ出力');
 // 既定は「-6dBの正弦波に何もしない」(天井 -1)・遅延は先読みぶんだけ
 ok(Math.abs(db(peak(a.y))-db(.5))<.05&&a.gr>-.05,'limiter: 既定では小さい音に手を出さない '+db(peak(a.y)).toFixed(2));
 const c=run(x,{gain:12});
 ok(db(peak(c.y))<=-1+.3&&db(peak(c.y))>-1-1.5,'limiter: gain +12 で天井(-1dB)に張りつく '+db(peak(c.y)).toFixed(2));
 ok(c.gr<-3,'limiter: gain +12 で GR が出る '+c.gr.toFixed(1));
 const e=run(x,{gain:12,ceiling:-6});ok(db(peak(e.y))<=-6+.3,'limiter: ceiling -6dB を守る '+db(peak(e.y)).toFixed(2));
 const e2=run(x,{gain:18,ceiling:-.1});ok(db(peak(e2.y))<=-.1+.3,'limiter: ceiling -0.1dB・gain +18 でも超えない '+db(peak(e2.y)).toFixed(2));
 // リリース: 大きい音のあとの小さい音の戻り方(短いほど早く戻る)
 const burst=Float32Array.from({length:N},(_,i)=>(i<SR*.3?1.5:.05)*Math.sin(2*Math.PI*220*i/SR));
 const rec=(r)=>{const y=run(burst,{release:r}).y;let s=0,n=0;for(let i=Math.round(SR*.4);i<Math.round(SR*.45);i++){s+=y[i]*y[i];n++}return Math.sqrt(s/n)};
 ok(rec(10)>rec(1000)*1.3,'limiter: release が短いほど小さい音への戻りが早い '+rec(10).toFixed(4)+' vs '+rec(1000).toFixed(4));
 // 極値で有限
 [{gain:0,ceiling:-6,release:10},{gain:18,ceiling:-.1,release:1000}].forEach(o=>{const y=run(sine(2),o).y;ok(y.every(Number.isFinite),'limiter: 極値で有限 '+JSON.stringify(o))});
}

/* ---- MR-2 / G-08: トゥルーピーク(limTP)。サンプルの間の山が天井を超えるのを減らす ---- */
{
 const D=procs['sd-limiter'].parameterDescriptors.find(d=>d.name==='tp');
 ok(D&&D.defaultValue===0&&D.minValue===0&&D.maxValue===1,'limiter: tp は 0/1・既定 0(従来)');
 const refTp=(x,R=8,T=32,a0=2000)=>{let m=0;for(let i=Math.max(T,a0);i<x.length-T;i++)for(let p=0;p<R;p++){let a=0;const f=p/R;for(let k=-T+1;k<=T;k++){const t=k-f,w=.5+.5*Math.cos(Math.PI*t/(T+1)),s=t===0?1:Math.sin(Math.PI*t)/(Math.PI*t);a+=x[i+k]*s*w}if(Math.abs(a)>m)m=Math.abs(a)}return m};
 let sd=7;const rnd=()=>{sd=(sd*1664525+1013904223)>>>0;return sd/4294967296*2-1};
 const M=9000,noise=Float32Array.from({length:M},()=>rnd()*.6),fs4=Float32Array.from({length:M},(_,i)=>Math.sin(Math.PI/2*i+Math.PI/4)*.6),
  hf=(()=>{const a=Float32Array.from({length:M},()=>rnd()*.6);return a.map((v,i)=>i?v-.9*a[i-1]:v)})();
 const tpdb=(x,o)=>db(refTp(run(x,o).y));
 const o0={gain:12,ceiling:-1,tp:0},o1={gain:12,ceiling:-1,tp:1};
 const n0=tpdb(noise,o0),n1=tpdb(noise,o1);ok(n0>2&&n1<n0-3&&n1<=-1+1.0,'TP: ノイズで山が減る '+n0.toFixed(2)+' → '+n1.toFixed(2)+'dB(天井 -1)');
 const f0=tpdb(fs4,o0),f1=tpdb(fs4,o1);ok(f0>1&&f1<=-1+.3,'TP: fs/4 の正弦波(位相45°)は天井を守る '+f0.toFixed(2)+' → '+f1.toFixed(2));
 const h0=tpdb(hf,o0),h1=tpdb(hf,o1);ok(h1<h0-1.5&&h1<=-1+1.6,'TP: 高域の多いノイズは山が減る(最悪でも天井+1.6dB以内) '+h0.toFixed(2)+' → '+h1.toFixed(2));
 const sp=run(noise,o1).y;let m=0;for(let i=2000;i<M;i++)m=Math.max(m,Math.abs(sp[i]));ok(db(m)<=-1+.3,'TP ON でもサンプルピークは天井以下 '+db(m).toFixed(2));
 const q0=run(sine(.5),{tp:0}).y,q1=run(sine(.5),{tp:1}).y;let same=true;for(let i=0;i<N;i++)if(q0[i]!==q1[i]){same=false;break}
 ok(same,'TP ON でも、天井に届かない音は素通し(同じ出力)');
 ok(run(sine(2),{tp:1,gain:18,ceiling:-.1,release:10}).y.every(Number.isFinite),'TP ON・極値で有限');
}

/* ---- ②③ バス(偽AudioContext) ---- */
const ctx={console,setTimeout,clearTimeout};ctx.window=ctx;vm.createContext(ctx);vm.runInContext('var SD={};',ctx);
const L=f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..','www','js',f),'utf8'),ctx,{filename:f});
let nid=0;
function node(type){const n={type,kind:type,id:++nid,out:[],channelCount:2,channelCountMode:'max',connect(t){n.out.push(t);return t},disconnect(t){n.out=t?n.out.filter(q=>q!==t):[]},start(){}};
 const P=v=>({value:v,setTargetAtTime(x){this.value=x},setValueAtTime(x){this.value=x}});
 n.gain=P(1);n.pan=P(0);n.Q=P(1);n.delayTime=P(0);n.frequency=P(350);n.threshold=P(0);n.knee=P(0);n.ratio=P(0);n.attack=P(0);n.release=P(0);return n}
class AC{constructor(){this.audioWorklet=AC.noWk?undefined:{addModule:()=>Promise.resolve()};this.currentTime=0;this.sampleRate=48000;this.state='running';this.destination=node('dest')}
 resume(){}createGain(){return node('gain')}createWaveShaper(){return node('shaper')}createDelay(){return node('delay')}
 createBiquadFilter(){return node('biquad')}createConvolver(){return node('conv')}createDynamicsCompressor(){return node('dyn')}
 createAnalyser(){return node('an')}createStereoPanner(){return node('pan')}createChannelMerger(){return node('merger')}createChannelSplitter(){return node('splitter')}createBuffer(c,l){const d=[new Float32Array(l),new Float32Array(l)];return{len:l,getChannelData:i=>d[i]}}}
class AWN{constructor(x,name,opt){this.kind=name;this.out=[];this.connect=q=>{this.out.push(q);return q};this.disconnect=()=>{this.out=[]};this.name=name;this.opt=opt;this.par={};this.parameters={get:k=>this.par[k]||(this.par[k]={value:name==='sd-limiter'&&k==='ceiling'?-1:name==='sd-limiter'&&k==='release'?80:0,setTargetAtTime(v){this.value=v},setValueAtTime(v){this.value=v}})};this.port={onmessage:null,postMessage(){}}}}
ctx.AudioWorkletNode=AWN;ctx.Blob=class{constructor(a){this.a=a}};ctx.URL={createObjectURL:()=>'blob:x'};ctx.AudioContext=AC;
['params.js','mixdefs.js','fxdsp.js','fxworklets.js','loud.js','bus.js','seq.js'].forEach(f=>{try{L(f)}catch(e){if(f!=='params.js')throw e}});
const SD=ctx.SD;
function reach(a,b,seen=new Set()){if(a===b)return true;if(seen.has(a))return false;seen.add(a);return a.out.some(t=>reach(t,b,seen))}
const near=(a,b,e=1e-9)=>Math.abs(a-b)<=e;

/* 定義 */
const IDS=['outTrim','mcOn','mcThr','mcRatio','mcAtk','mcRel','mcKnee','mcMake','limGain','limCeil','limRel','limTP'];
{
 const by=id=>SD.FXP.find(p=>p.id===id);
 ok(IDS.every(id=>by(id)&&SD.FXIDS.indexOf(id)>=0),'MR-1 のつまみがすべて FXP・FXIDS にある');
 ok(IDS.every(id=>{const p=by(id);return p.type==='seg'?p.opts.some(o=>o[0]===p.def):p.def>=p.min&&p.def<=p.max}),'既定値が範囲内');
 const want={outTrim:0,mcOn:1,mcThr:-10,mcRatio:4,mcAtk:3,mcRel:150,mcKnee:12,mcMake:0,limGain:0,limCeil:-1,limRel:80,limTP:0};
 ok(IDS.every(id=>by(id).def===want[id]),'既定値=従来の固定値(D-2) '+IDS.map(id=>id+'='+by(id).def));
 ok(by('limCeil').min===-6&&by('limCeil').max===-.1,'天井は -6.0〜-0.1(OFF なし・D-4)');
 ok(by('limRel').min===10&&by('limRel').max===1000&&by('limGain').max===18&&by('outTrim').min===-12&&by('outTrim').max===12,'範囲(G-01〜G-06)');
 ok(SD.FXR.some(r=>r.k==='mo')&&SD.FXR.some(r=>r.k==='ml'),'ラックに OUT COMP・LIMITER');
 ok(SD.fmt(by('limCeil'),-1)==='-1.0dB'&&SD.fmt(by('outTrim'),3)==='+3.0dB','表示は小数1桁+単位 '+SD.fmt(by('limCeil'),-1)+' '+SD.fmt(by('outTrim'),3));
}
 {const imp=new Float32Array(SR/2);imp[3000]=.1;const d=y=>{let k=0;for(let i=0;i<y.length;i++)if(Math.abs(y[i])>Math.abs(y[k]))k=i;return k-3000};
  const D=procs['sd-limiter'].parameterDescriptors.find(q=>q.name==='look');
  ok(D&&D.defaultValue===2&&D.minValue===1&&D.maxValue===5,'MR-4: limiter look は 1〜5ms・既定 2');
  ok(d(run(imp).y)===96&&d(run(imp,{look:2}).y)===96&&d(run(imp,{look:1}).y)===48&&d(run(imp,{look:5}).y)===240,'MR-4: 先読みの長さ=出力の遅れ(1ms=48・2ms=96・5ms=240サンプル)');
  const x=sine(.5),a=run(x),b=run(x,{look:2});let same=true;for(let i=0;i<N;i++)if(a.y[i]!==b.y[i]){same=false;break}ok(same,'MR-4: look 2 は指定なしと同じ出力');
  const lo=run(Float32Array.from({length:N},(_,i)=>i>4800&&i<4900?1.5:.05),{look:5});ok(peak(lo.y)<=Math.pow(10,-1/20)+.01,'MR-4: look 5 でも天井を守る '+db(peak(lo.y)).toFixed(2))}
(async()=>{
 const B=new SD.Bus();B.init();await B.wkP;const n=B.n;
 ok(reach(n.out,n.trim)&&n.trim.out[0]===n.comp&&n.comp.out[0]===n.mk&&reach(n.mk,n.lim),'配線: out→OUT TRIM→出口コンプ→MAKEUP→リミッター');
 ok(reach(n.lim,B.ctx.destination)&&n.lim.out.indexOf(n.an)>=0,'リミッター→出力・メーター');
 ok(n.lim.name==='sd-limiter','リミッターはワークレット');
 // 既定=従来
 ok(near(n.trim.gain.value,1)&&near(n.mk.gain.value,1),'既定: TRIM 0dB・MAKEUP 0dB');
 ok(n.comp.threshold.value===-10&&n.comp.knee.value===12&&n.comp.ratio.value===4&&near(n.comp.attack.value,.003)&&near(n.comp.release.value,.15),'既定: 出口コンプは 従来(-10・knee12・4:1・3ms・150ms)');
 const g=k=>n.lim.parameters.get(k).value;
 ok(g('ceiling')===-1&&g('release')===80&&g('gain')===0,'既定: リミッターは -1dB・80ms・GAIN 0');
 // 古い保存(新IDなし)も同じ
 ok(IDS.every(id=>B.val(id)===SD.FXDEF[id]),'val(): 保存に無ければ既定で補う');
 // 操作
 B.set('outTrim',6);ok(near(n.trim.gain.value,Math.pow(10,6/20)),'OUT TRIM +6dB');
 B.set('mcThr',-20);B.set('mcRatio',8);B.set('mcAtk',10);B.set('mcRel',300);B.set('mcKnee',0);
 ok(n.comp.threshold.value===-20&&n.comp.ratio.value===8&&near(n.comp.attack.value,.01)&&near(n.comp.release.value,.3)&&n.comp.knee.value===0,'出口コンプのつまみが反映');
 B.set('mcMake',6);ok(near(n.mk.gain.value,Math.pow(10,6/20)),'OC MAKEUP +6dB');
 B.set('mcOn',0);ok(n.comp.ratio.value===1&&near(n.mk.gain.value,1),'OUT COMP OFF=ratio 1 で素通し・MAKEUPも外れる');
 B.set('mcRatio',5);ok(n.comp.ratio.value===1,'OFF のあいだは RATIO を触っても素通しのまま');
 B.set('mcOn',1);ok(n.comp.ratio.value===5&&near(n.mk.gain.value,Math.pow(10,6/20)),'ON に戻すと設定どおり');
 B.set('limCeil',-3);B.set('limRel',200);B.set('limGain',6);B.set('limTP',1);
 ok(g('ceiling')===-3&&g('release')===200&&g('gain')===6&&g('tp')===1,'リミッターの CEILING・RELEASE・GAIN・TRUE PEAK が反映');
 // 保存値つきで開始(ワークレット読み込み後に入る)
 const C=new SD.Bus();C.p.limCeil=-2.5;C.p.limGain=4;C.p.mcOn=0;C.p.outTrim=-3;C.init();await C.wkP;
 const q=k=>C.n.lim.parameters.get(k).value;
 ok(q('ceiling')===-2.5&&q('gain')===4&&C.n.comp.ratio.value===1&&near(C.n.trim.gain.value,Math.pow(10,-3/20)),'保存値つきで開始: ワークレット差し替え後も反映');
 // 非対応環境: 標準ノードのまま・つまみで壊れない
 AC.noWk=true;const U=new SD.Bus();U.init();await U.wkP;AC.noWk=false;
 let thrown=false;try{U.set('limCeil',-3);U.set('limGain',6);U.set('limRel',100);U.set('outTrim',3);U.set('mcOn',0)}catch(e){thrown=true}
 ok(!thrown&&U.n.lim.type==='dyn'&&U.n.lim.threshold.value===-3,'非対応環境: 従来の標準リミッターのまま・つまみで壊れない');
 ok(U.limGr()===0||typeof U.limGr()==='number','非対応環境: limGr が数');
 // LIM GR
 ok(B.limGr()===0,'メッセージが無ければ LIM GR=0');
 B.gr.lim=-4.2;B.grLimT=Date.now();ok(B.limGr()===-4.2,'LIM GR: ワークレットの値');
 B.grLimT=Date.now()-2000;ok(B.limGr()===0,'LIM GR: 止まったら 0 に戻す');
 // 測定目標 grLim
 ok(SD.MixGoal.MT.grLim&&SD.MixGoal.MT.grLim.u==='dB'&&!SD.MixGoal.MT.grLim.lm,'MT に grLim(LIM GR)');
 const mk=(g)=>SD.MixGoal.check({id:'zz',steps:[{h:'a',b:'b',mt:[g]}]});
 ok(mk({m:'grLim',trk:'M',rng:[2,6],hold:3}).filter(e=>/grLim/.test(e)).length===0,'grLim: マスター・0〜24 は通る');
 ok(mk({m:'grLim',trk:1,rng:[2,6],hold:3}).some(e=>/grLim/.test(e)),'grLim: トラック指定は不可');
 ok(mk({m:'grLim',trk:'M',rng:[2,30],hold:3}).some(e=>/grLim/.test(e)),'grLim: 24 dB を超える範囲は不可');
 ok(/LIM GR/.test(SD.MixGoal.chipText({m:'grLim',trk:'M',rng:[2,6],hold:3})),'チップに LIM GR');
 // masterMeter の形(analyser は偽物なので存在チェックだけ)
 ok(/grLim/.test(fs.readFileSync(path.join(__dirname,'..','www','js','bus.js'),'utf8')),'masterMeter に grLim');
 /* ---- MR-3: マスタリング用EQ・低域のモノ化・スペクトラム・ゴニオメーター ---- */
 {const by=id=>SD.FXP.find(p=>p.id===id),Q=['mqOn','mqMode','mqHpf','mqLoF','mqLoG','mqM1F','mqM1G','mqM1Q','mqM2F','mqM2G','mqM2Q','mqHiF','mqHiG','monoBelow'];
  ok(Q.every(id=>by(id)&&SD.FXIDS.indexOf(id)>=0),'MR-3: つまみが FXP・FXIDS にある');
  ok(by('mqOn').def===0&&by('mqMode').def===0&&by('mqHpf').def===20&&by('monoBelow').def===0&&['mqLoG','mqM1G','mqM2G','mqHiG'].every(id=>by(id).def===0&&by(id).min===-6&&by(id).max===6),'MR-3: 既定は OFF・ゲイン0・HPF 20Hz(=従来と同じ音)');
  const R=SD.FXR.findIndex(r=>r.k==='mq'),Mo=SD.FXR.findIndex(r=>r.k==='mo');ok(R>=0&&R+1===Mo&&SD.FXR[R].ids.length===Q.length,'MR-3: ラックの MASTER EQ は OUT COMP の直前');
  const B2=new SD.Bus();B2.init();await B2.wkP;const m=B2.mq,n2=B2.n;
  ok(reach(n2.out,m.st.hp)&&reach(m.sum,n2.trim)&&reach(m.st.hi,m.byp)&&reach(m.sd.hi,m.msG),'MR-3: 配線 out→EQ→(素通し|M/S)→TRIM');
  ok(near(m.byp.gain.value,1)&&near(m.msG.gain.value,0)&&m.st.lo.gain.value===0&&m.mid.b1.gain.value===0,'MR-3: 既定は素通し(M/Sを通らない・全ゲイン0)');
  B2.p.mqOn=1;B2.p.mqLoG=4;B2.mqSet(true);ok(m.st.lo.gain.value===4&&m.mid.lo.gain.value===0&&near(m.byp.gain.value,1),'MR-3: STEREO は左右用のチェーンだけ・M/Sは通らない');
  B2.p.mqMode=1;B2.mqSet(true);ok(m.st.lo.gain.value===0&&m.mid.lo.gain.value===4&&m.sd.lo.gain.value===0&&near(m.msG.gain.value,1)&&near(m.byp.gain.value,0),'MR-3: MID は中央だけにかかる');
  B2.p.mqMode=2;B2.mqSet(true);ok(m.sd.lo.gain.value===4&&m.mid.lo.gain.value===0,'MR-3: SIDE はサイドだけにかかる');
  B2.p.mqOn=0;B2.mqSet(true);ok(m.sd.lo.gain.value===0&&near(m.byp.gain.value,1),'MR-3: OFF で素通しに戻る(A/B)');
  B2.p.monoBelow=120;B2.mqSet(true);ok(m.mh1.type==='highpass'&&m.mh1.frequency.value===120&&near(m.msG.gain.value,1),'MR-3: MONO BELOW はEQがOFFでもサイドHPFが効く');
  B2.p.monoBelow=0;B2.p.mqHpf=80;B2.p.mqOn=1;B2.p.mqMode=0;B2.mqSet(true);ok(m.st.hp.type==='highpass'&&m.st.hp.frequency.value===80,'MR-3: HPF');
  ok(typeof B2.masterSpec==='function'&&typeof B2.masterLR==='function'&&B2.msp&&B2.msp.sp,'MR-3: 表示用の分岐(スペクトラム・L/R)');
  // 純粋関数
  const LD=SD.LOUD,sr=48000;ok(LD.THIRD.length===29,'MR-3: 1/3オクターブ 29 帯域');
  const bins=4097,db=new Float32Array(bins).fill(-100);for(let k=0;k<bins;k++){const f=k*sr/2/(bins-1);if(f>=900&&f<=1120)db[k]=-20}
  const th=LD.thirds(db,sr),i1k=LD.THIRD.indexOf(1000);ok(th[i1k]>-21&&th[i1k]<-19&&th[LD.THIRD.indexOf(100)]<-90,'MR-3: thirds 1kHz に帯域が出る '+th[i1k].toFixed(1));
  const flat=LD.THIRD.map(f=>-30+(-3)*Math.log2(f/1000)),tl=LD.tilt(flat,-3);ok(tl&&Math.abs(tl[0]-flat[0])<1e-9&&Math.abs(tl[28]-flat[28])<1e-9,'MR-3: tilt -3dB/oct の傾きに一致');
  ok(LD.tilt(LD.THIRD.map(()=>-Infinity),-3)===null,'MR-3: tilt 無音は null');
  const N=4096,sn=(f,ph)=>Float32Array.from({length:N},(_,i)=>.5*Math.sin(2*Math.PI*f*i/sr+(ph||0)));
  const s100=sn(60),s1k=sn(1000),s5k=sn(5000);const mix=(...a)=>Float32Array.from({length:N},(_,i)=>a.reduce((x,y)=>x+y[i],0));
  let bc=LD.bandCorr(mix(s100,s1k,s5k),mix(s100,s1k,s5k),sr);ok(bc.every(v=>v>.99),'MR-3: bandCorr 同じ信号は全帯域 +1 '+bc);
  const inv=a=>a.map(v=>-v);bc=LD.bandCorr(mix(s100,s1k,s5k),mix(inv(s100),s1k,s5k),sr);ok(bc[0]<-.95&&bc[1]>.95&&bc[2]>.95,'MR-3: bandCorr 低域だけ逆相 → 低だけ -1 '+bc.map(v=>v.toFixed(2)));
  ok(LD.bandCorr(new Float32Array(N),new Float32Array(N),sr).every(v=>v===null),'MR-3: bandCorr 無音は null');
  const g=LD.gonio([.5,.5],[.5,-.5]);ok(Math.abs(g[0][0])<1e-9&&g[0][1]>.7&&g[1][0]>.7&&Math.abs(g[1][1])<1e-9,'MR-3: gonio 同相=縦・逆相=横');
 }
 /* ---- MR-4: 先読み・クリッパー・マスターバイパス・プリセット ---- */
 {const by=id=>SD.FXP.find(p=>p.id===id);
  ok(by('limLook').def===2&&by('limLook').opts.map(o=>o[0]).join()==='1,2,5'&&by('clipOn').def===0&&by('clipThr').min===-12&&by('clipThr').max===0&&by('clipShape').opts.length===2,'MR-4: つまみの既定(先読み2ms・クリッパーOFF)と範囲');
  ok(SD.FXR.map(r=>r.k).join().indexOf('mq,mo,cl,ml')>=0&&SD.FXR.find(r=>r.k==='ml').ids.indexOf('limLook')>=0,'MR-4: ラックの並び MASTER EQ→OUT COMP→CLIPPER→LIMITER');
  const B3=new SD.Bus();B3.init();await B3.wkP;const n3=B3.n,c=B3.cl;
  ok(reach(n3.mk,c.sh)&&reach(c.sh,n3.csum)&&reach(n3.mk,n3.csum)&&reach(n3.csum,n3.lim)&&c.sh.oversample==='2x','MR-4: 配線 MAKEUP→(素通し|クリッパー2x)→リミッター');
  ok(near(c.cd.gain.value,1)&&near(c.cg.gain.value,0),'MR-4: 既定は素通し');
  B3.p.clipOn=1;B3.p.clipThr=-6;B3.p.clipShape=1;B3.clSet(true);const k=Math.pow(10,-6/20),cv=c.sh.curve;
  ok(near(c.cg.gain.value,1)&&near(c.cd.gain.value,0)&&Math.abs(cv[cv.length-1]-k)<1e-6&&Math.abs(cv[0]+k)<1e-6,'MR-4: HARD は ±しきい値で平ら');
  B3.p.clipShape=0;B3.clSet(true);const cs=c.sh.curve,mid=cs.length>>1;ok(Math.abs(cs[mid+Math.round(.02*cs.length/2)]-.02)<.0015&&cs[cs.length-1]<=Math.pow(10,-6/20)+1e-6,'MR-4: SOFT は小さい音をそのまま・山は しきい値以下');
  B3.p.limLook=5;B3.mastSet('limLook',5,true);ok(n3.lim.par&&n3.lim.par.look&&n3.lim.par.look.value===5,'MR-4: limLook がワークレットに届く');
  // バイパス
  B3.p.mqOn=1;B3.p.mqLoG=3;B3.p.outTrim=4;B3.p.mcOn=1;B3.p.limGain=6;B3.p.limCeil=-2;B3.applyMaster(true);
  ok(near(n3.trim.gain.value,Math.pow(10,4/20))&&n3.lim.par.gain.value===6,'MR-4: 処理中の値');
  B3.setBypass(true);B3.applyMaster(true);
  ok(near(n3.trim.gain.value,1)&&n3.lim.par.gain.value===0&&n3.lim.par.ceiling.value===-2&&near(c.cg.gain.value,0)&&near(n3.comp.ratio.value,1)&&B3.mq.st.lo.gain.value===0&&near(B3.mq.byp.gain.value,1),'MR-4: バイパスで EQ・コンプ・TRIM・押し込み・クリッパーが外れ、天井は残る');
  B3.setBypass(false);B3.applyMaster(true);ok(near(n3.trim.gain.value,Math.pow(10,4/20))&&n3.lim.par.gain.value===6&&B3.mq.st.lo.gain.value===3,'MR-4: バイパスOFFで元に戻る');
  // 音量合わせ: 処理後 -10・外した -16 → 処理後を 6 dB 下げて比べる(下げる方向だけ)
  B3.mbReset();B3.setBypass(false);B3.mbT=0;B3.mbTrack(-10);B3.setBypass(true);B3.mbT=0;B3.mbTrack(-16);
  ok(B3.cmpDb===0,'MR-4: 外した音の方が小さいとき、外した側は下げない('+B3.cmpDb+')');
  B3.setBypass(false);ok(B3.cmpDb===-6,'MR-4: 処理した側を 6 dB 下げて揃える('+B3.cmpDb+')');
  B3.mbReset();ok(B3.cmpDb===0&&!B3.mbyp,'MR-4: mbReset で元に戻る');
  // プリセット
  const F=SD.MRP.FACTORY,all=SD.MRP.IDS;ok(F.length===4&&F[0].id==='std'&&Object.keys(SD.MRP.full(F[0].v)).length===all.length,'MR-4: プリセット4つ・全項目を補う');
  ok(all.every(id=>by(id)),'MR-4: プリセットの項目は全部つまみがある');
  ok(F.every(f=>Object.keys(f.v).every(id=>{const p=by(id);return p&&(p.type==='seg'?p.opts.some(o=>o[0]===f.v[id]):f.v[id]>=p.min&&f.v[id]<=p.max)})),'MR-4: プリセットの値が範囲内');
  ok(SD.MRP.full(F[0].v).limCeil===-1&&SD.MRP.full(F[0].v).limLook===2&&SD.MRP.full(F[0].v).clipOn===0,'MR-4: 標準=従来と同じ');
 }
 console.log(err?err+'件NG':'mr1 OK');process.exit(err?1:0);
})();
