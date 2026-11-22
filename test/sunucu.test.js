import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
process.env.PORT = '5099'; // kullanıcının açık oyun sunucusuyla (5077) çakışmasın
const { sunucuKur } = await import('../server.js');

// Sahte TikTok yöneticisi: testler internete çıkmaz.
class SahteTikTok extends EventEmitter {
  constructor() {
    super();
    this.durum = { hal: 'bosta', kullanici: '', hata: '', izleyici: 0 };
  }
  async baglan(k) {
    this.durum = { ...this.durum, hal: 'bagli', kullanici: k };
    this.emit('baglandi', { kullanici: k, yeni: true });
    return this.durum;
  }
  async kes() {
    this.durum = { ...this.durum, hal: 'bosta' };
  }
}

const PORT = 5099; // sunucu Host denetimi bu porta göre yapılıyor
let sunucu;
let gecici;

function istek(yontem, yol, { govde, basliklar = {} } = {}) {
  return new Promise((coz, red) => {
    const veri = govde === undefined ? undefined : typeof govde === 'string' ? govde : JSON.stringify(govde);
    const req = http.request(
      { host: '127.0.0.1', port: PORT, method: yontem, path: yol, headers: { host: `127.0.0.1:${PORT}`, ...basliklar } },
      (res) => {
        let s = '';
        res.on('data', (p) => (s += p));
        res.on('end', () => coz({ kod: res.statusCode, basliklar: res.headers, govde: s }));
      }
    );
    req.on('error', red);
    if (veri) req.write(veri);
    req.end();
  });
}
const json = { 'content-type': 'application/json', 'x-istek': 'tiktok-oyun' };

before(async () => {
  gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-oyun-test-'));
  sunucu = sunucuKur({ tiktok: new SahteTikTok(), ayarDosyasi: path.join(gecici, 'ayarlar.json'), hediyeDosyasi: path.join(gecici, 'hediyeler.json') });
  await new Promise((c) => sunucu.listen(PORT, '127.0.0.1', c));
});
after(async () => {
  await sunucu.kapat();
  fs.rmSync(gecici, { recursive: true, force: true });
});

test('panel sayfası güvenlik başlıklarıyla gelir', async () => {
  const r = await istek('GET', '/api/durum');
  assert.equal(r.kod, 200);
  assert.match(r.basliklar['content-security-policy'], /default-src 'self'/);
  assert.equal(r.basliklar['x-content-type-options'], 'nosniff');
  assert.equal(r.basliklar['access-control-allow-origin'], undefined);
});

test('yabancı Host başlığı reddedilir (DNS rebinding)', async () => {
  const r = await istek('GET', '/api/durum', { basliklar: { host: `saldirgan.example:${PORT}` } });
  assert.equal(r.kod, 403);
});

test('yabancı Origin reddedilir', async () => {
  const r = await istek('POST', '/api/demo', { govde: { acik: true }, basliklar: { ...json, origin: 'https://saldirgan.example' } });
  assert.equal(r.kod, 403);
});

test('özel başlık olmadan değiştiren istek reddedilir (CSRF)', async () => {
  const r = await istek('POST', '/api/demo', { govde: { acik: true }, basliklar: { 'content-type': 'application/json' } });
  assert.equal(r.kod, 403);
  const r2 = await istek('POST', '/api/demo', { govde: 'acik=1', basliklar: { 'x-istek': 'tiktok-oyun', 'content-type': 'text/plain' } });
  assert.equal(r2.kod, 415);
});

test('klasör dışına çıkma (path traversal) engellenir', async () => {
  for (const yol of ['/../server.js', '/%2e%2e/server.js', '/..%2fpackage.json', '/../data/ayarlar.json']) {
    const r = await istek('GET', yol);
    assert.ok([403, 404].includes(r.kod), `${yol} -> ${r.kod}`);
    assert.doesNotMatch(r.govde, /sunucuKur|tiktok-live-connector/);
  }
});

test('büyük gövde reddedilir', async () => {
  const r = await istek('PUT', '/api/ayarlar', { govde: { x: 'a'.repeat(20000) }, basliklar: json });
  assert.equal(r.kod, 413);
});

test('ayarlar doğrulanır ve sınırlanır', async () => {
  const r = await istek('PUT', '/api/ayarlar', {
    govde: {
      turSuresi: 99999,
      takimlar: [{ ad: '<b>Aslanlar</b>', renk: 'red' }, { ad: 'Kartallar', renk: '#00ff00' }],
      tufekJeton: 200,
      bombaJeton: 100,
      kotu: 'alan',
    },
    basliklar: json,
  });
  assert.equal(r.kod, 200);
  const a = JSON.parse(r.govde).ayarlar;
  assert.equal(a.turSuresi, 600);
  assert.equal(a.takimlar[0].renk, '#e53935');
  assert.equal(a.takimlar[1].renk, '#00ff00');
  assert.deepEqual([a.tufekJeton, a.bombaJeton, a.ejderhaJeton], [20, 100, 300]); // sırası bozuk eşikler varsayılana döner
  assert.equal(a.kotu, undefined);
});

