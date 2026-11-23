import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FutbolMotor, kupaKur, kupaDoldur, seriBittiMi, hediyeEtkisi, F } from '../public/futbol/motor.js';
import { ayarlariDogrula, FUTBOL_VARSAYILAN } from '../src/ayarlar.js';

process.env.PORT = '5097';
const { sunucuKur } = await import('../server.js');

function tohumlu(n = 42) {
  return () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
}
const ayar = (ek = {}) => ayarlariDogrula({ oyunTuru: 'futbol', botlar: true, botSayisi: 4, ...ek, futbol: { surpriz: false, hava: false, ...(ek.futbol || {}) } });
const kisi = (i) => ({ id: 'k' + i, ad: 'İzleyici ' + i, foto: '' });
const yorum = (m, i, metin) => m.olay({ tur: 'yorum', kullanici: kisi(i), metin });
const hediye = (m, i, ad, jeton, adet = 1) => m.olay({ tur: 'hediye', kullanici: kisi(i), hediye: { ad, jeton }, adet });
function sur(m, sn, dt = 1 / 30) {
  for (let t = 0; t < sn; t += dt) m.tick(dt);
}
function bekle(m, kosul, maxSn = 120, dt = 1 / 30) {
  for (let t = 0; t < maxSn && !kosul(); t += dt) m.tick(dt);
  return kosul();
}
function macaBasla(m) {
  sur(m, m.f.hazirlik + 0.1);
  assert.equal(m.asama, 'mac');
}

