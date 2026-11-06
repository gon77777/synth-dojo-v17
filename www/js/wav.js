/* MR-6a / G-22・G-23: 録音したマスター出力を WAV(16/24 bit)にする純関数。ディザ=TPDF(±1 LSB)。音は bus.js の recOn/recOff が集める */
var SD=window.SD=window.SD||{};
SD.WAV={
 MAXSEC:180,/* メモリのため。48kHz ステレオで約 70 MB(Float32) */
 rng(seed){let s=(seed>>>0)||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}},
 /* 1サンプルを整数にする。dither のとき TPDF(2つの一様乱数の差)を足してから丸める。範囲外は飽和 */
 quant(x,bits,dither,r){const q=bits===24?8388607:32767;let v=(x>1?1:x<-1?-1:x||0)*q;if(dither&&r)v+=r()-r();v=Math.round(v);return v>q?q:v<-q-1?-q-1:v},
 join(chunks,n){const o=new Float32Array(n);let p=0;for(const c of chunks){if(p+c.length>n){o.set(c.subarray(0,n-p),p);p=n;break}o.set(c,p);p+=c.length}return o},
 peak(L,R){let m=0;for(let i=0;i<L.length;i++){const a=Math.abs(L[i]),b=Math.abs(R[i]);if(a>m)m=a;if(b>m)m=b}return m},
 /* L・R は同じ長さの Float32Array。戻り値は WAV のバイト列(Uint8Array)。bits は 16 か 24 */
 encode(L,R,sr,bits,dither,seed){
  bits=bits===24?24:16;const n=Math.min(L.length,R.length),bp=bits/8,ba=2*bp,dl=n*ba,u=new Uint8Array(44+dl),d=new DataView(u.buffer),w=(o,s)=>{for(let i=0;i<s.length;i++)u[o+i]=s.charCodeAt(i)};
  w(0,'RIFF');d.setUint32(4,36+dl,true);w(8,'WAVE');w(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,2,true);d.setUint32(24,sr,true);d.setUint32(28,sr*ba,true);d.setUint16(32,ba,true);d.setUint16(34,bits,true);w(36,'data');d.setUint32(40,dl,true);
  const r=dither?SD.WAV.rng(seed==null?12345:seed):null,Q=SD.WAV.quant;let o=44;
  for(let i=0;i<n;i++){for(let c=0;c<2;c++){const v=Q(c?R[i]:L[i],bits,dither,r);if(bits===16){d.setInt16(o,v,true);o+=2}else{u[o]=v&255;u[o+1]=(v>>8)&255;u[o+2]=(v>>16)&255;o+=3}}}
  return u},
 b64(u){let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)}
};
