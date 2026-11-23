// Futbol Kupası: çizim (1080 x 1920 dikey). Motorun durumunu her karede okur, fx kuyruğunu efekte çevirir.
import { SAHA, HAVALAR, SURPRIZLER, OZELLER, turAdi } from './motor.js';

const G = 1080;
const YAZI = 'system-ui, "Segoe UI", Roboto, sans-serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
// saha yerleşimi (piksel)
const SX0 = 50;
const SY0 = 596;
const OLC = 980 / SAHA.u; // metre başına piksel
const SW = SAHA.u * OLC;
const SH = SAHA.g * OLC;
const sx = (x) => SX0 + x * OLC;
const sy = (y) => SY0 + y * OLC;
const OY = SAHA.g / 2;

const ORNEK = {
  koruma: { ad: 'Kalp', jeton: 10, emoji: '❤️' },
  superSut: { ad: 'Donat', jeton: 30, emoji: '🍩' },
  penalti: { ad: 'Elle Kalp', jeton: 100, emoji: '🫶' },
  gol: { ad: 'Elmas aşk yüzüğü', jeton: 300, emoji: '💍' },
};

const kisalt = (s, n) => {
  const h = Array.from(String(s ?? ''));
  return h.length > n ? h.slice(0, n - 1).join('') + '…' : h.join('');
};
const buyuk = (s) => String(s ?? '').toLocaleUpperCase('tr-TR');
const sureYaz = (sn) => {
  const s = Math.max(0, Math.ceil(sn));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
function rgb(hex) {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const seffaf = (hex, a) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
const koyu = (hex, o) => {
  const [r, g, b] = rgb(hex);
  return `rgb(${Math.round(r * o)},${Math.round(g * o)},${Math.round(b * o)})`;
};
const parlaklik = (hex) => {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
const yaziRengi = (hex) => (parlaklik(hex) > 0.62 ? '#111827' : '#ffffff');
const renkFarki = (a, b) => {
  const x = rgb(a);
  const y = rgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

// Renkleri çok benzeyen takımlarda deplasman takımı ikinci rengini giyer
export function formalar(t0, t1) {
  const a = { ana: t0.renk, iki: t0.renk2 };
  let b = { ana: t1.renk, iki: t1.renk2 };
  if (renkFarki(a.ana, b.ana) < 130) b = { ana: t1.renk2, iki: t1.renk };
  return [a, b];
}

export class FutbolCizim {
  constructor(canvas, motor) {
    this.c = canvas;
    this.x = canvas.getContext('2d');
    this.motor = motor;
    this.zaman = 0;
    this.fotolar = new Map();
    this.katalog = new Map();
    this.katalogListe = [];
    this.demoAcik = false;
    this.baglantiYok = false;
    this.sesCal = () => {};
    this.olayDinle = null; // spiker gibi dinleyiciler her fx olayını görür
    this.sahaResmi = null;
    this.temizle();
  }

  temizle() {
    this.parcaciklar = [];
    this.bildirimler = [];
    this.kartlar = [];
    this.akis = [];
    this.yazilar = [];
    this.konusma = new Map();
    this.golGosterim = null;
    this.agSalla = null;
    this.sarsinti = 0;
    this.flas = 0;
    this.hedefParlama = 0;
    this.havaParca = [];
    this.havaTur = '';
  }

  katalogGuncelle(liste) {
    if (!Array.isArray(liste)) return;
    for (const h of liste) {
      if (h && typeof h.ad === 'string' && typeof h.resim === 'string' && h.resim) this.katalog.set(h.ad.toLocaleLowerCase('tr-TR'), h.resim);
    }
    this.katalogListe = liste.filter((h) => h && typeof h.ad === 'string' && Number.isFinite(h.jeton));
  }

  hediyeResmi(ad) {
    return this.katalog.get(String(ad || '').toLocaleLowerCase('tr-TR')) || '';
  }

  kitler() {
    return formalar(this.motor.takim(0), this.motor.takim(1));
  }

  oyuncuBilgi(id) {
    const o = id ? this.motor.oyuncular.get(id) : null;
    if (!o) return { ad: '', foto: '', taraf: -1, bot: false };
    return { ad: this.motor.adGoster(o), foto: o.bot ? '' : this.motor.fotoGoster(o), taraf: o.taraf, bot: Boolean(o.bot), gol: o.gol };
  }

  konum(id) {
    const o = this.motor.oyuncular.get(id);
    if (o?.saha) return { x: o.saha.x, y: o.saha.y };
    return { x: SAHA.u / 2, y: OY };
  }

  // ------------------------------------------------------------ fx kuyruğu
  fxIsle() {
    const m = this.motor;
    const kit = this.kitler();
    for (const f of m.fx.splice(0)) {
      if (this.olayDinle) {
        try { this.olayDinle(f); } catch { /* spiker hatası oyunu durdurmasın */ }
      }
      switch (f.tip) {
        case 'macKuruldu':
          this.parcaciklar = [];
          this.yazilar = [];
          this.golGosterim = null;
          this.kartlar = [];
          break;
        case 'giris': {
          const k = this.konum(f.id);
          this.puf(k.x, k.y, '#ffffff', 6);
          this.sesCal('giris');
          break;
        }
        case 'botCikti': {
          const k = this.konum(f.id);
          this.puf(k.x, k.y, '#94a3b8', 5);
          break;
        }
        case 'akis': {
          const renk = f.renk || (f.taraf === 0 || f.taraf === 1 ? kit[f.taraf].ana : '#e2e8f0');
          this.akis.unshift({ metin: f.metin, renk, yas: 0, onemli: Boolean(f.onemli) });
          if (this.akis.length > 12) this.akis.pop();
          break;
        }
        case 'bildirim':
          this.bildirimler.push({ metin: f.metin, renk: f.renk || '#fff', sure: f.sure || 2.2, yas: 0 });
          if (this.bildirimler.length > 3) this.bildirimler.shift();
          break;
        case 'kalp': {
          if (this.parcaciklar.filter((p) => p.tip === 'kalp').length > 50) break;
          const k = this.konum(f.id);
          this.parcaciklar.push({ tip: 'kalp', x: sx(k.x), y: sy(k.y) - 30, vx: (Math.random() - 0.5) * 30, vy: -70, yas: 0, omur: 1.1, boy: 22 });
          break;
        }
        case 'konus':
          this.konusma.set(f.id, this.zaman + 1.6);
          break;
        case 'gucHediye': {
          const k = this.konum(f.id);
          this.kivilcim(k.x, k.y, '#fbbf24', 14);
          break;
        }
        case 'superHazir': {
          const k = this.konum(f.id);
          this.kivilcim(k.x, k.y, '#f97316', 26);
          this.sesCal('kalkan');
          break;
        }
        case 'sut': {
          const k = this.konum(f.id);
          this.puf(k.x, k.y, '#d9f99d', 4);
          this.sesCal(f.super ? 'superSut' : 'sut');
          if (f.super) this.sarsinti = Math.max(this.sarsinti, 6);
          break;
        }
        case 'roket':
          this.sesCal('superSut');
          this.flas = Math.max(this.flas, 0.35);
          this.sarsinti = Math.max(this.sarsinti, 8);
          break;
        case 'kurtaris': {
          const k = f.id ? this.konum(f.id) : { x: 0, y: OY };
          if (f.koruma) {
            // kesin kurtarış hakkı kullanıldı: hakkı veren izleyicinin adı ekranda
            this.yaziEkle(`🧤 ${kisalt(f.koruma, 14)} sayesinde!`, k.x, k.y, '#67e8f9', 34);
            this.bildirimler.push({ metin: `🧤 KORUMA DEVREDE! ${kisalt(f.koruma, 16)} sayesinde kurtarış`, renk: '#67e8f9', sure: 2.6, yas: 0, buyuk: true });
            if (this.bildirimler.length > 3) this.bildirimler.shift();
            this.kivilcim(k.x, k.y, '#22d3ee', 30);
            this.sesCal('kurtaris');
            this.sesCal('hedef', 0.1);
            break;
          }
          this.yaziEkle(f.penalti ? 'KURTARDI! 🧤' : 'KURTARIŞ! 🧤', k.x, k.y, '#fde68a', f.penalti ? 46 : 32);
          this.sesCal('kurtaris');
          if (f.penalti) this.sesCal('tezahurat');
          break;
        }
        case 'koruma': {
          const kal = this.motor.kaleci(f.taraf);
          if (kal) this.kivilcim(kal.saha.x, kal.saha.y, '#22d3ee', 22);
          this.sesCal('kalkan');
          break;
        }
        case 'degisti': {
          const k = this.konum(f.id);
          this.puf(k.x, k.y, '#ffffff', 6);
          break;
        }
        case 'direk':
          this.yaziEkle('DİREK!', f.x, f.y, '#ffffff', 36);
          this.sesCal('direk');
          this.sesCal('tezahurat', 0.1);
          break;
        case 'kacti':
          this.yaziEkle('AZ FARKLA DIŞARI!', f.x, f.y, '#e2e8f0', 30);
          this.sesCal('tezahurat');
          break;
        case 'mudahale': {
          const k = this.konum(f.id);
          this.puf(k.x, k.y, '#a3e635', 4);
          break;
        }
        case 'gol': {
          const b = this.oyuncuBilgi(f.id);
          this.golGosterim = { ...f, foto: b.foto, yas: 0 };
          this.agSalla = { taraf: f.taraf, yas: 0 };
          const gx = f.taraf === 0 ? SAHA.u : 0;
          for (let i = 0; i < 90; i++) this.konfeti(sx(gx), sy(OY), [kit[f.taraf].ana, kit[f.taraf].iki, '#ffffff'], 520);
          this.flas = Math.max(this.flas, 0.5);
          this.sarsinti = Math.max(this.sarsinti, 10);
          this.sesCal('gol');
          break;
        }
        case 'santra':
        case 'macBasladi':
        case 'devre':
        case 'penalti':
          this.sesCal('duduk');
          break;
        case 'macSonu':
          this.sesCal('uzunDuduk');
          break;
        case 'seriBasladi':
          this.sesCal('uzunDuduk');
          break;
        case 'seriAtis':
          this.sesCal('sut', 0.95);
          break;
        case 'seriSonuc':
          if (f.koruma) this.bildirimler.push({ metin: `🧤 KORUMA! ${kisalt(f.koruma, 16)} sayesinde kurtarış`, renk: '#67e8f9', sure: 2, yas: 0 });
          this.sesCal(f.gol ? 'hedef' : 'tezahurat');
          if (f.gol) {
            const gx = f.taraf === 0 ? SAHA.u : 0;
            for (let i = 0; i < 30; i++) this.konfeti(sx(gx), sy(OY), [kit[f.taraf].ana, kit[f.taraf].iki], 380);
          }
          break;
        case 'surpriz': {
          const s = SURPRIZLER[f.tur];
          this.bildirimler.push({ metin: `${s.ikon} ${s.ad}`, renk: '#fde047', sure: 2.6, yas: 0, buyuk: true });
          this.sesCal(f.tur === 'kopek' ? 'havlama' : 'alarm');
          break;
        }
        case 'patlak':
          for (let i = 0; i < 26; i++) {
            const a = Math.random() * Math.PI * 2;
            const h = 80 + Math.random() * 260;
            this.parcaciklar.push({ tip: 'daire', x: sx(f.x), y: sy(f.y), vx: Math.cos(a) * h, vy: Math.sin(a) * h, yas: 0, omur: 0.6, boy: 5, renk: i % 2 ? '#ffffff' : '#111827' });
          }
          this.sesCal('patlama');
          break;
        case 'kopekKapti':
          this.sesCal('havlama');
          break;
        case 'cilgin':
          this.sesCal('hedef');
          for (let i = 0; i < 60; i++) this.konfeti(G / 2, SY0 + 40, ['#f9a8d4', '#ffffff', '#f472b6'], 420);
          break;
        case 'hedef':
          this.hedefParlama = 1.2;
          this.sesCal('hedef');
          break;
        case 'kart': {
          const b = this.oyuncuBilgi(f.id);
          this.kartlar.push({ ozel: f.ozel, ad: b.ad, foto: b.foto, taraf: f.taraf, hediye: f.hediye, birikim: f.birikim, yas: 0 });
          if (this.kartlar.length > 2) this.kartlar.shift();
          break;
        }
        case 'kupaSonu':
          this.sesCal('turSonu');
          this.sesCal('gol', 0.3);
          break;
        default:
      }
    }
  }

  puf(x, y, renk, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const h = 30 + Math.random() * 60;
      this.parcaciklar.push({ tip: 'daire', x: sx(x), y: sy(y), vx: Math.cos(a) * h, vy: Math.sin(a) * h, yas: 0, omur: 0.45, boy: 4 + Math.random() * 4, renk });
    }
  }

  kivilcim(x, y, renk, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const h = 60 + Math.random() * 160;
      this.parcaciklar.push({ tip: 'kivilcim', x: sx(x), y: sy(y), vx: Math.cos(a) * h, vy: Math.sin(a) * h - 40, yas: 0, omur: 0.7, boy: 3 + Math.random() * 3, renk });
    }
  }

  konfeti(x, y, renkler, hiz) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const h = hiz * (0.4 + Math.random() * 0.8);
    this.parcaciklar.push({
      tip: 'kare', x, y, vx: Math.cos(a) * h, vy: Math.sin(a) * h, yas: 0, omur: 2.2 + Math.random(), boy: 8 + Math.random() * 8,
      renk: renkler[Math.floor(Math.random() * renkler.length)], donus: Math.random() * 6, yercekimi: 420,
    });
  }

  yaziEkle(metin, x, y, renk, boy) {
    this.yazilar.push({ metin, x, y, renk, boy, yas: 0 });
    if (this.yazilar.length > 6) this.yazilar.shift();
  }

  // ------------------------------------------------------------ ana çizim
  ciz(dt) {
    this.zaman += dt;
    this.fxIsle();
    const x = this.x;
    const m = this.motor;
    x.save();
    if (this.sarsinti > 0.2) {
      x.translate((Math.random() - 0.5) * this.sarsinti, (Math.random() - 0.5) * this.sarsinti);
      this.sarsinti *= Math.exp(-dt * 7);
    }
    this.arkaPlan();
    this.baslik();
    this.skorTablosu();
    this.gucCubugu();
    this.golKrallariCiz();
    this.bilgiSatiri();
    this.hediyeSatiri();
    this.sahaCiz(dt);
    this.sahaAlti();
    this.akisCiz(dt);
    this.fiksturCiz();
    this.parcaciklariCiz(dt);
    if (m.asama === 'gol') this.golEkrani(dt);
    if (m.asama === 'seri') this.seriTablosu();
    if (m.asama === 'hazirlik') this.hazirlikEkrani();
    if (m.asama === 'ara') this.araEkrani();
    if (m.asama === 'kupaSonu') this.kupaEkrani(dt);
    if (m.asama === 'duraklat') this.perde('⏸️ DURAKLATILDI');
    this.kartlariCiz(dt);
    this.bildirimleriCiz(dt);
    if (this.flas > 0) {
      x.fillStyle = `rgba(255,255,255,${Math.min(0.6, this.flas)})`;
      x.fillRect(0, 0, G, 1920);
      this.flas -= dt * 1.6;
    }
    if (this.demoAcik || m.demoVerisi) this.demoFiligran();
    if (this.baglantiYok) this.baglantiUyarisi();
    x.restore();
  }

  arkaPlan() {
    const x = this.x;
    const g = x.createLinearGradient(0, 0, 0, 1920);
    g.addColorStop(0, '#0b1322');
    g.addColorStop(0.45, '#071a10');
    g.addColorStop(1, '#03070b');
    x.fillStyle = g;
    x.fillRect(0, 0, G, 1920);
    // stadyum ışıkları
    for (const lx of [140, 940]) {
      const r = x.createRadialGradient(lx, 30, 0, lx, 30, 420);
      r.addColorStop(0, 'rgba(255,255,255,0.10)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = r;
      x.fillRect(0, 0, G, 500);
    }
  }

  baslik() {
    const x = this.x;
    const m = this.motor;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `900 40px ${YAZI}, ${EMOJI}`;
    x.lineWidth = 6;
    x.strokeStyle = 'rgba(0,0,0,0.6)';
    const metin = `🏆 ${buyuk(m.f.kupaAdi)} · #${m.kupa.no}`;
    x.strokeText(metin, G / 2, 46);
    x.fillStyle = '#fbbf24';
    x.fillText(metin, G / 2, 46);
  }

  arma(t, cx, cy, r) {
    const x = this.x;
    const w = r * 0.82;
    const h = r;
    const yol = () => {
      x.beginPath();
      x.moveTo(cx - w, cy - h * 0.86);
      x.quadraticCurveTo(cx, cy - h * 1.02, cx + w, cy - h * 0.86);
      x.lineTo(cx + w, cy + h * 0.05);
      x.quadraticCurveTo(cx + w, cy + h * 0.72, cx, cy + h);
      x.quadraticCurveTo(cx - w, cy + h * 0.72, cx - w, cy + h * 0.05);
      x.closePath();
    };
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.5)';
    x.shadowBlur = r * 0.25;
    yol();
    x.fillStyle = t.renk;
    x.fill();
    x.shadowBlur = 0;
    x.clip();
    x.fillStyle = t.renk2;
    x.fillRect(cx, cy - h * 1.1, w * 1.2, h * 2.3);
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.fillRect(cx - w * 1.2, cy - r * 0.24, w * 2.4, r * 0.5);
    x.restore();
    yol();
    x.lineWidth = Math.max(2, r * 0.07);
    x.strokeStyle = '#ffffff';
    x.stroke();
    const kisa = String(t.kisa || '?');
    x.font = `900 ${Math.round(r * (kisa.length > 3 ? 0.34 : 0.42))}px ${YAZI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#ffffff';
    x.fillText(kisa, cx, cy + 1, w * 1.9);
  }

  skorTablosu() {
    const x = this.x;
    const m = this.motor;
    const g = m.gosterilenMac();
    const t0 = m.takimBilgi(g.ev);
    const t1 = m.takimBilgi(g.dep);
    x.fillStyle = 'rgba(8,14,26,0.92)';
    this.yuvarlak(20, 86, 1040, 248, 30);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.12)';
    x.lineWidth = 2;
    x.stroke();
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `800 26px ${YAZI}`;
    x.fillStyle = '#94a3b8';
    x.fillText(g.ad, G / 2, 116);
    this.arma(t0, 150, 198, 64);
    this.arma(t1, 930, 198, 64);
    x.font = `900 30px ${YAZI}`;
    x.fillStyle = '#ffffff';
    x.fillText(buyuk(kisalt(t0.ad, 16)), 150, 300, 270);
    x.fillText(buyuk(kisalt(t1.ad, 16)), 930, 300, 270);
    // skor
    x.font = `900 118px ${YAZI}`;
    x.textAlign = 'right';
    x.fillText(String(g.skor[0]), 492, 196);
    x.textAlign = 'left';
    x.fillText(String(g.skor[1]), 588, 196);
    x.textAlign = 'center';
    x.fillStyle = '#64748b';
    x.fillText('-', G / 2, 190);
    if (!g.bitti && m.oyundaMi()) {
      x.font = `700 26px ${YAZI}, ${EMOJI}`;
      x.fillStyle = '#94a3b8';
      x.fillText(`👥 ${m.saha[0].length}`, 268, 198);
      x.fillText(`👥 ${m.saha[1].length}`, 812, 198);
      x.font = `800 24px ${YAZI}, ${EMOJI}`;
      x.fillStyle = '#67e8f9';
      for (let t = 0; t < 2; t++) {
        const n = m.korumalar[t].length;
        if (n) x.fillText(`🧤×${n}`, t === 0 ? 268 : 812, 238);
      }
    }
    // alt satır: dakika ya da durum
    let durum = '';
    let renk = '#fbbf24';
    if (m.asama === 'mac') durum = `${m.dakika()}'`;
    else if (m.asama === 'gol') durum = 'GOL!';
    else if (m.asama === 'hazirlik') durum = `BAŞLIYOR ${sureYaz(m.kalan)}`;
    else if (m.asama === 'penalti') durum = 'PENALTI';
    else if (m.asama === 'seri') {
      const s = m.mac.seri;
      durum = `PENALTILAR ${s.atislar[0].filter(Boolean).length}-${s.atislar[1].filter(Boolean).length}`;
    } else if (m.asama === 'ara' || m.asama === 'kupaSonu') {
      durum = g.pen ? `MAÇ SONU · pen. ${g.pen[0]}-${g.pen[1]}` : 'MAÇ SONU';
      renk = '#e2e8f0';
    } else if (m.asama === 'duraklat') durum = 'DURAKLATILDI';
    x.font = `800 34px ${YAZI}`;
    x.fillStyle = renk;
    x.fillText(durum, G / 2, 290);
    if (m.asama === 'mac' && m.mac.hava !== 'acik') {
      x.font = `600 22px ${YAZI}, ${EMOJI}`;
      x.fillStyle = '#94a3b8';
      x.fillText(`${HAVALAR[m.mac.hava].ikon} ${HAVALAR[m.mac.hava].ad}`, G / 2, 252);
    }
  }

  gucCubugu() {
    const x = this.x;
    const m = this.motor;
    const y = 346;
    const h = 42;
    if (!m.oyundaMi()) {
      x.fillStyle = 'rgba(255,255,255,0.06)';
      this.yuvarlak(20, y, 1040, h, 21);
      x.fill();
      x.font = `800 22px ${YAZI}, ${EMOJI}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = '#cbd5e1';
      x.fillText(`💬 Sıradaki maç: ${m.takim(0).kisa} ya da ${m.takim(1).kisa} yaz · ❤️ beğen, oyuna gir`, G / 2, y + h / 2, 1000);
      return;
    }
    const kit = this.kitler();
    const oran = m.gucOrani(0);
    const bol = 20 + 1040 * oran;
    x.save();
    this.yuvarlak(20, y, 1040, h, 21);
    x.clip();
    x.fillStyle = kit[0].ana;
    x.fillRect(20, y, bol - 20, h);
    x.fillStyle = kit[1].ana;
    x.fillRect(bol, y, 1060 - bol, h);
    const p = x.createLinearGradient(0, y, 0, y + h);
    p.addColorStop(0, 'rgba(255,255,255,0.22)');
    p.addColorStop(1, 'rgba(0,0,0,0.25)');
    x.fillStyle = p;
    x.fillRect(20, y, 1040, h);
    x.restore();
    x.fillStyle = '#ffffff';
    x.fillRect(bol - 2, y - 4, 4, h + 8);
    x.font = `900 24px ${YAZI}, ${EMOJI}`;
    x.textBaseline = 'middle';
    x.textAlign = 'left';
    x.fillStyle = yaziRengi(kit[0].ana);
    x.fillText(`⚡ ${m.takim(0).kisa} %${Math.round(oran * 100)}`, 38, y + h / 2);
    x.textAlign = 'right';
    x.fillStyle = yaziRengi(kit[1].ana);
    x.fillText(`%${Math.round((1 - oran) * 100)} ${m.takim(1).kisa} ⚡`, 1042, y + h / 2);
  }

  golKrallariCiz() {
    const x = this.x;
    const m = this.motor;
    const y = 398;
    x.fillStyle = 'rgba(0,0,0,0.45)';
    this.yuvarlak(20, y, 1040, 42, 12);
    x.fill();
    x.textBaseline = 'middle';
    x.textAlign = 'left';
    x.font = `900 22px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#fbbf24';
    x.fillText('⚽ GOL KRALLARI', 36, y + 21);
    const liste = m.golKrallari(3);
    x.font = `800 22px ${YAZI}, ${EMOJI}`;
    if (!liste.length) {
      x.fillStyle = '#cbd5e1';
      x.fillText('Henüz gol yok, ilk golü sen at!', 250, y + 21);
      return;
    }
    const madalya = ['🥇', '🥈', '🥉'];
    let xx = 250;
    for (const { oyuncu, sira } of liste) {
      const metin = `${madalya[Math.min(2, sira - 1)]} ${kisalt(m.adGoster(oyuncu), 11)} ${oyuncu.gol}`;
      x.fillStyle = '#ffffff';
      x.fillText(metin, xx, y + 21);
      xx += x.measureText(metin).width + 28;
      if (xx > 1000) break;
    }
  }

  bilgiSatiri() {
    const x = this.x;
    const m = this.motor;
    const y = 448;
    const es = m.kupa.eslesmeler;
    const sonraki = m.oyundaMi() ? es[m.kupa.sira + 1] : null;
    const satirlar = [];
    if (m.oyundaMi()) {
      satirlar.push(`💬 ${m.takim(0).kisa} yaz → ${m.takim(0).ad} · ${m.takim(1).kisa} yaz → ${m.takim(1).ad}`);
      satirlar.push('❤️ Beğen → oyuna gir · 💬 takımının adını yaz → o takıma geç');
      satirlar.push('📣 Takımın oynamıyor mu? Yine adını yaz: bu maça gir, sırası gelince takımında oyna');
      satirlar.push('❤️ Beğeni + 💬 yorum = takımına güç');
      if (sonraki) {
        const ev = sonraki.ev >= 0 ? m.takimBilgi(sonraki.ev).kisa : '?';
        const dep = sonraki.dep >= 0 ? m.takimBilgi(sonraki.dep).kisa : '?';
        satirlar.push(`⏳ SIRADAKİ: ${sonraki.ad} · ${ev} – ${dep}`);
      }
    } else {
      satirlar.push(`⏳ SIRADAKİ: ${m.eslesme.ad} · ${m.takim(0).kisa} yaz → ${m.takim(0).ad} · ${m.takim(1).kisa} yaz → ${m.takim(1).ad}`);
    }
    const i = Math.floor(this.zaman / 5) % satirlar.length;
    x.font = `800 25px ${YAZI}, ${EMOJI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#e2e8f0';
    x.fillText(satirlar[i], G / 2, y + 20, 1020);
  }

  ornekHediye(tur) {
    const f = this.motor.f;
    const sinirlar = { koruma: [f.korumaJeton, f.superSutJeton], superSut: [f.superSutJeton, f.penaltiJeton], penalti: [f.penaltiJeton, f.golJeton], gol: [f.golJeton, Infinity] }[tur];
    const aday = this.katalogListe
      .filter((h) => h.jeton >= sinirlar[0] && h.jeton < sinirlar[1] && this.hediyeResmi(h.ad))
      .sort((a, b) => a.jeton - b.jeton)[0];
    if (aday) return { ad: aday.ad, jeton: aday.jeton, resim: this.hediyeResmi(aday.ad) };
    const o = ORNEK[tur];
    const resim = this.hediyeResmi(o.ad);
    return o.jeton >= sinirlar[0] && o.jeton < sinirlar[1] ? { ...o, resim } : { ad: '', jeton: sinirlar[0], emoji: '🎁', resim: '' };
  }

  hediyeSatiri() {
    const x = this.x;
    const m = this.motor;
    const y = 498;
    const f = m.f;
    const liste = [
      ['koruma', f.korumaJeton, '#22d3ee'],
      ['superSut', f.superSutJeton, '#f97316'],
      ['penalti', f.penaltiJeton, '#38bdf8'],
      ['gol', f.golJeton, '#facc15'],
    ];
    const w = (1040 - 30) / 4;
    liste.forEach(([tur, jeton, renk], i) => {
      const x0 = 20 + i * (w + 10);
      x.fillStyle = 'rgba(15,23,42,0.88)';
      this.yuvarlak(x0, y, w, 76, 16);
      x.fill();
      x.strokeStyle = seffaf(renk, 0.7);
      x.lineWidth = 2;
      x.stroke();
      const h = this.ornekHediye(tur);
      const cx = x0 + 34;
      const cy = y + 38;
      if (h.resim) this.resimCiz(h.resim, cx, cy, 23);
      else {
        x.font = `32px ${EMOJI}`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(h.emoji || '🎁', cx, cy + 2);
      }
      x.textAlign = 'left';
      x.textBaseline = 'middle';
      x.font = `900 23px ${YAZI}, ${EMOJI}`;
      x.fillStyle = renk;
      x.fillText(`${OZELLER[tur].ikon} ${OZELLER[tur].ad}`, x0 + 64, y + 26, w - 72);
      x.font = `700 18px ${YAZI}`;
      x.fillStyle = '#cbd5e1';
      x.fillText(`${jeton}+ jeton${h.ad ? ' · ' + kisalt(h.ad, 10) : ''}`, x0 + 64, y + 54, w - 72);
    });
  }

  // ------------------------------------------------------------ saha
  sahaZemini() {
    if (this.sahaResmi) return this.sahaResmi;
    const c = document.createElement('canvas');
    const oy = 12; // saha çizgisinin üstünde kalan çerçeve
    c.width = G;
    c.height = Math.ceil(SH + oy * 2);
    const x = c.getContext('2d');
    const ay = (y) => oy + y * OLC;
    // çerçeve diğer kutularla aynı hizada: soldan ve sağdan 20 px boşluk, yuvarlak köşe
    x.fillStyle = '#0d3b20';
    x.beginPath();
    x.roundRect(20, 0, G - 40, c.height, 22);
    x.fill();
    const serit = 12;
    for (let i = 0; i < serit; i++) {
      x.fillStyle = i % 2 ? '#1f7a3a' : '#1a6b33';
      x.fillRect(SX0 + (SW / serit) * i, oy, SW / serit + 1, SH);
    }
    x.strokeStyle = 'rgba(255,255,255,0.85)';
    x.lineWidth = 3;
    x.strokeRect(SX0, oy, SW, SH);
    x.beginPath();
    x.moveTo(SX0 + SW / 2, oy);
    x.lineTo(SX0 + SW / 2, oy + SH);
    x.stroke();
    x.beginPath();
    x.arc(SX0 + SW / 2, ay(OY), 9.15 * OLC, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.9)';
    for (const px of [SX0 + SW / 2, SX0 + SAHA.penalti * OLC, SX0 + SW - SAHA.penalti * OLC]) {
      x.beginPath();
      x.arc(px, ay(OY), 4, 0, Math.PI * 2);
      x.fill();
    }
    for (const sol of [true, false]) {
      const x0 = sol ? SX0 : SX0 + SW;
      const d = sol ? 1 : -1;
      x.strokeRect(sol ? x0 : x0 - SAHA.ceza * OLC, ay(OY - SAHA.cezaYari), SAHA.ceza * OLC, SAHA.cezaYari * 2 * OLC);
      x.strokeRect(sol ? x0 : x0 - 5.5 * OLC, ay(OY - 9.2), 5.5 * OLC, 18.4 * OLC);
      x.beginPath();
      x.arc(x0 + d * SAHA.penalti * OLC, ay(OY), 9.15 * OLC, sol ? -0.93 : Math.PI - 0.93, sol ? 0.93 : Math.PI + 0.93);
      x.stroke();
    }
    for (const [kx, ky, a0] of [[SX0, oy, 0], [SX0 + SW, oy, Math.PI / 2], [SX0 + SW, oy + SH, Math.PI], [SX0, oy + SH, -Math.PI / 2]]) {
      x.beginPath();
      x.arc(kx, ky, 1.2 * OLC, a0, a0 + Math.PI / 2);
      x.stroke();
    }
    this.sahaResmi = { c, oy };
    return this.sahaResmi;
  }

  kaleCiz(sol, salla) {
    const x = this.x;
    const derin = 2.4 * OLC;
    const x0 = sol ? SX0 - derin : SX0 + SW;
    const y0 = sy(OY - SAHA.kale);
    const h = SAHA.kale * 2 * OLC;
    const dalga = salla ? Math.sin(salla.yas * 30) * Math.max(0, 1 - salla.yas) * 7 : 0;
    x.fillStyle = 'rgba(255,255,255,0.08)';
    x.fillRect(x0, y0, derin, h);
    x.strokeStyle = 'rgba(255,255,255,0.35)';
    x.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      x.beginPath();
      const xx = x0 + (derin / 6) * i + (sol ? -dalga : dalga) * (i / 6);
      x.moveTo(xx, y0);
      x.lineTo(xx, y0 + h);
      x.stroke();
    }
    for (let i = 0; i <= 12; i++) {
      x.beginPath();
      x.moveTo(x0, y0 + (h / 12) * i);
      x.lineTo(x0 + derin, y0 + (h / 12) * i + dalga * 0.4);
      x.stroke();
    }
    x.strokeStyle = '#ffffff';
    x.lineWidth = 5;
    x.beginPath();
    if (sol) {
      x.moveTo(SX0, y0);
      x.lineTo(x0, y0);
      x.lineTo(x0, y0 + h);
      x.lineTo(SX0, y0 + h);
    } else {
      x.moveTo(x0, y0);
      x.lineTo(x0 + derin, y0);
      x.lineTo(x0 + derin, y0 + h);
      x.lineTo(x0, y0 + h);
    }
    x.stroke();
  }

  sahaCiz(dt) {
    const x = this.x;
    const m = this.motor;
    const z = this.sahaZemini();
    x.drawImage(z.c, 0, SY0 - z.oy);
    if (this.agSalla) {
      this.agSalla.yas += dt;
      if (this.agSalla.yas > 1.5) this.agSalla = null;
    }
    this.kaleCiz(true, this.agSalla && this.agSalla.taraf === 1 ? this.agSalla : null);
    this.kaleCiz(false, this.agSalla && this.agSalla.taraf === 0 ? this.agSalla : null);

    // penaltı sahnesi: atan, kaleci ve top canlandırılır
    const atis = m.asama === 'penalti' ? m.penalti : m.asama === 'seri' ? m.mac.seri?.aktif : null;
    const ozel = new Map();
    let topOzel = null;
    if (atis) {
      const t = m.saat - atis.basla;
      const dir = atis.taraf === 0 ? 1 : -1;
      const gx = atis.taraf === 0 ? SAHA.u : 0;
      const n = atis.nokta;
      const kosu = Math.min(1, Math.max(0, (t - 0.3) / 0.6));
      if (atis.atan) ozel.set(atis.atan, { x: n.x - dir * (2.6 - 1.8 * kosu), y: OY + 0.8 * (1 - kosu) });
      const dalis = Math.min(1, Math.max(0, (t - 0.85) / 0.3));
      if (atis.kaleci) ozel.set(atis.kaleci, { x: gx - dir * 0.6, y: OY + (atis.kaleciY - OY) * dalis, dalis });
      if (t < 0.9) topOzel = { x: n.x, y: n.y };
      else {
        const u = Math.min(1, (t - 0.9) / 0.35);
        if (atis.gol) topOzel = { x: n.x + (gx + dir * 1.2 - n.x) * u, y: n.y + (atis.hedefY - n.y) * u };
        else {
          const kx = gx - dir * 0.8;
          const ky = atis.kaleciY;
          if (u < 1) topOzel = { x: n.x + (kx - n.x) * u, y: n.y + (ky - n.y) * u };
          else {
            const v = Math.min(1, (t - 1.25) / 0.5);
            topOzel = { x: kx - dir * 7 * v, y: ky + (ky < OY ? -5 : 5) * v };
          }
        }
      }
    }

    // varlıkları y'ye göre sırala (öndekiler sonra)
    const kit = this.kitler();
    const varliklar = [];
    for (let t = 0; t < 2; t++) {
      for (const o of m.sahadakiler(t)) {
        const k = ozel.get(o.id) || o.saha;
        varliklar.push({ tur: 'oyuncu', y: k.y, o, k, kit: kit[t] });
      }
    }
    m.toplar.forEach((b, i) => {
      const k = i === 0 && topOzel ? topOzel : b;
      varliklar.push({ tur: 'top', y: k.y, b, k });
    });
    if (m.kopek) varliklar.push({ tur: 'emoji', y: m.kopek.y, k: m.kopek, e: '🐕', boy: 46, yon: m.kopek.yon });
    if (m.istilaci) {
      varliklar.push({ tur: 'emoji', y: m.istilaci.y, k: m.istilaci, e: '🏃', boy: 44, yon: m.istilaci.yon });
      for (const g of m.istilaci.guvenlik) varliklar.push({ tur: 'emoji', y: g.y, k: g, e: '👮', boy: 40, yon: m.istilaci.yon });
    }
    varliklar.sort((a, b) => a.y - b.y);
    const sahipler = new Set(m.toplar.map((b) => b.sahip).filter(Boolean));
    for (const v of varliklar) {
      if (v.tur === 'oyuncu') this.oyuncuCiz(v.o, v.k, v.kit, sahipler.has(v.o.id));
      else if (v.tur === 'top') this.topCiz(v.b, v.k);
      else this.emojiCiz(v.e, v.k.x, v.k.y, v.boy, v.yon);
    }

    this.havaCiz(dt);
    if (m.surpriz?.tur === 'karanlik') {
      const b = m.toplar[0];
      const t = m.saat - m.surpriz.basla;
      const a = Math.min(0.78, t * 3, (m.surpriz.bitis - m.saat) * 3);
      x.save();
      x.beginPath();
      x.rect(SX0 - 30, SY0 - 10, SW + 60, SH + 20);
      x.clip();
      const g = x.createRadialGradient(sx(b.x), sy(b.y), 20, sx(b.x), sy(b.y), 220);
      g.addColorStop(0, `rgba(0,0,0,${a * 0.2})`);
      g.addColorStop(1, `rgba(0,0,0,${a})`);
      x.fillStyle = g;
      x.fillRect(SX0 - 30, SY0 - 10, SW + 60, SH + 20);
      x.restore();
    }
    // uçan yazılar
    for (const y of this.yazilar) {
      y.yas += dt;
      const a = Math.max(0, 1 - y.yas / 1.4);
      if (a <= 0) continue;
      x.globalAlpha = a;
      x.font = `900 ${y.boy}px ${YAZI}, ${EMOJI}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.lineWidth = 6;
      x.strokeStyle = 'rgba(0,0,0,0.7)';
      const px = Math.min(Math.max(sx(y.x), 200), 880);
      const py = sy(y.y) - 50 - y.yas * 40;
      x.strokeText(y.metin, px, py);
      x.fillStyle = y.renk;
      x.fillText(y.metin, px, py);
      x.globalAlpha = 1;
    }
    this.yazilar = this.yazilar.filter((y) => y.yas < 1.4);
    if (atis && m.asama === 'penalti') this.penaltiBasligi(atis);
  }

  oyuncuCiz(o, k, kit, topta) {
    const x = this.x;
    const m = this.motor;
    const px = sx(k.x);
    const hiz = Math.hypot(o.saha.vx, o.saha.vy);
    const sek = Math.sin(this.zaman * 14 + (o.id.length * 7) % 10) * 1.6 * Math.min(1, hiz / 5);
    const py = sy(k.y) + sek;
    const r = 25;
    const kaleci = o.saha.slot === 0;
    const sStr = m.saat;
    // gölge
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.beginPath();
    x.ellipse(px, sy(k.y) + r - 2, r * 0.9, 6, 0, 0, Math.PI * 2);
    x.fill();
    if (o.saha.superBitis > sStr) {
      const n = 0.5 + 0.5 * Math.sin(this.zaman * 20);
      const g = x.createRadialGradient(px, py, r * 0.6, px, py, r * 2.3);
      g.addColorStop(0, `rgba(251,146,60,${0.75 + n * 0.2})`);
      g.addColorStop(1, 'rgba(239,68,68,0)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(px, py, r * 2.3, 0, Math.PI * 2);
      x.fill();
    }
    const koruma = kaleci && m.korumalar ? m.korumalar[o.taraf].length : 0;
    if (koruma) {
      const n = 0.5 + 0.5 * Math.sin(this.zaman * 6);
      x.strokeStyle = `rgba(34,211,238,${0.55 + n * 0.4})`;
      x.lineWidth = 5;
      x.beginPath();
      x.arc(px, py, r + 9 + n * 3, 0, Math.PI * 2);
      x.stroke();
      x.font = `800 18px ${YAZI}, ${EMOJI}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = '#67e8f9';
      x.fillText(`🧤×${koruma}`, px, py + r + 20);
    }
    if (topta) {
      x.strokeStyle = 'rgba(255,255,255,0.8)';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(px, py, r + 7, 0, Math.PI * 2);
      x.stroke();
    }
    // forma
    x.fillStyle = kaleci ? '#facc15' : kit.ana;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
    x.lineWidth = 4;
    x.strokeStyle = kaleci ? '#111827' : kit.iki;
    x.stroke();
    const b = this.oyuncuBilgi(o.id);
    if (b.foto) this.fotoCiz(b.foto, px, py, r - 4, b.ad);
    else {
      x.font = `900 ${o.bot ? 20 : 24}px ${YAZI}, ${EMOJI}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = kaleci ? '#111827' : yaziRengi(kit.ana);
      x.fillText(o.bot ? String(o.saha.slot === 0 ? 1 : o.saha.slot + 1) : Array.from(b.ad)[0]?.toLocaleUpperCase('tr-TR') || '?', px, py + 1);
    }
    if (o.saha.sersem > sStr) {
      x.font = `16px ${EMOJI}`;
      x.textAlign = 'center';
      x.fillText('💫', px + Math.cos(this.zaman * 8) * 12, py - r - 6);
    }
    // ad etiketi
    if (o.bot) {
      x.font = `700 17px ${YAZI}, ${EMOJI}`;
      const metin = kaleci ? '🧤 Bot' : `Bot ${o.saha.slot + 1}`;
      const w = x.measureText(metin).width + 16;
      x.fillStyle = 'rgba(15,23,42,0.55)';
      this.yuvarlak(px - w / 2, py - r - 28, w, 24, 12);
      x.fill();
      x.fillStyle = 'rgba(226,232,240,0.85)';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(metin, px, py - r - 16);
    } else {
      x.font = `800 23px ${YAZI}, ${EMOJI}`;
      const metin = `${kaleci ? '🧤 ' : ''}${kisalt(b.ad, 12)}${o.gol > 0 ? ` ⚽${o.gol}` : ''}`;
      const w = x.measureText(metin).width + 18;
      x.fillStyle = seffaf(kit.ana, 0.92);
      this.yuvarlak(px - w / 2, py - r - 36, w, 31, 15);
      x.fill();
      x.strokeStyle = seffaf(kit.iki, 0.95);
      x.lineWidth = 2;
      x.stroke();
      x.fillStyle = yaziRengi(kit.ana);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(metin, px, py - r - 20);
    }
    if ((this.konusma.get(o.id) || 0) > this.zaman) {
      x.font = `26px ${EMOJI}`;
      x.textAlign = 'center';
      x.fillText('💬', px + r + 8, py - r - 40);
    }
  }

  topCiz(b, k) {
    const x = this.x;
    const px = sx(k.x);
    const py = sy(k.y);
    const r = 11;
    if (b.iz.length > 1 && (b.sut || b.garanti)) {
      x.lineCap = 'round';
      for (let i = 1; i < b.iz.length; i++) {
        const a = i / b.iz.length;
        x.strokeStyle = b.garanti ? `rgba(250,204,21,${a * 0.9})` : b.super ? `rgba(249,115,22,${a * 0.9})` : `rgba(255,255,255,${a * 0.45})`;
        x.lineWidth = (b.super || b.garanti ? 14 : 7) * a;
        x.beginPath();
        x.moveTo(sx(b.iz[i - 1].x), sy(b.iz[i - 1].y));
        x.lineTo(sx(b.iz[i].x), sy(b.iz[i].y));
        x.stroke();
      }
      if ((b.super || b.garanti) && Math.random() < 0.7) {
        this.parcaciklar.push({ tip: 'kivilcim', x: px, y: py, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, yas: 0, omur: 0.35, boy: 3, renk: b.garanti ? '#fde047' : '#fb923c' });
      }
    }
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.beginPath();
    x.ellipse(px + 3, py + 6, r, 4, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#111827';
    const d = b.donus * 1.4;
    x.beginPath();
    x.arc(px + Math.cos(d) * 2, py + Math.sin(d) * 2, 3.2, 0, Math.PI * 2);
    x.fill();
    for (let i = 0; i < 5; i++) {
      const a = d + (i * Math.PI * 2) / 5;
      x.beginPath();
      x.arc(px + Math.cos(a) * 7, py + Math.sin(a) * 7, 1.6, 0, Math.PI * 2);
      x.fill();
    }
    x.strokeStyle = 'rgba(0,0,0,0.5)';
    x.lineWidth = 1;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.stroke();
  }

  emojiCiz(e, mx, my, boy, yon) {
    const x = this.x;
    x.save();
    x.translate(sx(mx), sy(my));
    if (yon > 0) x.scale(-1, 1);
    x.font = `${boy}px ${EMOJI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(e, 0, Math.sin(this.zaman * 18) * 2);
    x.restore();
  }

  havaCiz(dt) {
    const x = this.x;
    const m = this.motor;
    const hava = m.oyundaMi() ? m.mac.hava : 'acik';
    if (hava !== this.havaTur) {
      this.havaTur = hava;
      this.havaParca = [];
      const n = { yagmur: 140, kar: 110, ruzgar: 26, sis: 5 }[hava] || 0;
      for (let i = 0; i < n; i++) this.havaParca.push({ x: Math.random() * SW, y: Math.random() * SH, h: Math.random() });
    }
    const ruzgar = m.ruzgar ? m.ruzgar() : { x: 0, y: 0 };
    x.save();
    x.beginPath();
    x.rect(SX0 - 30, SY0 - 10, SW + 60, SH + 20);
    x.clip();
    if (hava === 'yagmur') {
      x.strokeStyle = 'rgba(200,220,255,0.45)';
      x.lineWidth = 2;
      for (const p of this.havaParca) {
        p.y += (900 + p.h * 300) * dt;
        p.x += (120 + ruzgar.x * 40) * dt;
        if (p.y > SH) { p.y -= SH; p.x = Math.random() * SW; }
        if (p.x > SW) p.x -= SW;
        if (p.x < 0) p.x += SW;
        x.beginPath();
        x.moveTo(SX0 + p.x, SY0 + p.y);
        x.lineTo(SX0 + p.x - 6, SY0 + p.y - 22);
        x.stroke();
      }
      x.fillStyle = 'rgba(30,60,120,0.12)';
      x.fillRect(SX0, SY0, SW, SH);
    } else if (hava === 'kar') {
      x.fillStyle = 'rgba(255,255,255,0.85)';
      for (const p of this.havaParca) {
        p.y += (70 + p.h * 60) * dt;
        p.x += (Math.sin(this.zaman * 1.5 + p.h * 10) * 30 + ruzgar.x * 25) * dt;
        if (p.y > SH) { p.y -= SH; p.x = Math.random() * SW; }
        if (p.x > SW) p.x -= SW;
        if (p.x < 0) p.x += SW;
        x.beginPath();
        x.arc(SX0 + p.x, SY0 + p.y, 2 + p.h * 3, 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = 'rgba(255,255,255,0.08)';
      x.fillRect(SX0, SY0, SW, SH);
    } else if (hava === 'sis') {
      for (const p of this.havaParca) {
        p.x += (14 + p.h * 12) * dt;
        if (p.x > SW + 200) p.x = -200;
        const g = x.createRadialGradient(SX0 + p.x, SY0 + p.y, 10, SX0 + p.x, SY0 + p.y, 260);
        g.addColorStop(0, 'rgba(226,232,240,0.16)');
        g.addColorStop(1, 'rgba(226,232,240,0)');
        x.fillStyle = g;
        x.fillRect(SX0 - 30, SY0 - 10, SW + 60, SH + 20);
      }
    }
    if (hava === 'ruzgar' || m.ruzgarEk) {
      const r = Math.hypot(ruzgar.x, ruzgar.y) || 1;
      x.strokeStyle = 'rgba(255,255,255,0.28)';
      x.lineWidth = 2;
      if (!this.havaParca.length || hava !== 'ruzgar') {
        while (this.havaParca.length < 26) this.havaParca.push({ x: Math.random() * SW, y: Math.random() * SH, h: Math.random() });
      }
      for (const p of this.havaParca.slice(0, 26)) {
        p.x += (ruzgar.x / r) * (260 + p.h * 200) * dt;
        p.y += (ruzgar.y / r) * (260 + p.h * 200) * dt;
        if (p.x > SW) p.x -= SW;
        if (p.x < 0) p.x += SW;
        if (p.y > SH) p.y -= SH;
        if (p.y < 0) p.y += SH;
        x.beginPath();
        x.moveTo(SX0 + p.x, SY0 + p.y);
        x.lineTo(SX0 + p.x - (ruzgar.x / r) * 40, SY0 + p.y - (ruzgar.y / r) * 40);
        x.stroke();
      }
    }
    x.restore();
  }

  penaltiBasligi(p) {
    const x = this.x;
    const kit = this.kitler();
    const b = this.oyuncuBilgi(p.atan);
    const y = SY0 + 16;
    x.fillStyle = 'rgba(2,6,23,0.85)';
    this.yuvarlak(G / 2 - 330, y, 660, 84, 22);
    x.fill();
    x.strokeStyle = kit[p.taraf].ana;
    x.lineWidth = 3;
    x.stroke();
    x.fillStyle = kit[p.taraf].ana;
    x.beginPath();
    x.arc(G / 2 - 280, y + 42, 32, 0, Math.PI * 2);
    x.fill();
    if (b.foto) this.fotoCiz(b.foto, G / 2 - 280, y + 42, 28, b.ad);
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    x.font = `900 36px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#38bdf8';
    x.fillText('🎯 PENALTI!', G / 2 - 230, y + 28);
    x.font = `800 24px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#ffffff';
    x.fillText(kisalt(p.ad || b.ad, 22), G / 2 - 230, y + 62, 520);
  }

  // ------------------------------------------------------------ saha altı ve alt bölüm
  sahaAlti() {
    const x = this.x;
    const m = this.motor;
    const y = SY0 + SH + 14;
    x.textBaseline = 'middle';
    // hava
    const hava = HAVALAR[m.mac.hava];
    x.font = `800 22px ${YAZI}, ${EMOJI}`;
    x.textAlign = 'left';
    x.fillStyle = 'rgba(0,0,0,0.5)';
    const hw = x.measureText(`${hava.ikon} ${hava.ad}`).width + 28;
    this.yuvarlak(20, y, hw, 40, 20);
    x.fill();
    x.fillStyle = '#e2e8f0';
    x.fillText(`${hava.ikon} ${hava.ad}`, 34, y + 20);
    // beğeni hedefi
    const hedef = m.ayarlar.begeniHedefi;
    if (hedef) {
      const x0 = 300;
      const w = 480;
      x.fillStyle = 'rgba(0,0,0,0.5)';
      this.yuvarlak(x0, y, w, 40, 20);
      x.fill();
      const oran = Math.min(1, m.begeniSayaci / hedef);
      x.save();
      this.yuvarlak(x0, y, w, 40, 20);
      x.clip();
      x.fillStyle = this.hedefParlama > 0 ? '#fbcfe8' : 'rgba(236,72,153,0.75)';
      x.fillRect(x0, y, w * oran, 40);
      x.restore();
      if (this.hedefParlama > 0) this.hedefParlama -= 1 / 60;
      x.textAlign = 'center';
      x.fillStyle = '#ffffff';
      const cilgin = m.cilginBitis > m.saat;
      x.fillText(cilgin ? `⚽⚽ 2 TOP SAHADA · ${sureYaz(m.cilginBitis - m.saat)}` : `❤️ ${m.begeniSayaci}/${hedef} → 2 TOP`, x0 + w / 2, y + 20);
    }
    // sürpriz geri sayımı
    if (m.f.surpriz && m.asama === 'mac') {
      const kalan = m.surpriz ? 0 : m.sonrakiSurpriz - m.macSaniye;
      const metin = m.surpriz ? `${SURPRIZLER[m.surpriz.tur].ikon} Sürpriz!` : `🎲 Sürpriz: ${sureYaz(kalan)}`;
      x.textAlign = 'right';
      const w = x.measureText(metin).width + 28;
      x.fillStyle = 'rgba(0,0,0,0.5)';
      this.yuvarlak(1060 - w, y, w, 40, 20);
      x.fill();
      x.fillStyle = '#fde68a';
      x.fillText(metin, 1046, y + 20);
    }
  }

  akisCiz(dt) {
    const x = this.x;
    const y0 = 1300;
    x.fillStyle = 'rgba(2,6,23,0.6)';
    this.yuvarlak(20, y0, 510, 400, 20);
    x.fill();
    x.font = `900 20px ${YAZI}`;
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    x.fillStyle = '#94a3b8';
    x.fillText('CANLI AKIŞ', 38, y0 + 26);
    let yy = y0 + 64;
    for (const a of this.akis.slice(0, 9)) {
      a.yas += dt;
      x.globalAlpha = Math.max(0.35, 1 - a.yas / 40);
      x.font = `${a.onemli ? 800 : 700} 21px ${YAZI}, ${EMOJI}`;
      x.fillStyle = a.onemli ? '#fde68a' : '#e2e8f0';
      x.fillText(kisalt(a.metin, 40), 38, yy, 476);
      x.fillStyle = a.renk;
      x.fillRect(26, yy - 10, 4, 20);
      yy += 37;
    }
    x.globalAlpha = 1;
  }

  fiksturCiz() {
    const x = this.x;
    const m = this.motor;
    const x0 = 550;
    const y0 = 1300;
    const w = 510;
    const kupaSonu = m.asama === 'kupaSonu' && m.bitenKupa;
    const es = kupaSonu ? m.bitenKupa.eslesmeler : m.kupa.eslesmeler;
    const no = kupaSonu ? m.bitenKupa.no : m.kupa.no;
    x.fillStyle = 'rgba(2,6,23,0.72)';
    this.yuvarlak(x0, y0, w, 400, 20);
    x.fill();
    x.strokeStyle = 'rgba(251,191,36,0.35)';
    x.lineWidth = 2;
    x.stroke();
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `900 22px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#fbbf24';
    // içinde bulunulan turun maçları; yer kalırsa sonraki maçlar (en çok 9 satır)
    const simdiki = kupaSonu ? es.length - 1 : Math.min(m.kupa.sira, es.length - 1);
    let bas = kupaSonu ? Math.max(0, es.length - 8) : es.findIndex((e) => e.tur === es[simdiki].tur);
    if (es.length - bas < 9) bas = Math.max(0, es.length - 9);
    const goster = es.slice(bas, bas + 9);
    const tur = kupaSonu ? 'FİNAL' : turAdi(es[simdiki].tur);
    x.fillText(`🏆 ${buyuk(kisalt(m.f.kupaAdi, 14))} #${no} · ${tur}`, x0 + w / 2, y0 + 26, w - 30);
    goster.forEach((e, j) => {
      const i = bas + j;
      const yy = y0 + 62 + j * 35;
      const canli = !kupaSonu && i === m.kupa.sira && m.oyundaMi();
      if (canli) {
        x.fillStyle = 'rgba(239,68,68,0.18)';
        this.yuvarlak(x0 + 10, yy - 17, w - 20, 34, 10);
        x.fill();
      }
      x.textAlign = 'left';
      x.font = `800 17px ${YAZI}`;
      x.fillStyle = canli ? '#f87171' : '#64748b';
      x.fillText(canli ? '● CANLI' : e.kisa, x0 + 18, yy);
      const takimYaz = (idx, xx, hiza) => {
        if (idx < 0) {
          x.textAlign = hiza;
          x.font = `700 19px ${YAZI}`;
          x.fillStyle = '#475569';
          x.fillText('?', xx, yy);
          return;
        }
        const t = m.takimBilgi(idx);
        const kaybetti = e.kazanan >= 0 && e.kazanan !== idx;
        x.globalAlpha = kaybetti ? 0.45 : 1;
        this.arma(t, hiza === 'right' ? xx + 16 : xx - 16, yy, 13);
        x.textAlign = hiza;
        x.textBaseline = 'middle';
        x.font = `${e.kazanan === idx ? 900 : 700} 19px ${YAZI}`;
        x.fillStyle = '#e2e8f0';
        x.fillText(t.kisa, hiza === 'right' ? xx - 6 : xx + 6, yy);
        x.globalAlpha = 1;
      };
      takimYaz(e.ev, x0 + 215, 'right');
      takimYaz(e.dep, x0 + 335, 'left');
      x.textAlign = 'center';
      x.font = `900 19px ${YAZI}`;
      let skor = 'vs';
      if (e.skor) skor = `${e.skor[0]}-${e.skor[1]}`;
      else if (canli) skor = `${m.mac.skor[0]}-${m.mac.skor[1]}`;
      x.fillStyle = canli ? '#fca5a5' : e.skor ? '#ffffff' : '#475569';
      x.fillText(skor, x0 + 275, yy);
      if (e.pen) {
        x.font = `700 15px ${YAZI}`;
        x.fillStyle = '#94a3b8';
        x.textAlign = 'left';
        x.fillText(`(p ${e.pen[0]}-${e.pen[1]})`, x0 + 420, yy);
      }
    });
    // kupa sayıları
    const sayilar = m.kupalar.map((n, i) => [i, n]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    x.textAlign = 'center';
    x.font = `800 18px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#cbd5e1';
    const metin = sayilar.length ? '🏆 ' + sayilar.slice(0, 5).map(([i, n]) => `${m.takimBilgi(i).kisa} ${n}`).join(' · ') : '🏆 Kupa sayıları burada görünecek';
    x.fillText(metin, x0 + w / 2, y0 + 380, w - 30);
  }

  // ------------------------------------------------------------ katmanlar
  golEkrani(dt) {
    const x = this.x;
    const m = this.motor;
    const g = this.golGosterim;
    if (!g) return;
    g.yas += dt;
    const kit = this.kitler();
    const renk = kit[g.taraf];
    const t = g.yas;
    const olcek = Math.min(1, t / 0.25) * (1 + 0.08 * Math.max(0, 1 - t));
    const cy = SY0 + SH / 2 - 40;
    x.fillStyle = 'rgba(0,0,0,0.66)';
    x.fillRect(SX0 - 30, cy - 120, SW + 60, 280);
    x.save();
    x.translate(G / 2, cy - 30);
    x.scale(olcek, olcek);
    x.font = `900 136px ${YAZI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineWidth = 14;
    x.strokeStyle = renk.ana;
    x.strokeText('GOOOL!', 0, 0);
    x.fillStyle = '#ffffff';
    x.fillText('GOOOL!', 0, 0);
    x.restore();
    if (t < 0.25) return;
    const etiket = { penalti: '🎯 PENALTI GOLÜ', roket: '⚡ HEDİYE GOLÜ', super: '🔥 SÜPER ŞUT' }[g.tur] || '';
    const ad = g.ad ? (g.kendi ? `${g.ad} · kendi kalesine` : g.ad) : m.takim(g.taraf).ad;
    const satir = `${g.dakika}' ${ad}`;
    x.font = `900 40px ${YAZI}, ${EMOJI}`;
    const w = Math.min(860, x.measureText(satir).width + (g.foto ? 110 : 40));
    const x0 = G / 2 - w / 2;
    if (g.foto) {
      x.fillStyle = renk.ana;
      x.beginPath();
      x.arc(x0 + 40, cy + 70, 38, 0, Math.PI * 2);
      x.fill();
      this.fotoCiz(g.foto, x0 + 40, cy + 70, 34, g.ad);
    }
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    x.fillStyle = '#ffffff';
    x.fillText(satir, x0 + (g.foto ? 92 : 20), cy + 70, w - 100);
    x.textAlign = 'center';
    x.font = `800 26px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#fde68a';
    const alt = [etiket, g.asist ? `🅰️ ${g.asist}` : ''].filter(Boolean).join(' · ');
    if (alt) x.fillText(alt, G / 2, cy + 128);
  }

  seriTablosu() {
    const x = this.x;
    const m = this.motor;
    const s = m.mac.seri;
    if (!s) return;
    const kit = this.kitler();
    const y = SY0 + 16;
    x.fillStyle = 'rgba(2,6,23,0.88)';
    this.yuvarlak(G / 2 - 360, y, 720, 150, 24);
    x.fill();
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `900 30px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#fbbf24';
    x.fillText('🎯 PENALTILAR', G / 2, y + 30);
    const n = Math.max(5, s.atislar[0].length, s.atislar[1].length);
    for (let t = 0; t < 2; t++) {
      const yy = y + 76 + t * 46;
      x.textAlign = 'left';
      x.font = `900 24px ${YAZI}`;
      x.fillStyle = '#ffffff';
      x.fillText(m.takim(t).kisa, G / 2 - 330, yy);
      for (let i = 0; i < n; i++) {
        const cx = G / 2 - 190 + i * (n > 7 ? 40 : 52);
        const v = s.atislar[t][i];
        x.beginPath();
        x.arc(cx, yy, 15, 0, Math.PI * 2);
        x.fillStyle = v === true ? '#22c55e' : v === false ? '#ef4444' : 'rgba(255,255,255,0.12)';
        x.fill();
        if (v === false) {
          x.strokeStyle = '#fff';
          x.lineWidth = 3;
          x.beginPath();
          x.moveTo(cx - 6, yy - 6);
          x.lineTo(cx + 6, yy + 6);
          x.moveTo(cx + 6, yy - 6);
          x.lineTo(cx - 6, yy + 6);
          x.stroke();
        }
      }
      x.textAlign = 'right';
      x.font = `900 28px ${YAZI}`;
      x.fillStyle = '#ffffff';
      x.fillText(String(s.atislar[t].filter(Boolean).length), G / 2 + 340, yy);
    }
    if (s.aktif) {
      const b = this.oyuncuBilgi(s.aktif.atan);
      x.textAlign = 'center';
      x.font = `800 24px ${YAZI}, ${EMOJI}`;
      x.fillStyle = '#e2e8f0';
      x.fillText(`⚽ ${kisalt(s.aktif.ad || b.ad, 20)} (${m.takim(s.aktif.taraf).kisa})`, G / 2, y + 172);
    }
  }

  kart(x0, y0, w, h) {
    const x = this.x;
    x.fillStyle = 'rgba(2,6,23,0.9)';
    this.yuvarlak(x0, y0, w, h, 28);
    x.fill();
    x.strokeStyle = 'rgba(251,191,36,0.5)';
    x.lineWidth = 3;
    x.stroke();
  }

  hazirlikEkrani() {
    const x = this.x;
    const m = this.motor;
    const kit = this.kitler();
    const cy = SY0 + SH / 2;
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect(SX0 - 30, SY0 - 10, SW + 60, SH + 20);
    this.kart(130, cy - 190, 820, 380);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `900 30px ${YAZI}`;
    x.fillStyle = '#94a3b8';
    x.fillText(m.eslesme.ad, G / 2, cy - 150);
    this.arma(m.takim(0), 300, cy - 50, 62);
    this.arma(m.takim(1), 780, cy - 50, 62);
    x.font = `900 92px ${YAZI}`;
    x.fillStyle = '#ffffff';
    x.fillText(sureYaz(m.kalan), G / 2, cy - 50);
    x.font = `900 28px ${YAZI}`;
    x.fillStyle = yaziRengi(kit[0].ana) === '#111827' ? kit[0].ana : '#ffffff';
    x.fillText(`💬 ${m.takim(0).kisa} yaz → ${kisalt(m.takim(0).ad, 12)}`, 300, cy + 52, 330);
    x.fillStyle = '#ffffff';
    x.fillText(`💬 ${m.takim(1).kisa} yaz → ${kisalt(m.takim(1).ad, 12)}`, 780, cy + 52, 330);
    x.font = `700 26px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#cbd5e1';
    const hava = HAVALAR[m.mac.hava];
    x.fillText(`❤️ Beğenen oyuna girer · ${hava.ikon} ${hava.ad}`, G / 2, cy + 120, 760);
    x.font = `800 24px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#fde68a';
    x.fillText('Takımının adını yazan o takıma geçer (1 ve 2 de olur)', G / 2, cy + 160, 760);
  }

  araEkrani() {
    const x = this.x;
    const m = this.motor;
    const s = m.sonMac;
    if (!s) return;
    const cy = SY0 + SH / 2;
    x.fillStyle = 'rgba(0,0,0,0.5)';
    x.fillRect(SX0 - 30, SY0 - 10, SW + 60, SH + 20);
    this.kart(90, SY0 + 10, 900, SH - 20);
    const t0 = m.takimBilgi(s.ev);
    const t1 = m.takimBilgi(s.dep);
    const kazanan = m.takimBilgi(s.kazanan);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `900 28px ${YAZI}`;
    x.fillStyle = '#94a3b8';
    x.fillText(`${s.ad} · MAÇ SONU`, G / 2, SY0 + 50);
    this.arma(t0, 300, SY0 + 140, 54);
    this.arma(t1, 780, SY0 + 140, 54);
    x.font = `900 96px ${YAZI}`;
    x.fillStyle = '#ffffff';
    x.fillText(`${s.skor[0]} - ${s.skor[1]}`, G / 2, SY0 + 140);
    if (s.pen) {
      x.font = `800 26px ${YAZI}`;
      x.fillStyle = '#fbbf24';
      x.fillText(`Penaltılar ${s.pen[0]}-${s.pen[1]}`, G / 2, SY0 + 205);
    }
    const sonrakiTur = { 64: 'SON 32 TURUNDA', 32: 'SON 16 TURUNDA', 16: 'ÇEYREK FİNALDE', 8: 'YARI FİNALDE', 4: 'FİNALDE!' }[s.tur] || 'TUR ATLADI';
    const sonuc = s.tur === 3 ? `🥉 ${buyuk(kazanan.ad)} ÜÇÜNCÜ OLDU` : `${s.tur === 4 ? '🏆' : '✅'} ${buyuk(kazanan.ad)} ${sonrakiTur}`;
    x.font = `900 36px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#fde68a';
    x.fillText(sonuc, G / 2, SY0 + 252, 860);
    // goller
    const kit = formalar(t0, t1);
    x.font = `700 22px ${YAZI}, ${EMOJI}`;
    const goller = s.goller.slice(0, 8);
    goller.forEach((g, i) => {
      const sutun = i % 2;
      const yy = SY0 + 300 + Math.floor(i / 2) * 34;
      const xx = sutun ? 560 : 140;
      x.textAlign = 'left';
      x.fillStyle = kit[g.taraf].ana === '#111111' ? '#e5e7eb' : kit[g.taraf].ana;
      x.fillRect(xx - 12, yy - 10, 5, 20);
      x.fillStyle = '#e2e8f0';
      const ad = g.ad ? (g.bot ? 'Bot' : g.ad) : m.takimBilgi(g.taraf === 0 ? s.ev : s.dep).kisa;
      x.fillText(kisalt(`${g.dakika}' ⚽ ${ad}${g.kendi ? ' (k.k.)' : ''}`, 26), xx, yy, 390);
    });
    if (!goller.length) {
      x.textAlign = 'center';
      x.fillStyle = '#94a3b8';
      x.fillText('Golsüz maç', G / 2, SY0 + 310);
    }
    x.textAlign = 'center';
    if (s.yildiz) {
      x.font = `800 24px ${YAZI}, ${EMOJI}`;
      x.fillStyle = '#ffffff';
      x.fillText(`⭐ Maçın yıldızı: ${kisalt(s.yildiz.ad, 18)}${s.yildiz.gol ? ` (${s.yildiz.gol} gol)` : ''}`, G / 2, SY0 + 448, 820);
    }
    const e = m.eslesme;
    x.font = `900 28px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#93c5fd';
    x.fillText(`⏳ SIRADAKİ: ${e.ad} · ${sureYaz(m.kalan)}`, G / 2, SY0 + 500, 860);
    x.font = `800 26px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#e2e8f0';
    x.fillText(`💬 ${m.takim(0).kisa} yaz → ${m.takim(0).ad} · ${m.takim(1).kisa} yaz → ${m.takim(1).ad}`, G / 2, SY0 + 548, 860);
    void cy;
  }

  kupaEkrani(dt) {
    const x = this.x;
    const m = this.motor;
    const k = m.bitenKupa;
    if (!k) return;
    const t = m.takimBilgi(k.kazanan);
    if (Math.random() < 0.6) this.konfeti(Math.random() * G, SY0 - 20, [t.renk, t.renk2, '#fde047'], 120);
    x.fillStyle = 'rgba(0,0,0,0.6)';
    x.fillRect(SX0 - 30, SY0 - 10, SW + 60, SH + 20);
    this.kart(90, SY0 + 10, 900, SH - 20);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `110px ${EMOJI}`;
    const z = Math.sin(this.zaman * 3) * 6;
    x.fillText('🏆', G / 2, SY0 + 110 + z);
    x.font = `900 40px ${YAZI}`;
    x.fillStyle = '#fbbf24';
    x.fillText(`${buyuk(m.f.kupaAdi)} #${k.no} ŞAMPİYONU`, G / 2, SY0 + 205, 860);
    this.arma(t, G / 2, SY0 + 300, 66);
    x.font = `900 58px ${YAZI}`;
    x.fillStyle = '#ffffff';
    x.fillText(buyuk(t.ad), G / 2, SY0 + 405, 860);
    x.font = `800 26px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#e2e8f0';
    const ikinci = k.ikinci >= 0 ? m.takimBilgi(k.ikinci).ad : '?';
    const ucuncu = k.ucuncu >= 0 ? m.takimBilgi(k.ucuncu).ad : '?';
    x.fillText(`🥈 ${ikinci} · 🥉 ${ucuncu} · 🏆 toplam ${k.kupaSayisi} kupa`, G / 2, SY0 + 465, 860);
    if (k.golKrali) {
      x.fillStyle = '#fde68a';
      x.fillText(`👑 Kupanın gol kralı: ${kisalt(k.golKrali.ad, 18)} (${k.golKrali.gol} gol)`, G / 2, SY0 + 510, 860);
    }
    x.font = `800 24px ${YAZI}, ${EMOJI}`;
    x.fillStyle = '#93c5fd';
    x.fillText(`Yeni kupa ${sureYaz(m.kalan)} sonra · ${m.eslesme.ad}: ${m.takim(0).kisa} ya da ${m.takim(1).kisa} yaz`, G / 2, SY0 + 565, 860);
    void dt;
  }

  kartlariCiz(dt) {
    const x = this.x;
    const kit = this.kitler();
    this.kartlar = this.kartlar.filter((k) => (k.yas += dt) < 3.2);
    this.kartlar.forEach((k, i) => {
      const giris = Math.min(1, k.yas / 0.2);
      const cikis = Math.min(1, (3.2 - k.yas) / 0.3);
      x.globalAlpha = Math.min(giris, cikis);
      const y = SY0 + 120 + i * 130 - (1 - giris) * 30;
      const oz = OZELLER[k.ozel];
      const renk = { koruma: '#22d3ee', superSut: '#f97316', penalti: '#38bdf8', gol: '#facc15' }[k.ozel];
      x.fillStyle = 'rgba(2,6,23,0.92)';
      this.yuvarlak(150, y, 780, 116, 26);
      x.fill();
      x.strokeStyle = renk;
      x.lineWidth = 4;
      x.stroke();
      const tk = k.taraf === 0 || k.taraf === 1 ? kit[k.taraf] : { ana: '#64748b', iki: '#fff' };
      x.fillStyle = tk.ana;
      x.beginPath();
      x.arc(214, y + 58, 42, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = tk.iki;
      x.lineWidth = 3;
      x.stroke();
      if (k.foto) this.fotoCiz(k.foto, 214, y + 58, 37, k.ad);
      else {
        x.font = `900 34px ${YAZI}, ${EMOJI}`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillStyle = yaziRengi(tk.ana);
        x.fillText(Array.from(k.ad || '?')[0].toLocaleUpperCase('tr-TR'), 214, y + 60);
      }
      x.textAlign = 'left';
      x.textBaseline = 'middle';
      x.font = `900 42px ${YAZI}, ${EMOJI}`;
      x.fillStyle = renk;
      x.fillText(`${oz.ikon} ${oz.ad}!`, 272, y + 40, 520);
      x.font = `800 24px ${YAZI}, ${EMOJI}`;
      x.fillStyle = '#ffffff';
      const alt = k.birikim ? `${kisalt(k.ad, 18)} · hediyeler birikti` : `${kisalt(k.ad, 18)}${k.hediye ? ` · ${kisalt(k.hediye.ad, 16)} (${k.hediye.jeton})` : ''}`;
      x.fillText(alt, 272, y + 84, 520);
      const resim = k.hediye ? k.hediye.resim || this.hediyeResmi(k.hediye.ad) : '';
      if (resim) this.resimCiz(resim, 866, y + 58, 40);
      x.globalAlpha = 1;
    });
  }

  bildirimleriCiz(dt) {
    const x = this.x;
    this.bildirimler = this.bildirimler.filter((b) => (b.yas += dt) < b.sure);
    this.bildirimler.forEach((b, i) => {
      const a = Math.min(1, b.yas / 0.15, (b.sure - b.yas) / 0.3);
      x.globalAlpha = a;
      const y = SY0 + SH - 90 - i * 70;
      x.font = `900 ${b.buyuk ? 40 : 34}px ${YAZI}, ${EMOJI}`;
      const w = Math.min(1000, x.measureText(b.metin).width + 60);
      x.fillStyle = 'rgba(2,6,23,0.85)';
      this.yuvarlak(G / 2 - w / 2, y - 30, w, 60, 30);
      x.fill();
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = b.renk;
      x.fillText(b.metin, G / 2, y + 1, 960);
      x.globalAlpha = 1;
    });
  }

  parcaciklariCiz(dt) {
    const x = this.x;
    this.parcaciklar = this.parcaciklar.filter((p) => (p.yas += dt) < p.omur);
    if (this.parcaciklar.length > 700) this.parcaciklar.splice(0, this.parcaciklar.length - 700);
    for (const p of this.parcaciklar) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.yercekimi) p.vy += p.yercekimi * dt;
      if (p.tip !== 'kalp') {
        p.vx *= 0.985;
        p.vy *= p.yercekimi ? 1 : 0.985;
      }
      const a = 1 - p.yas / p.omur;
      x.globalAlpha = Math.max(0, a);
      if (p.tip === 'kare') {
        p.donus += dt * 8;
        x.save();
        x.translate(p.x, p.y);
        x.rotate(p.donus);
        x.fillStyle = p.renk;
        x.fillRect(-p.boy / 2, -p.boy / 4, p.boy, p.boy / 2);
        x.restore();
      } else if (p.tip === 'kalp') {
        x.font = `${p.boy}px ${EMOJI}`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText('❤️', p.x, p.y);
      } else {
        x.fillStyle = p.renk;
        x.beginPath();
        x.arc(p.x, p.y, p.boy * (p.tip === 'kivilcim' ? a : 1), 0, Math.PI * 2);
        x.fill();
      }
    }
    x.globalAlpha = 1;
  }

  perde(metin) {
    const x = this.x;
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.fillRect(SX0 - 30, SY0 - 10, SW + 60, SH + 20);
    x.font = `900 64px ${YAZI}, ${EMOJI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#ffffff';
    x.fillText(metin, G / 2, SY0 + SH / 2);
  }

  demoFiligran() {
    const x = this.x;
    x.save();
    x.translate(G / 2, SY0 + SH / 2);
    x.rotate(-0.35);
    x.font = `900 150px ${YAZI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.07)';
    x.fillText('DEMO', 0, 0);
    x.restore();
    x.font = `800 22px ${YAZI}`;
    x.textAlign = 'right';
    x.textBaseline = 'middle';
    x.fillStyle = 'rgba(251,191,36,0.9)';
    x.fillText('DEMO · sahte izleyiciler', 1056, 1880);
  }

  baglantiUyarisi() {
    const x = this.x;
    x.fillStyle = 'rgba(127,29,29,0.92)';
    this.yuvarlak(140, 1720, 800, 70, 20);
    x.fill();
    x.font = `800 26px ${YAZI}, ${EMOJI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.fillText('⚠️ Oyun sunucusuyla bağlantı yok (baslat.bat açık mı?)', G / 2, 1755, 760);
  }

  // ------------------------------------------------------------ yardımcılar
  yuvarlak(xx, yy, w, h, r) {
    const x = this.x;
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    x.beginPath();
    x.moveTo(xx + r, yy);
    x.arcTo(xx + w, yy, xx + w, yy + h, r);
    x.arcTo(xx + w, yy + h, xx, yy + h, r);
    x.arcTo(xx, yy + h, xx, yy, r);
    x.arcTo(xx, yy, xx + w, yy, r);
    x.closePath();
  }

  resimAl(url) {
    let f = this.fotolar.get(url);
    if (!f) {
      if (this.fotolar.size > 400) this.fotolar.clear();
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      f = { img, durum: 'yukleniyor' };
      img.onload = () => (f.durum = 'hazir');
      img.onerror = () => (f.durum = 'hata');
      img.src = url;
      this.fotolar.set(url, f);
    }
    return f;
  }

  resimCiz(url, cx, cy, r) {
    const f = this.resimAl(url);
    if (f.durum === 'hazir') this.x.drawImage(f.img, cx - r, cy - r, r * 2, r * 2);
  }

  fotoCiz(url, cx, cy, r, ad) {
    const f = this.resimAl(url);
    const x = this.x;
    if (f.durum !== 'hazir') {
      if (ad) {
        x.font = `900 ${Math.round(r)}px ${YAZI}, ${EMOJI}`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillStyle = '#fff';
        x.fillText((Array.from(String(ad))[0] || '?').toLocaleUpperCase('tr-TR'), cx, cy + 1);
      }
      return;
    }
    x.save();
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.clip();
    x.drawImage(f.img, cx - r, cy - r, r * 2, r * 2);
    x.restore();
  }
}

