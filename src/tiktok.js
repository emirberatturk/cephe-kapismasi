// TikTok LIVE bağlantısı: kütüphanenin ham olaylarını oyunun anladığı sade olaylara çevirir.
// Resmî olmayan tiktok-live-connector kullanılır. TikTok şifresi ya da oturum çerezi İSTENMEZ;
// yalnızca herkese açık yayın, kullanıcı adıyla okunur. Kütüphane bağlantı imzası için
// Euler Stream (api.eulerstream.com) adlı aracı servise yayıncı adını/oda kimliğini gönderir.

import { EventEmitter } from 'node:events';
import { turkceAd, hediyeListesiAyikla } from './hediyeler.js';

export function kullaniciAdiTemizle(ham) {
  let v = String(ham ?? '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) {
    try {
      const parca = new URL(v).pathname.split('/').filter(Boolean);
      v = parca.find((p) => p.startsWith('@')) || parca[0] || '';
    } catch {
      return '';
    }
  }
  v = v.replace(/^@+/, '').replace(/\/.*$/, '').trim();
  // TikTok kullanıcı adları: harf, rakam, alt çizgi, nokta; en fazla 24 karakter.
  return /^[A-Za-z0-9._]{1,24}$/.test(v) ? v : '';
}

function sayi(...degerler) {
  for (const d of degerler) {
    if (d === undefined || d === null || d === '') continue;
    const n = Number(d);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

// Ekranda gösterilecek metinleri kısalt, kontrol karakterlerini at.
export function metinTemizle(s, uzunluk = 24) {
  const temiz = String(s ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g, '')
    .trim();
  // emojileri ortadan bölmemek için karakter (kod noktası) bazında kısalt
  const harfler = Array.from(temiz);
  return harfler.length > uzunluk ? harfler.slice(0, uzunluk).join('') : temiz;
}

export function kullaniciCevir(u) {
  if (!u) return null;
  const id = metinTemizle(u.displayId || u.uniqueId || u.id || u.userId || u.nickname, 40);
  if (!id) return null;
  const foto = u.avatarThumb?.urlList?.[0] || u.avatarThumb?.url?.[0] || u.profilePictureUrl || '';
  return {
    id,
    ad: metinTemizle(u.nickname || id, 30) || id,
    // Yalnızca TikTok CDN'den gelen https profil fotoğrafları kabul edilir.
    foto: /^https:\/\/[a-z0-9.-]+\.tiktokcdn(-[a-z]+)?\.com\//i.test(foto) ? foto : '',
  };
}

export function hediyeCevir(d) {
  const g = d.gift || d.giftDetails || {};
  const ek = d.extendedGiftInfo || {};
  const jeton = Math.max(1, sayi(g.diamondCount, ek.diamond_count, ek.diamondCount, d.diamondCount, 1));
  const resimAdaylari = [g.image?.urlList?.[0], g.image?.url?.[0], g.icon?.urlList?.[0], g.giftImage?.urlList?.[0], ek.image?.url_list?.[0]];
  const resim = resimAdaylari.find((u) => typeof u === 'string' && /^https:\/\/[a-z0-9.-]+\.tiktokcdn(-[a-z]+)?\.com\//i.test(u)) || '';
  return {
    id: String(d.giftId || g.id || ''),
    ad: turkceAd(g.name || g.giftName || ek.name || d.giftName || 'Hediye').slice(0, 30),
    resim,
    jeton, // TikTok'ta hediyenin "diamondCount" alanı, hediyenin jeton fiyatıdır.
    seri: g.type === 1 || g.combo === true, // gül gibi art arda gönderilen hediyeler
    tekrar: Math.max(1, sayi(d.repeatCount, d.comboCount, 1)),
    bitti: d.repeatEnd === undefined ? true : Boolean(Number(d.repeatEnd) || d.repeatEnd === true),
    grup: String(d.groupId || ''),
  };
}

// Seri hediyelerde tekrar sayısı birikerek gelir (1,2,3...). Yalnızca artışı sayarız ki
// aynı gül iki kez sayılmasın.
export class SeriSayaci {
  constructor() {
    this.seriler = new Map();
  }
  artis(kullaniciId, h, simdi = Date.now()) {
    if (!h.seri) return h.tekrar; // seri olmayan hediye: her olay bir hediye (tekrar genelde 1)
    const anahtar = `${kullaniciId}:${h.id}:${h.grup}`;
    const onceki = this.seriler.get(anahtar);
    const taze = onceki && simdi - onceki.zaman < 30000 ? onceki.sayi : 0;
    const fark = Math.max(0, h.tekrar - taze);
    if (h.bitti) this.seriler.delete(anahtar);
    else this.seriler.set(anahtar, { sayi: Math.max(taze, h.tekrar), zaman: simdi });
    // eski kayıtları temizle
    if (this.seriler.size > 2000) {
      for (const [k, v] of this.seriler) if (simdi - v.zaman > 60000) this.seriler.delete(k);
    }
    return fark;
  }
  temizle() {
    this.seriler.clear();
  }
}

export class TikTokYoneticisi extends EventEmitter {
  constructor() {
    super();
    this.baglanti = null;
    this.kullanici = '';
    this.durduruldu = true;
    this.deneme = 0;
    this.zamanlayici = null;
    this.sayac = new SeriSayaci();
    this.durum = { hal: 'bosta', kullanici: '', hata: '', izleyici: 0 };
  }

  durumGuncelle(yama) {
    this.durum = { ...this.durum, ...yama };
    this.emit('durum', this.durum);
  }

  async baglan(ham, { otomatik = false } = {}) {
    const kullanici = kullaniciAdiTemizle(ham);
    if (!kullanici) throw new Error('Geçerli bir TikTok kullanıcı adı yaz (ör. @kullaniciadi).');
    await this.kes({ sessiz: true });
    this.durduruldu = false;
    this.kullanici = kullanici;
    if (!otomatik) this.deneme = 0;
    this.durumGuncelle({ hal: 'baglaniyor', kullanici, hata: '' });

    // Kütüphane yalnızca bağlanırken yüklenir; demo modunda internet gerekmez.
    const { TikTokLiveConnection, ControlEvent, WebcastEvent } = await import('tiktok-live-connector');
    const secenekler = { enableExtendedGiftInfo: false, fetchRoomInfoOnConnect: true, processInitialData: false };
    if (process.env.EULER_API_KEY) secenekler.signApiKey = process.env.EULER_API_KEY;
    const b = new TikTokLiveConnection(kullanici, secenekler);
    this.baglanti = b;
    this.olaylariBagla(b, ControlEvent, WebcastEvent);

    try {
      const sonuc = await Promise.race([
        b.connect(),
        new Promise((_, red) => setTimeout(() => red(new Error('Bağlantı 25 saniyede kurulamadı.')), 25000)),
      ]);
      if (this.baglanti !== b) return this.durum; // bu arada başka bağlantı başlatıldı
      this.deneme = 0;
      const odaBilgi = b.roomInfo?.data || {};
      this.durumGuncelle({
        hal: 'bagli',
        hata: '',
        izleyici: sayi(odaBilgi.user_count, odaBilgi.stats?.total_user, sonuc?.viewers, 0),
      });
      this.emit('baglandi', { kullanici, yeni: !otomatik });
      this.hediyeListesiCek(b);
      return this.durum;
    } catch (e) {
      if (this.baglanti === b) {
        this.baglanti = null;
        try { b.removeAllListeners(); await b.disconnect(); } catch { /* yoksay */ }
      }
      const mesaj = this.hataMetni(e);
      this.durumGuncelle({ hal: 'hata', hata: mesaj });
      throw new Error(mesaj);
    }
  }

  // Odanın hediye listesini (ad, jeton, resim) çekmeyi dene; olmazsa sorun değil,
  // resimler yayında gönderilen hediyelerden toplanır.
  async hediyeListesiCek(b) {
    try {
      const yanit = await Promise.race([
        b.fetchAvailableGifts(),
        new Promise((_, red) => setTimeout(() => red(new Error('zaman aşımı')), 15000)),
      ]);
      const liste = hediyeListesiAyikla(yanit);
      if (liste.length) this.emit('hediyeListesi', liste);
    } catch {
      /* hediye listesi alınamadı: oyun etkilenmez */
    }
  }

  async kes({ sessiz = false } = {}) {
    this.durduruldu = true;
    clearTimeout(this.zamanlayici);
    this.zamanlayici = null;
    const b = this.baglanti;
    this.baglanti = null;
    this.sayac.temizle();
    if (b) {
      try { b.removeAllListeners(); } catch { /* yoksay */ }
      try { await b.disconnect(); } catch { /* yoksay */ }
    }
    if (!sessiz) this.durumGuncelle({ hal: 'bosta', hata: '', izleyici: 0 });
  }

  olaylariBagla(b, ControlEvent, WebcastEvent) {
    const yay = (tur, veri) => this.emit('olay', { tur, ...veri });

    b.on(ControlEvent.DISCONNECTED, (bilgi = {}) => {
      if (this.durduruldu || this.baglanti !== b) return;
      this.durumGuncelle({ hal: 'yeniden', hata: `Bağlantı koptu (${bilgi.code ?? '?'}), yeniden deneniyor…` });
      this.yenidenDene();
    });
    b.on(ControlEvent.ERROR, (e) => {
      if (this.baglanti !== b) return;
      const metin = this.hataMetni(e);
      console.error('  TikTok bağlantı uyarısı:', metin);
      // Hediye listesi (resimler) alınamazsa oyun etkilenmez: panelde hata gösterme
      if (/room gifts|gift gallery/i.test(String(e?.info || ''))) return;
      this.durumGuncelle({ hata: metin });
    });

    b.on(WebcastEvent.CHAT, (d) => {
      const k = kullaniciCevir(d?.user);
      const metin = metinTemizle(d?.content ?? d?.comment, 120);
      if (k && metin) yay('yorum', { kullanici: k, metin });
    });
    b.on(WebcastEvent.GIFT, (d) => {
      const k = kullaniciCevir(d?.user);
      if (!k) return;
      const h = hediyeCevir(d);
      const adet = this.sayac.artis(k.id, h);
      if (adet > 0) yay('hediye', { kullanici: k, hediye: { ad: h.ad, jeton: h.jeton, resim: h.resim }, adet: Math.min(adet, 99) });
    });
    b.on(WebcastEvent.LIKE, (d) => {
      const k = kullaniciCevir(d?.user);
      yay('begeni', { kullanici: k, adet: Math.max(1, Math.min(sayi(d?.count, 1), 100)), toplam: sayi(d?.total, 0) });
    });
    b.on(WebcastEvent.FOLLOW, (d) => {
      const k = kullaniciCevir(d?.user);
      if (k) yay('takip', { kullanici: k });
    });
    b.on(WebcastEvent.SHARE, (d) => {
      const k = kullaniciCevir(d?.user);
      if (k) yay('paylasim', { kullanici: k });
    });
    b.on(WebcastEvent.MEMBER, (d) => {
      const k = kullaniciCevir(d?.user);
      if (k) yay('giris', { kullanici: k });
    });
    b.on(WebcastEvent.ROOM_USER, (d) => {
      const izleyici = sayi(d?.total, d?.viewerCount, 0);
      if (izleyici > 0) this.durumGuncelle({ izleyici });
    });
    b.on(WebcastEvent.STREAM_END, () => {
      if (this.baglanti !== b) return;
      this.durumGuncelle({ hal: 'kapali', hata: 'Yayın sona erdi.' });
      this.emit('yayinBitti');
      this.yenidenDene();
    });
  }

  yenidenDene() {
    if (this.durduruldu || !this.kullanici) return;
    if (this.deneme >= 5) {
      this.durumGuncelle({ hal: 'hata', hata: 'Yeniden bağlanılamadı. Panelden "Bağlan" ile tekrar dene.' });
      return;
    }
    this.deneme += 1;
    clearTimeout(this.zamanlayici);
    this.zamanlayici = setTimeout(() => {
      this.zamanlayici = null;
      if (!this.durduruldu) this.baglan(this.kullanici, { otomatik: true }).catch(() => {});
    }, Math.min(30000, 4000 * this.deneme));
  }

  hataMetni(e) {
    // Kütüphanenin hata olayı { info, exception } biçiminde gelir
    const parcalar = [e?.info, e?.exception?.message, e?.message].filter((x) => typeof x === 'string' && x);
    const ham = parcalar.length ? [...new Set(parcalar)].join(' — ') : typeof e === 'string' ? e : 'Bilinmeyen hata';
    const kisa = ham.split('\n')[0].slice(0, 200);
    if (e?.name === 'UserOfflineError' || e?.exception?.name === 'UserOfflineError' || /offline|not live|isn't online/i.test(ham)) {
      return 'Bu hesap şu an canlı yayında değil. Önce yayını aç, sonra Bağlan’a bas.';
    }
    if (/not found|does not exist|invalid unique/i.test(ham)) return 'Kullanıcı bulunamadı, adı kontrol et.';
    if (/rate.?limit|429|too many/i.test(ham)) {
      return 'Aracı imza servisi (Euler) çok fazla deneme dedi. Birkaç dakika bekleyip tekrar dene.';
    }
    if (/sign|signature|euler|401|403/i.test(ham)) return 'Bağlantı imzası alınamadı (Euler servisi). Tekrar dene. Ayrıntı: ' + kisa;
    return kisa;
  }
}
