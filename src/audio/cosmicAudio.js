// ==========================================================================
// COSMIC SYNTHESIZER // WEB AUDIO API PROCEDURAL SPACE AMBIENCE
// ==========================================================================

export class CosmicAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.masterGain = null;

    // 音频节点引用
    this.subOsc1 = null;
    this.subOsc2 = null;
    this.subFilter = null;
    this.noiseNode = null;
    this.noiseFilter = null;
    this.jetOsc = null;
    this.jetGain = null;
    this.lfo = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    // 主音量总控
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // ------------------------------------------------------------------------
    // 1. 视界深空次声波引力共振低音 (Sub-bass Gravitational Hum)
    // ------------------------------------------------------------------------
    this.subOsc1 = this.ctx.createOscillator();
    this.subOsc1.type = 'sawtooth';
    this.subOsc1.frequency.setValueAtTime(43.65, this.ctx.currentTime); // F1 音符

    this.subOsc2 = this.ctx.createOscillator();
    this.subOsc2.type = 'sine';
    this.subOsc2.frequency.setValueAtTime(65.41, this.ctx.currentTime); // C2 音符 (五度和声)

    this.subFilter = this.ctx.createBiquadFilter();
    this.subFilter.type = 'lowpass';
    this.subFilter.frequency.setValueAtTime(120, this.ctx.currentTime);
    this.subFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    this.subOsc1.connect(this.subFilter);
    this.subOsc2.connect(this.subFilter);
    this.subFilter.connect(subGain);
    subGain.connect(this.masterGain);

    // ------------------------------------------------------------------------
    // 2. 吸积盘等离子体流湍流噪音 (Accretion Plasma Noise)
    // ------------------------------------------------------------------------
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02; // 粉红/布朗噪声积分
      lastOut = output[i];
      output[i] *= 3.5;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.setValueAtTime(380, this.ctx.currentTime);
    this.noiseFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    this.noiseNode.connect(this.noiseFilter);
    this.noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // ------------------------------------------------------------------------
    // 3. 喷流高频相对论等离子体脉冲与啸叫 (Relativistic Jet Pulse)
    // ------------------------------------------------------------------------
    this.jetOsc = this.ctx.createOscillator();
    this.jetOsc.type = 'sine';
    this.jetOsc.frequency.setValueAtTime(260, this.ctx.currentTime);

    this.jetGain = this.ctx.createGain();
    this.jetGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    // LFO 慢速脉动调制
    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.setValueAtTime(0.2, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    this.lfo.connect(lfoGain);
    lfoGain.connect(this.jetGain.gain);

    this.jetOsc.connect(this.jetGain);
    this.jetGain.connect(this.masterGain);

    // 启动所有振荡源
    this.subOsc1.start();
    this.subOsc2.start();
    this.noiseNode.start();
    this.jetOsc.start();
    this.lfo.start();
  }

  // 随相机距离和黑洞参数实时更新音色 (包含相对论时间膨胀)
  update(cameraDistance, spin, mass, jetPower, timeDilation = 1.0) {
    if (!this.ctx || !this.isPlaying) return;

    const t = this.ctx.currentTime;
    // 靠近视界时低频共振增强、截止频率随引力红移下降
    const distNorm = Math.max(cameraDistance / 10.0, 0.4);
    const redshiftFactor = 1.0 / Math.min(timeDilation, 4.0);
    const targetSubCutoff = Math.min((240 / distNorm) * redshiftFactor, 450);
    this.subFilter.frequency.setTargetAtTime(targetSubCutoff, t, 0.1);

    // 次低音频段随时间膨胀产生幽深变调
    this.subOsc1.frequency.setTargetAtTime(43.65 * redshiftFactor, t, 0.15);
    this.subOsc2.frequency.setTargetAtTime(65.41 * redshiftFactor, t, 0.15);

    // 自旋提升喷流振荡频率
    const targetJetFreq = (180 + Math.abs(spin) * 160 + jetPower * 40) * redshiftFactor;
    this.jetOsc.frequency.setTargetAtTime(targetJetFreq, t, 0.1);

    // 伴随距离与时间膨胀动态调整总输出响度与压迫感
    const proximityBoost = Math.min(1.8 / distNorm, 1.8);
    this.masterGain.gain.setTargetAtTime(0.4 * proximityBoost, t, 0.1);
  }

  // 触发 LIGO 物理级引力波“啁啾”暴发音效 (Gravitational Wave Chirp Synthesis)
  triggerGravitationalChirp(duration = 2.2) {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;
    
    // 1. 主四极矩振荡器 (Quadrupole Chirp Carrier)
    const chirpOsc1 = this.ctx.createOscillator();
    chirpOsc1.type = 'sine';

    // 2. 次级泛音振荡器 (Higher Harmonic Mode)
    const chirpOsc2 = this.ctx.createOscillator();
    chirpOsc2.type = 'sawtooth';

    // 3. 相对论后牛顿引力波频率扫频曲线: f(t) = f0 * (1 - t/tc)^(-3/8)
    const startFreq = 35.0;
    const peakFreq = 620.0;
    const ringdownFreq = 420.0;

    chirpOsc1.frequency.setValueAtTime(startFreq, t);
    chirpOsc1.frequency.exponentialRampToValueAtTime(peakFreq, t + duration * 0.85);
    chirpOsc1.frequency.exponentialRampToValueAtTime(ringdownFreq, t + duration * 0.95);
    chirpOsc1.frequency.setValueAtTime(20.0, t + duration);

    chirpOsc2.frequency.setValueAtTime(startFreq * 2.0, t);
    chirpOsc2.frequency.exponentialRampToValueAtTime(peakFreq * 2.0, t + duration * 0.85);

    // 4. 振幅包络 (Amp Envelope): 并合前振幅随频率暴增，并合瞬间阻尼归零
    const chirpGain = this.ctx.createGain();
    chirpGain.gain.setValueAtTime(0.01, t);
    chirpGain.gain.exponentialRampToValueAtTime(0.65, t + duration * 0.85);
    chirpGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    // 5. 动态共振滤波器 (Resonant Bandpass Filter)
    const chirpFilter = this.ctx.createBiquadFilter();
    chirpFilter.type = 'bandpass';
    chirpFilter.Q.setValueAtTime(3.5, t);
    chirpFilter.frequency.setValueAtTime(startFreq * 1.5, t);
    chirpFilter.frequency.exponentialRampToValueAtTime(peakFreq * 1.2, t + duration * 0.85);

    // 6. 立体声声场扩展
    let panner = null;
    if (this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(-0.3, t);
      panner.pan.linearRampToValueAtTime(0.3, t + duration * 0.85);
    }

    chirpOsc1.connect(chirpFilter);
    chirpOsc2.connect(chirpFilter);
    chirpFilter.connect(chirpGain);

    if (panner) {
      chirpGain.connect(panner);
      panner.connect(this.ctx.destination);
    } else {
      chirpGain.connect(this.ctx.destination);
    }

    chirpOsc1.start(t);
    chirpOsc2.start(t);
    chirpOsc1.stop(t + duration);
    chirpOsc2.stop(t + duration);
  }

  toggle() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isPlaying = !this.isPlaying;
    const t = this.ctx.currentTime;
    if (this.isPlaying) {
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setTargetAtTime(0.4, t, 0.8);
    } else {
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setTargetAtTime(0.0, t, 0.3);
    }

    return this.isPlaying;
  }
}
