// Oyun sayfası: sunucudan olayları alır, motoru çalıştırır, çizer.
import { Motor } from './motor.js';
import { Cizim } from './cizim.js';
import { Ses } from './ses.js';

const parametre = new URLSearchParams(location.search);
const ONIZLEME = parametre.has('onizleme'); // önizleme, panele skor bildirmez
// Sayfa internetten (ör. Netlify) açıldıysa bilgisayardaki oyun sunucusuna bağlanır.
const YEREL = ['127.0.0.1', 'localhost'].includes(location.hostname);
const SUNUCU_PARAM = parametre.get('sunucu') || '';
const SUNUCU = YEREL ? '' : /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(SUNUCU_PARAM) ? SUNUCU_PARAM : 'http://127.0.0.1:5077';
const KAYIT_ANAHTARI = 'cephe-kapismasi-oturum-v2';

const canvas = document.getElementById('oyun');
const ses = new Ses();
let motor = null;
let cizim = null;
const kuyruk = [];
let demoAcik = false;

function boyutla() {
  const oran = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
  canvas.style.width = `${1080 * oran}px`;
  canvas.style.height = `${1920 * oran}px`;
}
window.addEventListener('resize', boyutla);
boyutla();

// Oyun başlamadan (sunucuya bağlanmadan) ekranda durum yazısı
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
  x.fillText('⚔️ CEPHE KAPIŞMASI', 540, 820);
  x.font = '700 34px system-ui, sans-serif';
  x.fillStyle = '#fca5a5';
  durumMetni.split('\n').forEach((satir, i) => x.fillText(satir, 540, 920 + i * 50, 1000));
  requestAnimationFrame(durumCiz);
}
requestAnimationFrame(durumCiz);

function baslat(ayarlar) {
  motor = new Motor(ayarlar);
  oturumuYukle();
  cizim = new Cizim(canvas, motor);
  cizim.demoAcik = demoAcik;
  cizim.sesCal = (ad) => ses.cal(ad);
  ses.acik = ayarlar.ses;
  requestAnimationFrame(dongu);
}

// ------------------------------------------------------------ oturumu sakla (yalnızca canlı veri)
function oturumuKaydet() {
  if (!motor || motor.demoVerisi || ONIZLEME) return;
  const oyuncular = [...motor.oyuncular.values()]
    .filter((o) => o.puan > 0 && o.takim !== -1)
    .sort((a, b) => b.puan - a.puan)
    .slice(0, 300)
    .map((o) => ({ id: o.id, ad: o.ad, foto: o.foto, takim: o.takim, puan: o.puan, oldurme: o.oldurme }));
  try {
    localStorage.setItem(KAYIT_ANAHTARI, JSON.stringify({ zaman: Date.now(), galibiyet: motor.galibiyet, oyuncular }));
  } catch { /* depolama dolu ya da kapalı */ }
}

function oturumuYukle() {
  if (ONIZLEME) return;
  try {
    const v = JSON.parse(localStorage.getItem(KAYIT_ANAHTARI) || 'null');
    if (!v || Date.now() - v.zaman > 6 * 3600 * 1000) return; // 6 saatten eski oturum yeni yayın sayılır
    motor.galibiyet = [0, 1].map((i) => Math.max(0, Math.floor(Number(v.galibiyet?.[i]) || 0)));
    for (const o of v.oyuncular || []) {
      if (typeof o.id !== 'string' || (o.takim !== 0 && o.takim !== 1)) continue;
      const foto = typeof o.foto === 'string' && /^https:\/\/[a-z0-9.-]+\.tiktokcdn(-[a-z]+)?\.com\//i.test(o.foto) ? o.foto : '';
      const p = motor.oyuncuAl({ id: o.id, ad: String(o.ad || o.id).slice(0, 24), foto }, false);
      p.takim = o.takim;
      p.puan = Math.max(0, Math.floor(Number(o.puan) || 0));
      p.oldurme = Math.max(0, Math.floor(Number(o.oldurme) || 0));
      if (p.puan > 0) p.ilkPuanZamani = -1; // eşitlikte önce gelenler önde kalsın
    }
  } catch { /* bozuk kayıt: yok say */ }
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
    demoAcik = Boolean(d.demo);
    if (!motor) baslat(d.ayarlar);
    else motor.ayarlariGuncelle(d.ayarlar);
    if (cizim) {
      cizim.demoAcik = demoAcik;
      cizim.katalogGuncelle(d.hediyeler);
    }
  });
  kaynak.addEventListener('ayarlar', (e) => {
    const a = JSON.parse(e.data);
    if (motor) motor.ayarlariGuncelle(a);
    ses.acik = a.ses;
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
  // EventSource koparsa kendisi yeniden bağlanır
}

// ------------------------------------------------------------ ana döngü
let onceki = performance.now();
let sonBildirim = 0;
let sonKayit = 0;
function dongu(simdi) {
  const dt = Math.min(0.1, (simdi - onceki) / 1000);
  onceki = simdi;
  // karede en çok 50 olay
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
  if (tus === ' ') { motor.komut(motor.asama === 'duraklat' ? 'devam' : 'duraklat'); e.preventDefault(); }
  else if (tus === 'n') motor.komut('yeniTur');
  else if (tus === 'c') motor.komut('cilginAn');
  else if (tus === 'r' && e.shiftKey) { motor.komut('sifirla'); localStorage.removeItem(KAYIT_ANAHTARI); }
});
// tarayıcıda sesi açmak için bir tıklama gerekir (OBS'te gerekmez)
window.addEventListener('pointerdown', () => ses.hazirla(), { once: true });

baglan();
