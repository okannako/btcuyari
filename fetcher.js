// =============================================================================
//  fetcher.js — Veri Çekici
//  Bybit spot/futures mum verisi, funding rate, Fear & Greed endeksi
// =============================================================================

const https = require('https');
const { config } = require('./config');

// ─── HTTP YARDIMCI ────────────────────────────────────────────────────────────

function httpGet(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`JSON parse hatası: ${data.slice(0, 80)}`)); }
      });
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ─── BYBIT MUM VERİSİ ─────────────────────────────────────────────────────────

/**
 * @param {string} interval  - '5' | '15' | '60' | '240' | 'D'
 * @param {number} limit     - Kaç mum
 * @param {string} category  - 'spot' | 'linear'
 */
async function getCandles(interval, limit = 300, category = 'spot') {
  const url = `${config.bybitBaseUrl}/v5/market/kline?category=${category}&symbol=${config.symbol}&interval=${interval}&limit=${limit}`;
  try {
    const resp = await httpGet(url);
    if (resp.retCode !== 0) throw new Error(resp.retMsg);
    return (resp.result?.list || [])
      .reverse()
      .map(k => ({
        startTime: parseInt(k[0]),
        open:      parseFloat(k[1]),
        high:      parseFloat(k[2]),
        low:       parseFloat(k[3]),
        close:     parseFloat(k[4]),
        volume:    parseFloat(k[5]),
      }));
  } catch (err) {
    console.error(`[Fetcher] Mum hatası (${interval}): ${err.message}`);
    return [];
  }
}

// ─── 24 SAATLIK DEĞİŞİM ───────────────────────────────────────────────────────

async function get24hChange() {
  try {
    const resp = await httpGet(`${config.bybitBaseUrl}/v5/market/tickers?category=spot&symbol=${config.symbol}`);
    const t    = resp.result?.list?.[0];
    if (!t) return null;
    return {
      lastPrice:   parseFloat(t.lastPrice),
      prevPrice24h: parseFloat(t.prevPrice24h),
      change24h:   parseFloat(t.price24hPcnt) * 100, // %
      high24h:     parseFloat(t.highPrice24h),
      low24h:      parseFloat(t.lowPrice24h),
      volume24h:   parseFloat(t.volume24h),
      turnover24h: parseFloat(t.turnover24h),
    };
  } catch (err) {
    console.error(`[Fetcher] 24h ticker hatası: ${err.message}`);
    return null;
  }
}

// ─── FUNDING RATE ─────────────────────────────────────────────────────────────

/**
 * Bybit Linear (USDT Perp) güncel funding rate
 */
async function getFundingRate() {
  try {
    // Güncel funding rate
    const current = await httpGet(
      `${config.bybitBaseUrl}/v5/market/tickers?category=linear&symbol=${config.symbol}`
    );
    const t = current.result?.list?.[0];
    if (!t) return null;

    const rate     = parseFloat(t.fundingRate) * 100;       // % olarak
    const nextTime = parseInt(t.nextFundingTime);

    // Son 8 saatlik geçmiş (1 önceki)
    const hist = await httpGet(
      `${config.bybitBaseUrl}/v5/market/funding/history?category=linear&symbol=${config.symbol}&limit=3`
    );
    const history = (hist.result?.list || []).map(h => parseFloat(h.fundingRate) * 100);

    return {
      rate,           // Güncel oran (%)
      nextTime,       // Sonraki funding zamanı (ms)
      history,        // Son 3 oran
      avg8h: history.length > 0 ? history.reduce((s, v) => s + v, 0) / history.length : rate,
    };
  } catch (err) {
    console.error(`[Fetcher] Funding rate hatası: ${err.message}`);
    return null;
  }
}

// ─── FEAR & GREED INDEX ───────────────────────────────────────────────────────

/**
 * alternative.me — ücretsiz, API key gerektirmez
 */
async function getFearGreed() {
  try {
    const resp  = await httpGet('https://api.alternative.me/fng/?limit=2');
    const list  = resp.data || [];
    if (list.length === 0) return null;

    const latest  = list[0];
    const prev    = list[1] || list[0];

    const value      = parseInt(latest.value);
    const valuePrev  = parseInt(prev.value);
    const label      = latest.value_classification;
    const change     = value - valuePrev;

    return {
      value,
      valuePrev,
      label,
      change,
      emoji: fearGreedEmoji(value),
    };
  } catch (err) {
    console.error(`[Fetcher] Fear & Greed hatası: ${err.message}`);
    return null;
  }
}

function fearGreedEmoji(v) {
  if (v >= 80) return '🤑';
  if (v >= 65) return '😄';
  if (v >= 50) return '🙂';
  if (v >= 40) return '😐';
  if (v >= 25) return '😨';
  return '😱';
}

// ─── OPEN INTEREST ────────────────────────────────────────────────────────────

async function getOpenInterest() {
  try {
    const resp = await httpGet(
      `${config.bybitBaseUrl}/v5/market/open-interest?category=linear&symbol=${config.symbol}&intervalTime=4h&limit=2`
    );
    const list = resp.result?.list || [];
    if (list.length < 2) return null;

    const curr = parseFloat(list[0].openInterest);
    const prev = parseFloat(list[1].openInterest);
    const change = ((curr - prev) / prev) * 100;

    return {
      current: Math.round(curr),
      change:  Math.round(change * 10) / 10,
      rising:  curr > prev,
    };
  } catch (err) {
    console.error(`[Fetcher] Open Interest hatası: ${err.message}`);
    return null;
  }
}

// ─── TOPLU VERİ ÇEK ──────────────────────────────────────────────────────────

/**
 * Tüm verileri paralel olarak çeker
 */
async function fetchAll() {
  const [
    candles15m,
    candles1h,
    candles4h,
    candles1d,
    ticker,
    funding,
    fearGreed,
    openInterest,
  ] = await Promise.allSettled([
    getCandles('15',  300, 'spot'),   // 15dk — RSI & MACD & BB & ATR & Hacim
    getCandles('60',  250, 'spot'),   // 1sa  — EMA200 & orta vadeli & IFVG
    getCandles('240', 100, 'spot'),   // 4sa  — yapı & trend
    getCandles('D',   30,  'spot'),   // Günlük — genel bağlam
    get24hChange(),
    getFundingRate(),
    getFearGreed(),
    getOpenInterest(),
  ]);

  function val(settled) {
    return settled.status === 'fulfilled' ? settled.value : null;
  }

  return {
    candles15m:    val(candles15m)    || [],
    candles1h:     val(candles1h)     || [],
    candles4h:     val(candles4h)     || [],
    candles1d:     val(candles1d)     || [],
    ticker:        val(ticker),
    funding:       val(funding),
    fearGreed:     val(fearGreed),
    openInterest:  val(openInterest),
  };
}

module.exports = {
  fetchAll,
  getCandles,
  get24hChange,
  getFundingRate,
  getFearGreed,
  getOpenInterest,
};
