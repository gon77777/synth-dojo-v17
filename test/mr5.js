/* MR-5: MR コース(レッスン本文)の構造検査。node test/mr5.js */
const fs=require('fs'),path=require('path'),vm=require('vm');
const w=path.join(__dirname,'..','www'),idx=fs.readFileSync(path.join(w,'index.html'),'utf8');
const ctx={console};ctx.window=ctx;vm.createContext(ctx);vm.runInContext('var SD={};',ctx);
const files=[...idx.matchAll(/<script src="(js\/[^"]+)"/g)].map(m=>m[1]);
files.forEach(f=>{try{vm.runInContext(fs.readFileSync(path.join(w,f),'utf8'),ctx,{filename:f})}catch(e){}});
const SD=ctx.SD;let err=0;const ok=(c,m)=>{if(!c){err++;console.log('NG: '+m)}};
const MR=SD.LESSONS.filter(l=>l.course==='MR'),ids=MR.map(l=>l.id),all=new Set(SD.LESSONS.map(l=>l.id)),TN=new Map(SD.TERMS.map(t=>[t.id,t]));
const want=['mr01','mr02','mr03','mr04','mr05','mr06','mr07','mr08','mr09','mr10','mr11','mr12','mr13','mr14','mr15','mr16','mr17','mr18','mr19','mr20','mr21','mr22','mr23','mr24','mr25','mr26','mr27'],cat=id=>+id.slice(2)<=6?'mr1':+id.slice(2)<=15?'mr2':+id.slice(2)<=24?'mr3':'mr4';
ok(want.every(i=>ids.includes(i))&&MR.length>=want.length,'mr01〜mr19 がある');
ok(MR.every(l=>l.pre.every(p=>all.has(p))),'pre がすべて実在する');
ok(MR.every(l=>l.pre.every(p=>p>=l.id&&/^mr/.test(p)?false:true)),'MR 内の pre は前の回だけ');
ok(MR.every(l=>(l.terms||[]).every(t=>TN.has(t))),'terms がすべて用語集にある');
ok(['mr_master','mr_ceil','mr_gain','mr_mc','mr_ms','mr_clipper','mr_look','mr_psr','mr_dr','mr_norm','mr_dither','mr_lossy'].every(i=>TN.has(i)&&TN.get(i).see.length&&TN.get(i).tags.includes('MR')),'MR の用語12語');
ok(MR.every(l=>l.steps.length>=3&&l.steps.length<=5),'手順は 3〜5');
ok(MR.every(l=>l.steps.every(s=>s.b.length<=150)),'本文は 150 字以内: '+MR.map(l=>l.steps.map((s,i)=>s.b.length>150?l.id+' step'+(i+1)+'='+s.b.length:'').filter(Boolean)).flat().join(' '));
ok(MR.every(l=>!/(19|20)\d\d年/.test(JSON.stringify(l.steps))),'年号なし');
ok(MR.every(l=>l.steps.some(s=>s.cmp)),'聞き比べが1回以上ある');
ok(MR.every(l=>l.steps.every(s=>!s.quiz||(s.cmp&&s.quiz.ans>=1&&s.quiz.ans<=s.cmp.length))),'quiz は cmp の番号');
ok(MR.every(l=>l.cat===cat(l.id)&&l.lv>=2&&l.lv<=3&&SD.CATS.some(c=>c.id===l.cat&&c.course==='MR'&&c.chapter==='course')),'cat は初級 mr1・中級 mr2・上級 mr3・発展 mr4・コースの枠');
/* 初級の合格条件(案。未測定) */
const mt=i=>(SD.LESSONS.find(l=>l.id===i).steps.map(s=>s.mt).filter(Boolean).flat());
ok(mt('mr03')[0].m==='grLim'&&mt('mr04')[0].m==='lufsS'&&mt('mr05')[0].m==='tp'&&mt('mr06')[0].m==='grLim','mr03〜mr06 の測定目標');
ok(mt('mr04')[0].rng[0]===-15&&mt('mr04')[0].rng[1]===-13,'mr04 は配信向けの目安 -14 の前後');
/* init は前の回の設定を持ち越さない(出口は既定値) */
ok(MR.every(l=>(l.init.limCeil===-1||l.id==='mr24'&&l.init.limCeil===-.1)&&l.init.limRel===80&&l.init.limLook===2&&l.init.mcOn===1&&l.init.clipOn===0&&l.init.mqOn===0&&l.init.monoBelow===0&&l.init.limTP===0),'init の出口は既定値');
ok(SD.LESSONS.find(l=>l.id==='mr03').init.outTrim===6&&SD.LESSONS.find(l=>l.id==='mr05').init.limGain===6,'mr03 は OUT TRIM +6・mr05 は GAIN +6 から始める');
/* 中級の前半(mr07〜11)の設定 */
const st=(i,k)=>SD.LESSONS.find(l=>l.id===i).steps.map(x=>x[k]).filter(Boolean).flat();
const txt=i=>JSON.stringify(SD.LESSONS.find(l=>l.id===i).steps);
ok(st('mr07','f').some(f=>f[0]==='mcThr'&&f[1]===-24)&&st('mr08','f').some(f=>f[0]==='limRel'&&f[1]===100)&&SD.LESSONS.find(l=>l.id==='mr08').init.limGain===8,'mr07 出口コンプ・mr08 リリース(GAIN +8 から)');
ok(st('mr09','f').every(f=>/^mq/.test(f[0])&&(f[0]!=='mqLoG'&&f[0]!=='mqHiG'||Math.abs(f[1])<=2)),'mr09 は MASTER EQ のみ・シェルフは ±2 dB 以内');
ok(st('mr10','f').some(f=>f[0]==='mqHpf'&&f[1]===30)&&st('mr11','f').some(f=>f[0]==='mqM2F'&&f[1]===5000),'mr10 HPF 30 Hz・mr11 BELL2 5 kHz');
ok(SD.LESSONS.find(l=>l.id==='mr10').tk.length===5&&SD.LESSONS.find(l=>l.id==='mr11').tk.length===5,'mr10・mr11 は問題つきミックス(5トラック)');
/* 中級の後半(mr12〜15) */
ok(st('mr12','mt')[0].m==='corr'&&st('mr12','mx').length===2&&st('mr13','f').some(f=>f[0]==='monoBelow'&&f[1]===120),'mr12 相関・mr13 MONO BELOW 120 Hz');
ok(st('mr15','f').some(f=>f[0]==='limTP'&&f[1]===1)&&st('mr15','mt')[0].m==='tp'&&SD.LESSONS.find(l=>l.id==='mr15').init.limGain===8,'mr15 TRUE PEAK ON・天井・TP の目標');
ok(txt('mr15').includes('完全に守れるとは限らない')&&txt('mr15').includes('近似'),'mr15 は「完全に守る」と書かない・近似を書く');
ok(['mr12','mr13'].every(i=>SD.LESSONS.find(l=>l.id===i).tk.length===5),'mr12・mr13 は問題つきミックス');
/* 上級の前半(mr16〜19) */
ok(st('mr16','f').some(f=>f[0]==='mqMode'&&f[1]===1)&&st('mr16','f').some(f=>f[0]==='mqMode'&&f[1]===2)&&st('mr16','mt')[0].m==='corr','mr16 MID/SIDE の切替・corr');
ok(st('mr17','f').some(f=>f[0]==='clipOn'&&f[1]===1)&&st('mr17','mt')[0].m==='grLim'&&SD.LESSONS.find(l=>l.id==='mr17').init.limGain===8,'mr17 クリッパー ON・grLim(GAIN +8 から)');
ok(st('mr18','f').some(f=>f[0]==='limLook'&&f[1]===2)&&SD.LESSONS.find(l=>l.id==='mr18').steps.some(s=>s.cmp&&s.cmp.length===3)&&txt('mr18').includes('分からなくても'),'mr18 先読み 1/2/5 ms・「分からなくても」');
ok(st('mr19','mt').map(g=>g.m).join()==='psr,crest'&&txt('mr19').includes('目安'),'mr19 PSR・CREST の複合目標');
/* 上級の後半(mr20〜23) */
ok(txt('mr20').includes('戻らない')===false&&txt('mr20').includes('作る側の目標ではない')&&st('mr21','mt').map(g=>g.m).join()==='lufsS,tp,psr'&&txt('mr21').includes('そのまま使わず'),'mr20 聴く側の設定・mr21 3指標の複合');
ok(txt('mr22').includes('OFFに戻す')&&st('mr22','cmp').length>=1&&st('mr23','mt')[0].m==='lufsS'&&txt('mr23').includes('MR27'),'mr22 確認後は OFF・mr23 lufsS と予告');
/* 総合課題 mr24 */
ok(SD.MR_RAW&&SD.MR_RAW.length===5&&SD.LESSONS.find(l=>l.id==='mr24').tk.length===5&&st('mr24','mt').map(g=>g.m).join()==='lufsS,tp,corr,psr'&&st('mr24','mt').every(g=>g.hold===5)&&txt('mr24').includes('正解は1つではない'),'mr24 専用ミックス・4指標の複合 hold 5');
/* 発展(mr25〜27)の注意文 */
ok(txt('mr25').includes('最大180秒')&&txt('mr25').includes('ノイズシェイピングは無く')&&txt('mr25').includes('BYPASS'),'mr25 REC の限界・BYPASS');
ok(txt('mr26').includes('近似')&&txt('mr26').includes('再現しない')&&txt('mr26').includes('OFFに戻す'),'mr26 近似・再現しない・OFFに戻す');
ok(txt('mr27').includes('権利を持つ')&&txt('mr27').includes('メモリだけ')&&txt('mr27').includes('保存されず')&&txt('mr27').includes('基準であり、正解ではない')&&txt('mr27').includes('マスター段を通らない'),'mr27 権利・メモリだけ・REF は基準');
/* 近似・未測定の注意が本文にあること */
ok(txt('mr05').includes('近似')&&txt('mr04').includes('目安')&&txt('mr02').includes('OFFに戻る'),'近似・目安・BYPASS の注意');
ok(/js\/mr\.js/.test(idx)&&fs.readFileSync(path.join(w,'sw.js'),'utf8').includes('js/mr.js'),'mr.js が index.html と sw.js にある');
console.log(err?err+'件NG':'mr5 OK ('+MR.length+'本)');process.exit(err?1:0);