test('kura (8 takım): çeyrek finallerde 8 farklı takım, kazananlar sonraki tura geçer', () => {
  const es = kupaKur(tohumlu(7), 8, 'tum');
  assert.deepEqual(es.map((e) => e.kisa), ['Ç1', 'Ç2', 'Ç3', 'Ç4', 'YF1', 'YF2', '3.', 'F']);
  const takimlar = es.slice(0, 4).flatMap((e) => [e.ev, e.dep]);
  assert.deepEqual([...takimlar].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(es[4].ev, -1);
  es[0].kazanan = es[0].ev;
  es[1].kazanan = es[1].dep;
  kupaDoldur(es);
  assert.equal(es[4].ev, es[0].ev);
  assert.equal(es[4].dep, es[1].dep);
  es[4].kazanan = es[4].ev;
  es[4].kaybeden = es[4].dep;
  kupaDoldur(es);
  assert.equal(es[7].ev, es[0].ev, 'yarı final kazananı finalde');
  assert.equal(es[6].ev, es[1].dep, 'yarı final kaybedeni üçüncülük maçında');
});

test('kura (24 takım): 16 takım ilk turda, 8 takım bay; 24 maç, final en sonda', () => {
  const es = kupaKur(tohumlu(11), 24, 'tum');
  assert.equal(es.length, 24);
  const ilk = es.filter((e) => e.tur === 32);
  const son16 = es.filter((e) => e.tur === 16);
  assert.equal(ilk.length, 8);
  assert.equal(son16.length, 8);
  const hepsi = [...ilk.flatMap((e) => [e.ev, e.dep]), ...son16.map((e) => e.ev)];
  assert.equal(new Set(hepsi).size, 24, 'her takım bir kez');
  assert.ok(son16.every((e) => e.ev >= 0 && e.dep === -1 && e.depK?.sonuc === 'kazanan'), 'bay geçen ilk tur galibini bekler');
  assert.equal(es.at(-2).tur, 3);
  assert.equal(es.at(-1).tur, 2);
  assert.equal(es[0].ad, 'İLK TUR 1');
  assert.equal(es[8].ad, 'SON 16 TURU 1');
  // ilk maçın galibi son 16'daki rakibine yazılır
  es[0].kazanan = es[0].dep;
  es[0].kaybeden = es[0].ev;
  kupaDoldur(es);
  const bekleyen = es.find((e) => e.depK?.mac === 0);
  assert.equal(bekleyen.dep, es[0].dep);
  // 16 ve 8 takımlık kupa da kurulabilir
  assert.equal(kupaKur(tohumlu(3), 24, 16).length, 16);
  assert.equal(kupaKur(tohumlu(3), 24, 8).length, 8);
});

test('takım adı eşleştirme: kısa ad, adın bir kelimesi ya da başı', () => {
  const m = new FutbolMotor(ayar(), { rastgele: tohumlu(2) });
  const bul = (ad) => m.f.takimlar.findIndex((t) => t.ad === ad);
  assert.equal(m.yorumTakim('fener kazanır').takim, bul('Fenerbahçe'));
  assert.equal(m.yorumTakim('rizespor').takim, bul('Çaykur Rizespor'));
  assert.equal(m.yorumTakim('RİZE').takim, bul('Çaykur Rizespor'));
  assert.equal(m.yorumTakim('karagümrük').takim, bul('Fatih Karagümrük'));
  assert.equal(m.yorumTakim('çorum').takim, bul('Çorum FK'));
  assert.equal(m.yorumTakim('sivas').takim, bul('Sivasspor'));
  assert.equal(m.yorumTakim('gs').takim, bul('Galatasaray'));
  assert.equal(m.yorumTakim('hadi bakalım').takim, -1);
});

test('penaltı atışları: erken biter, 5-5 eşitse ani ölüm', () => {
  assert.equal(seriBittiMi([true, true, true], [false, false, false]), true, '3-0, rakip yetişemez');
  assert.equal(seriBittiMi([true, true, true], [false, false]), false, 'rakibin 3 atışı var');
  assert.equal(seriBittiMi(Array(5).fill(true), Array(5).fill(true)), false);
  assert.equal(seriBittiMi([...Array(5).fill(true), true], [...Array(5).fill(true)]), false, 'ani ölümde ikinci atış bekleniyor');
  assert.equal(seriBittiMi([...Array(5).fill(true), true], [...Array(5).fill(true), false]), true);
});

test('hediye eşikleri: güç, koruma, süper şut, penaltı, direkt gol (en fazla 3)', () => {
  const f = FUTBOL_VARSAYILAN;
  assert.equal(hediyeEtkisi(1, f).tur, 'guc');
  assert.equal(hediyeEtkisi(9, f).tur, 'guc');
  assert.equal(hediyeEtkisi(10, f).tur, 'koruma');
  assert.equal(hediyeEtkisi(29, f).tur, 'koruma');
  assert.equal(hediyeEtkisi(30, f).tur, 'superSut');
  assert.equal(hediyeEtkisi(100, f).tur, 'penalti');
  assert.equal(hediyeEtkisi(299, f).tur, 'penalti');
  assert.deepEqual(hediyeEtkisi(300, f), { tur: 'gol', adet: 1 });
  assert.deepEqual(hediyeEtkisi(1000, f), { tur: 'gol', adet: 3 });
});

test('yorumla katılım: "1"/"2" ve kısa ad; oynamayan takımı yazan bu maça misafir girer', () => {
  const m = new FutbolMotor(ayar(), { rastgele: tohumlu(3) });
  const e = m.eslesme;
  yorum(m, 1, '1');
  yorum(m, 2, '2');
  yorum(m, 3, m.f.takimlar[e.ev].kisa.toLowerCase() + ' hadi');
  assert.equal(m.oyuncular.get('k1').taraf, 0);
  assert.equal(m.oyuncular.get('k2').taraf, 1);
  assert.equal(m.oyuncular.get('k3').taraf, 0);
  const oynamayan = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => i !== e.ev && i !== e.dep);
  yorum(m, 4, m.f.takimlar[oynamayan].ad);
  const o4 = m.oyuncular.get('k4');
  assert.ok(o4.saha, 'oynamayan takımın taraftarı bu maça misafir girdi');
  assert.equal(o4.taraftar, oynamayan, 'kendi takımı hatırlanıyor');
  // kendi takımının maçı gelince oraya kendiliğinden girer
  const sira = m.kupa.eslesmeler.findIndex((e, i) => i > 0 && (e.ev === oynamayan || e.dep === oynamayan));
  if (sira > 0) {
    m.kupa.sira = sira;
    m.macKur();
    assert.equal(m.takimIdx(o4.taraf), oynamayan);
  }
});

