from flask import Flask, render_template, request, jsonify
import requests
import json
import pandas as pd
from collections import Counter
import io
import base64
import matplotlib.pyplot as plt
import matplotlib
import os
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import uuid
import xml.etree.ElementTree as ET
from lxml import etree
import tempfile
import time
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
matplotlib.use('Agg')  # GUI olmadan çalışması için

app = Flask(__name__)

# Dosya yükleme konfigürasyonu
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv', 'xml'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Upload klasörünü oluştur
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Veri depolama klasörünü oluştur
DATA_STORAGE_FOLDER = 'data_storage'
os.makedirs(DATA_STORAGE_FOLDER, exist_ok=True)

# Veri depolama dosyaları
DATA_STORAGE_FILE = os.path.join(DATA_STORAGE_FOLDER, 'weekly_data.json')
REPORTS_STORAGE_FILE = os.path.join(DATA_STORAGE_FOLDER, 'weekly_reports.json')

# Trendyol AI API konfigürasyonu
API_URL = "https://mlplatform.gcp.trendyol.com/piper/genai/chat/completions"
API_KEY = "sk-VbSvlXxHzz-mSZCDuY7kQg"

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def parse_excel_file(file_path):
    """Excel dosyasını oku ve görev verilerini çıkar"""
    try:
        # Excel dosyasını oku
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
        
        # Sütun sayısını kontrol et
        if len(df.columns) < 2:
            return {"error": "Excel dosyasında en az 2 sütun olmalı (A sütunu: Görevler, B sütunu: Kategoriler)"}
        
        # A sütunu (0. indeks) = Görevler, B sütunu (1. indeks) = Kategoriler
        task_column = df.columns[0]  # A sütunu
        category_column = df.columns[1]  # B sütunu
        
        # Verileri temizle ve filtrele
        parsed_data = []
        for index, row in df.iterrows():
            task = str(row[task_column]).strip()
            category = str(row[category_column]).strip()
            
            # Boş satırları atla
            if (task and category and 
                task != 'nan' and category != 'nan' and 
                task != 'None' and category != 'None' and
                task != '' and category != ''):
                parsed_data.append({
                    'task': task,
                    'category': category
                })
        
        if not parsed_data:
            return {"error": "Excel dosyasında geçerli veri bulunamadı. Lütfen A sütununda görevler, B sütununda kategoriler olduğundan emin olun."}
        
        return {
            "data": parsed_data, 
            "columns": {"task": task_column, "category": category_column},
            "fileName": os.path.basename(file_path)
        }
        
    except Exception as e:
        return {"error": f"Excel dosyası okuma hatası: {str(e)}"}

