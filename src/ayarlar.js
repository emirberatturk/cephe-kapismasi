// Oyun ayarları: varsayılanlar, doğrulama ve data/ayarlar.json'a kayıt.
// Panelden gelen her değer burada sınırlanır; bilinmeyen alanlar atılır.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kullaniciAdiTemizle, metinTemizle } from './tiktok.js';

const KOK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VARSAYILAN_DOSYA = path.join(KOK, 'data', 'ayarlar.json');

// Futbol Kupası: 24 kulüp (yalnızca ad, kısa ad ve renk; logo kullanılmaz). Panelden değiştirilebilir.
// 2026-27 Süper Lig'in 18 takımı + geçmişte Süper Lig'de oynamış 6 takım (1. Lig).
export const FUTBOL_TAKIMLARI = Object.freeze([
  { ad: 'Galatasaray', kisa: 'GS', renk: '#a90432', renk2: '#fdb912' },
  { ad: 'Fenerbahçe', kisa: 'FB', renk: '#0b2a6f', renk2: '#ffd200' },
  { ad: 'Beşiktaş', kisa: 'BJK', renk: '#111111', renk2: '#ffffff' },
  { ad: 'Trabzonspor', kisa: 'TS', renk: '#7b1e3a', renk2: '#4fa3e0' },
  { ad: 'Başakşehir', kisa: 'İBFK', renk: '#f26522', renk2: '#13294b' },
  { ad: 'Samsunspor', kisa: 'SAM', renk: '#e30613', renk2: '#ffffff' },
  { ad: 'Göztepe', kisa: 'GÖZ', renk: '#ffd100', renk2: '#d71920' },
  { ad: 'Kasımpaşa', kisa: 'KAS', renk: '#0a2d6e', renk2: '#ffffff' },
  { ad: 'Eyüpspor', kisa: 'EYP', renk: '#5b2a86', renk2: '#ffd600' },
  { ad: 'Alanyaspor', kisa: 'ALA', renk: '#f68b1f', renk2: '#00843d' },
  { ad: 'Çaykur Rizespor', kisa: 'RİZE', renk: '#009245', renk2: '#0071bc' },
  { ad: 'Konyaspor', kisa: 'KON', renk: '#007a3d', renk2: '#ffffff' },
  { ad: 'Gaziantep FK', kisa: 'GFK', renk: '#d71920', renk2: '#111111' },
  { ad: 'Kocaelispor', kisa: 'KOC', renk: '#00a651', renk2: '#111111' },
  { ad: 'Gençlerbirliği', kisa: 'GB', renk: '#c8102e', renk2: '#111111' },
  { ad: 'Amedspor', kisa: 'AMED', renk: '#d71920', renk2: '#00843d' },
  { ad: 'Çorum FK', kisa: 'ÇOR', renk: '#b5121b', renk2: '#111111' },
  { ad: 'Erzurumspor', kisa: 'ERZ', renk: '#0072ce', renk2: '#ffffff' },
  { ad: 'Sivasspor', kisa: 'SİV', renk: '#e30613', renk2: '#ffffff' },
  { ad: 'Bursaspor', kisa: 'BURSA', renk: '#00843d', renk2: '#ffffff' },
  { ad: 'Antalyaspor', kisa: 'ANT', renk: '#d50000', renk2: '#ffffff' },
  { ad: 'Kayserispor', kisa: 'KAY', renk: '#d71920', renk2: '#ffd100' },
  { ad: 'Fatih Karagümrük', kisa: 'FKG', renk: '#c8102e', renk2: '#111111' },
  { ad: 'Bodrumspor', kisa: 'BOD', renk: '#00965e', renk2: '#ffffff' },
]);

export const FUTBOL_VARSAYILAN = Object.freeze({
  kupaAdi: 'Yayın Kupası',
  takimlar: FUTBOL_TAKIMLARI,
  kupaBoyu: 'tum', // 'tum' (24 takımın hepsi, bazıları ilk turu bay geçer) | 16 | 8 (kurayla seçilir)
  macSuresi: 150, // gerçek saniye; ekranda 90 dakika
  hazirlik: 10, // maç başında yazıp katılma süresi (sn)
  araSuresi: 14, // maç arası (sn)
  sahaOyuncu: 7, // takım başına sahada en fazla (kaleci dahil); fazlası yedekte bekler
  korumaJeton: 10, // Kalp, Rosa (10), Parfüm (20): kaleye kesin kurtarış hakkı
  superSutJeton: 30, // Donat (30), Çay (50)
  penaltiJeton: 100, // Elle Kalp, Konfeti (100), Taç (199)
  golJeton: 300, // Elmas aşk yüzüğü (300), Para Tabancası (500) → direkt gol
  hava: true, // her maç rastgele hava (yağmur, kar, sis, rüzgar)
  surpriz: true, // maç içinde sürpriz olaylar (köpek, ışıklar, yeni top …)
});

