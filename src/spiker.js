// Spiker sesi: metni bilgisayarın kendi Türkçe sesiyle (Windows "Microsoft Tolga") WAV'a çevirir.
// İnternet gerekmez, metin bilgisayardan dışarı çıkmaz. Tek bir PowerShell süreci açık kalır,
// her cümleyi sırayla seslendirir. Metin PowerShell'e base64 olarak verilir (komut olarak yorumlanmaz).

import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { metinTemizle } from './tiktok.js';

const BETIK = String.raw`
$ErrorActionPreference = 'Stop'
try {
  $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1' })[0]
  $sentez = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
  $ses = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -eq 'tr-TR' } | Select-Object -First 1
} catch {
  [Console]::Out.WriteLine('{"hazir":false,"hata":"Windows konusma bileseni yok"}')
  exit 0
}
if (-not $ses) {
  [Console]::Out.WriteLine('{"hazir":false,"hata":"Turkce ses yok"}')
  exit 0
}
$sentez.Voice = $ses
function Bekle($islem, [Type]$tur) { $t = $asTask.MakeGenericMethod($tur).Invoke($null, @($islem)); $null = $t.Wait(-1); $t.Result }
[Console]::Out.WriteLine('{"hazir":true}')
[Console]::Out.Flush()
while ($true) {
  $satir = [Console]::In.ReadLine()
  if ($null -eq $satir) { break }
  $no = 0
  try {
    $i = $satir | ConvertFrom-Json
    $no = [int]$i.id
    $metin = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$i.b64))
    $sentez.Options.SpeakingRate = [double]$i.hiz
    $akis = Bekle ($sentez.SynthesizeTextToStreamAsync($metin)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    $okuyucu = New-Object Windows.Storage.Streams.DataReader($akis.GetInputStreamAt(0))
    $boy = [uint32]$akis.Size
    $null = Bekle ($okuyucu.LoadAsync($boy)) ([uint32])
    $bayt = New-Object byte[] $boy
    $okuyucu.ReadBytes($bayt)
    $okuyucu.Dispose()
    $akis.Dispose()
    [Console]::Out.WriteLine('{"id":' + $no + ',"veri":"' + [Convert]::ToBase64String($bayt) + '"}')
  } catch {
    [Console]::Out.WriteLine('{"id":' + $no + ',"hata":"sentez"}')
  }
  [Console]::Out.Flush()
}
`;

const hata = (mesaj, kod = 503) => Object.assign(new Error(mesaj), { kod });

// Seslendirilecek metin: kontrol karakterleri atılır, en fazla 160 harf
export function spikerMetni(v) {
  return metinTemizle(typeof v === 'string' ? v : '', 160);
}

export class Seslendirici {
  constructor({ hiz = 1.15, platform = process.platform, dakikaSiniri = 90 } = {}) {
    this.hiz = hiz;
    this.platform = platform;
    this.dakikaSiniri = dakikaSiniri;
    this.durum = platform === 'win32' ? 'kapali' : 'yok'; // kapali | basliyor | hazir | yok
    this.sebep = platform === 'win32' ? '' : 'Bilgisayar sesi yalnızca Windows\'ta var';
    this.onbellek = new Map(); // metin -> Buffer (en son kullanılan sonda)
    this.onbellekBoyut = 0;
    this.yolda = new Map(); // metin -> Promise (aynı cümle iki kez üretilmesin)
    this.bekleyen = new Map(); // id -> { coz, red, zaman }
    this.sayac = 0;
    this.son = []; // son bir dakikadaki üretim zamanları
    this.surec = null;
    this.hazirSozu = null;
  }

  get destekli() {
    return this.durum !== 'yok';
  }

