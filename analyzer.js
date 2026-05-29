// =============================================================================
//  analyzer.js — Veriyi analiz objesine dönüştürür
// =============================================================================

const {
  calculateRSI,
  calculateEMA,
  calculateMACD,
  calculateBB,
  calculateATR,
  analyzeVolume,
  detectMarketStructure,
  findKeyIFVGs,
} = require('./indicators');

const { config } = require('./config');

function analyze(data) {
  const {
    candles15m,
    candles1h,
    candles4h,
    candles1d,
    ticker,
    funding,
    fearGreed,
    openInterest,
  } = data;

  const price = ticker?.lastPrice
    ?? (candles15m.length ? candles15m[candles15m.length - 1].close : null);

  // 15dk göstergeler
  const rsi15m  = calculateRSI(candles15m,  config.rsiPeriod);
  const macd15m = calculateMACD(candles15m, config.macdFast, config.macdSlow, config.macdSignal);
  const bb15m   = calculateBB(candles15m,   config.bbPeriod, config.bbStdDev);
  const atr15m  = calculateATR(candles15m,  config.atrPeriod);
  const volume  = analyzeVolume(candles15m);

  // EMA — 1 saatlik
  const ema21_1h  = calculateEMA(candles1h, config.ema21Period);
  const ema50_1h  = calculateEMA(candles1h, config.ema50Period);
  const ema200_1h = calculateEMA(candles1h, config.ema200Period);

  // EMA — 4 saatlik
  const ema21_4h  = calculateEMA(candles4h, config.ema21Period);
  const ema50_4h  = calculateEMA(candles4h, config.ema50Period);
  const ema200_4h = calculateEMA(candles4h, config.ema200Period);

  // Market yapısı
  const structure4h = detectMarketStructure(candles4h, config.swingLookback);
  const structure1h = detectMarketStructure(candles1h, config.swingLookback);

  // IFVG bölgeleri
  const ifvgs = findKeyIFVGs(candles1h);

  // Günlük bağlam
  const rsi1d  = calculateRSI(candles1d, config.rsiPeriod);
  const ema50D = calculateEMA(candles1d, 50);

  return {
    price, ticker, funding, fearGreed, openInterest,
    rsi15m, macd15m, bb15m, atr15m, volume,
    ema21_1h, ema50_1h, ema200_1h,
    ema21_4h, ema50_4h, ema200_4h,
    structure4h, structure1h,
    ifvgs,
    rsi1d, ema50D,
  };
}

module.exports = { analyze };
