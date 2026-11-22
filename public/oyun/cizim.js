// Cephe Kapışması — çizim katmanı (canvas 2D, 1080×1920).
// Motorun durumunu okur, motor.fx kuyruğundaki görsel olayları oynatır. Simülasyona dokunmaz.

import { SABIT, jetonEsikleri } from './motor.js';

const G = 1080;
const Y = 1920;
const ORTA = 960; // cephe hattı
const ON_MESAFE = 55;
const SIRA_ARALIK = 50;
const YAZI = 'system-ui, "Segoe UI", Roboto, sans-serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const TUFEK_ARALIK = 0.12; // seri atışta mermiler arası
const BOMBA_UCUS = 0.55;
const EJDERHA_GIRIS = 0.6;
const EJDERHA_NEFES = 1.4;
export const EJDERHA_SURE = 2.6;
const SILAH_IKON = { tufek: '🔫', bomba: '💣', ejderha: '🐉', kilic: '⚔️' };
// Silah tablosunda örnek gösterilecek TikTok Türkiye hediyeleri (resim katalogdan gelir, yoksa emoji)
const ORNEK_HEDIYELER = [
  { ad: 'Gül', jeton: 1, emoji: '🌹' },
  { ad: 'Kalp', jeton: 10, emoji: '❤️' },
  { ad: 'Rosa', jeton: 10, emoji: '🌹' },
  { ad: 'Dönen Top', jeton: 5, emoji: '⚽' },
  { ad: 'Parfüm', jeton: 20, emoji: '🧴' },
  { ad: 'Donat', jeton: 30, emoji: '🍩' },
  { ad: 'Çay', jeton: 50, emoji: '🍵' },
  { ad: 'Elle Kalp', jeton: 100, emoji: '🫶' },
  { ad: 'Konfeti', jeton: 100, emoji: '🎉' },
  { ad: 'Taç', jeton: 199, emoji: '👑' },
  { ad: 'Corgi', jeton: 299, emoji: '🐶' },
  { ad: 'Elmas aşk yüzüğü', jeton: 300, emoji: '💍' },
  { ad: 'Para Tabancası', jeton: 500, emoji: '💸' },
  { ad: 'Galaxy', jeton: 1000, emoji: '🌌' },
];

// emojileri bölmeden kısalt
const kisalt = (s, n) => {
  const h = Array.from(String(s ?? ''));
  return h.length > n ? h.slice(0, n - 1).join('') + '…' : h.join('');
};
const buyuk = (s) => s.toLocaleUpperCase('tr-TR');

