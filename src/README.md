# `src/` Klasörü

Uygulama kodunun tamamı `src/` altında toplanacaktır. Katmanlara göre önerilen dizin yapısı aşağıdadır:

```
src/
├── api/             # HTTP, CLI veya diğer giriş noktaları
├── core/            # Domain modelleri ve iş mantığı
└── infrastructure/  # Veritabanı, mesaj kuyruğu, üçüncü parti servis adaptörleri
```

## API katmanı (`api/`)
- İstemciden gelen istekleri alır, doğrular ve `core` katmanındaki servisleri çağırır.
- Framework'e özgü bağımlılıkları bu katmanda izole eder.

## Core katmanı (`core/`)
- Domain kuralları ve use-case implementasyonları burada yaşar.
- Katman bağımsızlığı için soyut portlar ve interface'ler tanımlanır.

## Infrastructure katmanı (`infrastructure/`)
- `core` tarafından tanımlanan portların gerçek implementasyonlarını sağlar.
- Ortak altyapı bileşenleri (örneğin konfigürasyon yükleyicileri, logger, cache) bu bölümde yer alır.

Katmanlar arasında bağımlılık yönü tek yönlüdür: `api -> core <- infrastructure`. `core` katmanı diğer katmanlara doğrudan bağımlı olmamalıdır.
