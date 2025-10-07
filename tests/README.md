# Testler

Test stratejisi, kod katmanları ile paralel olarak ilerler.

## Dizin yapısı
```
tests/
├── api/             # Uçtan uca ve sözleşme testleri
├── core/            # Birim testleri
└── infrastructure/  # Entegrasyon testleri
```

## Çalıştırma
Test otomasyonu henüz projeye eklenmedi. Kurulum tamamlandığında bu dosya güncellenecektir. Şimdilik aşağıdaki prensiplere uyun:
- Yeni bir özellik eklediğinizde ilgili test dosyalarını oluşturun.
- Test isimleri açıklayıcı ve başarısız olduğunda neyin bozulduğunu anlatacak şekilde olmalı.
- Mock kullanımını minimumda tutun; özellikle `core` katmanında saf fonksiyonlar tercih edin.

Güncel süreçler için `docs/onboarding.md` dosyasını takip edin.
