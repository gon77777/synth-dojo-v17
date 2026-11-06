/* OC: オカルト・オーディオコースの構造検査(OC-0 は枠のみ。レッスンが入るたびに want を延ばす)。node test/oc.js */
const fs=require('fs'),path=require('path'),vm=require('vm');
const w=path.join(__dirname,'..','www'),idx=fs.readFileSync(path.join(w,'index.html'),'utf8');
const ctx={console};ctx.window=ctx;vm.createContext(ctx);vm.runInContext('var SD={};',ctx);
const files=[...idx.matchAll(/<script src="(js\/[^"]+)"/g)].map(m=>m[1]);
files.forEach(f=>{try{vm.runInContext(fs.readFileSync(path.join(w,f),'utf8'),ctx,{filename:f})}catch(e){}});
const SD=ctx.SD;let err=0;const ok=(c,m)=>{if(!c){err++;console.log('NG: '+m)}};
const want=['oc01','oc02','oc03','oc04','oc05','oc06','oc07','oc08'];/* OC-1 で oc01〜oc03、OC-2 で oc04〜oc06、OC-3 で oc07〜oc08 を足す */
const OC=SD.LESSONS.filter(l=>l.course==='OC'),ids=OC.map(l=>l.id),all=new Set(SD.LESSONS.map(l=>l.id)),TN=new Map(SD.TERMS.map(t=>[t.id,t]));
/* 枠・衝突 */
ok(/js\/oc\.js/.test(idx)&&fs.readFileSync(path.join(w,'sw.js'),'utf8').includes('js/oc.js'),'oc.js が index.html と sw.js にある');
ok(SD.CATS.filter(c=>c.course==='OC').length===1&&SD.CATS.some(c=>c.id==='oc1'&&c.chapter==='course'&&c.course==='OC'),'コース OC の枠(cat oc1)が1つだけある');
ok(new Set(SD.CATS.map(c=>c.id)).size===SD.CATS.length,'cat の ID が重複しない');
ok(new Set(SD.TERMS.map(t=>t.id)).size===SD.TERMS.length,'用語の ID が重複しない');
ok(new Set(SD.LESSONS.map(l=>l.id)).size===SD.LESSONS.length,'レッスンの ID が重複しない');
ok(SD.TERMS.filter(t=>/^oc_/.test(t.id)).every(t=>(t.tags||[]).includes('OC')),'oc_ の用語は OC タグ');
ok(SD.TERMS.filter(t=>(t.tags||[]).includes('OC')).every(t=>/^oc_/.test(t.id)||TN.has(t.id)),'OC タグの用語 ID は oc_ で始まる');
ok(want.every(i=>ids.includes(i))&&OC.length>=want.length,'予定のレッスンがそろっている');
/* レッスンの共通検査(0本でも通る。入るたびに効く) */
const txt=l=>JSON.stringify(l.steps),NG=/必ず|絶対|すべて|全て/;
ok(OC.every(l=>l.pre.every(p=>all.has(p))),'pre がすべて実在する');
ok(OC.every(l=>l.pre.every(p=>p>=l.id&&/^oc/.test(p)?false:true)),'OC 内の pre は前の回だけ');
ok(OC.every(l=>(l.terms||[]).every(t=>TN.has(t))),'terms がすべて用語集にある');
ok(OC.every(l=>l.steps.length>=3&&l.steps.length<=5),'手順は 3〜5');
ok(OC.every(l=>l.steps.every(s=>s.b.length<=150)),'本文は 150 字以内: '+OC.map(l=>l.steps.map((s,i)=>s.b.length>150?l.id+' step'+(i+1)+'='+s.b.length:'').filter(Boolean)).flat().join(' '));
ok(OC.every(l=>!/(19|20)\d\d年/.test(txt(l))),'年号なし');
ok(OC.every(l=>!NG.test(txt(l))),'断定の語(必ず・絶対・すべて)を使わない: '+OC.filter(l=>NG.test(txt(l))).map(l=>l.id).join(' '));
ok(OC.every(l=>l.steps.some(s=>s.cmp)),'聞き比べが1回以上ある');
ok(OC.every(l=>l.steps.every(s=>!s.quiz||(s.cmp&&s.quiz.ans>=1&&s.quiz.ans<=s.cmp.length))),'quiz は cmp の番号');
ok(OC.every(l=>l.cat==='oc1'&&l.lv>=2&&l.lv<=3&&SD.CATS.some(c=>c.id===l.cat&&c.course==='OC'&&c.chapter==='course')),'cat は oc1・lv は 2〜3・コースの枠');
ok(OC.every(l=>l.init&&l.init.limCeil===-1&&l.init.limRel===80&&l.init.limLook===2&&l.init.mcOn===1&&l.init.clipOn===0&&l.init.mqOn===0&&l.init.monoBelow===0&&l.init.limTP===0&&l.init.limGain===0&&l.init.outTrim===0),'init の出口は既定値');
/* OC-1 の必須の注意文 */
const L=i=>OC.find(l=>l.id===i),X=i=>L(i)?txt(L(i)):'';
ok(/資格のある業者/.test(X('oc02'))&&/自分で配線をいじらない/.test(X('oc02')),'oc02 に「資格のある業者」「自分で配線をいじらない」');
ok(/近似/.test(X('oc02'))&&/近似/.test(X('oc03')),'体験の回に「近似」');
ok(/分からなくてもよい/.test(X('oc03')),'oc03 に「分からなくてもよい」');
ok(L('oc01')&&L('oc01').steps.some(s=>s.cmp&&s.cmp.length===2&&s.cmp.every(c=>!c.g&&!c.tm&&!c.mt&&JSON.stringify(c.s)===JSON.stringify(s.cmp[0].s))),'oc01 は同一音の聞き比べ');
ok(L('oc02')&&L('oc02').tk.length===6,'oc02 は補助トラック込みで6本');
/* cmp の音量差 1dB 以内(例外: oc03 の小さな差・oc07 の音量差) */
ok(OC.every(l=>['oc03','oc07'].includes(l.id)||l.steps.every(s=>!s.cmp||Math.max(...s.cmp.map(c=>c.g||0))-Math.min(...s.cmp.map(c=>c.g||0))<=1)),'cmp の音量差は 1dB 以内');
ok(L('oc03')&&L('oc03').steps.some(s=>s.quiz&&s.cmp.filter(c=>c.g).length===1),'oc03 は1つだけ違う');
/* OC-2 */
ok(['oc04','oc05','oc06'].every(i=>/近似/.test(X(i))),'oc04〜06 に「近似」');
ok(L('oc04')&&L('oc04').steps.some(s=>(s.mx||[]).length===2)&&L('oc04').steps.some(s=>s.quiz),'oc04 は山を下げる目標とクイズ');
ok(L('oc04')&&L('oc04').tk[0].o.mx.eq.iEqB1g===5&&L('oc04').tk[2].o.mx.eq.iEqB1g===5&&L('oc04').tk[0].o.mx.eq.iEqB1f===100,'oc04 は100Hz・+5dBの山から始まる');
ok(L('oc05')&&L('oc05').steps.some(s=>s.quiz&&s.cmp.length===3)&&/耳を守る|大きな音で高い音を聴かない/.test(X('oc05')),'oc05 のクイズと耳を守る注意');
ok(L('oc06')&&L('oc06').steps.filter(s=>s.quiz).length===2,'oc06 は quiz 2問');
/* OC-3 */
ok(L('oc07')&&/音量を揃えない/.test(X('oc07'))&&/休/.test(X('oc07'))&&L('oc07').steps.some(s=>s.quiz),'oc07 は揃えない旨・休憩・クイズ');
ok(L('oc08')&&L('oc08').kind==='diag'&&L('oc08').lv===3&&L('oc08').save&&L('oc08').save.kind==='kit'&&L('oc08').steps.filter(s=>s.quiz).length===2,'oc08 は diag・lv3・kit 保存・クイズ2問');
ok(L('oc08')&&L('oc08').pre.length===7&&/分からなくてもよい/.test(X('oc08'))&&/押しつけない/.test(X('oc08')),'oc08 は oc01〜07 が前提・注意文');
ok(OC.length===8,'OC は8本');
/* 機材名・メーカー名の疑い(禁止語リスト。見つけたら足していく) */
const BRAND=/Pro-?Ject|Audio-?Technica|Monster|Nordost|Marantz|Accuphase|Technics|McIntosh|Bose|Sennheiser|Neumann|Fender|Marshall|Moog|Roland|Yamaha|Sony|Pioneer/i;
ok(OC.every(l=>!BRAND.test(txt(l))&&!BRAND.test(l.title)),'機材名・メーカー名の疑いの語が無い');
console.log(err?err+'件NG':'oc OK ('+OC.length+'本)');process.exit(err?1:0);
