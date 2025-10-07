# Mimari Özeti

Bu dosya Cem-First projesinde izlenecek katmanlı mimariyi açıklar. Kod tabanı henüz başlangıç aşamasında olsa da, burada belirtilen prensipler gelecekteki geliştirmelerin temelini oluşturacaktır.

## Katmanlar

### 1. API katmanı (`src/api/`)
- Uygulamanın dış dünya ile konuştuğu katmandır.
- HTTP uç noktaları, CLI komutları veya planlanan diğer adaptörler burada yer alır.
- Gelen istekleri doğrular, uygun `core` servislerini çağırır ve yanıtları formatlar.
- Harici çerçevelere (ör. Express, FastAPI, gRPC) bağlı kodlar sadece bu katmanda tutulur.

### 2. Core katmanı (`src/core/`)
- Domain kurallarını, iş mantığını ve entity modellerini barındırır.
- Harici kütüphanelere en az bağımlılık ile yazılır.
- `api` ve `infrastructure` katmanları tarafından kullanılan servisler, use-case'ler ve domain event'leri bu alanda konumlanır.
- Testler için öncelikli odak noktasıdır; mantık buraya yazıldığı için birim test yoğunluğu bu katmanda olur.

### 3. Infrastructure katmanı (`src/infrastructure/`)
- Veritabanı, mesaj kuyruğu, üçüncü parti API çağrıları gibi dış bağımlılıkların adaptörlerini içerir.
- `core` katmanının ihtiyaç duyduğu port'ların implementasyonlarını sağlar.
- Konfigürasyon dosyaları, loglama, cache gibi ortak altyapı bileşenleri burada yer alır.

## Veri akışı
1. Kullanıcı isteği `api` katmanına gelir.
2. `api`, isteği doğrular ve gerekli verileri `core` katmanına aktarır.
3. `core`, domain kurallarını çalıştırır ve ihtiyaç duyarsa `infrastructure` katmanındaki adaptörleri kullanır.
4. Sonuç `api` katmanına döner ve uygun formatta istemciye iletilir.

## Test stratejisi
- **Birim testleri**: `core` katmanındaki domain kurallarını kapsar.
- **Entegrasyon testleri**: `infrastructure` adaptörlerinin gerçek servisler veya mocklar ile çalışmasını doğrular.
- **Uçtan uca testler**: `api` katmanının tüm akışı doğru yönettiğini kontrol eder.

## Kod inceleme kontrol listesi
- [ ] Yeni kod ilgili katmanda mı yer alıyor?
- [ ] `core` katmanı doğrudan altyapı detaylarına bağımlı mı? Eğer öyleyse, bağımlılık tersine çevrildi mi?
- [ ] Giriş doğrulamaları `api` katmanında yapıldı mı?
- [ ] Yeni davranış için testler eklendi mi?
- [ ] Dökümantasyon güncellendi mi?

Projede ilerledikçe bu dosya güncellenecek ve yeni kararlar buraya eklenecektir.