export const VARSAYILAN = Object.freeze({
  kullanici: '',
  oyunTuru: 'cephe', // 'cephe' (takım savaşı) | 'futbol' (Futbol Kupası)
  takimlar: [
    { ad: 'Kırmızı', renk: '#e53935' },
    { ad: 'Mavi', renk: '#1e88e5' },
  ],
  hazirlik: 15, // her tur başında beğenip katılma süresi (sn)
  turSuresi: 180, // savaş süresi (sn)
  araSuresi: 12, // tur arası (sn)
  maksAsker: 60, // takım başına sahadaki asker; fazlası sıraya girer
  donusSuresi: 10, // düşen izleyici kaç sn sonra beğeniyle dönebilir
  // Hediyeler jetona göre: TikTok Türkiye hediye fiyatlarıyla
  tufekJeton: 20, // tüfek: Parfüm (20), Donat (30), Çay (50 = 2 kişi); her 20 jeton 1 kişi
  bombaJeton: 100, // bomba: Elle Kalp, Konfeti (100) → bombaKisi; fazlası için her tufekJeton'a +1
  bombaKisi: 6,
  ejderhaJeton: 300, // ejderha: Elmas aşk yüzüğü (300), Para Tabancası (500) → turu kazandırır
  jetonTL: 0.6, // yalnızca panelde yaklaşık TL karşılığını göstermek için
  oyunHizi: 'normal', // ön saf dövüşü: 'yavas' | 'normal' | 'hizli'
  otoSavas: true, // askerler kendi kendine dövüşür
  kalkanDirilis: true, // küçük hediye: kalkan + düşen arkadaşı diriltme
  kaptanTaci: true, // 1 numaralı kaptan bir vuruşa fazladan dayanır
  cilginAn: true, // 60 sn'de bir 10 sn çift hasar
  begeniHedefi: 1000, // her bu kadar beğenide Çılgın An (0 = kapalı)
  adSuzgeci: false, // küfürlü adları "İzleyici" olarak göster
  profilFoto: 'hepsi', // 'hepsi' | 'kaptan' | 'yok'
  yayinSayfasi: '', // internetteki oyun sayfasının adresi (ör. https://ad.netlify.app); boşsa kapalı
  botlar: true, // izleyici azken boş takımları bot askerlerle doldur
  botSayisi: 5, // her takımda en az bu kadar asker olsun (eksiği bot)
  ses: true,
  spiker: true, // futbolda sesli anlatım (bilgisayarın Türkçe sesi, internetsiz)
  spikerSes: 90, // spiker ses düzeyi (0-100)
  futbol: FUTBOL_VARSAYILAN,
});

const sinirla = (v, min, max, varsayilan) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : varsayilan;
};
const renkMi = (r) => typeof r === 'string' && /^#[0-9a-f]{6}$/i.test(r);
const secim = (v, liste, varsayilan) => (liste.includes(v) ? v : varsayilan);
const mantik = (v, varsayilan) => (typeof v === 'boolean' ? v : varsayilan);

// Yayın sayfası adresi: yalnızca https, yalnızca köken (yol atılır)
export function kaynakTemizle(v) {
  try {
    const u = new URL(String(v ?? '').trim());
    if (u.protocol !== 'https:' || u.username || u.password) return '';
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname)) return '';
    return u.origin.toLowerCase();
  } catch {
    return '';
  }
}

