// Takım savaşı oyununun yerel sunucusu.
// Yalnızca bu bilgisayardan (127.0.0.1) erişilir. Görevi: TikTok olaylarını oyun sayfasına
// (OBS tarayıcı kaynağı) iletmek, panelden gelen ayar/komutları dağıtmak.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TikTokYoneticisi, kullaniciAdiTemizle } from './src/tiktok.js';
import { ayarlariOku, ayarlariKaydet, ayarlariDogrula } from './src/ayarlar.js';
import { DemoAkisi } from './src/demo.js';
import { HediyeKatalogu } from './src/hediyeler.js';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const GENEL = path.join(KOK, 'public');
const PORT = Number(process.env.PORT) || 5077;
const HOST = '127.0.0.1'; // bilerek sabit: aynı Wi-Fi'deki başka cihazlar erişemez
const IZINLI_HOSTLAR = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const ISTEK_BASLIGI = 'tiktok-oyun';

const TURLER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const GUVENLIK_BASLIKLARI = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; " +
    "img-src 'self' data: https://*.tiktokcdn.com https://*.tiktokcdn-us.com https://*.tiktokcdn-eu.com; " +
    "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export function sunucuKur({ tiktok = new TikTokYoneticisi(), ayarDosyasi, hediyeDosyasi } = {}) {
  let ayarlar = ayarlariOku(ayarDosyasi);
  const katalog = new HediyeKatalogu(hediyeDosyasi);
  const demo = new DemoAkisi();
  const istemciler = new Set(); // SSE bağlantıları
  let sonOyunDurumu = null; // oyun sayfasının bildirdiği skor özeti (panel için)

  function yayinla(olayAdi, veri) {
    const parca = `event: ${olayAdi}\ndata: ${JSON.stringify(veri)}\n\n`;
    for (const res of istemciler) res.write(parca);
  }

  function durum() {
    return { baglanti: tiktok.durum, demo: demo.acik, ayarlar, oyun: sonOyunDurumu, hediyeler: katalog.hepsi() };
  }

  // katalog değişince oyun ekranına en geç 2 sn içinde bildir
  let katalogZamanlayici = null;
  function katalogYayinla() {
    if (katalogZamanlayici) return;
    katalogZamanlayici = setTimeout(() => {
      katalogZamanlayici = null;
      yayinla('hediyeler', katalog.hepsi());
    }, 2000);
    katalogZamanlayici.unref?.();
  }

  tiktok.on('olay', (o) => {
    if (o.tur === 'hediye' && katalog.ekle(o.hediye)) katalogYayinla();
    yayinla('olay', o);
  });
  tiktok.on('hediyeListesi', (liste) => {
    let degisti = false;
    for (const h of liste) degisti = katalog.ekle(h) || degisti;
    if (degisti) katalogYayinla();
  });
  tiktok.on('durum', (d) => yayinla('durum', { baglanti: d, demo: demo.acik }));
  tiktok.on('baglandi', ({ yeni }) => {
    if (demo.acik) demoAyarla(false);
    if (yeni) yayinla('komut', { komut: 'yeniYayin' });
  });
  demo.on('olay', (o) => yayinla('olay', { ...o, demo: true }));

  function demoAyarla(acik) {
    if (acik) demo.baslat();
    else demo.durdur();
    yayinla('durum', { baglanti: tiktok.durum, demo: demo.acik });
  }

  // ---------------------------------------------------------------- yardımcılar
  function gonder(res, kod, govde, ek = {}) {
    const veri = typeof govde === 'string' ? govde : JSON.stringify(govde);
    res.writeHead(kod, {
      ...GUVENLIK_BASLIKLARI,
      'Content-Type': typeof govde === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...ek,
    });
    res.end(veri);
  }

  function govdeOku(req, sinir = 16 * 1024) {
    return new Promise((coz, red) => {
      let boyut = 0;
      let asildi = false;
      const parcalar = [];
      req.on('data', (p) => {
        if (asildi) return; // fazlası okunup atılır, cevap 413 olarak gider
        boyut += p.length;
        if (boyut > sinir) {
          asildi = true;
          parcalar.length = 0;
          red(Object.assign(new Error('İstek çok büyük'), { kod: 413 }));
          return;
        }
        parcalar.push(p);
      });
      req.on('end', () => {
        if (asildi) return;
        if (!boyut) return coz({});
        try {
          const v = JSON.parse(Buffer.concat(parcalar).toString('utf8'));
          coz(v && typeof v === 'object' && !Array.isArray(v) ? v : {});
        } catch {
          red(Object.assign(new Error('Geçersiz JSON'), { kod: 400 }));
        }
      });
      req.on('error', red);
    });
  }

  function statikGonder(res, url) {
    let yol = decodeURIComponent(url.pathname);
    if (yol === '/' || yol === '/panel') yol = '/panel.html';
    if (yol === '/oyun') yol = '/oyun.html';
    const tam = path.resolve(GENEL, '.' + yol);
    if (!tam.startsWith(GENEL + path.sep)) return gonder(res, 403, 'Yasak');
    const tur = TURLER[path.extname(tam).toLowerCase()];
    if (!tur) return gonder(res, 404, 'Bulunamadı');
    fs.readFile(tam, (hata, icerik) => {
      if (hata) return gonder(res, 404, 'Bulunamadı');
      res.writeHead(200, { ...GUVENLIK_BASLIKLARI, 'Content-Type': tur, 'Cache-Control': 'no-cache' });
      res.end(icerik);
    });
  }

  // ---------------------------------------------------------------- istek işleyici
  async function isle(req, res) {
    // Reddedilen isteğin gövdesi okunmadan atılır; bağlantı düzgün kapanır.
    const reddet = (kod, metin) => {
      req.resume();
      return gonder(res, kod, metin, { Connection: 'close' });
    };
    // DNS yeniden bağlama (rebinding) saldırısına karşı: yalnızca localhost adıyla gelen istekler.
    if (!IZINLI_HOSTLAR.has(String(req.headers.host || '').toLowerCase())) return reddet(403, 'Yasak host');
    const origin = req.headers.origin;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const yontem = req.method;

    // İnternetteki yayın sayfası (ör. Netlify, LIVE Studio'nun "Bağlantı" kaynağı için):
    // yalnızca ayarlarda kayıtlı TEK adres; yalnızca olay akışını okur ve skor özetini gönderir.
    // Bağlanma, ayar, demo, komut gibi her şey yine yalnızca bu bilgisayardan.
    let uzak = null;
    if (origin && !IZINLI_HOSTLAR.has(origin.replace(/^https?:\/\//i, '').toLowerCase())) {
      const kayitli = ayarlar.yayinSayfasi;
      const izinliYol = url.pathname === '/olaylar' || url.pathname === '/api/oyun-durumu';
      if (!kayitli || origin.toLowerCase() !== kayitli || !izinliYol) return reddet(403, 'Yasak kaynak');
      uzak = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Cross-Origin-Resource-Policy': 'cross-origin' };
      if (yontem === 'OPTIONS') {
        res.writeHead(204, {
          ...uzak,
          'Access-Control-Allow-Methods': 'GET, POST',
          'Access-Control-Allow-Headers': 'Content-Type, X-Istek',
          'Access-Control-Allow-Private-Network': 'true', // internetteki sayfanın bu bilgisayara bağlanma izni
          'Access-Control-Max-Age': '600',
        });
        return res.end();
      }
      const izinli = (yontem === 'GET' && url.pathname === '/olaylar') || (yontem === 'POST' && url.pathname === '/api/oyun-durumu');
      if (!izinli) return reddet(403, 'Yasak kaynak');
    }

    if (yontem === 'GET' && url.pathname === '/olaylar') {
      if (istemciler.size >= 12) return gonder(res, 429, 'Çok fazla bağlantı');
      res.writeHead(200, {
        ...GUVENLIK_BASLIKLARI,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        ...(uzak || {}),
      });
      res.write(`event: hazir\ndata: ${JSON.stringify(durum())}\n\n`);
      istemciler.add(res);
      req.on('close', () => istemciler.delete(res));
      return;
    }
    if (yontem === 'GET' && url.pathname === '/api/durum') return gonder(res, 200, durum());
    if (yontem === 'GET' && !url.pathname.startsWith('/api/')) return statikGonder(res, url);

    if (yontem !== 'POST' && yontem !== 'PUT') return gonder(res, 405, 'Yöntem desteklenmiyor');
    // CSRF koruması: başka bir site bu özel başlığı ve JSON gövdeyi gönderemez (tarayıcı izin vermez).
    if (req.headers['x-istek'] !== ISTEK_BASLIGI) return reddet(403, 'Eksik istek başlığı');
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return gonder(res, 415, 'JSON bekleniyor');
    }

    let govde;
    try {
      govde = await govdeOku(req);
    } catch (e) {
      return gonder(res, e.kod || 400, { ok: false, hata: e.message }, { Connection: 'close' });
    }

    switch (`${yontem} ${url.pathname}`) {
      case 'POST /api/baglan': {
        const kullanici = kullaniciAdiTemizle(govde.kullanici || ayarlar.kullanici);
        if (!kullanici) return gonder(res, 400, { ok: false, hata: 'Geçerli bir kullanıcı adı yaz.' });
        if (kullanici !== ayarlar.kullanici) {
          ayarlar = { ...ayarlar, kullanici };
          ayarlariKaydet(ayarlar, ayarDosyasi);
        }
        try {
          const d = await tiktok.baglan(kullanici);
          return gonder(res, 200, { ok: true, baglanti: d });
        } catch (e) {
          return gonder(res, 502, { ok: false, hata: e.message, baglanti: tiktok.durum });
        }
      }
      case 'POST /api/kes':
        await tiktok.kes();
        return gonder(res, 200, { ok: true, baglanti: tiktok.durum });
      case 'POST /api/demo':
        demoAyarla(Boolean(govde.acik));
        return gonder(res, 200, { ok: true, demo: demo.acik });
      case 'POST /api/test': {
        const o = demo.testOlayi(govde);
        if (!o) return gonder(res, 400, { ok: false, hata: 'Bilinmeyen test olayı' });
        yayinla('olay', { ...o, demo: true });
        return gonder(res, 200, { ok: true });
      }
      case 'POST /api/komut': {
        const komut = String(govde.komut || '');
        if (!['sifirla', 'turuBitir', 'yeniTur', 'duraklat', 'devam', 'skorSifirla', 'cilginAn'].includes(komut)) {
          return gonder(res, 400, { ok: false, hata: 'Bilinmeyen komut' });
        }
        yayinla('komut', { komut });
        return gonder(res, 200, { ok: true });
      }
      case 'POST /api/oyun-durumu': {
        // Oyun sayfası her saniye kısa bir özet gönderir; panel skorları buradan görür.
        sonOyunDurumu = ayarlariDogrula.oyunOzeti(govde);
        yayinla('oyun', sonOyunDurumu);
        return gonder(res, 200, { ok: true }, uzak || {});
      }
      case 'PUT /api/ayarlar': {
        ayarlar = ayarlariDogrula({ ...ayarlar, ...govde });
        ayarlariKaydet(ayarlar, ayarDosyasi);
        yayinla('ayarlar', ayarlar);
        return gonder(res, 200, { ok: true, ayarlar });
      }
      default:
        return gonder(res, 404, { ok: false, hata: 'Bulunamadı' });
    }
  }

  const sunucu = http.createServer((req, res) => {
    isle(req, res).catch((e) => {
      console.error('İstek hatası:', e.message);
      if (!res.headersSent) gonder(res, 500, { ok: false, hata: 'Sunucu hatası' });
    });
  });

  // SSE bağlantılarını canlı tut
  const nabiz = setInterval(() => {
    for (const res of istemciler) res.write(': nabiz\n\n');
  }, 15000);
  nabiz.unref();

  sunucu.kapat = async () => {
    demo.durdur();
    await tiktok.kes({ sessiz: true });
    for (const res of istemciler) res.end();
    istemciler.clear();
    await new Promise((coz) => sunucu.close(coz));
  };
  sunucu.demo = demo;
  return sunucu;
}

// Doğrudan çalıştırıldıysa başlat (testler sunucuKur'u kendisi çağırır).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sunucu = sunucuKur();
  sunucu.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n  ${PORT} portu dolu. Oyun zaten açık olabilir: http://localhost:${PORT}\n`);
    } else console.error(e);
    process.exit(1);
  });
  sunucu.listen(PORT, HOST, () => {
    console.log('');
    console.log('  Cephe Kapışması (TikTok LIVE takım savaşı) çalışıyor');
    console.log(`  Kontrol paneli : http://localhost:${PORT}`);
    console.log(`  Oyun ekranı    : http://127.0.0.1:${PORT}/oyun   (LIVE Studio / OBS, 1080 x 1920)`);
    console.log('  Kapatmak için bu pencereyi kapat ya da Ctrl+C.');
    console.log('');
  });
  const kapat = () => sunucu.kapat().finally(() => process.exit(0));
  process.on('SIGINT', kapat);
  process.on('SIGTERM', kapat);
}
