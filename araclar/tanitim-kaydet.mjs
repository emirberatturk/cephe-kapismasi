// Tanıtım görüntüsü kaydedici: oyunu ekranda oynatmadan, kare kare sabit hızda üretir (takılma yok).
// Gerçek izleyici yok: botlar ve demo izleyicileri (çizgi avatarlar) kullanılır.
//
// Kullanım:
//   node araclar/tanitim-kaydet.mjs <senaryo> <çıktı-klasörü> [--fps 60] [--olcek 1]
// Senaryolar: gif, tanitim, katilim, silahlar, ejderha, siralama, botlar
// Çıktı: kare_00001.jpg … (sonra ffmpeg ile videoya çevrilir) + anlik_*.png (README görselleri)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5098;
process.env.PORT = String(PORT); // sunucu modülü bu portu okur (kullanıcının 5077'sine dokunmaz)
const { sunucuKur } = await import('../server.js');
const { DemoAkisi } = await import('../src/demo.js');
const require = createRequire(path.join(KOK, 'package.json'));
const WebSocket = require('ws');

const [senaryoAdi = 'gif', cikti = path.join(KOK, 'tanitim-cikti')] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const arg = (ad, varsayilan) => {
  const i = process.argv.indexOf('--' + ad);
  return i > 0 ? Number(process.argv[i + 1]) : varsayilan;
};
const FPS = arg('fps', 60);
const OLCEK = arg('olcek', 1);
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

// ------------------------------------------------------------ senaryolar
// isinma: kayıttan önce simüle edilen süre (sn); sure: kayıt süresi; olaylar: [zaman, olay]
const k = (ad, i) => ({ id: 'tanitim_' + ad, ad, foto: '' , _i: i });
const hediye = (ad, jeton, kim, adet = 1) => ({ tur: 'hediye', kullanici: kim, hediye: { ad, jeton }, adet });
const SENARYOLAR = {
  gif: { isinma: 16, sure: 9, yogunluk: 6, olaylar: [[1, hediye('Çay', 60, 'Nişancı')], [3.5, hediye('Elle Kalp', 100, 'Bombacı')], [6.2, hediye('Elmas aşk yüzüğü', 300, 'Ejderhacı')]], anlik: { savas: 0.4, bomba: 4.3, ejderha: 7.4 } },
  tanitim: { isinma: 16, sure: 15, yogunluk: 6, olaylar: [[1.5, hediye('Gül', 1, 'Kalkancı', 3)], [3, hediye('Çay', 60, 'Nişancı')], [6, hediye('Elle Kalp', 100, 'Bombacı')], [9.5, hediye('Taç', 199, 'Kral')], [12, hediye('Elmas aşk yüzüğü', 300, 'Ejderhacı')]] },
  katilim: { isinma: 1, sure: 14, yogunluk: 9, olaylar: [] },
  silahlar: { isinma: 18, sure: 16, yogunluk: 5, olaylar: [[1, hediye('Gül', 1, 'Kalkancı', 5)], [4, hediye('Parfüm', 20, 'Nişancı')], [6, hediye('Çay', 50, 'Nişancı')], [9, hediye('Elle Kalp', 100, 'Bombacı')], [13, hediye('Corgi', 299, 'Bombacı')]] },
  ejderha: { isinma: 20, sure: 8, yogunluk: 5, olaylar: [[1, hediye('Elmas aşk yüzüğü', 300, 'Ejderhacı')]] },
  siralama: { isinma: 20, sure: 12, yogunluk: 5, olaylar: [[0.5, hediye('Taç', 199, 'Kral')], [1.5, hediye('Elle Kalp', 100, 'Bombacı')], [2.5, hediye('Elle Kalp', 100, 'Kraliçe')], [3, { komut: 'turuBitir' }]], anlik: { siralama: 8 } },
  botlar: { isinma: 18, sure: 10, yogunluk: 0, olaylar: [] },
};
const senaryo = SENARYOLAR[senaryoAdi];
if (!senaryo) {
  console.error('Bilinmeyen senaryo. Seçenekler:', Object.keys(SENARYOLAR).join(', '));
  process.exit(1);
}

// ------------------------------------------------------------ sunucu (geçici ayarlarla)
const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'tanitim-'));
const ayarDosyasi = path.join(gecici, 'ayarlar.json');
fs.writeFileSync(ayarDosyasi, JSON.stringify({ botlar: true, botSayisi: senaryoAdi === 'botlar' ? 8 : 6, profilFoto: 'hepsi', cilginAn: false }));
// TikTok'a bağlanmayan sahte yönetici (olayları biz üretiyoruz)
const sahteTikTok = Object.assign(new (await import('node:events')).EventEmitter(), {
  durum: { hal: 'bosta', kullanici: '', hata: '', izleyici: 0 },
  async baglan() { throw new Error('tanıtım kaydında bağlantı yok'); },
  async kes() {},
});
const sunucu = sunucuKur({ tiktok: sahteTikTok, ayarDosyasi, hediyeDosyasi: path.join(gecici, 'hediyeler.json') });
sunucu.listen(PORT, '127.0.0.1');
await new Promise((c) => sunucu.once('listening', c));

