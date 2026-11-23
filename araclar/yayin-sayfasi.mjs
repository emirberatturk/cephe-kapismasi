// Netlify'a yüklenecek oyun sayfası klasörünü (yayin-sayfasi/) hazırlar.
// İçinde yalnızca oyun ekranının dosyaları olur: ayar, veri, sunucu kodu ya da gizli bilgi yoktur.
// Sayfa açıldığında bu bilgisayardaki oyun sunucusuna (http://127.0.0.1:5077) bağlanır.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HEDEF = path.join(KOK, 'yayin-sayfasi');
const PORT = Number(process.env.PORT) || 5077;

const DOSYALAR = [
  ['oyun.html', 'index.html'],
  ['oyun.html', 'oyun.html'],
  ['oyun.css', 'oyun.css'],
  ['favicon.svg', 'favicon.svg'],
  ['oyun/ana.js', 'oyun/ana.js'],
  ['oyun/motor.js', 'oyun/motor.js'],
  ['oyun/cizim.js', 'oyun/cizim.js'],
  ['oyun/ses.js', 'oyun/ses.js'],
  ['futbol.html', 'futbol.html'],
  ['futbol/ana.js', 'futbol/ana.js'],
  ['futbol/motor.js', 'futbol/motor.js'],
  ['futbol/cizim.js', 'futbol/cizim.js'],
  ['futbol/spiker.js', 'futbol/spiker.js'],
];

fs.rmSync(HEDEF, { recursive: true, force: true });
fs.mkdirSync(path.join(HEDEF, 'oyun'), { recursive: true });
fs.mkdirSync(path.join(HEDEF, 'futbol'), { recursive: true });
for (const [kaynak, hedef] of DOSYALAR) fs.copyFileSync(path.join(KOK, 'public', kaynak), path.join(HEDEF, hedef));

const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  `connect-src 'self' http://127.0.0.1:${PORT} http://localhost:${PORT}`,
  "img-src 'self' data: https://*.tiktokcdn.com https://*.tiktokcdn-us.com https://*.tiktokcdn-eu.com",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
fs.writeFileSync(
  path.join(HEDEF, '_headers'),
  `/*\n  Content-Security-Policy: ${csp}\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Cache-Control: no-cache\n`,
  'utf8'
);

console.log('');
console.log('  Yayın sayfası hazır: ' + HEDEF);
console.log('  Bu klasörü https://app.netlify.com/drop sayfasına sürükleyip bırak.');
console.log('  Netlify\'ın verdiği adresi kontrol panelindeki "Yayın sayfası adresi" kutusuna yapıştır.');
console.log('');