def call_chatbot_api(message):
    """Trendyol AI API'sine istek gönder"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "gemini-2.5-pro",
        "messages": [
            {
                "role": "user",
                "content": message
            }
        ]
    }
    
    try:
        response = requests.post(API_URL, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API Error: {str(e)}")
        return {"error": f"API isteği başarısız: {str(e)}"}

def save_weekly_data(data, filename):
    """Haftalık veriyi JSON dosyasına kaydet"""
    try:
        # Mevcut veriyi yükle
        stored_data = load_stored_data()
        
        # Otomatik dosya ismi oluştur
        now = datetime.now()
        auto_filename = f"Hafta_{now.strftime('%d_%m_%Y')}_{now.strftime('%H_%M')}"
        
        # Yeni veri ekle
        new_entry = {
            'id': str(uuid.uuid4()),
            'date': datetime.now().isoformat(),
            'week_start': get_week_start_date().isoformat(),
            'original_filename': filename,
            'display_filename': auto_filename,
            'data': data,
            'category_counts': get_category_counts(data),
            'total_tasks': len(data)
        }
        
        stored_data.append(new_entry)
        
        # Dosyaya kaydet
        with open(DATA_STORAGE_FILE, 'w', encoding='utf-8') as f:
            json.dump(stored_data, f, ensure_ascii=False, indent=2)
        
        return new_entry
    except Exception as e:
        print(f"Veri kaydetme hatası: {str(e)}")
        return None

def load_stored_data():
    """Depolanmış veriyi yükle"""
    try:
        if os.path.exists(DATA_STORAGE_FILE):
            with open(DATA_STORAGE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Veri yükleme hatası: {str(e)}")
        return []

def get_week_start_date():
    """Bu haftanın başlangıç tarihini al (Pazartesi)"""
    today = datetime.now().date()
    days_since_monday = today.weekday()
    monday = today - timedelta(days=days_since_monday)
    return monday

def get_category_counts(data):
    """Kategori sayılarını hesapla"""
    categories = Counter([item['category'] for item in data])
    return dict(categories)

def calculate_historical_average(stored_data):
    """Geçmiş verilerin ortalamasını hesapla"""
    if not stored_data:
        return {}
    
    # Tüm kategorileri topla
    all_categories = set()
    for data in stored_data:
        all_categories.update(data['category_counts'].keys())
    
    # Her kategori için ortalama hesapla
    category_averages = {}
    for category in all_categories:
        total = 0
        count = 0
        for data in stored_data:
            total += data['category_counts'].get(category, 0)
            count += 1
        
        category_averages[category] = round(total / count, 1) if count > 0 else 0
    
    return category_averages

def analyze_current_data(current_data):
    """Mevcut veriyi analiz et ve geçmiş verilerin ortalaması ile karşılaştır"""
    try:
        stored_data = load_stored_data()
        current_categories = get_category_counts(current_data)
        
        # Temel analiz
        analysis = {
            'current_data': {
                'total_tasks': len(current_data),
                'categories': current_categories,
                'date': datetime.now().isoformat()
            },
            'comparison': None,
            'historical_trend': None,
            'has_historical_data': len(stored_data) > 0,
            'total_previous_weeks': len(stored_data)
        }
        
        # Geçmiş verilerle karşılaştırma (ortalama ile)
        if stored_data and len(stored_data) > 0:
            # Geçmiş verilerin ortalamasını hesapla
            historical_averages = calculate_historical_average(stored_data)
            
            if historical_averages:
                comparison = compare_with_average(current_categories, historical_averages)
                analysis['comparison'] = comparison
                analysis['comparison']['average_info'] = {
                    'total_weeks_used': len(stored_data),
                    'comparison_type': 'average',
                    'average_total': sum(historical_averages.values())
                }
            
            # Tarihsel trend analizi
            if len(stored_data) >= 2:
                trend_analysis = analyze_historical_trend(stored_data, current_categories)
                analysis['historical_trend'] = trend_analysis
        else:
            analysis['no_data_message'] = "Bu ilk veri yüklemeniz. Karşılaştırma yapabilmek için en az 1 haftalık geçmiş veri gereklidir."
        
        return analysis
    except Exception as e:
        return {"error": f"Analiz hatası: {str(e)}"}

def compare_with_average(current_categories, average_categories):
    """Mevcut veriyi geçmiş verilerin ortalaması ile karşılaştır"""
    all_categories = set(current_categories.keys()) | set(average_categories.keys())
    
    comparison_data = []
    for category in all_categories:
        curr_count = current_categories.get(category, 0)
        avg_count = average_categories.get(category, 0)
        change = curr_count - avg_count
        change_percent = (change / avg_count * 100) if avg_count > 0 else (100 if curr_count > 0 else 0)
        
        comparison_data.append({
            'kategori': category,
            'gecen_hafta': avg_count,  # Arayüzde "Ortalama" olarak gösterilecek
            'bu_hafta': curr_count,
            'degisim': round(change, 1),
            'degisim_yuzde': round(change_percent, 1)
        })
    
    # Toplam değişim
    total_current = sum(current_categories.values())
    total_average = sum(average_categories.values())
    total_change = total_current - total_average
    total_change_percent = (total_change / total_average * 100) if total_average > 0 else 100
    
    return {
        'kategori_analizi': comparison_data,
        'toplam_analiz': {
            'gecen_hafta_toplam': round(total_average, 1),
            'bu_hafta_toplam': total_current,
            'toplam_degisim': round(total_change, 1),
            'toplam_degisim_yuzde': round(total_change_percent, 1)
        },
        'en_cok_artan': max(comparison_data, key=lambda x: x['degisim']) if comparison_data else None,
        'en_cok_azalan': min(comparison_data, key=lambda x: x['degisim']) if comparison_data else None
    }

def compare_with_previous(current_categories, previous_categories):
    """Mevcut veriyi önceki hafta ile karşılaştır"""
    all_categories = set(current_categories.keys()) | set(previous_categories.keys())
    
    comparison_data = []
    for category in all_categories:
        curr_count = current_categories.get(category, 0)
        prev_count = previous_categories.get(category, 0)
        change = curr_count - prev_count
        change_percent = (change / prev_count * 100) if prev_count > 0 else (100 if curr_count > 0 else 0)
        
        comparison_data.append({
            'kategori': category,
            'gecen_hafta': prev_count,
            'bu_hafta': curr_count,
            'degisim': change,
            'degisim_yuzde': round(change_percent, 1)
        })
        
    # Toplam değişim
    total_current = sum(current_categories.values())
    total_previous = sum(previous_categories.values())
    total_change = total_current - total_previous
    total_change_percent = (total_change / total_previous * 100) if total_previous > 0 else 100
    
    return {
        'kategori_analizi': comparison_data,
        'toplam_analiz': {
            'gecen_hafta_toplam': total_previous,
            'bu_hafta_toplam': total_current,
            'toplam_degisim': total_change,
            'toplam_degisim_yuzde': round(total_change_percent, 1)
        },
        'en_cok_artan': max(comparison_data, key=lambda x: x['degisim']) if comparison_data else None,
        'en_cok_azalan': min(comparison_data, key=lambda x: x['degisim']) if comparison_data else None
    }

def analyze_historical_trend(stored_data, current_categories):
    """Tarihsel trend analizi yap"""
    # Son 4 haftanın verilerini al
    recent_data = stored_data[-4:] if len(stored_data) >= 4 else stored_data
    
    weekly_totals = []
    for week_data in recent_data:
        total = sum(week_data['category_counts'].values())
        weekly_totals.append({
            'week_start': week_data['week_start'],
            'total': total,
            'categories': week_data['category_counts']
        })
    
    # Mevcut haftayı ekle
    current_total = sum(current_categories.values())
    weekly_totals.append({
        'week_start': get_week_start_date().isoformat(),
        'total': current_total,
        'categories': current_categories
    })
    
    return {
        'weekly_trend': weekly_totals,
        'trend_direction': 'artan' if len(weekly_totals) >= 2 and weekly_totals[-1]['total'] > weekly_totals[-2]['total'] else 'azalan'
    }

def create_current_data_charts(categories, counts):
    """Mevcut veri için ayrı pie ve bar grafikler oluştur"""
    try:
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9']
        
        # Pie Chart oluştur
        fig_pie, ax_pie = plt.subplots(figsize=(8, 8))
        ax_pie.pie(counts, labels=categories, autopct='%1.1f%%', startangle=90, colors=colors[:len(categories)])
        ax_pie.set_title('Kategori Dağılımı', fontsize=16, fontweight='bold', pad=20)
        
        # Pie chart'ı base64'e çevir
        buffer_pie = io.BytesIO()
        plt.savefig(buffer_pie, format='png', dpi=300, bbox_inches='tight', facecolor='white')
        buffer_pie.seek(0)
        pie_chart_data = base64.b64encode(buffer_pie.getvalue()).decode()
        plt.close(fig_pie)
        buffer_pie.close()
        
        # Bar Chart oluştur
        fig_bar, ax_bar = plt.subplots(figsize=(10, 6))
        bars = ax_bar.bar(categories, counts, color=colors[:len(categories)], alpha=0.8)
        ax_bar.set_xlabel('Kategoriler', fontsize=12, fontweight='bold')
        ax_bar.set_ylabel('Görev Sayısı', fontsize=12, fontweight='bold')
        ax_bar.set_title('Kategori Dağılımı', fontsize=16, fontweight='bold', pad=20)
        ax_bar.tick_params(axis='x', rotation=45, labelsize=10)
        ax_bar.grid(True, alpha=0.3)
        
        # Bar değerlerini göster
        for bar, count in zip(bars, counts):
            ax_bar.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05, 
                       str(count), ha='center', va='bottom', fontweight='bold')
        
        # Bar chart'ı base64'e çevir
        buffer_bar = io.BytesIO()
        plt.savefig(buffer_bar, format='png', dpi=300, bbox_inches='tight', facecolor='white')
        buffer_bar.seek(0)
        bar_chart_data = base64.b64encode(buffer_bar.getvalue()).decode()
        plt.close(fig_bar)
        buffer_bar.close()
        
        return {
            'pie': pie_chart_data,
            'bar': bar_chart_data
        }
    except Exception as e:
        print(f"Grafik oluşturma hatası: {str(e)}")
        return None

def create_comparison_charts(analysis_data):
    """Karşılaştırma grafikleri oluştur"""
    try:
        if not analysis_data.get('comparison'):
            return None
            
        comparison = analysis_data['comparison']
        categories = [item['kategori'] for item in comparison['kategori_analizi']]
        prev_counts = [item['gecen_hafta'] for item in comparison['kategori_analizi']]
        curr_counts = [item['bu_hafta'] for item in comparison['kategori_analizi']]
        
        # Grafik oluştur
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Bar chart - Haftalık karşılaştırma
        x = range(len(categories))
        width = 0.35
        
        ax1.bar([i - width/2 for i in x], prev_counts, width, label='Geçen Hafta', color='#667eea', alpha=0.8)
        ax1.bar([i + width/2 for i in x], curr_counts, width, label='Bu Hafta', color='#764ba2', alpha=0.8)
        
        ax1.set_xlabel('Kategoriler')
        ax1.set_ylabel('Görev Sayısı')
        ax1.set_title('Haftalık Kategori Karşılaştırması')
        ax1.set_xticks(x)
        ax1.set_xticklabels(categories, rotation=45, ha='right')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Değişim grafiği
        changes = [item['degisim'] for item in comparison['kategori_analizi']]
        change_colors = ['#28a745' if change > 0 else '#dc3545' if change < 0 else '#6c757d' for change in changes]
        
        ax2.bar(categories, changes, color=change_colors, alpha=0.8)
        ax2.set_xlabel('Kategoriler')
        ax2.set_ylabel('Değişim')
        ax2.set_title('Kategori Değişimleri')
        ax2.tick_params(axis='x', rotation=45)
        ax2.axhline(y=0, color='black', linestyle='-', linewidth=0.5)
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        # Grafiği base64'e çevir
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
        img_buffer.seek(0)
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
        plt.close()
        
        return img_base64
    except Exception as e:
        print(f"Karşılaştırma grafik hatası: {str(e)}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/reports')
def reports():
    return render_template('reports.html')

@app.route('/rag')
def rag():
    return render_template('rag.html')

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '')
    
    if not user_message:
        return jsonify({"error": "Mesaj boş olamaz"}), 400
    
    # AI API'sine istek gönder
    ai_response = call_chatbot_api(user_message)
    
    if "error" in ai_response:
        return jsonify({"error": ai_response["error"]}), 500
    
    # AI yanıtını çıkar
    try:
        bot_message = ai_response["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        bot_message = "Üzgünüm, yanıt alınamadı."
    
    return jsonify({"message": bot_message})

@app.route('/upload_excel', methods=['POST'])
def upload_excel():
    """Excel dosyasını yükle, parse et ve analiz yap"""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "Dosya seçilmedi"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"error": "Dosya seçilmedi"}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            
            # Excel dosyasını parse et
            result = parse_excel_file(file_path)
            
            # Geçici dosyayı sil
            os.remove(file_path)
            
            if "error" in result:
                return jsonify({"error": result["error"]}), 400
            
            # Veriyi sisteme kaydet
            saved_entry = save_weekly_data(result["data"], result.get("fileName", filename))
            
            # Mevcut veriyi analiz et
            analysis = analyze_current_data(result["data"])
            
            if "error" in analysis:
                return jsonify({"error": analysis["error"]}), 500
            
            # Grafikler oluştur
            categories = list(analysis['current_data']['categories'].keys())
            counts = list(analysis['current_data']['categories'].values())
            
            current_charts = create_current_data_charts(categories, counts)
            comparison_chart = create_comparison_charts(analysis) if analysis.get('comparison') else None
            
            # AI ile yorum oluştur
            ai_comment = generate_ai_summary(analysis)
            
            # Charts nesnesini oluştur
            charts = {
                "comparison": comparison_chart
            }
            if current_charts:
                charts.update(current_charts)  # pie ve bar chartları ekle
            
            return jsonify({
                "success": True,
                "data": result["data"],
                "analysis": analysis,
                "charts": charts,
                "ai_comment": ai_comment,
                "fileName": result.get("fileName", filename),
                "saved_entry_id": saved_entry['id'] if saved_entry else None
            })
        else:
            return jsonify({"error": "Geçersiz dosya formatı. Sadece .xlsx, .xls ve .csv dosyaları kabul edilir."}), 400
            
    except Exception as e:
        return jsonify({"error": f"Dosya yükleme hatası: {str(e)}"}), 500

@app.route('/analyze_data', methods=['POST'])
def analyze_data():
    """Manuel AI analizi yap"""
    try:
        data = request.get_json()
        saved_entry_id = data.get('saved_entry_id')
        
        if not saved_entry_id:
            return jsonify({"error": "Analiz edilecek veri ID'si bulunamadı"}), 400
        
        # Kaydedilmiş veriyi bul
        stored_data = load_stored_data()
        target_entry = None
        
        for entry in stored_data:
            if entry['id'] == saved_entry_id:
                target_entry = entry
                break
        
        if not target_entry:
            return jsonify({"error": "Analiz edilecek veri bulunamadı"}), 404
        
        # Analiz verisini hazırla
        analysis = analyze_current_data(target_entry['data'])
        
        if "error" in analysis:
            return jsonify({"error": analysis["error"]}), 500
        
        # AI analizi için current_data formatını hazırla
        current_data_for_ai = {
            'data': target_entry['data'],
            'total_tasks': len(target_entry['data']),
            'categories': analysis['current_data']['categories']
        }
        
        # AI ile yorum oluştur
        ai_comment = generate_ai_summary_with_data(analysis, current_data_for_ai)
        
        return jsonify({
            "success": True,
            "ai_comment": ai_comment,
            "analysis": analysis
        })
        
    except Exception as e:
        return jsonify({"error": f"Analiz hatası: {str(e)}"}), 500

def generate_ai_summary_with_data(analysis, current_data_for_ai):
    """AI analizi - current_data ile birlikte"""
    try:
        current_data = analysis['current_data']
        comparison = analysis.get('comparison')
        total_tasks = current_data.get('total_tasks', 0)
        
        print(f"Analyzing {total_tasks} tasks with individual approach...")
        
        # Büyük veri kontrolü
        if total_tasks > 10:
            print("Large dataset detected, using individual ticket analysis")
            return generate_multi_part_analysis_with_data(current_data_for_ai, comparison)
        else:
            print("Small dataset, using simple analysis")
            return generate_simple_analysis(current_data, comparison)
        
    except Exception as e:
        print(f"AI Summary exception: {str(e)}")
        return "📊 Verileriniz başarıyla yüklendi ve analiz edildi."

def generate_multi_part_analysis_with_data(current_data_for_ai, comparison):
    """Büyük veriler için individual analiz"""
    try:
        results = {}
        
        # BÖLÜM 1: Artan Ticketlarda Göze Çarpan Sebepler (Individual Analysis)
        print("Analyzing increased tickets individually...")
        results['increased_reasons'] = analyze_increased_ticket_reasons(comparison, current_data_for_ai['data'])
        
        # BÖLÜM 2: Alınabilecek Önlemler  
        print("Generating preventive measures...")
        results['preventive_measures'] = generate_preventive_measures(current_data_for_ai, comparison)
        
        # Sonuçları birleştir
        return format_multi_part_results(results)
        
    except Exception as e:
        print(f"Multi-part analysis with data error: {str(e)}")
        return "📊 Kapsamlı analiz tamamlandı"

def generate_ai_summary(analysis):
    """4 Bölümlü AI analizi - Büyük veriler için parçalı analiz"""
    try:
        current_data = analysis['current_data']
        comparison = analysis.get('comparison')
        total_tasks = current_data.get('total_tasks', 0)
        
        print(f"Analyzing {total_tasks} tasks...")
        
        # Büyük veri kontrolü
        if total_tasks > 10:  # Test için düşük threshold
            print("Large dataset detected, using multi-part analysis")
            return generate_multi_part_analysis(current_data, comparison)
        else:
            print("Small dataset, using simple analysis")
            return generate_simple_analysis(current_data, comparison)
        
    except Exception as e:
        print(f"AI Summary exception: {str(e)}")
        return "📊 Verileriniz başarıyla yüklendi ve analiz edildi."

def generate_simple_analysis(current_data, comparison):
    """Küçük veriler için basit analiz"""
    try:
        basic_summary = generate_basic_summary(current_data, comparison)
        
        if comparison and comparison.get('kategori_analizi'):
            detailed_analysis = analyze_increased_categories(comparison['kategori_analizi'])
            return basic_summary + "\n\n" + detailed_analysis
        
        return basic_summary
        
    except Exception as e:
        print(f"Simple analysis error: {str(e)}")
        return "📊 Temel analiz tamamlandı"

def generate_multi_part_analysis(current_data, comparison):
    """Büyük veriler için 4 bölümlü analiz"""
    try:
        results = {}
        
        # BÖLÜM 1: Artan Ticketlarda Göze Çarpan Sebepler
        print("Analyzing increased tickets...")
        results['increased_reasons'] = analyze_increased_ticket_reasons(comparison, current_data.get('data', []))
        
        # BÖLÜM 2: Alınabilecek Önlemler  
        print("Generating preventive measures...")
        results['preventive_measures'] = generate_preventive_measures(current_data, comparison)
        
        # Sonuçları birleştir
        return format_multi_part_results(results)
        
    except Exception as e:
        print(f"Multi-part analysis error: {str(e)}")
        return "📊 Kapsamlı analiz tamamlandı"

def analyze_increased_ticket_reasons(comparison, current_data_list):
    """Artan ticketların sebeplerini tek tek analiz et"""
    try:
        if not comparison or not comparison.get('kategori_analizi'):
            return "Karşılaştırma verisi bulunamadı"
        
        increased_categories = [item for item in comparison['kategori_analizi'] 
                              if item['degisim'] > 0.5]
        
        if not increased_categories:
            return "Bu hafta önemli artış gösteren kategori bulunamadı"
        
        # En çok artan 3 kategoriyi al (çok fazla API isteği olmasın)
        top_increases = sorted(increased_categories, key=lambda x: x['degisim'], reverse=True)[:3]
        
        print(f"Analyzing {len(top_increases)} increased categories individually...")
        
        # Her kategori için sebep toplama
        collected_reasons = {}
        
        for cat_item in top_increases:
            category_name = cat_item['kategori']
            increase_amount = cat_item['degisim']
            
            print(f"Analyzing category: {category_name} (+{increase_amount})")
            
            # Bu kategorideki görevleri bul
            category_tasks = [task for task in current_data_list if task['category'] == category_name]
            
            if len(category_tasks) == 0:
                collected_reasons[category_name] = ["Görev bulunamadı"]
                continue
            
            # İlk 5 görevi analiz et (çok fazla API isteği olmasın)
            sample_tasks = category_tasks[:5]
            task_reasons = []
            
            for task in sample_tasks:
                task_text = task['task']
                
                # Her görev için sebep analizi
                prompt = f"""