test('botlar eksik yeri doldurur, gerçek izleyiciye yer açar; saha dolunca yedek', () => {
  const m = new FutbolMotor(ayar({ futbol: { sahaOyuncu: 5 } }), { rastgele: tohumlu(5) });
  sur(m, 1);
  assert.equal(m.saha[0].length, 4, 'botSayisi kadar');
  assert.ok(m.kaleci(0), 'her takımın kalecisi var');
  for (let i = 0; i < 7; i++) yorum(m, i, '1');
  sur(m, 1);
  const sahada = m.sahadakiler(0);
  assert.equal(sahada.length, 5, 'sahada en fazla sahaOyuncu');
  assert.equal(sahada.filter((o) => o.bot).length, 0, 'botlar çekildi');
  assert.equal(m.yedek[0].length, 2, 'fazlası yedekte');
  assert.ok(m.kaleci(0), 'botlar çekilse de kaleci var');
});

test('direkt gol hediyesi: gol hediyeyi atana yazılır', () => {
  const m = new FutbolMotor(ayar(), { rastgele: tohumlu(11) });
  macaBasla(m);
  hediye(m, 9, 'Elmas aşk yüzüğü', 300);
  const o = m.oyuncular.get('k9');
  assert.ok(o.saha, 'hediye atan sahaya girdi');
  const t = o.taraf;
  const once = m.mac.skor[t];
  sur(m, 4);
  assert.equal(m.mac.skor[t], once + 1);
  assert.equal(o.gol, 1);
  assert.equal(m.golKrallari()[0].oyuncu, o);
  assert.equal(m.mac.goller.at(-1).tur, 'roket');
});

test('penaltı hediyesi: penaltı sahnesi kurulur ve süre bitince sonuçlanır', () => {
  const m = new FutbolMotor(ayar(), { rastgele: tohumlu(21) });
  macaBasla(m);
  hediye(m, 5, 'Elle Kalp', 100);
  sur(m, 2.5);
  assert.equal(m.asama, 'penalti');
  const p = m.penalti;
  assert.equal(p.atan, 'k5');
  sur(m, F.penaltiSure + 0.1);
  assert.ok(['gol', 'mac'].includes(m.asama));
  if (p.gol) assert.equal(m.oyuncular.get('k5').gol, 1);
});

test('berabere biten maç penaltılarla biter, kazanan bir sonraki tura yazılır', () => {
  const m = new FutbolMotor(ayar({ futbol: { macSuresi: 60 } }), { rastgele: tohumlu(8) });
  macaBasla(m);
  m.komut('turuBitir'); // 0-0 iken bitir
  assert.equal(m.asama, 'seri');
  assert.ok(bekle(m, () => m.asama === 'ara'), 'penaltılar bitti');
  const e = m.kupa.eslesmeler[0];
  assert.ok(e.pen, 'penaltı skoru kaydedildi');
  assert.notEqual(e.pen[0], e.pen[1]);
  assert.equal(e.kazanan, e.pen[0] > e.pen[1] ? e.ev : e.dep);
  assert.equal(m.kupa.sira, 1);
  const sonraki = m.kupa.eslesmeler.find((x) => x.evK?.mac === 0 || x.depK?.mac === 0);
  assert.equal(sonraki.evK?.mac === 0 ? sonraki.ev : sonraki.dep, e.kazanan);
});

test('maç arasında yazan sıradaki maçta sahaya girer', () => {
  const m = new FutbolMotor(ayar({ futbol: { macSuresi: 60 } }), { rastgele: tohumlu(13) });
  macaBasla(m);
  m.komut('turuBitir');
  assert.ok(bekle(m, () => m.asama === 'ara'), 'penaltılar bitti');
  yorum(m, 30, '2');
  assert.equal(m.oyuncular.get('k30').hazir, 1);
  sur(m, m.f.araSuresi + 0.1);
  assert.equal(m.asama, 'hazirlik');
  assert.equal(m.oyuncular.get('k30').taraf, 1);
  assert.ok(m.oyuncular.get('k30').saha);
});

