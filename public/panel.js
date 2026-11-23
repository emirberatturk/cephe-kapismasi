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
  const FB_ASAMA = { hazirlik: 'maç öncesi', mac: 'maç', gol: 'GOL', penalti: 'penaltı', seri: 'penaltı atışları', ara: 'maç arası', kupaSonu: 'kupa töreni', duraklat: 'DURAKLATILDI' };
  // Futbolda komut düğmelerinin adları
  const FB_KOMUT = {
    turuBitir: 'Maçı şimdi bitir',
    yeniTur: 'Maçı baştan başlat / sıradaki maça geç',
    cilginAn: '⚽⚽ 2 top (çılgın an)',
    sifirla: ['Kupayı sıfırla', 'Kupa, fikstür ve oyuncular sıfırlansın mı?'],
    skorSifirla: ['Kupa sayılarını ve gol krallarını sıfırla', 'Kupa sayıları ve gol kralları sıfırlansın mı?'],
  };
  const komutAsil = new Map();
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

  function futbolGoster(o) {
    const f = o.futbol;
    const takim = (i) => ayarlar.futbol.takimlar[i] || { ad: '?', kisa: '?', renk: '#64748b' };
    const t = [takim(f.ev), takim(f.dep)];
    for (let i = 0; i < 2; i++) {
      const kutu = $(`#t${i}`);
      kutu.style.borderColor = t[i].renk;
      kutu.querySelector('.tad').textContent = t[i].ad;
      kutu.querySelector('.tad').style.color = '';
      kutu.querySelector('.tgal').textContent = String(f.skor[i]);
      kutu.querySelector('.task').textContent = `${o.canli[i]} oyuncu sahada`;
      kutu.querySelector('.tkap').textContent = i === 0 ? `⚡ güç %${f.guc}` : `⚡ güç %${100 - f.guc}`;
    }
    const dk = f.dakika ? ` · ${f.dakika}'` : '';
    const pen = f.pen ? ` · pen. ${f.pen[0]}-${f.pen[1]}` : '';
    const krallar = f.golKrallari.length ? ` · ⚽ ${f.golKrallari.slice(0, 3).map((k) => `${k.ad} ${k.gol}`).join(', ')}` : '';
    $('#turMetin').textContent = `${ayarlar.futbol.kupaAdi} #${f.kupa} · ${f.macAdi} · ${FB_ASAMA[o.asama] || o.asama}${dk}${pen}${krallar}${o.demo ? ' · DEMO verisi' : ''}`;
    const cubuk = $('#cepheCubuk');
    cubuk.style.width = `${f.guc}%`;
    cubuk.style.background = t[0].renk;
    cubuk.parentElement.style.background = t[1].renk;
  }

  function oyunGoster(o) {
    if (!o || !ayarlar || !o.canli) return;
    kontrol.ekran = Date.now();
    if (o.oyun === 'futbol') {
      if (ayarlar.futbol) futbolGoster(o);
      return;
    }
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
    const fb = { Koruma: Number($('#fbKoruma').value) || 0, SuperSut: Number($('#fbSuperSut').value) || 0, Penalti: Number($('#fbPenalti').value) || 0, Gol: Number($('#fbGol').value) || 0 };
    for (const ad of Object.keys(fb)) $(`#fb${ad}TL`).textContent = fb[ad] > 0 ? tlYaz(fb[ad], jt) : '';
    $('#fbKademe').textContent =
      `💪 Güç: ${grup(1, fb.Koruma)} · 🧤 Koruma: ${grup(fb.Koruma, fb.SuperSut)} · 🔥 Süper şut: ${grup(fb.SuperSut, fb.Penalti)} · 🎯 Penaltı: ${grup(fb.Penalti, fb.Gol)} · ⚡ Gol: ${grup(fb.Gol, Infinity)}`;
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

  // Futbol takım satırları (8 takım: ad, kısa ad, iki renk)
  function futbolSatirlari(n) {
    const kap = $('#fbTakimlar');
    if (kap.children.length === n) return;
    kap.replaceChildren();
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.className = 'fb-takim';
      const ad = Object.assign(document.createElement('input'), { id: `fbT${i}ad`, maxLength: 16 });
      ad.setAttribute('aria-label', `${i + 1}. takım adı`);
      const kisa = Object.assign(document.createElement('input'), { id: `fbT${i}kisa`, maxLength: 5 });
      kisa.setAttribute('aria-label', `${i + 1}. takım kısa adı`);
      const r1 = Object.assign(document.createElement('input'), { id: `fbT${i}renk`, type: 'color' });
      r1.setAttribute('aria-label', `${i + 1}. takım 1. renk`);
      const r2 = Object.assign(document.createElement('input'), { id: `fbT${i}renk2`, type: 'color' });
      r2.setAttribute('aria-label', `${i + 1}. takım 2. renk`);
      s.append(ad, kisa, r1, r2);
      kap.append(s);
    }
  }

  function oyunTuruGoster(tur) {
    for (const r of document.querySelectorAll('input[name=oyunTuru]')) r.checked = r.value === tur;
    const futbol = tur === 'futbol';
    for (const el of document.querySelectorAll('.sadeceCephe')) el.hidden = futbol;
    for (const el of document.querySelectorAll('.sadeceFutbol')) el.hidden = !futbol;
    for (const d of document.querySelectorAll('[data-komut]')) {
      const k = d.dataset.komut;
      if (!komutAsil.has(k)) komutAsil.set(k, [d.textContent, d.dataset.onay]);
      const fb = FB_KOMUT[k];
      const [metin, onay] = futbol && fb ? (Array.isArray(fb) ? fb : [fb, komutAsil.get(k)[1]]) : komutAsil.get(k);
      d.textContent = metin;
      if (onay) d.dataset.onay = onay;
    }
    $('#b3').textContent = futbol ? '3 · Maç durumu' : '3 · Oyun durumu';
  }

  function ayarlariDoldur(a) {
    ayarlar = a;
    oyunTuruGoster(a.oyunTuru);
    const f = a.futbol;
    futbolSatirlari(f.takimlar.length);
    $('#fbKupaAdi').value = f.kupaAdi;
    $('#fbKupaBoyu').value = String(f.kupaBoyu);
    $('#fbKoruma').value = f.korumaJeton;
    $('#fbSuperSut').value = f.superSutJeton;
    $('#fbPenalti').value = f.penaltiJeton;
    $('#fbGol').value = f.golJeton;
    $('#fbMacSuresi').value = f.macSuresi;
    $('#fbHazirlik').value = f.hazirlik;
    $('#fbAra').value = f.araSuresi;
    $('#fbSaha').value = f.sahaOyuncu;
    $('#fbHava').checked = f.hava;
    $('#fbSurpriz').checked = f.surpriz;
    $('#spiker').checked = a.spiker;
    $('#spikerSes').value = a.spikerSes;
    $('#spikerSesYazi').textContent = `%${a.spikerSes}`;
    f.takimlar.forEach((t, i) => {
      $(`#fbT${i}ad`).value = t.ad;
      $(`#fbT${i}kisa`).value = t.kisa;
      $(`#fbT${i}renk`).value = t.renk;
      $(`#fbT${i}renk2`).value = t.renk2;
    });
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
      spiker: $('#spiker').checked,
      spikerSes: sayi('spikerSes'),
      futbol: {
        kupaAdi: $('#fbKupaAdi').value,
        kupaBoyu: $('#fbKupaBoyu').value === 'tum' ? 'tum' : Number($('#fbKupaBoyu').value),
        korumaJeton: sayi('fbKoruma'),
        superSutJeton: sayi('fbSuperSut'),
        penaltiJeton: sayi('fbPenalti'),
        golJeton: sayi('fbGol'),
        macSuresi: sayi('fbMacSuresi'),
        hazirlik: sayi('fbHazirlik'),
        araSuresi: sayi('fbAra'),
        sahaOyuncu: sayi('fbSaha'),
        hava: $('#fbHava').checked,
        surpriz: $('#fbSurpriz').checked,
        takimlar: Array.from({ length: $('#fbTakimlar').children.length }, (_, i) => ({
          ad: $(`#fbT${i}ad`).value,
          kisa: $(`#fbT${i}kisa`).value,
          renk: $(`#fbT${i}renk`).value,
          renk2: $(`#fbT${i}renk2`).value,
        })),
      },
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
  for (const id of ['jetonTL', 'tufekJeton', 'bombaJeton', 'ejderhaJeton', 'fbKoruma', 'fbSuperSut', 'fbPenalti', 'fbGol']) $('#' + id).addEventListener('input', cevrimleriGuncelle);
  $('#spikerSes').addEventListener('input', () => ($('#spikerSesYazi').textContent = `%${$('#spikerSes').value}`));
  for (const r of document.querySelectorAll('input[name=oyunTuru]')) {
    r.addEventListener('change', async () => {
      const durum = $('#oyunDurum');
      try {
        const cevap = await istek('/api/ayarlar', { oyunTuru: r.value }, 'PUT');
        ayarlariDoldur(cevap.ayarlar);
        durum.textContent = `Seçildi ✓ ${r.value === 'futbol' ? 'Futbol Kupası' : 'Cephe Kapışması'}. Açık oyun ekranları birkaç saniye içinde bu oyuna geçer.`;
      } catch (hata) {
        durum.textContent = 'Kaydedilemedi: ' + hata.message;
      }
    });
  }
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