Görev: "{task_text}"
Kategori: {category_name}

Bu görevin bu kategoride olmasının sebebi nedir? Kısa ve net bir sebep belirt.
Sadece sebep yazsın, açıklama yapmasın.

Örnek formatlar:
- Sistem hatası
- Kullanıcı eğitimi eksikliği
- Altyapı yetersizliği
- Süreç eksikliği
"""
                
                try:
                    ai_response = call_chatbot_api(prompt)
                    
                    if "error" not in ai_response and ai_response.get("choices"):
                        reason = ai_response["choices"][0]["message"]["content"].strip()
                        task_reasons.append(reason)
                    else:
                        task_reasons.append("Analiz edilemedi")
                        
                except Exception as e:
                    print(f"Task analysis error: {str(e)}")
                    task_reasons.append("Analiz edilemedi")
            
            collected_reasons[category_name] = task_reasons
        
        # Toplanan sebeplerden genel değerlendirme
        return generate_reason_summary(collected_reasons, top_increases)
        
    except Exception as e:
        print(f"Individual analysis error: {str(e)}")
        return "Tekil analiz yapılamadı"

def generate_reason_summary(collected_reasons, top_increases):
    """Toplanan sebeplerden genel değerlendirme oluştur"""
    try:
        # Sebepleri analiz et ve kategorize et
        all_reasons = []
        category_summary = []
        
        for category, reasons in collected_reasons.items():
            category_info = next((cat for cat in top_increases if cat['kategori'] == category), None)
            increase_amount = category_info['degisim'] if category_info else 0
            
            # Bu kategorinin özeti
            valid_reasons = [r for r in reasons if r != "Analiz edilemedi" and r != "Görev bulunamadı"]
            
            if valid_reasons:
                category_summary.append(f"**{category} (+{increase_amount:.1f}):**")
                for reason in valid_reasons[:3]:  # İlk 3 sebebi göster
                    category_summary.append(f"  • {reason}")
                all_reasons.extend(valid_reasons)
            else:
                category_summary.append(f"**{category} (+{increase_amount:.1f}):** Sebep analizi yapılamadı")
        
        # Genel sebep dağılımı
        if all_reasons:
            # En sık görülen sebep türlerini bul
            reason_keywords = []
            for reason in all_reasons:
                if "sistem" in reason.lower() or "hata" in reason.lower():
                    reason_keywords.append("Sistem/Teknik")
                elif "kullanıcı" in reason.lower() or "eğitim" in reason.lower():
                    reason_keywords.append("Kullanıcı/Eğitim")
                elif "süreç" in reason.lower() or "prosedür" in reason.lower():
                    reason_keywords.append("Süreç/Prosedür")
                elif "altyapı" in reason.lower():
                    reason_keywords.append("Altyapı")
                else:
                    reason_keywords.append("Diğer")
            
            # En yaygın sebep türü
            from collections import Counter
            common_types = Counter(reason_keywords).most_common(3)
            
            general_summary = "**🎯 GENEL SEBEPLERİN ANALİZİ:**\n"
            for sebep_type, count in common_types:
                general_summary += f"• {sebep_type}: {count} farklı sebep\n"
        else:
            general_summary = "**🎯 GENEL SEBEPLERİN ANALİZİ:**\nYeterli sebep analizi yapılamadı."
        
        # Final sonuç
        result = "**🔍 KATEGORİ BAZINDA SEBEP ANALİZİ:**\n\n"
        result += "\n".join(category_summary)
        result += f"\n\n{general_summary}"
        
        return result
        
    except Exception as e:
        print(f"Reason summary error: {str(e)}")
        return "Sebep özeti oluşturulamadı"

def generate_preventive_measures(current_data, comparison):
    """Alınabilecek önlemleri oluştur"""
    try:
        categories = current_data.get('categories', {})
        
        # En problematik alanları belirle
        problem_areas = []
        
        # Yüksek hacimli kategoriler
        high_volume = [k for k, v in categories.items() if v >= 3]
        
        # Artan kategoriler
        increased_areas = []
        if comparison and comparison.get('kategori_analizi'):
            increased_areas = [item['kategori'] for item in comparison['kategori_analizi'] 
                             if item['degisim'] > 0.5]
        
        focus_areas = list(set(high_volume + increased_areas))[:5]
        
        prompt = f"""
