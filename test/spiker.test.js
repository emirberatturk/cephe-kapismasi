import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { konusmaAdi, macAdiSoz, skorCumlesi, Yorumcu } from '../public/futbol/spiker.js';
import { FutbolMotor } from '../public/futbol/motor.js';
import { ayarlariDogrula } from '../src/ayarlar.js';
import { spikerMetni } from '../src/spiker.js';

process.env.PORT = '5094';
const { sunucuKur } = await import('../server.js');

test('okunacak ad: emoji ve işaretler atılır, harf ile rakam ayrılır', () => {
  assert.equal(konusmaAdi('emre994'), 'emre 994');
  assert.equal(konusmaAdi('⚽ Ayşe_Kaya ✨'), 'Ayşe Kaya');
  assert.equal(konusmaAdi('user84710293'), 'user 8 4 7 1 0 2 9 3');
  assert.equal(konusmaAdi('🔥🔥'), '');
});

test('maç adı ve skor cümleleri', () => {
  assert.equal(macAdiSoz('ÇEYREK FİNAL 2'), 'çeyrek final iki');
  assert.equal(skorCumlesi('Galatasaray', 1, 0), 'Galatasaray bir sıfır öne geçti!');
  assert.equal(skorCumlesi('Fenerbahçe', 1, 1), 'Fenerbahçe skoru eşitledi! bir bir!');
  assert.equal(skorCumlesi('Beşiktaş', 3, 1), 'Beşiktaş farkı ikiye çıkardı! üç bir!');
  assert.equal(skorCumlesi('Göztepe', 1, 3), 'Göztepe farkı ikiye indirdi! bir üç!');
});

test('sunucu metni: kontrol karakterleri atılır, 160 harfle sınırlanır', () => {
  assert.equal(spikerMetni('a\u0000b‮c'), 'abc');
  assert.equal(Array.from(spikerMetni('ş'.repeat(300))).length, 160);
  assert.equal(spikerMetni(42), '');
});

function yorumcuKur() {
  const a = ayarlariDogrula({ oyunTuru: 'futbol', botlar: true, botSayisi: 4, futbol: { hava: false, surpriz: false } });
  let n = 7;
  const m = new FutbolMotor(a, { rastgele: () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646 });
  const soylenen = [];
  const sahte = { soyle: (metin, o) => soylenen.push({ metin, ...o }), hazirla() {}, bosMu: () => true, tick() {} };
  return { m, y: new Yorumcu(m, sahte), soylenen };
}

test('gol anonsu: önce atanın adı, sonra skor cümlesi', () => {
  const { m, y, soylenen } = yorumcuKur();
  y.olay({ tip: 'gol', taraf: 0, ad: 'emre994', bot: false, kendi: false, tur: 'normal', skor: [1, 0] });
  assert.equal(soylenen[0].metin, 'emre 994, gooool!');
  assert.equal(soylenen[0].oncelik, 3);
  assert.equal(soylenen[0].kes, true);
  assert.equal(soylenen[1].metin, `${m.takim(0).ad} bir sıfır öne geçti!`);
});

test('bot golünde ad yerine takım; hediye golü ve penaltı ayrı söylenir', () => {
  const { m, y, soylenen } = yorumcuKur();
  y.olay({ tip: 'gol', taraf: 1, ad: '🤖 Bot 3', bot: true, kendi: false, tur: 'normal', skor: [0, 1] });
  assert.equal(soylenen[0].metin, `Gooool! ${m.takim(1).ad}!`);
  y.olay({ tip: 'gol', taraf: 0, ad: 'Ayşe', bot: false, kendi: false, tur: 'roket', skor: [1, 1] });
  assert.equal(soylenen[2].metin, 'Ayşe, hediye golü! Gooool!');
  assert.equal(soylenen[3].metin, `${m.takim(0).ad} skoru eşitledi! bir bir!`);
});

