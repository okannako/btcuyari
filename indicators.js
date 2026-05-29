// =============================================================================
//  indicators.js — Teknik Göstergeler
//  RSI, EMA, MACD, Bollinger Band, ATR, Market Structure, IFVG
// =============================================================================

const { config } = require('./config');

// ─── RSI ──────────────────────────────────────────────────────────────────────

function calculateRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  let avgG = 0, avgL = 0;
  for (let i = 1; i <= period; i++) {
    const ch = candles[i].close - candles[i - 1].close;
    if (ch > 0) avgG += ch; else avgL += Math.abs(ch);
  }
  avgG /= period;
  avgL /= period;
  for (let i = period + 1; i < candles.length; i++) {
    const ch = candles[i].close - candles[i - 1].close;
    avgG = (avgG * (period - 1) + (ch > 0 ? ch : 0)) / period;
    avgL = (avgL * (period - 1) + (ch < 0 ? Math.abs(ch) : 0)) / period;
  }
  const rsi = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  return Math.round(rsi * 10) / 10;
}

function rsiLabel(rsi) {
  if (rsi === null) return { text: 'Veri yok', emoji: '⚪' };
  if (rsi >= 80)   return { text: 'Aşırı Alım 🔥', emoji: '🔴' };
  if (rsi >= 70)   return { text: 'Aşırı Alım',    emoji: '🟠' };
  if (rsi >= 60)   return { text: 'Güçlü Alım',    emoji: '🟢' };
  if (rsi >= 50)   return { text: 'Nötr+',          emoji: '🟡' };
  if (rsi >= 40)   return { text: 'Nötr-',          emoji: '🟡' };
  if (rsi >= 30)   return { text: 'Güçlü Satış',   emoji: '🟠' };
  return                  { text: 'Aşırı Satım',    emoji: '🔴' };
}

// ─── EMA ──────────────────────────────────────────────────────────────────────

function calculateEMA(candles, period) {
  if (!candles || candles.length < period) return null;
  const k   = 2 / (period + 1);
  let   ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
  }
  return ema;
}

// ─── MACD ─────────────────────────────────────────────────────────────────────

function calculateMACD(candles, fast = 12, slow = 26, signal = 9) {
  if (!candles || candles.length < slow + signal) return null;

  // EMA serilerini hesapla
  function emaArray(src, period) {
    const k   = 2 / (period + 1);
    const res = new Array(src.length).fill(null);
    let   sum = 0, count = 0;
    for (let i = 0; i < period; i++) { sum += src[i]; count++; }
    res[period - 1] = sum / period;
    for (let i = period; i < src.length; i++) {
      res[i] = src[i] * k + res[i - 1] * (1 - k);
    }
    return res;
  }

  const closes  = candles.map(c => c.close);
  const emaFast = emaArray(closes, fast);
  const emaSlow = emaArray(closes, slow);

  // MACD çizgisi
  const macdLine = emaFast.map((f, i) =>
    f !== null && emaSlow[i] !== null ? f - emaSlow[i] : null
  );

  // Signal çizgisi (MACD'nin EMA'sı)
  const validMacd = macdLine.filter(v => v !== null);
  if (validMacd.length < signal) return null;

  const kS = 2 / (signal + 1);
  let sig  = validMacd.slice(0, signal).reduce((s, v) => s + v, 0) / signal;
  for (let i = signal; i < validMacd.length; i++) {
    sig = validMacd[i] * kS + sig * (1 - kS);
  }

  const lastMACD = macdLine[macdLine.length - 1];
  const prevIdx  = macdLine.length - 2;
  const prevMACD = macdLine[prevIdx];

  const hist     = lastMACD - sig;
  const prevHist = prevMACD !== null ? prevMACD - sig : null; // yaklaşık

  return {
    macd:      Math.round(lastMACD * 100) / 100,
    signal:    Math.round(sig * 100) / 100,
    histogram: Math.round(hist * 100) / 100,
    // Yön: histogram artıyor mu?
    growing:   prevHist !== null ? hist > prevHist : null,
  };
}