ÖNLEYİCİ ÖNLEMLER:
Odaklanılacak alanlar: {', '.join(focus_areas)}

Bu alanlarda alınabilecek önleyici önlemleri listele:

**🛡️ ALINABİLECEK ÖNLEMLER:**
• Kısa vadeli çözümler: [hemen uygulanabilir]
• Orta vadeli iyileştirmeler: [1-3 ay içinde]
• Uzun vadeli stratejiler: [stratejik çözümler]

Pratik ve uygulanabilir öneriler ver."""
        
        ai_response = call_chatbot_api(prompt)
        
        if "error" not in ai_response:
            try:
                return ai_response["choices"][0]["message"]["content"]
            except (KeyError, IndexError):
                pass
        
        return """🛡️ **ALINABİLECEK ÖNLEMLER:**
• Sistem kaynaklarını gözden geçirin
• Kullanıcı eğitimlerini güncelleyin  
• Preventif bakım planları yapın"""
        
    except Exception as e:
        print(f"Preventive measures error: {str(e)}")
        return "Önleyici önlemler oluşturulamadı"


def format_multi_part_results(results):
    """2 bölümlü sonuçları formatla"""
    return f"""
## 🔍 ARTAN TİCKETLARDAKİ SEBEPLER
{results.get('increased_reasons', 'Analiz edilemedi')}

