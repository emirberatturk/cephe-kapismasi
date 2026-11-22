// Sentez sesler (WebAudio). Ses dosyası yok, telif derdi yok.
// Hepsi tek bir ana ses + sıkıştırıcıdan geçer, böylece aynı anda çok ses çalsa da patlamaz.
export class Ses {
  constructor() {
    this.ctx = null;
    this.acik = true;
    this.son = new Map(); // aynı sesi çok sık çalma
  }

  hazirla() {
    if (this.ctx) return;
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)();
      const sik = c.createDynamicsCompressor();
      sik.threshold.value = -14;
      sik.ratio.value = 6;
      const ana = c.createGain();
      ana.gain.value = 0.9;
      sik.connect(ana).connect(c.destination);
      this.ctx = c;
      this.cikis = sik;
      this.gurultuTampon = this.gurultuYap(2);
    } catch {
      this.ctx = null;
    }
  }

  gurultuYap(sn) {
    const c = this.ctx;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * sn), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // zarf: hızlı yükselip üstel sönen kazanç
  zarf(t, tepe, sure, atak = 0.004) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(tepe, t + atak);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    return g;
  }

  ton({ frek = 440, bitis = frek, sure = 0.15, tip = 'sine', ses = 0.15, gecikme = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + gecikme;
    const o = c.createOscillator();
    o.type = tip;
    o.frequency.setValueAtTime(frek, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, bitis), t + sure);
    o.connect(this.zarf(t, ses, sure)).connect(this.cikis);
    o.start(t);
    o.stop(t + sure + 0.05);
  }

  // süzgeçli gürültü: tur 'lowpass' | 'highpass' | 'bandpass'; frek → bitisFrek kayar
  gurultu({ sure = 0.3, ses = 0.3, tur = 'lowpass', frek = 2000, bitisFrek = frek, q = 0.7, gecikme = 0, atak = 0.004 }) {
    const c = this.ctx;
    const t = c.currentTime + gecikme;
    const kaynak = c.createBufferSource();
    kaynak.buffer = this.gurultuTampon;
    const suz = c.createBiquadFilter();
    suz.type = tur;
    suz.Q.value = q;
    suz.frequency.setValueAtTime(frek, t);
    suz.frequency.exponentialRampToValueAtTime(Math.max(30, bitisFrek), t + sure);
    kaynak.connect(suz).connect(this.zarf(t, ses, sure, atak)).connect(this.cikis);
    kaynak.start(t, Math.random() * 0.5);
    kaynak.stop(t + sure + 0.05);
  }

  cal(ad, gecikme = 0) {
    if (!this.acik) return;
    this.hazirla();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const simdi = performance.now() + gecikme * 1000;
    const aralik = { giris: 90, kilic: 70, kalkan: 100, kirik: 80 }[ad] ?? 0;
    if (simdi - (this.son.get(ad) || 0) < aralik) return;
    this.son.set(ad, simdi);
    const g = gecikme;
    switch (ad) {
      case 'giris':
        this.ton({ frek: 520, bitis: 880, sure: 0.09, tip: 'triangle', ses: 0.06, gecikme: g });
        break;
      case 'kilic': // metal çınlaması
        this.ton({ frek: 2600, bitis: 2400, sure: 0.12, tip: 'square', ses: 0.018, gecikme: g });
        this.ton({ frek: 3900, bitis: 3600, sure: 0.09, tip: 'square', ses: 0.012, gecikme: g });
        this.gurultu({ sure: 0.05, ses: 0.05, tur: 'highpass', frek: 3000, gecikme: g });
        break;
      case 'kalkan':
        this.ton({ frek: 300, bitis: 900, sure: 0.25, tip: 'triangle', ses: 0.09, gecikme: g });
        break;
      case 'kirik':
        this.gurultu({ sure: 0.18, ses: 0.18, tur: 'highpass', frek: 2500, gecikme: g });
        this.ton({ frek: 1400, bitis: 500, sure: 0.15, ses: 0.06, gecikme: g });
        break;
      case 'tufek': // keskin patlama + gövde gümlemesi + kısa yankı
        this.gurultu({ sure: 0.09, ses: 0.55, tur: 'highpass', frek: 900, bitisFrek: 400, gecikme: g, atak: 0.001 });
        this.gurultu({ sure: 0.22, ses: 0.35, tur: 'lowpass', frek: 1800, bitisFrek: 200, gecikme: g, atak: 0.001 });
        this.ton({ frek: 150, bitis: 45, sure: 0.16, tip: 'sine', ses: 0.4, gecikme: g });
        this.gurultu({ sure: 0.35, ses: 0.06, tur: 'bandpass', frek: 1200, bitisFrek: 600, q: 1.2, gecikme: g + 0.09 });
        break;
      case 'firlat': // fitil ıslığı
        this.ton({ frek: 1400, bitis: 500, sure: 0.5, tip: 'sine', ses: 0.05, gecikme: g });
        this.gurultu({ sure: 0.5, ses: 0.05, tur: 'bandpass', frek: 3000, bitisFrek: 1500, q: 2, gecikme: g });
        break;
      case 'patlama': // büyük patlama: çatlama + gürleme + derin sarsıntı
        this.gurultu({ sure: 0.15, ses: 0.7, tur: 'highpass', frek: 1200, bitisFrek: 300, gecikme: g, atak: 0.001 });
        this.gurultu({ sure: 1.6, ses: 0.8, tur: 'lowpass', frek: 2400, bitisFrek: 90, gecikme: g, atak: 0.002 });
        this.ton({ frek: 90, bitis: 28, sure: 0.9, tip: 'sine', ses: 0.8, gecikme: g });
        this.gurultu({ sure: 1.4, ses: 0.25, tur: 'lowpass', frek: 300, bitisFrek: 60, gecikme: g + 0.25 });
        break;
      case 'kukreme': { // ejderha kükremesi: titreşimli testere dalga
        const c = this.ctx;
        const t = c.currentTime + g;
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(70, t + 1.1);
        const lfo = c.createOscillator();
        lfo.frequency.value = 22;
        const lfoKazanc = c.createGain();
        lfoKazanc.gain.value = 18;
        lfo.connect(lfoKazanc).connect(o.frequency);
        const suz = c.createBiquadFilter();
        suz.type = 'lowpass';
        suz.frequency.value = 900;
        o.connect(suz).connect(this.zarf(t, 0.35, 1.2, 0.08)).connect(this.cikis);
        o.start(t);
        lfo.start(t);
        o.stop(t + 1.3);
        lfo.stop(t + 1.3);
        this.gurultu({ sure: 1.1, ses: 0.25, tur: 'lowpass', frek: 700, bitisFrek: 200, gecikme: g, atak: 0.08 });
        break;
      }
      case 'alev': // alev püskürtme hışırtısı
        this.gurultu({ sure: 1.6, ses: 0.45, tur: 'bandpass', frek: 900, bitisFrek: 1600, q: 0.6, gecikme: g, atak: 0.15 });
        this.gurultu({ sure: 1.6, ses: 0.3, tur: 'lowpass', frek: 500, bitisFrek: 250, gecikme: g, atak: 0.1 });
        break;
      case 'hedef':
        [660, 880, 1320].forEach((f, i) => this.ton({ frek: f, sure: 0.18, tip: 'triangle', ses: 0.1, gecikme: g + i * 0.08 }));
        break;
      case 'alarm':
        [0, 0.25, 0.5].forEach((d) => this.ton({ frek: 880, bitis: 660, sure: 0.18, tip: 'square', ses: 0.05, gecikme: g + d }));
        break;
      case 'turSonu':
        [523, 659, 784, 1046].forEach((f, i) => this.ton({ frek: f, sure: 0.25, tip: 'triangle', ses: 0.12, gecikme: g + i * 0.12 }));
        break;
      default:
    }
  }
}
