import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Motor, sadelestir, adSuz, hediyeEtkisi, jetonEsikleri, siraVer } from '../public/oyun/motor.js';
import { VARSAYILAN } from '../src/ayarlar.js';

const ayar = (yama = {}) => ({ ...JSON.parse(JSON.stringify(VARSAYILAN)), botlar: false, ...yama });
const k = (id) => ({ id, ad: id, foto: '' });
// sabit sıralı sahte rastgele (testler tekrarlanabilir olsun)
function tohum(n = 1) {
  return () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
}
const yeni = (yama, r = tohum()) => new Motor(ayar(yama), { rastgele: r });
const ilerle = (m, sn, adim = 1 / 30) => {
  for (let t = 0; t < sn - 1e-9; t += adim) m.tick(adim);
};
const begen = (m, id) => m.olay({ tur: 'begeni', kullanici: k(id), adet: 1 });
const yaz = (m, id, metin) => m.olay({ tur: 'yorum', kullanici: k(id), metin });
const hediye = (m, id, jeton, adet = 1) => m.olay({ tur: 'hediye', kullanici: k(id), hediye: { ad: 'H', jeton }, adet });
const savasaGec = (m) => ilerle(m, m.ayarlar.hazirlik + 0.05);
const oyuncu = (m, id) => m.oyuncular.get(id);

test('beğeni oyuna sokar, küçük takıma yerleştirir', () => {
  const m = yeni({ otoSavas: false });
  begen(m, 'a');
  begen(m, 'b');
  begen(m, 'c');
  begen(m, 'd');
  assert.equal(m.canli(0) + m.canli(1), 4);
  assert.equal(Math.abs(m.canli(0) - m.canli(1)), 0);
  m.olay({ tur: 'giris', kullanici: k('e') });
  assert.equal(oyuncu(m, 'e'), undefined); // odaya girmek oyuna sokmaz
});

test('yorumla takım seçimi ve 30 sn değişim sınırı', () => {
  const m = yeni({ otoSavas: false });
  yaz(m, 'x', '1'); // iki takımda da biri olsun, tur "son şans"la bitmesin
  yaz(m, 'y', '2');
  yaz(m, 'a', 'kırmızı');
  assert.equal(oyuncu(m, 'a').takim, 0);
  yaz(m, 'a', '2');
  assert.equal(oyuncu(m, 'a').takim, 1);
  yaz(m, 'a', '1'); // 30 sn dolmadı
  assert.equal(oyuncu(m, 'a').takim, 1);
  ilerle(m, 31);
  yaz(m, 'a', '1');
  assert.equal(oyuncu(m, 'a').takim, 0);
});

test('her yeni turda herkes çıkar; arada beğenen bir sonraki turda hazır', () => {
  const m = yeni({ otoSavas: false });
  begen(m, 'a');
  begen(m, 'b');
  savasaGec(m);
  m.komut('turuBitir');
  assert.equal(m.asama, 'ara');
  begen(m, 'a'); // arada beğendi
  ilerle(m, m.ayarlar.araSuresi + 0.1);
  assert.equal(m.asama, 'hazirlik');
  assert.ok(oyuncu(m, 'a').asker, 'arada beğenen hazır girdi');
  assert.equal(oyuncu(m, 'b').asker, null, 'beğenmeyen çıktı');
});

test('hediye eşikleri jetona göre (TikTok TR fiyatları)', () => {
  const a = ayar();
  assert.deepEqual(jetonEsikleri(a), { tufek: 20, bomba: 100, ejderha: 300 });
  const e = (j) => [hediyeEtkisi(j, a).tur, hediyeEtkisi(j, a).kisi];
  assert.deepEqual(e(1), ['kalkan', 0]); // Gül
  assert.deepEqual(e(10), ['kalkan', 0]); // Kalp, Rosa
  assert.deepEqual(e(20), ['tufek', 1]); // Parfüm
  assert.deepEqual(e(30), ['tufek', 1]); // Donat
  assert.deepEqual(e(50), ['tufek', 2]); // Çay
  assert.deepEqual(e(100), ['bomba', 6]); // Elle Kalp
  assert.deepEqual(e(150), ['bomba', 8]); // Sceptre
  assert.deepEqual(e(199), ['bomba', 10]); // Taç
  assert.deepEqual(e(299), ['bomba', 15]); // Corgi
  assert.equal(e(300)[0], 'ejderha'); // Elmas aşk yüzüğü
  assert.equal(e(500)[0], 'ejderha'); // Para Tabancası
});

function kalabalik(m, n0, n1) {
  for (let i = 0; i < n0; i++) yaz(m, 'k' + i, '1');
  for (let i = 0; i < n1; i++) yaz(m, 'm' + i, '2');
}