export function futbolDogrula(g = {}) {
  const v = FUTBOL_VARSAYILAN;
  // eski sürümün 8 takımlık listesi yeni 24 takımın yerine geçmesin
  const gelen = Array.isArray(g.takimlar) && g.takimlar.length !== 8 ? g.takimlar : [];
  const takimlar = v.takimlar.map((d, i) => {
    const t = gelen[i] && typeof gelen[i] === 'object' ? gelen[i] : {};
    return {
      ad: metinTemizle(t.ad, 16) || d.ad,
      kisa: (metinTemizle(t.kisa, 5) || d.kisa).toLocaleUpperCase('tr-TR'),
      renk: renkMi(t.renk) ? t.renk.toLowerCase() : d.renk,
      renk2: renkMi(t.renk2) ? t.renk2.toLowerCase() : d.renk2,
    };
  });
  let korumaJeton = Math.round(sinirla(g.korumaJeton, 1, 100000, v.korumaJeton));
  let superSutJeton = Math.round(sinirla(g.superSutJeton, 2, 100000, v.superSutJeton));
  let penaltiJeton = Math.round(sinirla(g.penaltiJeton, 3, 100000, v.penaltiJeton));
  let golJeton = Math.round(sinirla(g.golJeton, 4, 1000000, v.golJeton));
  if (!(korumaJeton < superSutJeton && superSutJeton < penaltiJeton && penaltiJeton < golJeton)) {
    korumaJeton = v.korumaJeton;
    superSutJeton = v.superSutJeton;
    penaltiJeton = v.penaltiJeton;
    golJeton = v.golJeton;
  }
  return {
    kupaAdi: metinTemizle(g.kupaAdi, 24) || v.kupaAdi,
    takimlar,
    kupaBoyu: g.kupaBoyu === 'tum' ? 'tum' : [8, 16].includes(Number(g.kupaBoyu)) ? Number(g.kupaBoyu) : v.kupaBoyu,
    macSuresi: Math.round(sinirla(g.macSuresi, 60, 600, v.macSuresi)),
    hazirlik: Math.round(sinirla(g.hazirlik, 5, 60, v.hazirlik)),
    araSuresi: Math.round(sinirla(g.araSuresi, 8, 60, v.araSuresi)),
    sahaOyuncu: Math.round(sinirla(g.sahaOyuncu, 3, 11, v.sahaOyuncu)),
    korumaJeton,
    superSutJeton,
    penaltiJeton,
    golJeton,
    hava: mantik(g.hava, v.hava),
    surpriz: mantik(g.surpriz, v.surpriz),
  };
}

export function ayarlariDogrula(g = {}) {
  const v = VARSAYILAN;
  const takimlar = [0, 1].map((i) => {
    const t = Array.isArray(g.takimlar) ? g.takimlar[i] || {} : {};
    return {
      ad: metinTemizle(t.ad, 14) || v.takimlar[i].ad,
      renk: renkMi(t.renk) ? t.renk.toLowerCase() : v.takimlar[i].renk,
    };
  });
  if (takimlar[0].ad.toLocaleLowerCase('tr') === takimlar[1].ad.toLocaleLowerCase('tr')) {
    takimlar[1].ad = takimlar[1].ad === v.takimlar[1].ad ? v.takimlar[0].ad : v.takimlar[1].ad;
  }
  // jeton eşikleri artan sırada olmalı (eski TL ayarları yok sayılır)
  let tufekJeton = Math.round(sinirla(g.tufekJeton, 2, 100000, v.tufekJeton));
  let bombaJeton = Math.round(sinirla(g.bombaJeton, 3, 100000, v.bombaJeton));
  let ejderhaJeton = Math.round(sinirla(g.ejderhaJeton, 4, 1000000, v.ejderhaJeton));
  if (!(tufekJeton < bombaJeton && bombaJeton < ejderhaJeton)) {
    tufekJeton = v.tufekJeton;
    bombaJeton = v.bombaJeton;
    ejderhaJeton = v.ejderhaJeton;
  }

  return {
    kullanici: kullaniciAdiTemizle(g.kullanici) || '',
    oyunTuru: secim(g.oyunTuru, ['cephe', 'futbol'], v.oyunTuru),
    takimlar,
    hazirlik: Math.round(sinirla(g.hazirlik, 5, 60, v.hazirlik)),
    turSuresi: Math.round(sinirla(g.turSuresi, 60, 600, v.turSuresi)),
    araSuresi: Math.round(sinirla(g.araSuresi, 8, 60, v.araSuresi)),
    maksAsker: Math.round(sinirla(g.maksAsker, 10, 60, v.maksAsker)),
    donusSuresi: Math.round(sinirla(g.donusSuresi, 0, 60, v.donusSuresi)),
    tufekJeton,
    bombaJeton,
    bombaKisi: Math.round(sinirla(g.bombaKisi, 1, 30, v.bombaKisi)),
    ejderhaJeton,
    jetonTL: Math.round(sinirla(g.jetonTL, 0.01, 10, v.jetonTL) * 1000) / 1000,
    oyunHizi: secim(g.oyunHizi, ['yavas', 'normal', 'hizli'], v.oyunHizi),
    otoSavas: mantik(g.otoSavas, v.otoSavas),
    kalkanDirilis: mantik(g.kalkanDirilis, v.kalkanDirilis),
    kaptanTaci: mantik(g.kaptanTaci, v.kaptanTaci),
    cilginAn: mantik(g.cilginAn, v.cilginAn),
    begeniHedefi: Math.round(sinirla(g.begeniHedefi, 0, 100000, v.begeniHedefi)),
    adSuzgeci: mantik(g.adSuzgeci, v.adSuzgeci),
    profilFoto: secim(g.profilFoto, ['hepsi', 'kaptan', 'yok'], v.profilFoto),
    yayinSayfasi: kaynakTemizle(g.yayinSayfasi),
    botlar: mantik(g.botlar, v.botlar),
    botSayisi: Math.round(sinirla(g.botSayisi, 0, 20, v.botSayisi)),
    ses: mantik(g.ses, v.ses),
    spiker: mantik(g.spiker, v.spiker),
    spikerSes: Math.round(sinirla(g.spikerSes, 0, 100, v.spikerSes)),
    futbol: futbolDogrula(g.futbol && typeof g.futbol === 'object' ? g.futbol : {}),
  };
}

