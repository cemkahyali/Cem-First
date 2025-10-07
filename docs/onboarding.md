# Onboarding Rehberi

Bu doküman, Cem-First kod tabanına yeni katılan geliştiricilerin hızlıca uyum sağlayabilmesi için hazırlanmıştır. Proje henüz erken aşamada olsa da, mimari tercihleri ve iş akışları tanımlanmıştır.

## 1. Genel yapı
- **Katmanlı mimari**: Kod üç ana katmanda organize edilir: `api` (giriş noktaları), `core` (domain mantığı) ve `infrastructure` (veri erişimi, entegrasyonlar). Her katmanın sorumlulukları [architecture.md](architecture.md) dosyasında detaylandırılmıştır.
- **Dökümantasyon öncelikli yaklaşım**: Mimari kararlar, katkı süreçleri ve iş akışları `docs/` klasöründe kayıt altındadır. Değişiklik yapılmadan önce ilgili dokümanların güncellenmesi beklenir.
- **Test odaklı geliştirme**: Yeni özellikler için öncelikle test senaryoları yazılır. Testler `tests/` klasöründe, aynı katman isimlendirmesiyle organize edilir.

## 2. Bilinmesi gereken önemli noktalar
- **Bağımlılık yönetimi**: `core` katmanı `api` ve `infrastructure` katmanlarından bağımsızdır. Böylece domain mantığı izole ve test edilebilir kalır.
- **Konfigürasyon**: Ortak konfigürasyonlar `src/infrastructure/config/` altında tutulacak ve ortam değişkenleri ile yönetilecektir.
- **Hata yönetimi**: Her katmanda anlamlı hata sınıfları kullanılacak; `api` katmanı kullanıcıya dost mesajlar dönerken, `core` ve `infrastructure` katmanları hata loglarını zengin bilgilerle doldurur.
- **Kod stili**: Takım, açık fonksiyon ve değişken isimlendirmeleri, küçük ve odaklı modüller, kapsamlı yorum yerine kendini ifade eden kod yazımını benimser.

## 3. İlk yapılacaklar
1. `src/README.md` dosyasındaki katman sorumluluklarını okuyun.
2. Gereken geliştirme araçlarını (örn. paket yöneticisi, test çalıştırıcı) kurun. Ayrıntılar proje ilerledikçe dokümana eklenecektir.
3. İlk göreviniz için mentorunuzdan bir `good first issue` isteyin ve ilgili katmanın testlerini nasıl çalıştıracağınızı öğrenin.
4. Pull request açmadan önce `docs/architecture.md` içinde belirtilen kontrol listesini kullanarak kendi incelemenizi yapın.

## 4. Sonraki adımlar
- Domain hakkında daha fazla bilgi edinmek için ürün yöneticisi ile kickoff toplantısı planlayın.
- Veri modellerini ve entegrasyon noktalarını anlamak için gelecekte eklenecek `docs/domain-model.md` ve `docs/integration-guide.md` dokümanlarını takip edin.
- Otomasyon hattına aşina olmak adına CI ayarları eklendiğinde pipeline sonuçlarını inceleyin.

Herhangi bir sorunuz olursa ekip mentorunuza veya teknik liderinize danışmaktan çekinmeyin.