test('tüfek 1, bomba 6 kişi düşürür; atan puan alır', () => {
  const m = yeni({ otoSavas: false });
  kalabalik(m, 3, 12);
  savasaGec(m);
  hediye(m, 'k0', 20); // tüfek
  assert.equal(m.canli(1), 11);
  hediye(m, 'k1', 100); // bomba
  assert.equal(m.canli(1), 5);
  assert.equal(oyuncu(m, 'k1').puan, 100 + 6);
  assert.equal(oyuncu(m, 'k1').oldurme, 6);
});

test('ejderha turu direkt bitirir', () => {
  const m = yeni({ otoSavas: false });
  kalabalik(m, 2, 8);
  savasaGec(m);
  hediye(m, 'k0', 400);
  assert.equal(m.asama, 'ara');
  assert.equal(m.sonuc.kazanan, 0);
  assert.equal(m.sonuc.neden, 'ejderha');
  assert.deepEqual(m.galibiyet, [1, 0]);
});

test('kalkan bir öldürmeyi karşılar; kaptan tacı da bir kez', () => {
  const m = yeni({ otoSavas: false });
  yaz(m, 'kaptan', '2');
  yaz(m, 'atan', '1');
  hediye(m, 'kaptan', 1); // kalkan + kaptan olur (puan 1)
  assert.equal(oyuncu(m, 'kaptan').asker.kalkan, 1);
  savasaGec(m);
  hediye(m, 'atan', 20); // tüfek: kalkan kırılır
  assert.ok(oyuncu(m, 'kaptan').asker);
  assert.equal(oyuncu(m, 'kaptan').asker.kalkan, 0);
  hediye(m, 'atan', 20); // tüfek: taç kırılır
  assert.ok(oyuncu(m, 'kaptan').asker);
  hediye(m, 'atan', 20); // tüfek: düşer
  assert.equal(oyuncu(m, 'kaptan').asker, null);
});

test('düşen 10 sn dolmadan beğeniyle dönemez', () => {
  const m = yeni({ otoSavas: false });
  yaz(m, 'a', '1');
  yaz(m, 'b', '2');
  yaz(m, 'c', '2');
  savasaGec(m);
  hediye(m, 'a', 20);
  hediye(m, 'a', 20);
  const dusen = ['b', 'c'].map((id) => oyuncu(m, id));
  assert.ok(dusen.every((o) => !o.asker));
  yaz(m, 'd', '2'); // takım boş kalıp turu kaybetmesin
  ilerle(m, 5);
  begen(m, 'b');
  assert.equal(oyuncu(m, 'b').asker, null);
  ilerle(m, 5.5);
  begen(m, 'b');
  assert.ok(oyuncu(m, 'b').asker);
});

test('küçük hediye düşen arkadaşı diriltir ve kalkan verir', () => {
  const m = yeni({ otoSavas: false });
  yaz(m, 'a', '1');
  yaz(m, 'b', '2');
  yaz(m, 'c', '2');
  savasaGec(m);
  hediye(m, 'a', 20); // b ya da c düşer
  const dusen = ['b', 'c'].find((id) => !oyuncu(m, id).asker);
  const kalan = dusen === 'b' ? 'c' : 'b';
  hediye(m, kalan, 1);
  assert.ok(oyuncu(m, dusen).asker, 'dirildi');
  assert.equal(oyuncu(m, kalan).asker.kalkan, 1);
});

test('küçük hediyeler birikip tüfek mermisine dönüşür', () => {
  const m = yeni({ otoSavas: false });
  yaz(m, 'a', '1');
  for (let i = 0; i < 4; i++) yaz(m, 'm' + i, '2');
  savasaGec(m);
  hediye(m, 'a', 1, 19); // 19 jeton
  assert.equal(m.canli(1), 4);
  hediye(m, 'a', 1, 1); // 20 jeton → 1 mermi
  assert.equal(m.canli(1), 3);
});

test('eşit puan: aynı sıra, ikisi de kaptan', () => {
  const m = yeni({ otoSavas: false });
  yaz(m, 'a', '1');
  yaz(m, 'b', '1');
  yaz(m, 'c', '1');
  hediye(m, 'a', 10);
  hediye(m, 'b', 10);
  hediye(m, 'c', 5);
  const s = m.siralama(0);
  assert.deepEqual(s.map((x) => [x.oyuncu.id, x.sira]), [['a', 1], ['b', 1], ['c', 2]]);
  assert.deepEqual(m.kaptanlar(0).map((o) => o.id), ['a', 'b']);
  assert.deepEqual(siraVer([{ puan: 5 }, { puan: 5 }, { puan: 3 }, { puan: 1 }]).map((x) => x.sira), [1, 1, 2, 3]);
});

