// Demo akışı: TikTok'a bağlanmadan oyunu denemek için sahte izleyici olayları üretir.
// Bu olaylar her zaman demo:true işaretiyle gider ve oyun ekranında "DEMO" yazısı çıkar.
// Canlı yayında gerçekmiş gibi sahte hediye göstermek izleyiciyi yanıltır; demo yalnızca prova içindir.

import { EventEmitter } from 'node:events';
import { metinTemizle } from './tiktok.js';

const ISIMLER = [
  'Deniz', 'Ece', 'Kaan', 'Zeynep', 'Mert', 'Elif', 'Burak', 'Ayşe', 'Emre', 'Selin', 'Can', 'Defne',
  'Yusuf', 'Nehir', 'Arda', 'Ceren', 'Efe', 'Duru', 'Kerem', 'İrem', 'Onur', 'Melis', 'Barış', 'Ada',
  'Tolga', 'Sude', 'Ozan', 'Beren', 'Umut', 'Lara', 'Alp', 'Ela', 'Batu', 'Nil', 'Eren', 'Yağmur',
];
const YORUMLAR = ['selam', 'hadi hadi', 'kim kazanır', 'çok iyi', 'yürü be', 'gol gibi', 'bastır', 'ooo', 'helal'];
// Gerçek TikTok hediye adları ve yaklaşık jeton fiyatları (yalnızca prova için).
// TikTok Türkiye hediye adları ve jeton fiyatları (yalnızca prova için)
const HEDIYELER = [
  { ad: 'Gül', jeton: 1, olasilik: 50 },
  { ad: 'TikTok', jeton: 1, olasilik: 12 },
  { ad: 'Dönen Top', jeton: 5, olasilik: 8 },
  { ad: 'Kalp', jeton: 10, olasilik: 8 },
  { ad: 'Rosa', jeton: 10, olasilik: 6 },
  { ad: 'Parfüm', jeton: 20, olasilik: 6 },
  { ad: 'Donat', jeton: 30, olasilik: 4 },
  { ad: 'Çay', jeton: 50, olasilik: 3 },
  { ad: 'Elle Kalp', jeton: 100, olasilik: 1.2 },
  { ad: 'Taç', jeton: 199, olasilik: 0.4 },
  { ad: 'Corgi', jeton: 299, olasilik: 0.15 },
  { ad: 'Elmas aşk yüzüğü', jeton: 300, olasilik: 0.03 },
  { ad: 'Para Tabancası', jeton: 500, olasilik: 0.02 },
];

const sec = (dizi) => dizi[Math.floor(Math.random() * dizi.length)];

function agirlikliHediye() {
  const toplam = HEDIYELER.reduce((t, h) => t + h.olasilik, 0);
  let r = Math.random() * toplam;
  for (const h of HEDIYELER) {
    r -= h.olasilik;
    if (r <= 0) return h;
  }
  return HEDIYELER[0];
}

// Demo için basit avatar (gerçek yayında TikTok profil fotoğrafı gelir)
const RENKLER = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316', '#0ea5e9', '#84cc16', '#e11d48'];
function sahteAvatar(i) {
  const zemin = RENKLER[i % RENKLER.length];
  const ten = ['#fde2c4', '#f1c27d', '#c68642', '#8d5524'][i % 4];
  const sac = ['#1f2937', '#78350f', '#b45309', '#111827', '#9ca3af'][i % 5];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='${zemin}'/>` +
    `<ellipse cx='32' cy='62' rx='22' ry='16' fill='#f8fafc' opacity='.9'/><circle cx='32' cy='28' r='13' fill='${ten}'/>` +
    `<path d='M19 26c0-9 6-14 13-14s13 5 13 14c-3-4-8-6-13-6s-10 2-13 6z' fill='${sac}'/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function sahteKullanici(i) {
  const ad = ISIMLER[i % ISIMLER.length] + (i >= ISIMLER.length ? String(Math.floor(i / ISIMLER.length)) : '');
  return { id: 'demo_' + i, ad, foto: sahteAvatar(i) };
}

export class DemoAkisi extends EventEmitter {
  constructor() {
    super();
    this.acik = false;
    this.zamanlayici = null;
    this.havuz = 70; // demo izleyici sayısı
  }

  baslat() {
    if (this.acik) return;
    this.acik = true;
    this.adim();
  }

  durdur() {
    this.acik = false;
    clearTimeout(this.zamanlayici);
    this.zamanlayici = null;
  }

  adim() {
    if (!this.acik) return;
    this.emit('olay', this.rastgeleOlay());
    // dalgalı yoğunluk: bazen sakin, bazen hareketli
    const yogun = Math.sin(Date.now() / 20000) > 0.4;
    this.zamanlayici = setTimeout(() => this.adim(), (yogun ? 90 : 260) + Math.random() * 400);
  }

  rastgeleOlay() {
    const i = Math.floor(Math.random() * this.havuz);
    const kullanici = sahteKullanici(i);
    const r = Math.random();
    if (r < 0.55) return { tur: 'begeni', kullanici, adet: 1 + Math.floor(Math.random() * 15) };
    if (r < 0.62) return { tur: 'yorum', kullanici, metin: Math.random() < 0.5 ? '1' : '2' };
    if (r < 0.72) return { tur: 'yorum', kullanici, metin: sec(YORUMLAR) };
    if (r < 0.75) return { tur: 'takip', kullanici };
    if (r < 0.77) return { tur: 'paylasim', kullanici };
    if (r < 0.8) return { tur: 'giris', kullanici };
    const h = agirlikliHediye();
    const adet = h.jeton <= 5 && Math.random() < 0.35 ? 1 + Math.floor(Math.random() * 10) : 1;
    return { tur: 'hediye', kullanici, hediye: { ad: h.ad, jeton: h.jeton }, adet };
  }

  // Panelin Test sekmesinden tek olay
  testOlayi(g = {}) {
    const ad = metinTemizle(g.ad || 'Test İzleyici', 24) || 'Test İzleyici';
    const kullanici = { id: 'test_' + ad.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').slice(0, 16), ad, foto: sahteAvatar(ad.length * 7 + ad.charCodeAt(0)) };
    switch (g.tur) {
      case 'yorum':
        return { tur: 'yorum', kullanici, metin: metinTemizle(g.metin || '1', 120) || '1' };
      case 'begeni':
        return { tur: 'begeni', kullanici, adet: Math.max(1, Math.min(100, Number(g.adet) || 10)) };
      case 'takip':
        return { tur: 'takip', kullanici };
      case 'paylasim':
        return { tur: 'paylasim', kullanici };
      case 'hediye': {
        const jeton = Math.max(1, Math.min(50000, Math.round(Number(g.jeton) || 1)));
        const adet = Math.max(1, Math.min(99, Math.round(Number(g.adet) || 1)));
        return { tur: 'hediye', kullanici, hediye: { ad: metinTemizle(g.hediye || 'Test Hediyesi', 24), jeton }, adet };
      }
      default:
        return null;
    }
  }
}
