# Rossmann ve Gratis Fiyat Karşılaştırıcı

Bu proje, Rossmann ve Gratis web sitelerindeki ürün fiyatlarını arayıp karşılaştıran basit bir Flask uygulamasıdır. Kullanıcı ürün adını girdikten sonra sistem her iki siteden de fiyatları çekmeye çalışır ve en uygun sonucu öne çıkarır.

## Özellikler

- Tek form üzerinden ürün adı ile arama
- Her perakendeci için fiyat, ürün ismi ve ürün bağlantısı
- En uygun fiyatın görsel olarak vurgulanması
- Hata durumlarında kullanıcıya anlaşılır geri bildirimler

## Yerel Kurulum (MacOS / Linux / Windows 10+)

1. **Python ortamını hazırlayın**
   - Python 3.10 veya üzeri yüklü olmalıdır. Yüklü değilse [python.org](https://www.python.org/downloads/) üzerinden kurabilirsiniz.
   - (Önerilir) Depo klasöründe sanal ortam oluşturun:
     ```bash
     python -m venv .venv
     ```
   - Sanal ortamı aktif edin:
     - MacOS / Linux: `source .venv/bin/activate`
     - Windows (PowerShell): `.venv\Scripts\Activate.ps1`

2. **Bağımlılıkları yükleyin**
   ```bash
   pip install -r requirements.txt
   ```

3. **Sunucuyu başlatın**
   - Flask CLI ile çalıştırmak:
     ```bash
     flask --app app --debug run
     ```
   - veya doğrudan Python ile:
     ```bash
     python app.py
     ```
   - Komut satırında `Running on http://127.0.0.1:5000` çıktısını görmelisiniz.

4. **Tarayıcıdan test edin**
   - `http://127.0.0.1:5000` adresine gidin.
   - Ürün adını girip “Karşılaştır” butonuna basın.
   - En uygun fiyat kartı otomatik olarak üstte listelenecektir.

5. **Terminal üzerinden hızlı doğrulama (isteğe bağlı)**
   ```bash
   curl "http://127.0.0.1:5000/api/compare?query=di%C5%9F+macunu"
   ```
   Bu komut JSON çıktısını döndürerek sunucunun çalıştığını gösterir.

> Not: Uygulama, belirtilen web sitelerinin herkese açık arama sonuçlarından fiyat çeker. Ağ veya proxy kısıtlamaları nedeniyle fiyat bilgisi alınamazsa, hata mesajı görüntülenir.

## Docker ile Çalıştırma (Alternatif)

Docker kullanarak aynı adımları sanal ortamla uğraşmadan gerçekleştirebilirsiniz:

```bash
docker build -t fiyat-karsilastirici .
docker run --rm -p 5000:5000 fiyat-karsilastirici
```

Ardından tarayıcıdan yine `http://127.0.0.1:5000` adresini ziyaret edin.

## Test ve Kontroller

- Kodun sözdizimini doğrulamak için:
  ```bash
  python -m compileall app.py price_fetchers
  ```

## Lisans

Bu depo içerisinde özel bir lisans belirtilmemiştir.