const tamSayi = (v, min, max) => Math.round(sinirla(v, min, max, min));
const FUTBOL_ASAMALARI = ['hazirlik', 'mac', 'gol', 'penalti', 'seri', 'ara', 'kupaSonu', 'duraklat'];

function futbolOzeti(g) {
  const f = g.futbol && typeof g.futbol === 'object' ? g.futbol : {};
  const ikili = (d) => [0, 1].map((i) => tamSayi(Array.isArray(d) ? d[i] : 0, 0, 999));
  return {
    oyun: 'futbol',
    tur: tamSayi(g.tur, 0, 1e6),
    kalan: tamSayi(g.kalan, 0, 3600),
    asama: FUTBOL_ASAMALARI.includes(g.asama) ? g.asama : 'mac',
    canli: [0, 1].map((i) => tamSayi(g.canli?.[i], 0, 1e4)),
    galibiyet: ikili(g.galibiyet),
    kaptanlar: [[], []],
    demo: g.demo === true,
    futbol: {
      kupa: tamSayi(f.kupa, 0, 1e6),
      macAdi: metinTemizle(f.macAdi, 24),
      ev: Math.round(sinirla(f.ev, -1, 63, -1)),
      dep: Math.round(sinirla(f.dep, -1, 63, -1)),
      skor: ikili(f.skor),
      pen: Array.isArray(f.pen) ? ikili(f.pen) : null,
      dakika: tamSayi(f.dakika, 0, 130),
      guc: Number.isFinite(Number(f.guc)) ? tamSayi(f.guc, 0, 100) : 50,
      golKrallari: (Array.isArray(f.golKrallari) ? f.golKrallari : []).slice(0, 5).map((k) => ({ ad: metinTemizle(k?.ad, 24), gol: tamSayi(k?.gol, 0, 1e6) })),
      kupalar: Array.from({ length: Math.min(64, Array.isArray(f.kupalar) ? f.kupalar.length : 0) }, (_, i) => tamSayi(f.kupalar[i], 0, 1e6)),
    },
  };
}

// Oyun sayfasının panele gönderdiği kısa özet (yalnızca beklenen alanlar).
ayarlariDogrula.oyunOzeti = (g = {}) => (g.oyun === 'futbol' ? futbolOzeti(g) : {
  tur: Math.round(sinirla(g.tur, 0, 1e6, 0)),
  kalan: Math.round(sinirla(g.kalan, 0, 3600, 0)),
  asama: ['hazirlik', 'savas', 'uzatma', 'ara', 'duraklat'].includes(g.asama) ? g.asama : 'savas',
  canli: [0, 1].map((i) => Math.round(sinirla(g.canli?.[i], 0, 1e4, 0))),
  galibiyet: [0, 1].map((i) => Math.round(sinirla(g.galibiyet?.[i], 0, 1e6, 0))),
  kaptanlar: [0, 1].map((i) =>
    (Array.isArray(g.kaptanlar?.[i]) ? g.kaptanlar[i] : []).slice(0, 3).map((k) => ({
      ad: metinTemizle(k?.ad, 24),
      puan: Math.round(sinirla(k?.puan, 0, 1e9, 0)),
    }))
  ),
  demo: g.demo === true,
});

export function ayarlariOku(dosya = VARSAYILAN_DOSYA) {
  try {
    return ayarlariDogrula(JSON.parse(fs.readFileSync(dosya, 'utf8')));
  } catch {
    return ayarlariDogrula({});
  }
}

export function ayarlariKaydet(ayarlar, dosya = VARSAYILAN_DOSYA) {
  try {
    fs.mkdirSync(path.dirname(dosya), { recursive: true });
    const gecici = dosya + '.tmp';
    fs.writeFileSync(gecici, JSON.stringify(ayarlar, null, 2), 'utf8');
    fs.renameSync(gecici, dosya);
    return true;
  } catch (e) {
    console.error('Ayarlar kaydedilemedi:', e.message);
    return false;
  }
}