test('beğeni hedefi dolunca sahaya ikinci top iner', () => {
  const m = new FutbolMotor(ayar({ begeniHedefi: 100 }), { rastgele: tohumlu(17) });
  macaBasla(m);
  for (let i = 0; i < 20; i++) m.olay({ tur: 'begeni', kullanici: kisi(i), adet: 5 });
  assert.equal(m.toplar.length, 2);
  sur(m, F.cilginSure + 1);
  if (m.asama === 'mac') assert.equal(m.toplar.length, 1);
});

test('bütün kupa hatasız biter: şampiyonun kupası sayılır, yeni kupa kurulur', () => {
  const m = new FutbolMotor(ayar({ futbol: { macSuresi: 60, araSuresi: 8 } }), { rastgele: tohumlu(99) });
  let bitti = false;
  for (let i = 0; i < 30 * 60 * 90 && !bitti; i++) {
    m.tick(1 / 30);
    for (const b of m.toplar) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y));
    bitti = m.kupa.no === 2;
  }
  assert.ok(bitti, 'kupa bitti');
  assert.equal(m.kupalar.reduce((a, b) => a + b, 0), 1);
  assert.equal(m.bitenKupa.eslesmeler.length, 24, '24 takımın hepsi: 24 maç');
  assert.equal(m.bitenKupa.eslesmeler.filter((e) => e.kazanan >= 0).length, 24);
  assert.equal(m.asama, 'kupaSonu');
});

test('panel özeti doğrulamadan bozulmadan geçer', () => {
  const m = new FutbolMotor(ayar(), { rastgele: tohumlu(4) });
  macaBasla(m);
  hediye(m, 2, 'Elmas aşk yüzüğü', 300);
  sur(m, 4);
  const o = ayarlariDogrula.oyunOzeti(JSON.parse(JSON.stringify(m.ozet())));
  assert.equal(o.oyun, 'futbol');
  assert.equal(o.futbol.ev, m.eslesme.ev);
  assert.deepEqual(o.futbol.skor, m.mac.skor);
  assert.equal(o.futbol.golKrallari[0].gol, 1);
  assert.ok(o.futbol.guc >= 0 && o.futbol.guc <= 100);
});

test('ayarlar: futbol takımları ve eşikler sınırlanır', () => {
  const a = ayarlariDogrula({ oyunTuru: 'futbol', futbol: { takimlar: [{ ad: '', kisa: 'abcdefg', renk: 'kırmızı' }], superSutJeton: 400, penaltiJeton: 100, sahaOyuncu: 50 } });
  assert.equal(a.oyunTuru, 'futbol');
  assert.equal(a.futbol.takimlar.length, 24);
  assert.equal(a.futbol.kupaBoyu, 'tum');
  // eski sürümün 8 takımlık kaydı yeni listeyi bozmaz
  const eski = ayarlariDogrula({ futbol: { takimlar: Array.from({ length: 8 }, () => ({ ad: 'Eski', kisa: 'ESK' })) } });
  assert.equal(eski.futbol.takimlar[5].ad, 'Samsunspor');
  assert.equal(ayarlariDogrula({ futbol: { kupaBoyu: '16' } }).futbol.kupaBoyu, 16);
  assert.equal(a.futbol.takimlar[0].ad, 'Galatasaray');
  assert.equal(a.futbol.takimlar[0].kisa, 'ABCDE');
  assert.equal(a.futbol.takimlar[0].renk, '#a90432');
  assert.equal(a.futbol.superSutJeton, 30, 'artan sırada değilse varsayılana döner');
  assert.equal(a.futbol.sahaOyuncu, 11);
  assert.equal(ayarlariDogrula({ oyunTuru: 'tetris' }).oyunTuru, 'cephe');
});

