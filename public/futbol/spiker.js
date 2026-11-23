// Futbol Kupası spikeri: oyun olaylarını Türkçe cümleye çevirir, sunucudan sesini alıp sırayla okutur.
// Ses sunucuda bilgisayarın kendi Türkçe sesiyle üretilir (internet gerekmez). Önemli anonslar (gol, maç sonu)
// küçük anonsların önüne geçer; eskiyen anons (ör. geçmiş bir atak) okunmadan atılır.
import { SAHA } from './motor.js';

const SAYI = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on', 'on bir', 'on iki', 'on üç', 'on dört', 'on beş', 'on altı', 'on yedi', 'on sekiz', 'on dokuz', 'yirmi'];
const YONELME = ['sıfıra', 'bire', 'ikiye', 'üçe', 'dörde', 'beşe', 'altıya', 'yediye', 'sekize', 'dokuza', 'ona'];
const GERI_SAYIM = { 3: 'Üç!', 2: 'İki!', 1: 'Bir!' };
const SABIT_CUMLELER = ['Maç başlıyor!', 'Üç!', 'İki!', 'Bir!', 'Ve maç başladı!', 'İkinci yarı başladı!', 'Direkten döndü!', 'Az farkla dışarı!', 'Kaleci kurtardı!', 'Müthiş kurtarış!', 'Gol!', 'Kaçtı!', 'Kaleci penaltıyı kurtardı!', 'Maç berabere bitti! Penaltılara gidiyoruz!'];
const SURPRIZ_CUMLE = {
  kopek: 'Sahaya bir köpek girdi!',
  karanlik: 'Işıklar gitti!',
  patlak: 'Top patladı, yeni top geliyor!',
  taraftar: 'Sahaya bir taraftar girdi!',
  ruzgar: 'Sert bir rüzgar esiyor!',
};

export const sayiSoz = (n) => SAYI[n] ?? String(n);
export const sayiYonelme = (n) => YONELME[n] ?? `${n} farka`;
const sec = (dizi) => dizi[Math.floor(Math.random() * dizi.length)];

// Okunacak ad: emoji ve işaretler atılır, harf/rakam ayrılır, uzun rakam dizileri tek tek okunur
export function konusmaAdi(ad) {
  let s = String(ad ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ');
  s = s.replace(/(\p{L})(\p{N})/gu, '$1 $2').replace(/(\p{N})(\p{L})/gu, '$1 $2');
  s = s.replace(/\p{N}{5,}/gu, (r) => r.split('').join(' '));
  s = s.replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, 28).join('').trim();
}

// "ÇEYREK FİNAL 2" → "çeyrek final iki"
export function macAdiSoz(ad) {
  return String(ad ?? '').toLocaleLowerCase('tr-TR').replace(/\d+/g, (r) => sayiSoz(Number(r)));
}

// Gol atan takımın gözünden skor cümlesi (a: atan takımın golü, b: rakibin)
export function skorCumlesi(takim, a, b) {
  const skor = `${sayiSoz(a)} ${sayiSoz(b)}`;
  if (a === b) return `${takim} skoru eşitledi! ${skor}!`;
  if (a === b + 1) return `${takim} ${skor} öne geçti!`;
  if (a > b) return `${takim} farkı ${sayiYonelme(a - b)} çıkardı! ${skor}!`;
  return `${takim} farkı ${sayiYonelme(b - a)} indirdi! ${skor}!`;
}

export class Spiker {
  constructor(ses, sunucu = '') {
    this.ses = ses;
    this.sunucu = sunucu;
    this.acik = true;
    this.duzey = 0.9;
    this.onbellek = new Map(); // metin -> Promise<AudioBuffer|null>
    this.kuyruk = [];
    this.calan = null;
    this.mesgul = false;
    this.hataSayisi = 0;
    this.kapaliBitis = 0;
    this.onYukleme = [];
    this.onYuklemeZamani = 0;
  }

  kullanilabilir() {
    return this.acik && this.duzey > 0 && performance.now() >= this.kapaliBitis;
  }

  bosMu() {
    return !this.calan && !this.mesgul && !this.kuyruk.length;
  }

