// =============================================================================
//  telegram.js — BTC Analiz Raporu Gönderici
// =============================================================================

const https = require('https');
const { config } = require('./config');
const {
  rsiLabel, macdLabel, bbLabel,
  trendSummary, overallScore, fmt,
} = require('./indicators');

// ─── TEMEL GÖNDERME ──────────────────────────────────────────────────────────

function sendTelegram(text) {
  if (!config.telegramEnabled) {
    console.log('\n' + '─'.repeat(60));
    console.log('[TELEGRAM-OFF]', text.replace(/<[^>]+>/g, ''));
    console.log('─'.repeat(60) + '\n');
    return Promise.resolve();
  }
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.log('[TG] Token/ChatId eksik — konsola yazılıyor:\n', text.replace(/<[^>]+>/g, ''));
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      chat_id:                  config.telegramChatId,
      text,
      parse_mode:               'HTML',
      disable_web_page_preview: true,
    });

    const req = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${config.telegramBotToken}/sendMessage`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });

    req.on('error',   () => resolve());
    req.setTimeout(10000, () => { req.destroy(); resolve(); });
    req.write(payload);
    req.end();
  });
}

// ─── ZAMAN FORMATI ────────────────────────────────────────────────────────────

function turkeyTime() {
  const d   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function minutesUntil(ms) {
  const diff = ms - Date.now();
  if (diff <= 0) return '0dk';
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return m > 0 ? `${m}dk ${s}s` : `${s}s`;
}

// ─── ANA RAPOR ────────────────────────────────────────────────────────────────

/**
 * @param {Object} analysis  — analyzer.js'den gelen tam analiz objesi
 */
function buildReport(analysis) {
  const a     = analysis;
  const price = a.price;

  // ── Genel skor ──────────────────────────────────────────────────────
  const overall = overallScore({
    price,
    ema200:      a.ema200_1h,
    ema50:       a.ema50_1h,
    rsi:         a.rsi15m,
    macd:        a.macd15m,
    bb:          a.bb15m,
    structure:   a.structure4h,
    fundingRate: a.funding?.rate ?? null,
    fearGreed:   a.fearGreed?.value ?? null,
  });

  // ── Trend özet ──────────────────────────────────────────────────────
  const trend = trendSummary(price, a.ema21_1h, a.ema50_1h, a.ema200_1h);

  // ── Yardımcı label'lar ──────────────────────────────────────────────
  const rsiL  = rsiLabel(a.rsi15m);
  const macdL = macdLabel(a.macd15m);
  const bbL   = bbLabel(a.bb15m);

  // ── Fiyat değişim bilgisi ────────────────────────────────────────────
  const chg24  = a.ticker?.change24h;
  const chgStr = chg24 !== null && chg24 !== undefined
    ? `${chg24 >= 0 ? '+' : ''}${chg24.toFixed(2)}%`
    : '—';
  const chgEmoji = chg24 >= 1.5 ? '🚀' : chg24 >= 0 ? '📈' : chg24 >= -1.5 ? '📉' : '💥';

  // ── Funding rate ─────────────────────────────────────────────────────
  function fundingBlock() {
    if (!a.funding) return '   Veri alınamadı';
    const fr  = a.funding.rate;
    const frE = fr > 0.03 ? '🔴' : fr > 0.01 ? '🟠' : fr < -0.01 ? '🟢' : '🟡';
    const frL = fr > 0.05 ? 'Aşırı Long Yığılımı ⚠️'
              : fr > 0.01 ? 'Long Ağırlıklı'
              : fr < -0.02 ? 'Aşırı Short Yığılımı ⚠️'
              : fr < 0    ? 'Short Ağırlıklı'
              : 'Dengeli';
    const next = a.funding.nextTime ? `Sonraki: ${minutesUntil(a.funding.nextTime)}` : '';
    return `   ${frE} Oran: ${fr >= 0 ? '+' : ''}${fr.toFixed(4)}% — ${frL}\n   ${next}`;
  }

  // ── Fear & Greed ──────────────────────────────────────────────────────
  function fgBlock() {
    if (!a.fearGreed) return '   Veri alınamadı';
    const fg = a.fearGreed;
    const arrow = fg.change > 0 ? '↑' : fg.change < 0 ? '↓' : '→';
    return `   ${fg.emoji} ${fg.value}/100 — ${fg.label} (Önceki: ${fg.valuePrev} ${arrow}${Math.abs(fg.change)})`;
  }

  // ── Open Interest ─────────────────────────────────────────────────────
  function oiBlock() {
    if (!a.openInterest) return '   Veri alınamadı';
    const oi   = a.openInterest;
    const emo  = oi.rising ? '📈' : '📉';
    const sign = oi.change >= 0 ? '+' : '';
    return `   ${emo} ${fmt(oi.current)} BTC (${sign}${oi.change}% / 4sa)`;
  }

  // ── Market yapısı ────────────────────────────────────────────────────
  function structureBlock() {
    const s4h = a.structure4h;
    const s1h = a.structure1h;
    const s4hStr = s4h ? `${s4h.emoji} 4sa: ${s4h.structure}` : '4sa: Veri yok';
    const s1hStr = s1h ? `${s1h.emoji} 1sa: ${s1h.structure}` : '1sa: Veri yok';
    return `   ${s4hStr}\n   ${s1hStr}`;
  }

  // ── IFVG seviyeleri ─────────────────────────────────────────────────
  function ifvgBlock() {
    if (!a.ifvgs || a.ifvgs.length === 0) return '   Aktif IFVG bölgesi yok';
    return a.ifvgs
      .map(z => `   📐 $${fmt(z.low)} — $${fmt(z.high)} (%${z.size} bölge)`)
      .join('\n');
  }

  // ── EMA seviyeleri ───────────────────────────────────────────────────
  function emaBlock() {
    const chk = (val) => val ? (price > val ? '✅' : '❌') : '—';
    const f   = (val) => val ? `$${fmt(val)}` : '—';
    return (
      `         <b>  1 Saat        4 Saat</b>\n` +
      `   EMA21 : ${f(a.ema21_1h).padEnd(12)} ${chk(a.ema21_1h)}  |  ${f(a.ema21_4h).padEnd(12)} ${chk(a.ema21_4h)}\n` +
      `   EMA50 : ${f(a.ema50_1h).padEnd(12)} ${chk(a.ema50_1h)}  |  ${f(a.ema50_4h).padEnd(12)} ${chk(a.ema50_4h)}\n` +
      `   EMA200: ${f(a.ema200_1h).padEnd(12)} ${chk(a.ema200_1h)}  |  ${f(a.ema200_4h).padEnd(12)} ${chk(a.ema200_4h)}`
    );
  }

  // ── Mesaj birleştir ──────────────────────────────────────────────────
  const divider = '─'.repeat(32);

  const msg =
    `₿ <b>BTC ANALİZ RAPORU</b>\n` +
    `🕐 <b>${turkeyTime()}</b>\n` +
    `${divider}\n\n` +

    `💰 <b>FİYAT</b>\n` +
    `   $${fmt(price)} ${chgEmoji} ${chgStr} (24sa)\n` +
    `   En Yüksek: $${fmt(a.ticker?.high24h)} | En Düşük: $${fmt(a.ticker?.low24h)}\n\n` +

    `${divider}\n` +
    `🏆 <b>GENEL DURUM</b>  ${overall.verdictEmoji}\n` +
    `   ${overall.verdict} — Skor: ${overall.score}/100\n\n` +

    `${divider}\n` +
    `📈 <b>TREND ÖZET</b>\n` +
    `   ${trend.emoji} ${trend.text}\n` +
    emaBlock() + '\n\n' +

    `${divider}\n` +
    `🏗️ <b>MARKET YAPISI</b>\n` +
    structureBlock() + '\n\n' +

    `${divider}\n` +
    `📊 <b>MACD (12/26/9) — 15dk</b>\n` +
    `   ${macdL.emoji} ${macdL.text}\n` +
    `   MACD: ${a.macd15m?.macd ?? '—'} | Signal: ${a.macd15m?.signal ?? '—'}\n` +
    `   Histogram: ${a.macd15m?.histogram ?? '—'} ${a.macd15m?.growing ? '↑ Artıyor' : '↓ Azalıyor'}\n\n` +

    `${divider}\n` +
    `📉 <b>BOLLINGER BAND (20,2) — 15dk</b>\n` +
    `   ${bbL.emoji} ${bbL.text}\n` +
    `   Üst: $${fmt(a.bb15m?.upper)} | Orta: $${fmt(a.bb15m?.middle)} | Alt: $${fmt(a.bb15m?.lower)}\n` +
    `   %B: ${a.bb15m?.pctB ?? '—'} | Genişlik: %${a.bb15m?.width ?? '—'}\n\n` +

    `${divider}\n` +
    `🔍 <b>RSI & ATR — 15dk</b>\n` +
    `   ${rsiL.emoji} RSI(14): ${a.rsi15m ?? '—'} — ${rsiL.text}\n` +
    `   ATR(14): $${a.atr15m ? fmt(a.atr15m) : '—'} (%${a.atr15m ? ((a.atr15m / price) * 100).toFixed(2) : '—'})\n\n` +

    `${divider}\n` +
    `🌊 <b>HACİM — 15dk</b>\n` +
    `   ${a.volume?.emoji ?? '📊'} ${a.volume?.mult ?? '—'}x ort. | ${a.volume?.trend ?? '—'}\n\n` +

    `${divider}\n` +
    `⚡ <b>FUNDING RATE (BTCUSDT Perp)</b>\n` +
    fundingBlock() + '\n\n' +

    `${divider}\n` +
    `😱 <b>FEAR & GREED ENDEKSİ</b>\n` +
    fgBlock() + '\n\n' +

    `${divider}\n` +
    `📊 <b>OPEN INTEREST</b>\n` +
    oiBlock() + '\n\n' +

    `${divider}\n` +
    `📐 <b>AKTİF IFVG DESTEKLERİ (1sa)</b>\n` +
    ifvgBlock() + '\n\n' +

    `${divider}\n` +
    `⚠️ <i>Analiz amaçlıdır, yatırım tavsiyesi değildir.</i>`;

  return msg;
}

// ─── HATA BİLDİRİMİ ──────────────────────────────────────────────────────────

function notifyError(err) {
  return sendTelegram(`⚠️ <b>BTC BOT HATA</b>\n\n❌ ${err}\n\n🕐 ${turkeyTime()}`);
}

function notifyStarted() {
  return sendTelegram(
    `🚀 <b>BTC ANALİZ BOTU BAŞLATILDI</b>\n\n` +
    `📊 Sembol: BTCUSDT\n` +
    `⏱️ Rapor: Her ${(config.reportIntervalMs / 60000).toFixed(0)} dakika\n` +
    `📐 Göstergeler: RSI, EMA, MACD, BB, ATR, Market Yapısı, IFVG, Funding, F&G\n\n` +
    `⚠️ <i>Analiz amaçlıdır, işlem açmaz.</i>\n\n` +
    `🕐 ${turkeyTime()}`
  );
}

function notifyStopped() {
  return sendTelegram(`🛑 <b>BTC BOT DURDURULDU</b>\n\n🕐 ${turkeyTime()}`);
}

module.exports = {
  sendTelegram,
  buildReport,
  notifyError,
  notifyStarted,
  notifyStopped,
};