// ------------------------------------------------------------ tarayıcı
const profil = path.join(gecici, 'profil');
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${profil}`, '--no-first-run', '--window-size=1080,1920', 'about:blank'], { stdio: 'ignore' });
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let hedef;
for (let i = 0; i < 40 && !hedef; i++) {
  await bekle(250);
  try { hedef = (await (await fetch('http://127.0.0.1:9334/json/list')).json()).find((t) => t.type === 'page'); } catch { /* bekle */ }
}
const ws = new WebSocket(hedef.webSocketDebuggerUrl);
await new Promise((r) => ws.once('open', r));
let n = 0;
const bekleyen = new Map();
ws.on('message', (m) => {
  const d = JSON.parse(m);
  if (d.id && bekleyen.has(d.id)) { bekleyen.get(d.id)(d); bekleyen.delete(d.id); }
});
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; bekleyen.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const calistir = async (ifade) => {
  const r = await cdp('Runtime.evaluate', { expression: ifade, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'sayfa hatası');
  return r.result?.result?.value;
};

await cdp('Page.enable');
await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/kayit-bos` }); // 404 düz metin sayfası: aynı köken, betik yok
await bekle(800);
// Aynı kökende boş bir belge kur, oyun modüllerini yükle, kendi döngümüzü sür
await calistir(`(async () => {
  document.documentElement.innerHTML = '<head></head><body style="margin:0;background:#000"></body>';
  const c = document.createElement('canvas');
  c.width = ${Math.round(1080 * OLCEK)}; c.height = ${Math.round(1920 * OLCEK)};
  document.body.appendChild(c);
  const { Motor } = await import('/oyun/motor.js');
  const { Cizim } = await import('/oyun/cizim.js');
  const d = await (await fetch('/api/durum')).json();
  let n = 20261122;
  const r = () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
  const motor = new Motor(d.ayarlar, { rastgele: r });
  const cizim = new Cizim(c, motor);
  const x = c.getContext('2d');
  window.__kare = (dt, olaylar, kaydet, png) => {
    for (const o of olaylar) o.komut ? motor.komut(o.komut) : motor.olay(o);
    motor.tick(dt);
    x.setTransform(${OLCEK}, 0, 0, ${OLCEK}, 0, 0);
    cizim.ciz(dt);
    return kaydet ? c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9) : '';
  };
  return 'hazir';
})()`);

// ------------------------------------------------------------ zaman çizelgesi
const demo = new DemoAkisi();
const kisi = (ad) => ({ id: 'tanitim_' + ad, ad, foto: demo.testOlayi({ tur: 'takip', ad }).kullanici.foto });
let sonrakiDemo = 0;
function kareOlaylari(t, dt) {
  const olaylar = [];
  // arka plan: demo izleyicileri (beğeni, yorum, küçük hediyeler)
  if (senaryo.yogunluk > 0) {
    while (sonrakiDemo <= t) {
      const o = demo.rastgeleOlay();
      // arka planda hediye az olsun (kalkanlar silahların etkisini gizlemesin); büyük hediyeler yalnızca senaryodan
      if (o.tur === 'hediye') {
        if (Math.random() < 0.85) { olaylar.push({ tur: 'begeni', kullanici: o.kullanici, adet: 5 }); sonrakiDemo += 1 / senaryo.yogunluk; continue; }
        o.hediye = { ad: 'Gül', jeton: 1 };
        o.adet = 1;
      }
      olaylar.push(o);
      sonrakiDemo += 1 / senaryo.yogunluk;
    }
  }
  return olaylar;
}

fs.rmSync(cikti, { recursive: true, force: true });
fs.mkdirSync(cikti, { recursive: true });
const dt = 1 / FPS;
const isinmaKare = Math.round(senaryo.isinma * FPS);
const kayitKare = Math.round(senaryo.sure * FPS);
const zamanli = senaryo.olaylar.map(([zaman, o]) => ({ kare: isinmaKare + Math.round(zaman * FPS), o }));
const anliklar = Object.entries(senaryo.anlik || {}).map(([ad, zaman]) => ({ ad, kare: isinmaKare + Math.round(zaman * FPS) }));
console.log(`  ${senaryoAdi}: ${senaryo.sure} sn, ${FPS} fps, ${Math.round(1080 * OLCEK)}x${Math.round(1920 * OLCEK)} → ${cikti}`);
const baslangic = Date.now();
for (let i = 0; i < isinmaKare + kayitKare; i++) {
  const t = i * dt;
  const olaylar = kareOlaylari(t, dt);
  for (const z of zamanli) if (z.kare === i) olaylar.push(z.o.komut ? z.o : { ...z.o, kullanici: kisi(z.o.kullanici) });
  const kayit = i >= isinmaKare;
  const anlik = anliklar.find((a) => a.kare === i);
  const veri = await calistir(`__kare(${dt}, ${JSON.stringify(olaylar)}, ${kayit}, ${Boolean(anlik)})`);
  if (kayit) {
    const no = String(i - isinmaKare + 1).padStart(5, '0');
    const tampon = Buffer.from(veri.split(',')[1], 'base64');
    if (anlik) fs.writeFileSync(path.join(cikti, `anlik_${anlik.ad}.png`), tampon);
    else fs.writeFileSync(path.join(cikti, `kare_${no}.jpg`), tampon);
    if (anlik) {
      // anlık PNG alınan karenin JPEG'i de gerekli (video kesintisiz olsun)
      const j = await calistir(`document.querySelector('canvas').toDataURL('image/jpeg', 0.9)`);
      fs.writeFileSync(path.join(cikti, `kare_${no}.jpg`), Buffer.from(j.split(',')[1], 'base64'));
    }
  }
  if (i % (FPS * 2) === 0) process.stdout.write(`\r  kare ${i + 1}/${isinmaKare + kayitKare}`);
}
console.log(`\n  bitti: ${kayitKare} kare, ${((Date.now() - baslangic) / 1000).toFixed(0)} sn`);

ws.close();
chrome.kill();
await new Promise((r) => { chrome.once('exit', r); setTimeout(r, 3000); });
await sunucu.kapat();
for (let i = 0; i < 6; i++) {
  try { fs.rmSync(gecici, { recursive: true, force: true }); break; } catch { await bekle(500); } // Chrome dosyaları bırakana kadar
}
process.exit(0);
