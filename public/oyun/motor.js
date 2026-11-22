// Cephe Kapışması v2 — oyun motoru (çizimden bağımsız, Node testlerinde de çalışır).
// Takım 0 üst yarıda, takım 1 alt yarıda. İzleyici beğeniyle oyuna girer; her yeni turda herkes çıkar.
// Ön saftaki askerler kendiliğinden dövüşür. Hediyeler silahtır: Tüfek 1, Bomba 6 kişi düşürür, Ejderha turu bitirir.
// Kaptan sıralaması: 1 jeton = 1 puan, her düşürme +1 puan; eşit puanlılar aynı sırada.

export const SILAHLAR = {
  kalkan: { ad: 'Kalkan + Diriliş', ikon: '🛡️' },
  tufek: { ad: 'Tüfek', ikon: '🔫' },
  bomba: { ad: 'Bomba', ikon: '💣' },
  ejderha: { ad: 'Ejderha', ikon: '🐉' },
};

export const SABIT = {
  can: 100,
  onSaf: 10, // her takımın ön safında dövüşen asker sayısı
  vurusAraligi: [3, 4.2], // sn (oyun hızına bölünür)
  hasar: [8, 13],
  begeniSaniyeSiniri: 3, // kişi başı saniyede sayılan beğeni
  begeniCan: 3, // her beğeni kendi askerine can
  begeniOfke: 1, // her beğeni takımın öfkesine
  yorumOfke: 2,
  yorumAraligi: 5,
  paylasimOfke: 10,
  paylasimTurSiniri: 3,
  ofkeTavan: 100,
  ofkeSonum: 4, // sn başına
  kalkanTavan: 3,
  degisimAraligi: 30, // yorumla takım değiştirme aralığı
  sonSans: 5, // takımı tükenen tarafa son şans
  uzatma: 20,
  cilginAralik: 60,
  cilginSure: 10,
  silahGecikme: 3, // ara sırasında gelen silahlar yeni savaş başlayınca kaç sn sonra ateşlenir
  cilginSureHedef: 10, // beğeni hedefi dolunca başlayan çılgın an
  hizlar: { yavas: 0.6, normal: 1, hizli: 1.5 },
};