---

## 🛡️ ALINABİLECEK ÖNLEMLER
{results.get('preventive_measures', 'Analiz edilemedi')}
"""

def generate_basic_summary(current_data, comparison):
    """Hızlı temel özet oluştur"""
    try:
        categories_text = ', '.join([f"{k}:{v}" for k, v in current_data['categories'].items()])
        
        prompt = f"""
Haftalık görev analizi:
- Bu hafta: {current_data['total_tasks']} görev
- Kategoriler: {categories_text}
"""
        
        if comparison and comparison.get('kategori_analizi'):
            changes = []
            for item in comparison['kategori_analizi'][:5]:
                if abs(item['degisim']) > 0.5:  # Sadece önemli değişimler
                    changes.append(f"{item['kategori']}:{item['degisim']:+.1f}")
            
            if changes:
                prompt += f"- Değişimler: {', '.join(changes)}\n"
        
        prompt += """
SADECE şu formatta yanıt ver:
**📈 ARTAN KATEGORİLER:**
- [kategori]: +[sayı] - [kısa sebep]

**📉 AZALAN KATEGORİLER:**
- [kategori]: -[sayı] - [kısa sebep]

**💡 GENEL DEĞERLENDİRME:**
- [tek cümle durum]"""
        
        ai_response = call_chatbot_api(prompt)
        
        if "error" not in ai_response:
            try:
                return ai_response["choices"][0]["message"]["content"]
            except (KeyError, IndexError):
                pass
        
        return """**💡 GENEL DEĞERLENDİRME:**
- Bu hafta verileriniz analiz edildi"""
        
    except Exception as e:
        print(f"Basic summary error: {str(e)}")
        return "📊 Temel analiz tamamlandı"

def analyze_increased_categories(kategori_analizi):
    """Artan kategorilerin detaylı kök sebep analizi"""
    try:
        # Sadece artan kategorileri al
        increased_categories = [item for item in kategori_analizi if item['degisim'] > 0.5]
        
        if not increased_categories:
            return ""
        
        # En çok artan 3 kategoriyi analiz et
        top_increases = sorted(increased_categories, key=lambda x: x['degisim'], reverse=True)[:3]
        
        categories_for_analysis = []
        for item in top_increases:
            categories_for_analysis.append(f"{item['kategori']} (+{item['degisim']:.1f})")
        
        prompt = f"""
ARTAN KATEGORİLER DETAY ANALİZİ:
Kategoriler: {', '.join(categories_for_analysis)}

Bu kategorilerdeki artışların muhtemel sebeplerini analiz et:

**🔍 DETAYLI SEBEP ANALİZİ:**
{chr(10).join([f"• {cat['kategori']} (+{cat['degisim']:.1f}): [neden arttı? sistem sorunu mu? kullanıcı davranışı mı? altyapı mı?]" for cat in top_increases])}

**⚠️ DİKKAT EDİLMESİ GEREKENLER:**
- [bu artışların işaret ettiği potansiyel problemler]

**🎯 ÖNERİLEN AKSIYONLAR:**
- [somut çözüm önerileri]

Teknik ve iş süreçleri açısından analiz yap."""
        
        print(f"Detailed analysis for {len(top_increases)} categories")
        ai_response = call_chatbot_api(prompt)
        
        if "error" not in ai_response:
            try:
                detailed_content = ai_response["choices"][0]["message"]["content"]
                print("Detailed analysis başarılı")
                return detailed_content
            except (KeyError, IndexError):
                pass
        
        return f"""**🔍 DETAYLI SEBEP ANALİZİ:**
{chr(10).join([f"• {cat['kategori']} (+{cat['degisim']:.1f}) - İnceleme gerekiyor" for cat in top_increases])}

