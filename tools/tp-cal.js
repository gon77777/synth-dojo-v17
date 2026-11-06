// MR-0 / G-09: メーターの TP(4位相の近似)と、細かい基準(16倍・長い窓つきsinc)の差を測る。使い方: node tools/tp-cal.js
const fs=require('fs'),path=require('path');
const SR=48000,procs={};global.sampleRate=SR;
let posted=[];global.AudioWorkletProcessor=class{constructor(){this.port={postMessage:m=>posted.push(m)}}};global.registerProcessor=(n,c)=>{procs[n]=c};
new Function(fs.readFileSync(path.join(__dirname,'..','fx-src','meter.js'),'utf8'))();
function meterTp(x){posted=[];const p=new procs['sd-meter'](),o=[new Float32Array(128),new Float32Array(128)];
 for(let s=0;s+128<=x.length;s+=128)p.process([[x.subarray(s,s+128),x.subarray(s,s+128)]],[o]);return Math.max(...posted.map(m=>m.tp))}
// 基準: 16倍。窓つきsinc 512 taps(片側256)
function refTp(x,R=16,T=256){let m=0;const n=x.length;
 for(let i=T;i<n-T;i++)for(let p=0;p<R;p++){let a=0;const f=p/R;for(let k=-T+1;k<=T;k++){const t=k-f,w=0.5+0.5*Math.cos(Math.PI*t/(T+1)),s=t===0?1:Math.sin(Math.PI*t)/(Math.PI*t);const j=i+k;a+=x[j]*s*w}const v=Math.abs(a);if(v>m)m=v}return m}
const db=v=>20*Math.log10(v);
const N=9600,rnd=(()=>{let s=7;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296*2-1}})();
const norm=x=>{let m=0;x.forEach(v=>m=Math.max(m,Math.abs(v)));return x.map(v=>v/m*.9)};
const sigs={
 'sine fs/4 位相45°':Float32Array.from({length:N},(_,i)=>Math.sin(Math.PI/2*i+Math.PI/4)),
 'sine 0.45fs':Float32Array.from({length:N},(_,i)=>Math.sin(2*Math.PI*.45*i+.3)),
 'sine 0.40fs':Float32Array.from({length:N},(_,i)=>Math.sin(2*Math.PI*.40*i+.6)),
 'sine 10kHz':Float32Array.from({length:N},(_,i)=>Math.sin(2*Math.PI*10000*i/SR+.5)),
 'sine 1kHz':Float32Array.from({length:N},(_,i)=>Math.sin(2*Math.PI*1000*i/SR+.5)),
 '白色ノイズ':Float32Array.from({length:N},rnd),
 'クリップ気味の方形波+LPFなし':Float32Array.from({length:N},(_,i)=>(Math.floor(i/6)%2?1:-1)*.8+(rnd()*.1)),
 '高域多めノイズ':(()=>{const a=Float32Array.from({length:N},rnd);return a.map((v,i)=>i?v-.9*a[i-1]:v)})()};
const rows=[];
Object.keys(sigs).forEach(k=>{const x=Float32Array.from(norm(sigs[k])),a=meterTp(x),b=refTp(x),sp=Math.max(...x.map(Math.abs));
 rows.push({k,sp:db(sp),meter:db(a),ref:db(b),err:db(a)-db(b),isp:db(b)-db(sp)})});
console.log('信号\tSP\tメーターTP\t基準TP\t誤差(メーター-基準)\t基準TP-SP(山の増え)');
rows.forEach(r=>console.log([r.k,r.sp.toFixed(2),r.meter.toFixed(2),r.ref.toFixed(2),r.err.toFixed(2),r.isp.toFixed(2)].join('\t')));
module.exports={rows};