function renkKoyu(hex, oran) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * oran)},${Math.round(((n >> 8) & 255) * oran)},${Math.round((n & 255) * oran)})`;
}
function renkSeffaf(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function birimKonumu(t, i) {
  const sutun = i % 10;
  const sira = Math.floor(i / 10);
  const x = 96 + sutun * 99 + (sira % 2 ? 24 : 0);
  const y = t === 0 ? ORTA - ON_MESAFE - sira * SIRA_ARALIK : ORTA + ON_MESAFE + sira * SIRA_ARALIK;
  return { x, y, onSaf: i < SABIT.onSaf };
}

export class Cizim {
  constructor(canvas, motor) {
    this.c = canvas;
    this.x = canvas.getContext('2d');
    this.motor = motor;
    this.zaman = 0;
    this.birimler = new Map(); // id -> { x, y, saldiri, flas, konus, itme }
    this.olenler = []; // ölüm animasyonları
    this.efektler = []; // mermi, iz, sayı, kalp, ateş topu, şok dalgası …
    this.parcaciklar = [];
    this.bildirimler = [];
    this.akis = []; // katılım / kalkan satırları
    this.oldurmeler = []; // düşürme akışı
    this.kartlar = []; // hediye kartları
    this.ejderhalar = [];
    this.sarsinti = 0;
    this.flas = 0;
    this.hedefParlama = 0;
    this.fotolar = new Map();
    this.yonergeSira = 0;
    this.yonergeZamani = 0;
    this.demoAcik = false;
    this.katalog = new Map(); // hediye adı (küçük harf) -> resim
    this.sesCal = () => {};
  }

  // Demodan gerçek yayına geçerken ya da oyun sıfırlanınca ekrandaki listeleri ve efektleri temizle
  temizle() {
    this.birimler.clear();
    this.olenler = [];
    this.efektler = [];
    this.parcaciklar = [];
    this.bildirimler = [];
    this.akis = [];
    this.oldurmeler = [];
    this.kartlar = [];
    this.ejderhalar = [];
    this.sarsinti = 0;
    this.flas = 0;
  }

  katalogGuncelle(liste) {
    if (!Array.isArray(liste)) return;
    for (const h of liste) {
      if (h && typeof h.ad === 'string' && typeof h.resim === 'string' && h.resim) {
        this.katalog.set(h.ad.toLocaleLowerCase('tr-TR'), h.resim);
      }
    }
    this.katalogListe = liste;
  }

  hediyeResmi(ad) {
    return this.katalog.get(String(ad || '').toLocaleLowerCase('tr-TR')) || '';
  }

  konum(id) {
    const b = this.birimler.get(id);
    if (b) return { x: b.x, y: b.y };
    for (let i = this.olenler.length - 1; i >= 0; i--) {
      if (this.olenler[i].id === id) return { x: this.olenler[i].x, y: this.olenler[i].y };
    }
    const o = this.motor.oyuncular.get(id);
    const t = o && o.takim !== -1 ? o.takim : 0;
    return { x: G / 2, y: t === 0 ? 520 : 1400 };
  }

  oyuncuBilgi(id) {
    const o = id ? this.motor.oyuncular.get(id) : null;
    if (!o) return { ad: '?', foto: '', takim: 0 };
    return { ad: this.motor.adGoster(o), foto: this.motor.fotoGoster(o), takim: o.takim };
  }

  // ------------------------------------------------------------ fx kuyruğu
  fxIsle() {
    const m = this.motor;
    const fx = m.fx.splice(0, m.fx.length);
    for (const f of fx) {
      switch (f.tip) {
        case 'bildirim':
          if (this.bildirimler.length >= 3) this.bildirimler.shift();
          this.bildirimler.push({ ...f, bas: this.zaman });
          break;
        case 'akis':
          this.akis.unshift({ metin: f.metin, renk: f.renk });
          this.akis.length = Math.min(this.akis.length, 3);
          break;
        case 'giris': {
          const b = this.birimler.get(f.id);
          const y = f.takim === 0 ? 470 : 1450;
          if (b) b.y = y;
          else this.birimler.set(f.id, { x: 120 + Math.random() * 840, y, saldiri: 0, flas: 0, konus: 0, itme: 0 });
          this.sesCal('giris');
          break;
        }
        case 'kilic': {
          const a = this.birimler.get(f.id);
          const h = this.konum(f.hedef);
          if (a) {
            a.saldiri = 0.22;
            this.efektler.push({ tip: 'iz', x0: a.x, y0: a.y, x1: h.x, y1: h.y, bas: this.zaman, sure: 0.16 });
          }
          if (Math.random() < 0.3) this.sesCal('kilic');
          break;
        }
        case 'darbe': {
          const b = this.birimler.get(f.id);
          if (b) {
            b.flas = 0.15;
            b.itme = 0.25;
            this.patlama(b.x, b.y, '#fde68a', 3, 140);
            this.efektler.push({ tip: 'sayi', x: b.x + (Math.random() - 0.5) * 20, y: b.y - 20, metin: `-${f.hasar}`, bas: this.zaman, sure: 0.7 });
          }
          break;
        }
        case 'olum': {
          const p = this.konum(f.id);
          let gecikme = 0;
          if (f.silah === 'tufek') gecikme = f.atis * TUFEK_ARALIK + 0.08;
          else if (f.silah === 'bomba') gecikme = BOMBA_UCUS;
          else if (f.silah === 'ejderha') gecikme = EJDERHA_GIRIS + (p.x / G) * EJDERHA_NEFES * 0.9;
          const yon = f.takim === 0 ? -1 : 1; // kendi tarafına doğru savrulur
          const bilgi = this.oyuncuBilgi(f.id);
          this.olenler.push({
            id: f.id, x: p.x, y: p.y, takim: f.takim, silah: f.silah, bas: this.zaman + gecikme, ad: bilgi.ad, foto: bilgi.foto,
            vx: (Math.random() - 0.5) * (f.silah === 'bomba' ? 700 : 260),
            vy: yon * (f.silah === 'bomba' ? 600 : 260) * (0.6 + Math.random() * 0.6),
            don: (Math.random() - 0.5) * 14,
          });
          this.birimler.delete(f.id);
          if (f.silah === 'kilic' && f.katil) this.oldurmeEkle(f.katil, [f.id], 'kilic');
          break;
        }
        case 'oldurme':
          if (f.olenler.length) this.oldurmeEkle(f.id, f.olenler, f.silah);
          break;
        case 'kalp': {
          if (this.efektler.filter((u) => u.tip === 'kalp').length > 40) break;
          const p = this.konum(f.id);
          this.efektler.push({ tip: 'kalp', x: p.x, y: p.y, bas: this.zaman, sure: 1 });
          break;
        }
        case 'konus': {
          const b = this.birimler.get(f.id);
          if (b) b.konus = 1.2;
          break;
        }
        case 'kalkan': {
          const p = this.konum(f.id);
          this.efektler.push({ tip: 'halka', x: p.x, y: p.y, renk: '#93c5fd', r: 60, bas: this.zaman, sure: 0.5 });
          this.sesCal('kalkan');
          break;
        }
        case 'kalkanKirildi': {
          const p = this.konum(f.id);
          this.patlama(p.x, p.y, '#60a5fa', 16, 280);
          this.efektler.push({ tip: 'sayi', x: p.x, y: p.y - 30, metin: '🛡️ KALKAN', bas: this.zaman, sure: 0.9, renk: '#93c5fd' });
          this.sesCal('kirik');
          break;
        }
        case 'tacKirildi': {
          const p = this.konum(f.id);
          this.patlama(p.x, p.y, '#fde047', 18, 280);
          this.efektler.push({ tip: 'sayi', x: p.x, y: p.y - 34, metin: '👑 TAÇ KIRILDI', bas: this.zaman, sure: 1.2, renk: '#fde047' });
          this.sesCal('kirik');
          break;
        }
        case 'botCikti': {
          const p = this.konum(f.id);
          this.patlama(p.x, p.y, '#94a3b8', 8, 120);
          this.birimler.delete(f.id);
          break;
        }
        case 'dirilis': {
          const p = this.konum(f.id);
          this.patlama(p.x, p.y, '#fef08a', 14, 170);
          this.efektler.push({ tip: 'halka', x: p.x, y: p.y, renk: '#fef08a', r: 70, bas: this.zaman, sure: 0.6 });
          break;
        }
        case 'tufek': {
          const a = this.konum(f.id);
          const b = this.birimler.get(f.id);
          f.hedefler.forEach((id, i) => {
            const h = this.konum(id);
            const bas = this.zaman + i * TUFEK_ARALIK;
            this.efektler.push({ tip: 'mermi', x0: a.x, y0: a.y, x1: h.x, y1: h.y, bas, sure: 0.08 });
            this.efektler.push({ tip: 'namlu', x: a.x, y: a.y, x1: h.x, y1: h.y, bas, sure: 0.07 });
            this.sesCal('tufek', i * TUFEK_ARALIK);
          });
          if (b) b.tufek = this.zaman + f.hedefler.length * TUFEK_ARALIK + 0.5;
          break;
        }
        case 'bomba': {
          const a = this.konum(f.id);
          const hedefler = f.hedefler.map((id) => this.konum(id));
          const hx = hedefler.length ? hedefler.reduce((s, p) => s + p.x, 0) / hedefler.length : G / 2;
          const hy = hedefler.length ? hedefler.reduce((s, p) => s + p.y, 0) / hedefler.length : f.takim === 0 ? 1100 : 820;
          this.efektler.push({ tip: 'bomba', x0: a.x, y0: a.y, x1: hx, y1: hy, bas: this.zaman, sure: BOMBA_UCUS });
          this.sesCal('firlat');
          this.sesCal('patlama', BOMBA_UCUS);
          break;
        }
        case 'ejderha':
          this.ejderhalar.push({ ...f, bas: this.zaman });
          this.sesCal('kukreme');
          this.sesCal('alev', EJDERHA_GIRIS);
          break;
        case 'kart': {
          const o = this.oyuncuBilgi(f.id);
          const hediye = f.hediye ? { ad: f.hediye.ad, resim: f.hediye.resim || this.hediyeResmi(f.hediye.ad) } : null;
          if (this.kartlar.length < 4) this.kartlar.push({ ...o, takim: f.takim, silah: f.silah, dusen: f.dusen, hediye, bas: null });
          break;
        }
        case 'hedef':
          this.hedefParlama = 1.5;
          this.sesCal('hedef');
          break;
        case 'sonSans':
          this.sesCal('alarm');
          break;
        case 'turSonu':
          this.sesCal('turSonu');
          break;
        default:
      }
    }
  }

  oldurmeEkle(katilId, olenler, silah) {
    const k = this.oyuncuBilgi(katilId);
    const kurbanlar = olenler.slice(0, 3).map((id) => this.oyuncuBilgi(id));
    this.oldurmeler.unshift({ katil: k, kurbanlar, sayi: olenler.length, silah, bas: this.zaman });
    this.oldurmeler.length = Math.min(this.oldurmeler.length, 5);
  }

  patlama(x, y, renk, n, hiz, omur = 0.6, yercekimi = 300) {
    for (let i = 0; i < n && this.parcaciklar.length < 500; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = hiz * (0.4 + Math.random() * 0.8);
      this.parcaciklar.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, renk, omur: omur * (0.7 + Math.random() * 0.6), bas: this.zaman, g: yercekimi, boy: 6 });
    }
  }

  duman(x, y, n) {
    for (let i = 0; i < n && this.parcaciklar.length < 500; i++) {
      this.parcaciklar.push({
        x: x + (Math.random() - 0.5) * 80, y: y + (Math.random() - 0.5) * 50,
        vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60,
        renk: 'rgba(80,80,90,0.55)', omur: 1.2 + Math.random() * 0.8, bas: this.zaman, g: -10, boy: 26 + Math.random() * 24, duman: true,
      });
    }
  }

  // ------------------------------------------------------------ ana çizim
  ciz(dt) {
    this.zaman += dt;
    const m = this.motor;
    const x = this.x;
    this.fxIsle();

    x.save();
    if (this.sarsinti > 0) {
      this.sarsinti -= dt;
      const g = Math.min(1, this.sarsinti * 2) * 20;
      x.translate((Math.random() - 0.5) * g, (Math.random() - 0.5) * g);
    }
    this.zemin();
    this.askerler(dt);
    this.olenleriCiz(dt);
    this.efektleriCiz();
    this.ejderhaCiz();
    this.parcaciklariCiz(dt);
    x.restore();
    if (this.flas > 0) {
      this.flas -= dt;
      x.fillStyle = `rgba(255,240,200,${Math.max(0, this.flas) * 2.5})`;
      x.fillRect(0, 0, G, Y);
    }

    this.ustBar();
    this.kaptanKartlari();
    this.begeniHedefi(dt);
    this.liderler();
    this.oldurmeAkisi();
    this.akisCiz();
    this.siraRozetleri();
    this.yonerge();
    this.silahTablosu();
    this.bildirimCiz();
    this.kartCiz();
    if (m.asama === 'hazirlik') this.hazirlikEkrani();
    this.sonSansCiz();
    if (m.asama === 'ara') this.araEkrani();
    if (m.asama === 'duraklat') this.perde('DURAKLATILDI');
    if (this.demoAcik || m.demoVerisi) this.demoFiligran();
    if (this.baglantiYok) this.rozet('⚠️ Oyun sunucusuyla bağlantı koptu, yeniden deneniyor…', G / 2, 1880 - 40, 'center', 'rgba(185,28,28,0.95)');
  }

  zemin() {
    const x = this.x;
    const m = this.motor;
    const a = m.ayarlar;
    x.fillStyle = '#05070c';
    x.fillRect(0, 0, G, Y);
    let gr = x.createLinearGradient(0, 476, 0, ORTA);
    gr.addColorStop(0, renkKoyu(a.takimlar[0].renk, 0.12));
    gr.addColorStop(1, renkKoyu(a.takimlar[0].renk, 0.45));
    x.fillStyle = gr;
    x.fillRect(0, 476, G, ORTA - 476);
    gr = x.createLinearGradient(0, ORTA, 0, 1450);
    gr.addColorStop(0, renkKoyu(a.takimlar[1].renk, 0.45));
    gr.addColorStop(1, renkKoyu(a.takimlar[1].renk, 0.12));
    x.fillStyle = gr;
    x.fillRect(0, ORTA, G, 1450 - ORTA);
    const parilti = 0.6 + 0.4 * Math.sin(this.zaman * 5);
    x.shadowColor = '#fff';
    x.shadowBlur = 20 * parilti;
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.fillRect(0, ORTA - 3, G, 6);
    x.shadowBlur = 0;
    x.font = `44px ${EMOJI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('⚔️', G / 2, ORTA);
    if (m.cilginBitis > m.saat) {
      const n = 0.5 + 0.5 * Math.sin(this.zaman * 10);
      x.strokeStyle = `rgba(251,191,36,${0.4 + n * 0.5})`;
      x.lineWidth = 14;
      x.strokeRect(7, 483, G - 14, 960);
    }
  }

  askerler(dt) {
    const x = this.x;
    const m = this.motor;
    const a = m.ayarlar;
    const k = 1 - Math.pow(1 - 0.14, dt * 60);
    const kaptanlar = new Set([0, 1].flatMap((t) => m.kaptanlar(t).map((o) => o.id)));
    for (let t = 0; t < 2; t++) {
      const renk = a.takimlar[t].renk;
      const yon = t === 0 ? 1 : -1; // düşmana doğru
      m.takimlar[t].askerler.forEach((id, i) => {
        const o = m.oyuncular.get(id);
        if (!o || !o.asker) return;
        const hedef = birimKonumu(t, i);
        let b = this.birimler.get(id);
        if (!b) {
          b = { x: hedef.x, y: t === 0 ? 470 : 1450, saldiri: 0, flas: 0, konus: 0, itme: 0 };
          this.birimler.set(id, b);
        }
        b.x += (hedef.x - b.x) * k;
        b.y += (hedef.y - b.y) * k;
        let yy = b.y;
        if (b.saldiri > 0) {
          b.saldiri -= dt;
          yy += Math.sin((b.saldiri / 0.22) * Math.PI) * 16 * yon;
        } else if (hedef.onSaf && m.asama !== 'ara') yy += Math.sin(this.zaman * 6 + i) * 2;
        if (b.itme > 0) {
          // vurulunca geri tepme
          b.itme -= dt;
          yy -= Math.sin((b.itme / 0.25) * Math.PI) * 12 * yon;
        }
        const kaptan = kaptanlar.has(id);
        const r = kaptan ? 22 : 18;

        // silah: tüfek atanda tüfek, ön safta kılıç
        if (b.tufek && b.tufek > this.zaman) {
          x.save();
          x.translate(b.x, yy);
          x.rotate(yon > 0 ? Math.PI / 2 : -Math.PI / 2);
          x.fillStyle = '#374151';
          x.fillRect(r * 0.4, -4, 34, 8);
          x.fillStyle = '#9ca3af';
          x.fillRect(r * 0.4 + 26, -3, 14, 6);
          x.restore();
        } else if (hedef.onSaf) {
          x.strokeStyle = '#e5e7eb';
          x.lineWidth = 4;
          x.beginPath();
          const aci = (b.saldiri > 0 ? 0.2 : 0.7) * (i % 2 ? 1 : -1);
          x.moveTo(b.x + r * 0.6, yy + yon * r * 0.3);
          x.lineTo(b.x + r * 0.6 + Math.sin(aci) * 26, yy + yon * (r * 0.3 + Math.cos(aci) * 26));
          x.stroke();
        }
        // gövde + profil fotoğrafı
        x.beginPath();
        x.arc(b.x, yy, r, 0, Math.PI * 2);
        x.fillStyle = renk;
        x.fill();
        const foto = a.profilFoto === 'hepsi' || (a.profilFoto === 'kaptan' && kaptan) ? m.fotoGoster(o) : '';
        const ad = m.adGoster(o);
        if (foto) this.fotoCiz(foto, b.x, yy, r - 2, ad);
        else this.basHarf(ad, b.x, yy, r * 0.95);
        if (b.flas > 0) {
          b.flas -= dt;
          x.beginPath();
          x.arc(b.x, yy, r, 0, Math.PI * 2);
          x.fillStyle = 'rgba(255,255,255,0.7)';
          x.fill();
        }
        x.lineWidth = kaptan ? 4 : 3;
        x.strokeStyle = kaptan ? '#fde047' : renk;
        x.beginPath();
        x.arc(b.x, yy, r, 0, Math.PI * 2);
        x.stroke();
        if (o.asker.kalkan > 0) {
          x.strokeStyle = 'rgba(96,165,250,0.95)';
          x.lineWidth = 3;
          x.beginPath();
          x.arc(b.x, yy, r + 6, 0, Math.PI * 2);
          x.stroke();
          if (o.asker.kalkan > 1) {
            x.font = `800 14px ${YAZI}`;
            x.fillStyle = '#93c5fd';
            x.textAlign = 'left';
            x.textBaseline = 'middle';
            x.fillText(`×${o.asker.kalkan}`, b.x + r + 6, yy - r);
          }
        }
        if (kaptan) {
          x.font = `24px ${EMOJI}`;
          x.textAlign = 'center';
          x.textBaseline = 'bottom';
          x.globalAlpha = o.asker.tacKullanildi ? 0.35 : 1;
          x.fillText('👑', b.x, yy - r + 4);
          x.globalAlpha = 1;
        }
        if (o.asker.can < SABIT.can) {
          const w = 34;
          x.fillStyle = 'rgba(0,0,0,0.6)';
          x.fillRect(b.x - w / 2, yy - r - 9, w, 5);
          x.fillStyle = o.asker.can > 50 ? '#4ade80' : o.asker.can > 25 ? '#facc15' : '#f87171';
          x.fillRect(b.x - w / 2, yy - r - 9, (w * Math.max(0, o.asker.can)) / SABIT.can, 5);
        }
        if (b.konus > 0) {
          b.konus -= dt;
          x.font = `20px ${EMOJI}`;
          x.textAlign = 'center';
          x.textBaseline = 'bottom';
          x.fillText('💬', b.x + r, yy - r);
        }
        x.font = `700 16px ${YAZI}`;
        x.textAlign = 'center';
        x.textBaseline = 'top';
        x.lineWidth = 4;
        x.strokeStyle = '#000';
        const kisaAd = kisalt(ad, 11);
        x.strokeText(kisaAd, b.x, yy + r + 2, 96);
        x.fillStyle = kaptan ? '#fde047' : o.bot ? '#94a3b8' : '#fff';
        x.fillText(kisaAd, b.x, yy + r + 2, 96);
      });
    }
  }

  olenleriCiz(dt) {
    const x = this.x;
    const m = this.motor;
    this.olenler = this.olenler.filter((o) => this.zaman - o.bas < 1.1);
    for (const o of this.olenler) {
      const t = this.zaman - o.bas;
      const renk = m.ayarlar.takimlar[o.takim]?.renk || '#888';
      if (t < 0) {
        // silah henüz varmadı: asker fotoğrafı ve adıyla yerinde duruyor
        x.beginPath();
        x.arc(o.x, o.y, 18, 0, Math.PI * 2);
        x.fillStyle = renk;
        x.fill();
        if (o.foto && m.ayarlar.profilFoto === 'hepsi') this.fotoCiz(o.foto, o.x, o.y, 16, o.ad);
        else this.basHarf(o.ad, o.x, o.y, 17);
        x.lineWidth = 3;
        x.strokeStyle = renk;
        x.beginPath();
        x.arc(o.x, o.y, 18, 0, Math.PI * 2);
        x.stroke();
        x.font = `700 16px ${YAZI}`;
        x.textAlign = 'center';
        x.textBaseline = 'top';
        x.lineWidth = 4;
        x.strokeStyle = '#000';
        const kisaAd = kisalt(o.ad, 11);
        x.strokeText(kisaAd, o.x, o.y + 20, 96);
        x.fillStyle = '#fff';
        x.fillText(kisaAd, o.x, o.y + 20, 96);
        continue;
      }
      if (!o.vuruldu) {
        o.vuruldu = true;
        if (o.silah === 'tufek') {
          this.patlama(o.x, o.y, '#fef3c7', 10, 260, 0.35);
          this.patlama(o.x, o.y, '#f87171', 6, 200, 0.4);
          this.efektler.push({ tip: 'halka', x: o.x, y: o.y, renk: '#fff7ed', r: 34, bas: this.zaman, sure: 0.18 });
        } else if (o.silah === 'ejderha') {
          this.patlama(o.x, o.y, '#f97316', 10, 160, 0.6, -120);
        } else this.patlama(o.x, o.y, '#e5e7eb', 6, 160);
      }
      // savrulan gövde
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.vy += 500 * dt;
      x.save();
      x.translate(o.x, o.y);
      x.rotate(t * o.don);
      x.globalAlpha = Math.max(0, 1 - t / 0.9);
      x.beginPath();
      x.arc(0, 0, 18, 0, Math.PI * 2);
      x.fillStyle = o.silah === 'ejderha' ? (t < 0.3 ? '#f97316' : '#1f2937') : renk;
      x.fill();
      x.font = `22px ${EMOJI}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(o.silah === 'ejderha' ? '🔥' : '💀', 0, 1);
      x.restore();
    }
    x.globalAlpha = 1;
  }

  efektleriCiz() {
    const x = this.x;
    this.efektler = this.efektler.filter((u) => this.zaman - u.bas < u.sure);
    for (const u of this.efektler) {
      const t = (this.zaman - u.bas) / u.sure;
      if (t < 0) continue;
      switch (u.tip) {
        case 'iz':
          x.strokeStyle = `rgba(255,255,255,${0.9 * (1 - t)})`;
          x.lineWidth = 3;
          x.beginPath();
          x.moveTo(u.x0, u.y0);
          x.lineTo(u.x1, u.y1);
          x.stroke();
          break;
        case 'sayi':
          x.globalAlpha = 1 - t;
          x.font = `900 ${u.metin.length > 5 ? 20 : 22}px ${YAZI}`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.lineWidth = 4;
          x.strokeStyle = '#000';
          x.strokeText(u.metin, u.x, u.y - t * 36);
          x.fillStyle = u.renk || '#fca5a5';
          x.fillText(u.metin, u.x, u.y - t * 36);
          x.globalAlpha = 1;
          break;
        case 'kalp':
          x.globalAlpha = 1 - t;
          x.font = `22px ${EMOJI}`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText('❤️', u.x + Math.sin(t * 9) * 8, u.y - t * 70);
          x.globalAlpha = 1;
          break;
        case 'halka':
          x.strokeStyle = u.renk;
          x.globalAlpha = 1 - t;
          x.lineWidth = 6 * (1 - t) + 1;
          x.beginPath();
          x.arc(u.x, u.y, 10 + u.r * t, 0, Math.PI * 2);
          x.stroke();
          x.globalAlpha = 1;
          break;
        case 'namlu': {
          // namlu alevi
          const aci = Math.atan2(u.y1 - u.y, u.x1 - u.x);
          x.save();
          x.translate(u.x + Math.cos(aci) * 40, u.y + Math.sin(aci) * 40);
          x.rotate(aci);
          const gr = x.createRadialGradient(0, 0, 2, 0, 0, 34);
          gr.addColorStop(0, 'rgba(255,255,220,1)');
          gr.addColorStop(0.4, 'rgba(253,186,116,0.9)');
          gr.addColorStop(1, 'rgba(249,115,22,0)');
          x.fillStyle = gr;
          x.beginPath();
          x.moveTo(0, -12);
          x.lineTo(46 * (1 - t * 0.5), 0);
          x.lineTo(0, 12);
          x.arc(0, 0, 12, Math.PI / 2, -Math.PI / 2);
          x.fill();
          x.restore();
          break;
        }
        case 'mermi': {
          // ince parlak mermi izi
          const bas = Math.max(0, t - 0.5);
          x.strokeStyle = 'rgba(254,243,199,0.95)';
          x.lineWidth = 4;
          x.shadowColor = '#fde68a';
          x.shadowBlur = 12;
          x.beginPath();
          x.moveTo(u.x0 + (u.x1 - u.x0) * bas, u.y0 + (u.y1 - u.y0) * bas);
          x.lineTo(u.x0 + (u.x1 - u.x0) * t, u.y0 + (u.y1 - u.y0) * t);
          x.stroke();
          x.shadowBlur = 0;
          break;
        }
        case 'bomba': {
          const px = u.x0 + (u.x1 - u.x0) * t;
          const py = u.y0 + (u.y1 - u.y0) * t - Math.sin(t * Math.PI) * 240;
          x.save();
          x.translate(px, py);
          x.rotate(t * 10);
          x.font = `${50 + Math.sin(t * Math.PI) * 24}px ${EMOJI}`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText('💣', 0, 0);
          x.restore();
          if (Math.random() < 0.8) this.patlama(px, py - 24, '#fde047', 1, 80, 0.25); // fitil kıvılcımı
          if (t > 0.93 && !u.patladi) {
            u.patladi = true;
            this.efektler.push({ tip: 'atesTopu', x: u.x1, y: u.y1, bas: this.zaman, sure: 0.7 });
            this.efektler.push({ tip: 'halka', x: u.x1, y: u.y1, renk: '#fff7ed', r: 380, bas: this.zaman, sure: 0.45 });
            this.patlama(u.x1, u.y1, '#fb923c', 60, 560, 0.7);
            this.patlama(u.x1, u.y1, '#fde047', 40, 420, 0.6);
            this.patlama(u.x1, u.y1, '#78350f', 20, 300, 0.9);
            this.duman(u.x1, u.y1, 16);
            this.sarsinti = 0.6;
            this.flas = 0.12;
          }
          break;
        }
        case 'atesTopu': {
          const r = 40 + t * 190;
          const gr = x.createRadialGradient(u.x, u.y, 0, u.x, u.y, r);
          gr.addColorStop(0, `rgba(255,255,230,${1 - t})`);
          gr.addColorStop(0.35, `rgba(253,186,116,${0.95 * (1 - t)})`);
          gr.addColorStop(0.7, `rgba(234,88,12,${0.7 * (1 - t)})`);
          gr.addColorStop(1, 'rgba(120,20,0,0)');
          x.fillStyle = gr;
          x.beginPath();
          x.arc(u.x, u.y, r, 0, Math.PI * 2);
          x.fill();
          break;
        }
        default:
      }
    }
  }

  ejderhaCiz() {
    if (!this.ejderhalar.length) return;
    const x = this.x;
    const e = this.ejderhalar[0];
    const t = this.zaman - e.bas;
    if (t > EJDERHA_SURE) {
      this.ejderhalar.shift();
      return;
    }
    const hedefY = e.takim === 0 ? 1200 : 720; // düşman yarısı
    const ejderhaY = e.takim === 0 ? 1040 : 880;
    const yon = e.takim === 0 ? 1 : -1; // alev aşağı mı yukarı mı
    x.fillStyle = `rgba(0,0,0,${0.4 * Math.min(1, t / 0.3, (EJDERHA_SURE - t) / 0.3)})`;
    x.fillRect(0, 0, G, Y);
    // ejderha girer, nefes boyunca soldan sağa süzülür, çıkar
    let ex;
    if (t < EJDERHA_GIRIS) ex = -220 + (t / EJDERHA_GIRIS) * 300;
    else if (t < EJDERHA_GIRIS + EJDERHA_NEFES) ex = 80 + ((t - EJDERHA_GIRIS) / EJDERHA_NEFES) * (G - 160);
    else ex = G - 80 + ((t - EJDERHA_GIRIS - EJDERHA_NEFES) / (EJDERHA_SURE - EJDERHA_GIRIS - EJDERHA_NEFES)) * 320;
    const ey = ejderhaY - yon * 150 + Math.sin(t * 7) * 12;
    // alev püskürtme
    if (t > EJDERHA_GIRIS && t < EJDERHA_GIRIS + EJDERHA_NEFES) {
      const agizX = ex + 40;
      const agizY = ey + yon * 40;
      const gr = x.createLinearGradient(agizX, agizY, agizX, hedefY);
      gr.addColorStop(0, 'rgba(255,255,220,0.95)');
      gr.addColorStop(0.3, 'rgba(253,186,116,0.85)');
      gr.addColorStop(0.7, 'rgba(234,88,12,0.6)');
      gr.addColorStop(1, 'rgba(127,29,29,0)');
      x.fillStyle = gr;
      x.beginPath();
      x.moveTo(agizX - 10, agizY);
      x.lineTo(agizX - 170, hedefY + yon * 220);
      x.lineTo(agizX + 170, hedefY + yon * 220);
      x.lineTo(agizX + 10, agizY);
      x.closePath();
      x.fill();
      for (let i = 0; i < 6; i++) {
        const k = Math.random();
        this.parcaciklar.push({
          x: agizX + (Math.random() - 0.5) * 30, y: agizY,
          vx: (Math.random() - 0.5) * 360, vy: yon * (500 + Math.random() * 400),
          renk: k < 0.4 ? '#fde047' : k < 0.8 ? '#f97316' : '#dc2626', omur: 0.6 + Math.random() * 0.4,
          bas: this.zaman, g: -200 * yon, boy: 10 + Math.random() * 12,
        });
      }
      if (Math.random() < 0.25) this.duman(agizX, hedefY + yon * 80, 1);
    }
    x.save();
    x.translate(ex, ey);
    x.scale(-1, 1); // sağa baksın
    x.font = `200px ${EMOJI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('🐉', 0, 0);
    x.restore();
    if (t > EJDERHA_GIRIS && !e.sarsti) {
      e.sarsti = true;
      this.sarsinti = EJDERHA_NEFES;
    }
  }

  parcaciklariCiz(dt) {
    const x = this.x;
    this.parcaciklar = this.parcaciklar.filter((p) => this.zaman - p.bas < p.omur);
    for (const p of this.parcaciklar) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      const yas = (this.zaman - p.bas) / p.omur;
      x.globalAlpha = Math.max(0, 1 - yas);
      x.fillStyle = p.renk;
      if (p.duman) {
        x.beginPath();
        x.arc(p.x, p.y, p.boy * (1 + yas), 0, Math.PI * 2);
        x.fill();
      } else x.fillRect(p.x - p.boy / 2, p.y - p.boy / 2, p.boy, p.boy);
    }
    x.globalAlpha = 1;
  }

  // ------------------------------------------------------------ arayüz
  ustBar() {
    const x = this.x;
    const m = this.motor;
    const a = m.ayarlar;
    x.font = `800 30px ${YAZI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.fillText(`⚔️ CEPHE KAPIŞMASI · ${m.turNo}. TUR`, G / 2, 105);

    x.font = `900 34px ${YAZI}`;
    for (let t = 0; t < 2; t++) {
      x.textAlign = t === 0 ? 'left' : 'right';
      const metin = t === 0 ? `${buyuk(a.takimlar[0].ad)}  🏆${m.galibiyet[0]}` : `🏆${m.galibiyet[1]}  ${buyuk(a.takimlar[1].ad)}`;
      x.lineWidth = 6;
      x.strokeStyle = '#000';
      x.strokeText(metin, t === 0 ? 40 : G - 40, 172);
      x.fillStyle = a.takimlar[t].renk;
      x.fillText(metin, t === 0 ? 40 : G - 40, 172);
    }
    const c0 = m.canli(0), c1 = m.canli(1);
    const oran = c0 + c1 ? c0 / (c0 + c1) : 0.5;
    x.fillStyle = a.takimlar[1].renk;
    this.yuvarlak(40, 198, 1000, 44, 22);
    x.fill();
    x.save();
    this.yuvarlak(40, 198, 1000, 44, 22);
    x.clip();
    x.fillStyle = a.takimlar[0].renk;
    x.fillRect(40, 198, 1000 * oran, 44);
    x.restore();
    x.font = `900 26px ${YAZI}`;
    x.fillStyle = '#fff';
    x.textAlign = 'left';
    x.fillText(`${c0} asker`, 58, 221);
    x.textAlign = 'right';
    x.fillText(`${c1} asker`, G - 58, 221);
    const sn = Math.max(0, Math.ceil(m.kalan));
    const sure = `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`;
    const savas = m.asama === 'savas' || m.asama === 'uzatma';
    const sonOtuz = savas && m.kalan <= 30;
    x.font = `900 ${Math.round(46 * (sonOtuz ? 1 + 0.08 * Math.sin(this.zaman * 10) : 1))}px ${YAZI}`;
    x.textAlign = 'center';
    x.fillStyle = sonOtuz ? '#f87171' : '#fff';
    const onEk = { hazirlik: 'HAZIRLIK ', uzatma: 'UZATMA ', ara: 'ARA ' }[m.asama] || '';
    x.fillText(onEk + sure, G / 2, 270);
    for (let t = 0; t < 2; t++) {
      const x0 = t === 0 ? 40 : 700;
      x.fillStyle = 'rgba(255,255,255,0.12)';
      this.yuvarlak(x0, 264, 340, 12, 6);
      x.fill();
      const of = m.takimlar[t].ofke / SABIT.ofkeTavan;
      if (of > 0) {
        x.fillStyle = a.takimlar[t].renk;
        this.yuvarlak(t === 0 ? x0 : x0 + 340 * (1 - of), 264, 340 * of, 12, 6);
        x.fill();
      }
      x.font = `700 16px ${YAZI}`;
      x.fillStyle = '#94a3b8';
      x.textAlign = t === 0 ? 'left' : 'right';
      x.fillText(`🔥 öfke ×${(1 + of).toFixed(1)}`, t === 0 ? x0 : x0 + 340, 290);
    }
  }

  kaptanKartlari() {
    const x = this.x;
    const m = this.motor;
    const a = m.ayarlar;
    for (let t = 0; t < 2; t++) {
      const x0 = t === 0 ? 20 : 550;
      const w = 510;
      const kaptanlar = m.kaptanlar(t);
      x.fillStyle = 'rgba(0,0,0,0.55)';
      this.yuvarlak(x0, 306, w, 136, 18);
      x.fill();
      x.strokeStyle = renkSeffaf(a.takimlar[t].renk, 0.8);
      x.lineWidth = 3;
      x.stroke();
      x.textBaseline = 'middle';
      if (!kaptanlar.length) {
        x.font = `800 22px ${YAZI}`;
        x.fillStyle = a.takimlar[t].renk;
        x.textAlign = 'center';
        x.fillText(`👑 ${buyuk(a.takimlar[t].ad)} KAPTANI`, x0 + w / 2, 346);
        x.font = `600 20px ${YAZI}`;
        x.fillStyle = '#94a3b8';
        x.fillText('Henüz yok — hediye at, düşman düşür!', x0 + w / 2, 394, w - 30);
        continue;
      }
      const goster = kaptanlar.slice(0, 3);
      // sondan başa çiz: birinci kaptan en üstte görünsün
      [...goster].reverse().forEach((o, j) => {
        const i = goster.length - 1 - j;
        const cx = x0 + 62 + i * 34;
        x.beginPath();
        x.arc(cx, 376, 44, 0, Math.PI * 2);
        x.fillStyle = a.takimlar[t].renk;
        x.fill();
        const foto = a.profilFoto !== 'yok' ? m.fotoGoster(o) : '';
        if (foto) this.fotoCiz(foto, cx, 376, 41, m.adGoster(o));
        else this.basHarf(m.adGoster(o), cx, 376, 40);
        x.lineWidth = 4;
        x.strokeStyle = '#fde047';
        x.beginPath();
        x.arc(cx, 376, 44, 0, Math.PI * 2);
        x.stroke();
      });
      x.font = `30px ${EMOJI}`;
      x.textAlign = 'center';
      x.fillText('👑', x0 + 62, 328);
      const metinX = x0 + 62 + (goster.length - 1) * 34 + 62;
      x.textAlign = 'left';
      x.font = `800 20px ${YAZI}`;
      x.fillStyle = a.takimlar[t].renk;
      x.fillText(kaptanlar.length > 1 ? `KAPTANLAR (${kaptanlar.length} eşit)` : 'KAPTAN', metinX, 338);
      x.font = `900 30px ${YAZI}`;
      x.fillStyle = '#fff';
      const adlar = kaptanlar.length > 1
        ? goster.map((o) => kisalt(m.adGoster(o), 8)).join(', ') + (kaptanlar.length > 3 ? ` +${kaptanlar.length - 3}` : '')
        : kisalt(m.adGoster(kaptanlar[0]), 16);
      x.fillText(adlar, metinX, 378, x0 + w - metinX - 14);
      x.font = `700 22px ${YAZI}`;
      x.fillStyle = '#fde68a';
      x.fillText(`${kaptanlar[0].puan} puan`, metinX, 416);
    }
  }

  begeniHedefi(dt) {
    const m = this.motor;
    const hedef = m.ayarlar.begeniHedefi;
    if (!hedef) return;
    const x = this.x;
    const oran = Math.min(1, m.begeniSayaci / hedef);
    if (this.hedefParlama > 0) this.hedefParlama -= dt;
    x.fillStyle = 'rgba(0,0,0,0.6)';
    this.yuvarlak(20, 448, G - 40, 26, 13);
    x.fill();
    const gr = x.createLinearGradient(20, 0, G - 20, 0);
    gr.addColorStop(0, '#ec4899');
    gr.addColorStop(1, '#f43f5e');
    x.fillStyle = gr;
    if (oran > 0) {
      this.yuvarlak(20, 448, (G - 40) * oran, 26, 13);
      x.fill();
    }
    if (this.hedefParlama > 0) {
      x.fillStyle = `rgba(255,255,255,${0.5 * Math.abs(Math.sin(this.zaman * 12))})`;
      this.yuvarlak(20, 448, G - 40, 26, 13);
      x.fill();
    }
    x.font = `800 17px ${YAZI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.fillText(`❤️ Beğeni hedefi ${Math.floor(m.begeniSayaci)} / ${hedef} → 🔥 Çılgın An (çift hasar)`, G / 2, 462);
  }

  liderler() {
    const x = this.x;
    const m = this.motor;
    if (m.asama === 'ara') return;
    for (let t = 0; t < 2; t++) {
      const liste = m.siralama(t).slice(0, 3);
      if (!liste.length) continue;
      const y0 = t === 0 ? 486 : 1318;
      x.fillStyle = 'rgba(0,0,0,0.5)';
      this.yuvarlak(20, y0, 300, 20 + liste.length * 30, 12);
      x.fill();
      x.textAlign = 'left';
      x.textBaseline = 'middle';
      liste.forEach(({ oyuncu, sira }, i) => {
        x.font = `700 20px ${YAZI}`;
        x.fillStyle = sira === 1 ? '#fde047' : '#fff';
        x.fillText(`${sira === 1 ? '👑' : sira + '.'} ${kisalt(m.adGoster(oyuncu), 12)}`, 32, y0 + 25 + i * 30, 230);
        x.textAlign = 'right';
        x.fillStyle = '#cbd5e1';
        x.fillText(`${oyuncu.puan}`, 308, y0 + 25 + i * 30);
        x.textAlign = 'left';
      });
    }
  }

  // Sağ üst: kim kimi düşürdü (profil fotoğraflı)
  oldurmeAkisi() {
    if (!this.oldurmeler.length || this.motor.asama === 'ara') return;
    const x = this.x;
    const a = this.motor.ayarlar;
    const y0 = 486;
    x.fillStyle = 'rgba(0,0,0,0.55)';
    this.yuvarlak(680, y0, 380, 10 + this.oldurmeler.length * 44, 12);
    x.fill();
    this.oldurmeler.forEach((s, i) => {
      const y = y0 + 27 + i * 44;
      x.globalAlpha = i === 0 ? 1 : 0.88;
      this.miniFoto(s.katil, 708, y, a.takimlar[s.katil.takim]?.renk);
      x.font = `800 19px ${YAZI}`;
      x.textAlign = 'left';
      x.textBaseline = 'middle';
      x.fillStyle = a.takimlar[s.katil.takim]?.renk || '#fff';
      x.fillText(kisalt(s.katil.ad, 9), 728, y, 120);
      x.font = `22px ${EMOJI}`;
      x.textAlign = 'center';
      x.fillText(SILAH_IKON[s.silah] || '⚔️', 868, y);
      if (s.sayi === 1) {
        const k = s.kurbanlar[0];
        this.miniFoto(k, 900, y, a.takimlar[k.takim]?.renk);
        x.font = `700 19px ${YAZI}`;
        x.textAlign = 'left';
        x.fillStyle = '#e2e8f0';
        x.fillText(kisalt(k.ad, 8), 920, y, 128);
      } else {
        s.kurbanlar.forEach((k, j) => this.miniFoto(k, 900 + j * 16, y, a.takimlar[k.takim]?.renk));
        x.font = `900 20px ${YAZI}`;
        x.textAlign = 'left';
        x.fillStyle = '#fca5a5';
        x.fillText(`×${s.sayi}`, 900 + (s.kurbanlar.length - 1) * 16 + 22, y);
      }
    });
    x.globalAlpha = 1;
  }

  miniFoto(o, cx, cy, renk) {
    const x = this.x;
    x.beginPath();
    x.arc(cx, cy, 15, 0, Math.PI * 2);
    x.fillStyle = renk || '#475569';
    x.fill();
    if (o.foto && this.motor.ayarlar.profilFoto !== 'yok') this.fotoCiz(o.foto, cx, cy, 14, o.ad);
    else this.basHarf(o.ad, cx, cy, 15);
    x.lineWidth = 2;
    x.strokeStyle = '#0f172a';
    x.beginPath();
    x.arc(cx, cy, 15, 0, Math.PI * 2);
    x.stroke();
  }

  // Sağ alt: katılım ve kalkan satırları
  akisCiz() {
    if (!this.akis.length || this.motor.asama === 'ara') return;
    const x = this.x;
    const y0 = 1318;
    x.fillStyle = 'rgba(0,0,0,0.5)';
    this.yuvarlak(680, y0, 380, 10 + this.akis.length * 34, 12);
    x.fill();
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    this.akis.forEach((s, i) => {
      x.font = `700 19px ${YAZI}`;
      x.fillStyle = s.renk || '#fff';
      x.globalAlpha = i === 0 ? 1 : 0.85;
      x.fillText(kisalt(s.metin, 30), 694, y0 + 23 + i * 34, 356);
    });
    x.globalAlpha = 1;
  }

  siraRozetleri() {
    const m = this.motor;
    for (let t = 0; t < 2; t++) {
      const n = m.takimlar[t].sira.length;
      if (n > 0) this.rozet(`+${n} sırada`, G - 24, t === 0 ? 720 : 1270, 'right', renkSeffaf(m.ayarlar.takimlar[t].renk, 0.9));
    }
  }

  yonerge() {
    const x = this.x;
    const m = this.motor;
    const a = m.ayarlar;
    if (this.zaman - this.yonergeZamani > 5) {
      this.yonergeZamani = this.zaman;
      this.yonergeSira++;
    }
    const liste = [
      '❤️ Beğen → savaşa katıl',
      `💬 1 yaz → ${buyuk(a.takimlar[0].ad)}  |  2 yaz → ${buyuk(a.takimlar[1].ad)}`,
      '❤️ Beğeni askerini iyileştirir, takımını öfkelendirir',
      '➕ Takip et → 🛡️ kalkan',
    ];
    let metin = liste[this.yonergeSira % liste.length];
    let renk = '#fff';
    const savas = m.asama === 'savas' || m.asama === 'uzatma';
    if (savas && m.kalan <= 30) {
      metin = '⏱️ SON 30 SANİYE! Beğen, takımına asker yolla!';
      renk = '#fca5a5';
    } else if (m.asama === 'ara') metin = '❤️ Şimdi beğen → yeni turda hazır ol';
    else if (m.asama === 'hazirlik') metin = '❤️ Beğen ve katıl! Savaş birazdan başlıyor';
    x.fillStyle = 'rgba(0,0,0,0.72)';
    x.fillRect(0, 1460, G, 70);
    x.font = `800 33px ${YAZI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = renk;
    x.fillText(metin, G / 2, 1496, G - 40);
  }

  // Bir silah kademesine düşen örnek hediyeler (önce bilinen TR hediyeleri, eksikse katalogdan)
  ornekHediyeler(alt, ust, n = 3) {
    const secilen = ORNEK_HEDIYELER.filter((h) => h.jeton >= alt && h.jeton < ust).slice(0, n);
    if (secilen.length < n && Array.isArray(this.katalogListe)) {
      for (const h of this.katalogListe) {
        if (secilen.length >= n) break;
        if (h.jeton >= alt && h.jeton < ust && h.resim && !secilen.some((x) => x.ad === h.ad)) secilen.push({ ad: h.ad, jeton: h.jeton, emoji: '🎁' });
      }
    }
    return secilen;
  }

  silahTablosu() {
    const x = this.x;
    const a = this.motor.ayarlar;
    const e = jetonEsikleri(a);
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.fillRect(0, 1530, G, 390);
    x.textBaseline = 'middle';
    x.font = `700 19px ${YAZI}`;
    x.fillStyle = '#94a3b8';
    x.textAlign = 'center';
    x.fillText('HEDİYE SİLAHLARI (isteğe bağlı)', G / 2, 1550);
    const satirlar = [
      { ikon: '🛡️', baslik: 'KALKAN', etki: 'kalkan + arkadaşını dirilt', esik: `1–${e.tufek - 1} 🪙`, alt: 1, ust: e.tufek },
      { ikon: '🔫', baslik: 'TÜFEK', etki: `her ${e.tufek} 🪙 = 1 düşman`, esik: `${e.tufek}+ 🪙`, alt: e.tufek, ust: e.bomba },
      { ikon: '💣', baslik: 'BOMBA', etki: `${a.bombaKisi}+ düşman düşür`, esik: `${e.bomba}+ 🪙`, alt: e.bomba, ust: e.ejderha },
      { ikon: '🐉', baslik: 'EJDERHA', etki: 'turu direkt kazan', esik: `${e.ejderha}+ 🪙`, alt: e.ejderha, ust: Infinity },
    ];
    satirlar.forEach((r, i) => {
      const y = 1600 + i * 80;
      x.font = `40px ${EMOJI}`;
      x.textAlign = 'center';
      x.fillStyle = '#fff';
      x.fillText(r.ikon, 58, y);
      x.textAlign = 'left';
      x.font = `900 24px ${YAZI}`;
      x.fillStyle = '#fde68a';
      x.fillText(`${r.baslik}  ${r.esik}`, 94, y - 14, 320);
      x.font = `700 19px ${YAZI}`;
      x.fillStyle = '#e2e8f0';
      x.fillText(r.etki, 94, y + 16, 320);
      // örnek hediyeler: resim + ad + jeton
      this.ornekHediyeler(r.alt, r.ust).forEach((h, j) => {
        const cx = 470 + j * 200;
        x.fillStyle = 'rgba(255,255,255,0.07)';
        this.yuvarlak(cx - 30, y - 34, 190, 68, 14);
        x.fill();
        const resim = this.hediyeResmi(h.ad);
        if (resim) this.resimCiz(resim, cx, y, 26);
        else {
          x.font = `40px ${EMOJI}`;
          x.textAlign = 'center';
          x.fillStyle = '#fff';
          x.fillText(h.emoji, cx, y + 2);
        }
        x.textAlign = 'left';
        x.font = `800 18px ${YAZI}`;
        x.fillStyle = '#fff';
        x.fillText(kisalt(h.ad, 11), cx + 34, y - 11, 120);
        x.font = `700 17px ${YAZI}`;
        x.fillStyle = '#fbbf24';
        x.fillText(`🪙 ${h.jeton}`, cx + 34, y + 14, 120);
      });
    });
  }

  bildirimCiz() {
    const x = this.x;
    this.bildirimler = this.bildirimler.filter((b) => this.zaman - b.bas < b.sure);
    this.bildirimler.forEach((b, i) => {
      const t = this.zaman - b.bas;
      x.globalAlpha = Math.min(1, t / 0.2, (b.sure - t) / 0.3);
      const y0 = 800 + i * 70;
      x.font = `900 40px ${YAZI}`;
      const w = Math.min(G - 60, x.measureText(b.metin).width + 60);
      x.fillStyle = 'rgba(0,0,0,0.78)';
      this.yuvarlak(G / 2 - w / 2, y0 - 32, w, 64, 32);
      x.fill();
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = b.renk || '#fff';
      x.fillText(b.metin, G / 2, y0, G - 90);
      x.globalAlpha = 1;
    });
  }

  // Bomba / ejderha atanın büyük kartı
  kartCiz() {
    if (!this.kartlar.length) return;
    const k = this.kartlar[0];
    if (k.bas === null) k.bas = this.zaman;
    const sure = k.silah === 'ejderha' ? EJDERHA_SURE : 2.2;
    const t = this.zaman - k.bas;
    if (t > sure) {
      this.kartlar.shift();
      return;
    }
    const x = this.x;
    const a = this.motor.ayarlar;
    const renk = a.takimlar[k.takim]?.renk || '#64748b';
    const giris = Math.min(1, t / 0.18);
    const cikis = Math.min(1, (sure - t) / 0.25);
    const olcek = 0.8 + 0.2 * giris;
    const cy = k.takim === 0 ? 640 : 1180; // atanın kendi yarısı
    x.save();
    x.globalAlpha = Math.min(giris, cikis);
    x.translate(G / 2, cy);
    x.scale(olcek, olcek);
    x.fillStyle = 'rgba(2,6,23,0.88)';
    this.yuvarlak(-420, -110, 840, 220, 28);
    x.fill();
    x.lineWidth = 6;
    x.strokeStyle = renk;
    x.stroke();
    x.beginPath();
    x.arc(-300, 0, 80, 0, Math.PI * 2);
    x.fillStyle = renk;
    x.fill();
    if (k.foto && a.profilFoto !== 'yok') this.fotoCiz(k.foto, -300, 0, 75, k.ad);
    else this.basHarf(k.ad, -300, 0, 70);
    x.lineWidth = 6;
    x.strokeStyle = '#fde047';
    x.beginPath();
    x.arc(-300, 0, 80, 0, Math.PI * 2);
    x.stroke();
    x.font = `64px ${EMOJI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(SILAH_IKON[k.silah], -230, 60);
    // gönderilen hediyenin resmi (sağda)
    if (k.hediye?.resim) this.resimCiz(k.hediye.resim, 340, -20, 58);
    x.textAlign = 'left';
    x.font = `900 46px ${YAZI}`;
    x.fillStyle = '#fff';
    x.fillText(kisalt(k.ad, 16), -190, -40, k.hediye?.resim ? 450 : 590);
    x.font = `900 40px ${YAZI}`;
    x.fillStyle = renk;
    x.fillText(k.silah === 'ejderha' ? '🐉 EJDERHA ÇAĞIRDI!' : '💣 BOMBA ATTI!', -190, 14, k.hediye?.resim ? 450 : 590);
    x.font = `700 28px ${YAZI}`;
    x.fillStyle = '#fde68a';
    const alt = k.silah === 'ejderha' ? 'Tur bitti, takımı kazandı!' : `${k.dusen} düşman düştü`;
    x.fillText(k.hediye ? `${kisalt(k.hediye.ad, 18)} · ${alt}` : alt, -190, 62, 590);
    x.restore();
  }

  hazirlikEkrani() {
    const x = this.x;
    const m = this.motor;
    const n = 1 + 0.05 * Math.sin(this.zaman * 6);
    x.fillStyle = 'rgba(0,0,0,0.5)';
    this.yuvarlak(90, ORTA - 120, G - 180, 240, 30);
    x.fill();
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `900 ${Math.round(64 * n)}px ${YAZI}`;
    x.fillStyle = '#fff';
    x.fillText('❤️ BEĞEN VE KATIL!', G / 2, ORTA - 40);
    x.font = `800 34px ${YAZI}`;
    x.fillStyle = '#fde68a';
    x.fillText(`Savaş ${Math.max(1, Math.ceil(m.kalan))} sn sonra başlıyor`, G / 2, ORTA + 30);
    x.font = `700 24px ${YAZI}`;
    x.fillStyle = '#cbd5e1';
    x.fillText('Takım seçmek için 1 ya da 2 yaz', G / 2, ORTA + 76);
  }

  sonSansCiz() {
    const m = this.motor;
    const x = this.x;
    for (let t = 0; t < 2; t++) {
      const bitis = m.takimlar[t].sonSansBitis;
      if (!bitis || m.asama === 'ara') continue;
      const kalan = Math.max(0, bitis - m.saat);
      const y = t === 0 ? 700 : 1220;
      const n = 0.5 + 0.5 * Math.sin(this.zaman * 12);
      x.fillStyle = renkSeffaf(m.ayarlar.takimlar[t].renk, 0.6 + 0.3 * n);
      x.fillRect(0, y - 70, G, 140);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = `900 46px ${YAZI}`;
      x.fillStyle = '#fff';
      x.fillText(`${buyuk(m.ayarlar.takimlar[t].ad)} YOK OLUYOR! ${Math.ceil(kalan)}`, G / 2, y - 18);
      x.font = `800 28px ${YAZI}`;
      x.fillText(`❤️ Beğen, ${buyuk(m.ayarlar.takimlar[t].ad)}'ı kurtar!`, G / 2, y + 34);
    }
  }

  araEkrani() {
    const x = this.x;
    const m = this.motor;
    const a = m.ayarlar;
    const s = m.sonuc;
    if (!s) return;
    // ejderha uçarken sonuç yazısı beklesin
    const gecen = m.saat - m.bitisSaati - (s.neden === 'ejderha' ? EJDERHA_SURE : 0);
    if (gecen < 0) return;
    const renk = s.kazanan === -1 ? '#64748b' : a.takimlar[s.kazanan].renk;
    if (gecen < 3) {
      x.fillStyle = 'rgba(0,0,0,0.55)';
      x.fillRect(0, 300, G, 1160);
      x.fillStyle = renkSeffaf(renk, 0.95);
      x.fillRect(0, ORTA - 120, G, 230);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = `900 76px ${YAZI}`;
      x.fillStyle = '#fff';
      x.fillText(s.kazanan === -1 ? 'BERABERE!' : `${buyuk(a.takimlar[s.kazanan].ad)} KAZANDI!`, G / 2, ORTA - 40, G - 60);
      x.font = `800 34px ${YAZI}`;
      const neden = {
        ejderha: `🐉 Ejderha: ${s.kahraman?.ad || ''}`,
        yok: `💀 ${s.kazanan === -1 ? '' : buyuk(a.takimlar[1 - s.kazanan].ad)} tükendi`,
        sure: `⏱️ Süre doldu · ${s.canli[0]} – ${s.canli[1]} asker`,
      }[s.neden];
      x.fillText(neden, G / 2, ORTA + 45, G - 60);
      return;
    }
    x.fillStyle = 'rgba(3,6,12,0.93)';
    x.fillRect(0, 300, G, 1160);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `900 46px ${YAZI}`;
    x.fillStyle = '#fde047';
    x.fillText('👑 KAPTAN SIRALAMASI', G / 2, 380);
    for (let t = 0; t < 2; t++) {
      const x0 = t === 0 ? 40 : 560;
      x.textAlign = 'left';
      x.font = `900 30px ${YAZI}`;
      x.fillStyle = a.takimlar[t].renk;
      x.fillText(buyuk(a.takimlar[t].ad), x0, 450);
      const liste = m.siralama(t).slice(0, 7);
      if (!liste.length) {
        x.font = `600 24px ${YAZI}`;
        x.fillStyle = '#64748b';
        x.fillText('Henüz puan yok', x0, 500);
      }
      liste.forEach(({ oyuncu, sira }, i) => {
        const y = 510 + i * 82;
        const cx = x0 + 34;
        const ad = m.adGoster(oyuncu);
        x.beginPath();
        x.arc(cx, y, 30, 0, Math.PI * 2);
        x.fillStyle = a.takimlar[t].renk;
        x.fill();
        const foto = a.profilFoto !== 'yok' ? m.fotoGoster(oyuncu) : '';
        if (foto) this.fotoCiz(foto, cx, y, 28, ad);
        else this.basHarf(ad, cx, y, 26);
        if (sira === 1) {
          x.lineWidth = 4;
          x.strokeStyle = '#fde047';
          x.beginPath();
          x.arc(cx, y, 30, 0, Math.PI * 2);
          x.stroke();
          x.font = `24px ${EMOJI}`;
          x.textAlign = 'center';
          x.fillText('👑', cx, y - 34);
        }
        x.textAlign = 'left';
        x.font = `900 26px ${YAZI}`;
        x.fillStyle = sira === 1 ? '#fde047' : '#fff';
        x.fillText(`${sira}. ${kisalt(ad, 13)}`, x0 + 76, y - 12, 400);
        x.font = `600 20px ${YAZI}`;
        x.fillStyle = '#94a3b8';
        x.fillText(`${oyuncu.puan} puan · ${oyuncu.oldurme} düşürme`, x0 + 76, y + 18);
      });
    }
    let hazir = 0;
    for (const o of m.oyuncular.values()) if (o.hazir !== null) hazir++;
    x.textAlign = 'center';
    x.font = `900 46px ${YAZI}`;
    x.fillStyle = '#fff';
    x.fillText(`Yeni tur ${Math.max(1, Math.ceil(m.kalan))}…`, G / 2, 1150);
    x.font = `800 30px ${YAZI}`;
    x.fillStyle = '#fca5a5';
    x.fillText(`❤️ Beğen, yeni turda hazır ol! (Hazır: ${hazir})`, G / 2, 1210, G - 60);
    x.font = `600 22px ${YAZI}`;
    x.fillStyle = '#64748b';
    x.fillText('Eşit puan alanlar aynı sırayı paylaşır', G / 2, 1260);
  }

  perde(metin) {
    const x = this.x;
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.fillRect(0, 300, G, 1160);
    x.font = `900 72px ${YAZI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.fillText(metin, G / 2, ORTA);
  }

  demoFiligran() {
    const x = this.x;
    x.save();
    x.translate(G / 2, Y / 2);
    x.rotate(-Math.PI / 5);
    x.font = `900 120px ${YAZI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = 'rgba(251,191,36,0.22)';
    x.fillText('DEMO – test verisi', 0, -300);
    x.fillText('DEMO – test verisi', 0, 300);
    x.restore();
    this.rozet('DEMO', G / 2, 36, 'center', 'rgba(245,158,11,0.95)', '#000');
  }

  // ------------------------------------------------------------ küçük yardımcılar
  rozet(metin, xx, yy, hiza, zemin, yaziRengi = '#fff') {
    const x = this.x;
    x.font = `800 22px ${YAZI}`;
    const w = x.measureText(metin).width + 28;
    const sol = hiza === 'right' ? xx - w : hiza === 'center' ? xx - w / 2 : xx;
    x.fillStyle = zemin;
    this.yuvarlak(sol, yy, w, 36, 18);
    x.fill();
    x.fillStyle = yaziRengi;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(metin, sol + w / 2, yy + 18);
  }

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

  basHarf(ad, cx, cy, r) {
    const x = this.x;
    const ilk = Array.from(String(ad || '?'))[0] || '?';
    x.font = `900 ${Math.round(r)}px ${YAZI}, ${EMOJI}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.fillText(ilk.toLocaleUpperCase('tr-TR'), cx, cy + 2);
  }

  resimCiz(url, cx, cy, r) {
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
    if (f.durum === 'hazir') this.x.drawImage(f.img, cx - r, cy - r, r * 2, r * 2);
  }

  fotoCiz(url, cx, cy, r, ad) {
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
    if (f.durum !== 'hazir') {
      if (ad) this.basHarf(ad, cx, cy, r);
      return;
    }
    const x = this.x;
    x.save();
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.clip();
    x.drawImage(f.img, cx - r, cy - r, r * 2, r * 2);
    x.restore();
  }
}