  getir(metin) {
    let p = this.onbellek.get(metin);
    if (p) {
      this.onbellek.delete(metin);
      this.onbellek.set(metin, p);
      return p;
    }
    p = fetch(this.sunucu + '/api/spiker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Istek': 'tiktok-oyun' },
      body: JSON.stringify({ metin }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then((veri) => this.ses.coz(veri))
      .then((t) => {
        this.hataSayisi = 0;
        return t;
      })
      .catch(() => {
        this.onbellek.delete(metin);
        // üst üste hata (ör. spiker kapalı ya da ses yok): 30 sn denemeyi bırak
        if (++this.hataSayisi >= 3) this.kapaliBitis = performance.now() + 30000;
        return null;
      });
    this.onbellek.set(metin, p);
    while (this.onbellek.size > 250) this.onbellek.delete(this.onbellek.keys().next().value);
    return p;
  }

  // Önceden hazırla (ör. sahaya giren oyuncunun "gol" cümlesi): sırayla, aralıklı
  hazirla(metin) {
    if (!this.kullanilabilir() || this.onbellek.has(metin)) return;
    if (!this.onYukleme.includes(metin)) this.onYukleme.push(metin);
    if (this.onYukleme.length > 20) this.onYukleme.shift();
  }

  tick() {
    if (!this.onYukleme.length || performance.now() < this.onYuklemeZamani) return;
    this.onYuklemeZamani = performance.now() + 400;
    this.getir(this.onYukleme.shift());
  }

  soyle(metin, { oncelik = 1, omur = 4, kes = false } = {}) {
    if (!metin || !this.kullanilabilir()) return;
    this.getir(metin);
    if (kes && this.calan && this.calan.oncelik <= oncelik) this.calan.dur();
    this.kuyruk.push({ metin, oncelik, bitis: performance.now() + omur * 1000, sira: performance.now() });
    if (this.kuyruk.length > 4) {
      // en düşük öncelikli ve en eski anons atılır
      let at = 0;
      for (let i = 1; i < this.kuyruk.length; i++) if (this.kuyruk[i].oncelik < this.kuyruk[at].oncelik) at = i;
      this.kuyruk.splice(at, 1);
    }
    this.siradaki();
  }

  async siradaki() {
    if (this.calan || this.mesgul) return;
    const simdi = performance.now();
    this.kuyruk = this.kuyruk.filter((i) => i.bitis > simdi);
    if (!this.kuyruk.length) return;
    let en = 0;
    for (let i = 1; i < this.kuyruk.length; i++) if (this.kuyruk[i].oncelik > this.kuyruk[en].oncelik) en = i;
    const is = this.kuyruk.splice(en, 1)[0];
    this.mesgul = true;
    const tampon = await this.getir(is.metin);
    this.mesgul = false;
    if (!tampon || performance.now() > is.bitis + 1500 || !this.kullanilabilir()) {
      this.siradaki();
      return;
    }
    const c = this.ses.tamponCal(tampon, this.duzey);
    this.calan = { oncelik: is.oncelik, dur: c.dur };
    await c.bitti;
    this.calan = null;
    this.siradaki();
  }
}

// Oyun olaylarını spiker cümlesine çevirir
export class Yorumcu {
  constructor(motor, spiker) {
    this.m = motor;
    this.s = spiker;
    this.sonAtak = -99;
    this.sonAtakTaraf = -1;
    this.sonPozisyon = -99;
    this.sonGiris = -99;
    this.sonKurulum = -99;
    this.geriSayim = {};
    this.sabitlerHazir = false;
  }

  isim(id) {
    const o = id ? this.m.oyuncular.get(id) : null;
    if (!o || o.bot) return '';
    return konusmaAdi(this.m.adGoster(o));
  }

  takim(taraf) {
    return this.m.takim(taraf).ad;
  }

  pozisyon(metin, oncelik = 2) {
    if (this.m.saat - this.sonPozisyon < 5) return;
    this.sonPozisyon = this.m.saat;
    this.s.soyle(metin, { oncelik, omur: 2.2 });
  }

