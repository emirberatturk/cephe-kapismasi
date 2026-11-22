// Hediye kataloğu: TikTok hediyelerinin Türkçe adı, jeton fiyatı ve resmi.
// Resimler TikTok'un kendi sunucusundan (tiktokcdn) gelir; katalog, odanın hediye listesinden
// ve yayında gönderilen hediyelerden dolar, data/hediyeler.json'a kaydedilir.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { metinTemizle } from './tiktok.js';

const KOK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VARSAYILAN_DOSYA = path.join(KOK, 'data', 'hediyeler.json');

// TikTok Türkiye hediye panelindeki adlar (İngilizce ad → Türkçe ad)
export const TURKCE_ADLAR = {
  'rose': 'Gül',
  'heart': 'Kalp',
  'hand heart': 'Elle Kalp',
  'tea': 'Çay',
  'perfume': 'Parfüm',
  'doughnut': 'Donat',
  'crown': 'Taç',
  'paw': 'Pençe',
  'love you so much': 'Seni seviyorum',
  'welcome dallah': 'Karşılama Kahvesi',
  'ice cream cone': 'Dondurma Külahı',
  'confetti': 'Konfeti',
  'parliyorsun!': 'Parlıyorsun!',
  'glow stick': 'Lazer Çubuğu',
  'crossette firework': 'Crosette Havai Fişek',
  'wink wink': 'Göz kırpma',
  'diamond ring of love': 'Elmas aşk yüzüğü',
  'money gun': 'Para Tabancası',
  'cake slice': 'Pasta Dilimi',
  'spinning soccer': 'Dönen Top',
  'tulip': 'Lale',
  'match star': 'Maçın Yıldızı',
  'divine fingers': 'İlahi Parmaklar',
  'turkish coffee': 'Türk Kahvesi',
};

export function turkceAd(ad) {
  const temiz = metinTemizle(ad, 40);
  return TURKCE_ADLAR[temiz.toLocaleLowerCase('en-US')] || temiz;
}

const resimMi = (u) => typeof u === 'string' && /^https:\/\/[a-z0-9.-]+\.tiktokcdn(-[a-z]+)?\.com\//i.test(u) && u.length < 600;

function resimBul(g) {
  const adaylar = [
    g?.image?.urlList?.[0], g?.image?.url_list?.[0], g?.image?.url?.[0],
    g?.icon?.urlList?.[0], g?.icon?.url_list?.[0], g?.giftImage?.urlList?.[0], g?.giftImage?.url?.[0],
  ];
  return adaylar.find(resimMi) || '';
}

// Odanın hediye listesi yanıtından {ad, jeton, resim} çıkar (yanıtın biçimi değişebilir, dikkatli tarar)
export function hediyeListesiAyikla(yanit) {
  const sonuc = [];
  const gorulen = new Set();
  const yigin = [yanit];
  let adim = 0;
  while (yigin.length && adim++ < 20000 && sonuc.length < 3000) {
    const d = yigin.pop();
    if (Array.isArray(d)) { for (const e of d) yigin.push(e); continue; }
    if (!d || typeof d !== 'object') continue;
    const jeton = Number(d.diamond_count ?? d.diamondCount);
    if (typeof d.name === 'string' && Number.isFinite(jeton) && jeton > 0) {
      const ad = turkceAd(d.name);
      const anahtar = `${ad}|${jeton}`;
      if (ad && !gorulen.has(anahtar)) {
        gorulen.add(anahtar);
        sonuc.push({ ad, jeton: Math.round(jeton), resim: resimBul(d) });
      }
      continue;
    }
    for (const v of Object.values(d)) if (v && typeof v === 'object') yigin.push(v);
  }
  return sonuc.sort((a, b) => a.jeton - b.jeton || a.ad.localeCompare(b.ad, 'tr'));
}

export class HediyeKatalogu {
  constructor(dosya = VARSAYILAN_DOSYA) {
    this.dosya = dosya;
    this.liste = new Map(); // "ad|jeton" -> { ad, jeton, resim }
    try {
      const v = JSON.parse(fs.readFileSync(dosya, 'utf8'));
      for (const h of Array.isArray(v) ? v : []) this.ekle(h, { sessiz: true });
    } catch { /* ilk çalıştırma */ }
    this.zamanlayici = null;
  }

  // yeni ya da resmi eksik bir hediye eklendiyse true döner
  ekle(h, { sessiz = false } = {}) {
    if (!h || typeof h.ad !== 'string') return false;
    const ad = turkceAd(h.ad);
    const jeton = Math.round(Number(h.jeton));
    if (!ad || !Number.isFinite(jeton) || jeton < 1 || jeton > 1e6) return false;
    const resim = resimMi(h.resim) ? h.resim : '';
    const anahtar = `${ad}|${jeton}`;
    const eski = this.liste.get(anahtar);
    if (eski && (eski.resim || !resim)) return false;
    if (this.liste.size >= 3000 && !eski) return false;
    this.liste.set(anahtar, { ad, jeton, resim: resim || eski?.resim || '' });
    if (!sessiz) this.kaydetGecikmeli();
    return true;
  }

  hepsi() {
    return [...this.liste.values()].sort((a, b) => a.jeton - b.jeton || a.ad.localeCompare(b.ad, 'tr'));
  }

  kaydetGecikmeli() {
    clearTimeout(this.zamanlayici);
    this.zamanlayici = setTimeout(() => this.kaydet(), 2000);
    this.zamanlayici.unref?.();
  }

  kaydet() {
    try {
      fs.mkdirSync(path.dirname(this.dosya), { recursive: true });
      const gecici = this.dosya + '.tmp';
      fs.writeFileSync(gecici, JSON.stringify(this.hepsi()), 'utf8');
      fs.renameSync(gecici, this.dosya);
    } catch (e) {
      console.error('Hediye kataloğu kaydedilemedi:', e.message);
    }
  }
}
