/* MR-6c / G-24: 取り込んだ2ミックス(ステレオ曲)をマスター段だけに通す「MASTERING」の純関数。音は bus.js の mst*。保存しない(メモリだけ) */
var SD=window.SD=window.SD||{};
SD.MST={
 LIM:{sec:300,file:40*1048576},/* 300秒・40MB まで。超えた長さは切り捨て(48kHz ステレオで約 115 MB のメモリ) */
 /* chs=[L(,R)](Float32Array)・sr・name → {ok,L,R,n,sr,name,cut,mono,msg}。1ch は両側に同じ音。3ch 以上は先頭2つだけ */
 prep(chs,sr,name,maxSec){
  if(!chs||!chs.length||!chs[0]||!chs[0].length||!(sr>0))return{ok:false,msg:'音を読み込めませんでした'};
  const mx=Math.floor(sr*(maxSec>0?maxSec:SD.MST.LIM.sec)),n0=chs[0].length,n=Math.min(n0,mx),L=chs[0].subarray(0,n),R=(chs[1]||chs[0]).subarray(0,Math.min(n,(chs[1]||chs[0]).length)),cut=n0>n,mono=!chs[1];
  const nm=String(name||'').replace(/\.[^.]*$/,'').slice(0,24)||'無題';
  return{ok:true,L,R,n,sr,name:nm,cut,mono,msg:(n/sr).toFixed(1)+'秒'+(cut?'(超えた分は切り捨て)':'')+(mono?'(モノラルなので両側に同じ音)':'')}
 },
 /* MR-6d / G-20: 自分のリファレンス。曲全体の積算 LUFS を先に測る(SD.LOUD が無ければ null) */
 lufs(L,R,sr){if(!SD.LOUD||!L||!L.length||!(sr>0))return null;try{const st=SD.LOUD.acc(),f=SD.LOUD.Front(sr,fr=>SD.LOUD.push(st,fr,sr));f.process(L,R||L);const v=SD.LOUD.read(st);return v&&isFinite(v.lufsI)?v.lufsI:null}catch(e){return null}},
 /* 音量を揃える。どちらも下げるだけ(上げるとリミッターの後で割れるため): 大きい方を小さい方に合わせる。mixL・refL が測れないときは null */
 match(mixL,refL){if(typeof mixL!=='number'||typeof refL!=='number'||!isFinite(mixL)||!isFinite(refL))return null;const t=Math.min(mixL,refL),c=v=>Math.max(-24,Math.round(v*10)/10);return{mix:c(t-mixL),ref:c(t-refL),diff:Math.round((refL-mixL)*10)/10}},
 REFSEC:180,
 fmt(s){s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
};