**🎯 ÖNERİLEN AKSIYONLAR:**
- Bu kategorilerdeki artış sebeplerini araştırın
- Sistem loglarını kontrol edin"""
        
    except Exception as e:
        print(f"Detailed analysis error: {str(e)}")
        return ""

@app.route('/get_historical_data', methods=['GET'])
def get_historical_data():
    """Geçmiş verileri getir"""
    try:
        stored_data = load_stored_data()
        
        # Tüm veriyi getir (en yeniden en eskiye)
        stored_data.reverse()
        
        # Haftalık özet oluştur
        weekly_summary = []
        for index, data in enumerate(stored_data):
            upload_date = datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
            weekly_summary.append({
                'id': data['id'],
                'date': data['date'],
                'week_start': data.get('week_start'),
                'original_filename': data.get('original_filename', data.get('filename', 'Bilinmeyen')),
                'display_filename': data.get('display_filename', f"Hafta {index + 1}"),
                'total_tasks': data.get('total_tasks', sum(data['category_counts'].values()) if 'category_counts' in data else 0),
                'categories': data.get('category_counts', {}),
                'upload_date_formatted': upload_date.strftime('%d.%m.%Y %H:%M'),
                'week_number': len(stored_data) - index
            })
        
        return jsonify({
            "success": True,
            "data": weekly_summary,
            "total_weeks": len(stored_data),
            "has_data": len(stored_data) > 0
        })
    except Exception as e:
        return jsonify({"error": f"Veri getirme hatası: {str(e)}"}), 500

@app.route('/delete_historical_data/<data_id>', methods=['DELETE'])
def delete_historical_data(data_id):
    """Geçmiş veriyi sil"""
    try:
        stored_data = load_stored_data()
        
        # Silinecek veriyi bul
        data_to_delete = None
        for i, data in enumerate(stored_data):
            if data['id'] == data_id:
                data_to_delete = stored_data.pop(i)
                break
        
        if not data_to_delete:
            return jsonify({"error": "Silinecek veri bulunamadı"}), 404
        
        # Güncellenmiş veriyi kaydet
        with open(DATA_STORAGE_FILE, 'w', encoding='utf-8') as f:
            json.dump(stored_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            "success": True,
            "message": f"'{data_to_delete.get('display_filename', 'Bilinmeyen')}' verisi silindi",
            "remaining_count": len(stored_data)
        })
    except Exception as e:
        return jsonify({"error": f"Veri silme hatası: {str(e)}"}), 500

@app.route('/reanalyze_data/<data_id>', methods=['POST'])
def reanalyze_data(data_id):
    """Geçmiş veriyi yeniden analiz et"""
    try:
        stored_data = load_stored_data()
        
        # Yeniden analiz edilecek veriyi bul
        target_data = None
        for data in stored_data:
            if data['id'] == data_id:
                target_data = data
                break
        
        if not target_data:
            return jsonify({"error": "Analiz edilecek veri bulunamadı"}), 404
        
        # Veriyi analiz et
        analysis = analyze_current_data(target_data['data'])
        
        if "error" in analysis:
            return jsonify({"error": analysis["error"]}), 500
        
        # Grafikler oluştur
        categories = list(analysis['current_data']['categories'].keys())
        counts = list(analysis['current_data']['categories'].values())
        
        current_charts = create_current_data_charts(categories, counts)
        comparison_chart = create_comparison_charts(analysis) if analysis.get('comparison') else None
        
        # AI ile yorum oluştur
        ai_comment = generate_ai_summary(analysis)
        
        # Charts nesnesini oluştur
        charts = {
            "comparison": comparison_chart
        }
        if current_charts:
            charts.update(current_charts)  # pie ve bar chartları ekle
        
        return jsonify({
            "success": True,
            "data": target_data['data'],
            "analysis": analysis,
            "charts": charts,
            "ai_comment": ai_comment,
            "fileName": target_data.get('display_filename', 'Yeniden Analiz'),
            "saved_entry_id": target_data['id'],
            "reanalyzed": True
        })
    except Exception as e:
        return jsonify({"error": f"Yeniden analiz hatası: {str(e)}"}), 500

@app.route('/compare_weeks', methods=['POST'])
def compare_weeks():
    """Belirli haftaları karşılaştır"""
    try:
        data = request.get_json()
        week_ids = data.get('week_ids', [])
        
        if len(week_ids) < 2:
            return jsonify({"error": "En az 2 hafta seçmelisiniz"}), 400
        
        stored_data = load_stored_data()
        selected_weeks = []
        
        for week_id in week_ids:
            week_data = next((item for item in stored_data if item['id'] == week_id), None)
            if week_data:
                selected_weeks.append(week_data)
        
        if len(selected_weeks) < 2:
            return jsonify({"error": "Seçilen haftalar bulunamadı"}), 400
        
        # Karşılaştırma analizi yap
        comparison_results = []
        for i in range(len(selected_weeks) - 1):
            current_week = selected_weeks[i + 1]
            previous_week = selected_weeks[i]
            
            comparison = compare_with_previous(
                current_week['category_counts'], 
                previous_week['category_counts']
            )
            
            comparison_results.append({
                'previous_week': {
                    'id': previous_week['id'],
                    'week_start': previous_week['week_start'],
                    'filename': previous_week['filename']
                },
                'current_week': {
                    'id': current_week['id'],
                    'week_start': current_week['week_start'],
                    'filename': current_week['filename']
                },
                'comparison': comparison
            })
        
        return jsonify({
            "success": True,
            "comparisons": comparison_results
        })
    except Exception as e:
        return jsonify({"error": f"Karşılaştırma hatası: {str(e)}"}), 500

def load_reports():
    """Kaydedilmiş raporları yükle"""
    try:
        if os.path.exists(REPORTS_STORAGE_FILE):
            with open(REPORTS_STORAGE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Rapor yükleme hatası: {str(e)}")
        return []

def save_report(report_data):
    """Raporu kaydet"""
    try:
        reports = load_reports()
        
        new_report = {
            'id': str(uuid.uuid4()),
            'date': datetime.now().isoformat(),
            'week_start': get_week_start_date().isoformat(),
            'title': f"Haftalık Rapor - {datetime.now().strftime('%d.%m.%Y')}",
            'ai_summary': report_data.get('ai_summary', ''),
            'incident_info': report_data.get('incident_info', ''),
            'improvement_suggestions': report_data.get('improvement_suggestions', ''),
            'additional_notes': report_data.get('additional_notes', ''),
            'data_summary': report_data.get('data_summary', {}),
            'full_report': report_data.get('full_report', '')
        }
        
        reports.append(new_report)
        
        with open(REPORTS_STORAGE_FILE, 'w', encoding='utf-8') as f:
            json.dump(reports, f, ensure_ascii=False, indent=2)
        
        return new_report
    except Exception as e:
        print(f"Rapor kaydetme hatası: {str(e)}")
        return None

@app.route('/create_weekly_report', methods=['POST'])
def create_weekly_report():
    """Haftalık rapor oluştur"""
    try:
        data = request.get_json()
        
        # Input verilerini al
        incident_info = data.get('incident_info', '').strip()
        improvement_suggestions = data.get('improvement_suggestions', '').strip()
        additional_notes = data.get('additional_notes', '').strip()
        ai_summary = data.get('ai_summary', 'Veri analizi bulunamadı.')
        data_summary = data.get('data_summary', {})
        
        # Debug log
        print(f"Rapor oluşturma isteği - AI Summary: {ai_summary[:100]}...")
        print(f"Incident: {incident_info}")
        print(f"Suggestions: {improvement_suggestions}")
        print(f"Notes: {additional_notes}")
        
        # AI summary'yi kısalt (çok uzunsa)
        summary_preview = ai_summary[:500] + "..." if len(ai_summary) > 500 else ai_summary
        
        # AI ile kapsamlı rapor oluştur
        report_prompt = f"""
Haftalık İş Raporu Oluştur:

VERİ ANALİZİ ÖZETİ:
{summary_preview}

EK BİLGİLER:
- Olaylar: {incident_info if incident_info else 'Yok'}
- Öneriler: {improvement_suggestions if improvement_suggestions else 'Yok'} 
- Notlar: {additional_notes if additional_notes else 'Yok'}

Bu bilgileri kullanarak kısa ve öz bir haftalık rapor oluştur:
# HAFTALIK RAPOR ({datetime.now().strftime('%d.%m.%Y')})

## 📊 DURUM
[Veri analizine göre genel durum]

## 🚨 OLAYLAR  
[Bu hafta yaşananlar]

## 💡 ÖNERİLER
[Geliştirme önerileri]

## 🎯 SONUÇ
[Genel değerlendirme]

Kısa ve net ol. Markdown formatında yaz.
"""
        
        print("AI API'ye rapor prompt'u gönderiliyor...")
        ai_response = call_chatbot_api(report_prompt)
        print(f"AI Response alındı: {type(ai_response)}")
        
        full_report = ""
        
        if "error" in ai_response:
            error_msg = ai_response.get("error", "Bilinmeyen hata")
            print(f"AI API hatası: {error_msg}, fallback rapor oluşturuluyor...")
            
            # Fallback: Basit rapor oluştur
            full_report = f"""# HAFTALIK RAPOR ({datetime.now().strftime('%d.%m.%Y')})

## 📊 DURUM
{summary_preview}

## 🚨 BU HAFTA YAŞANAN OLAYLAR
{incident_info if incident_info else 'Bu hafta özel bir olay bildirilmedi.'}

## 💡 GELİŞTİRME ÖNERİLERİ
{improvement_suggestions if improvement_suggestions else 'Ek geliştirme önerisi belirtilmedi.'}

## 🎯 SONUÇ VE DEĞERLENDİRME
Bu hafta için temel veriler analiz edildi ve rapor hazırlandı.

## 📝 EK NOTLAR
{additional_notes if additional_notes else 'Ek not bulunmuyor.'}

