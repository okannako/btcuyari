// =============================================================================
//  config.js — BTC Durum Analiz Botu
// =============================================================================
require('dotenv').config();

const config = {
  // ─── Telegram ──────────────────────────────────────────────────────────────
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId:   process.env.TELEGRAM_CHAT_ID   || '',
  telegramEnabled:  process.env.TELEGRAM_ENABLED !== 'false',

  // ─── Bybit ─────────────────────────────────────────────────────────────────
  bybitBaseUrl: 'https://api.bybit.com',
  symbol:       'BTCUSDT',

  // ─── Raporlama ─────────────────────────────────────────────────────────────
  reportIntervalMs: parseInt(process.env.REPORT_INTERVAL_MS) || 15 * 60 * 1000, // 15 dk

  // ─── Gösterge Parametreleri ────────────────────────────────────────────────
  rsiPeriod:    14,
  ema200Period: 200,
  ema50Period:  50,
  ema21Period:  21,

  macdFast:   12,
  macdSlow:   26,
  macdSignal: 9,

  bbPeriod: 20,
  bbStdDev: 2,

  atrPeriod: 14,

  // ─── Market Yapısı ─────────────────────────────────────────────────────────
  // Swing high/low tespiti için her iki yana kaç mum bakılsın
  swingLookback: 5,

  // ─── IFVG ──────────────────────────────────────────────────────────────────
  ifvgLookback: 100,
  ifvgMaxAge:   80,
  ifvgMinSize:  0.03, // %0.03 minimum bölge büyüklüğü
};

function validateConfig() {
  const ok = config.telegramBotToken && config.telegramChatId;
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   BTC Analiz Botu — Konfigürasyon                ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Sembol      : ${config.symbol.padEnd(34)}║`);
  console.log(`║  Rapor       : Her ${(config.reportIntervalMs/60000).toFixed(0)} dakika${' '.repeat(24)}║`);
  console.log(`║  Telegram    : ${(ok ? 'Aktif ✅' : 'Kapalı ❌ — konsola yazılır').padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
}

module.exports = { config, validateConfig };