test('sunucu /futbol sayfasını verir', async () => {
  const sahte = Object.assign(new (await import('node:events')).EventEmitter(), {
    durum: { hal: 'bosta', kullanici: '', hata: '', izleyici: 0 },
    async baglan() {},
    async kes() {},
  });
  const os = await import('node:os');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), 'futbol-test-'));
  const sunucu = sunucuKur({ tiktok: sahte, ayarDosyasi: path.join(klasor, 'a.json'), hediyeDosyasi: path.join(klasor, 'h.json') });
  await new Promise((c) => sunucu.listen(5097, '127.0.0.1', c));
  try {
    const r = await fetch('http://127.0.0.1:5097/futbol');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /futbol\/ana\.js/);
    const m = await fetch('http://127.0.0.1:5097/futbol/motor.js');
    assert.equal(m.status, 200);
    assert.match(m.headers.get('content-type'), /javascript/);
  } finally {
    await sunucu.kapat();
    fs.rmSync(klasor, { recursive: true, force: true });
  }
});

test('beğenen oyuna girer; takım adını yazan maç sırasında 30 sn arayla takım değiştirir', () => {
  const m = new FutbolMotor(ayar(), { rastgele: tohumlu(23) });
  m.olay({ tur: 'begeni', kullanici: kisi(40), adet: 3 });
  const o = m.oyuncular.get('k40');
  assert.ok(o.saha, 'beğenen sahaya girdi');
  macaBasla(m);
  const hedef = 1 - o.taraf;
  const kisa = m.takim(hedef).kisa;
  yorum(m, 40, kisa);
  assert.equal(o.taraf, hedef, 'adı yazınca karşı takıma geçti');
  yorum(m, 40, m.takim(1 - hedef).kisa);
  assert.equal(o.taraf, hedef, '30 sn dolmadan geri geçemez');
  sur(m, F.degisimAraligi + 0.5);
  if (m.asama === 'mac') {
    yorum(m, 40, m.takim(1 - hedef).ad);
    assert.equal(o.taraf, 1 - hedef, '30 sn sonra tam adla geçebilir');
  }
});

test('koruma hediyesi: isabetli süper şutu kesin kurtarır, hak bir azalır', () => {
  const m = new FutbolMotor(ayar(), { rastgele: tohumlu(29) });
  yorum(m, 50, '2');
  macaBasla(m);
  hediye(m, 50, 'Kalp', 10, 2);
  assert.equal(m.korumalar[1].length, 2, 'iki hak birikti');
  hediye(m, 50, 'Kalp', 10, 5);
  assert.equal(m.korumalar[1].length, 3, 'en fazla 3');
  // taraf 0'dan bir oyuncu sağ kaleye (taraf 1'in kalesi) süper şut çeker
  const atan = m.sahadakiler(0).find((p) => p.saha.slot !== 0);
  const b = m.toplar[0];
  Object.assign(atan.saha, { x: 92, y: 34 });
  b.x = 93;
  b.y = 34;
  m.topVer(b, atan);
  const skor = [...m.mac.skor];
  m.sutCek(atan, b, true);
  let kullanildi = null;
  for (let t = 0; t < 1.5 && !kullanildi; t += 1 / 30) {
    m.tick(1 / 30);
    kullanildi = m.fx.find((f) => f.tip === 'kurtaris' && f.koruma);
    m.fx.length = 0;
  }
  assert.ok(kullanildi, 'koruma devreye girdi');
  assert.equal(kullanildi.korumaId, 'k50');
  assert.deepEqual(m.mac.skor, skor, 'gol olmadı');
  assert.equal(m.korumalar[1].length, 2);
});

test('koruma penaltıda da çalışır: skor değişmez', () => {
  const m = new FutbolMotor(ayar(), { rastgele: tohumlu(31) });
  yorum(m, 60, '2');
  yorum(m, 61, '1');
  macaBasla(m);
  hediye(m, 60, 'Rosa', 10);
  const skor = [...m.mac.skor];
  hediye(m, 61, 'Elle Kalp', 100);
  assert.ok(bekle(m, () => m.asama === 'penalti', 5), 'penaltı başladı');
  bekle(m, () => m.asama !== 'penalti', 5);
  assert.deepEqual(m.mac.skor, skor, 'kaleci kurtardı (koruma ya da şans)');
});
