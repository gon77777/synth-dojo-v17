// 出典: pickle-vox-v80/dynamics-worklet.js から抜き取り(動作は元のまま)。登録名は後で sd- 系に直してよい。
// ---------- リミッター ----------
// ・約2ms先読みして、上限(ceiling)を超えそうな音を、手前から滑らかに下げる(ステレオ連動)
// ・最後に、そのサンプル自身が上限を超えないよう安全に抑える(上限を超えない)
// ・戻りはリリース(ms)で、ゆっくり元に戻す
// ・先読みぶん、約2msの遅れが出る
// ・tp(0/1): 1=サンプルの間の山(インターサンプルピーク)も8倍オーバーサンプルで見て、天井を超えないようにする。既定0=従来(サンプルピーク基準)
// ・gain(dB, 0〜+18): リミッターに入れる前の「押し込み」。既定0=従来どおり(MR-1)
class LimiterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'ceiling', defaultValue: -1, minValue: -24, maxValue: 0, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 80, minValue: 1, maxValue: 2000, automationRate: 'k-rate' },
      { name: 'gain', defaultValue: 0, minValue: 0, maxValue: 18, automationRate: 'k-rate' },
      { name: 'tp', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'look', defaultValue: 2, minValue: 1, maxValue: 5, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    const N = Math.max(8, Math.round(sampleRate * 0.002));
    this.N = N;
    this.bufL = new Float32Array(N);
    this.bufR = new Float32Array(N);
    // 各サンプルが必要とするゲイン。倍精度で持つ: float32 だと丸めで curMin(倍精度)より大きくなり、
    // 「最小だったサンプルが窓から出た」判定が外れて、抑えが解除されなくなることがあった(MR-1 で発見)
    this.req = new Float64Array(N).fill(1);
    this.pos = 0;
    this.curMin = 1;                         // 窓の中の最小ゲイン
    this.g = 1;
    this.atk = 1 - Math.exp(-5 / N);        // 先読みの間に、ほぼ目標まで下げる
    this.minG = 1;
    // トゥルーピーク検出用: 窓つきsinc を8位相(8倍オーバーサンプル)・前後16サンプル。
    // 4位相・前後6サンプルだと、高域の多い音で山を2dBほど低く見積もった(tools/tp-cal.js)
    this.H = new Float64Array(257);
    for (let i = 0; i < 257; i++) { const x = (i - 128) / 8, w = 0.5 + 0.5 * Math.cos(Math.PI * (i - 128) / 129); this.H[i] = (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w; }
    this.th = [new Float64Array(33), new Float64Array(33)];
    this.ti = 0;
    this.reportEvery = Math.max(1, Math.round(sampleRate / 20));
    this.sinceReport = 0;
  }

  // 履歴 h(33)に x を入れ、8位相の絶対値の最大を返す(this.ti は呼ぶ前に進めておく)
  // MR-4: 先読みの長さを変える(バッファを作り直す。まれにしか起きない)
  setN(N) {
    this.N = N; this.bufL = new Float32Array(N); this.bufR = new Float32Array(N);
    this.req = new Float64Array(N).fill(1); this.pos = 0; this.curMin = 1; this.atk = 1 - Math.exp(-5 / N);
  }

  tpush(h, x) {
    h[this.ti] = x;
    const H = this.H; let m = 0;
    for (let p = 0; p < 8; p++) {
      let a = 0;
      for (let k = 0; k < 33; k++) { const v = 8 * k + p; if (v < 257) a += H[v] * h[(this.ti + k) % 33]; }
      a = a < 0 ? -a : a; if (a > m) m = a;
    }
    return m;
  }

  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output.length) return true;
    if (!input || !input.length) return true; // 入力なし: 無音のまま

    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || null;
    const frames = inL.length;
    const ceil = Math.pow(10, params.ceiling[0] / 20);
    const ig = params.gain ? Math.pow(10, params.gain[0] / 20) : 1; // 0dB のときちょうど 1
    const rel = 1 - Math.exp(-1 / Math.max(1, params.release[0] * 0.001 * sampleRate));
    const tpOn = params.tp && params.tp[0] >= 0.5;
    { const Nw = Math.max(8, Math.round(sampleRate * (params.look ? params.look[0] : 2) * 0.001)); if (Nw !== this.N) this.setN(Nw); }
    const N = this.N;
    const bufL = this.bufL;
    const bufR = this.bufR;
    const reqRing = this.req;
    let pos = this.pos;
    let curMin = this.curMin;
    let g = this.g;
    let minG = this.minG;

    for (let i = 0; i < frames; i++) {
      const xL = ig === 1 ? inL[i] : inL[i] * ig;
      const xR = ig === 1 ? inR[i] : inR[i] * ig;
      const oL = bufL[pos];
      const oR = bufR[pos];
      const oldReq = reqRing[pos];

      const a = Math.max(Math.abs(xL), Math.abs(xR));
      const r = a > ceil ? ceil / a : 1;
      bufL[pos] = xL;
      bufR[pos] = xR;
      reqRing[pos] = r;

      // トゥルーピーク: 16サンプル前を中心に、その次のサンプルまでの間の山を見て、その2サンプルの要求ゲインを下げる
      if (tpOn) {
        this.ti = (this.ti + 32) % 33;
        const a2 = Math.max(this.tpush(this.th[0], xL), this.tpush(this.th[1], xR));
        if (a2 > ceil) {
          const rq = ceil / a2;
          for (let d = 15; d <= 16; d++) {
            const q = (pos - d + N) % N;
            if (rq < reqRing[q]) { reqRing[q] = rq; if (rq < curMin) curMin = rq; }
          }
        }
      }

      // 窓(直近 N サンプル)の最小ゲインを更新する
      if (r <= curMin) {
        curMin = r;
      } else if (oldReq <= curMin) {
        // 最小だったサンプルが窓から出ていった: 数え直す
        let m = 1;
        for (let k = 0; k < N; k++) if (reqRing[k] < m) m = reqRing[k];
        curMin = m;
      }

      g += (curMin - g) * (curMin < g ? this.atk : rel);
      // TP モードでは前後2サンプルの要求も見て、ゲインのギザギザで山が出るのを防ぐ
      let rr = oldReq;
      if (tpOn) {
        const r1 = reqRing[(pos + 1) % N], r2 = reqRing[(pos + 2) % N], r0 = reqRing[(pos + N - 1) % N], r3 = reqRing[(pos + N - 2) % N];
        if (r1 < rr) rr = r1; if (r2 < rr) rr = r2; if (r0 < rr) rr = r0; if (r3 < rr) rr = r3;
      }
      const gg = g < rr ? g : rr;
      if (gg < minG) minG = gg;

      outL[i] = oL * gg;
      if (outR) outR[i] = oR * gg;

      pos++;
      if (pos >= N) pos = 0;
    }

    this.pos = pos;
    this.curMin = curMin;
    this.g = g;

    this.sinceReport += frames;
    if (this.sinceReport >= this.reportEvery) {
      this.sinceReport = 0;
      this.port.postMessage({ gr: minG > 0 ? 20 * Math.log10(minG) : -96 });
      minG = 1;
    }
    this.minG = minG;
    return true;
  }
}

registerProcessor('sd-limiter', LimiterProcessor);
