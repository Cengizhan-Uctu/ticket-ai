# Ticket AI - Chatbot Website

Bu proje, Excel dosyalarından ticket verilerini analiz eden ve AI destekli raporlar üreten bir Flask web uygulamasıdır.

## Özellikler

- 📊 **Excel Dosya Analizi**: .xlsx, .xls, .csv formatlarında dosya yükleme
- 🤖 **AI Destekli Analiz**: Trendyol AI API ile otomatik veri yorumlama
- 📈 **Grafik Görselleştirme**: Matplotlib ile pasta ve çubuk grafikleri
- 📋 **Haftalık Raporlar**: Detaylı haftalık analiz raporları oluşturma
- 🔄 **Geçmiş Veri Yönetimi**: Geçmiş haftalık verileri görüntüleme ve karşılaştırma
- 💬 **Chatbot Entegrasyonu**: AI ile interaktif sohbet

## Teknolojiler

- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript
- **Data Processing**: Pandas, OpenPyXL
- **Visualization**: Matplotlib
- **AI Integration**: Trendyol AI API
- **Storage**: JSON dosya tabanlı depolama

## Kurulum

1. **Repository'yi klonlayın:**
   ```bash
   git clone https://github.com/Cengizhan-Uctu/ticket-ai.git
   cd ticket-ai
   ```

2. **Virtual environment oluşturun:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # macOS/Linux
   # veya
   venv\Scripts\activate  # Windows
   ```

3. **Gerekli paketleri yükleyin:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Uygulamayı çalıştırın:**
   ```bash
   python app.py
   ```

5. **Tarayıcıda açın:**
   ```
   http://localhost:5000
   ```

## Kullanım

### Excel Dosya Formatı
Excel dosyanızda aşağıdaki format kullanılmalıdır:
- **A Sütunu**: Görev/Ticket açıklamaları
- **B Sütunu**: Kategori bilgileri

### Ana Özellikler

1. **Dosya Yükleme**: Ana sayfada Excel dosyanızı sürükleyip bırakın veya "Dosya Seç" butonunu kullanın
2. **Analiz Görüntüleme**: Yüklenen veriler otomatik olarak analiz edilir ve grafikler oluşturulur
3. **Geçmiş Veriler**: Daha önce yüklenen dosyaları görüntüleyin ve yeniden analiz edin
4. **Rapor Oluşturma**: Haftalık raporlar oluşturun ve kaydedin
5. **Chatbot**: AI ile sohbet ederek verileriniz hakkında sorular sorun

## API Endpoints

- `POST /upload_excel` - Excel dosya yükleme
- `GET /get_historical_data` - Geçmiş verileri getirme
- `POST /reanalyze_data/<id>` - Veriyi yeniden analiz etme
- `POST /create_weekly_report` - Haftalık rapor oluşturma
- `GET /get_reports` - Kaydedilmiş raporları getirme
- `POST /chat` - Chatbot ile konuşma

## Dosya Yapısı

```
ticket-ai/
├── app.py                 # Ana Flask uygulaması
├── requirements.txt       # Python bağımlılıkları
├── static/               # Statik dosyalar
│   ├── css/             # CSS dosyaları
│   └── js/              # JavaScript dosyaları
├── templates/           # HTML şablonları
├── data_storage/        # JSON veri depolama
├── uploads/             # Yüklenen dosyalar
└── README.md           # Bu dosya
```

## Katkıda Bulunma

1. Bu repository'yi fork edin
2. Feature branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -am 'Yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/yeni-ozellik`)
5. Pull Request oluşturun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## İletişim

Proje sahibi: Cengizhan Üçtü
GitHub: [@Cengizhan-Uctu](https://github.com/Cengizhan-Uctu)