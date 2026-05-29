
# ₿ BTC Analiz Botu v2.0

Her 15 dakikada bir (**:00, :15, :30, :45**) BTCUSDT için kapsamlı teknik analiz raporu hazırlayıp Telegram'a gönderen Node.js botu.

**İşlem açmaz. Sadece analiz yapar.**

---

## 📊 Rapor İçeriği

| Bölüm | Detay |
|---|---|
| 💰 Fiyat | Güncel fiyat, 24 saatlik değişim, yüksek/düşük |
| 🏆 Genel Durum | 0–100 arası bileşik skor ve karar (Güçlü Boğa → Güçlü Ayı) |
| 📈 Trend Özeti | EMA21 / EMA50 / EMA200 — 1 saat ve 4 saat karşılaştırmalı |
| 🏗️ Market Yapısı | HH/HL, LH/LL swing yapısı — 1 saat ve 4 saat |
| 📊 MACD | 12/26/9 — 15dk mumdan, histogram yönü |
| 📉 Bollinger Band | 20/2 — 15dk, %B ve band genişliği |
| 🔍 RSI & ATR | RSI(14) ve ATR(14) — 15dk |
| 🌊 Hacim | Ortalamaya göre çarpan ve trend — 15dk |
| ⚡ Funding Rate | Bybit USDT Perp, sonraki funding saati |
| 😱 Fear & Greed | alternative.me endeksi, günlük değişim |
| 📊 Open Interest | 4 saatlik OI değişimi |
| 📐 IFVG | 1 saatlik grafikte aktif Imbalance Fair Value Gap destek bölgeleri |

---

## 🗂️ Dosya Yapısı

```
btc-bot/
├── index.js        → Ana döngü, zamanlama, graceful shutdown
├── fetcher.js      → Bybit API + Fear & Greed veri çekici
├── analyzer.js     → Ham veriyi analiz objesine dönüştürür
├── indicators.js   → RSI, EMA, MACD, BB, ATR, Market Yapısı, IFVG algoritmaları
├── telegram.js     → Rapor oluşturucu ve Telegram gönderici
├── config.js       → Tüm parametreler (.env'den okur)
├── package.json
├── .env.example    → Ortam değişkeni şablonu
└── README.md
```

---

## 🖥️ Ubuntu 22.04 — Sıfırdan Kurulum

### 1. Sistemi Güncelle

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Node.js 20 Kur

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Doğrula:

```bash
node -v   # v20.x.x görmeli
npm -v    # 10.x.x görmeli
```

### 3. PM2 Kur (arka plan için)

```bash
sudo npm install -g pm2
```

### 4. Projeyi Klonla veya Dosyaları Kopyala

```bash
# GitHub'dan klonlayacaksan:
git clone https://github.com/KULLANICI_ADIN/btc-bot.git
cd btc-bot

# Ya da manuel olarak klasör oluştur:
mkdir ~/btc-bot && cd ~/btc-bot
# Tüm .js ve .json dosyalarını bu klasöre kopyala
```

### 5. Bağımlılıkları Yükle

```bash
npm install
```

### 6. Telegram Bot Oluştur

**Token almak için:**
1. Telegram'da **@BotFather**'ı aç
2. `/newbot` yaz ve adımları takip et
3. Verilen token'ı kopyala: `1234567890:ABCdef...`

**Chat ID almak için:**
1. Telegram'da **@userinfobot**'u aç
2. `/start` yaz
3. Verilen ID'yi kopyala: `987654321`

### 7. Ortam Değişkenlerini Ayarla

```bash
cp .env.example .env
nano .env
```

`.env` içeriği:

```env
TELEGRAM_BOT_TOKEN=buraya_token_yaz
TELEGRAM_CHAT_ID=buraya_chat_id_yaz
TELEGRAM_ENABLED=true
```

Kaydet: `Ctrl+O` → `Enter` → `Ctrl+X`

### 8. Test Olarak Çalıştır

```bash
node index.js
```

Konsol çıktısı şu şekilde başlamalı:

```
╔══════════════════════════════════════════════════════════╗
║   BTC Analiz Botu v2.0                                   ║
╚══════════════════════════════════════════════════════════╝

[i] Veri çekiliyor...
[★] ✅ Rapor gönderildi
[i] === Sonraki rapor: 13:15 ===
```

Telegram'a ilk rapor geldiyse `Ctrl+C` ile durdur ve sonraki adıma geç.

### 9. PM2 ile Arka Planda Sürekli Çalıştır

```bash
# Botu başlat
pm2 start index.js --name btc-bot

# Sistem yeniden başlayınca otomatik çalışsın
pm2 startup
# Çıkan komutu kopyalayıp yapıştır (sudo ile başlar), sonra:
pm2 save

# Durumu kontrol et
pm2 status

# Logları takip et
pm2 logs btc-bot

# Botu durdur
pm2 stop btc-bot

# Botu yeniden başlat
pm2 restart btc-bot
```

---

## ⚙️ Konfigürasyon

Tüm parametreler `config.js` içinde tanımlıdır. `.env` dosyasıyla override edilebilir.

