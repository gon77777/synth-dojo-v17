// MR-6a の検査: node test/mr6.js  G-22 録音→WAV 書き出し・G-23 ディザ(TPDF)。耳・実機(共有・ダウンロード)は未確認
const fs=require('fs'),path=require('path'),vm=require('vm');
let err=0;const ok=(c,m)=>{if(!c){console.error('NG: '+m);err++}};
const W=p=>fs.readFileSync(path.join(__dirname,'..','www',p),'utf8');
const win={};win.window=win;win.btoa=s=>Buffer.from(s,'latin1').toString('base64');
const ctx=vm.createContext(win);
try{vm.runInContext(W('js/wav.js'),ctx)}catch(e){ok(false,'wav.js が読めない: '+e.message)}
const SD=win.SD,WV=SD&&SD.WAV;ok(!!WV,'SD.WAV がある');
if(WV){
 const sr=48000,n=4800,sine=a=>Float32Array.from({length:n},(_,i)=>a*Math.sin(2*Math.PI*441*i/sr));
 // ヘッダ
 let u=WV.encode(sine(.5),sine(.25),sr,16,false);const d=new DataView(u.buffer),s4=o=>String.fromCharCode(u[o],u[o+1],u[o+2],u[o+3]);
 ok(s4(0)==='RIFF'&&s4(8)==='WAVE'&&s4(12)==='fmt '&&s4(36)==='data','WAV: 見出し');
 ok(d.getUint16(20,true)===1&&d.getUint16(22,true)===2&&d.getUint32(24,true)===sr&&d.getUint16(34,true)===16,'WAV: PCM・2ch・48000・16bit');
 ok(d.getUint32(40,true)===n*4&&u.length===44+n*4&&d.getUint32(4,true)===u.length-8,'WAV: 長さ(16bit)');
 ok(d.getUint32(28,true)===sr*4&&d.getUint16(32,true)===4,'WAV: バイト率・ブロック(16bit)');
 // 値(ディザなし=丸めだけ)
 const mid=1200;ok(Math.abs(d.getInt16(44+mid*4,true)-Math.round(sine(.5)[mid]*32767))===0&&Math.abs(d.getInt16(46+mid*4,true)-Math.round(sine(.25)[mid]*32767))===0,'16bit: 値(L・Rが交互)');
 // 24bit
 const u24=WV.encode(sine(.5),sine(.25),sr,24,false),d24=new DataView(u24.buffer);
 ok(d24.getUint16(34,true)===24&&d24.getUint32(40,true)===n*6&&u24.length===44+n*6&&d24.getUint16(32,true)===6,'WAV: 24bit の長さ・ブロック');
 const rd24=o=>{let v=u24[o]|(u24[o+1]<<8)|(u24[o+2]<<16);return v&0x800000?v-0x1000000:v};
 ok(rd24(44+mid*6)===Math.round(sine(.5)[mid]*8388607)&&rd24(47+mid*6)===Math.round(sine(.25)[mid]*8388607),'24bit: 値・負の数');
 // 飽和・不正値
 ok(WV.quant(2,16,false)===32767&&WV.quant(-2,16,false)===-32767&&WV.quant(NaN,16,false)===0&&WV.quant(1,24,false)===8388607,'quant: 飽和(対称)・NaN は 0');
 const fsU=WV.encode(Float32Array.of(1,-1,0),Float32Array.of(3,-3,0),sr,16,true,7),fd=new DataView(fsU.buffer);
 ok(fd.getInt16(44,true)>=32766&&fd.getInt16(44,true)<=32767&&fd.getInt16(48,true)<=-32767,'ディザしても上限・下限を超えない(飽和)');
 // ディザ: 無音は 0 でなくなる(±1 LSB 程度)・平均 ≒0・分散 ≒1/6 LSB^2(TPDF=二乗平均 1/6... 丸め前の分散 1/6)・同じ種なら同じ
 const z=new Float32Array(48000),Z=WV.encode(z,z,sr,16,true,5),zd=new DataView(Z.buffer);let sum=0,sq=0,mx=0,nz=0;
 for(let i=0;i<48000;i++){const v=zd.getInt16(44+i*4,true);sum+=v;sq+=v*v;mx=Math.max(mx,Math.abs(v));if(v)nz++}
 ok(mx<=1,'TPDF: 無音に足すのは ±1 LSB まで('+mx+')');ok(Math.abs(sum/48000)<.02,'TPDF: 平均 ≒ 0('+(sum/48000).toFixed(4)+')');
 ok(sq/48000>.25&&sq/48000<.75,'TPDF: 二乗平均(量子化後)が妥当('+(sq/48000).toFixed(3)+')');
 ok(nz>48000*.15,'ディザ: 無音でも値が動く');
 const Z0=WV.encode(z,z,sr,16,false);ok(Z0.every((b,i)=>i<44||b===0),'ディザなしの無音は全部 0');
 const Z2=WV.encode(z,z,sr,16,true,5);ok(Z.every((b,i)=>b===Z2[i]),'同じ種なら同じ結果');
 // 弱い信号(0.4 LSB の一定値): ディザなしは 0 のまま・ディザありは平均が 0.4 に近づく(量子化歪みを雑音に変える)
 const c=Float32Array.from({length:48000},()=>0.4/32767),C0=new DataView(WV.encode(c,c,sr,16,false).buffer),C1=new DataView(WV.encode(c,c,sr,16,true,3).buffer);let m0=0,m1=0;
 for(let i=0;i<48000;i++){m0+=C0.getInt16(44+i*4,true);m1+=C1.getInt16(44+i*4,true)}
 ok(m0===0&&Math.abs(m1/48000-.4)<.03,'ディザで 1 LSB 未満の小さな値が平均として残る('+(m1/48000).toFixed(3)+')');
 // join・peak・b64
 const J=WV.join([Float32Array.of(1,2),Float32Array.of(3,4,5)],4);ok(J.length===4&&J[3]===4,'join: 長さで切る');
 ok(Math.abs(WV.peak(Float32Array.of(.1,-.8),Float32Array.of(.3,.2))-.8)<1e-6,'peak');
 ok(WV.b64(Uint8Array.of(72,105))==='SGk=','b64');
 ok(WV.encode(new Float32Array(0),new Float32Array(0),sr,16,false).length===44,'空でも見出しだけ作れる');
}
// ---- バスの録音(偽の ctx) ----
(async()=>{
 const src=W('js/bus.js');let SB;
 try{const c2=vm.createContext({window:win,SD:win.SD,console,Float32Array,Math,Object,Promise});c2.window=c2;vm.runInContext('var SD=window.SD;',c2);vm.runInContext(W('js/mixdefs.js'),c2);vm.runInContext(src,c2);SB=c2.SD.Bus}catch(e){ok(false,'bus.js が読めない: '+e.message)}
 if(SB){
  const mk=()=>{const sp={_c:[],connect(x){this._c.push(x)},disconnect(){this.dc=1},onaudioprocess:null},g={gain:{value:1},connect(){},disconnect(){}};
   const lim={cs:[],connect(x){this.cs.push(x)},disconnect(x){this.cs=this.cs.filter(q=>q!==x)}};
   const B=Object.create(SB.prototype);B.ctx={sampleRate:100,destination:{},createScriptProcessor:()=>sp,createGain:()=>g};B.n={lim};B.p={};return{B,sp,g,lim}};
  const blk=(v,len)=>({inputBuffer:{numberOfChannels:2,getChannelData:c=>new Float32Array(len).fill(c?-v:v)}});
  let {B,sp,g,lim}=mk();
  ok(B.recInfo().on===false&&B.recOff()===null,'録音: 始める前は null');
  ok(B.recOn()===true&&lim.cs.includes(sp)&&g.gain.value===0&&B.recInfo().on,'録音: リミッター出力につなぐ・無音の出口');
  ok(B.recOn()===false,'録音: 二重には始まらない');
  sp.onaudioprocess(blk(.5,50));sp.onaudioprocess(blk(.25,50));
  ok(Math.abs(B.recInfo().sec-1)<1e-9,'録音: 経過秒');
  const r=B.recOff();ok(r&&r.n===100&&r.sr===100&&r.L.length===100&&r.L[0]===.5&&r.L[99]===.25&&r.R[0]===-.5,'録音: L・R を順に集める');
  ok(!lim.cs.includes(sp)&&!B.recInfo().on&&B.recOff()===null,'録音: 止めると外れる');
  // 上限
  ({B,sp}=mk());B.recOn();const max=100*win.SD.WAV.MAXSEC;for(let i=0;i<max/50+3;i++)sp.onaudioprocess(blk(.1,50));
  const i2=B.recInfo();ok(i2.full&&B.recOff().n===max,'録音: 上限で止まる('+max+')');
  // バイパス中は始まらない・ctx なしは false
  ({B}=mk());B.mbyp=true;ok(B.recOn()===false,'録音: BYPASS 中は始まらない');
  ({B}=mk());B.ctx=null;ok(B.recOn()===false,'録音: ctx なしは false');
 }
 // ---- G-25 ロッシー風モニター(偽の ctx でつなぎ方と周波数) ----
 if(SB){
  const mkF=()=>({type:'',frequency:{value:0},Q:{value:0},cs:[],connect(x){this.cs.push(x)},disconnect(){this.cs=[]}});
  const mkG=()=>({channelCount:2,cs:[],connect(x){this.cs.push(x)},disconnect(){this.cs=[]}});
  const B=Object.create(SB.prototype),dest={},monIn=mkG();B.ctx={destination:dest,createBiquadFilter:mkF,createGain:mkG};B.monIn=monIn;B.mon=null;B.onMon=null;
  const chain=()=>{const o=[];let n=monIn;for(let i=0;i<8&&n&&n!==dest;i++){o.push(n);n=n.cs[0]}return{o,end:n}};
  B.setMonitor({});ok(chain().end===dest&&chain().o.length===1,'ロッシー風: OFF は素通し');
  B.setMonitor({lossy:1});let c=chain();ok(c.o.length===3&&c.end===dest&&c.o[1].frequency.value===16000&&c.o[2].frequency.value===16000&&c.o[1].type==='lowpass','ロッシー風 中: 16kHz のローパス2段');
  B.setMonitor({lossy:2});c=chain();ok(c.o[1].frequency.value===11000&&c.o[2].frequency.value===11000,'ロッシー風 強: 11kHz');
  B.setMonitor({mono:1,small:1});c=chain();ok(c.o.length===1+2+1+2&&c.end===dest,'ロッシー風・MONO・小SP は併用できる(ロッシー→MONO→小SP の順)');
  B.monOff();c=chain();ok(B.mon.lossy===0&&B.mon.mono===0&&c.o.length===1&&c.end===dest,'monOff でロッシー風も OFF');
 }
 // ---- G-24 2ミックス(MASTERING) ----
 {
  const c3=vm.createContext(win);vm.runInContext(W('js/mst.js'),c3);const M=win.SD.MST,sr=1000,f=n=>new Float32Array(n).fill(.5);
  let P=M.prep([f(2000),f(2000)],sr,'my song.final.wav');ok(P.ok&&P.n===2000&&P.name==='my song.final'&&!P.cut&&!P.mono,'MST: ステレオ・拡張子を外した名前');
  P=M.prep([f(500)],sr,'a.wav');ok(P.ok&&P.mono&&P.L===P.R||P.R.length===500,'MST: モノラルは両側に同じ音');
  P=M.prep([f(sr*M.LIM.sec+5),f(sr*M.LIM.sec+5)],sr,'x');ok(P.ok&&P.cut&&P.n===sr*M.LIM.sec&&P.L.length===P.n&&P.R.length===P.n,'MST: 上限で切り捨て');
  ok(!M.prep([],sr,'x').ok&&!M.prep([new Float32Array(0)],sr,'x').ok&&!M.prep([f(10)],0,'x').ok,'MST: 空・不正は失敗');
  ok(M.prep([f(10)],sr,'あ'.repeat(40)).name.length===24,'MST: 名前は24字まで');
  ok(M.fmt(75)==='1:15'&&M.fmt(0)==='0:00'&&M.fmt(-3)==='0:00','MST: 時間表記');
  ok(M.LIM.sec===300&&M.LIM.file===40*1048576,'MST: 上限は 300 秒・40MB');
 }
 if(SB){
  const mkB=()=>{const srcs=[];const mixIn={cs:[],connect(){},disconnect(){}};
   const ctxx={currentTime:0,createBuffer:(c,n,sr)=>({duration:n/sr,ch:[new Float32Array(n),new Float32Array(n)],copyToChannel(a,i){this.ch[i].set(a)}}),
    createBufferSource:()=>{const s={loop:false,buffer:null,to:null,started:0,stopped:0,connect(x){this.to=x},disconnect(){this.to=null},start(){this.started=1},stop(){this.stopped=1},onended:null};srcs.push(s);return s}};
   const B=Object.create(SB.prototype);B.ctx=ctxx;B.mixIn=mixIn;B.cbs=[];B.onMst=m=>B.cbs.push(m);return{B,srcs,mixIn,ctxx}};
  const {B,srcs,mixIn,ctxx}=mkB();const L=new Float32Array(2000).fill(.1),R=new Float32Array(2000).fill(.2);
  ok(B.mstInfo().has===false&&B.mstPlay()===false,'MASTERING: 読み込む前は再生できない');
  ok(B.mstSet({L,R,n:2000,sr:1000,name:'曲'})===true&&B.mstInfo().has&&Math.abs(B.mstInfo().dur-2)<1e-9&&B.mst.buf.ch[0][0]>.09&&B.mst.buf.ch[1][0]>.19,'MASTERING: ステレオで置く');
  ok(B.mstPlay()===true&&srcs[0].to===mixIn&&srcs[0].started===1&&srcs[0].loop===true&&B.mstInfo().on,'MASTERING: 入口(mixIn=マスター段の手前)につなぐ・既定はループ');
  ok(B.mstPlay()===false,'MASTERING: 二重には鳴らない');
  ctxx.currentTime=2.5;ok(Math.abs(B.mstInfo().pos-.5)<1e-9,'MASTERING: ループ中の位置');
  B.mstLoop(false);ok(srcs[0].loop===false&&Math.abs(B.mstInfo().pos-2)<1e-9,'MASTERING: LOOP OFF で端で止まる位置');
  B.mstStop();ok(srcs[0].stopped===1&&srcs[0].to===null&&!B.mstInfo().on&&B.mstInfo().has,'MASTERING: 止めても曲は残る');
  B.mstPlay();const s2=srcs[1];s2.onended();ok(!B.mstInfo().on,'MASTERING: 最後まで鳴ったら止まる');
  B.mstPlay();B.mstSet({L,R,n:2000,sr:1000,name:'b'});ok(srcs[2].stopped===1,'MASTERING: 差し替えで前のを止める');
  B.mstClear();ok(!B.mstInfo().has&&B.cbs.length>5,'MASTERING: 取り外し・変化を通知');
  ok(mkB().B.ctx&&(()=>{const q=mkB().B;q.ctx=null;return q.mstSet({L,R,n:2000,sr:1000})===false})(),'MASTERING: ctx なしは false');
 }

 // ---- G-20 自分のリファレンス ----
 {
  const c4=vm.createContext(win);vm.runInContext(W('js/mst.js'),c4);const M=win.SD.MST;
  const m1=M.match(-14,-9);ok(m1&&m1.mix===0&&m1.ref===-5&&m1.diff===5,'REF: 大きい方(リファレンス)だけ下げる');
  const m2=M.match(-8,-14);ok(m2&&m2.mix===-6&&m2.ref===0&&m2.diff===-6,'REF: ミックスが大きいときはミックス側を下げる(上げない)');
  ok(M.match(null,-9)===null&&M.match(-14,NaN)===null&&M.match(-Infinity,-9)===null,'REF: 測れないときは null');
  ok(M.match(0,-60).mix===-24&&M.match(-60,0).ref===-24,'REF: 補正は -24 dB まで');
  ok(M.prep([new Float32Array(5000)],1000,'x',2).n===2000&&M.prep([new Float32Array(5000)],1000,'x',2).cut,'REF: prep は秒数を指定して切り捨てられる');
  ok(M.REFSEC===180&&M.lufs(new Float32Array(10),null,0)===null&&M.lufs(new Float32Array(10),null,48000)===null,'REF: LUFS を測れない入力は null');
 }
 if(SB){
  const gn=()=>({gain:{v:1,setTargetAtTime(v){this.v=v}},cs:[],connect(x){this.cs.push(x)},disconnect(){this.cs=[]},channelCount:2});
  const srcs=[];const B=Object.create(SB.prototype),ctxx={currentTime:0,createGain:gn,createBuffer:(c,n,sr)=>({duration:n/sr,copyToChannel(){}}),createBufferSource:()=>{const s={loop:false,buffer:null,to:null,started:0,stopped:0,connect(x){this.to=x},disconnect(){this.to=null},start(){this.started=1},stop(){this.stopped=1}};srcs.push(s);return s}};
  B.ctx=ctxx;B.monIn=gn();B.cmpG=gn();B.cmpDb=0;B.lmRead=()=>({lufsI:-14});B.cbs=[];B.onRef=r=>B.cbs.push(r);
  const L=new Float32Array(2000),P={L,R:L,n:2000,sr:1000,name:'ref'};
  ok(B.refInfo().has===false&&B.refPlay()===false,'REF: 読み込む前は再生できない');
  ok(B.refSet(P,-9)===true&&B.refInfo().has&&B.refInfo().lufs===-9,'REF: 置く');
  ok(B.refPlay()===true&&srcs[0].loop===true&&srcs[0].started===1&&B.ref.g.cs[0]===B.monIn&&B.refInfo().on,'REF: 最終段の後(monIn)につなぐ・マスター段は通さない');
  ok(Math.abs(B.ref.g.gain.v-Math.pow(10,-5/20))<1e-9&&B.cmpG.gain.v===0&&B.refInfo().ab==='b','REF: B は音量を揃えて鳴り、ミックスは消える');
  B.refAB('a');ok(B.ref.g.gain.v===0&&Math.abs(B.cmpG.gain.v-1)<1e-9,'REF: A はミックス側が鳴る(基準の大きさ)');
  B.refMatch(false);B.refAB('b');ok(B.ref.g.gain.v===1&&!B.refInfo().match,'REF: 音量を揃えない OFF');
  B.refMatch(true);B.lmRead=()=>null;B.refAB('b');ok(B.ref.g.gain.v===1,'REF: ミックスが未測定なら補正なし');
  B.refAB('a');B.setCmpGain(-6);ok(Math.abs(B.cmpG.gain.v-Math.pow(10,-6/20))<1e-9,'REF: 再生中の setCmpGain も反映される');
  ok(B.refPlay()===false,'REF: 二重には鳴らない');
  B.refStop();ok(srcs[0].stopped===1&&srcs[0].to===null&&!B.refInfo().on&&B.refInfo().has&&Math.abs(B.cmpG.gain.v-Math.pow(10,-6/20))<1e-9,'REF: 止めるとミックス側の音量に戻る・曲は残る');
  B.refPlay();B.refSet(P,-9);ok(srcs[1].stopped===1,'REF: 差し替えで前のを止める');
  B.refClear();ok(!B.refInfo().has&&B.cbs.length>5,'REF: 取り外し・変化を通知');
  const q=Object.create(SB.prototype);q.ctx=null;ok(q.refSet(P,-9)===false,'REF: ctx なしは false');
 }
 // ---- 静的: app.js・index.html・sw.js ----
 const app=W('js/app.js');
 ok(/case 'rec':/.test(app)&&/case 'recb':/.test(app)&&/case 'recd':/.test(app)&&/function recFinish\(/.test(app),'app.js: REC の操作');
 ok(/function mxStop\(\)\{if\(SD\.bus&&SD\.bus\.recInfo/.test(app),'app.js: MIX を離れたら録音を止める');
 ok(app.indexOf('function recRow(')>app.indexOf('function lmHtml(')&&app.indexOf('function recRow(')<app.indexOf('function mxMeterTick('),'app.js: recRow は lmui の切り出し範囲内');
 ok(/case 'monl':/.test(app)&&/data-act="monl"/.test(app)&&app.includes('ロッシー風(近似)')&&/実際の圧縮とは違います/.test(app),'app.js: ロッシー風の操作と「近似」の明記');
 ok(/case 'mstld':/.test(app)&&/case 'mstp':/.test(app)&&/case 'mstl':/.test(app)&&/case 'mstx':/.test(app)&&/function mstImport\(/.test(app)&&app.includes('自分が権利を持つ曲だけ'),'app.js: MASTERING の操作と権利の注意');
 ok(app.indexOf('function mstRow(')>app.indexOf('function lmHtml(')&&app.indexOf('function mstRow(')<app.indexOf('function mxMeterTick('),'app.js: mstRow は lmui の切り出し範囲内');
 ok(W('index.html').includes('js/mst.js')&&W('sw.js').includes('js/mst.js')&&W('index.html').includes('id="mstf"')&&W('index.html').includes('id="mstbar"'),'mst.js・入力欄・バーが index.html/sw.js にある');
 ok(W('index.html').includes('js/wav.js')&&W('sw.js').includes('js/wav.js'),'wav.js が index.html と sw.js にある');
 ok(/case 'refld':/.test(app)&&/case 'refp':/.test(app)&&/case 'refab':/.test(app)&&/case 'refm':/.test(app)&&/case 'refx':/.test(app)&&/function refImport\(/.test(app)&&/SD\.bus\.onRef=/.test(app),'app.js: REF の操作');
 ok(app.indexOf('function refRow(')>app.indexOf('function lmHtml(')&&app.indexOf('function refRow(')<app.indexOf('function mxMeterTick(')&&app.includes('${mstRow()}${refRow()}'),'app.js: refRow は lmui の切り出し範囲内・MASTERING の次');
 ok(app.includes('自分が権利を持つ曲だけ')&&app.includes('リファレンスはマスター段を通さず')&&app.includes('音量が違うと大きい方が良く聞こえます'),'app.js: REF の権利・音量の注意');
 ok(W('index.html').includes('id="reff"')&&W('index.html').includes('id="refbar"'),'index.html: REF の入力欄・バー');
 console.log(err?err+'件NG':'mr6 OK');process.exit(err?1:0);
})();