function macdLabel(macd) {
  if (!macd) return { text: 'Veri yok', emoji: '⚪' };
  if (macd.histogram > 0 && macd.growing)  return { text: 'Güçlenen Yükseliş', emoji: '🟢' };
  if (macd.histogram > 0 && !macd.growing) return { text: 'Zayıflayan Yükseliş', emoji: '🟡' };
  if (macd.histogram < 0 && macd.growing)  return { text: 'Zayıflayan Düşüş', emoji: '🟡' };
  return                                           { text: 'Güçlenen Düşüş', emoji: '🔴' };
}

// ─── BOLLINGER BAND ───────────────────────────────────────────────────────────

function calculateBB(candles, period = 20, stdDevMult = 2) {
  if (!candles || candles.length < period) return null;

  const slice  = candles.slice(-period);
  const mean   = slice.reduce((s, c) => s + c.close, 0) / period;
  const variance = slice.reduce((s, c) => s + Math.pow(c.close - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper  = mean + stdDevMult * stdDev;
  const lower  = mean - stdDevMult * stdDev;
  const price  = candles[candles.length - 1].close;
  const width  = ((upper - lower) / mean) * 100; // Band genişliği (%)
  const pctB   = (price - lower) / (upper - lower) * 100; // %B (0-100)

  return {
    upper:  Math.round(upper * 100) / 100,
    middle: Math.round(mean  * 100) / 100,
    lower:  Math.round(lower * 100) / 100,
    width:  Math.round(width * 100) / 100,
    pctB:   Math.round(pctB  * 10)  / 10,
  };
}

function bbLabel(bb) {
  if (!bb) return { text: 'Veri yok', emoji: '⚪' };
  if (bb.pctB > 95)  return { text: 'Üst Banda Yapışık — Güçlü Trend / Aşırı Alım', emoji: '🔴' };
  if (bb.pctB > 80)  return { text: 'Üst Banda Yakın',    emoji: '🟠' };
  if (bb.pctB > 60)  return { text: 'Orta-Üst Bant Arası', emoji: '🟢' };
  if (bb.pctB > 40)  return { text: 'Orta Bant Civarı',   emoji: '🟡' };
  if (bb.pctB > 20)  return { text: 'Orta-Alt Bant Arası', emoji: '🟡' };
  if (bb.pctB > 5)   return { text: 'Alt Banda Yakın',     emoji: '🟠' };
  return                    { text: 'Alt Banda Yapışık — Güçlü Trend / Aşırı Satım', emoji: '🔴' };
}

// ─── ATR ──────────────────────────────────────────────────────────────────────

function calculateATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const tr   = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low  - prev.close),
    );
    sum += tr;
  }
  return sum / period;
}

// ─── HACIM ANALİZİ ────────────────────────────────────────────────────────────

function analyzeVolume(candles, lookback = 20) {
  if (!candles || candles.length < lookback + 1) return null;
  const recent = candles.slice(-lookback);
  const avg    = recent.reduce((s, c) => s + c.volume, 0) / lookback;
  const last   = candles[candles.length - 1].volume;
  const mult   = avg > 0 ? Math.round((last / avg) * 10) / 10 : 0;

  // Son 5 mumda hacim artıyor mu?
  const last5   = candles.slice(-5).map(c => c.volume);
  const trend   = last5[last5.length - 1] > last5[0] ? 'Artan ↑' : 'Azalan ↓';
  const emoji   = mult >= 2 ? '🔥' : mult >= 1.5 ? '📈' : mult < 0.7 ? '📉' : '📊';

  return { avg: Math.round(avg), last: Math.round(last), mult, trend, emoji };
}

// ─── MARKET YAPISI ────────────────────────────────────────────────────────────

/**
 * Swing high/low tespit ederek HH/HL veya LH/LL yapısı belirler
 */