test('maç başı geri sayımı: "Maç başlıyor", 3, 2, 1 sırayla bir kez', () => {
  const { m, y, soylenen } = yorumcuKur();
  for (let t = 0; t < m.f.hazirlik; t += 1 / 30) {
    m.tick(1 / 30);
    y.tick();
  }
  const metinler = soylenen.map((s) => s.metin);
  assert.deepEqual(metinler, ['Maç başlıyor!', 'Üç!', 'İki!', 'Bir!']);
});

test('maç sonu ve tur anonsu', () => {
  const { m, y, soylenen } = yorumcuKur();
  m.sonMac = { kazanan: m.eslesme.ev, kazananTaraf: 0, skor: [2, 1], pen: null, sira: 0, tur: 8 };
  y.olay({ tip: 'macSonu', kazanan: 0 });
  const ad = m.takimBilgi(m.eslesme.ev).ad;
  assert.equal(soylenen[0].metin, `Maç bitti! ${ad} iki bir kazandı!`);
  assert.equal(soylenen[1].metin, `${ad} yarı finale yükseldi!`);
});

// ------------------------------------------------------------ sunucu ucu
async function sunucuyla(ayarlar, is) {
  const sahteTikTok = Object.assign(new EventEmitter(), { durum: { hal: 'bosta', kullanici: '', hata: '', izleyici: 0 }, async baglan() {}, async kes() {} });
  const istenen = [];
  const seslendirici = {
    async seslendir(metin) {
      istenen.push(metin);
      return { tur: 'audio/wav', veri: Buffer.from('RIFF0000WAVE') };
    },
    kapat() {},
  };
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), 'spiker-test-'));
  fs.writeFileSync(path.join(klasor, 'a.json'), JSON.stringify(ayarlar));
  const sunucu = sunucuKur({ tiktok: sahteTikTok, ayarDosyasi: path.join(klasor, 'a.json'), hediyeDosyasi: path.join(klasor, 'h.json'), seslendirici });
  await new Promise((c) => sunucu.listen(5094, '127.0.0.1', c));
  try {
    await is(istenen);
  } finally {
    await sunucu.kapat();
    fs.rmSync(klasor, { recursive: true, force: true });
  }
}
const istek = (ek = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Istek': 'tiktok-oyun', ...(ek.headers || {}) },
  body: JSON.stringify(ek.govde || { metin: 'emre, gol!' }),
});

test('/api/spiker: yerel oyun ekranına ses döner; başlıksız istek reddedilir', async () => {
  await sunucuyla({ spiker: true }, async (istenen) => {
    const r = await fetch('http://127.0.0.1:5094/api/spiker', istek());
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'audio/wav');
    assert.equal(Buffer.from(await r.arrayBuffer()).toString().slice(0, 4), 'RIFF');
    assert.deepEqual(istenen, ['emre, gol!']);
    const r2 = await fetch('http://127.0.0.1:5094/api/spiker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"metin":"x"}' });
    assert.equal(r2.status, 403);
    const r3 = await fetch('http://127.0.0.1:5094/api/spiker', istek({ govde: { metin: '   ' } }));
    assert.equal(r3.status, 400);
  });
});

test('/api/spiker: yalnızca kayıtlı yayın sayfası; spiker kapalıysa reddedilir', async () => {
  await sunucuyla({ spiker: true, yayinSayfasi: 'https://ornek.netlify.app' }, async () => {
    const kayitli = await fetch('http://127.0.0.1:5094/api/spiker', istek({ headers: { Origin: 'https://ornek.netlify.app' } }));
    assert.equal(kayitli.status, 200);
    assert.equal(kayitli.headers.get('access-control-allow-origin'), 'https://ornek.netlify.app');
    const yabanci = await fetch('http://127.0.0.1:5094/api/spiker', istek({ headers: { Origin: 'https://kotu.example' } }));
    assert.equal(yabanci.status, 403);
  });
  await sunucuyla({ spiker: false }, async (istenen) => {
    const r = await fetch('http://127.0.0.1:5094/api/spiker', istek());
    assert.equal(r.status, 403);
    assert.equal(istenen.length, 0);
  });
});
