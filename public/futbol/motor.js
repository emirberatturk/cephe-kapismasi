// Futbol Kupası: oyun motoru (çizimden bağımsız, Node testlerinde de çalışır).
// 8 takımlı kupa: çeyrek final → yarı final → üçüncülük → final. Her maçta iki takım oynar.
// İzleyici "1"/"2" ya da takım adını yazınca o maçta sahaya girer; beğeni ve yorum takımına güç verir.
// Hediyeler jetona göre: küçükler güç (birikince süper şut), süper şut, penaltı, direkt gol.
// Saha birimi metre: x 0..105 (taraf 0 sağa, taraf 1 sola hücum eder), y 0..68.

import { sadelestir, adSuz, siraVer } from '../oyun/motor.js';

export const SAHA = Object.freeze({ u: 105, g: 68, kale: 6, ceza: 16.5, cezaYari: 20, penalti: 11 });
const OX = SAHA.u / 2;
const OY = SAHA.g / 2;

export const F = Object.freeze({
  hiz: 8.6,
  topluHiz: 7.4,
  kaleciHiz: 8.2,
  pasHiz: 22,
  sutHiz: 31,
  superHiz: 44,
  roketHiz: 62,
  surtunme: 1.0,
  alma: 1.2,
  mudahale: 1.8,
  mudahaleBekleme: 0.7,
  sersem: 0.8,
  kararAraligi: [0.3, 0.75],
  sutMesafesi: 31,
  kaleciUzanma: 2.3,
  golKutlama: 3.6,
  penaltiSure: 3.2,
  seriAtis: 2.8,
  seriBaslangic: 2.5,
  kupaSonu: 16,
  gucYarilanma: 30, // güç bu kadar saniyede yarıya iner: son etkileşim önemli
  begeniSaniyeSiniri: 3,
  yorumAraligi: 4,
  paylasimSiniri: 3,
  begeniGuc: 1,
  yorumGuc: 4,
  paylasimGuc: 12,
  takipGuc: 6,
  jetonGuc: 3,
  surprizAraligi: [35, 65], // maç saniyesi
  cilginSure: 20,
  ozelAralik: 2.2, // sıradaki hediye etkisi en erken
  degisimAraligi: 30, // maç sırasında takım değiştirme en sık
  korumaTavan: 3, // takım başına biriken kesin kurtarış hakkı
});

// Tur, o turda oynayan takım sayısıyla anılır (32: ilk tur, 16: son 16 …); 3 = üçüncülük maçı, 2 = final
const TUR_ADI = { 2: 'FİNAL', 3: 'ÜÇÜNCÜLÜK MAÇI', 4: 'YARI FİNAL', 8: 'ÇEYREK FİNAL', 16: 'SON 16 TURU' };
const TUR_KISA = { 2: 'F', 3: '3.', 4: 'YF', 8: 'Ç', 16: 'S' };
export const turAdi = (tur) => TUR_ADI[tur] || 'İLK TUR';
const TURLAR = [2, 3, 4, 8, 16, 32, 64];
// takım adında eşleştirmeye katılmayan genel kelimeler
const GENEL_KELIMELER = ['fk', 'sk', 'sfk', 'spor', 'as', 'kulubu', 'futbol'];

export const HAVALAR = {
  acik: { ad: 'Açık hava', ikon: '☀️' },
  yagmur: { ad: 'Yağmurlu', ikon: '🌧️' },
  kar: { ad: 'Karlı', ikon: '❄️' },
  sis: { ad: 'Sisli', ikon: '🌫️' },
  ruzgar: { ad: 'Rüzgarlı', ikon: '💨' },
};
const HAVA_OLASILIK = [['acik', 45], ['yagmur', 20], ['kar', 12], ['sis', 10], ['ruzgar', 13]];

export const SURPRIZLER = {
  kopek: { ad: 'SAHAYA KÖPEK GİRDİ!', ikon: '🐕', sure: 8 },
  karanlik: { ad: 'IŞIKLAR GİTTİ!', ikon: '💡', sure: 4 },
  patlak: { ad: 'TOP PATLADI! Yeni top', ikon: '💥', sure: 2.5 },
  taraftar: { ad: 'SAHAYA TARAFTAR GİRDİ!', ikon: '🏃', sure: 7 },
  ruzgar: { ad: 'SERT RÜZGAR!', ikon: '🌪️', sure: 7 },
};

export const OZELLER = {
  koruma: { ad: 'KORUMA', ikon: '🧤' },
  superSut: { ad: 'SÜPER ŞUT', ikon: '🔥' },
  penalti: { ad: 'PENALTI', ikon: '🎯' },
  gol: { ad: 'DİREKT GOL', ikon: '⚡' },
};

// Saha dizilişi (x: 0 kendi kalesi → 1 rakip kalesi, y: 0..1). İlk yer kaleci.
export const DIZILIS = [
  [0.035, 0.5], [0.62, 0.5], [0.34, 0.5], [0.48, 0.2], [0.48, 0.8], [0.76, 0.32],
  [0.76, 0.68], [0.26, 0.24], [0.26, 0.76], [0.62, 0.1], [0.62, 0.9],
];

// Bir hediyenin (tek adet) etkisi, jeton fiyatına göre
export function hediyeEtkisi(jeton, f) {
  if (jeton >= f.golJeton) return { tur: 'gol', adet: Math.min(3, Math.floor(jeton / f.golJeton)) };
  if (jeton >= f.penaltiJeton) return { tur: 'penalti', adet: 1 };
  if (jeton >= f.superSutJeton) return { tur: 'superSut', adet: 1 };
  if (jeton >= f.korumaJeton) return { tur: 'koruma', adet: 1 };
  return { tur: 'guc', adet: 0 };
}

// Maçlara ad ver: "SON 16 TURU 3", kısa "S3"; turda tek maç varsa numarasız
function adlandir(es) {
  const toplam = {};
  const sayac = {};
  for (const m of es) toplam[m.tur] = (toplam[m.tur] || 0) + 1;
  for (const m of es) {
    sayac[m.tur] = (sayac[m.tur] || 0) + 1;
    const tek = toplam[m.tur] === 1;
    m.ad = tek ? turAdi(m.tur) : `${turAdi(m.tur)} ${sayac[m.tur]}`;
    m.kisa = tek ? TUR_KISA[m.tur] || 'T' : `${TUR_KISA[m.tur] || 'T'}${sayac[m.tur]}`;
  }
  return es;
}

// Kura: takımlar karışık. Takım sayısı 2'nin kuvveti değilse (ör. 24) bazı takımlar ilk turu bay geçer.
// boyut: 'tum' (hepsi), 16 ya da 8 (o kadar takım kurayla seçilir). Maçlar oynanma sırasındadır.
export function kupaKur(r = Math.random, takimSayisi = 8, boyut = 'tum') {
  const t = Array.from({ length: takimSayisi }, (_, i) => i);
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  const n = boyut === 'tum' ? takimSayisi : Math.max(2, Math.min(Number(boyut) || 8, takimSayisi));
  const katilan = t.slice(0, n);
  let P = 2;
  while (P < n) P *= 2;
  const es = [];
  const ekle = (tur, a, b) => {
    const m = { tur, ev: -1, dep: -1, evK: null, depK: null, skor: null, pen: null, kazanan: -1, kaybeden: -1 };
    if (a.takim !== undefined) m.ev = a.takim;
    else m.evK = a;
    if (b.takim !== undefined) m.dep = b.takim;
    else m.depK = b;
    es.push(m);
    return es.length - 1;
  };
  // ilk tur: bay geçmeyenler oynar
  const ilk = n - P / 2;
  const ilkMaclar = [];
  for (let i = 0; i < ilk; i++) ilkMaclar.push(ekle(P, { takim: katilan[2 * i] }, { takim: katilan[2 * i + 1] }));
  const baylar = katilan.slice(2 * ilk).map((takim) => ({ takim }));
  const kazananlar = ilkMaclar.map((mac) => ({ mac, sonuc: 'kazanan' }));
  let girisler = [];
  // her bay geçen takım bir ilk tur galibiyle eşleşir
  while (baylar.length || kazananlar.length) {
    if (baylar.length) girisler.push(baylar.shift());
    if (kazananlar.length) girisler.push(kazananlar.shift());
  }
  let yariFinaller = P === 4 ? ilkMaclar : null;
  while (girisler.length > 2) {
    const tur = girisler.length;
    const maclar = [];
    for (let j = 0; j < girisler.length; j += 2) maclar.push(ekle(tur, girisler[j], girisler[j + 1]));
    if (tur === 4) yariFinaller = maclar;
    girisler = maclar.map((mac) => ({ mac, sonuc: 'kazanan' }));
  }
  if (yariFinaller) ekle(3, { mac: yariFinaller[0], sonuc: 'kaybeden' }, { mac: yariFinaller[1], sonuc: 'kaybeden' });
  if (girisler.length === 2) ekle(2, girisler[0], girisler[1]);
  return adlandir(es);
}

// Oynanan maçların kazanan/kaybedenlerini sonraki maçlara yaz
export function kupaDoldur(es) {
  for (const m of es) {
    for (const [alan, kaynak] of [['ev', 'evK'], ['dep', 'depK']]) {
      const k = m[kaynak];
      if (!k || m[alan] >= 0) continue;
      const onceki = es[k.mac];
      const v = onceki ? (k.sonuc === 'kaybeden' ? onceki.kaybeden : onceki.kazanan) : -1;
      if (v >= 0) m[alan] = v;
    }
  }
}

// Kaydedilmiş kupayı doğrulayarak geri yükle (bozuksa null)
export function kupaYukle(ham, takimSayisi) {
  if (!Array.isArray(ham) || ham.length < 1 || ham.length > 64) return null;
  const takim = (v) => (Number.isInteger(v) && v >= -1 && v < takimSayisi ? v : -1);
  const ikili = (v) => (Array.isArray(v) && v.length === 2 ? v.map((x) => Math.max(0, Math.min(99, Math.floor(Number(x)) || 0))) : null);
  const es = [];
  for (let i = 0; i < ham.length; i++) {
    const h = ham[i] && typeof ham[i] === 'object' ? ham[i] : {};
    if (!TURLAR.includes(h.tur)) return null;
    const kaynak = (k) => (k && Number.isInteger(k.mac) && k.mac >= 0 && k.mac < i && (k.sonuc === 'kazanan' || k.sonuc === 'kaybeden') ? { mac: k.mac, sonuc: k.sonuc } : null);
    es.push({ tur: h.tur, ev: takim(h.ev), dep: takim(h.dep), evK: kaynak(h.evK), depK: kaynak(h.depK), skor: ikili(h.skor), pen: ikili(h.pen), kazanan: takim(h.kazanan), kaybeden: takim(h.kaybeden) });
  }
  return adlandir(es);
}