  olay(f) {
    const m = this.m;
    const s = this.s;
    switch (f.tip) {
      case 'macKuruldu': {
        if (m.saat - this.sonKurulum < 1) return; // yeniden yüklemede iki kez gelmesin
        this.sonKurulum = m.saat;
        this.geriSayim = {};
        if (!this.sabitlerHazir) {
          this.sabitlerHazir = true;
          for (const c of SABIT_CUMLELER) s.hazirla(c);
        }
        const e = m.eslesme;
        s.soyle(`${macAdiSoz(e.ad)}! ${this.takim(0)}, ${this.takim(1)}! Beğen ve takımını yaz!`, { oncelik: 2, omur: 5 });
        return;
      }
      case 'macBasladi':
        s.soyle('Ve maç başladı!', { oncelik: 2, omur: 2 });
        return;
      case 'devre':
        s.soyle('İkinci yarı başladı!', { oncelik: 1, omur: 3 });
        return;
      case 'giris': {
        const ad = this.isim(f.id);
        if (!ad || !['hazirlik', 'mac'].includes(m.asama)) return;
        s.hazirla(`${ad}, gooool!`);
        if (m.saat - this.sonGiris > 7 && s.bosMu()) {
          this.sonGiris = m.saat;
          s.soyle(`${ad} sahada!`, { oncelik: 0, omur: 2 });
        }
        return;
      }
      case 'gol': {
        const ad = f.bot ? '' : konusmaAdi(f.ad);
        const takim = this.takim(f.taraf);
        let ilk;
        if (f.kendi) ilk = `Kendi kalesine! ${takim} golü buldu!`;
        else if (f.tur === 'penalti') ilk = ad ? `Penaltıdan gol! ${ad}!` : 'Penaltıdan gol!';
        else if (f.tur === 'roket') ilk = ad ? `${ad}, hediye golü! Gooool!` : 'Hediye golü! Gooool!';
        else if (f.tur === 'super') ilk = ad ? `${ad}, süper şut! Gooool!` : 'Süper şut! Gooool!';
        else ilk = ad ? `${ad}, gooool!` : `Gooool! ${takim}!`;
        s.soyle(ilk, { oncelik: 3, omur: 4, kes: true });
        const skor = f.skor || m.mac.skor;
        s.soyle(skorCumlesi(takim, skor[f.taraf], skor[1 - f.taraf]), { oncelik: 3, omur: 9 });
        return;
      }
      case 'kart': {
        if (f.ozel === 'koruma') {
          const ad = this.isim(f.id);
          s.soyle(ad ? `${ad}, kaleye koruma!` : 'Kaleye koruma!', { oncelik: 2, omur: 2.5 });
          return;
        }
        if (f.ozel !== 'superSut') return; // penaltı ve direkt golün kendi anonsu var
        const ad = this.isim(f.id);
        if (!ad) return;
        s.soyle(f.birikim ? `${ad}, hediyeler birikti, süper şut!` : `${ad}, süper şut!`, { oncelik: 2, omur: 2.5 });
        return;
      }
      case 'penalti': {
        const ad = this.isim(f.id);
        s.soyle(ad ? `Penaltı! ${ad} topun başında!` : `Penaltı! ${this.takim(f.taraf)} topun başında!`, { oncelik: 3, omur: 3, kes: true });
        return;
      }
      case 'kurtaris':
        if (f.koruma) {
          this.sonPozisyon = m.saat;
          const ad = konusmaAdi(f.koruma);
          s.soyle(f.penalti ? 'Koruma devrede! Kaleci penaltıyı kurtardı!' : ad ? `Koruma devrede! ${ad} sayesinde kaleci kurtardı!` : 'Koruma devrede! Kaleci kurtardı!', { oncelik: 3, omur: 3.5, kes: true });
        } else if (f.penalti) {
          this.sonPozisyon = m.saat;
          s.soyle('Kaleci penaltıyı kurtardı!', { oncelik: 3, omur: 3, kes: true });
        } else this.pozisyon(sec(['Kaleci kurtardı!', 'Müthiş kurtarış!']));
        return;
      case 'direk':
        this.pozisyon('Direkten döndü!');
        return;
      case 'kacti':
        this.pozisyon('Az farkla dışarı!', 1);
        return;
      case 'surpriz':
        if (SURPRIZ_CUMLE[f.tur]) s.soyle(SURPRIZ_CUMLE[f.tur], { oncelik: 2, omur: 3 });
        return;
      case 'cilgin':
        s.soyle('Beğeni hedefi doldu! Sahada iki top var!', { oncelik: 2, omur: 4 });
        return;
      case 'seriBasladi':
        s.soyle('Maç berabere bitti! Penaltılara gidiyoruz!', { oncelik: 3, omur: 5, kes: true });
        return;
      case 'seriAtis': {
        const ad = this.isim(f.id);
        s.soyle(`${ad || this.takim(f.taraf)}!`, { oncelik: 2, omur: 1.2 });
        return;
      }
      case 'seriSonuc':
        s.soyle(f.gol ? 'Gol!' : f.koruma ? 'Koruma devrede, kurtardı!' : 'Kaçtı!', { oncelik: 2, omur: 1.5, kes: true });
        return;
      case 'degisti': {
        const ad = this.isim(f.id);
        if (ad && s.bosMu()) s.soyle(`${ad}, ${this.takim(f.taraf)} saflarına geçti!`, { oncelik: 0, omur: 2 });
        return;
      }
      case 'macSonu': {
        const sm = m.sonMac;
        if (!sm) return;
        const kazanan = m.takimBilgi(sm.kazanan).ad;
        const k = sm.kazananTaraf;
        const skor = `${sayiSoz(sm.skor[k])} ${sayiSoz(sm.skor[1 - k])}`;
        s.soyle(sm.pen ? `Maç bitti! Penaltılarda ${kazanan} kazandı!` : `Maç bitti! ${kazanan} ${skor} kazandı!`, { oncelik: 3, omur: 8, kes: true });
        const sonraki = { 64: 'son otuz iki turuna yükseldi!', 32: 'son on altı turuna yükseldi!', 16: 'çeyrek finale yükseldi!', 8: 'yarı finale yükseldi!', 4: 'finalde!' }[sm.tur];
        if (sm.tur === 3) s.soyle(`${kazanan} turnuvayı üçüncü bitirdi!`, { oncelik: 2, omur: 10 });
        else if (sonraki) s.soyle(`${kazanan} ${sonraki}`, { oncelik: 2, omur: 10 });
        return;
      }
      case 'kupaSonu': {
        const bk = m.bitenKupa;
        if (!bk) return;
        s.soyle(`Şampiyon ${m.takimBilgi(bk.kazanan).ad}! Tebrikler!`, { oncelik: 3, omur: 12 });
        const kral = bk.golKrali ? konusmaAdi(bk.golKrali.ad) : '';
        if (kral) s.soyle(`Kupanın gol kralı ${kral}!`, { oncelik: 3, omur: 14 });
        return;
      }
      default:
    }
  }

