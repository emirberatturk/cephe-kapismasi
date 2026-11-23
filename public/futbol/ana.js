// Futbol Kupası sayfası: sunucudan olayları alır, motoru çalıştırır, çizer.
import { FutbolMotor, kupaDoldur, kupaYukle } from './motor.js';
import { FutbolCizim } from './cizim.js';
import { Ses } from '../oyun/ses.js';
import { Spiker, Yorumcu } from './spiker.js';

const parametre = new URLSearchParams(location.search);
const ONIZLEME = parametre.has('onizleme');
// Sayfa internetten (ör. Netlify) açıldıysa bilgisayardaki oyun sunucusuna bağlanır.
const YEREL = ['127.0.0.1', 'localhost'].includes(location.hostname);
const SUNUCU_PARAM = parametre.get('sunucu') || '';
const SUNUCU = YEREL ? '' : /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(SUNUCU_PARAM) ? SUNUCU_PARAM : 'http://127.0.0.1:5077';
const KAYIT_ANAHTARI = 'futbol-kupasi-oturum-v1';
const FOTO = /^https:\/\/[a-z0-9.-]+\.tiktokcdn(-[a-z]+)?\.com\//i;

const canvas = document.getElementById('oyun');
const ses = new Ses();
let motor = null;
let cizim = null;
let spiker = null;
let yorumcu = null;
const kuyruk = [];
let demoAcik = false;

function boyutla() {
  const oran = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
  canvas.style.width = `${1080 * oran}px`;
  canvas.style.height = `${1920 * oran}px`;
}
window.addEventListener('resize', boyutla);
boyutla();

let durumMetni = 'Oyun sunucusuna bağlanılıyor…';
function durumCiz() {
  if (motor) return;
  const x = canvas.getContext('2d');
  x.fillStyle = '#05070c';
  x.fillRect(0, 0, 1080, 1920);
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '900 56px system-ui, sans-serif';
  x.fillText('⚽ FUTBOL KUPASI', 540, 820);
  x.font = '700 34px system-ui, sans-serif';
  x.fillStyle = '#fca5a5';
  durumMetni.split('\n').forEach((satir, i) => x.fillText(satir, 540, 920 + i * 50, 1000));
  requestAnimationFrame(durumCiz);
}
requestAnimationFrame(durumCiz);

function baslat(ayarlar) {
  motor = new FutbolMotor(ayarlar);
  oturumuYukle();
  cizim = new FutbolCizim(canvas, motor);
  cizim.demoAcik = demoAcik;
  cizim.sesCal = (ad, gecikme) => ses.cal(ad, gecikme);
  ses.acik = ayarlar.ses;
  spiker = new Spiker(ses, SUNUCU);
  spikerAyarla(ayarlar);
  yorumcu = new Yorumcu(motor, spiker);
  cizim.olayDinle = (f) => yorumcu.olay(f);
  requestAnimationFrame(dongu);
}

// ------------------------------------------------------------ oturumu sakla (yalnızca canlı veri)
function oturumuKaydet() {
  if (!motor || motor.demoVerisi || ONIZLEME) return;
  const golculer = [...motor.oyuncular.values()]
    .filter((o) => !o.bot && (o.gol > 0 || o.puan > 0))
    .sort((a, b) => b.gol - a.gol || b.puan - a.puan)
    .slice(0, 300)
    .map((o) => ({ id: o.id, ad: o.ad, foto: o.foto, gol: o.gol, kupaGol: o.kupaGol, puan: o.puan, taraftar: o.taraftar }));
  const kupa = {
    no: motor.kupa.no,
    sira: motor.kupa.sira,
    eslesmeler: motor.kupa.eslesmeler.map((e) => ({ tur: e.tur, ev: e.ev, dep: e.dep, evK: e.evK, depK: e.depK, skor: e.skor, pen: e.pen, kazanan: e.kazanan, kaybeden: e.kaybeden })),
  };
  try {
    localStorage.setItem(KAYIT_ANAHTARI, JSON.stringify({ zaman: Date.now(), takimSayisi: motor.f.takimlar.length, kupalar: motor.kupalar, kupa, golculer }));
  } catch { /* depolama dolu ya da kapalı */ }
}

const tam = (v, min, max) => Math.max(min, Math.min(max, Math.floor(Number(v)) || 0));

function oturumuYukle() {
  if (ONIZLEME) return;
  try {
    const v = JSON.parse(localStorage.getItem(KAYIT_ANAHTARI) || 'null');
    if (!v || Date.now() - v.zaman > 6 * 3600 * 1000) return; // 6 saatten eski oturum yeni yayın sayılır
    const N = motor.f.takimlar.length;
    const ayniTakimlar = v.takimSayisi === N; // takım listesi değiştiyse eski kupa ve kupa sayıları geçersiz
    const takimNo = (x) => (Number.isInteger(x) && x >= -1 && x < N && ayniTakimlar ? x : -1);
    if (ayniTakimlar && Array.isArray(v.kupalar)) motor.kupalar = Array.from({ length: N }, (_, i) => tam(v.kupalar[i], 0, 1e6));
    for (const o of v.golculer || []) {
      if (typeof o.id !== 'string') continue;
      const foto = typeof o.foto === 'string' && FOTO.test(o.foto) ? o.foto : '';
      const p = motor.oyuncuAl({ id: o.id, ad: String(o.ad || o.id).slice(0, 30), foto }, false);
      p.gol = tam(o.gol, 0, 1e6);
      p.kupaGol = tam(o.kupaGol, 0, 1e6);
      p.puan = tam(o.puan, 0, 1e9);
      p.taraftar = takimNo(o.taraftar);
      if (p.gol > 0) p.ilkGolZamani = -1;
      p.sonAktif = -1e9; // yeniden yükleme sonrası kendiliğinden sahaya girmesin
    }
    // yarım kalan kupa: oynanan maçlar korunur, sıradaki maçtan devam edilir
    const k = v.kupa;
    const es = ayniTakimlar && k ? kupaYukle(k.eslesmeler, N) : null;
    if (es) {
      const sira = tam(k.sira, 0, es.length - 1);
      // henüz oynanmamış maçların sonucu ve sonradan dolan takımları temizlenir, yeniden doldurulur
      es.forEach((e, i) => {
        if (i >= sira) Object.assign(e, { skor: null, pen: null, kazanan: -1, kaybeden: -1 });
        if (e.evK) e.ev = -1;
        if (e.depK) e.dep = -1;
      });
      kupaDoldur(es);
      const gecerli = es.slice(0, sira).every((e) => e.kazanan >= 0) && es[sira].ev >= 0 && es[sira].dep >= 0;
      if (gecerli) {
        motor.kupaNo = tam(k.no, 1, 1e6);
        motor.kupa = { no: motor.kupaNo, eslesmeler: es, sira };
      }
    }
    motor.macKur();
  } catch { /* bozuk kayıt: yok say */ }
}