test('süre bitince çok asker kalan kazanır; eşitse uzatma, sonra berabere', () => {
  const m = yeni({ otoSavas: false, turSuresi: 60, cilginAn: false });
  kalabalik(m, 3, 2);
  savasaGec(m);
  ilerle(m, 60.1);
  assert.equal(m.sonuc.kazanan, 0);
  const m2 = yeni({ otoSavas: false, turSuresi: 60 });
  kalabalik(m2, 2, 2);
  savasaGec(m2);
  ilerle(m2, 60.1);
  assert.equal(m2.asama, 'uzatma');
  ilerle(m2, 20.1);
  assert.equal(m2.sonuc.kazanan, -1);
});

test('takım tükenirse 5 sn son şans; beğeniyle kurtulabilir', () => {
  const m = yeni({ otoSavas: false });
  kalabalik(m, 1, 1);
  savasaGec(m);
  hediye(m, 'k0', 20);
  ilerle(m, 2);
  assert.equal(m.asama, 'savas');
  begen(m, 'yeni'); // küçük takım = mavi
  assert.equal(oyuncu(m, 'yeni').takim, 1);
  ilerle(m, 6);
  assert.equal(m.asama, 'savas', 'kurtuldu');
  hediye(m, 'k0', 20);
  ilerle(m, 5.2);
  assert.equal(m.asama, 'ara');
  assert.equal(m.sonuc.neden, 'yok');
});

test('hazırlıkta dövüş yok, savaşta ön saf kendiliğinden dövüşür', () => {
  const m = yeni();
  kalabalik(m, 10, 10);
  ilerle(m, m.ayarlar.hazirlik - 1);
  assert.equal(m.canli(0) + m.canli(1), 20);
  ilerle(m, 60);
  const dusme = m.fx.filter((f) => f.tip === 'olum').length;
  assert.ok(dusme >= 4, `60 sn'de ${dusme} düşme`);
  assert.ok(dusme <= 40, `60 sn'de ${dusme} düşme (çok hızlı)`);
});

test('sınır dolunca sıra; düşen yerini sıradakine bırakır', () => {
  const m = yeni({ otoSavas: false, maksAsker: 10 });
  for (let i = 0; i < 12; i++) yaz(m, 'm' + i, '2');
  yaz(m, 'a', '1');
  assert.equal(m.canli(1), 10);
  assert.equal(m.takimlar[1].sira.length, 2);
  savasaGec(m);
  hediye(m, 'a', 20);
  assert.equal(m.canli(1), 10);
  assert.equal(m.takimlar[1].sira.length, 1);
});

test('arada gelen silah yeni savaş başlayınca ateşlenir', () => {
  const m = yeni({ otoSavas: false });
  kalabalik(m, 1, 6);
  savasaGec(m);
  m.komut('turuBitir');
  hediye(m, 'k0', 100); // bomba, arada
  for (let i = 0; i < 6; i++) begen(m, 'm' + i); // arada beğenip hazır olanlar
  ilerle(m, m.ayarlar.araSuresi + 0.1);
  assert.equal(m.canli(1), 6);
  savasaGec(m);
  ilerle(m, 3.1);
  assert.equal(m.canli(1), 0);
});

test('duraklatma zamanı ve olayları durdurur', () => {
  const m = yeni();
  m.komut('duraklat');
  const kalan = m.kalan;
  ilerle(m, 5);
  begen(m, 'a');
  assert.equal(m.kalan, kalan);
  assert.equal(m.oyuncular.size, 0);
  m.komut('devam');
  ilerle(m, 1);
  assert.ok(m.kalan < kalan);
});

test('Türkçe sadeleştirme ve ad süzgeci', () => {
  assert.equal(sadelestir('KIRMIZI'), 'kirmizi');
  assert.equal(adSuz('Deniz'), 'Deniz');
  assert.equal(adSuz('siktir git'), 'İzleyici');
  assert.equal(adSuz('Götürücü'), 'Götürücü');
});

test('beğeni hedefi dolunca Çılgın An başlar', () => {
  const m = yeni({ otoSavas: false, begeniHedefi: 100, cilginAn: false });
  yaz(m, 'a', '1');
  yaz(m, 'b', '2');
  savasaGec(m);
  for (let i = 0; i < 99; i++) m.olay({ tur: 'begeni', kullanici: k('x' + (i % 7)), adet: 1 });
  assert.ok(m.cilginBitis <= m.saat, 'henüz dolmadı');
  m.olay({ tur: 'begeni', kullanici: k('z'), adet: 1 });
  assert.ok(m.cilginBitis > m.saat, 'çılgın an başladı');
  assert.equal(m.begeniSayaci, 0);
});

test('hazırlıkta dolan beğeni hedefi savaş başlayınca Çılgın An açar', () => {
  const m = yeni({ otoSavas: false, begeniHedefi: 100, cilginAn: false });
  m.olay({ tur: 'begeni', kullanici: k('a'), adet: 100 });
  assert.equal(m.asama, 'hazirlik');
  assert.ok(m.cilginBitis <= m.saat);
  savasaGec(m);
  assert.ok(m.cilginBitis > m.saat);
});