test('bağlan: geçersiz kullanıcı adı 400, geçerli olan bağlanır', async () => {
  let r = await istek('POST', '/api/baglan', { govde: { kullanici: 'kötü ad!' }, basliklar: json });
  assert.equal(r.kod, 400);
  r = await istek('POST', '/api/baglan', { govde: { kullanici: '@deneme_hesap' }, basliklar: json });
  assert.equal(r.kod, 200);
  assert.equal(JSON.parse(r.govde).baglanti.kullanici, 'deneme_hesap');
});

test('test olayı demo işaretiyle olay akışına düşer', async () => {
  const olaylar = await new Promise((coz, red) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/olaylar', headers: { host: `127.0.0.1:${PORT}` } }, (res) => {
      let s = '';
      res.on('data', (p) => {
        s += p;
        if (s.includes('event: olay')) {
          req.destroy();
          coz(s);
        }
      });
    });
    req.on('error', (e) => (e.code === 'ECONNRESET' ? null : red(e)));
    setTimeout(() => istek('POST', '/api/test', { govde: { tur: 'hediye', jeton: 100, ad: 'Test' }, basliklar: json }), 100);
  });
  assert.match(olaylar, /"demo":true/);
  assert.match(olaylar, /"jeton":100/);
});

test('eski TL ayarları yok sayılır, jeton varsayılanları gelir', async () => {
  const { ayarlariDogrula } = await import('../src/ayarlar.js');
  const a = ayarlariDogrula({ okTL: 15, tufekTL: 12, bombaTL: 50 });
  assert.deepEqual([a.tufekJeton, a.bombaJeton, a.ejderhaJeton], [20, 100, 300]);
  assert.equal(a.tufekTL, undefined);
});

test('yayın sayfası (Netlify): yalnızca kayıtlı adres, yalnızca olay akışı ve skor', async () => {
  const site = 'https://cephe-deneme.netlify.app';
  // kayıt yokken reddedilir
  let r = await istek('GET', '/api/durum', { basliklar: { origin: site } });
  assert.equal(r.kod, 403);
  // adresi kaydet (yol ve sondaki / atılır)
  r = await istek('PUT', '/api/ayarlar', { govde: { yayinSayfasi: site + '/oyun?x=1' }, basliklar: json });
  assert.equal(JSON.parse(r.govde).ayarlar.yayinSayfasi, site);
  // ön kontrol (preflight): yerel ağ izni başlığı döner
  r = await istek('OPTIONS', '/olaylar', { basliklar: { origin: site, 'access-control-request-private-network': 'true' } });
  assert.equal(r.kod, 204);
  assert.equal(r.basliklar['access-control-allow-origin'], site);
  assert.equal(r.basliklar['access-control-allow-private-network'], 'true');
  // skor özeti gönderebilir
  r = await istek('POST', '/api/oyun-durumu', { govde: { tur: 1 }, basliklar: { ...json, origin: site } });
  assert.equal(r.kod, 200);
  assert.equal(r.basliklar['access-control-allow-origin'], site);
  // ama komut, demo, ayar, bağlan yasak
  for (const [yontem, yol] of [['POST', '/api/demo'], ['POST', '/api/komut'], ['PUT', '/api/ayarlar'], ['POST', '/api/baglan'], ['GET', '/api/durum']]) {
    r = await istek(yontem, yol, { govde: {}, basliklar: { ...json, origin: site } });
    assert.equal(r.kod, 403, `${yontem} ${yol}`);
  }
  // başka bir site hiçbir şey yapamaz
  r = await istek('OPTIONS', '/olaylar', { basliklar: { origin: 'https://kotu.netlify.app' } });
  assert.equal(r.kod, 403);
  // http ya da tuhaf adresler kaydedilmez
  const { kaynakTemizle } = await import('../src/ayarlar.js');
  assert.equal(kaynakTemizle('http://site.netlify.app'), '');
  assert.equal(kaynakTemizle('javascript:alert(1)'), '');
  const kimlikli = new URL('https://ornek.example'); // adreste kullanıcı bilgisi olan adres reddedilmeli
  kimlikli.username = 'kullanici';
  assert.equal(kaynakTemizle(kimlikli.href), '');
  await istek('PUT', '/api/ayarlar', { govde: { yayinSayfasi: '' }, basliklar: json });
});