// Penaltı atışları bitti mi? (5'er atış, sonra ani ölüm)
export function seriBittiMi(a0, a1) {
  const n0 = a0.length;
  const n1 = a1.length;
  const g0 = a0.filter(Boolean).length;
  const g1 = a1.filter(Boolean).length;
  if (n0 <= 5 && n1 <= 5) {
    if (g0 + (5 - n0) < g1 || g1 + (5 - n1) < g0) return true;
    return n0 === 5 && n1 === 5 && g0 !== g1;
  }
  return n0 === n1 && g0 !== g1;
}

const rnd = (a, b, r) => a + (b - a) * r();
const sinirla = (v, a, b) => Math.max(a, Math.min(b, v));
const uzak = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class FutbolMotor {
  constructor(ayarlar, { rastgele: r = Math.random } = {}) {
    this.ayarlar = ayarlar;
    this.r = r;
    this.fx = [];
    this.kupalar = Array(this.ayarlar.futbol.takimlar.length).fill(0);
    this.oturumuSifirla();
  }

  get f() {
    return this.ayarlar.futbol;
  }

  // ------------------------------------------------------------ kurulum
  oturumuSifirla() {
    this.saat = 0;
    this.oyuncular = new Map();
    this.demoVerisi = false;
    this.botSayaci = 0;
    this.botZamani = 0;
    this.begeniSayaci = 0;
    this.cilginBekliyor = false;
    this.bekleyen = [];
    this.kupaNo = 0;
    this.bitenKupa = null;
    this.sonMac = null;
    this.yeniKupa();
    this.macKur();
  }

  yeniKupa() {
    this.kupaNo += 1;
    this.kupa = { no: this.kupaNo, eslesmeler: kupaKur(this.r, this.f.takimlar.length, this.f.kupaBoyu), sira: 0 };
    for (const o of this.oyuncular.values()) o.kupaGol = 0;
  }

  get eslesme() {
    return this.kupa.eslesmeler[this.kupa.sira];
  }

  takimIdx(taraf) {
    const e = this.eslesme;
    return taraf === 0 ? e.ev : e.dep;
  }

  takimBilgi(idx) {
    return this.f.takimlar[idx] || { ad: '?', kisa: '?', renk: '#888888', renk2: '#ffffff' };
  }

  takim(taraf) {
    return this.takimBilgi(this.takimIdx(taraf));
  }

  havaSec() {
    if (!this.f.hava) return 'acik';
    const toplam = HAVA_OLASILIK.reduce((t, [, p]) => t + p, 0);
    let x = this.r() * toplam;
    for (const [ad, p] of HAVA_OLASILIK) {
      x -= p;
      if (x <= 0) return ad;
    }
    return 'acik';
  }

  macKur() {
    const e = this.eslesme;
    this.asama = 'hazirlik';
    this.kalan = this.f.hazirlik;
    this.macSaniye = 0;
    this.devreBildirildi = false;
    const hava = this.havaSec();
    const aci = this.r() * Math.PI * 2;
    this.mac = {
      skor: [0, 0],
      pen: null,
      goller: [],
      seri: null,
      hava,
      ruzgar: hava === 'ruzgar' ? { x: Math.cos(aci) * 2.2, y: Math.sin(aci) * 2.2 } : { x: 0, y: 0 },
    };
    this.guc = [0, 0];
    this.saha = [[], []];
    this.yedek = [[], []];
    this.korumalar = [[], []]; // her taraf için kesin kurtarış hakları: { id, ad } (hediyeyi atan)
    this.penalti = null;
    this.surpriz = null;
    this.kopek = null;
    this.istilaci = null;
    this.ruzgarEk = null;
    this.cilginBitis = 0;
    this.sonrakiSurpriz = rnd(...F.surprizAraligi, this.r);
    this.ozelKilit = 0;
    this.santraTaraf = 0;
    this.toplar = [this.yeniTop()];
    for (const o of this.oyuncular.values()) {
      o.taraf = -1;
      o.saha = null;
      o.yedek = false;
      o.paylasim = 0;
      o.macGol = 0;
      o.macPuan = 0;
    }
    // sıradaki maç için yazanlar ve takımı oynayan (son 5 dakikada etkin) taraftarlar sahaya
    const adaylar = [];
    for (const o of this.oyuncular.values()) {
      if (o.bot) continue;
      let t = -1;
      if (o.hazir === 0 || o.hazir === 1) t = o.hazir;
      else if (o.taraftar >= 0 && this.saat - o.sonAktif < 300) t = o.taraftar === e.ev ? 0 : o.taraftar === e.dep ? 1 : -1;
      o.hazir = null;
      if (t !== -1) adaylar.push([o, t]);
    }
    adaylar.sort((a, b) => a[0].hazirZamani - b[0].hazirZamani);
    for (const [o, t] of adaylar) this.sahayaAl(o, t, { sessiz: true });
    this.botlariDuzenle();
    this.santraDiz(0);
    this.fxEkle({ tip: 'macKuruldu' });
  }

  yeniTop() {
    return {
      x: OX, y: OY, vx: 0, vy: 0, donus: 0,
      sahip: null, sonDokunan: null, sonTaraf: -1, pasHedef: null, pasVeren: null, asistAday: null,
      sut: false, super: false, garanti: false, penalti: false, kontrol: false,
      denenen: new Set(), aut: -1, autBitis: 0, iz: [],
    };
  }

  ayarlariGuncelle(a) {
    this.ayarlar = a;
    if (this.asama === 'mac') this.kalan = this.f.macSuresi - this.macSaniye;
    const n = this.f.takimlar.length;
    if (this.kupalar.length !== n) this.kupalar = Array.from({ length: n }, (_, i) => this.kupalar[i] || 0);
  }

  fxEkle(f) {
    if (this.fx.length < 600) this.fx.push(f);
  }

  // ------------------------------------------------------------ sorgular
  kayitAsamasi() {
    return this.asama === 'ara' || this.asama === 'kupaSonu';
  }

  oyundaMi() {
    return ['hazirlik', 'mac', 'gol', 'penalti', 'seri'].includes(this.asama);
  }

  dakika() {
    return Math.min(90, Math.max(1, Math.ceil((this.macSaniye / this.f.macSuresi) * 90)));
  }

  sahadakiler(t) {
    return this.saha[t].map((id) => this.oyuncular.get(id)).filter((o) => o && o.saha);
  }

  kaleci(t) {
    return this.sahadakiler(t).find((o) => o.saha.slot === 0) || null;
  }

  gercekSayisi(t) {
    let n = this.yedek[t].length;
    for (const id of this.saha[t]) if (!this.oyuncular.get(id)?.bot) n++;
    return n;
  }

  kucukTaraf() {
    const a = this.gercekSayisi(0);
    const b = this.gercekSayisi(1);
    if (a !== b) return a < b ? 0 : 1;
    return this.r() < 0.5 ? 0 : 1;
  }

  taraftarTarafi(o) {
    const e = this.eslesme;
    if (o.taraftar < 0) return -1;
    return o.taraftar === e.ev ? 0 : o.taraftar === e.dep ? 1 : -1;
  }

  gucOrani(t) {
    return (this.guc[t] + 25) / (this.guc[0] + this.guc[1] + 50);
  }

  carpan(t) {
    return 0.86 + 0.28 * this.gucOrani(t);
  }

  gucEkle(t, m) {
    if (t !== 0 && t !== 1) return;
    this.guc[t] = Math.min(5000, this.guc[t] + m);
  }

  ruzgar() {
    const r = this.mac.ruzgar;
    if (!this.ruzgarEk) return r;
    return { x: r.x + this.ruzgarEk.x, y: r.y + this.ruzgarEk.y };
  }

  golKrallari(n = 5) {
    const liste = [...this.oyuncular.values()].filter((o) => o.gol > 0 && !o.bot);
    liste.sort((a, b) => b.gol - a.gol || a.ilkGolZamani - b.ilkGolZamani);
    return siraVer(liste.slice(0, n), 'gol');
  }

  // Yorumdaki takım: "1" / "2", kısa ad (GS) ya da tam ad. Oynayan takımlar önce.
  yorumTakim(metin) {
    const s = sadelestir(metin);
    const e = this.eslesme;
    const yok = { taraf: -1, takim: -1 };
    if (!s) return yok;
    const ilk = s.split(' ')[0];
    if (ilk === '1') return { taraf: 0, takim: e.ev };
    if (ilk === '2') return { taraf: 1, takim: e.dep };
    const eslesir = (i) => {
      const t = this.f.takimlar[i];
      if (!t) return false;
      const kisa = sadelestir(t.kisa);
      const ad = sadelestir(t.ad);
      if (kisa && ilk === kisa) return true;
      if (ad && (s === ad || s.startsWith(ad + ' '))) return true;
      const kelimeler = ad.split(' ').filter((k) => k.length >= 3 && !GENEL_KELIMELER.includes(k));
      return kelimeler.includes(ilk) || (ilk.length >= 4 && kelimeler.some((k) => k.startsWith(ilk)));
    };
    if (eslesir(e.ev)) return { taraf: 0, takim: e.ev };
    if (eslesir(e.dep)) return { taraf: 1, takim: e.dep };
    for (let i = 0; i < this.f.takimlar.length; i++) if (eslesir(i)) return { taraf: -1, takim: i };
    return yok;
  }

  // ------------------------------------------------------------ oyuncular
  oyuncuAl(k, demo) {
    let o = this.oyuncular.get(k.id);
    if (!o) {
      o = {
        id: k.id,
        ad: String(k.ad || k.id),
        foto: k.foto || '',
        taraf: -1,
        taraftar: -1,
        hazir: null,
        hazirZamani: 0,
        puan: 0,
        ilkPuanZamani: Infinity,
        gol: 0,
        kupaGol: 0,
        macGol: 0,
        macPuan: 0,
        ilkGolZamani: Infinity,
        saha: null,
        yedek: false,
        biriken: 0,
        begeniKredi: F.begeniSaniyeSiniri,
        begeniZaman: this.saat,
        sonYorum: -99,
        sonDegisim: -999,
        takipVerdi: false,
        paylasim: 0,
        sonAktif: this.saat,
        demo: Boolean(demo),
      };
      this.oyuncular.set(k.id, o);
    } else {
      if (k.foto && !o.foto) o.foto = k.foto;
      if (k.ad && k.ad !== o.ad) o.ad = String(k.ad);
    }
    return o;
  }

  adGoster(o) {
    return this.ayarlar.adSuzgeci ? adSuz(o.ad) : o.ad;
  }

  fotoGoster(o) {
    if (!o.foto || this.ayarlar.profilFoto === 'yok') return '';
    if (this.ayarlar.adSuzgeci && adSuz(o.ad) !== o.ad) return '';
    return o.foto;
  }

  bosSlot(t) {
    const dolu = new Set(this.sahadakiler(t).map((o) => o.saha.slot));
    for (let i = 0; i < DIZILIS.length; i++) if (!dolu.has(i)) return i;
    return 1 + Math.floor(this.r() * (DIZILIS.length - 1));
  }

  evKonumu(t, slot, santra = false) {
    const [fx0, fy] = DIZILIS[slot % DIZILIS.length];
    const fx = santra && slot !== 0 ? Math.min(fx0 * 0.9, 0.45) : fx0;
    return { x: t === 0 ? fx * SAHA.u : (1 - fx) * SAHA.u, y: fy * SAHA.g };
  }

  // Oyuncuyu bir tarafa sok. zorla: hediye atan sınırı aşabilir (en fazla +2)
  sahayaAl(o, t, { zorla = false, sessiz = false, taraftarKoru = false } = {}) {
    if (o.taraf === t && o.saha) return true;
    if (o.taraf !== -1 && o.taraf !== t) this.sahadanCikar(o);
    const liste = this.saha[t];
    const sinir = this.f.sahaOyuncu + (zorla ? 2 : 0);
    o.taraf = t;
    if (!o.bot && !taraftarKoru) o.taraftar = this.takimIdx(t);
    if (!o.bot && liste.length >= this.f.sahaOyuncu) {
      // saha doluysa bir bot gerçek izleyiciye yerini bırakır (aynı yerden devam eder)
      const botlar = [...liste].reverse().filter((id) => this.oyuncular.get(id)?.bot);
      const botId = botlar.find((id) => this.oyuncular.get(id).saha.slot !== 0) || botlar[0];
      if (botId) {
        const bot = this.oyuncular.get(botId);
        const slot = bot.saha.slot;
        const konum = { x: bot.saha.x, y: bot.saha.y };
        this.botCikar(bot);
        return this.sahayaKoy(o, t, slot, konum, sessiz);
      }
    }
    if (liste.length >= sinir) {
      if (o.bot) {
        o.taraf = -1;
        return false;
      }
      if (!this.yedek[t].includes(o.id)) this.yedek[t].push(o.id);
      o.yedek = true;
      if (!sessiz) this.fxEkle({ tip: 'akis', metin: `🪑 ${this.adGoster(o)} · ${this.takim(t).kisa} yedekte`, taraf: t });
      return false;
    }
    return this.sahayaKoy(o, t, this.bosSlot(t), null, sessiz);
  }

  sahayaKoy(o, t, slot, konum, sessiz) {
    this.yedek[t] = this.yedek[t].filter((id) => id !== o.id);
    o.yedek = false;
    const ev = this.evKonumu(t, slot, this.asama === 'hazirlik');
    let k = konum;
    if (!k) k = this.asama === 'hazirlik' || this.asama === 'gol' ? ev : { x: ev.x, y: ev.y < OY ? -1.5 : SAHA.g + 1.5 };
    o.saha = { slot, x: k.x, y: k.y, vx: 0, vy: 0, yon: t === 0 ? 1 : -1, karar: 0, sersem: 0, mudahale: 0, almaYasak: 0, superBitis: 0, vurus: -9 };
    this.saha[t].push(o.id);
    this.fxEkle({ tip: 'giris', id: o.id, taraf: t });
    if (!sessiz && !o.bot) this.fxEkle({ tip: 'akis', metin: `⚽ ${this.adGoster(o)} → ${this.takim(t).ad}`, taraf: t });
    return true;
  }

  sahadanCikar(o) {
    const t = o.taraf;
    if (t === 0 || t === 1) {
      this.saha[t] = this.saha[t].filter((id) => id !== o.id);
      this.yedek[t] = this.yedek[t].filter((id) => id !== o.id);
    }
    for (const b of this.toplar) if (b.sahip === o.id) b.sahip = null;
    o.saha = null;
    o.yedek = false;
    o.taraf = -1;
  }

  botCikar(o) {
    if (!o || !o.bot || !o.saha) return;
    const id = o.id;
    this.sahadanCikar(o);
    this.fxEkle({ tip: 'botCikti', id });
  }

  // İzleyici azken her tarafta en az "botSayisi" oyuncu; gerçek izleyici geldikçe botlar çekilir
  botlariDuzenle() {
    if (!['hazirlik', 'mac'].includes(this.asama)) return;
    const a = this.ayarlar;
    for (let t = 0; t < 2; t++) {
      const liste = this.saha[t];
      const gercek = liste.filter((id) => !this.oyuncular.get(id)?.bot).length;
      const botlar = liste.filter((id) => this.oyuncular.get(id)?.bot);
      let istenen = a.botlar ? Math.max(0, Math.min(a.botSayisi, this.f.sahaOyuncu) - gercek) : 0;
      // saha dolmadıkça kalede bot kalır: izleyiciler hücumda oynasın
      const kaleciBot = botlar.some((id) => this.oyuncular.get(id).saha.slot === 0);
      if (a.botlar && istenen === 0 && kaleciBot && gercek < this.f.sahaOyuncu) istenen = 1;
      // fazla botlar çekilir: önce en son gelenler, kaleci bot en son
      const sirali = [...botlar].sort((x, y) => (this.oyuncular.get(x).saha.slot === 0) - (this.oyuncular.get(y).saha.slot === 0) || botlar.indexOf(y) - botlar.indexOf(x));
      for (let i = 0; i < botlar.length - istenen; i++) this.botCikar(this.oyuncular.get(sirali[i]));
      let eksik = istenen - Math.min(botlar.length, istenen);
      for (const o of this.oyuncular.values()) {
        if (eksik <= 0) break;
        if (o.bot && o.taraf === -1 && this.sahayaAl(o, t, { sessiz: true })) eksik--;
      }
      let deneme = 0;
      while (eksik > 0 && deneme++ < 20) {
        const o = this.oyuncuAl({ id: `bot_${++this.botSayaci}`, ad: `🤖 Bot ${this.botSayaci}` });
        o.bot = true;
        if (this.sahayaAl(o, t, { sessiz: true })) eksik--;
        else break;
      }
      this.kaleciAta(t);
    }
  }

  // Kalecisi olmayan takımda kaleye bot geçer; bot yoksa en az puanlı gerçek oyuncu
  kaleciAta(t) {
    const l = this.sahadakiler(t);
    if (!l.length || l.some((o) => o.saha.slot === 0)) return;
    const sahipler = new Set(this.toplar.map((b) => b.sahip));
    const aday = [...l].filter((o) => !sahipler.has(o.id)).sort((a, b) => Number(Boolean(b.bot)) - Number(Boolean(a.bot)) || a.puan - b.puan)[0] || l[0];
    aday.saha.slot = 0;
  }

  // Santra: herkes kendi yarısına dizilir, top ortada; santrayı "taraf" kullanır
  santraDiz(taraf) {
    for (let t = 0; t < 2; t++) {
      for (const o of this.sahadakiler(t)) {
        const k = this.evKonumu(t, o.saha.slot, true);
        Object.assign(o.saha, { x: k.x, y: k.y, vx: 0, vy: 0, sersem: 0, superBitis: 0, almaYasak: 0 });
      }
    }
    this.toplar = [this.yeniTop()];
    if (this.cilginBitis > this.saat) this.ikinciTop();
    const adaylar = this.sahadakiler(taraf).filter((o) => o.saha.slot !== 0);
    if (!adaylar.length) return;
    adaylar.sort((a, b) => uzak(a.saha, { x: OX, y: OY }) - uzak(b.saha, { x: OX, y: OY }));
    const o = adaylar[0];
    o.saha.x = OX - (taraf === 0 ? 0.9 : -0.9);
    o.saha.y = OY;
    this.topVer(this.toplar[0], o);
    o.saha.karar = this.saat + rnd(0.6, 1.0, this.r);
  }

  topVer(b, o) {
    const onceki = b.pasVeren ? this.oyuncular.get(b.pasVeren) : null;
    b.asistAday = onceki && onceki.taraf === o.taraf && onceki.id !== o.id ? onceki.id : null;
    b.sahip = o.id;
    b.sut = false;
    b.super = false;
    b.garanti = false;
    b.kontrol = false;
    b.pasHedef = null;
    b.pasVeren = null;
    b.denenen.clear();
    b.aut = -1;
    b.sonDokunan = o.id;
    b.sonTaraf = o.taraf;
    o.saha.karar = Math.max(o.saha.karar, this.saat + rnd(0.3, 0.7, this.r));
  }

  topuBirak(b) {
    b.sahip = null;
    b.denenen.clear();
  }

  // ------------------------------------------------------------ olaylar
  olay(e) {
    if (!e || !e.tur) return;
    if (e.demo) this.demoVerisi = true;
    if (this.asama === 'duraklat') return;
    const k = e.kullanici;
    if (!k || !k.id) return;
    if (e.tur === 'giris') return;
    const o = this.oyuncuAl(k, e.demo);
    o.sonAktif = this.saat;
    switch (e.tur) {
      case 'begeni':
        return this.begeni(o, Math.max(1, Number(e.adet) || 1));
      case 'yorum':
        return this.yorum(o, String(e.metin || ''));
      case 'hediye':
        return this.hediye(o, e.hediye || {}, Math.max(1, Number(e.adet) || 1));
      case 'takip': {
        if (o.takipVerdi) return;
        o.takipVerdi = true;
        const t = o.taraf !== -1 ? o.taraf : this.taraftarTarafi(o);
        if (t !== -1 && this.oyundaMi()) this.gucEkle(t, F.takipGuc);
        this.fxEkle({ tip: 'akis', metin: `➕ ${this.adGoster(o)} takip etti`, taraf: t });
        return;
      }
      case 'paylasim': {
        const t = o.taraf !== -1 ? o.taraf : this.taraftarTarafi(o);
        if (t === -1 || o.paylasim >= F.paylasimSiniri || !this.oyundaMi()) return;
        o.paylasim += 1;
        this.gucEkle(t, F.paylasimGuc);
        this.fxEkle({ tip: 'akis', metin: `🔁 ${this.adGoster(o)} paylaştı · ${this.takim(t).kisa} güç +${F.paylasimGuc}`, taraf: t });
        return;
      }
      default:
    }
  }

  begeniHedefiSay(adet) {
    const hedef = this.ayarlar.begeniHedefi;
    if (!hedef) return;
    this.begeniSayaci += Math.max(0, Math.min(adet, 1000));
    if (this.begeniSayaci < hedef) return;
    this.begeniSayaci -= hedef;
    this.fxEkle({ tip: 'hedef' });
    if (this.asama === 'mac') this.cilginBaslat();
    else {
      this.cilginBekliyor = true;
      this.fxEkle({ tip: 'bildirim', metin: '❤️ BEĞENİ HEDEFİ! Maçta 2 top inecek', renk: '#f9a8d4', sure: 2.5 });
    }
  }

  begeni(o, adet) {
    this.begeniHedefiSay(adet);
    const gecen = this.saat - o.begeniZaman;
    o.begeniZaman = this.saat;
    o.begeniKredi = Math.min(F.begeniSaniyeSiniri * 2, o.begeniKredi + gecen * F.begeniSaniyeSiniri);
    if (this.kayitAsamasi()) {
      // maç arası: beğenen sıradaki maça yazılır (takımı oynuyorsa o takıma, yoksa az oyunculu tarafa)
      if (o.hazir === null) {
        const tt = this.taraftarTarafi(o);
        o.hazir = tt !== -1 ? tt : this.kucukTaraf();
        o.hazirZamani = this.saat;
      }
      return;
    }
    if (!this.oyundaMi()) return;
    if (o.taraf === -1 && (this.asama === 'hazirlik' || this.asama === 'mac')) {
      // beğenen oyuna girer: takımı oynuyorsa o takıma, yoksa oyuncusu az olan tarafa
      const tt = this.taraftarTarafi(o);
      this.sahayaAl(o, tt !== -1 ? tt : this.kucukTaraf());
      return;
    }
    const t = o.taraf !== -1 ? o.taraf : this.taraftarTarafi(o);
    if (t === -1) return;
    const sayilan = Math.min(adet, Math.floor(o.begeniKredi));
    if (sayilan <= 0) return;
    o.begeniKredi -= sayilan;
    this.gucEkle(t, sayilan * F.begeniGuc);
    if (o.saha) this.fxEkle({ tip: 'kalp', id: o.id });
  }

  yorum(o, metin) {
    const r = this.yorumTakim(metin);
    if (r.taraf !== -1) {
      o.taraftar = r.takim;
      if (this.kayitAsamasi()) {
        if (o.hazir === null) o.hazirZamani = this.saat;
        if (o.hazir !== r.taraf) this.fxEkle({ tip: 'akis', metin: `✅ ${this.adGoster(o)} sıradaki maçta ${this.takim(r.taraf).kisa}`, taraf: r.taraf });
        o.hazir = r.taraf;
        return;
      }
      if (o.taraf === -1) {
        this.sahayaAl(o, r.taraf);
        return;
      }
      // takım değiştirme: maç öncesi her zaman, maç sırasında 30 sn'de bir
      if (o.taraf !== r.taraf && (this.asama === 'hazirlik' || (this.asama === 'mac' && this.saat - o.sonDegisim >= F.degisimAraligi))) {
        o.sonDegisim = this.saat;
        this.sahadanCikar(o);
        this.sahayaAl(o, r.taraf, { sessiz: true });
        this.fxEkle({ tip: 'degisti', id: o.id, taraf: r.taraf });
        this.fxEkle({ tip: 'akis', metin: `🔄 ${this.adGoster(o)} → ${this.takim(r.taraf).ad}`, taraf: r.taraf });
      }
      return;
    }
    if (r.takim !== -1) {
      // takımı bu maçta oynamıyor: kendi takımı hatırlanır, bu maça misafir girer
      const yeni = o.taraftar !== r.takim;
      o.taraftar = r.takim;
      const kendi = this.takimBilgi(r.takim);
      if (this.kayitAsamasi()) {
        if (o.hazir === null) {
          o.hazir = this.kucukTaraf();
          o.hazirZamani = this.saat;
        }
        if (yeni) this.fxEkle({ tip: 'akis', metin: `📣 ${this.adGoster(o)} (${kendi.kisa} taraftarı) sıradaki maçta oynayacak`, renk: kendi.renk });
        return;
      }
      if (o.taraf === -1 && (this.asama === 'hazirlik' || this.asama === 'mac')) {
        const t = this.kucukTaraf();
        this.sahayaAl(o, t, { sessiz: true, taraftarKoru: true });
        this.fxEkle({ tip: 'akis', metin: `📣 ${this.adGoster(o)} (${kendi.kisa} taraftarı) → ${this.takim(t).ad}'da misafir`, renk: kendi.renk });
        return;
      }
      if (yeni) this.fxEkle({ tip: 'akis', metin: `📣 ${this.adGoster(o)} · ${kendi.ad} taraftarı`, renk: kendi.renk });
      return;
    }
    if (!this.oyundaMi()) return;
    const t = o.taraf !== -1 ? o.taraf : this.taraftarTarafi(o);
    if (t !== -1 && this.saat - o.sonYorum >= F.yorumAraligi) {
      o.sonYorum = this.saat;
      this.gucEkle(t, F.yorumGuc);
      if (o.saha) this.fxEkle({ tip: 'konus', id: o.id });
    }
  }

  hediye(o, h, adet) {
    const f = this.f;
    const jeton = Math.max(1, Math.round(Number(h.jeton) || 1));
    if (!o.bot) {
      if (o.puan === 0) o.ilkPuanZamani = this.saat;
      o.puan += jeton * adet;
      o.macPuan += jeton * adet;
    }
    let t = o.taraf;
    if (t === -1) t = this.taraftarTarafi(o);
    if (t === -1) t = this.kucukTaraf();
    if (this.kayitAsamasi()) {
      if (o.hazir === null) {
        o.hazir = t;
        o.hazirZamani = this.saat;
      }
      if (o.taraftar < 0) o.taraftar = this.takimIdx(t);
    } else {
      if (!o.saha) this.sahayaAl(o, t, { zorla: true });
      this.gucEkle(t, jeton * adet * F.jetonGuc);
    }
    const hediye = { ad: String(h.ad || 'Hediye').slice(0, 30), resim: typeof h.resim === 'string' ? h.resim : '', jeton, adet };
    const etki = hediyeEtkisi(jeton, f);
    const kisa = this.takim(t).kisa;
    if (etki.tur === 'guc') {
      this.fxEkle({ tip: 'akis', metin: `🎁 ${this.adGoster(o)} · ${hediye.ad}${adet > 1 ? ' ×' + adet : ''} → ${kisa} güç`, taraf: t });
      if (o.saha) this.fxEkle({ tip: 'gucHediye', id: o.id });
      // küçük hediyeler birikir: her süper şut tutarında bir süper şut
      o.biriken += jeton * adet;
      if (o.biriken >= f.superSutJeton) {
        o.biriken -= f.superSutJeton;
        this.ozelEkle({ tur: 'superSut', id: o.id, hediye, birikim: true });
      }
      return;
    }
    if (etki.tur === 'koruma') {
      if (this.kayitAsamasi()) {
        this.ozelEkle({ tur: 'koruma', id: o.id, hediye, adet });
        this.fxEkle({ tip: 'akis', metin: `🧤 ${this.adGoster(o)} · ${hediye.ad} → sıradaki maçta kalesine koruma`, taraf: t });
      } else this.korumaEkle(o.taraf !== -1 ? o.taraf : t, o, hediye, adet);
      return;
    }
    const sayi = Math.min(5, etki.adet * adet);
    for (let i = 0; i < sayi; i++) this.ozelEkle({ tur: etki.tur, id: o.id, hediye });
    const oz = OZELLER[etki.tur];
    const sonra = this.kayitAsamasi() ? ' · sıradaki maçta' : '';
    this.fxEkle({ tip: 'akis', metin: `${oz.ikon} ${this.adGoster(o)} · ${hediye.ad} → ${oz.ad}${sayi > 1 ? ' ×' + sayi : ''}${sonra}`, taraf: t });
  }

  ozelEkle(x) {
    if (this.bekleyen.length < 30) this.bekleyen.push(x);
  }

  // Kaleye kesin kurtarış hakkı: sıradaki isabetli şut (normal, süper şut, penaltı) mutlaka kurtarılır
  korumaEkle(t, o, hediye, adet = 1) {
    if (t !== 0 && t !== 1) return;
    const liste = this.korumalar[t];
    let eklenen = 0;
    for (let i = 0; i < adet && liste.length < F.korumaTavan; i++) {
      liste.push({ id: o.id, ad: this.adGoster(o) });
      eklenen++;
    }
    const kisa = this.takim(t).kisa;
    if (!eklenen) {
      this.fxEkle({ tip: 'akis', metin: `🧤 ${this.adGoster(o)} · ${kisa} kalesi zaten tam korumalı (${F.korumaTavan}/${F.korumaTavan})`, taraf: t });
      return;
    }
    this.fxEkle({ tip: 'kart', ozel: 'koruma', id: o.id, taraf: t, hediye });
    this.fxEkle({ tip: 'koruma', id: o.id, taraf: t, sayi: liste.length });
    this.fxEkle({ tip: 'akis', metin: `🧤 ${this.adGoster(o)} · ${hediye?.ad || 'hediye'} → ${kisa} kalesine kurtarış hakkı (${liste.length}/${F.korumaTavan})`, taraf: t });
  }

  ozelCalistir(x) {
    const o = this.oyuncular.get(x.id);
    if (!o) return;
    if (!o.saha) {
      let t = o.taraf;
      if (t === -1) t = this.taraftarTarafi(o);
      if (t === -1) t = this.kucukTaraf();
      this.sahayaAl(o, t, { zorla: true });
    }
    if (!o.saha) return;
    if (x.tur === 'koruma') {
      this.korumaEkle(o.taraf, o, x.hediye, x.adet || 1);
      return;
    }
    const b = this.toplar[0];
    if (x.tur === 'superSut') {
      for (const top of this.toplar) if (top.sahip === o.id) top.sahip = null;
      if (b.sahip) {
        const eski = this.oyuncular.get(b.sahip);
        if (eski?.saha) eski.saha.sersem = this.saat + 0.5;
      }
      b.x = o.saha.x;
      b.y = o.saha.y;
      b.vx = b.vy = 0;
      this.topVer(b, o);
      o.saha.superBitis = this.saat + 1.6;
      o.saha.karar = this.saat + 0.25;
      this.fxEkle({ tip: 'kart', ozel: 'superSut', id: o.id, taraf: o.taraf, hediye: x.birikim ? null : x.hediye, birikim: Boolean(x.birikim) });
      this.fxEkle({ tip: 'superHazir', id: o.id });
    } else if (x.tur === 'penalti') {
      this.penaltiBaslat(o, x.hediye);
    } else if (x.tur === 'gol') {
      this.roketAt(o, x.hediye);
    }
  }

  roketAt(o, hediye) {
    const b = this.toplar[0];
    if (b.sahip) {
      const eski = this.oyuncular.get(b.sahip);
      if (eski?.saha) eski.saha.sersem = this.saat + 0.5;
    }
    b.x = o.saha.x;
    b.y = o.saha.y;
    const gx = o.taraf === 0 ? SAHA.u + 1 : -1;
    const gy = OY + rnd(-2, 2, this.r);
    const d = Math.hypot(gx - b.x, gy - b.y) || 1;
    b.vx = ((gx - b.x) / d) * F.roketHiz;
    b.vy = ((gy - b.y) / d) * F.roketHiz;
    this.topuBirak(b);
    Object.assign(b, { sut: true, super: true, garanti: true, kontrol: true, pasHedef: null, pasVeren: null, asistAday: null, sonDokunan: o.id, sonTaraf: o.taraf, aut: -1 });
    o.saha.vurus = this.saat;
    this.fxEkle({ tip: 'kart', ozel: 'gol', id: o.id, taraf: o.taraf, hediye });
    this.fxEkle({ tip: 'roket', id: o.id });
  }

  penaltiBaslat(o, hediye) {
    const t = o.taraf;
    const kaleci = this.kaleci(1 - t);
    let gol = this.r() < Math.min(0.92, 0.78 + (this.carpan(t) - 1) * 0.6);
    let koruma = null;
    if (gol && kaleci && this.korumalar[1 - t].length) {
      koruma = this.korumalar[1 - t].shift();
      gol = false;
    }
    this.penalti = { ...this.atisKur(t, o, kaleci, gol), hediye, koruma };
    this.oncekiAsama = 'mac';
    this.asama = 'penalti';
    this.kalan = F.penaltiSure;
    this.fxEkle({ tip: 'kart', ozel: 'penalti', id: o.id, taraf: t, hediye });
    this.fxEkle({ tip: 'penalti', id: o.id, taraf: t });
  }

  // Penaltı sahnesi: atan noktada, kaleci çizgide, diğerleri ceza sahası dışında; sonuç baştan belli
  atisKur(t, atan, kaleci, gol) {
    const dir = t === 0 ? 1 : -1;
    const gx = t === 0 ? SAHA.u : 0;
    const nokta = { x: gx - dir * SAHA.penalti, y: OY };
    const hedefYon = this.r() < 0.5 ? -1 : 1;
    const kaleciYon = gol ? (this.r() < 0.2 ? 0 : -hedefYon) : hedefYon;
    const cizgi = gx - dir * (SAHA.ceza + 2);
    for (let s = 0; s < 2; s++) {
      for (const p of this.sahadakiler(s)) {
        if (p === atan || p === kaleci) continue;
        if (dir * (p.saha.x - (gx - dir * SAHA.ceza)) > -1 && Math.abs(p.saha.y - OY) < SAHA.cezaYari + 1) p.saha.x = cizgi;
        p.saha.vx = p.saha.vy = 0;
      }
    }
    if (atan?.saha) Object.assign(atan.saha, { x: nokta.x - dir * 2.6, y: OY + 0.8, vx: 0, vy: 0 });
    if (kaleci?.saha) Object.assign(kaleci.saha, { x: gx - dir * 0.6, y: OY, vx: 0, vy: 0 });
    this.toplar = [this.yeniTop()];
    Object.assign(this.toplar[0], { x: nokta.x, y: nokta.y });
    return {
      taraf: t,
      atan: atan?.id || null,
      ad: atan ? this.adGoster(atan) : this.takim(t).kisa,
      kaleci: kaleci?.id || null,
      gol,
      hedefY: OY + hedefYon * rnd(2.6, SAHA.kale - 0.9, this.r),
      kaleciY: OY + kaleciYon * 3.4,
      basla: this.saat,
      nokta,
    };
  }

  penaltiSonuc() {
    const p = this.penalti;
    this.penalti = null;
    const b = this.toplar[0];
    if (p.gol) {
      b.sonDokunan = p.atan;
      b.sonTaraf = p.taraf;
      b.asistAday = null;
      b.penalti = true;
      b.x = p.taraf === 0 ? SAHA.u + 1 : -1;
      b.y = p.hedefY;
      this.golAt(p.taraf, b);
      return;
    }
    this.asama = 'mac';
    const k = p.kaleci ? this.oyuncular.get(p.kaleci) : null;
    if (k?.saha) {
      b.x = k.saha.x;
      b.y = k.saha.y;
      this.topVer(b, k);
    }
    this.fxEkle({ tip: 'kurtaris', id: p.kaleci, penalti: true, koruma: p.koruma?.ad || '', korumaId: p.koruma?.id || null });
  }

  // ------------------------------------------------------------ gol ve maç sonu
  golAt(taraf, b) {
    const atan = b.sonDokunan ? this.oyuncular.get(b.sonDokunan) : null;
    const kendi = Boolean(atan && atan.taraf !== -1 && atan.taraf !== taraf);
    this.mac.skor[taraf] += 1;
    const dakika = this.dakika();
    if (atan && !kendi && !atan.bot) {
      atan.gol += 1;
      atan.kupaGol += 1;
      atan.macGol += 1;
      if (atan.gol === 1) atan.ilkGolZamani = this.saat;
    }
    const asist = !kendi && b.asistAday ? this.oyuncular.get(b.asistAday) : null;
    const kayit = {
      taraf,
      dakika,
      id: atan?.id || null,
      ad: atan ? this.adGoster(atan) : '',
      kendi,
      bot: Boolean(atan?.bot),
      tur: b.penalti ? 'penalti' : b.garanti ? 'roket' : b.super ? 'super' : 'normal',
      asist: asist && !asist.bot ? this.adGoster(asist) : '',
    };
    this.mac.goller.push(kayit);
    this.fxEkle({ tip: 'gol', ...kayit, skor: [...this.mac.skor] });
    const kim = kayit.ad ? `${kayit.ad}${kendi ? ' (kendi kalesine)' : ''}` : this.takim(taraf).ad;
    this.fxEkle({ tip: 'akis', metin: `⚽ GOL! ${dakika}' ${kim} · ${this.takim(0).kisa} ${this.mac.skor[0]}-${this.mac.skor[1]} ${this.takim(1).kisa}`, taraf, onemli: true });
    this.asama = 'gol';
    this.kalan = F.golKutlama;
    this.santraTaraf = 1 - taraf;
    this.golcu = atan && !kendi ? atan.id : null;
    for (const top of this.toplar) {
      top.sahip = null;
      top.vx = top.vy = 0;
      top.sut = top.garanti = top.super = top.penalti = false;
    }
    b.x = taraf === 0 ? SAHA.u + 1.2 : -1.2;
    b.y = sinirla(b.y, OY - SAHA.kale + 0.8, OY + SAHA.kale - 0.8);
  }

  macBaslat() {
    this.asama = 'mac';
    this.macSaniye = 0;
    this.kalan = this.f.macSuresi;
    this.santraDiz(0);
    this.ozelKilit = this.saat + 2;
    this.fxEkle({ tip: 'macBasladi' });
    this.fxEkle({ tip: 'bildirim', metin: `⚽ MAÇ BAŞLADI · ${this.takim(0).ad} – ${this.takim(1).ad}`, renk: '#ffffff', sure: 2.2 });
    if (this.cilginBekliyor) {
      this.cilginBekliyor = false;
      this.cilginBaslat();
    }
  }

  macSonu() {
    const [a, b] = this.mac.skor;
    for (const top of this.toplar) {
      top.sahip = null;
      top.vx = top.vy = 0;
    }
    this.surpriz = null;
    this.kopek = null;
    this.istilaci = null;
    this.ruzgarEk = null;
    if (a !== b) return this.macBitir(a > b ? 0 : 1);
    this.asama = 'seri';
    this.mac.seri = { atislar: [[], []], sira: 0, atanSira: [0, 0], aktif: null, sonraki: this.saat + F.seriBaslangic };
    this.fxEkle({ tip: 'seriBasladi' });
    this.fxEkle({ tip: 'bildirim', metin: `🎯 ${a}-${b} BERABERE · PENALTILAR!`, renk: '#fbbf24', sure: 2.4 });
  }

  seriAtan(t) {
    const liste = this.sahadakiler(t).filter((o) => o.saha.slot !== 0);
    const havuz = liste.length ? liste : this.sahadakiler(t);
    if (!havuz.length) return null;
    havuz.sort((a, b) => Number(Boolean(a.bot)) - Number(Boolean(b.bot)) || b.puan - a.puan || b.gol - a.gol);
    const s = this.mac.seri;
    return havuz[s.atanSira[t]++ % havuz.length];
  }

  seriTick() {
    const s = this.mac.seri;
    if (!s.aktif && this.saat >= s.sonraki) {
      const t = s.sira;
      const atan = this.seriAtan(t);
      const kaleci = this.kaleci(1 - t);
      let gol = this.r() < 0.75 + (this.carpan(t) - 1) * 0.5;
      let koruma = null;
      if (gol && kaleci && this.korumalar[1 - t].length) {
        koruma = this.korumalar[1 - t].shift();
        gol = false;
      }
      s.aktif = { ...this.atisKur(t, atan, kaleci, gol), koruma };
      this.fxEkle({ tip: 'seriAtis', taraf: t, id: s.aktif.atan });
      return;
    }
    if (s.aktif && this.saat - s.aktif.basla >= F.seriAtis) {
      const { taraf, gol, koruma } = s.aktif;
      s.atislar[taraf].push(gol);
      this.fxEkle({ tip: 'seriSonuc', taraf, gol, koruma: koruma?.ad || '' });
      s.aktif = null;
      s.sira = 1 - taraf;
      s.sonraki = this.saat + 0.4;
      if (seriBittiMi(s.atislar[0], s.atislar[1])) {
        const g0 = s.atislar[0].filter(Boolean).length;
        const g1 = s.atislar[1].filter(Boolean).length;
        this.mac.pen = [g0, g1];
        this.macBitir(g0 > g1 ? 0 : 1);
      }
    }
  }

  macYildizi() {
    let en = null;
    for (const t of [0, 1]) {
      for (const o of [...this.sahadakiler(t), ...this.yedek[t].map((id) => this.oyuncular.get(id)).filter(Boolean)]) {
        if (o.bot) continue;
        if (!en || o.macGol > en.macGol || (o.macGol === en.macGol && o.macPuan > en.macPuan)) en = o;
      }
    }
    if (!en || (en.macGol === 0 && en.macPuan === 0)) return null;
    return { ad: this.adGoster(en), foto: this.fotoGoster(en), gol: en.macGol, puan: en.macPuan, taraf: en.taraf };
  }

  macBitir(kazananTaraf) {
    const es = this.kupa.eslesmeler;
    const e = this.eslesme;
    e.skor = [...this.mac.skor];
    e.pen = this.mac.pen ? [...this.mac.pen] : null;
    e.kazanan = this.takimIdx(kazananTaraf);
    e.kaybeden = this.takimIdx(1 - kazananTaraf);
    kupaDoldur(es);
    this.sonMac = {
      ad: e.ad,
      sira: this.kupa.sira,
      tur: e.tur,
      ev: e.ev,
      dep: e.dep,
      skor: [...e.skor],
      pen: e.pen,
      kazanan: e.kazanan,
      kazananTaraf,
      goller: this.mac.goller.slice(),
      yildiz: this.macYildizi(),
      hava: this.mac.hava,
    };
    this.fxEkle({ tip: 'macSonu', kazanan: kazananTaraf });
    const kazananAd = this.takimBilgi(e.kazanan).ad;
    this.fxEkle({ tip: 'akis', metin: `🏁 ${e.ad}: ${this.takimBilgi(e.ev).kisa} ${e.skor[0]}-${e.skor[1]} ${this.takimBilgi(e.dep).kisa}${e.pen ? ` (pen. ${e.pen[0]}-${e.pen[1]})` : ''} · ${kazananAd}`, renk: this.takimBilgi(e.kazanan).renk, onemli: true });
    if (this.kupa.sira === es.length - 1) {
      this.kupalar[e.kazanan] += 1;
      const krallar = [...this.oyuncular.values()].filter((o) => o.kupaGol > 0 && !o.bot).sort((a, b) => b.kupaGol - a.kupaGol || a.ilkGolZamani - b.ilkGolZamani);
      this.bitenKupa = {
        no: this.kupa.no,
        kazanan: e.kazanan,
        ikinci: e.kaybeden,
        ucuncu: es.find((x) => x.tur === 3)?.kazanan ?? -1,
        golKrali: krallar[0] ? { ad: this.adGoster(krallar[0]), foto: this.fotoGoster(krallar[0]), gol: krallar[0].kupaGol } : null,
        kupaSayisi: this.kupalar[e.kazanan],
        eslesmeler: es,
      };
      this.fxEkle({ tip: 'kupaSonu', kazanan: e.kazanan });
      this.yeniKupa();
      this.asama = 'kupaSonu';
      this.kalan = F.kupaSonu;
    } else {
      this.kupa.sira += 1;
      this.asama = 'ara';
      this.kalan = this.f.araSuresi;
    }
  }

  // ------------------------------------------------------------ çılgın an ve sürprizler
  ikinciTop() {
    if (this.toplar.length >= 2) return;
    const b = this.yeniTop();
    b.x = OX + rnd(-6, 6, this.r);
    b.y = OY + rnd(-14, 14, this.r);
    b.vx = rnd(-5, 5, this.r);
    b.vy = rnd(-8, 8, this.r);
    this.toplar.push(b);
  }

  cilginBaslat() {
    this.cilginBitis = Math.max(this.cilginBitis, this.saat) + F.cilginSure;
    this.ikinciTop();
    this.fxEkle({ tip: 'cilgin' });
    this.fxEkle({ tip: 'bildirim', metin: '❤️ BEĞENİ HEDEFİ! 2 TOP SAHADA', renk: '#f9a8d4', sure: 2.6 });
  }

  surprizBaslat() {
    const secenek = Object.keys(SURPRIZLER).filter((t) => !(t === 'ruzgar' && this.mac.hava === 'ruzgar'));
    const tur = secenek[Math.floor(this.r() * secenek.length)];
    const s = this.saat;
    this.surpriz = { tur, basla: s, bitis: s + SURPRIZLER[tur].sure };
    if (tur === 'kopek') {
      const ust = this.r() < 0.5;
      this.kopek = { x: rnd(25, 80, this.r), y: ust ? -3 : SAHA.g + 3, yon: 1, bitis: s + SURPRIZLER.kopek.sure - 1.8, cikisX: rnd(20, 85, this.r), cikisY: ust ? SAHA.g + 6 : -6, sonKapma: -9 };
    } else if (tur === 'patlak') {
      const b = this.toplar[0];
      this.fxEkle({ tip: 'patlak', x: b.x, y: b.y });
      if (b.sahip) {
        const o = this.oyuncular.get(b.sahip);
        if (o?.saha) o.saha.superBitis = 0;
      }
      this.toplar[0] = this.yeniTop();
    } else if (tur === 'ruzgar') {
      this.ruzgarEk = { x: (this.r() < 0.5 ? -1 : 1) * 5, y: rnd(-2, 2, this.r) };
    } else if (tur === 'taraftar') {
      const soldan = this.r() < 0.5;
      const y = rnd(15, 53, this.r);
      this.istilaci = {
        x: soldan ? -4 : SAHA.u + 4, y, hedefX: soldan ? SAHA.u + 6 : -6, hedefY: rnd(10, 58, this.r), yon: soldan ? 1 : -1,
        guvenlik: [{ x: soldan ? -9 : SAHA.u + 9, y: y - 3 }, { x: soldan ? -11 : SAHA.u + 11, y: y + 3 }],
      };
    }
    this.fxEkle({ tip: 'surpriz', tur });
  }

  surprizBitir() {
    this.surpriz = null;
    this.ruzgarEk = null;
    this.sonrakiSurpriz = this.macSaniye + rnd(...F.surprizAraligi, this.r);
  }

  // ------------------------------------------------------------ komutlar
  komut(k) {
    switch (k) {
      case 'duraklat':
        if (this.asama !== 'duraklat') {
          this.oncekiAsama = this.asama;
          this.asama = 'duraklat';
        }
        break;
      case 'devam':
        if (this.asama === 'duraklat') this.asama = this.oncekiAsama || 'mac';
        break;
      case 'turuBitir': // maçı şimdi bitir (berabereyse penaltılar); hazırlıktaysa hemen başlat
        if (this.asama === 'hazirlik') this.macBaslat();
        else if (this.asama === 'mac' || this.asama === 'gol') this.macSonu();
        break;
      case 'yeniTur': // maçı baştan başlat; aradaysa sıradaki maça hemen geç
        if (this.kayitAsamasi() || this.oyundaMi()) this.macKur();
        break;
      case 'sifirla':
        this.oturumuSifirla();
        break;
      case 'yeniYayin':
        this.kupalar = Array(this.f.takimlar.length).fill(0);
        this.oturumuSifirla();
        break;
      case 'skorSifirla':
        this.kupalar = Array(this.f.takimlar.length).fill(0);
        for (const o of this.oyuncular.values()) {
          o.gol = 0;
          o.kupaGol = 0;
          o.ilkGolZamani = Infinity;
        }
        break;
      case 'cilginAn':
        if (this.asama === 'mac') this.cilginBaslat();
        break;
      default:
    }
  }

  // ------------------------------------------------------------ zaman
  tick(dt) {
    if (this.asama === 'duraklat') return;
    this.saat += dt;
    this.kalan -= dt;
    const sonum = Math.exp((-dt * Math.LN2) / F.gucYarilanma);
    this.guc[0] *= sonum;
    this.guc[1] *= sonum;
    const s = this.saat;
    switch (this.asama) {
      case 'ara':
      case 'kupaSonu':
        if (this.kalan <= 0) this.macKur();
        return;
      case 'hazirlik':
        if (s >= this.botZamani) {
          this.botZamani = s + 0.5;
          this.botlariDuzenle();
        }
        for (let t = 0; t < 2; t++) {
          for (const o of this.sahadakiler(t)) {
            const k = this.evKonumu(t, o.saha.slot, true);
            this.hareket(o, k.x, k.y, F.hiz * 0.6, dt);
          }
        }
        if (this.kalan <= 0) this.macBaslat();
        return;
      case 'gol':
        this.kutlama(dt);
        if (this.kalan <= 0) {
          this.asama = 'mac';
          this.kalan = this.f.macSuresi - this.macSaniye;
          this.santraDiz(this.santraTaraf);
          this.fxEkle({ tip: 'santra' });
        }
        return;
      case 'penalti':
        if (this.kalan <= 0) this.penaltiSonuc();
        return;
      case 'seri':
        this.seriTick();
        return;
      case 'mac':
        this.macTick(dt);
        return;
      default:
    }
  }

  kutlama(dt) {
    const golcu = this.golcu ? this.oyuncular.get(this.golcu) : null;
    for (let t = 0; t < 2; t++) {
      for (const o of this.sahadakiler(t)) {
        if (golcu?.saha && o.taraf === golcu.taraf && o !== golcu) {
          const a = (o.saha.slot / DIZILIS.length) * Math.PI * 2;
          this.hareket(o, golcu.saha.x + Math.cos(a) * 2.4, golcu.saha.y + Math.sin(a) * 2.4, F.hiz, dt);
        } else if (o === golcu) {
          const kx = golcu.taraf === 0 ? SAHA.u - 3 : 3;
          const ky = golcu.saha.y < OY ? 3 : SAHA.g - 3;
          this.hareket(o, kx, ky, F.hiz * 0.8, dt);
        } else {
          o.saha.vx *= 0.9;
          o.saha.vy *= 0.9;
        }
      }
    }
  }

  macTick(dt) {
    const s = this.saat;
    this.macSaniye += dt;
    this.kalan = this.f.macSuresi - this.macSaniye;
    if (!this.devreBildirildi && this.macSaniye >= this.f.macSuresi / 2) {
      this.devreBildirildi = true;
      this.fxEkle({ tip: 'devre' });
      this.fxEkle({ tip: 'bildirim', metin: '⏱️ İKİNCİ YARI', renk: '#ffffff', sure: 2 });
    }
    if (s >= this.botZamani) {
      this.botZamani = s + 0.5;
      this.botlariDuzenle();
    }
    if (this.cilginBitis && s >= this.cilginBitis) {
      this.cilginBitis = 0;
      this.toplar = [this.toplar[0]];
    }
    if (this.f.surpriz && !this.surpriz && this.macSaniye >= this.sonrakiSurpriz && this.macSaniye < this.f.macSuresi - 6) this.surprizBaslat();
    if (this.surpriz && s >= this.surpriz.bitis) this.surprizBitir();
    if (this.bekleyen.length && s >= this.ozelKilit) {
      this.ozelKilit = s + F.ozelAralik;
      this.ozelCalistir(this.bekleyen.shift());
      if (this.asama !== 'mac') return;
    }
    this.oyunuOyna(dt);
    if (this.asama !== 'mac') return;
    if (this.macSaniye >= this.f.macSuresi) this.macSonu();
  }

  // ------------------------------------------------------------ oyun
  oyuncuHizi(o) {
    const p = o.saha;
    if (p.sersem > this.saat) return 0;
    let h = p.slot === 0 ? F.kaleciHiz : F.hiz;
    h *= this.carpan(o.taraf);
    if (this.mac.hava === 'kar') h *= 0.88;
    if (p.superBitis > this.saat) h *= 1.3;
    return h;
  }

  hareket(o, hx, hy, hiz, dt) {
    const p = o.saha;
    const dx = hx - p.x;
    const dy = hy - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.05 || hiz <= 0) {
      p.vx = 0;
      p.vy = 0;
      return;
    }
    const adim = Math.min(d, hiz * dt);
    p.vx = ((dx / d) * adim) / dt;
    p.vy = ((dy / d) * adim) / dt;
    p.x += (dx / d) * adim;
    p.y += (dy / d) * adim;
    if (Math.abs(dx) > 0.2) p.yon = dx > 0 ? 1 : -1;
  }

  enYakin(t, n, haric) {
    let en = null;
    let ed = Infinity;
    for (const o of this.sahadakiler(t)) {
      if (o.saha.slot === 0 || haric.has(o.id) || o.saha.sersem > this.saat) continue;
      const d = uzak(o.saha, n);
      if (d < ed) {
        ed = d;
        en = o;
      }
    }
    return en;
  }

  enYakinRakip(o, sinir) {
    let en = null;
    let ed = sinir;
    for (const p of this.sahadakiler(1 - o.taraf)) {
      const d = uzak(p.saha, o.saha);
      if (d < ed) {
        ed = d;
        en = p;
      }
    }
    return en;
  }

  rakipMesafesi(o) {
    let ed = 99;
    for (const p of this.sahadakiler(1 - o.taraf)) ed = Math.min(ed, uzak(p.saha, o.saha));
    return ed;
  }

  oyunuOyna(dt) {
    const s = this.saat;
    const anaTop = this.toplar[0];
    const anaSahip = anaTop.sahip ? this.oyuncular.get(anaTop.sahip) : null;
    const sahipTaraf = anaSahip ? anaSahip.taraf : -1;

    // kovalayanlar: her serbest/rakipteki top için her taraftan en yakın oyuncu
    const hedefler = new Map();
    for (const b of this.toplar) {
      if (b.garanti) continue;
      const sahipO = b.sahip ? this.oyuncular.get(b.sahip) : null;
      const tahmin = { x: b.x + b.vx * 0.25, y: b.y + b.vy * 0.25 };
      for (let t = 0; t < 2; t++) {
        if (sahipO && sahipO.taraf === t) continue;
        if (b.aut !== -1 && s < b.autBitis && b.aut !== t) continue;
        const yakin = this.enYakin(t, tahmin, hedefler);
        if (yakin) hedefler.set(yakin.id, tahmin);
      }
      if (b.pasHedef && !b.sahip) {
        const a = this.oyuncular.get(b.pasHedef);
        if (a?.saha) hedefler.set(a.id, { x: b.x + b.vx * 0.3, y: b.y + b.vy * 0.3 });
      }
    }

    // oyuncuları hareket ettir
    const sahipler = new Set(this.toplar.map((b) => b.sahip).filter(Boolean));
    for (let t = 0; t < 2; t++) {
      for (const o of this.sahadakiler(t)) {
        if (sahipler.has(o.id)) continue;
        const hiz = this.oyuncuHizi(o);
        let h = hedefler.get(o.id);
        if (!h) h = o.saha.slot === 0 ? this.kaleciHedef(o) : this.dizilisHedef(o, anaTop, sahipTaraf);
        this.hareket(o, h.x, h.y, hiz, dt);
      }
    }
    this.ayir();

    // topu süren oyuncular
    for (const b of this.toplar) {
      if (!b.sahip) continue;
      const o = this.oyuncular.get(b.sahip);
      if (!o?.saha) {
        b.sahip = null;
        continue;
      }
      this.topuSur(o, b, dt);
      if (this.asama !== 'mac') return;
    }
    // müdahaleler
    for (const b of this.toplar) {
      if (!b.sahip) continue;
      const o = this.oyuncular.get(b.sahip);
      if (o?.saha) this.mudahaleDene(o, b);
    }
    // serbest toplar
    for (const b of this.toplar) {
      if (b.sahip) {
        b.iz.length = 0;
        continue;
      }
      this.topFizigi(b, dt);
      if (this.asama !== 'mac') return;
    }
    this.kopekTick(dt);
    this.istilaciTick(dt);
  }

  // aynı takımdan üst üste binenleri biraz ayır
  ayir() {
    for (let t = 0; t < 2; t++) {
      const l = this.sahadakiler(t);
      for (let i = 0; i < l.length; i++) {
        for (let j = i + 1; j < l.length; j++) {
          const a = l[i].saha;
          const b = l[j].saha;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.001 && d < 2.2) {
            const it = (2.2 - d) * 0.25;
            a.x -= (dx / d) * it;
            a.y -= (dy / d) * it;
            b.x += (dx / d) * it;
            b.y += (dy / d) * it;
          }
        }
      }
    }
  }

  dizilisHedef(o, anaTop, sahipTaraf) {
    const t = o.taraf;
    const dir = t === 0 ? 1 : -1;
    const ev = this.evKonumu(t, o.saha.slot);
    let x = ev.x + (anaTop.x - OX) * 0.55;
    if (sahipTaraf === t) x += 7 * dir;
    else if (sahipTaraf === 1 - t) x -= 4 * dir;
    const y = ev.y * 0.72 + anaTop.y * 0.28;
    return { x: sinirla(x, 3, SAHA.u - 3), y: sinirla(y, 3, SAHA.g - 3) };
  }

  kaleciHedef(o) {
    const t = o.taraf;
    const dir = t === 0 ? 1 : -1;
    const gx = t === 0 ? 0 : SAHA.u;
    const anaTop = this.toplar[0];
    let hedefY = anaTop.y;
    for (const b of this.toplar) {
      if (b.sut && b.sonTaraf === 1 - t && !b.garanti && Math.abs(b.vx) > 1) {
        const tt = (o.saha.x - b.x) / b.vx;
        if (tt > 0) hedefY = b.y + b.vy * tt;
      }
    }
    // serbest top kendi ceza sahasındaysa ve rakipten önce yetişecekse kaleci çıkar
    for (const b of this.toplar) {
      if (b.sahip || b.sut || b.garanti) continue;
      if (dir * (b.x - gx) < 13 && Math.abs(b.y - OY) < 15 && (b.aut === -1 || b.aut === t)) {
        const benim = uzak(o.saha, b);
        const rakip = Math.min(...this.sahadakiler(1 - t).map((p) => uzak(p.saha, b)), 99);
        if (benim < rakip) return { x: b.x, y: b.y };
      }
    }
    return { x: gx + dir * 1.3, y: sinirla(hedefY, OY - SAHA.kale + 0.6, OY + SAHA.kale - 0.6) };
  }

  topuSur(o, b, dt) {
    const s = this.saat;
    const p = o.saha;
    const t = o.taraf;
    const dir = t === 0 ? 1 : -1;
    const gx = t === 0 ? SAHA.u : 0;
    if (p.slot === 0) {
      // kaleci topu tutar, kısa süre sonra oyuna sokar
      b.x = p.x + dir * 0.8;
      b.y = p.y;
      b.vx = b.vy = 0;
      if (s >= p.karar) this.pasVer(o, b, true) || this.uzunVur(o, b);
      return;
    }
    let hx = gx - p.x;
    let hy = OY - p.y;
    let d = Math.hypot(hx, hy) || 1;
    hx /= d;
    hy /= d;
    const r = this.enYakinRakip(o, 7);
    if (r) {
      const ax = p.x - r.saha.x;
      const ay = p.y - r.saha.y;
      const ad = Math.hypot(ax, ay) || 1;
      const g = (1 - ad / 7) * 1.6;
      // rakipten yana kaç (ileri gitmeyi bırakmadan)
      hy += (ay / ad) * g;
      hx += (ax / ad) * g * 0.3;
    }
    d = Math.hypot(hx, hy) || 1;
    hx /= d;
    hy /= d;
    const hiz = (p.sersem > s ? 0 : F.topluHiz) * this.carpan(t) * (this.mac.hava === 'kar' ? 0.88 : 1) * (p.superBitis > s ? 1.3 : 1);
    p.x = sinirla(p.x + hx * hiz * dt, 1, SAHA.u - 1);
    p.y = sinirla(p.y + hy * hiz * dt, 1, SAHA.g - 1);
    p.vx = hx * hiz;
    p.vy = hy * hiz;
    if (Math.abs(hx) > 0.2) p.yon = hx > 0 ? 1 : -1;
    b.x = p.x + hx * 0.9;
    b.y = p.y + hy * 0.9;
    b.vx = p.vx;
    b.vy = p.vy;
    b.donus += hiz * dt;
    if (s < p.karar) return;
    p.karar = s + rnd(...F.kararAraligi, this.r);
    const kaleUzak = Math.hypot(gx - p.x, OY - p.y);
    if (p.superBitis > 0) {
      if (kaleUzak < 24 || s >= p.superBitis) {
        p.superBitis = 0;
        this.sutCek(o, b, true);
      }
      return;
    }
    if (kaleUzak < F.sutMesafesi && this.r() < 0.24 + ((F.sutMesafesi - kaleUzak) / F.sutMesafesi) * 0.6) {
      this.sutCek(o, b, false);
      return;
    }
    const baski = this.enYakinRakip(o, 3.5);
    if ((baski && this.r() < 0.6) || this.r() < 0.12) this.pasVer(o, b, false);
  }

  pasVer(o, b, uzun) {
    const p = o.saha;
    const t = o.taraf;
    const dir = t === 0 ? 1 : -1;
    let enIyi = null;
    let puan = -Infinity;
    for (const a of this.sahadakiler(t)) {
      if (a === o || a.saha.slot === 0) continue;
      const dx = a.saha.x - p.x;
      const dy = a.saha.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 5 || d > (uzun ? 52 : 34)) continue;
      const deger = dx * dir * 0.6 + Math.min(this.rakipMesafesi(a), 8) * 1.5 - d * 0.15 + this.r() * 6;
      if (deger > puan) {
        puan = deger;
        enIyi = a;
      }
    }
    if (!enIyi) return false;
    const tx = enIyi.saha.x + enIyi.saha.vx * 0.35;
    const ty = enIyi.saha.y + enIyi.saha.vy * 0.35;
    const hiz = F.pasHiz * (uzun ? 1.2 : 1);
    const aci = Math.atan2(ty - b.y, tx - b.x) + rnd(-1, 1, this.r) * (0.06 + (this.mac.hava === 'yagmur' ? 0.05 : 0));
    this.topuBirak(b);
    b.vx = Math.cos(aci) * hiz;
    b.vy = Math.sin(aci) * hiz;
    b.pasHedef = enIyi.id;
    b.pasVeren = o.id;
    b.sut = false;
    b.sonDokunan = o.id;
    b.sonTaraf = t;
    b.denenen.add(o.id);
    p.almaYasak = this.saat + 0.35;
    p.vurus = this.saat;
    return true;
  }

  uzunVur(o, b) {
    const t = o.taraf;
    const dir = t === 0 ? 1 : -1;
    this.topuBirak(b);
    b.vx = dir * rnd(22, 28, this.r);
    b.vy = rnd(-9, 9, this.r);
    b.sut = false;
    b.pasHedef = null;
    b.pasVeren = null;
    b.sonDokunan = o.id;
    b.sonTaraf = t;
    o.saha.almaYasak = this.saat + 0.5;
    o.saha.vurus = this.saat;
  }

  sutCek(o, b, superMi) {
    const t = o.taraf;
    const dir = t === 0 ? 1 : -1;
    const gx = t === 0 ? SAHA.u : 0;
    const d = Math.hypot(gx - b.x, OY - b.y);
    const hava = this.mac.hava;
    let hy = OY + rnd(-1, 1, this.r) * SAHA.kale * 0.8;
    const hata = superMi ? 0.8 : (1.6 + d * 0.13) * (2 - this.carpan(t)) * (hava === 'sis' ? 1.3 : hava === 'yagmur' ? 1.15 : 1);
    hy += rnd(-1, 1, this.r) * hata;
    const hiz = superMi ? F.superHiz : F.sutHiz * rnd(0.88, 1.1, this.r);
    const tx = gx + dir * 2;
    const dx = tx - b.x;
    const dy = hy - b.y;
    const dd = Math.hypot(dx, dy) || 1;
    this.topuBirak(b);
    b.vx = (dx / dd) * hiz;
    b.vy = (dy / dd) * hiz;
    Object.assign(b, { sut: true, super: superMi, kontrol: false, sonDokunan: o.id, sonTaraf: t, pasHedef: null, pasVeren: null });
    o.saha.almaYasak = this.saat + 0.5;
    o.saha.vurus = this.saat;
    this.fxEkle({ tip: 'sut', id: o.id, super: superMi });
  }

  mudahaleDene(o, b) {
    const s = this.saat;
    if (o.saha.slot === 0) return; // topu tutan kaleciye müdahale yok
    for (const p of this.sahadakiler(1 - o.taraf)) {
      if (p.saha.mudahale > s || p.saha.sersem > s) continue;
      if (uzak(p.saha, o.saha) > F.mudahale) continue;
      p.saha.mudahale = s + F.mudahaleBekleme;
      const sans = 0.32 * (this.carpan(p.taraf) / this.carpan(o.taraf)) * (o.saha.superBitis > s ? 0.25 : 1);
      if (this.r() < sans) {
        o.saha.sersem = s + F.sersem;
        o.saha.superBitis = 0;
        this.topVer(b, p);
        p.saha.karar = s + rnd(0.2, 0.5, this.r);
        this.fxEkle({ tip: 'mudahale', id: p.id, kurban: o.id });
        return;
      }
    }
  }

  topFizigi(b, dt) {
    const s = this.saat;
    const hava = this.mac.hava;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const hiz0 = Math.hypot(b.vx, b.vy);
    b.donus += hiz0 * dt;
    if (!b.garanti) {
      const sur = (hava === 'yagmur' ? 0.7 : hava === 'kar' ? 1.35 : 1) * F.surtunme * (b.sut ? 0.25 : 1);
      const k = Math.exp(-sur * dt);
      b.vx *= k;
      b.vy *= k;
      if (hiz0 > 1) {
        const rz = this.ruzgar();
        b.vx += rz.x * dt;
        b.vy += rz.y * dt;
      }
    }
    const hiz = Math.hypot(b.vx, b.vy);
    if (hiz < 0.3) b.vx = b.vy = 0;
    if (b.sut && hiz < 9 && !b.garanti) {
      b.sut = false;
      b.super = false;
    }
    if (b.pasHedef && hiz < 3) b.pasHedef = null;
    if (hiz > 15) {
      b.iz.push({ x: b.x, y: b.y });
      if (b.iz.length > 10) b.iz.shift();
    } else if (b.iz.length) b.iz.shift();

    // taç
    if (b.y < 0 || b.y > SAHA.g) {
      b.y = sinirla(b.y, 0.6, SAHA.g - 0.6);
      b.vx = b.vy = 0;
      Object.assign(b, { sut: false, super: false, garanti: false, pasHedef: null, pasVeren: null });
      b.aut = b.sonTaraf === -1 ? -1 : 1 - b.sonTaraf;
      b.autBitis = s + 2.5;
      b.denenen.clear();
      return;
    }
    // kale çizgisi
    if (b.x < 0 || b.x > SAHA.u) {
      const sag = b.x > SAHA.u;
      const atanTaraf = sag ? 0 : 1;
      const dy = Math.abs(b.y - OY);
      if (b.garanti || dy < SAHA.kale - 0.35) {
        this.golAt(atanTaraf, b);
        return;
      }
      if (dy < SAHA.kale + 0.35) {
        b.x = sag ? SAHA.u - 0.3 : 0.3;
        b.vx *= -0.45;
        b.vy += rnd(-4, 4, this.r);
        b.sut = false;
        b.super = false;
        b.denenen.clear();
        this.fxEkle({ tip: 'direk', x: b.x, y: b.y });
        return;
      }
      const savunan = sag ? 1 : 0;
      if (b.sut && dy < SAHA.kale + 4) this.fxEkle({ tip: 'kacti', x: sag ? SAHA.u : 0, y: b.y });
      b.x = sag ? SAHA.u - 5.5 : 5.5;
      b.y = OY + rnd(-6, 6, this.r);
      b.vx = b.vy = 0;
      Object.assign(b, { sut: false, super: false, pasHedef: null, pasVeren: null });
      b.denenen.clear();
      const k = this.kaleci(savunan);
      if (k) {
        k.saha.x = b.x;
        k.saha.y = b.y;
        this.topVer(b, k);
        k.saha.karar = s + 0.9;
      } else {
        b.aut = savunan;
        b.autBitis = s + 2.5;
        b.sonTaraf = 1 - savunan;
      }
      return;
    }

    // kaleci kurtarışı
    if (b.sut && !b.garanti && !b.kontrol) {
      const savunan = 1 - b.sonTaraf;
      const k = this.kaleci(savunan);
      if (k && k.saha.sersem <= s) {
        const yaklasti = savunan === 0 ? b.x <= k.saha.x + 0.8 && b.vx < 0 : b.x >= k.saha.x - 0.8 && b.vx > 0;
        if (yaklasti) {
          b.kontrol = true;
          if (Math.abs(b.y - OY) < SAHA.kale - 0.2 && this.korumalar[savunan].length) {
            // kesin kurtarış hakkı: kaleci uzanıp topu tutar
            const kor = this.korumalar[savunan].shift();
            k.saha.y = b.y;
            this.topVer(b, k);
            k.saha.karar = s + 1.1;
            this.fxEkle({ tip: 'kurtaris', id: k.id, tuttu: true, koruma: kor.ad, korumaId: kor.id });
            return;
          }
          const dy = Math.abs(b.y - k.saha.y);
          const uzanma = F.kaleciUzanma * this.carpan(savunan) * (b.super ? 0.6 : 1) * (hava === 'sis' ? 0.9 : 1);
          if (dy < uzanma) {
            const p = (b.super ? 0.3 : 0.64) * (1 - (dy / uzanma) * 0.35);
            if (this.r() < p) {
              const tuttu = !b.super && this.r() < 0.5;
              if (tuttu) {
                this.topVer(b, k);
                k.saha.karar = s + 1.1;
              } else {
                b.vx = -b.vx * 0.3;
                b.vy = rnd(-11, 11, this.r);
                Object.assign(b, { sut: false, super: false, sonDokunan: k.id, sonTaraf: savunan, pasVeren: null });
                b.denenen.clear();
              }
              this.fxEkle({ tip: 'kurtaris', id: k.id, tuttu });
              return;
            }
          }
          this.fxEkle({ tip: 'uzandi', id: k.id });
        }
      }
    }

    // topu alma
    if (!b.sut && !b.garanti) {
      let alan = null;
      let en = F.alma;
      for (let t = 0; t < 2; t++) {
        if (b.aut !== -1 && s < b.autBitis && b.aut !== t) continue;
        for (const o of this.sahadakiler(t)) {
          const p = o.saha;
          if (p.almaYasak > s || p.sersem > s) continue;
          const d = uzak(p, b);
          if (d >= en) continue;
          if (hiz > 12 && o.id !== b.pasHedef && p.slot !== 0) {
            if (b.denenen.has(o.id)) continue;
            b.denenen.add(o.id);
            if (this.r() > 0.35) continue;
          }
          en = d;
          alan = o;
        }
      }
      if (alan) this.topVer(b, alan);
    }
  }

  kopekTick(dt) {
    const k = this.kopek;
    if (!k) return;
    const s = this.saat;
    const b = this.toplar[0];
    const kovala = s < k.bitis;
    const hx = kovala ? b.x : k.cikisX;
    const hy = kovala ? b.y : k.cikisY;
    const dx = hx - k.x;
    const dy = hy - k.y;
    const d = Math.hypot(dx, dy) || 1;
    const adim = Math.min(d, 10.5 * dt);
    k.x += (dx / d) * adim;
    k.y += (dy / d) * adim;
    if (Math.abs(dx) > 0.2) k.yon = dx > 0 ? 1 : -1;
    if (kovala && d < 1.3 && s - k.sonKapma > 1.2) {
      k.sonKapma = s;
      if (b.sahip) {
        const o = this.oyuncular.get(b.sahip);
        if (o?.saha) o.saha.sersem = s + 0.6;
      }
      this.topuBirak(b);
      const a = this.r() * Math.PI * 2;
      b.vx = Math.cos(a) * 14;
      b.vy = Math.sin(a) * 14;
      Object.assign(b, { sut: false, super: false, pasHedef: null, pasVeren: null, sonTaraf: -1, aut: -1 });
      this.fxEkle({ tip: 'kopekKapti', x: k.x, y: k.y });
    }
    if (!kovala && (k.y < -5 || k.y > SAHA.g + 5)) this.kopek = null;
  }

  istilaciTick(dt) {
    const i = this.istilaci;
    if (!i) return;
    const dx = i.hedefX - i.x;
    const dy = i.hedefY - i.y;
    const d = Math.hypot(dx, dy) || 1;
    const adim = Math.min(d, 9 * dt);
    i.x += (dx / d) * adim;
    i.y += (dy / d) * adim;
    for (const g of i.guvenlik) {
      const gx = i.x - g.x;
      const gy = i.y - g.y;
      const gd = Math.hypot(gx, gy) || 1;
      const ga = Math.min(gd, 8.4 * dt);
      g.x += (gx / gd) * ga;
      g.y += (gy / gd) * ga;
    }
    if (d < 0.5) this.istilaci = null;
  }

  // ------------------------------------------------------------ özet
  gosterilenMac() {
    if (this.kayitAsamasi() && this.sonMac) return { ad: this.sonMac.ad, ev: this.sonMac.ev, dep: this.sonMac.dep, skor: this.sonMac.skor, pen: this.sonMac.pen, bitti: true };
    const e = this.eslesme;
    return { ad: e.ad, ev: e.ev, dep: e.dep, skor: this.mac.skor, pen: this.mac.pen, bitti: false };
  }

  ozet() {
    const g = this.gosterilenMac();
    return {
      oyun: 'futbol',
      tur: this.kupa.no,
      kalan: Math.max(0, Math.ceil(this.kalan)),
      asama: this.asama,
      canli: [this.saha[0].length, this.saha[1].length],
      galibiyet: g.skor,
      kaptanlar: [[], []],
      demo: this.demoVerisi,
      futbol: {
        kupa: this.kupa.no,
        macAdi: g.ad,
        ev: g.ev,
        dep: g.dep,
        skor: g.skor,
        pen: g.pen,
        dakika: this.asama === 'mac' || this.asama === 'gol' ? this.dakika() : 0,
        guc: Math.round(this.gucOrani(0) * 100),
        golKrallari: this.golKrallari(5).map(({ oyuncu }) => ({ ad: this.adGoster(oyuncu), gol: oyuncu.gol })),
        kupalar: [...this.kupalar],
      },
    };
  }
}