---
*Bu rapor AI API hatası nedeniyle otomatik oluşturuldu.*
"""
            print("Fallback rapor oluşturuldu")
        else:
            try:
                full_report = ai_response["choices"][0]["message"]["content"]
                print(f"AI rapor başarıyla oluşturuldu, uzunluk: {len(full_report)}")
            except (KeyError, IndexError) as e:
                print(f"AI response format hatası: {e}, fallback kullanılıyor...")
                print(f"Response içeriği: {ai_response}")
                
                # Fallback rapor
                full_report = f"""# HAFTALIK RAPOR ({datetime.now().strftime('%d.%m.%Y')})

## 📊 DURUM  
{summary_preview}

## 🚨 BU HAFTA YAŞANAN OLAYLAR
{incident_info if incident_info else 'Bu hafta özel bir olay bildirilmedi.'}

## 💡 GELİŞTİRME ÖNERİLERİ
{improvement_suggestions if improvement_suggestions else 'Ek geliştirme önerisi belirtilmedi.'}

## 🎯 SONUÇ
Haftalık veriler analiz edildi ve rapor oluşturuldu.

---
*Bu rapor AI yanıt formatı hatası nedeniyle otomatik oluşturuldu.*
"""
        
        # Full report kontrolü
        if not full_report or full_report.strip() == "":
            print("Full report boş, fallback rapor oluşturuluyor...")
            full_report = f"""# HAFTALIK RAPOR ({datetime.now().strftime('%d.%m.%Y')})

## 📊 DURUM
Bu hafta için veri analizi gerçekleştirildi.

## 🚨 BU HAFTA YAŞANAN OLAYLAR
{incident_info if incident_info else 'Bu hafta özel bir olay bildirilmedi.'}

## 💡 GELİŞTİRME ÖNERİLERİ
{improvement_suggestions if improvement_suggestions else 'Ek geliştirme önerisi belirtilmedi.'}

## 🎯 SONUÇ
Haftalık rapor başarıyla oluşturuldu.