function detectMarketStructure(candles, lookback = 5) {
  if (!candles || candles.length < lookback * 3) {
    return { structure: 'Yetersiz veri', emoji: '⚪', swingHighs: [], swingLows: [] };
  }

  const swingHighs = [];
  const swingLows  = [];

  // Son 150 mumu tara
  const start = Math.max(lookback, candles.length - 150);
  for (let i = start; i < candles.length - lookback; i++) {
    const win = candles.slice(i - lookback, i + lookback + 1);
    const curr = candles[i];

    // Swing High: penceredeki en yüksek high
    if (win.every(c => c.high <= curr.high)) {
      swingHighs.push({ price: curr.high, time: curr.startTime, index: i });
    }
    // Swing Low: penceredeki en düşük low
    if (win.every(c => c.low >= curr.low)) {
      swingLows.push({ price: curr.low, time: curr.startTime, index: i });
    }
  }

  // Son 3 swing'i al
  const highs = swingHighs.slice(-3);
  const lows  = swingLows.slice(-3);

  if (highs.length < 2 || lows.length < 2) {
    return { structure: 'Yapı oluşuyor', emoji: '🔵', swingHighs, swingLows };
  }

  const lastH = highs[highs.length - 1];
  const prevH = highs[highs.length - 2];
  const lastL = lows[lows.length - 1];
  const prevL = lows[lows.length - 2];

  const hhhl = lastH.price > prevH.price && lastL.price > prevL.price;
  const lhll = lastH.price < prevH.price && lastL.price < prevL.price;
  const lhhl = lastH.price < prevH.price && lastL.price > prevL.price; // daralma
  const hhll = lastH.price > prevH.price && lastL.price < prevL.price; // genişleme

  let structure, emoji, detail;
  if (hhhl) {
    structure = 'HH/HL — Boğa Yapısı';
    emoji     = '🟢';
    detail    = `Yüksek: $${fmt(lastH.price)} | Dip: $${fmt(lastL.price)}`;
  } else if (lhll) {
    structure = 'LH/LL — Ayı Yapısı';
    emoji     = '🔴';
    detail    = `Yüksek: $${fmt(lastH.price)} | Dip: $${fmt(lastL.price)}`;
  } else if (lhhl) {
    structure = 'LH/HL — Daralma (Konsolidasyon)';
    emoji     = '🟡';
    detail    = `Yüksek: $${fmt(lastH.price)} | Dip: $${fmt(lastL.price)}`;
  } else {
    structure = 'HH/LL — Genişleme (Volatil)';
    emoji     = '🟠';
    detail    = `Yüksek: $${fmt(lastH.price)} | Dip: $${fmt(lastL.price)}`;
  }

  return {
    structure,
    emoji,
    detail,
    lastHigh: lastH,
    prevHigh: prevH,
    lastLow:  lastL,
    prevLow:  prevL,
    swingHighs,
    swingLows,
  };
}

// ─── IFVG TESPİT ──────────────────────────────────────────────────────────────

function findKeyIFVGs(candles) {
  const len    = candles.length;
  const result = [];
  const start  = Math.max(2, len - config.ifvgLookback);

  for (let i = start; i < len; i++) {
    if (i < 2) continue;
    const cA = candles[i - 2];
    const cC = candles[i];

    // Bearish FVG boşluğu (bullish retest için destek bölgesi)
    if (cA.low <= cC.high) continue;

    const fvgLow  = cC.high;
    const fvgHigh = cA.low;
    const size    = ((fvgHigh - fvgLow) / fvgLow) * 100;
    if (size < config.ifvgMinSize) continue;

    // Breakout var mı?
    let breakoutIdx = -1;
    for (let j = i + 1; j < len; j++) {
      if (candles[j].close > fvgHigh) { breakoutIdx = j; break; }
    }
    if (breakoutIdx === -1) continue;
    if (len - 1 - breakoutIdx > config.ifvgMaxAge) continue;

    // İnvalidasyon kontrolü
    let invalidated = false;
    for (let j = breakoutIdx + 1; j < len; j++) {
      if (candles[j].close < fvgLow) { invalidated = true; break; }
    }
    if (invalidated) continue;

    result.push({ low: fvgLow, high: fvgHigh, size: parseFloat(size.toFixed(2)) });
  }

  // Fiyata en yakın 2 IFVG bölgesini döndür
  const price = candles[len - 1].close;
  return result
    .sort((a, b) => Math.abs((a.low + a.high) / 2 - price) - Math.abs((b.low + b.high) / 2 - price))
    .slice(0, 3);
}

// ─── TREND ÖZET ───────────────────────────────────────────────────────────────

