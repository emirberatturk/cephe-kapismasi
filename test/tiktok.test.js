import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kullaniciAdiTemizle, kullaniciCevir, hediyeCevir, SeriSayaci, metinTemizle } from '../src/tiktok.js';

test('kullanıcı adı: @, link ve geçersiz karakterler', () => {
  assert.equal(kullaniciAdiTemizle('@ornek.hesap'), 'ornek.hesap');
  assert.equal(kullaniciAdiTemizle('https://www.tiktok.com/@ornek_1/live'), 'ornek_1');
  assert.equal(kullaniciAdiTemizle('ornek hesap'), '');
  assert.equal(kullaniciAdiTemizle('<script>'), '');
  assert.equal(kullaniciAdiTemizle(''), '');
});

test('kullanıcı: v3 alanları, yabancı foto adresi reddedilir', () => {
  const k = kullaniciCevir({
    displayId: 'izleyici1',
    nickname: 'İzleyici‮ Bir',
    avatarThumb: { urlList: ['https://p16-sign-va.tiktokcdn.com/a.webp'] },
  });
  assert.deepEqual(k, { id: 'izleyici1', ad: 'İzleyici Bir', foto: 'https://p16-sign-va.tiktokcdn.com/a.webp' });
  const kotu = kullaniciCevir({ displayId: 'x', avatarThumb: { urlList: ['https://kotu.example/a.png'] } });
  assert.equal(kotu.foto, '');
  assert.equal(kullaniciCevir(null), null);
});

test('metin temizleme: kontrol ve görünmez karakterler atılır, uzunluk sınırı', () => {
  assert.equal(metinTemizle('a\u0000b​c'), 'abc');
  assert.equal(metinTemizle('x'.repeat(50), 10).length, 10);
});

test('hediye: jeton fiyatı diamondCount alanından', () => {
  const h = hediyeCevir({
    giftId: '5655', repeatCount: 3, repeatEnd: 0,
    gift: { name: 'Rose', diamondCount: 1, type: 1, image: { urlList: ['https://p16-webcast.tiktokcdn.com/img/gul.webp'] } },
  });
  assert.equal(h.ad, 'Gül'); // TikTok Türkiye panelindeki ad
  assert.equal(h.resim, 'https://p16-webcast.tiktokcdn.com/img/gul.webp');
  const yabanci = hediyeCevir({ gift: { name: 'Money Gun', diamondCount: 500, image: { urlList: ['https://kotu.example/x.png'] } } });
  assert.equal(yabanci.ad, 'Para Tabancası');
  assert.equal(yabanci.resim, '');
  assert.equal(h.jeton, 1);
  assert.equal(h.seri, true);
  assert.equal(h.tekrar, 3);
  assert.equal(h.bitti, false);
});

test('seri sayacı: birikerek gelen tekrarları bir kez sayar', () => {
  const s = new SeriSayaci();
  const h = (tekrar, bitti) => ({ id: '1', grup: 'g', seri: true, tekrar, bitti });
  assert.equal(s.artis('u', h(1, false), 0), 1);
  assert.equal(s.artis('u', h(4, false), 100), 3);
  assert.equal(s.artis('u', h(4, false), 200), 0); // aynı bildirim tekrar geldi
  assert.equal(s.artis('u', h(5, true), 300), 1); // seri bitti
  assert.equal(s.artis('u', h(1, false), 400), 1); // yeni seri
  // seri olmayan hediye her olayda sayılır
  assert.equal(s.artis('u', { id: '9', grup: '', seri: false, tekrar: 1, bitti: true }), 1);
});

test('hediye listesi yanıtı ayıklanır, katalog dosyaya yazılır', async () => {
  const { hediyeListesiAyikla, HediyeKatalogu } = await import('../src/hediyeler.js');
  const os = await import('node:os');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const yanit = { data: { gifts: [
    { id: 1, name: 'Rose', diamond_count: 1, image: { url_list: ['https://p16-webcast.tiktokcdn.com/a.webp'] } },
    { id: 2, name: 'Hand Heart', diamond_count: 100, image: { url_list: ['https://p16-webcast.tiktokcdn.com/b.webp'] } },
    { id: 3, name: 'Kötü', diamond_count: 'x' },
  ] } };
  const liste = hediyeListesiAyikla(yanit);
  assert.deepEqual(liste.map((h) => [h.ad, h.jeton]), [['Gül', 1], ['Elle Kalp', 100]]);
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), 'katalog-'));
  const dosya = path.join(klasor, 'hediyeler.json');
  const k = new HediyeKatalogu(dosya);
  for (const h of liste) k.ekle(h);
  assert.equal(k.ekle({ ad: 'Gül', jeton: 1, resim: 'https://p16-webcast.tiktokcdn.com/a.webp' }), false); // tekrar
  assert.equal(k.ekle({ ad: 'Sahte', jeton: 5, resim: 'javascript:alert(1)' }), true);
  assert.equal(k.hepsi().find((h) => h.ad === 'Sahte').resim, '');
  k.kaydet();
  assert.equal(JSON.parse(fs.readFileSync(dosya, 'utf8')).length, 3);
  fs.rmSync(klasor, { recursive: true, force: true });
});