## 📝 EK NOTLAR
{additional_notes if additional_notes else 'Ek not bulunmuyor.'}
"""

        # Raporu kaydet
        report_data = {
            'ai_summary': ai_summary,
            'incident_info': incident_info,
            'improvement_suggestions': improvement_suggestions,
            'additional_notes': additional_notes,
            'data_summary': data_summary,
            'full_report': full_report
        }
        
        print("Rapor kaydediliyor...")
        saved_report = save_report(report_data)
        
        if not saved_report:
            print("Rapor kaydetme başarısız")
            return jsonify({"error": "Rapor kaydedilemedi"}), 500
        
        print("Rapor başarıyla kaydedildi")
        return jsonify({
            "success": True,
            "report": saved_report,
            "message": "Haftalık rapor başarıyla oluşturuldu ve kaydedildi"
        })
        
    except Exception as e:
        print(f"Genel hata: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Rapor oluşturma hatası: {str(e)}"}), 500

@app.route('/get_reports', methods=['GET'])
def get_reports():
    """Kaydedilmiş raporları getir"""
    try:
        reports = load_reports()
        
        # Raporları tarih sırasına göre sırala (en yeni önce)
        reports.sort(key=lambda x: x['date'], reverse=True)
        
        # Özet bilgiler için format düzenle
        formatted_reports = []
        for report in reports:
            formatted_reports.append({
                'id': report['id'],
                'title': report['title'],
                'date': report['date'],
                'week_start': report['week_start'],
                'formatted_date': datetime.fromisoformat(report['date'].replace('Z', '+00:00')).strftime('%d.%m.%Y %H:%M'),
                'has_incidents': bool(report.get('incident_info', '').strip()),
                'has_suggestions': bool(report.get('improvement_suggestions', '').strip()),
                'preview': report['full_report'][:150] + '...' if len(report['full_report']) > 150 else report['full_report']
            })
        
        return jsonify({
            "success": True,
            "reports": formatted_reports,
            "total_reports": len(reports)
        })
        
    except Exception as e:
        return jsonify({"error": f"Raporları getirme hatası: {str(e)}"}), 500

@app.route('/get_report/<report_id>', methods=['GET'])
def get_report(report_id):
    """Belirli bir raporu getir"""
    try:
        reports = load_reports()
        
        report = next((r for r in reports if r['id'] == report_id), None)
        
        if not report:
            return jsonify({"error": "Rapor bulunamadı"}), 404
        
        return jsonify({
            "success": True,
            "report": report
        })
        
    except Exception as e:
        return jsonify({"error": f"Rapor getirme hatası: {str(e)}"}), 500

@app.route('/delete_report/<report_id>', methods=['DELETE'])
def delete_report(report_id):
    """Rapor sil"""
    try:
        reports = load_reports()
        
        report_to_delete = None
        for i, report in enumerate(reports):
            if report['id'] == report_id:
                report_to_delete = reports.pop(i)
                break
        
        if not report_to_delete:
            return jsonify({"error": "Silinecek rapor bulunamadı"}), 404
        
        # Güncellenmiş rapor listesini kaydet
        with open(REPORTS_STORAGE_FILE, 'w', encoding='utf-8') as f:
            json.dump(reports, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            "success": True,
            "message": f"'{report_to_delete['title']}' raporu silindi",
            "remaining_count": len(reports)
        })
        
    except Exception as e:
        return jsonify({"error": f"Rapor silme hatası: {str(e)}"}), 500

# RAG System Functions
def simple_embedding(text):
    """Basit embedding fonksiyonu - kelime frekansı tabanlı"""
    try:
        # Metni küçük harfe çevir ve kelimelere ayır
        words = text.lower().split()
        
        # Basit kelime frekansı vektörü oluştur
        word_freq = {}
        for word in words:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        # Vektör boyutunu sabitlemek için en yaygın 100 kelimeyi al
        all_words = sorted(word_freq.keys())[:100]
        vector = [word_freq.get(word, 0) for word in all_words]
        
        # Normalizasyon
        total = sum(vector) if sum(vector) > 0 else 1
        normalized_vector = [x/total for x in vector]
        
        return np.array(normalized_vector)
    except Exception as e:
        print(f"Embedding error: {str(e)}")
        return np.zeros(100)

def calculate_similarity(text1, text2):
    """İki metin arasındaki benzerliği hesapla"""
    try:
        vec1 = simple_embedding(text1)
        vec2 = simple_embedding(text2)
        
        # Reshape for cosine_similarity
        vec1 = vec1.reshape(1, -1)
        vec2 = vec2.reshape(1, -1)
        
        similarity = cosine_similarity(vec1, vec2)[0][0]
        return max(0, similarity)
    except Exception as e:
        print(f"Similarity calculation error: {str(e)}")
        return 0.0

def parse_reference_xml(file_path):
    """Referans XML dosyasını parse et"""
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        reference_data = []
        
        # <sikayetler> tag'i altındaki <sikayet> tag'lerini ara
        complaints = root.findall('.//sikayet')
        
        if not complaints:
            # Alternatif yapılar dene
            complaints = root.findall('.//complaint')
            if not complaints:
                complaints = root.findall('.//item')
        
        for complaint in complaints:
            problem_text = ""
            category = ""
            
            # Problem metnini bul
            for child in complaint:
                if child.tag.lower() in ['problem', 'text', 'description', 'sorun', 'aciklama']:
                    problem_text = child.text or ""
                elif child.tag.lower() in ['category', 'kategori', 'type', 'tip']:
                    category = child.text or ""
            
            # Eğer direkt text varsa onu kullan
            if not problem_text and complaint.text:
                problem_text = complaint.text
            
            # Attributes'larda ara
            if not category:
                category = complaint.get('category') or complaint.get('kategori') or ""
            
            if problem_text.strip() and category.strip():
                reference_data.append({
                    'problem': problem_text.strip(),
                    'category': category.strip()
                })
        
        print(f"Parsed {len(reference_data)} reference items")
        return reference_data
        
    except Exception as e:
        print(f"Reference XML parsing error: {str(e)}")
        return []

def parse_target_xml(file_path):
    """Kategorize edilecek XML dosyasını parse et"""
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        target_data = []
        
        # A sütunundaki problemleri ara
        problems = root.findall('.//problem')
        
        if not problems:
            # Alternatif yapılar dene
            problems = root.findall('.//item')
            if not problems:
                problems = root.findall('.//row')
        
        for problem in problems:
            problem_text = ""
            
            # A sütunu (problem metni) bul
            if problem.text:
                problem_text = problem.text
            else:
                # A sütunu veya benzer tag'leri ara
                for child in problem:
                    if child.tag.lower() in ['a', 'column_a', 'problem', 'text', 'description']:
                        problem_text = child.text or ""
                        break
            
            if problem_text.strip():
                target_data.append({
                    'problem': problem_text.strip(),
                    'original_index': len(target_data)
                })
        
        print(f"Parsed {len(target_data)} target items")
        return target_data
        
    except Exception as e:
        print(f"Target XML parsing error: {str(e)}")
        return []

def find_best_category(problem_text, reference_data, top_k=3):
    """Bir problem için en uygun kategoriyi bul"""
    try:
        if not reference_data:
            return "Kategorisiz", 0.0, "Referans bulunamadı"
        
        similarities = []
        
        for ref_item in reference_data:
            similarity = calculate_similarity(problem_text, ref_item['problem'])
            similarities.append({
                'category': ref_item['category'],
                'similarity': similarity,
                'reference_problem': ref_item['problem']
            })
        
        # En yüksek benzerlik skoruna göre sırala
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        
        # En iyi kategoriyi seç
        best_match = similarities[0]
        
        # Güven skorunu yüzdeye çevir
        confidence = min(100, best_match['similarity'] * 100)
        
        return best_match['category'], confidence, best_match['reference_problem']
        
    except Exception as e:
        print(f"Category finding error: {str(e)}")
        return "Hata", 0.0, "İşlem hatası"

def create_result_xml(target_data, categorized_results, original_target_path):
    """Sonuç XML dosyasını oluştur"""
    try:
        # Orijinal dosyayı oku
        tree = ET.parse(original_target_path)
        root = tree.getroot()
        
        # Her bir problem için kategori ekle
        problems = root.findall('.//problem')
        
        if not problems:
            problems = root.findall('.//item')
            if not problems:
                problems = root.findall('.//row')
        
        for i, problem in enumerate(problems):
            if i < len(categorized_results):
                category = categorized_results[i]['category']
                
                # B sütunu (kategori) ekle
                category_element = ET.SubElement(problem, 'category')
                category_element.text = category
        
        # Geçici dosya oluştur
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False, encoding='utf-8')
        
        # XML'i dosyaya yaz
        tree.write(temp_file.name, encoding='utf-8', xml_declaration=True)
        temp_file.close()
        
        return temp_file.name
        
    except Exception as e:
        print(f"Result XML creation error: {str(e)}")
        return None

@app.route('/rag_categorize', methods=['POST'])
def rag_categorize():
    """RAG tabanlı kategorize etme"""
    try:
        start_time = time.time()
        
        # Dosyaları al
        if 'reference_file' not in request.files or 'target_file' not in request.files:
            return jsonify({"error": "Her iki dosya da gerekli"}), 400
        
        reference_file = request.files['reference_file']
        target_file = request.files['target_file']
        
        if reference_file.filename == '' or target_file.filename == '':
            return jsonify({"error": "Dosyalar seçilmedi"}), 400
        
        # Dosyaları geçici olarak kaydet
        ref_filename = secure_filename(reference_file.filename)
        target_filename = secure_filename(target_file.filename)
        
        ref_path = os.path.join(app.config['UPLOAD_FOLDER'], f"ref_{uuid.uuid4()}_{ref_filename}")
        target_path = os.path.join(app.config['UPLOAD_FOLDER'], f"target_{uuid.uuid4()}_{target_filename}")
        
        reference_file.save(ref_path)
        target_file.save(target_path)
        
        try:
            # XML dosyalarını parse et
            print("Parsing reference XML...")
            reference_data = parse_reference_xml(ref_path)
            
            print("Parsing target XML...")
            target_data = parse_target_xml(target_path)
            
            if not reference_data:
                return jsonify({"error": "Referans dosyasında geçerli veri bulunamadı"}), 400
            
            if not target_data:
                return jsonify({"error": "Kategorize edilecek dosyada geçerli veri bulunamadı"}), 400
            
            # Kategorize etme işlemi
            print(f"Categorizing {len(target_data)} problems using {len(reference_data)} references...")
            categorized_results = []
            
            for target_item in target_data:
                category, confidence, similar_ref = find_best_category(
                    target_item['problem'], 
                    reference_data
                )
                
                categorized_results.append({
                    'problem': target_item['problem'],
                    'category': category,
                    'confidence': round(confidence, 1),
                    'similar_reference': similar_ref[:100] + "..." if len(similar_ref) > 100 else similar_ref
                })
            
            # Sonuç dosyasını oluştur
            result_file_path = create_result_xml(target_data, categorized_results, target_path)
            
            if not result_file_path:
                return jsonify({"error": "Sonuç dosyası oluşturulamadı"}), 500
            
            # İstatistikleri hesapla
            processing_time = round(time.time() - start_time, 1)
            categories_found = len(set([item['category'] for item in categorized_results]))
            avg_confidence = round(sum([item['confidence'] for item in categorized_results]) / len(categorized_results), 1)
            
            # Dosyayı taşı
            final_filename = f"kategorize_edilmis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xml"
            final_path = os.path.join(app.config['UPLOAD_FOLDER'], final_filename)
            
            # Dosyayı kopyala
            import shutil
            shutil.move(result_file_path, final_path)
            
            return jsonify({
                "success": True,
                "stats": {
                    "total_processed": len(categorized_results),
                    "categories_found": categories_found,
                    "avg_confidence": avg_confidence,
                    "processing_time": processing_time
                },
                "categorized_data": categorized_results,
                "download_url": f"/download_result/{final_filename}",
                "filename": final_filename
            })
            
        finally:
            # Geçici dosyaları temizle
            try:
                if os.path.exists(ref_path):
                    os.remove(ref_path)
                if os.path.exists(target_path):
                    os.remove(target_path)
            except:
                pass
        
    except Exception as e:
        print(f"RAG categorize error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Kategorize etme hatası: {str(e)}"}), 500

@app.route('/download_result/<filename>')
def download_result(filename):
    """Sonuç dosyasını indir"""
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(file_path):
            return jsonify({"error": "Dosya bulunamadı"}), 404
        
        from flask import send_file
        return send_file(file_path, as_attachment=True, download_name=filename)
        
    except Exception as e:
        return jsonify({"error": f"Dosya indirme hatası: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