| Parametre | Varsayılan | Açıklama |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | BotFather'dan alınan token |
| `TELEGRAM_CHAT_ID` | — | Mesaj gönderilecek chat ID |
| `TELEGRAM_ENABLED` | `true` | `false` yapılırsa sadece konsola yazar |
| `REPORT_INTERVAL_MS` | `900000` | Rapor aralığı (ms). 15dk = 900000 |

> **Not:** `REPORT_INTERVAL_MS` değiştirilse bile bot her zaman `:00/:15/:30/:45` dakikalarında senkronize çalışır.

---

## 📡 Kullanılan API'ler

| API | Amaç | Ücret |
|---|---|---|
| [Bybit v5](https://bybit-exchange.github.io/docs/v5/intro) | Mum verisi, ticker, funding rate, open interest | Ücretsiz |
| [alternative.me](https://alternative.me/crypto/fear-and-greed-index/) | Fear & Greed endeksi | Ücretsiz |

API key gerektirmez. Bybit public endpoint'leri kullanılır.

---

## 📐 Teknik Göstergeler

### RSI (14)
Momentum göstergesi. 70+ aşırı alım, 30- aşırı satım. **15dk mumdan** hesaplanır.

### EMA (21 / 50 / 200)
Üstel hareketli ortalama. **1 saat ve 4 saat** karşılaştırmalı gösterilir.
- Fiyat EMA200 üstünde → uzun vadeli boğa
- EMA21 > EMA50 > EMA200 sıralaması → güçlü boğa trendi

### MACD (12/26/9)
Trend ve momentum göstergesi. Histogram artıyorsa momentum güçleniyor. **15dk mumdan** hesaplanır.

### Bollinger Band (20/2)
Volatilite bandı. `%B` değeri:
- 80+ → üst banda yakın (aşırı alım riski)
- 20- → alt banda yakın (aşırı satım fırsatı)
- Band daralması → büyük hareket öncesi sessizlik

### ATR (14)
Ortalama gerçek aralık. Volatilite ölçer. **15dk mumdan** hesaplanır.

### Market Yapısı (Swing High/Low)
Her iki yana 5 mum bakarak swing noktaları tespit eder. **1 saat ve 4 saat** gösterilir.
- **HH/HL** → Boğa yapısı (Higher High / Higher Low)
- **LH/LL** → Ayı yapısı (Lower High / Lower Low)
- **LH/HL** → Daralma / Konsolidasyon
- **HH/LL** → Genişleme / Volatil

### IFVG (Imbalance Fair Value Gap)
3'lü mum formasyonunda oluşan boşlukları tespit eder. Fiyatın kırıp üstüne çıktığı ve henüz invalide olmamış bölgeler destek olarak gösterilir. **1 saatlik mumdan** hesaplanır.

### Genel Skor (0–100)
Tüm göstergelerin puanlı ortalaması:

| Skor | Karar |
|---|---|
| 75–100 | 🟢🟢 Güçlü BOĞA |
| 60–74 | 🟢 Boğa Eğilimli |
| 45–59 | 🟡 Nötr / Belirsiz |
| 30–44 | 🔴 Ayı Eğilimli |
| 0–29 | 🔴🔴 Güçlü AYI |

---

## 🔧 Sık Karşılaşılan Sorunlar

**Telegram mesajı gelmiyor:**
```bash
# .env dosyasını kontrol et
cat ~/btc-bot/.env

# Token veya Chat ID'de boşluk olmamalı
# Bot, oluşturulduktan sonra önce sana /start mesajı atılmalı
```

**`Cannot find module` hatası:**
```bash
cd ~/btc-bot && npm install
```

**`Cannot read properties of undefined` hatası:**
Bybit API'ye erişilemiyor olabilir. Sunucunun Bybit'e erişimi olduğunu kontrol et:
```bash
curl https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT
```

**PM2 logları çok büyüdü:**
```bash
pm2 flush          # logları temizle
pm2 install pm2-logrotate  # otomatik rotasyon
```

**Botu güncelledikten sonra:**
```bash
cd ~/btc-bot
git pull           # varsa
pm2 restart btc-bot
```

---

## 📁 Geliştirme

```bash
# Değişiklikleri izleyerek çalıştır (Node 18+)
npm run dev
# (node --watch index.js)
```

---

##Botun Telegrama Yolladığı Uyarı Örneği ve Anlamı
```
## 📊 BTC Rapor Yorumu — 29.05.2026 13:00

---

### 💰 Fiyat Durumu

$73,743 seviyesinde ve 24 saatte sadece +0.27% hareket var. Bu çok düşük bir değişim — piyasa kararsız ve sıkışmış demek. Günün en yüksek ve en düşüğü arasındaki fark yaklaşık $1,370 — ATR ile kıyaslandığında bu normal bir günlük aralık.

---

### 🏆 Genel Durum — Skor 41/100 🔴

Sistem tüm göstergeleri puanlayıp 41 vermiş. 50'nin altı = ayı baskısı ağır basıyor. Ama 30'un üzerinde olması "panik satış" değil, "temkinli bekleme" olarak okunmalı.

---

### 📈 Trend Özeti — Karışık Sinyaller

Burada en önemli tablo bu:

| | 1 Saat | 4 Saat |
|---|---|---|
| EMA21 | ✅ Üstünde | ❌ Altında |
| EMA50 | ❌ Altında | ❌ Altında |
| EMA200 | ❌ Altında | — (veri yok) |

**Yorumu:** Fiyat sadece 1 saatlik EMA21'in üstünde — bu çok zayıf bir pozisyon. Neredeyse tüm önemli ortalamalar fiyatın üzerinde, yani ortalamaların tamamı direnç görevi görüyor. Gerçek anlamda boğa trendi için en azından EMA50'nin de üstüne çıkması gerekir.

4 saatlik EMA200 verisinin gelmemesi botun 4 saatlik mumları yeterli sayıda çekemediğini gösteriyor — 200 mum gerekiyor, zaman içinde düzelir.

---

### 🏗️ Market Yapısı — Çelişkili

- **4 saatlik:** 🟠 HH/LL — Genişleme. Hem yüksekler hem düşükler büyüyor. Yön belli değil, volatilite artıyor, risk yüksek.
- **1 saatlik:** 🟢 HH/HL — Boğa yapısı. Kısa vadede dip yükseltiliyor, toparlanma denemesi var.

**Yorumu:** 1 saatlik yapı umut vaat ediyor ama 4 saatlik yapı henüz onaylamıyor. Kısa vadeli bir sıçrama olabilir ancak orta vadeli trend hâlâ belirsiz.

---

### 📊 MACD — Zayıflayan Yükseliş 🟡

MACD pozitif bölgede (61.24 > Signal 57.05) ama histogram azalıyor (4.19 ↓). Bu şunu söylüyor: yukarı momentum var ama güç kaybediyor. Histogram sıfırın altına geçerse kısa vadeli satış sinyali üretir.

---

### 📉 Bollinger Band — Nötr 🟡

%B: 56.1 — fiyat tam olarak bandın ortasında. Ne yukarıya ne aşağıya baskı var. Genişlik %0.65 ile oldukça dar — bant sıkışmış demek. Bu genellikle yakında büyük bir hareketin habercisidir, ama yönü söylemiyor. MACD veya market yapısıyla birlikte okunmalı.

---

### 🔍 RSI — Nötr+ 🟡

52.6 — ne aşırı alım ne aşırı satım. Fiyat için engel de değil destek de değil. Bekleme bölgesi.

---

### 🌊 Hacim — 0x 📉

Bu çok önemli bir uyarı. Hacim ortalamanın sıfır katı gösteriyor, yani son 15 dakikada anlamlı bir işlem gücü yok. Fiyat yukarı gitse bile hacimsiz yükseliş güvenilmez. Gerçek bir hareket için hacmin en az 1.5x ortalamanın üzerine çıkması lazım.

---

### ⚡ Funding Rate — Dengeli 🟡

+0.0046% — çok düşük ve pozitif. Long pozisyonlar biraz ağır basıyor ama manipülasyon sayılacak seviyede değil. Piyasa aşırı bir yönde pozisyon almamış, bu nötr bir işaret.

---

### 😱 Fear & Greed — 23/100 Extreme Fear

Dün 22'ydi, bugün 23 — yani korku bir miktar azalmış ama hâlâ "aşırı korku" bölgesinde. Tarihsel olarak bu seviyeler orta-uzun vadede iyi alım noktaları olmuştur. Kısa vadede ise piyasanın hâlâ iyimser olmadığını gösteriyor.

---

### 📊 Open Interest — Düşüyor 📉

4 saatte -3.7% — bu önemli. Vadeli işlem pozisyonları kapanıyor demek. Genellikle iki anlama gelir: ya zararlı pozisyonlar tasfiye edildi (sağlıklı), ya da büyük oyuncular piyasadan çekiliyor (temkinli ol). Fiyat aynı anda düşüyorsa ikinci senaryo daha olası.

---

### 📐 IFVG — Aktif Bölge Yok

1 saatlik grafikteki boşluklar ya dolmuş ya invalide olmuş. Bu destek seviyesi anlamında botun tespit edemediği anlamına geliyor, eksik değil sadece şu an aktif bölge yok.

---

### 🎯 Genel Tablo — Ne Söylüyor?

| Zaman Dilimi | Durum |
|---|---|
| Kısa vade (15dk-1sa) | 🟡 Nötr, küçük toparlanma denemesi |
| Orta vade (4sa) | 🔴 Ayı baskısı sürüyor |
| Duygu | 🔴 Aşırı korku, ama dip yakın olabilir |

Özetle: fiyat sıkışmış, hacim çok düşük, büyük ortalamaların altında. Kısa vadeli 1 saatlik yapı toparlanmayı deniyor ama 4 saatlik trend henüz onaylamıyor. Hacimsiz ve düşük OI ortamında ani bir hareket gelebilir — ama yönü şu an belli değil.
```