export function sadelestir(s) {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

const KOTU_KOKLER = ['amk', 'aq', 'orospu', 'pic', 'sik', 'siktir', 'yarrak', 'got', 'anani', 'amina', 'pezevenk', 'kahpe', 'ibne', 'yavsak', 'serefsiz', 'gavat', 'kaltak', 'oc'];
export function adSuz(ad) {
  const kelimeler = sadelestir(ad).replace(/[0-9]/g, ' ').split(/\s+/).filter(Boolean);
  const kotu = kelimeler.some((k) => KOTU_KOKLER.some((kok) => k === kok || (kok.length >= 4 && k.startsWith(kok))));
  return kotu ? 'İzleyici' : ad;
}

export function jetonEsikleri(a) {
  return { tufek: a.tufekJeton, bomba: a.bombaJeton, ejderha: a.ejderhaJeton };
}

// Bir hediyenin (tek adet) etkisi, jeton fiyatına göre
export function hediyeEtkisi(jeton, a) {
  if (jeton >= a.ejderhaJeton) return { tur: 'ejderha', kisi: 0, jeton };
  if (jeton >= a.bombaJeton) return { tur: 'bomba', kisi: a.bombaKisi + Math.floor((jeton - a.bombaJeton) / a.tufekJeton), jeton };
  if (jeton >= a.tufekJeton) return { tur: 'tufek', kisi: Math.floor(jeton / a.tufekJeton), jeton };
  return { tur: 'kalkan', kisi: 0, jeton };
}

// Eşit puanlılar aynı sırayı alır: 1, 2, 2, 3 …
export function siraVer(liste, alan = 'puan') {
  let sira = 0;
  let onceki = null;
  return liste.map((o) => {
    if (o[alan] !== onceki) {
      sira += 1;
      onceki = o[alan];
    }
    return { oyuncu: o, sira };
  });
}

const rastgele = (a, b, r = Math.random) => a + (b - a) * r();

export class Motor {
  constructor(ayarlar, { rastgele: r = Math.random } = {}) {
    this.ayarlar = ayarlar;
    this.r = r;
    this.fx = [];
    this.galibiyet = [0, 0];
    this.oturumuSifirla();
  }

  // ------------------------------------------------------------ kurulum
  oturumuSifirla() {
    this.saat = 0;
    this.oyuncular = new Map();
    this.turNo = 0;
    this.demoVerisi = false;
    this.sonOlay = 0;
    this.bekleyenSilahlar = [];
    this.begeniSayaci = 0; // beğeni hedefine doğru
    this.cilginBekliyor = false;
    this.botSayaci = 0;
    this.botZamani = 0;
    this.yeniTur(true);
  }

  yeniTur(ilk = false) {
    this.turNo += 1;
    this.asama = 'hazirlik';
    this.kalan = this.ayarlar.hazirlik;
    this.turBaslangic = this.saat;
    this.sonuc = null;
    this.cilginBitis = 0;
    this.sonrakiCilgin = 0;
    this.takimlar = [0, 1].map(() => ({ askerler: [], sira: [], ofke: 0, sonSansBitis: 0, dusurme: 0 }));
    // herkes oyundan çıkar; ara sırasında beğenen ya da hediye atanlar hazır bekler
    const hazirlar = [];
    for (const o of this.oyuncular.values()) {
      o.asker = null;
      o.donusZamani = 0;
      o.paylasimSayisi = 0;
      o.sonDegisim = -999;
      if (o.hazir !== undefined && o.hazir !== null) hazirlar.push(o);
    }
    hazirlar.sort((a, b) => a.hazirZamani - b.hazirZamani);
    for (const o of hazirlar) {
      const t = o.hazir;
      o.hazir = null;
      this.oyunaAl(o, t, { sessiz: true });
    }
    if (!ilk) this.fxEkle({ tip: 'bildirim', metin: `${this.turNo}. TUR · Beğen ve katıl!`, renk: '#ffffff', sure: 2.5 });
  }

  ayarlariGuncelle(a) {
    this.ayarlar = a;
    if (this.asama === 'savas') this.kalan = Math.min(this.kalan, a.turSuresi);
  }

  fxEkle(f) {
    if (this.fx.length < 600) this.fx.push(f);
  }

  // ------------------------------------------------------------ sorgular
  canli(t) {
    return this.takimlar[t].askerler.length;
  }

  // takımın son oynadığı oyunculardan sıralama
  siralama(t) {
    const liste = [];
    for (const o of this.oyuncular.values()) if (o.takim === t && o.puan > 0) liste.push(o);
    liste.sort((a, b) => b.puan - a.puan || a.ilkPuanZamani - b.ilkPuanZamani);
    return siraVer(liste);
  }

  kaptanlar(t) {
    return this.siralama(t).filter((s) => s.sira === 1).map((s) => s.oyuncu);
  }

  kaptanMi(o) {
    if (!o || o.puan <= 0 || o.takim === -1) return false;
    for (const p of this.oyuncular.values()) if (p.takim === o.takim && p.puan > o.puan) return false;
    return true;
  }

  gercekSayisi(t) {
    let n = this.takimlar[t].sira.length;
    for (const id of this.takimlar[t].askerler) if (!this.oyuncular.get(id)?.bot) n++;
    return n;
  }

  kucukTakim() {
    const a = this.gercekSayisi(0);
    const b = this.gercekSayisi(1);
    if (a !== b) return a < b ? 0 : 1;
    return this.r() < 0.5 ? 0 : 1;
  }

  takimEslestir(metin) {
    const s = sadelestir(metin);
    if (!s) return -1;
    const ilk = s.split(' ')[0];
    if (ilk === '1') return 0;
    if (ilk === '2') return 1;
    for (let i = 0; i < 2; i++) {
      const ad = sadelestir(this.ayarlar.takimlar[i].ad);
      if (ad && (s === ad || ilk === ad)) return i;
    }
    return -1;
  }

  // ------------------------------------------------------------ oyuncu ve asker
  oyuncuAl(k, demo) {
    let o = this.oyuncular.get(k.id);
    if (!o) {
      o = {
        id: k.id,
        ad: String(k.ad || k.id),
        foto: k.foto || '',
        takim: -1, // son oynadığı takım
        tercih: -1, // yorumla seçtiği takım
        puan: 0,
        ilkPuanZamani: Infinity,
        oldurme: 0,
        asker: null,
        donusZamani: 0,
        hazir: null,
        hazirZamani: 0,
        kalkanBirikimi: 0,
        biriken: 0, // küçük hediyelerden birikip mermiye dönüşecek jeton
        begeniKredi: SABIT.begeniSaniyeSiniri,
        begeniZaman: this.saat,
        sonYorum: -99,
        sonDegisim: -999,
        takipVerdi: false,
        paylasimSayisi: 0,
        demo: Boolean(demo),
      };
      this.oyuncular.set(k.id, o);
    } else {
      if (k.foto && !o.foto) o.foto = k.foto;
      if (k.ad && k.ad !== o.ad) o.ad = String(k.ad); // TikTok'ta adını değiştirdiyse
    }
    return o;
  }

  // Ekranda görünecek ad (süzgeç açıksa küfürlü adlar "İzleyici" olur)
  adGoster(o) {
    return this.ayarlar.adSuzgeci ? adSuz(o.ad) : o.ad;
  }

  fotoGoster(o) {
    if (!o.foto) return '';
    if (this.ayarlar.adSuzgeci && adSuz(o.ad) !== o.ad) return '';
    return o.foto;
  }

  puanEkle(o, p) {
    if (p <= 0 || o.bot) return; // botlar puan almaz
    if (o.puan === 0) o.ilkPuanZamani = this.saat;
    o.puan += p;
  }

  hedefTakim(o) {
    return o.tercih !== -1 ? o.tercih : this.kucukTakim();
  }

  // Oyuncuyu bir takıma sok. zorla: hediye atan sınırı aşabilir (en fazla +10)
  oyunaAl(o, t, { zorla = false, sessiz = false } = {}) {
    if (o.asker) return true;
    const tk = this.takimlar[t];
    const sinir = this.ayarlar.maksAsker + (zorla ? 10 : 0);
    o.takim = t;
    if (tk.askerler.length >= sinir && !o.bot) {
      // takım doluysa bir bot gerçek izleyiciye yer açar
      const botId = [...tk.askerler].reverse().find((id) => this.oyuncular.get(id)?.bot);
      if (botId) this.botCikar(this.oyuncular.get(botId));
    }
    if (tk.askerler.length >= sinir) {
      if (o.bot) return false;
      if (!tk.sira.includes(o.id)) tk.sira.push(o.id);
      return false;
    }
    tk.sira = tk.sira.filter((id) => id !== o.id);
    o.asker = { can: SABIT.can, kalkan: Math.min(SABIT.kalkanTavan, o.kalkanBirikimi), tacKullanildi: false, sonraki: this.saat + rastgele(0.5, 2, this.r) };
    o.kalkanBirikimi = 0;
    tk.askerler.push(o.id);
    if (tk.sonSansBitis) {
      tk.sonSansBitis = 0;
      this.fxEkle({ tip: 'bildirim', metin: `${this.ayarlar.takimlar[t].ad.toLocaleUpperCase('tr-TR')} KURTULDU!`, renk: this.ayarlar.takimlar[t].renk, sure: 1.8 });
    }
    this.fxEkle({ tip: 'giris', id: o.id, takim: t });
    if (!sessiz) this.fxEkle({ tip: 'akis', metin: `❤️ ${this.adGoster(o)} → ${this.ayarlar.takimlar[t].ad}`, renk: this.ayarlar.takimlar[t].renk });
    return true;
  }

  // Beğeniyle / yorumla giriş denemesi
  girisDene(o, t) {
    if (o.asker) return false;
    if (this.asama === 'ara') {
      if (o.hazir === null) {
        o.hazir = t;
        o.hazirZamani = this.saat;
      }
      return false;
    }
    if (this.saat < o.donusZamani) return false;
    return this.oyunaAl(o, t);
  }

  // Askerin öldürülmesi. kalkan → taç → ölüm. Ölürse true.
  vur(kurban, katil, { silah = false, hasar = 0, atis = 0 } = {}) {
    const a = kurban.asker;
    if (!a) return false;
    if (!silah) {
      a.can -= hasar;
      this.fxEkle({ tip: 'darbe', id: kurban.id, hasar: Math.round(hasar), katil: katil?.id });
      if (a.can > 0) return false;
    }
    if (a.kalkan > 0) {
      a.kalkan -= 1;
      a.can = Math.max(a.can, 40);
      this.fxEkle({ tip: 'kalkanKirildi', id: kurban.id });
      return false;
    }
    if (this.ayarlar.kaptanTaci && !a.tacKullanildi && this.kaptanMi(kurban)) {
      a.tacKullanildi = true;
      a.can = Math.max(a.can, 40);
      this.fxEkle({ tip: 'tacKirildi', id: kurban.id });
      return false;
    }
    this.oldur(kurban, katil, silah, atis);
    return true;
  }

  oldur(kurban, katil, silah, atis = 0) {
    const t = kurban.takim;
    const tk = this.takimlar[t];
    tk.askerler = tk.askerler.filter((id) => id !== kurban.id);
    kurban.asker = null;
    kurban.donusZamani = this.saat + this.ayarlar.donusSuresi;
    this.fxEkle({ tip: 'olum', id: kurban.id, takim: t, silah: silah || 'kilic', katil: katil?.id || null, atis });
    if (katil && !katil.bot) {
      katil.oldurme += 1;
      this.puanEkle(katil, 1);
    }
    this.takimlar[1 - t].dusurme += 1;
    // sırada bekleyen varsa yerine geçer
    while (tk.sira.length && tk.askerler.length < this.ayarlar.maksAsker) {
      const sonraki = this.oyuncular.get(tk.sira.shift());
      if (sonraki && !sonraki.asker && sonraki.takim === t) this.oyunaAl(sonraki, t);
    }
  }

  // ------------------------------------------------------------ botlar
  // İzleyici azken her takımda en az "botSayisi" asker olsun; gerçek izleyici geldikçe botlar çekilir.
  botlariDuzenle() {
    const a = this.ayarlar;
    for (let t = 0; t < 2; t++) {
      const tk = this.takimlar[t];
      const gercek = tk.askerler.filter((id) => !this.oyuncular.get(id)?.bot).length;
      const botlar = tk.askerler.filter((id) => this.oyuncular.get(id)?.bot);
      const istenen = a.botlar ? Math.max(0, Math.min(a.botSayisi, a.maksAsker) - gercek) : 0;
      // fazla botlar sessizce çekilir (en son gelen önce)
      for (let i = botlar.length - 1; i >= istenen; i--) this.botCikar(this.oyuncular.get(botlar[i]));
      // eksik botlar eklenir: önce dönme süresi dolmuş eski botlar, yoksa yenisi
      let eksik = istenen - Math.min(botlar.length, istenen);
      for (const o of this.oyuncular.values()) {
        if (eksik <= 0) break;
        if (o.bot && o.takim === t && !o.asker && this.saat >= o.donusZamani) {
          if (this.oyunaAl(o, t, { sessiz: true })) eksik--;
        }
      }
      let deneme = 0;
      while (eksik > 0 && deneme++ < 30) {
        const o = this.oyuncuAl({ id: `bot_${++this.botSayaci}`, ad: `🤖 Bot ${this.botSayaci}` });
        o.bot = true;
        o.takim = t;
        if (this.oyunaAl(o, t, { sessiz: true })) eksik--;
        else break;
      }
    }
  }

  botCikar(o) {
    if (!o || !o.bot || !o.asker) return;
    const tk = this.takimlar[o.takim];
    tk.askerler = tk.askerler.filter((id) => id !== o.id);
    o.asker = null;
    this.fxEkle({ tip: 'botCikti', id: o.id });
  }

  // ------------------------------------------------------------ olaylar
  olay(e) {
    if (!e || !e.tur) return;
    if (e.demo) this.demoVerisi = true;
    this.sonOlay = this.saat;
    if (this.asama === 'duraklat') return;
    const k = e.kullanici;
    if (!k || !k.id) return;
    if (e.tur === 'giris') return; // odaya girmek oyuna sokmaz, beğeni gerekir
    const o = this.oyuncuAl(k, e.demo);

    switch (e.tur) {
      case 'begeni':
        return this.begeni(o, Math.max(1, Number(e.adet) || 1));
      case 'yorum':
        return this.yorum(o, String(e.metin || ''));
      case 'hediye':
        return this.hediye(o, e.hediye || {}, Math.max(1, Number(e.adet) || 1));
      case 'takip':
        if (o.takipVerdi) return;
        o.takipVerdi = true;
        if (o.asker) o.asker.kalkan = Math.min(SABIT.kalkanTavan, o.asker.kalkan + 1);
        else o.kalkanBirikimi = Math.min(SABIT.kalkanTavan, o.kalkanBirikimi + 1);
        this.fxEkle({ tip: 'kalkan', id: o.id });
        this.fxEkle({ tip: 'akis', metin: `➕ ${this.adGoster(o)} takip etti · 🛡️ kalkan`, renk: '#a3e635' });
        return;
      case 'paylasim':
        if (o.paylasimSayisi >= SABIT.paylasimTurSiniri || o.takim === -1) return;
        o.paylasimSayisi += 1;
        this.ofkeEkle(o.takim, SABIT.paylasimOfke);
        this.fxEkle({ tip: 'akis', metin: `🔁 ${this.adGoster(o)} paylaştı · takım öfkesi +${SABIT.paylasimOfke}`, renk: '#a3e635' });
        return;
      default:
    }
  }

  // Her "begeniHedefi" beğenide bir Çılgın An (savaş dışında dolarsa savaş başlayınca)
  begeniHedefiSay(adet) {
    const hedef = this.ayarlar.begeniHedefi;
    if (!hedef) return;
    this.begeniSayaci += Math.max(0, Math.min(adet, 1000));
    if (this.begeniSayaci < hedef) return;
    this.begeniSayaci -= hedef;
    this.fxEkle({ tip: 'hedef' });
    if (this.asama === 'savas' || this.asama === 'uzatma') {
      this.cilginBitis = Math.max(this.cilginBitis, this.saat) + SABIT.cilginSureHedef;
      this.fxEkle({ tip: 'bildirim', metin: '❤️ BEĞENİ HEDEFİ! Çılgın An: çift hasar', renk: '#f9a8d4', sure: 2.5 });
    } else {
      this.cilginBekliyor = true;
      this.fxEkle({ tip: 'bildirim', metin: '❤️ BEĞENİ HEDEFİ! Savaşta Çılgın An başlayacak', renk: '#f9a8d4', sure: 2.5 });
    }
  }

  ofkeEkle(t, m) {
    const tk = this.takimlar[t];
    tk.ofke = Math.min(SABIT.ofkeTavan, tk.ofke + m);
  }

  begeni(o, adet) {
    this.begeniHedefiSay(adet);
    const gecen = this.saat - o.begeniZaman;
    o.begeniZaman = this.saat;
    o.begeniKredi = Math.min(SABIT.begeniSaniyeSiniri * 2, o.begeniKredi + gecen * SABIT.begeniSaniyeSiniri);
    if (this.asama === 'ara') {
      // tur arası: herkes yeni turda çıkacak, beğenen bir sonraki tura hazır yazılır
      if (o.hazir === null) {
        o.hazir = o.asker ? o.takim : this.hedefTakim(o);
        o.hazirZamani = this.saat;
        this.fxEkle({ tip: 'hazir', id: o.id });
      }
      return;
    }
    if (!o.asker) {
      this.girisDene(o, this.hedefTakim(o));
      return;
    }
    const sayilan = Math.min(adet, Math.floor(o.begeniKredi));
    if (sayilan <= 0) return;
    o.begeniKredi -= sayilan;
    o.asker.can = Math.min(SABIT.can, o.asker.can + sayilan * SABIT.begeniCan);
    this.ofkeEkle(o.takim, sayilan * SABIT.begeniOfke);
    this.fxEkle({ tip: 'kalp', id: o.id });
  }

  yorum(o, metin) {
    const t = this.takimEslestir(metin);
    if (t !== -1) {
      o.tercih = t;
      if (this.asama === 'ara') {
        if (o.hazir === null) o.hazirZamani = this.saat;
        o.hazir = t;
        return;
      }
      if (!o.asker) {
        this.girisDene(o, t);
        return;
      }
      if (o.takim !== t && this.saat - o.sonDegisim >= SABIT.degisimAraligi) {
        // takım değiştir: askeri karşı tarafa geçir
        const eski = this.takimlar[o.takim];
        eski.askerler = eski.askerler.filter((id) => id !== o.id);
        const asker = o.asker;
        o.asker = null;
        o.sonDegisim = this.saat;
        if (this.oyunaAl(o, t)) {
          o.asker.can = asker.can;
          o.asker.kalkan = asker.kalkan;
          this.fxEkle({ tip: 'akis', metin: `🔄 ${this.adGoster(o)} → ${this.ayarlar.takimlar[t].ad}`, renk: this.ayarlar.takimlar[t].renk });
        }
      }
      return;
    }
    if (o.asker && this.saat - o.sonYorum >= SABIT.yorumAraligi) {
      o.sonYorum = this.saat;
      this.ofkeEkle(o.takim, SABIT.yorumOfke);
      this.fxEkle({ tip: 'konus', id: o.id });
    }
  }

  hediye(o, h, adet) {
    const a = this.ayarlar;
    const jeton = Math.max(1, Math.round(Number(h.jeton) || 1));
    this.puanEkle(o, jeton * adet);
    const etki = hediyeEtkisi(jeton, a);

    // hediye atan oyunda değilse hemen girer (beklemeden, sıra sınırını aşabilir)
    if (!o.asker) {
      const t = o.takim !== -1 ? o.takim : this.hedefTakim(o);
      if (this.asama === 'ara') {
        if (o.hazir === null) { o.hazir = t; o.hazirZamani = this.saat; }
        o.takim = t;
      } else {
        o.donusZamani = 0;
        this.oyunaAl(o, t, { zorla: true });
      }
    }
    const t = o.takim;
    const hediyeBilgi = { ad: String(h.ad || 'Hediye').slice(0, 30), resim: typeof h.resim === 'string' ? h.resim : '', jeton, adet };

    if (etki.tur === 'kalkan') {
      if (!a.kalkanDirilis) return;
      for (let i = 0; i < adet; i++) {
        if (o.asker) o.asker.kalkan = Math.min(SABIT.kalkanTavan, o.asker.kalkan + 1);
        else o.kalkanBirikimi = Math.min(SABIT.kalkanTavan, o.kalkanBirikimi + 1);
        if (this.asama !== 'ara') this.dirilt(t, o);
      }
      this.fxEkle({ tip: 'kalkan', id: o.id });
      this.fxEkle({ tip: 'akis', metin: `🛡️ ${this.adGoster(o)} · ${hediyeBilgi.ad}${adet > 1 ? ' ×' + adet : ''} → kalkan`, renk: a.takimlar[t].renk });
      // küçük hediyeler birikir: her tüfek tutarında bir mermi atılır
      o.biriken += jeton * adet;
      const mermi = Math.floor(o.biriken / a.tufekJeton);
      if (mermi > 0) {
        o.biriken -= mermi * a.tufekJeton;
        this.silah(o, 'tufek', mermi, true, hediyeBilgi);
      }
      return;
    }
    this.silah(o, etki.tur, etki.kisi * adet, false, hediyeBilgi);
  }

  // Takımdan düşmüş bir arkadaşı geri getir (en son düşen)
  dirilt(t, veren) {
    let enIyi = null;
    for (const p of this.oyuncular.values()) {
      if (p === veren || p.bot || p.asker || p.takim !== t || p.donusZamani <= this.saat) continue;
      if (!enIyi || p.donusZamani > enIyi.donusZamani) enIyi = p;
    }
    if (!enIyi) return;
    enIyi.donusZamani = 0;
    if (this.oyunaAl(enIyi, t, { sessiz: true })) this.fxEkle({ tip: 'dirilis', id: enIyi.id });
  }

  silah(o, tur, kisi, birikimden = false, hediye = null) {
    const t = o.takim;
    const a = this.ayarlar;
    if (this.asama === 'ara') {
      this.bekleyenSilahlar.push({ id: o.id, tur, kisi, hediye });
      this.fxEkle({ tip: 'akis', metin: `${SILAHLAR[tur].ikon} ${this.adGoster(o)} · ${SILAHLAR[tur].ad} yeni turda ateşlenecek`, renk: a.takimlar[t].renk });
      return;
    }
    if (tur === 'ejderha') {
      this.fxEkle({ tip: 'ejderha', id: o.id, takim: t });
      this.fxEkle({ tip: 'kart', id: o.id, takim: t, silah: 'ejderha', dusen: this.takimlar[1 - t].askerler.length, hediye });
      const dusman = this.takimlar[1 - t];
      dusman.sira = [];
      const olenler = [...dusman.askerler];
      olenler.forEach((id, i) => {
        const p = this.oyuncular.get(id);
        if (p) this.oldur(p, null, 'ejderha', i);
      });
      this.fxEkle({ tip: 'oldurme', id: o.id, takim: t, silah: 'ejderha', olenler });
      this.turuBitir(t, 'ejderha', o);
      return;
    }
    const dusman = this.takimlar[1 - t];
    // Her kişi bir atış hakkı. Bomba ön saftan başlar, ok rastgele seçer. Kalkan ya da taç o atışı boşa çıkarır.
    // Hedef sayısı atıştan azsa kalan atışlar ayakta kalanlara tekrar gider.
    let havuz = [];
    let dusen = 0;
    const hedefler = [];
    const olenler = [];
    for (let atis = 0; atis < kisi; atis++) {
      if (!havuz.length) {
        havuz = [...dusman.askerler];
        if (!havuz.length) break;
        if (tur === 'tufek') havuz.sort(() => this.r() - 0.5);
      }
      const id = havuz.shift();
      const p = this.oyuncular.get(id);
      if (!p || !p.asker) { atis--; continue; }
      hedefler.push(id);
      if (this.vur(p, o, { silah: tur, atis: hedefler.length - 1 })) {
        dusen++;
        olenler.push(id);
      }
    }
    this.fxEkle({ tip: tur, id: o.id, takim: t, hedefler, dusen });
    this.fxEkle({ tip: 'oldurme', id: o.id, takim: t, silah: tur, olenler });
    const metin = birikimden
      ? `🔫 ${this.adGoster(o)} · hediyeleri mermi oldu · ${dusen} düştü`
      : `${SILAHLAR[tur].ikon} ${this.adGoster(o)} · ${hediye ? hediye.ad + ' → ' : ''}${SILAHLAR[tur].ad} · ${dusen} düştü`;
    this.fxEkle({ tip: 'akis', metin, renk: a.takimlar[t].renk });
    if (tur === 'bomba') this.fxEkle({ tip: 'kart', id: o.id, takim: t, silah: 'bomba', dusen, hediye });
  }

  // ------------------------------------------------------------ komutlar
  komut(k) {
    switch (k) {
      case 'duraklat':
        if (this.asama !== 'duraklat') { this.oncekiAsama = this.asama; this.asama = 'duraklat'; }
        break;
      case 'devam':
        if (this.asama === 'duraklat') this.asama = this.oncekiAsama || 'savas';
        break;
      case 'turuBitir':
        if (['hazirlik', 'savas', 'uzatma'].includes(this.asama)) this.sureBitti(true);
        break;
      case 'yeniTur':
        this.yeniTur(false);
        break;
      case 'sifirla':
        this.oturumuSifirla();
        break;
      case 'yeniYayin':
        this.galibiyet = [0, 0];
        this.oturumuSifirla();
        break;
      case 'skorSifirla':
        this.galibiyet = [0, 0];
        break;
      case 'cilginAn':
        if (this.asama === 'savas' || this.asama === 'uzatma') this.cilginBaslat();
        break;
      default:
    }
  }

  cilginBaslat() {
    this.cilginBitis = this.saat + SABIT.cilginSure;
    this.sonrakiCilgin = this.saat + SABIT.cilginAralik;
    this.fxEkle({ tip: 'bildirim', metin: '🔥 ÇILGIN AN! Çift hasar', renk: '#fbbf24', sure: 2.5 });
  }

  sureBitti(elle = false) {
    const c0 = this.canli(0), c1 = this.canli(1);
    if (c0 === c1) {
      if (this.asama === 'savas' && !elle) {
        this.asama = 'uzatma';
        this.kalan = SABIT.uzatma;
        this.fxEkle({ tip: 'bildirim', metin: '⏱️ UZATMA! 20 saniye', renk: '#ffffff', sure: 2.5 });
        return;
      }
      return this.turuBitir(-1, 'sure');
    }
    this.turuBitir(c0 > c1 ? 0 : 1, 'sure');
  }

  turuBitir(kazanan, neden, kahraman = null) {
    this.asama = 'ara';
    this.kalan = this.ayarlar.araSuresi;
    this.bitisSaati = this.saat;
    if (kazanan === 0 || kazanan === 1) this.galibiyet[kazanan] += 1;
    this.sonuc = { kazanan, neden, kahraman: kahraman ? { ad: this.adGoster(kahraman), foto: this.fotoGoster(kahraman) } : null, canli: [this.canli(0), this.canli(1)] };
    this.fxEkle({ tip: 'turSonu', kazanan, neden });
  }

  // ------------------------------------------------------------ zaman
  tick(dt) {
    if (this.asama === 'duraklat') return;
    this.saat += dt;
    const s = this.saat;
    const a = this.ayarlar;
    this.kalan -= dt;

    if (this.asama === 'ara') {
      if (this.kalan <= 0) this.yeniTur(false);
      return;
    }
    if (s >= this.botZamani) {
      this.botZamani = s + 0.5;
      this.botlariDuzenle();
    }
    if (this.asama === 'hazirlik') {
      if (this.kalan <= 0) {
        this.asama = 'savas';
        this.kalan = a.turSuresi;
        this.sonrakiCilgin = s + SABIT.cilginAralik;
        this.silahZamani = s + SABIT.silahGecikme;
        this.fxEkle({ tip: 'bildirim', metin: '⚔️ SAVAŞ BAŞLADI!', renk: '#ffffff', sure: 2 });
        if (this.cilginBekliyor) {
          this.cilginBekliyor = false;
          this.cilginBitis = s + SABIT.cilginSureHedef;
        }
      }
      return;
    }

    // savaş / uzatma
    if (this.bekleyenSilahlar.length && s >= this.silahZamani) {
      const liste = this.bekleyenSilahlar.splice(0);
      for (const b of liste) {
        const o = this.oyuncular.get(b.id);
        if (!o) continue;
        if (!o.asker && o.takim !== -1) { o.donusZamani = 0; this.oyunaAl(o, o.takim, { zorla: true }); }
        this.silah(o, b.tur, b.kisi, false, b.hediye);
        if (this.asama === 'ara') return;
      }
    }
    if (a.cilginAn && s >= this.sonrakiCilgin) this.cilginBaslat();

    for (const tk of this.takimlar) tk.ofke = Math.max(0, tk.ofke - SABIT.ofkeSonum * dt);
    if (a.otoSavas) this.dovus();

    // bir takım tükendi mi?
    for (let t = 0; t < 2; t++) {
      const tk = this.takimlar[t];
      if (this.canli(t) === 0 && this.canli(1 - t) > 0) {
        if (!tk.sonSansBitis) {
          tk.sonSansBitis = s + SABIT.sonSans;
          this.fxEkle({ tip: 'sonSans', takim: t });
        } else if (s >= tk.sonSansBitis) {
          tk.sonSansBitis = 0;
          return this.turuBitir(1 - t, 'yok');
        }
      } else if (tk.sonSansBitis && this.canli(t) > 0) tk.sonSansBitis = 0;
    }

    if (this.kalan <= 0) this.sureBitti();
  }

  dovus() {
    const s = this.saat;
    const hiz = SABIT.hizlar[this.ayarlar.oyunHizi] || 1;
    const cilgin = this.cilginBitis > s ? 2 : 1;
    for (let t = 0; t < 2; t++) {
      const dusman = this.takimlar[1 - t];
      if (!dusman.askerler.length) continue;
      const onSaf = this.takimlar[t].askerler.slice(0, SABIT.onSaf);
      for (const id of onSaf) {
        const o = this.oyuncular.get(id);
        if (!o || !o.asker || o.asker.sonraki > s) continue;
        o.asker.sonraki = s + rastgele(...SABIT.vurusAraligi, this.r) / hiz;
        const hedefSayisi = Math.min(SABIT.onSaf, dusman.askerler.length);
        const hedef = this.oyuncular.get(dusman.askerler[Math.floor(this.r() * hedefSayisi)]);
        if (!hedef) continue;
        const hasar = rastgele(...SABIT.hasar, this.r) * (1 + this.takimlar[t].ofke / 100) * cilgin;
        this.fxEkle({ tip: 'kilic', id: o.id, hedef: hedef.id });
        this.vur(hedef, o, { hasar });
        if (!dusman.askerler.length) break;
      }
    }
  }

  // Panel için kısa özet
  ozet() {
    return {
      tur: this.turNo,
      kalan: Math.max(0, Math.ceil(this.kalan)),
      asama: this.asama,
      canli: [this.canli(0), this.canli(1)],
      galibiyet: this.galibiyet,
      kaptanlar: [0, 1].map((t) => this.kaptanlar(t).slice(0, 3).map((o) => ({ ad: this.adGoster(o), puan: o.puan }))),
      demo: this.demoVerisi,
    };
  }
}
