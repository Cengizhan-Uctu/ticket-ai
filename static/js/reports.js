class TaskAnalyzer {
    constructor() {
        this.currentData = null;
        this.initEventListeners();
        this.initPageView();
    }
    
    initEventListeners() {
        // Dosya seçimi event listener
        document.getElementById('excelFile').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });
        
        // Drag & Drop event listener'ları
        this.setupDragAndDrop();
        
        // Geçmiş veriler butonları
        document.getElementById('loadHistoricalBtn').addEventListener('click', () => {
            this.loadHistoricalData();
        });
    }
    
    initPageView() {
        // Sayfa yüklendiğinde geçmiş veriler bölümünü göster
        this.showHistoricalSection();
    }
    
    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const fileInput = document.getElementById('excelFile');
                fileInput.files = files;
                this.handleFileUpload({ target: fileInput });
            }
        });
        
        // Upload area tıklama kaldırıldı - sadece buton ile dosya seçimi
    }
    
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // UI güncellemeleri
        this.showLoading();
        this.hideResults();
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/upload_excel', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.currentData = result;
                this.displayResults(result);
                this.showHistoricalSection();
                } else {
                this.showError(result.error || 'Dosya yükleme hatası');
            }
        } catch (error) {
            this.showError(`Bağlantı hatası: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }
    
    showLoading() {
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('loadingArea').style.display = 'block';
    }
    
    hideLoading() {
        document.getElementById('uploadArea').style.display = 'flex';
        document.getElementById('loadingArea').style.display = 'none';
    }
    
    showResults() {
        document.getElementById('results-section').style.display = 'block';
        
        // Kısa bir gecikme ile smooth scroll
        setTimeout(() => {
            const resultsSection = document.getElementById('results-section');
            resultsSection.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
    }
    
    hideResults() {
        document.getElementById('results-section').style.display = 'none';
    }
    
    showHistoricalSection() {
        document.getElementById('historical-section').style.display = 'block';
    }
    
    showError(message) {
        // Upload area'da hata göster
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.innerHTML = `
            <div class="error-content">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="error-text">
                    <p style="color: #dc3545; font-weight: 600;">Hata!</p>
                    <p style="color: #666;">${message}</p>
                    <button onclick="location.reload()" class="upload-button" style="margin-top: 15px;">
                        <i class="fas fa-redo"></i> Tekrar Deneyin
                    </button>
                </div>
            </div>
        `;
    }
    
    displayResults(result) {
        // Temel istatistikleri göster
        this.displayBasicStats(result.analysis.current_data);
        
        // Grafikleri göster
        this.displayCharts(result.charts);
        
        // Kategori tablosunu göster
        this.displayCategoryTable(result.analysis.current_data.categories);
        
        // Karşılaştırma bölümünü göster (eğer varsa)
        if (result.analysis.comparison) {
            this.displayComparison(result.analysis.comparison);
        } else if (result.analysis.no_data_message) {
            this.displayNoDataMessage(result.analysis.no_data_message);
        }
        
        // Trend bölümünü göster (eğer varsa)
        if (result.analysis.historical_trend) {
            this.displayTrend(result.analysis.historical_trend);
        }
        
        // AI yorumunu göster
        this.displayAISummary(result.ai_comment);
        
        // Yeni dosya bilgisi varsa göster
        if (result.fileName && !result.reanalyzed) {
            this.displayUploadSuccess(result.fileName, result.analysis.total_previous_weeks + 1);
        }
        
        // Sonuçları göster
        this.showResults();
        
        // Geçmiş verileri otomatik yenile
        this.loadHistoricalData();
    }
    
    displayBasicStats(currentData) {
        document.getElementById('totalTasks').textContent = currentData.total_tasks;
        document.getElementById('totalCategories').textContent = Object.keys(currentData.categories).length;
        
        const date = new Date(currentData.date);
        document.getElementById('recordDate').textContent = date.toLocaleDateString('tr-TR');
    }
    
    displayCharts(charts) {
        // Pasta grafik
        if (charts.pie) {
            const pieChart = document.getElementById('pieChart');
            pieChart.src = `data:image/png;base64,${charts.pie}`;
            pieChart.style.display = 'block';
        }
        
        // Çubuk grafik  
        if (charts.bar) {
            const barChart = document.getElementById('barChart');
            barChart.src = `data:image/png;base64,${charts.bar}`;
            barChart.style.display = 'block';
        }
        
        // Karşılaştırma grafiği
        if (charts.comparison) {
            const comparisonChart = document.getElementById('comparisonChart');
            comparisonChart.src = `data:image/png;base64,${charts.comparison}`;
            comparisonChart.style.display = 'block';
        }
    }
    
    displayCategoryTable(categories) {
        const tbody = document.querySelector('#categoryTable tbody');
        tbody.innerHTML = '';
        
        const total = Object.values(categories).reduce((sum, count) => sum + count, 0);
        
        // Kategorileri sayıya göre sırala
        const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        
        sortedCategories.forEach(([category, count]) => {
            const percentage = ((count / total) * 100).toFixed(1);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${category}</strong></td>
                <td>${count}</td>
                <td>${percentage}%</td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    displayComparison(comparison) {
        const section = document.getElementById('comparison-section');
        section.style.display = 'block';
        
        // Karşılaştırma türüne göre başlık
        let comparisonTitle, comparisonInfo;
        
        if (comparison.average_info) {
            // Ortalama ile karşılaştırma
            comparisonTitle = '<h3><i class="fas fa-chart-line"></i> Geçmiş Veriler Ortalaması ile Karşılaştırma</h3>';
            comparisonInfo = `
                <div class="comparison-info">
                    <p><strong>Karşılaştırma Türü:</strong> ${comparison.average_info.total_weeks_used} haftalık geçmiş veri ortalaması</p>
                    <p><strong>Ortalama Toplam Görev:</strong> ${comparison.average_info.average_total.toFixed(1)}</p>
                </div>
            `;
        } else if (comparison.previous_week_info) {
            // Tek hafta karşılaştırması (eski sistem)
            comparisonTitle = '<h3><i class="fas fa-balance-scale"></i> Geçen Hafta ile Karşılaştırma</h3>';
            comparisonInfo = `
                <div class="comparison-info">
                    <p><strong>Karşılaştırılan Hafta:</strong> ${comparison.previous_week_info.filename} 
                       <span class="comparison-date">(${new Date(comparison.previous_week_info.date).toLocaleDateString('tr-TR')})</span>
                    </p>
                </div>
            `;
        } else {
            comparisonTitle = '<h3><i class="fas fa-balance-scale"></i> Karşılaştırma</h3>';
            comparisonInfo = '';
        }
        
        section.innerHTML = `
            ${comparisonTitle}
            ${comparisonInfo}
            
            <!-- Karşılaştırma Özeti -->
            <div class="comparison-stats">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="stat-content">
                        <h4>${comparison.average_info ? 'Ortalama' : 'Geçen Hafta'}</h4>
                        <span id="prevWeekTotal" class="stat-number">${comparison.toplam_analiz.gecen_hafta_toplam}</span>
                        <span class="stat-label">Toplam Görev</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="stat-content">
                        <h4>Bu Hafta</h4>
                        <span class="stat-number">${comparison.toplam_analiz.bu_hafta_toplam}</span>
                        <span class="stat-label">Toplam Görev</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-arrow-${comparison.toplam_analiz.toplam_degisim >= 0 ? 'up' : 'down'}"></i>
                    </div>
                    <div class="stat-content">
                        <h4>Değişim</h4>
                        <span id="changeAmount" class="stat-number ${comparison.toplam_analiz.toplam_degisim > 0 ? 'change-increase' : comparison.toplam_analiz.toplam_degisim < 0 ? 'change-decrease' : 'change-neutral'}">
                            ${comparison.toplam_analiz.toplam_degisim > 0 ? '+' : ''}${comparison.toplam_analiz.toplam_degisim}
                        </span>
                        <span class="stat-label">Görev Sayısı (${comparison.toplam_analiz.toplam_degisim_yuzde > 0 ? '+' : ''}${comparison.toplam_analiz.toplam_degisim_yuzde}%)</span>
                    </div>
                </div>
            </div>

            <!-- Karşılaştırma Grafiği -->
            <div id="comparisonChartContainer" class="chart-container">
                <img id="comparisonChart" src="" alt="Karşılaştırma Grafiği" style="display: none; width: 100%; max-width: 800px;">
            </div>

            <!-- Kategori Değişimleri Tablosu -->
            <div class="table-container">
                <h4><i class="fas fa-table"></i> Kategori Karşılaştırma Detayları</h4>
                <table id="comparisonTable" class="category-table">
                    <thead>
                        <tr>
                            <th>Kategori</th>
                            <th>${comparison.average_info ? 'Ortalama' : 'Geçen Hafta'}</th>
                            <th>Bu Hafta</th>
                            <th>Değişim</th>
                            <th>Değişim %</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        `;
        
        // Karşılaştırma tablosunu doldur
        this.displayComparisonTable(comparison.kategori_analizi);
    }
    
    displayComparisonTable(categoryComparison) {
        const tbody = document.querySelector('#comparisonTable tbody');
        tbody.innerHTML = '';
        
        // Kategorileri duruma göre sırala: Yeni kategoriler, Artış, Azalış, Değişmez
        const sortedCategories = categoryComparison.sort((a, b) => {
            // Yeni kategoriler önce
            if (a.gecen_hafta === 0 && b.gecen_hafta !== 0) return -1;
            if (a.gecen_hafta !== 0 && b.gecen_hafta === 0) return 1;
            
            // Sonra değişim miktarına göre
            return Math.abs(b.degisim) - Math.abs(a.degisim);
        });
        
        sortedCategories.forEach(item => {
            const row = document.createElement('tr');
            
            // Renk ve ikon belirleme
            let changeClass, statusText, statusIcon, rowClass;
            
            if (item.gecen_hafta === 0 && item.bu_hafta > 0) {
                // Yeni kategori (ortalamada hiç yokmuş)
                changeClass = 'change-new';
                statusText = 'YENİ KATEGORİ';
                statusIcon = 'fas fa-plus-circle';
                rowClass = 'row-new-category';
            } else if (item.degisim > 0) {
                // Artış - Kırmızı
                changeClass = 'change-increase';
                statusText = 'ARTIŞ';
                statusIcon = 'fas fa-arrow-up';
                rowClass = 'row-increase';
            } else if (item.degisim < 0) {
                // Azalış - Yeşil
                changeClass = 'change-decrease';
                statusText = 'AZALIŞ';
                statusIcon = 'fas fa-arrow-down';
                rowClass = 'row-decrease';
            } else {
                // Değişmez
                changeClass = 'change-neutral';
                statusText = 'AYNI';
                statusIcon = 'fas fa-minus';
                rowClass = 'row-neutral';
            }
            
            const changeText = item.degisim > 0 ? `+${item.degisim}` : item.degisim;
            const changePercentText = item.degisim_yuzde > 0 ? `+${item.degisim_yuzde}%` : `${item.degisim_yuzde}%`;
            
            // Ortalama değerleri formatla (eğer ondalıklıysa)
            const avgDisplay = item.gecen_hafta === 0 ? '-' : 
                              (item.gecen_hafta % 1 === 0 ? item.gecen_hafta : item.gecen_hafta.toFixed(1));
            
            row.className = rowClass;
            row.innerHTML = `
                <td><strong>${item.kategori}</strong></td>
                <td class="text-center">${avgDisplay}</td>
                <td class="text-center">${item.bu_hafta}</td>
                <td class="text-center ${changeClass}">${item.gecen_hafta === 0 ? `+${item.bu_hafta}` : changeText}</td>
                <td class="text-center ${changeClass}">${item.gecen_hafta === 0 ? '+100%' : changePercentText}</td>
                <td class="text-center">
                    <span class="status-badge ${changeClass}">
                        <i class="${statusIcon}"></i> ${statusText}
                    </span>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    displayTrend(trend) {
        const section = document.getElementById('trend-section');
        section.style.display = 'block';
        
        const content = document.getElementById('trendContent');
        
        let trendHTML = `
            <p><strong>Genel Trend:</strong> ${trend.trend_direction === 'artan' ? 
                '<span class="change-positive">↗ Artış trendi</span>' : 
                '<span class="change-negative">↘ Azalış trendi</span>'}</p>
            <p><strong>Son Haftalar:</strong></p>
            <ul>
        `;
        
        trend.weekly_trend.forEach((week, index) => {
            const date = new Date(week.week_start).toLocaleDateString('tr-TR');
            trendHTML += `<li>${date}: ${week.total} görev</li>`;
        });
        
        trendHTML += '</ul>';
        content.innerHTML = trendHTML;
    }
    
    displayAISummary(aiComment) {
        console.log('AI Comment received:', aiComment);
        
        const aiSummary = document.getElementById('aiSummary');
        
        if (aiComment) {
            let formattedComment = aiComment
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
            
            aiSummary.innerHTML = formattedComment;
        } else {
            aiSummary.innerHTML = '<div class="loading-content"><i class="fas fa-exclamation-circle"></i> AI yorumu oluşturulamadı</div>';
        }
        
        // Rapor oluşturma bölümünü göster
        this.showReportCreationSection();
    }

    displayMultiPartAnalysis(aiComment) {
        console.log('Displaying multi-part analysis');
        
        // 2 bölümü parse et
        const sections = this.parseMultiPartAnalysis(aiComment);
        
        // Her bölümü ilgili div'e yerleştir
        this.updateAnalysisSection('increasedReasons', sections.increasedReasons);
        this.updateAnalysisSection('preventiveMeasures', sections.preventiveMeasures);
        
        // Bölümleri göster (zaten container gösterildi)
        document.getElementById('increased-reasons-section').style.display = 'block';
        document.getElementById('preventive-measures-section').style.display = 'block';
        
        // Fallback div'i gizle
        document.getElementById('aiSummary').style.display = 'none';
    }

    displaySimpleAISummary(aiComment) {
        console.log('Displaying simple AI summary');
        
        const aiSummary = document.getElementById('aiSummary');
        
        if (aiComment) {
            let formattedComment = aiComment
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
            
            aiSummary.innerHTML = formattedComment;
        } else {
            aiSummary.innerHTML = '<div class="loading-content"><i class="fas fa-exclamation-circle"></i> AI yorumu oluşturulamadı</div>';
        }
        
        // 2 bölümlü div'leri gizle ve fallback'i göster
        document.getElementById('increased-reasons-section').style.display = 'none';
        document.getElementById('preventive-measures-section').style.display = 'none';
        document.getElementById('aiSummary').style.display = 'block';
    }

    parseMultiPartAnalysis(aiComment) {
        const sections = {
            increasedReasons: 'Analiz edilemedi',
            preventiveMeasures: 'Analiz edilemedi'
        };

        try {
            // ## başlıklarına göre böl
            const parts = aiComment.split('##');
            
            for (let part of parts) {
                const content = part.trim();
                if (!content) continue;
                
                if (content.includes('ARTAN TİCKETLARDAKİ SEBEPLER') || content.includes('ARTAN TİCKET SEBEPLERİ')) {
                    sections.increasedReasons = this.cleanContent(content);
                } else if (content.includes('ALINABİLECEK ÖNLEMLER')) {
                    sections.preventiveMeasures = this.cleanContent(content);
                }
            }
        } catch (error) {
            console.error('AI comment parsing error:', error);
        }

        return sections;
    }

    cleanContent(content) {
        // Başlığı temizle ve formatla
        return content
            .replace(/^[^:]*?:/g, '') // İlk başlığı kaldır
            .replace(/^.*?(🔍|🔄|🛡️|📊)/g, '') // Emoji'li başlıkları kaldır
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/---/g, '')
            .trim();
    }

    updateAnalysisSection(sectionId, content) {
        const element = document.getElementById(sectionId);
        if (element) {
            if (content && content !== 'Analiz edilemedi') {
                element.innerHTML = content;
            } else {
                element.innerHTML = '<div class="loading-content"><i class="fas fa-exclamation-circle"></i> Bu bölüm analiz edilemedi</div>';
            }
        }
    }

    hideMultiPartSections() {
        const sections = ['increased-reasons-section', 'recurring-problems-section', 'preventive-measures-section', 'overall-assessment-section'];
        sections.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.style.display = 'none';
            }
        });
    }
    
    showReportCreationSection() {
        document.getElementById('report-creation-section').style.display = 'block';
        document.getElementById('saved-reports-section').style.display = 'block';
        
        // Event listener'ları ekle
        this.setupReportCreationListeners();
    }
    
    setupReportCreationListeners() {
        // Rapor oluştur butonu
        const createReportBtn = document.getElementById('createReportBtn');
        if (createReportBtn && !createReportBtn.hasAttribute('data-listener-added')) {
            createReportBtn.addEventListener('click', () => {
                this.createWeeklyReport();
            });
            createReportBtn.setAttribute('data-listener-added', 'true');
        }
        
        // Raporları yükle butonu
        const loadReportsBtn = document.getElementById('loadReportsBtn');
        if (loadReportsBtn && !loadReportsBtn.hasAttribute('data-listener-added')) {
            loadReportsBtn.addEventListener('click', () => {
                this.loadSavedReports();
            });
            loadReportsBtn.setAttribute('data-listener-added', 'true');
        }
    }
    
    async createWeeklyReport() {
        const createBtn = document.getElementById('createReportBtn');
        const originalText = createBtn.innerHTML;
        
        // Input değerlerini al
        const incidentInfo = document.getElementById('incidentInfo').value.trim();
        const improvementSuggestions = document.getElementById('improvementSuggestions').value.trim();
        const additionalNotes = document.getElementById('additionalNotes').value.trim();
        const aiSummary = document.getElementById('aiSummary').textContent;
        
        // Loading durumu
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rapor Oluşturuluyor...';
        createBtn.disabled = true;
        
        try {
            const response = await fetch('/create_weekly_report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    incident_info: incidentInfo,
                    improvement_suggestions: improvementSuggestions,
                    additional_notes: additionalNotes,
                    ai_summary: aiSummary,
                    data_summary: this.currentData ? this.currentData.analysis.current_data : {}
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Formu temizle
                document.getElementById('incidentInfo').value = '';
                document.getElementById('improvementSuggestions').value = '';
                document.getElementById('additionalNotes').value = '';
                
                // Raporu göster
                this.showReportModal(result.report);
                
                // Kaydedilmiş raporları yenile
                this.loadSavedReports();
                
            } else {
                console.error('Rapor oluşturma hatası:', result.error);
            }
        } catch (error) {
            console.error('Bağlantı hatası:', error.message);
        } finally {
            createBtn.innerHTML = originalText;
            createBtn.disabled = false;
        }
    }
    
    async loadSavedReports() {
        const loadBtn = document.getElementById('loadReportsBtn');
        const originalText = loadBtn.innerHTML;
        
        loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
        loadBtn.disabled = true;
        
        try {
            const response = await fetch('/get_reports');
            const result = await response.json();
            
            if (response.ok) {
                this.displaySavedReports(result.reports);
            } else {
                console.error('Rapor yükleme hatası:', result.error);
            }
        } catch (error) {
            console.error('Bağlantı hatası:', error.message);
        } finally {
            loadBtn.innerHTML = originalText;
            loadBtn.disabled = false;
        }
    }
    
    displaySavedReports(reports) {
        const container = document.getElementById('reportsList');
        
        if (reports.length === 0) {
            container.innerHTML = `
                <div class="no-reports">
                    <div class="no-data-icon">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <h4>Henüz Rapor Bulunmuyor</h4>
                    <p>İlk haftalık raporunuzu oluşturun.</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="reports-header">
                <h4><i class="fas fa-list"></i> Kaydedilmiş Raporlar (${reports.length} adet)</h4>
            </div>
            <div class="reports-grid">
        `;
        
        reports.forEach(report => {
            html += `
                <div class="report-card" data-report-id="${report.id}">
                    <div class="report-header">
                        <h5>${report.title}</h5>
                        <div class="report-badges">
                            ${report.has_incidents ? '<span class="badge incident-badge"><i class="fas fa-exclamation-triangle"></i> Incident</span>' : ''}
                            ${report.has_suggestions ? '<span class="badge suggestion-badge"><i class="fas fa-lightbulb"></i> Öneri</span>' : ''}
                        </div>
                    </div>
                    <div class="report-info">
                        <p><i class="fas fa-calendar"></i> ${report.formatted_date}</p>
                        <p class="report-preview">${report.preview}</p>
                    </div>
                    <div class="report-actions">
                        <button class="action-btn view-btn" onclick="window.taskAnalyzer.viewReport('${report.id}')" title="Görüntüle">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn delete-btn" onclick="window.taskAnalyzer.deleteReport('${report.id}')" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    async viewReport(reportId) {
        try {
            const response = await fetch(`/get_report/${reportId}`);
            const result = await response.json();
            
            if (response.ok) {
                this.showReportModal(result.report);
            } else {
                console.error('Rapor görüntüleme hatası:', result.error);
            }
        } catch (error) {
            console.error('Bağlantı hatası:', error.message);
        }
    }
    
    showReportModal(report) {
        const modal = document.getElementById('reportModal');
        const title = document.getElementById('modalReportTitle');
        const content = document.getElementById('modalReportContent');
        
        title.textContent = report.title;
        
        // Markdown'ı HTML'e çevir (basit bir yaklaşım)
        let htmlContent = report.full_report
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^\- (.*$)/gm, '<li>$1</li>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[h|l])/gm, '<p>')
            .replace(/(?<![h|i]>)$/gm, '</p>');
        
        content.innerHTML = `
            <div class="report-metadata">
                <p><strong>Oluşturulma Tarihi:</strong> ${new Date(report.date).toLocaleString('tr-TR')}</p>
                <p><strong>Hafta Başlangıcı:</strong> ${new Date(report.week_start).toLocaleDateString('tr-TR')}</p>
            </div>
            <div class="report-content">
                ${htmlContent}
            </div>
        `;
        
        modal.style.display = 'flex';
    }
    
    async deleteReport(reportId) {
        const confirmed = await this.showConfirmDialog(
            'Raporu Sil',
            'Bu raporu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
            'danger'
        );
        
        if (!confirmed) {
            return;
        }
        
        try {
            const response = await fetch(`/delete_report/${reportId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.loadSavedReports(); // Listeyi yenile
            } else {
                console.error('Rapor silme hatası:', result.error);
            }
        } catch (error) {
            console.error('Bağlantı hatası:', error.message);
        }
    }
    
    displayNoDataMessage(message) {
        const section = document.getElementById('comparison-section');
        section.style.display = 'block';
        section.innerHTML = `
            <div class="no-data-message">
                <h3><i class="fas fa-info-circle"></i> Bilgilendirme</h3>
                <div class="no-data-content">
                    <div class="no-data-icon">
                        <i class="fas fa-database"></i>
                    </div>
                    <p>${message}</p>
                    <p class="no-data-tip">
                        <strong>İpucu:</strong> Bir sonraki hafta Excel dosyası yüklediğinizde, 
                        bu hafta ile karşılaştırma yapılacak ve detaylı analiz sunulacak.
                    </p>
                </div>
            </div>
        `;
    }
    
    displayUploadSuccess(fileName, weekNumber) {
        // Başarılı yükleme mesajını geçici olarak göster
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.innerHTML = `
            <div class="success-content">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="success-text">
                    <h4>✅ Dosya Başarıyla Yüklendi!</h4>
                    <p><strong>Dosya Adı:</strong> ${fileName}</p>
                    <p><strong>Hafta Numarası:</strong> ${weekNumber}</p>
                    <p>Verileriniz sisteme kaydedildi ve analiz tamamlandı.</p>
                </div>
            </div>
        `;
        
        // 5 saniye sonra eski haline döndür ve event listener'ları tekrar ekle
        setTimeout(() => {
            this.resetUploadArea();
        }, 5000);
    }
    
    resetUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.innerHTML = `
            <div class="upload-icon">
                <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <div class="upload-text">
                <p>Excel dosyanızı buraya sürükleyin veya tıklayarak seçin</p>
                <p class="upload-formats">Desteklenen formatlar: .xlsx, .xls, .csv</p>
                <p class="upload-note">Format: A sütunu = Görevler, B sütunu = Kategoriler</p>
            </div>
            <input type="file" id="excelFile" accept=".xlsx,.xls,.csv" style="display: none;">
            <button type="button" class="upload-button" onclick="document.getElementById('excelFile').click()">
                <i class="fas fa-folder-open"></i> Dosya Seç
            </button>
        `;
        
        // Event listener'ları yeniden ekle
        document.getElementById('excelFile').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });
        
        this.setupDragAndDrop();
    }
    
    async loadHistoricalData() {
        const button = document.getElementById('loadHistoricalBtn');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
        button.disabled = true;
        
        try {
            const response = await fetch('/get_historical_data');
            const result = await response.json();
            
            if (response.ok) {
                this.displayHistoricalData(result.data);
                document.getElementById('compareWeeksBtn').style.display = 'inline-flex';
        } else {
                console.error('Geçmiş veri yükleme hatası:', result.error);
            }
        } catch (error) {
            console.error('Bağlantı hatası:', error.message);
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }
    
    displayHistoricalData(data) {
        const container = document.getElementById('historicalData');
        
        if (data.length === 0) {
            container.innerHTML = `
                <div class="no-historical-data">
                    <div class="no-data-icon">
                        <i class="fas fa-folder-open"></i>
                    </div>
                    <h4>Henüz Geçmiş Veri Bulunmuyor</h4>
                    <p>İlk Excel dosyanızı yükleyin ve sistemde kayıt oluşturun.</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="historical-header">
                <h4><i class="fas fa-history"></i> Geçmiş Haftalık Veriler (${data.length} hafta)</h4>
                <p class="historical-subtitle">Yüklediğiniz Excel dosyaları otomatik olarak sisteme kaydedilmiştir.</p>
            </div>
            <div class="historical-list">
        `;
        
        data.forEach((week, index) => {
            const categories = Object.entries(week.categories);
            const topCategories = categories.slice(0, 3);
            const moreCount = categories.length - 3;
            
            html += `
                <div class="historical-item" data-week-id="${week.id}">
                    <div class="week-main">
                        <div class="week-info">
                            <div class="week-header">
                                <div class="week-title">
                                    <h5>${week.display_filename}</h5>
                                    <span class="week-number">Hafta ${week.week_number}</span>
                                </div>
                                <div class="week-stats">
                                    <span class="week-total">${week.total_tasks} görev</span>
                                    <span class="week-categories">${categories.length} kategori</span>
                                </div>
                            </div>
                            <div class="week-details">
                                <p><i class="fas fa-file-excel"></i> <strong>Orijinal Dosya:</strong> ${week.original_filename}</p>
                                <p><i class="fas fa-clock"></i> <strong>Yüklenme:</strong> ${week.upload_date_formatted}</p>
                                <div class="categories-preview">
                                    <strong>Kategoriler:</strong>
                                    ${topCategories.map(([cat, count]) => 
                                        `<span class="category-pill">${cat}: ${count}</span>`
                                    ).join('')}
                                    ${moreCount > 0 ? `<span class="more-categories">+${moreCount} kategori</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="week-actions">
                            <button class="action-btn analyze-btn" onclick="window.taskAnalyzer.reanalyzeData('${week.id}')" title="Yeniden Analiz Et">
                                <i class="fas fa-sync-alt"></i> Yeniden Analiz
                            </button>
                            <button class="action-btn delete-btn" onclick="window.taskAnalyzer.deleteData('${week.id}')" title="Sil">
                                <i class="fas fa-trash"></i> Sil
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    async deleteData(dataId) {
        const confirmed = await this.showConfirmDialog(
            'Veriyi Sil',
            'Bu veriyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
            'danger'
        );
        
        if (!confirmed) {
            return;
        }
        
        try {
            const response = await fetch(`/delete_historical_data/${dataId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.loadHistoricalData(); // Listeyi yenile
            } else {
                console.error('Veri silme hatası:', result.error);
            }
        } catch (error) {
            console.error('Bağlantı hatası:', error.message);
        }
    }
    
    async reanalyzeData(dataId) {
        const button = event.target.closest('.analyze-btn');
        const originalContent = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
        
        try {
            const response = await fetch(`/reanalyze_data/${dataId}`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.currentData = result;
                this.displayResults(result);
            } else {
                console.error('Yeniden analiz hatası:', result.error);
            }
        } catch (error) {
            console.error('Bağlantı hatası:', error.message);
        } finally {
            button.innerHTML = originalContent;
            button.disabled = false;
        }
    }
    
    // Custom confirm dialog
    showConfirmDialog(title, message, type = 'default') {
        return new Promise((resolve) => {
            // Modal HTML oluştur
            const modalHTML = `
                <div id="confirmModal" class="confirm-modal">
                    <div class="confirm-modal-content">
                        <div class="confirm-modal-header ${type}">
                            <div class="confirm-icon">
                                <i class="fas ${type === 'danger' ? 'fa-exclamation-triangle' : 'fa-question-circle'}"></i>
                            </div>
                            <h3>${title}</h3>
                        </div>
                        <div class="confirm-modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="confirm-modal-footer">
                            <button class="confirm-btn cancel-btn" onclick="window.taskAnalyzer.closeConfirmDialog(false)">
                                <i class="fas fa-times"></i> İptal
                            </button>
                            <button class="confirm-btn confirm-btn-${type}" onclick="window.taskAnalyzer.closeConfirmDialog(true)">
                                <i class="fas ${type === 'danger' ? 'fa-trash' : 'fa-check'}"></i> 
                                ${type === 'danger' ? 'Sil' : 'Onayla'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Modal'ı sayfaya ekle
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Promise çözümlemesi için callback sakla
            this.confirmCallback = resolve;
        });
    }
    
    closeConfirmDialog(result) {
        const modal = document.getElementById('confirmModal');
        if (modal) {
            modal.remove();
        }
        
        if (this.confirmCallback) {
            this.confirmCallback(result);
            this.confirmCallback = null;
        }
    }
}

// Global fonksiyonlar (eski template uyumluluğu için)
function switchTab(tabName) {
    // Artık kullanılmıyor ama uyumluluk için bırakıldı
    console.log('switchTab called but not needed in new system');
}

function analyzeReports() {
    // Artık kullanılmıyor ama uyumluluk için bırakıldı
    console.log('analyzeReports called but not needed in new system');
}

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', () => {
    // Scroll problemini çözmek için
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    window.scrollTo(0, 0);
    
    window.taskAnalyzer = new TaskAnalyzer();
});

// Modal kapatma fonksiyonu (global)
function closeReportModal() {
    document.getElementById('reportModal').style.display = 'none';
}

// CSS için gerekli stiller (dinamik olarak ekleme)
const additionalStyles = `
    /* Hata ve başarı mesajları */
    .error-content, .success-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
        padding: 20px;
        text-align: center;
    }
    
    .error-icon {
        font-size: 3rem;
        color: #dc3545;
    }
    
    .success-icon {
        font-size: 3rem;
        color: #28a745;
    }
    
    .success-text h4 {
        color: #28a745;
        margin: 0 0 10px 0;
    }
    
    .success-text p {
        margin: 5px 0;
        color: #666;
    }
    
    /* Veri yok mesajları */
    .no-data-message, .no-historical-data {
        text-align: center;
        padding: 40px 20px;
        background: #f8f9fa;
        border-radius: 12px;
        border: 2px dashed #dee2e6;
    }
    
    .no-data-content {
        max-width: 500px;
        margin: 0 auto;
    }
    
    .no-data-icon {
        font-size: 3rem;
        color: #6c757d;
        margin-bottom: 15px;
    }
    
    .no-data-tip {
        background: #e3f2fd;
        border: 1px solid #bbdefb;
        border-radius: 8px;
        padding: 15px;
        margin-top: 20px;
        color: #1565c0;
        font-size: 14px;
    }
    
    /* Geçmiş veriler arayüzü */
    .historical-header {
        margin-bottom: 20px;
        text-align: center;
    }
    
    .historical-subtitle {
        color: #666;
        font-size: 14px;
        margin: 10px 0;
    }
    
    .historical-item {
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 12px;
        margin-bottom: 15px;
        transition: all 0.3s ease;
        overflow: hidden;
    }
    
    .historical-item:hover {
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }
    
    .week-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
    }
    
    .week-info {
        flex: 1;
    }
    
    .week-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }
    
    .week-title h5 {
        margin: 0;
        color: #333;
        font-size: 16px;
        font-weight: 600;
    }
    
    .week-number {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 4px 12px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: 600;
        margin-left: 10px;
    }
    
    .week-stats {
        display: flex;
        gap: 10px;
    }
    
    .week-total {
        background: #28a745;
        color: white;
        padding: 4px 12px;
        border-radius: 15px;
        font-size: 12px;
        font-weight: 600;
    }
    
    .week-categories {
        background: #17a2b8;
        color: white;
        padding: 4px 12px;
        border-radius: 15px;
        font-size: 12px;
        font-weight: 600;
    }
    
    .week-details {
        color: #666;
        font-size: 14px;
    }
    
    .week-details p {
        margin: 8px 0;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .categories-preview {
        margin-top: 12px;
    }
    
    .categories-preview strong {
        color: #333;
        font-size: 13px;
    }
    
    .category-pill {
        background: #e8f4f8;
        border: 1px solid #bee5eb;
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 11px;
        color: #0c5460;
        margin: 2px;
        display: inline-block;
    }
    
    .more-categories {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 11px;
        color: #6c757d;
        margin: 2px;
        display: inline-block;
        font-style: italic;
    }
    
    /* Aksiyon butonları */
    .week-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-left: 20px;
    }
    
    .action-btn {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
    }
    
    .analyze-btn {
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        box-shadow: 0 3px 10px rgba(40, 167, 69, 0.3);
    }
    
    .analyze-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 5px 15px rgba(40, 167, 69, 0.4);
    }
    
    .delete-btn {
        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        color: white;
        box-shadow: 0 3px 10px rgba(220, 53, 69, 0.3);
    }
    
    .delete-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 5px 15px rgba(220, 53, 69, 0.4);
    }
    
    .action-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }
    
    /* Liste container */
    .historical-list {
        width: 100%;
        max-height: 600px;
        overflow-y: auto;
        padding-right: 10px;
    }
    
    /* Scrollbar styling */
    .historical-list::-webkit-scrollbar {
        width: 6px;
    }
    
    .historical-list::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    
    .historical-list::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    .historical-list::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
    
    /* Karşılaştırma renkleri */
    .change-increase {
        color: #dc3545 !important;
        font-weight: bold;
        background: rgba(220, 53, 69, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
    }
    
    .change-decrease {
        color: #28a745 !important;
        font-weight: bold;
        background: rgba(40, 167, 69, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
    }
    
    .change-new {
        color: #007bff !important;
        font-weight: bold;
        background: rgba(0, 123, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
    }
    
    /* Satır renkleri */
    .row-increase {
        background: rgba(220, 53, 69, 0.05);
        border-left: 4px solid #dc3545;
    }
    
    .row-decrease {
        background: rgba(40, 167, 69, 0.05);
        border-left: 4px solid #28a745;
    }
    
    .row-new-category {
        background: rgba(0, 123, 255, 0.05);
        border-left: 4px solid #007bff;
    }
    
    .row-neutral {
        background: rgba(108, 117, 125, 0.03);
        border-left: 4px solid #6c757d;
    }
    
    /* Status badge'lar */
    .status-badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    
    .status-badge.change-increase {
        background: #dc3545;
        color: white;
    }
    
    .status-badge.change-decrease {
        background: #28a745;
        color: white;
    }
    
    .status-badge.change-new {
        background: #007bff;
        color: white;
    }
    
    .status-badge.change-neutral {
        background: #6c757d;
        color: white;
    }
    
    /* Tablo hizalama */
    .text-center {
        text-align: center;
    }
    
    /* Karşılaştırma bilgileri */
    .comparison-info {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 20px;
        text-align: center;
    }
    
    .comparison-date {
        color: #6c757d;
        font-size: 14px;
    }
    
    /* Responsive tasarım */
    @media (max-width: 768px) {
        .week-main {
            flex-direction: column;
            gap: 15px;
        }
        
        .week-actions {
            flex-direction: row;
            justify-content: center;
            margin-left: 0;
        }
        
        .week-header {
            flex-direction: column;
            gap: 10px;
            text-align: center;
        }
        
        .week-stats {
            justify-content: center;
        }
    }
    
    /* Rapor Oluşturma Bölümü Stilleri */
    .report-creation-section, .saved-reports-section {
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        padding: 25px;
        margin: 20px 0;
        border: 1px solid #e3e3e3;
    }
    
    .report-creation-section h3, .saved-reports-section h3 {
        color: #333;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .report-form .form-group {
        margin-bottom: 20px;
    }
    
    .report-form label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: #555;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .form-textarea {
        width: 100%;
        min-height: 100px;
        padding: 12px;
        border: 2px solid #e3e3e3;
        border-radius: 8px;
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
        transition: border-color 0.3s ease;
        box-sizing: border-box;
    }
    
    .form-textarea:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 3px rgba(0,123,255,0.1);
    }
    
    .form-actions {
        text-align: center;
        margin-top: 25px;
    }
    
    .create-report-btn {
        background: linear-gradient(135deg, #007bff, #0056b3);
        color: white;
        border: none;
        padding: 15px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: inline-flex;
        align-items: center;
        gap: 10px;
    }
    
    .create-report-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, #0056b3, #004085);
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0,123,255,0.3);
    }
    
    .create-report-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }
    
    /* Rapor Listesi Stilleri */
    .reports-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 20px;
        margin-top: 20px;
    }
    
    .report-card {
        background: white;
        border: 1px solid #e3e3e3;
        border-radius: 8px;
        padding: 20px;
        transition: all 0.3s ease;
    }
    
    .report-card:hover {
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        transform: translateY(-2px);
    }
    
    .report-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 15px;
    }
    
    .report-header h5 {
        margin: 0;
        color: #333;
        font-size: 16px;
    }
    
    .report-badges {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
    }
    
    .badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    
    .incident-badge {
        background: #dc3545;
        color: white;
    }
    
    .suggestion-badge {
        background: #28a745;
        color: white;
    }
    
    .report-info p {
        margin: 5px 0;
        color: #666;
        font-size: 14px;
    }
    
    .report-preview {
        font-style: italic;
        color: #888 !important;
    }
    
    .report-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
        justify-content: flex-end;
    }
    
    .action-btn {
        background: transparent;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: inline-flex;
        align-items: center;
        font-size: 14px;
    }
    
    .view-btn:hover {
        background: #007bff;
        color: white;
        border-color: #007bff;
    }
    
    .delete-btn:hover {
        background: #dc3545;
        color: white;
        border-color: #dc3545;
    }
    
    /* Modal Stilleri */
    .report-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    }
    
    .modal-content {
        background: white;
        border-radius: 12px;
        max-width: 800px;
        width: 100%;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    
    .modal-header {
        padding: 20px 25px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8f9fa;
    }
    
    .modal-header h3 {
        margin: 0;
        color: #333;
        font-size: 18px;
    }
    
    .modal-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        padding: 5px;
        border-radius: 4px;
        transition: all 0.3s ease;
    }
    
    .modal-close:hover {
        background: #e9ecef;
        color: #333;
    }
    
    .modal-body {
        padding: 25px;
        overflow-y: auto;
        flex: 1;
    }
    
    .report-metadata {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        border-left: 4px solid #007bff;
    }
    
    .report-content {
        line-height: 1.6;
    }
    
    .report-content h1, .report-content h2, .report-content h3 {
        color: #333;
        margin-top: 25px;
        margin-bottom: 15px;
    }
    
    .report-content h1 {
        font-size: 24px;
        border-bottom: 2px solid #007bff;
        padding-bottom: 10px;
    }
    
    .report-content h2 {
        font-size: 20px;
        color: #007bff;
    }
    
    .report-content h3 {
        font-size: 18px;
        color: #555;
    }
    
    .report-content li {
        margin: 8px 0;
        list-style-position: inside;
    }
    
    .report-content p {
        margin: 10px 0;
        color: #555;
    }
    
    .no-reports {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }
    
    .no-reports .no-data-icon {
        font-size: 48px;
        color: #ddd;
        margin-bottom: 15px;
    }
    
    /* Custom Confirm Modal Stilleri */
    .confirm-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .confirm-modal-content {
        background: white;
        border-radius: 15px;
        max-width: 450px;
        width: 90%;
        max-height: 90vh;
        overflow: hidden;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease;
    }
    
    @keyframes slideIn {
        from { 
            transform: translateY(-50px);
            opacity: 0;
        }
        to { 
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    .confirm-modal-header {
        padding: 25px;
        text-align: center;
        border-bottom: 2px solid #f0f0f0;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    }
    
    .confirm-modal-header.danger {
        background: linear-gradient(135deg, #ffe6e6 0%, #ffd6d6 100%);
        border-bottom-color: #ff9999;
    }
    
    .confirm-icon {
        font-size: 3rem;
        margin-bottom: 15px;
        color: #6c757d;
    }
    
    .confirm-modal-header.danger .confirm-icon {
        color: #dc3545;
    }
    
    .confirm-modal-header h3 {
        margin: 0;
        color: #333;
        font-size: 20px;
        font-weight: 600;
    }
    
    .confirm-modal-body {
        padding: 25px;
        text-align: center;
        color: #666;
        font-size: 16px;
        line-height: 1.5;
    }
    
    .confirm-modal-body p {
        margin: 0;
    }
    
    .confirm-modal-footer {
        padding: 20px 25px;
        background: #f8f9fa;
        display: flex;
        gap: 15px;
        justify-content: center;
        border-top: 1px solid #e9ecef;
    }
    
    .confirm-btn {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 120px;
        justify-content: center;
    }
    
    .cancel-btn {
        background: #6c757d;
        color: white;
    }
    
    .cancel-btn:hover {
        background: #5a6268;
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(108, 117, 125, 0.3);
    }
    
    .confirm-btn-danger {
        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        color: white;
    }
    
    .confirm-btn-danger:hover {
        background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(220, 53, 69, 0.4);
    }
    
    .confirm-btn-default {
        background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
        color: white;
    }
    
    .confirm-btn-default:hover {
        background: linear-gradient(135deg, #0056b3 0%, #004085 100%);
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0, 123, 255, 0.4);
    }
    
    /* Mobile responsive */
    @media (max-width: 480px) {
        .confirm-modal-content {
            width: 95%;
            margin: 20px;
        }
        
        .confirm-modal-footer {
            flex-direction: column;
        }
        
        .confirm-btn {
            width: 100%;
        }
    }
`;

// Stilleri sayfaya ekle
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);