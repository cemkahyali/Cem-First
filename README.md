# Poster Ratings Overlay Stremio Eklentisi

Stremio kataloglarını IMDb, Rotten Tomatoes ve Metacritic puanlarıyla zenginleştiren hafif bir eklenti sunucusudur. Eklenti, mevcut afişlerin üstüne şık puan rozetleri bindirir ve aynı puan özetini açıklamalara da ekler.

## Özellikler

- 🎯 IMDb, Rotten Tomatoes ve Metacritic puanlarını tek bakışta gösterir.
- 🖼️ Afişlerin üstünde yarı saydam rozet katmanı üretir (SVG tabanlıdır, ek kütüphaneye ihtiyaç duymaz).
- 🧠 Cinemeta kataloğundan gelen verileri bozmadan zenginleştirir.
- ⚙️ OMDb API anahtarı tanımlandığında otomatik çalışır; anahtar olmadığında ise varsayılan afişleri döndürür.
- 🔁 OMDb isteklerini bellek içinde önbelleğe alarak gereksiz trafiği azaltır.

## Gereksinimler

- Node.js 18 veya üstü (depolarda Node 22 kullanılır).
- [OMDb API](https://www.omdbapi.com/apikey.aspx) anahtarı. Ücretsiz anahtar dakikada 1 istek sağlar; yoğun kullanım için ücretli paket tavsiye edilir.

## Kurulum ve Çalıştırma

```bash
# Depoyu kopyalayın ve dizine girin
git clone <repo-url>
cd Cem-First

# (İsteğe bağlı) Bağımlılık kurulumu – bu proje standart Node.js modüllerini kullanır
yarn install # veya npm install

# Sunucuyu API anahtarı ile başlatın
export OMDB_API_KEY=YOUR_KEY
npm start

# Sessiz modda (log çıktısı olmadan) başlatmak için
npm run start:silent
# veya
STARTUP_SILENT=1 npm start
```

Sunucu varsayılan olarak `http://127.0.0.1:7000` adresinde dinler. Farklı bir port için `PORT` ortam değişkenini tanımlayın.

## Docker ile Çalıştırma

Yerelde Node.js kurmak istemiyorsanız hazır Docker imajını kullanabilirsiniz.

```bash
# İmajı derleyin
docker build -t stremio-ratings .

# OMDb anahtarı olmadan çalıştırmak için
docker run --rm -p 7000:7000 stremio-ratings

# Anahtar ile çalıştırmak için
docker run --rm -p 7000:7000 -e OMDB_API_KEY=YOUR_KEY stremio-ratings

# Farklı port istiyorsanız (örnek: 8080)
docker run --rm -p 8080:8080 -e PORT=8080 stremio-ratings
```

Alternatif olarak `docker compose` kullanarak tek komutla hem derleyip hem de çalıştırabilirsiniz:

```bash
# (Opsiyonel) .env dosyasında OMDB_API_KEY veya PORT tanımlayabilirsiniz
docker compose up --build

# Arka planda çalıştırmak için
docker compose up --build -d

# Kaynakları temizlemek için
docker compose down
```

`PORT` değişkeni kapsayıcının dinlediği porta, `HOST_PORT` ise ana makinede yayımlanan porta karşılık gelir. `.env` dosyasında bu değişkenleri düzenleyerek farklı port eşleşmeleri oluşturabilirsiniz.

Kapsayıcı başlatıldıktan sonra `http://127.0.0.1:7000/manifest.json` adresini Stremio istemcisine ekleyerek eklentiyi kullanabilirsiniz. Port eşlemesi değiştiyse uygun portu kullanmayı unutmayın.

## Stremio İçine Ekleme

1. Eklentiyi çalıştırdıktan sonra Stremio istemcisinde **Eklenti Deposu > Kişisel Eklenti Ekle** adımlarını izleyin.
2. Sunucunun `manifest.json` uç noktasını girin. Örneğin yerelde: `http://127.0.0.1:7000/manifest.json`.
3. Eklenti etkinleştirildiğinde katalogda “Enriched · Popüler Filmler/Diziler” satırlarını görebilir ve afişlerin üzerinde puan rozetlerini inceleyebilirsiniz.

## Mimari

- `src/index.js` dosyası tek bir HTTP sunucusu kurar ve Stremio eklenti protokolünün `manifest`, `catalog` ve `meta` uç noktalarını manuel olarak uygular.
- Cinemeta’dan gelen afiş adreslerini değiştirmeden SVG katmanı ile sararak yeni `poster` adresi üretir (data URI). Böylece ek resim işleme kütüphanesine ihtiyaç duyulmaz.
- OMDb yanıtları bellekte önbelleğe alınır, böylece aynı içerik tekrar istendiğinde API limitleri zorlanmaz.

## Ortam Değişkenleri

| Değişken | Açıklama | Varsayılan |
| --- | --- | --- |
| `PORT` | HTTP sunucusunun dinleyeceği port | `7000` |
| `OMDB_API_KEY` | OMDb istekleri için anahtar | (boş, eğer boşsa puanlar eklenmez) |
| `STARTUP_SILENT` | `1/true` ise başlangıç mesajlarını bastırır | `false` |

## Testler

Projede Node.js'in dahili test koşucusu kullanılarak yazılmış küçük bir entegrasyon testi seti bulunur. Testler, sahte `fetch` uygulamalarıyla Cinemeta ve OMDb yanıtlarını taklit ederek sunucunun temel uç noktalarını doğrular.

```bash
npm test
```

Komut, sunucuyu geçici bir portta başlatır ve gerçek ağ bağlantısı gerektirmeden katalog ve meta uç noktalarının zenginleştirilmiş yanıtlarını kontrol eder.

## Sınırlar

- OMDb API anahtarı olmadan puan bilgisi üretilemez; eklenti bu durumda Cinemeta’daki afişleri olduğu gibi gönderir.
- OMDb’nin ücretsiz katmanı yoğun katalog taramalarında hızla limit aşabilir. Sunucuyu canlı ortamda kullanmadan önce önbellek stratejisi genişletilebilir.
- Cinemeta servisine ulaşılamazsa eklenti örnek bir katalog ile yanıt verir ve bu katalogda yer alan öğeler için hazır puanlar kullanılır.

## Lisans

Bu proje [MIT lisansı](LICENSE) ile lisanslanmıştır.