function trendSummary(price, ema21, ema50, ema200) {
  const above200 = ema200 && price > ema200;
  const above50  = ema50  && price > ema50;
  const above21  = ema21  && price > ema21;
  const ema50AboveEma200 = ema50 && ema200 && ema50 > ema200;

  if (above200 && above50 && above21 && ema50AboveEma200) {
    return { text: 'Güçlü Boğa ↑↑', emoji: '🟢' };
  }
  if (above200 && above50 && ema50AboveEma200) {
    return { text: 'Boğa ↑', emoji: '🟢' };
  }
  if (above200 && !above50) {
    return { text: 'Zayıf Boğa / Düzeltme', emoji: '🟡' };
  }
  if (!above200 && above50) {
    return { text: 'Zayıf Ayı / Toparlanma', emoji: '🟡' };
  }
  if (!above200 && !above50 && !above21) {
    return { text: 'Güçlü Ayı ↓↓', emoji: '🔴' };
  }
  return { text: 'Ayı ↓', emoji: '🔴' };
}

// ─── GENEL DURUM SKORU ────────────────────────────────────────────────────────

/**
 * Tüm sinyalleri birleştirerek 0-100 arasında bir puan üretir.
 * 0 = tam ayı, 100 = tam boğa
 */
function overallScore(data) {
  let score = 50;
  const signals = [];

  // EMA trend
  if (data.price > data.ema200)  { score += 10; signals.push('+EMA200'); }
  else                           { score -= 10; signals.push('-EMA200'); }
  if (data.price > data.ema50)   { score += 8;  signals.push('+EMA50');  }
  else                           { score -= 8;  signals.push('-EMA50');  }

  // RSI
  const rsi = data.rsi;
  if (rsi !== null) {
    if (rsi >= 60)       { score += 7;  signals.push('+RSI'); }
    else if (rsi <= 40)  { score -= 7;  signals.push('-RSI'); }
  }

  // MACD histogram
  if (data.macd) {
    if (data.macd.histogram > 0 && data.macd.growing)   { score += 8; signals.push('+MACD'); }
    else if (data.macd.histogram < 0 && !data.macd.growing) { score -= 8; signals.push('-MACD'); }
    else if (data.macd.histogram > 0)  { score += 3; }
    else                               { score -= 3; }
  }

  // Bollinger Band
  if (data.bb) {
    if (data.bb.pctB > 70) { score += 5; signals.push('+BB'); }
    else if (data.bb.pctB < 30) { score -= 5; signals.push('-BB'); }
  }

  // Market structure
  if (data.structure) {
    if (data.structure.structure.includes('Boğa'))         { score += 7; signals.push('+Yapı'); }
    else if (data.structure.structure.includes('Ayı'))     { score -= 7; signals.push('-Yapı'); }
  }

  // Funding rate
  if (data.fundingRate !== null) {
    const fr = data.fundingRate;
    if (fr > 0.03)        { score -= 5; signals.push('-Funding(aşırı uzun)'); }
    else if (fr < -0.01)  { score += 3; signals.push('+Funding(short baskı)'); }
    else if (fr > 0)      { score += 2; signals.push('+Funding(nötr+)'); }
  }

  // Fear & Greed
  if (data.fearGreed !== null) {
    const fg = data.fearGreed;
    if (fg >= 75)        { score -= 4; signals.push('-F&G(aşırı açgözlülük)'); }
    else if (fg >= 55)   { score += 3; signals.push('+F&G'); }
    else if (fg <= 25)   { score += 4; signals.push('+F&G(aşırı korku)'); }
    else if (fg <= 45)   { score -= 3; signals.push('-F&G'); }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict, verdictEmoji;
  if (score >= 75)      { verdict = 'Güçlü BOĞA';      verdictEmoji = '🟢🟢'; }
  else if (score >= 60) { verdict = 'Boğa Eğilimli';   verdictEmoji = '🟢';   }
  else if (score >= 45) { verdict = 'Nötr / Belirsiz'; verdictEmoji = '🟡';   }
  else if (score >= 30) { verdict = 'Ayı Eğilimli';    verdictEmoji = '🔴';   }
  else                  { verdict = 'Güçlü AYI';       verdictEmoji = '🔴🔴'; }

  return { score, verdict, verdictEmoji, signals };
}

// ─── FORMAT YARDIMCISI ────────────────────────────────────────────────────────

function fmt(n, decimals = 0) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

module.exports = {
  calculateRSI,  rsiLabel,
  calculateEMA,
  calculateMACD, macdLabel,
  calculateBB,   bbLabel,
  calculateATR,
  analyzeVolume,
  detectMarketStructure,
  findKeyIFVGs,
  trendSummary,
  overallScore,
  fmt,
};
