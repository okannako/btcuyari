// =============================================================================
//  index.js — BTC Analiz Botu v2.0
//  Her 15 dakikada bir detaylı BTC raporu → Telegram
//  İşlem açmaz, sadece analiz yapar
// =============================================================================

const { config, validateConfig } = require('./config');
const { fetchAll }                = require('./fetcher');
const { analyze }                 = require('./analyzer');
const telegram                    = require('./telegram');

// ─── LOG ──────────────────────────────────────────────────────────────────────

function log(level, msg) {
  const icons = { INFO: '[i]', WARN: '[!]', ERROR: '[X]', REPORT: '[★]' };
  console.log(`[${new Date().toISOString()}] ${icons[level] || '[?]'} ${msg}`);
}

// ─── TEK RAPOR DÖNGÜSÜ ────────────────────────────────────────────────────────

async function runReport() {
  log('REPORT', '─── BTC raporu hazırlanıyor... ───');

  try {
    // 1. Veri çek
    log('INFO', 'Veri çekiliyor...');
    const data = await fetchAll();

    if (!data.candles15m.length && !data.ticker) {
      log('WARN', 'Yeterli veri alınamadı, rapor atlandı');
      return;
    }

    log('INFO', `Veri hazır — 15dk: ${data.candles15m.length} mum | 1sa: ${data.candles1h.length} mum | 4sa: ${data.candles4h.length} mum`);

    // 2. Analiz et
    const analysis = analyze(data);

    log('INFO', `Analiz tamamlandı — Fiyat: $${analysis.price?.toLocaleString()} | RSI: ${analysis.rsi15m} | Yapı: ${analysis.structure4h?.structure}`);

    // 3. Raporu oluştur ve gönder
    const report = telegram.buildReport(analysis);
    await telegram.sendTelegram(report);

    log('REPORT', `✅ Rapor gönderildi — Genel skor yaklaşık hesaplandı`);

  } catch (err) {
    log('ERROR', `Rapor hatası: ${err.message}\n${err.stack}`);
    try {
      await telegram.notifyError(err.message);
    } catch {}
  }
}

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────

function setupShutdown() {
  const shutdown = async (sig) => {
    log('INFO', `🛑 ${sig} — bot kapatılıyor...`);
    await telegram.notifyStopped();
    process.exit(0);
  };

  process.on('SIGINT',             () => shutdown('SIGINT'));
  process.on('SIGTERM',            () => shutdown('SIGTERM'));
  process.on('uncaughtException',  e  => log('ERROR', `Yakalanmamış: ${e.message}`));
  process.on('unhandledRejection', r  => log('ERROR', `Rejection: ${r}`));
}

// ─── ANA BAŞLATMA ─────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   BTC Analiz Botu v2.0                                   ║');
  console.log('║   RSI · EMA · MACD · BB · ATR · Yapı · IFVG             ║');
  console.log('║   Funding Rate · Fear & Greed · Open Interest            ║');
  console.log('║   İşlem AÇMAZ — Her 15 dakika Telegram raporu gönderir  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  validateConfig();
  setupShutdown();

  // Bot başlatıldı bildirimi
  await telegram.notifyStarted();

  // İlk raporu hemen gönder
  log('INFO', '=== İlk rapor gönderiliyor... ===');
  await runReport();

  // ─── :00 :15 :30 :45 zamanlarında rapor gönder ───────────────────────
  function scheduleNextReport() {
    const now     = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const millis  = now.getMilliseconds();

    // Bir sonraki :00/:15/:30/:45 dakikasını hesapla
    const nextQuarter = Math.ceil((minutes + seconds / 60 + millis / 60000) / 15) * 15;
    const diffMs =
      (nextQuarter - minutes) * 60 * 1000
      - seconds * 1000
      - millis
      + 500; // 500ms tolerans — tam dakikada kesin çalışsın

    const nextTime = new Date(now.getTime() + diffMs);
    const pad = n => String(n).padStart(2, '0');
    log('INFO', `=== Sonraki rapor: ${pad(nextTime.getHours())}:${pad(nextTime.getMinutes())} ===`);

    setTimeout(async () => {
      try {
        await runReport();
      } catch (err) {
        log('ERROR', `Rapor hatası: ${err.message}`);
      }
      scheduleNextReport(); // bir sonraki :XX'i planla
    }, diffMs);
  }

  scheduleNextReport();

  // Heartbeat — her dakika konsola yaz
  setInterval(() => {
    log('INFO', `❤️  Bot çalışıyor | ${new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })} TR`);
  }, 60_000);

  log('INFO', '=== BTC Analiz Botu hazır ===');
}

main().catch(err => {
  log('ERROR', `Başlatma hatası: ${err.message}`);
  process.exit(1);
});