function spikerAyarla(a) {
  if (!spiker) return;
  spiker.acik = Boolean(a.spiker);
  spiker.duzey = (Number(a.spikerSes) || 0) / 100;
}

// Panelde başka oyun seçildiyse o oyunun sayfasına geç
function oyunDegisti(a) {
  if (!a || a.oyunTuru === 'futbol') return false;
  location.replace('oyun.html' + location.search);
  return true;
}

// ------------------------------------------------------------ sunucu bağlantısı
function baglan() {
  const kaynak = new EventSource(SUNUCU + '/olaylar');
  kaynak.onerror = () => {
    if (!motor) durumMetni = 'Oyun sunucusuna bağlanılamadı.\nBilgisayarda baslat.bat açık mı?' + (YEREL ? '' : '\nPanelde "Yayın sayfası adresi" kayıtlı mı?');
    if (cizim) cizim.baglantiYok = true;
  };
  kaynak.onopen = () => {
    if (cizim) cizim.baglantiYok = false;
  };
  kaynak.addEventListener('hazir', (e) => {
    const d = JSON.parse(e.data);
    if (oyunDegisti(d.ayarlar)) return;
    demoAcik = Boolean(d.demo);
    if (!motor) baslat(d.ayarlar);
    else motor.ayarlariGuncelle(d.ayarlar);
    spikerAyarla(d.ayarlar);
    if (cizim) {
      cizim.demoAcik = demoAcik;
      cizim.katalogGuncelle(d.hediyeler);
    }
  });
  kaynak.addEventListener('ayarlar', (e) => {
    const a = JSON.parse(e.data);
    if (oyunDegisti(a)) return;
    if (motor) motor.ayarlariGuncelle(a);
    ses.acik = a.ses;
    spikerAyarla(a);
  });
  kaynak.addEventListener('durum', (e) => {
    const d = JSON.parse(e.data);
    demoAcik = Boolean(d.demo);
    if (cizim) cizim.demoAcik = demoAcik;
  });
  kaynak.addEventListener('hediyeler', (e) => {
    if (cizim) cizim.katalogGuncelle(JSON.parse(e.data));
  });
  kaynak.addEventListener('olay', (e) => {
    if (kuyruk.length < 2000) kuyruk.push(JSON.parse(e.data));
  });
  kaynak.addEventListener('komut', (e) => {
    const { komut } = JSON.parse(e.data);
    if (!motor) return;
    if (komut === 'yeniYayin' || komut === 'sifirla') {
      localStorage.removeItem(KAYIT_ANAHTARI);
      if (cizim) cizim.temizle();
    }
    motor.komut(komut);
  });
}

// ------------------------------------------------------------ ana döngü
let onceki = performance.now();
let sonBildirim = 0;
let sonKayit = 0;
function dongu(simdi) {
  const dt = Math.min(0.1, (simdi - onceki) / 1000);
  onceki = simdi;
  for (let i = 0; i < 50 && kuyruk.length; i++) {
    const o = kuyruk.shift();
    // demodan sonra ilk gerçek olay: demo verisini temizle
    if (!o.demo && motor.demoVerisi) {
      motor.komut('yeniYayin');
      cizim.temizle();
      localStorage.removeItem(KAYIT_ANAHTARI);
    }
    motor.olay(o);
  }
  motor.tick(dt);
  cizim.ciz(dt);
  yorumcu.tick();
  if (!ONIZLEME && simdi - sonBildirim > 1000) {
    sonBildirim = simdi;
    fetch(SUNUCU + '/api/oyun-durumu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Istek': 'tiktok-oyun' },
      body: JSON.stringify(motor.ozet()),
    }).catch(() => {});
  }
  if (simdi - sonKayit > 5000) {
    sonKayit = simdi;
    oturumuKaydet();
  }
  requestAnimationFrame(dongu);
}

// ------------------------------------------------------------ kısayollar (OBS'te "Etkileşim" penceresinde)
window.addEventListener('keydown', (e) => {
  if (!motor) return;
  const tus = e.key.toLowerCase();
  if (tus === ' ') {
    motor.komut(motor.asama === 'duraklat' ? 'devam' : 'duraklat');
    e.preventDefault();
  } else if (tus === 'n') motor.komut('yeniTur');
  else if (tus === 'c') motor.komut('cilginAn');
  else if (tus === 'r' && e.shiftKey) {
    motor.komut('sifirla');
    localStorage.removeItem(KAYIT_ANAHTARI);
  }
});
window.addEventListener('pointerdown', () => ses.hazirla(), { once: true });

baglan();