test('ad süzgeci ayara bağlı; kapalıyken ad aynen görünür', () => {
  const m = yeni({ otoSavas: false });
  m.olay({ tur: 'yorum', kullanici: { id: 'q', ad: 'siktir 🦁', foto: 'https://p16.tiktokcdn.com/a.jpg' }, metin: '1' });
  const o = oyuncu(m, 'q');
  assert.equal(m.adGoster(o), 'siktir 🦁');
  assert.equal(m.fotoGoster(o), 'https://p16.tiktokcdn.com/a.jpg');
  m.ayarlariGuncelle(ayar({ otoSavas: false, adSuzgeci: true }));
  assert.equal(m.adGoster(o), 'İzleyici');
  assert.equal(m.fotoGoster(o), '');
});

test('düşürme olayı katil ve ölenleri bildirir', () => {
  const m = yeni({ otoSavas: false });
  kalabalik(m, 1, 5);
  savasaGec(m);
  m.fx.length = 0;
  hediye(m, 'k0', 100);
  const ol = m.fx.find((f) => f.tip === 'oldurme');
  assert.equal(ol.id, 'k0');
  assert.equal(ol.silah, 'bomba');
  assert.equal(ol.olenler.length, 5);
  assert.ok(m.fx.some((f) => f.tip === 'kart' && f.silah === 'bomba'));
  const olumler = m.fx.filter((f) => f.tip === 'olum');
  assert.deepEqual(olumler.map((f) => f.atis), [0, 1, 2, 3, 4]);
});

test('hediye adı ve resmi kart olayına taşınır', () => {
  const m = yeni({ otoSavas: false });
  kalabalik(m, 1, 6);
  savasaGec(m);
  m.fx.length = 0;
  m.olay({ tur: 'hediye', kullanici: k('k0'), hediye: { ad: 'Elle Kalp', jeton: 100, resim: 'https://p16-webcast.tiktokcdn.com/x.webp' }, adet: 1 });
  const kart = m.fx.find((f) => f.tip === 'kart');
  assert.equal(kart.hediye.ad, 'Elle Kalp');
  assert.equal(kart.hediye.resim, 'https://p16-webcast.tiktokcdn.com/x.webp');
  assert.ok(m.fx.some((f) => f.tip === 'akis' && f.metin.includes('Elle Kalp → Bomba')));
});

test('botlar: boş takımlar en az botSayisi askerle dolar, gerçek izleyici gelince çekilir', () => {
  const m = yeni({ otoSavas: false, botlar: true, botSayisi: 4 });
  ilerle(m, 0.6);
  assert.equal(m.canli(0), 4);
  assert.equal(m.canli(1), 4);
  yaz(m, 'a', '1');
  yaz(m, 'b', '1');
  ilerle(m, 0.6);
  assert.equal(m.canli(0), 4, 'iki gerçek + iki bot');
  const botlar0 = m.takimlar[0].askerler.filter((id) => m.oyuncular.get(id).bot).length;
  assert.equal(botlar0, 2);
  for (let i = 0; i < 5; i++) yaz(m, 'k' + i, '1');
  ilerle(m, 0.6);
  assert.equal(m.takimlar[0].askerler.filter((id) => m.oyuncular.get(id).bot).length, 0, 'yeterli gerçek izleyici var, bot yok');
});

test('botlar puan almaz, kaptan olamaz; takım dengesi gerçek izleyiciye göre', () => {
  const m = yeni({ otoSavas: true, botlar: true, botSayisi: 6 });
  ilerle(m, m.ayarlar.hazirlik + 40);
  for (const o of m.oyuncular.values()) if (o.bot) assert.equal(o.puan, 0);
  assert.equal(m.kaptanlar(0).length + m.kaptanlar(1).length, 0);
  begen(m, 'gercek1');
  begen(m, 'gercek2');
  const t1 = oyuncu(m, 'gercek1').takim, t2 = oyuncu(m, 'gercek2').takim;
  assert.notEqual(t1, t2, 'iki gerçek izleyici farklı takımlara dağıldı');
});

test('dolu takımda bot gerçek izleyiciye yer açar', () => {
  const m = yeni({ otoSavas: false, botlar: true, botSayisi: 10, maksAsker: 10 });
  ilerle(m, 0.6);
  assert.equal(m.canli(0), 10);
  yaz(m, 'a', '1');
  assert.ok(oyuncu(m, 'a').asker, 'sıraya girmeden oyuna girdi');
  assert.equal(m.canli(0), 10);
});

test('botlar kapalıyken bot oluşmaz', () => {
  const m = yeni({ botlar: false });
  ilerle(m, 2);
  assert.equal(m.canli(0) + m.canli(1), 0);
});
