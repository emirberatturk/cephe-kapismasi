// Kontrol paneli: bağlantı, demo, komutlar, ayarlar ve canlı akış.
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const HAL_METNI = {
    bosta: ['Bağlı değil', ''],
    baglaniyor: ['Bağlanıyor…', 'bekle'],
    bagli: ['Canlı yayına bağlı', 'bagli'],
    yeniden: ['Yeniden bağlanıyor…', 'bekle'],
    kapali: ['Yayın kapandı', 'hata'],
    hata: ['Bağlantı hatası', 'hata'],
  };
  const ASAMA = { hazirlik: 'hazırlık', savas: 'savaş', uzatma: 'UZATMA', ara: 'tur arası', duraklat: 'DURAKLATILDI' };
  let ayarlar = null;
  const kontrol = { sunucu: false, ekran: 0, sayfa: false, tiktok: false, demo: false };
  function kontrolGuncelle() {
    const durum = {
      sunucu: kontrol.sunucu,
      ekran: Date.now() - kontrol.ekran < 4000,
      sayfa: kontrol.sayfa,
      tiktok: kontrol.tiktok,
      demo: !kontrol.demo,
    };
    for (const li of document.querySelectorAll('#kontrolListesi li')) {
      li.classList.toggle('tamam', durum[li.dataset.k]);
      li.classList.toggle('eksik', !durum[li.dataset.k]);
    }
  }
  setInterval(kontrolGuncelle, 1000);

  async function istek(yol, govde, yontem = 'POST') {
    const r = await fetch(yol, {
      method: yontem,
      headers: { 'Content-Type': 'application/json', 'X-Istek': 'tiktok-oyun' },
      body: JSON.stringify(govde || {}),
    });
    let veri = {};
    try { veri = await r.json(); } catch { /* boş */ }
    if (!r.ok || veri.ok === false) throw new Error(veri.hata || `İstek başarısız (${r.status})`);
    return veri;
  }

  // TikTok Türkiye hediyeleri (kademe özeti ve test düğmeleri için)
  const HEDIYELER = [
    ['Gül', 1], ['Kalp', 10], ['Rosa', 10], ['Parfüm', 20], ['Donat', 30], ['Çay', 50], ['Elle Kalp', 100],
    ['Konfeti', 100], ['Sceptre', 150], ['Taç', 199], ['Corgi', 299], ['Elmas aşk yüzüğü', 300], ['Para Tabancası', 500],
  ];
  const tlYaz = (jeton, jetonTL) => `≈ ${Math.round(jeton * jetonTL)} TL`;

  // ------------------------------------------------------------ durum
  function baglantiGoster(b, demo) {
    const [metin, sinif] = HAL_METNI[b.hal] || HAL_METNI.bosta;
    const rozet = $('#baglantiRozet');
    rozet.textContent = b.hal === 'bagli' && b.kullanici ? `@${b.kullanici} · canlı` : metin;
    rozet.className = 'rozet ' + sinif;
    $('#durumMetin').textContent = metin;
    $('#izleyiciMetin').textContent = String(b.izleyici || 0);
    const hata = $('#hataMetin');
    hata.hidden = !b.hata;
    hata.textContent = b.hata || '';
    $('#demoRozet').hidden = !demo;
    $('#demoKutu').checked = Boolean(demo);
    kontrol.tiktok = b.hal === 'bagli';
    kontrol.demo = Boolean(demo);
    kontrolGuncelle();
  }

  function oyunGoster(o) {
    if (!o || !ayarlar || !o.canli) return;
    kontrol.ekran = Date.now();
    for (let t = 0; t < 2; t++) {
      const kutu = $(`#t${t}`);
      kutu.style.borderColor = ayarlar.takimlar[t].renk;
      kutu.querySelector('.tad').textContent = ayarlar.takimlar[t].ad;
      kutu.querySelector('.tad').style.color = ayarlar.takimlar[t].renk;
      kutu.querySelector('.tgal').textContent = String(o.galibiyet[t]);
      kutu.querySelector('.task').textContent = `${o.canli[t]} asker`;
      const kap = o.kaptanlar?.[t] || [];
      kutu.querySelector('.tkap').textContent = kap.length ? `👑 ${kap.map((k) => k.ad).join(', ')} · ${kap[0].puan} puan` : '👑 kaptan yok';
    }
    const dk = `${Math.floor(o.kalan / 60)}:${String(o.kalan % 60).padStart(2, '0')}`;
    $('#turMetin').textContent = `${o.tur}. tur · ${ASAMA[o.asama] || o.asama} · ${dk}${o.demo ? ' · DEMO verisi' : ''}`;
    const toplam = o.canli[0] + o.canli[1];
    const cubuk = $('#cepheCubuk');
    cubuk.style.width = `${toplam ? (100 * o.canli[0]) / toplam : 50}%`;
    cubuk.style.background = ayarlar.takimlar[0].renk;
    cubuk.parentElement.style.background = ayarlar.takimlar[1].renk;
  }

  function akisEkle(o) {
    const li = document.createElement('li');
    if (o.demo) li.className = 'demo';
    const zaman = document.createElement('span');
    zaman.className = 'zaman';
    zaman.textContent = new Date().toLocaleTimeString('tr-TR');
    const metin = document.createElement('span');
    const ad = o.kullanici?.ad || 'İzleyici';
    metin.textContent = {
      yorum: `💬 ${ad}: ${o.metin}`,
      begeni: `❤️ ${ad} ×${o.adet}`,
      hediye: `🎁 ${ad} · ${o.hediye?.ad} (${o.hediye?.jeton} jeton)${o.adet > 1 ? ' ×' + o.adet : ''}`,
      takip: `➕ ${ad} takip etti`,
      paylasim: `🔁 ${ad} paylaştı`,
      giris: `👋 ${ad} geldi`,
    }[o.tur] || o.tur;
    li.append(zaman, metin);
    const liste = $('#akis');
    liste.prepend(li);
    while (liste.children.length > 80) liste.lastChild.remove();
  }

  // ------------------------------------------------------------ ayarlar formu
  function cevrimleriGuncelle() {
    const jt = Number($('#jetonTL').value) || 0.6;
    const e = { tufek: Number($('#tufekJeton').value) || 0, bomba: Number($('#bombaJeton').value) || 0, ejderha: Number($('#ejderhaJeton').value) || 0 };
    for (const ad of ['tufek', 'bomba', 'ejderha']) $(`#${ad}TLyazi`).textContent = e[ad] > 0 ? tlYaz(e[ad], jt) : '';
    const grup = (alt, ust) => HEDIYELER.filter(([, j]) => j >= alt && j < ust).map(([ad, j]) => `${ad} ${j}`).join(', ') || '—';
    $('#kademeOzeti').textContent =
      `🛡️ Kalkan: ${grup(1, e.tufek)} · 🔫 Tüfek: ${grup(e.tufek, e.bomba)} · 💣 Bomba: ${grup(e.bomba, e.ejderha)} · 🐉 Ejderha: ${grup(e.ejderha, Infinity)}`;
  }

  function hediyeDugmeleri() {
    const hd = $('#hediyeDugmeler');
    hd.replaceChildren();
    for (const [ad, jt] of [['Gül', 1], ['Parfüm', 20], ['Çay', 50], ['Elle Kalp', 100], ['Corgi', 299], ['Elmas aşk yüzüğü', 300], ['Para Tabancası', 500]]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dugme kucuk';
      b.textContent = `🎁 ${ad} (${jt})`;
      b.dataset.test = JSON.stringify({ tur: 'hediye', jeton: jt, hediye: ad });
      hd.append(b);
    }
  }

  function ayarlariDoldur(a) {
    ayarlar = a;
    if (a.kullanici && !$('#kullanici').value) $('#kullanici').value = '@' + a.kullanici;
    if (document.activeElement !== $('#yayinSayfasi')) $('#yayinSayfasi').value = a.yayinSayfasi || '';
    kontrol.sayfa = Boolean(a.yayinSayfasi);
    for (let t = 0; t < 2; t++) {
      $(`#t${t}ad`).value = a.takimlar[t].ad;
      $(`#t${t}renk`).value = a.takimlar[t].renk;
    }
    for (const k of ['tufekJeton', 'bombaJeton', 'bombaKisi', 'ejderhaJeton', 'jetonTL', 'hazirlik', 'turSuresi', 'araSuresi', 'donusSuresi', 'maksAsker', 'begeniHedefi', 'botSayisi']) $('#' + k).value = a[k];
    for (const k of ['oyunHizi', 'profilFoto']) $('#' + k).value = a[k];
    for (const k of ['botlar', 'otoSavas', 'kalkanDirilis', 'kaptanTaci', 'cilginAn', 'adSuzgeci', 'ses']) $('#' + k).checked = a[k];
    cevrimleriGuncelle();
    hediyeDugmeleri();
  }

  function formdanAyar() {
    const sayi = (id) => Number($('#' + id).value);
    return {
      takimlar: [0, 1].map((t) => ({ ad: $(`#t${t}ad`).value, renk: $(`#t${t}renk`).value })),
      tufekJeton: sayi('tufekJeton'),
      bombaJeton: sayi('bombaJeton'),
      bombaKisi: sayi('bombaKisi'),
      ejderhaJeton: sayi('ejderhaJeton'),
      jetonTL: sayi('jetonTL'),
      hazirlik: sayi('hazirlik'),
      turSuresi: sayi('turSuresi'),
      araSuresi: sayi('araSuresi'),
      donusSuresi: sayi('donusSuresi'),
      maksAsker: sayi('maksAsker'),
      begeniHedefi: sayi('begeniHedefi'),
      botSayisi: sayi('botSayisi'),
      botlar: $('#botlar').checked,
      oyunHizi: $('#oyunHizi').value,
      profilFoto: $('#profilFoto').value,
      otoSavas: $('#otoSavas').checked,
      kalkanDirilis: $('#kalkanDirilis').checked,
      kaptanTaci: $('#kaptanTaci').checked,
      cilginAn: $('#cilginAn').checked,
      adSuzgeci: $('#adSuzgeci').checked,
      ses: $('#ses').checked,
    };
  }

  // ------------------------------------------------------------ olaylar
  $('#baglanForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = $('#baglanDugme');
    d.disabled = true;
    d.textContent = 'Bağlanıyor…';
    try {
      await istek('/api/baglan', { kullanici: $('#kullanici').value });
    } catch (hata) {
      $('#hataMetin').hidden = false;
      $('#hataMetin').textContent = hata.message;
    } finally {
      d.disabled = false;
      d.textContent = 'Bağlan';
    }
  });
  $('#kesDugme').addEventListener('click', () => istek('/api/kes').catch(() => {}));
  $('#yayinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const deger = $('#yayinSayfasi').value.trim();
    try {
      const r = await istek('/api/ayarlar', { yayinSayfasi: deger }, 'PUT');
      ayarlariDoldur(r.ayarlar);
      $('#yayinDurum').textContent = r.ayarlar.yayinSayfasi
        ? `Kaydedildi ✓ ${r.ayarlar.yayinSayfasi} artık oyun olaylarını okuyabilir.`
        : deger ? 'Geçersiz adres: https:// ile başlayan bir Netlify adresi yapıştır.' : 'Yayın sayfası kapatıldı.';
    } catch (hata) {
      $('#yayinDurum').textContent = 'Kaydedilemedi: ' + hata.message;
    }
  });
  $('#demoKutu').addEventListener('change', (e) => istek('/api/demo', { acik: e.target.checked }).catch(() => {}));
  for (const id of ['jetonTL', 'tufekJeton', 'bombaJeton', 'ejderhaJeton']) $('#' + id).addEventListener('input', cevrimleriGuncelle);
  $('#kopyala').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#obsUrl').textContent);
      $('#kopyala').textContent = 'Kopyalandı';
      setTimeout(() => ($('#kopyala').textContent = 'Kopyala'), 1500);
    } catch { /* pano izni yok */ }
  });
  document.addEventListener('click', (e) => {
    const komut = e.target.closest('[data-komut]');
    if (komut) {
      if (komut.dataset.onay && !confirm(komut.dataset.onay)) return;
      istek('/api/komut', { komut: komut.dataset.komut }).catch(() => {});
      return;
    }
    const test = e.target.closest('[data-test]');
    if (test) istek('/api/test', { ...JSON.parse(test.dataset.test), ad: $('#testAd').value }).catch(() => {});
  });
  $('#ayarForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#kayitMetin');
    try {
      const r = await istek('/api/ayarlar', formdanAyar(), 'PUT');
      ayarlariDoldur(r.ayarlar);
      m.textContent = 'Kaydedildi ✓ (geçersiz değerler sınırlara çekildi)';
    } catch (hata) {
      m.textContent = 'Kaydedilemedi: ' + hata.message;
    }
    setTimeout(() => (m.textContent = ''), 4000);
  });

  // TikTok LIVE Studio 'localhost' yazımını kabul etmiyor, sayısal adres her yerde çalışır
  $('#obsUrl').textContent = `http://127.0.0.1:${location.port || 80}/oyun`;

  // ------------------------------------------------------------ canlı bağlantı
  const kaynak = new EventSource('/olaylar');
  kaynak.addEventListener('hazir', (e) => {
    const d = JSON.parse(e.data);
    kontrol.sunucu = true;
    ayarlariDoldur(d.ayarlar);
    baglantiGoster(d.baglanti, d.demo);
    oyunGoster(d.oyun);
  });
  kaynak.addEventListener('durum', (e) => {
    const d = JSON.parse(e.data);
    baglantiGoster(d.baglanti, d.demo);
  });
  kaynak.addEventListener('ayarlar', (e) => ayarlariDoldur(JSON.parse(e.data)));
  kaynak.addEventListener('oyun', (e) => oyunGoster(JSON.parse(e.data)));
  let begeniSayaci = 0;
  kaynak.addEventListener('olay', (e) => {
    const o = JSON.parse(e.data);
    if (o.tur === 'begeni' && begeniSayaci++ % 5) return; // beğeniler çok sık gelir
    akisEkle(o);
  });
  kaynak.onerror = () => {
    kontrol.sunucu = false;
    kontrolGuncelle();
    $('#baglantiRozet').textContent = 'Sunucu kapalı mı?';
    $('#baglantiRozet').className = 'rozet hata';
  };
})();