  baslat() {
    if (this.hazirSozu) return this.hazirSozu;
    if (this.durum === 'yok') return Promise.reject(hata(this.sebep));
    this.durum = 'basliyor';
    this.hazirSozu = new Promise((coz, red) => {
      const kodlu = Buffer.from(BETIK, 'utf16le').toString('base64');
      let surec;
      try {
        surec = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', kodlu], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      } catch (e) {
        this.durum = 'yok';
        this.sebep = 'PowerShell açılamadı';
        red(hata(this.sebep));
        return;
      }
      this.surec = surec;
      const zamanAsimi = setTimeout(() => {
        red(hata('Ses motoru açılmadı'));
        this.kapat();
      }, 20000);
      zamanAsimi.unref?.();
      surec.stdout.setEncoding('utf8');
      const satirlar = readline.createInterface({ input: surec.stdout, crlfDelay: Infinity });
      satirlar.on('line', (satir) => {
        let v;
        try {
          v = JSON.parse(satir);
        } catch {
          return;
        }
        if ('hazir' in v) {
          clearTimeout(zamanAsimi);
          if (v.hazir) {
            this.durum = 'hazir';
            coz();
          } else {
            this.durum = 'yok';
            this.sebep = v.hata === 'Turkce ses yok' ? 'Bilgisayarda Türkçe ses yok (Ayarlar → Zaman ve dil → Konuşma)' : 'Windows konuşma bileşeni yok';
            red(hata(this.sebep));
          }
          return;
        }
        const b = this.bekleyen.get(v.id);
        if (!b) return;
        this.bekleyen.delete(v.id);
        if (v.veri) b.coz(Buffer.from(v.veri, 'base64'));
        else b.red(hata('Seslendirilemedi', 500));
      });
      surec.on('error', () => {
        clearTimeout(zamanAsimi);
        this.durum = 'yok';
        this.sebep = 'PowerShell açılamadı';
        red(hata(this.sebep));
      });
      surec.on('exit', () => {
        clearTimeout(zamanAsimi);
        for (const b of this.bekleyen.values()) b.red(hata('Ses motoru kapandı'));
        this.bekleyen.clear();
        this.surec = null;
        this.hazirSozu = null;
        if (this.durum !== 'yok') this.durum = 'kapali'; // bir sonraki istekte yeniden açılır
      });
    });
    this.hazirSozu.catch(() => {});
    return this.hazirSozu;
  }

  onbellegeKoy(metin, veri) {
    this.onbellek.set(metin, veri);
    this.onbellekBoyut += veri.length;
    while (this.onbellek.size > 400 || this.onbellekBoyut > 40 * 1024 * 1024) {
      const [ilk, eski] = this.onbellek.entries().next().value;
      this.onbellek.delete(ilk);
      this.onbellekBoyut -= eski.length;
    }
  }

  async seslendir(ham) {
    const metin = spikerMetni(ham);
    if (!metin) throw hata('Boş metin', 400);
    const kayitli = this.onbellek.get(metin);
    if (kayitli) {
      this.onbellek.delete(metin); // en son kullanılan sona
      this.onbellek.set(metin, kayitli);
      return { tur: 'audio/wav', veri: kayitli };
    }
    if (this.yolda.has(metin)) return this.yolda.get(metin);
    const simdi = Date.now();
    this.son = this.son.filter((t) => simdi - t < 60000);
    if (this.son.length >= this.dakikaSiniri) throw hata('Çok fazla seslendirme isteği', 429);
    this.son.push(simdi);
    const is = (async () => {
      await this.baslat();
      const veri = await new Promise((coz, red) => {
        const id = ++this.sayac;
        const zaman = setTimeout(() => {
          if (this.bekleyen.delete(id)) red(hata('Seslendirme zaman aşımı', 504));
        }, 10000);
        zaman.unref?.();
        this.bekleyen.set(id, {
          coz: (v) => { clearTimeout(zaman); coz(v); },
          red: (e) => { clearTimeout(zaman); red(e); },
        });
        const b64 = Buffer.from(metin, 'utf8').toString('base64');
        this.surec.stdin.write(JSON.stringify({ id, b64, hiz: this.hiz }) + '\n');
      });
      this.onbellegeKoy(metin, veri);
      return { tur: 'audio/wav', veri };
    })();
    this.yolda.set(metin, is);
    try {
      return await is;
    } finally {
      this.yolda.delete(metin);
    }
  }

  kapat() {
    if (this.surec) {
      try {
        this.surec.stdin.end();
        this.surec.kill();
      } catch { /* zaten kapalı */ }
    }
    this.surec = null;
    this.hazirSozu = null;
  }
}
