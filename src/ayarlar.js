// Oyun ayarları: varsayılanlar, doğrulama ve data/ayarlar.json'a kayıt.
// Panelden gelen her değer burada sınırlanır; bilinmeyen alanlar atılır.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kullaniciAdiTemizle, metinTemizle } from './tiktok.js';

const KOK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VARSAYILAN_DOSYA = path.join(KOK, 'data', 'ayarlar.json');

export const VARSAYILAN = Object.freeze({
  kullanici: '',
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
  };
}

// Oyun sayfasının panele gönderdiği kısa özet (yalnızca beklenen alanlar).
ayarlariDogrula.oyunOzeti = (g = {}) => ({
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