  // Her karede: maç başı geri sayımı ve atak anonsları
  tick() {
    const m = this.m;
    const s = this.s;
    s.tick();
    if (m.asama === 'hazirlik') {
      const k = m.kalan;
      if (!this.geriSayim.basliyor && k <= 5.2 && k > 3.4) {
        this.geriSayim.basliyor = true;
        s.soyle('Maç başlıyor!', { oncelik: 2, omur: 1.4, kes: true });
      }
      for (const n of [3, 2, 1]) {
        if (!this.geriSayim[n] && k <= n + 0.05 && k > n - 0.8) {
          this.geriSayim[n] = true;
          s.soyle(GERI_SAYIM[n], { oncelik: 2, omur: 0.8, kes: true });
        }
      }
      return;
    }
    if (m.asama !== 'mac') return;
    const b = m.toplar[0];
    if (!b?.sahip) return;
    const o = m.oyuncular.get(b.sahip);
    if (!o?.saha || o.saha.slot === 0) return;
    const dir = o.taraf === 0 ? 1 : -1;
    if (dir * (o.saha.x - SAHA.u / 2) < 20) return;
    if (m.saat - this.sonAtak < 11 || (o.taraf === this.sonAtakTaraf && m.saat - this.sonAtak < 22)) return;
    if (!s.bosMu()) return;
    this.sonAtak = m.saat;
    this.sonAtakTaraf = o.taraf;
    const takim = this.takim(o.taraf);
    const ad = this.isim(o.id);
    const secenek = [`${takim} atak yapıyor!`, `${takim} hücumda!`, `${takim} rakip kaleye yaklaşıyor!`];
    if (ad) secenek.push(`${ad} topla ilerliyor!`, `${ad} hücumda!`);
    s.soyle(sec(secenek), { oncelik: 1, omur: 2.5 });
  }
}
