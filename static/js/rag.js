// RAG Page JavaScript
class RAGSystem {
    constructor() {
        this.referenceFile = null;
        this.targetFile = null;
        this.resultData = null;
        
        this.init();
    }
    
    init() {
        this.setupFileUpload();
        this.setupEventListeners();
    }
    
    setupFileUpload() {
        // Reference file upload
        const referenceUploadArea = document.getElementById('referenceUploadArea');
        const referenceFileInput = document.getElementById('referenceFile');
        
        // Target file upload
        const targetUploadArea = document.getElementById('targetUploadArea');
        const targetFileInput = document.getElementById('targetFile');
        
        this.setupUploadArea(referenceUploadArea, referenceFileInput, 'reference');
        this.setupUploadArea(targetUploadArea, targetFileInput, 'target');
    }
    
    setupUploadArea(uploadArea, fileInput, type) {
        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // File selection
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelection(file, type);
            }
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type === 'text/xml' || file.name.endsWith('.xml')) {
                    this.handleFileSelection(file, type);
                } else {
                    this.showMessage('Lütfen geçerli bir XML dosyası seçin.', 'error');
                }
            }
        });
    }
    
    handleFileSelection(file, type) {
        if (!file.name.endsWith('.xml')) {
            this.showMessage('Lütfen XML dosyası seçin.', 'error');
            return;
        }
        
        if (type === 'reference') {
            this.referenceFile = file;
            this.showFileInfo(file, 'reference');
        } else {
            this.targetFile = file;
            this.showFileInfo(file, 'target');
        }
        
        this.updateCategorizeButton();
    }
    
    showFileInfo(file, type) {
        const uploadArea = document.getElementById(`${type}UploadArea`);
        const fileInfo = document.getElementById(`${type}FileInfo`);
        const fileName = fileInfo.querySelector('.file-name');
        
        uploadArea.style.display = 'none';
        fileName.textContent = file.name;
        fileInfo.style.display = 'flex';
    }
    
    removeFile(type) {
        if (type === 'reference') {
            this.referenceFile = null;
            document.getElementById('referenceFile').value = '';
        } else {
            this.targetFile = null;
            document.getElementById('targetFile').value = '';
        }
        
        const uploadArea = document.getElementById(`${type}UploadArea`);
        const fileInfo = document.getElementById(`${type}FileInfo`);
        
        uploadArea.style.display = 'block';
        fileInfo.style.display = 'none';
        
        this.updateCategorizeButton();
    }
    
    updateCategorizeButton() {
        const categorizeBtn = document.getElementById('categorizeBtn');
        const hasFiles = this.referenceFile && this.targetFile;
        
        categorizeBtn.disabled = !hasFiles;
        
        if (hasFiles) {
            categorizeBtn.innerHTML = '<i class="fas fa-magic"></i> Kategorize Et';
        } else {
            categorizeBtn.innerHTML = '<i class="fas fa-magic"></i> Dosyaları Seçin';
        }
    }
    
    setupEventListeners() {
        const categorizeBtn = document.getElementById('categorizeBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const viewDetailsBtn = document.getElementById('viewDetailsBtn');
        
        categorizeBtn.addEventListener('click', () => {
            this.startCategorization();
        });
        
        downloadBtn.addEventListener('click', () => {
            this.downloadResult();
        });
        
        viewDetailsBtn.addEventListener('click', () => {
            this.toggleDetailsView();
        });
        
        // Remove file buttons
        window.removeFile = (type) => {
            this.removeFile(type);
        };
    }
    
    async startCategorization() {
        if (!this.referenceFile || !this.targetFile) {
            this.showMessage('Lütfen her iki dosyayı da yükleyin.', 'error');
            return;
        }
        
        this.showLoadingModal();
        
        try {
            // Create FormData
            const formData = new FormData();
            formData.append('reference_file', this.referenceFile);
            formData.append('target_file', this.targetFile);
            
            // Send request
            const response = await fetch('/rag_categorize', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.resultData = result;
                this.showResults(result);
                this.showMessage('Kategorize etme işlemi başarıyla tamamlandı!', 'success');
            } else {
                throw new Error(result.error || 'Bilinmeyen bir hata oluştu');
            }
            
        } catch (error) {
            console.error('Categorization error:', error);
            this.showMessage(`Hata: ${error.message}`, 'error');
        } finally {
            this.hideLoadingModal();
        }
    }
    
    showLoadingModal() {
        const modal = document.getElementById('loadingModal');
        modal.style.display = 'flex';
        
        // Simulate steps
        const steps = ['step1', 'step2', 'step3', 'step4', 'step5'];
        const stepTexts = [
            'Dosyalar yükleniyor...',
            'Referans veriler işleniyor...',
            'AI modeli hazırlanıyor...',
            'Kategorize ediliyor...',
            'Sonuçlar hazırlanıyor...'
        ];
        
        let currentStep = 0;
        
        const updateStep = () => {
            if (currentStep > 0) {
                document.getElementById(steps[currentStep - 1]).classList.remove('active');
                document.getElementById(steps[currentStep - 1]).classList.add('completed');
            }
            
            if (currentStep < steps.length) {
                document.getElementById(steps[currentStep]).classList.add('active');
                document.getElementById('loadingText').textContent = stepTexts[currentStep];
                currentStep++;
                
                setTimeout(updateStep, 2000 + Math.random() * 1000);
            }
        };
        
        updateStep();
    }
    
    hideLoadingModal() {
        const modal = document.getElementById('loadingModal');
        modal.style.display = 'none';
        
        // Reset steps
        const steps = document.querySelectorAll('.step');
        steps.forEach(step => {
            step.classList.remove('active', 'completed');
        });
    }
    
    showResults(result) {
        const resultSection = document.getElementById('resultSection');
        const resultStats = document.getElementById('resultStats');
        
        // Show stats
        const stats = result.stats || {};
        resultStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-number">${stats.total_processed || 0}</span>
                <div class="stat-label">İşlenen Sorun</div>
            </div>
            <div class="stat-item">
                <span class="stat-number">${stats.categories_found || 0}</span>
                <div class="stat-label">Farklı Kategori</div>
            </div>
            <div class="stat-item">
                <span class="stat-number">${stats.avg_confidence || 0}%</span>
                <div class="stat-label">Ortalama Güven</div>
            </div>
            <div class="stat-item">
                <span class="stat-number">${stats.processing_time || 0}s</span>
                <div class="stat-label">İşlem Süresi</div>
            </div>
        `;
        
        // Show table data
        this.populateDetailsTable(result.categorized_data || []);
        
        resultSection.style.display = 'block';
        resultSection.classList.add('fade-in');
    }
    
    populateDetailsTable(data) {
        const tableBody = document.querySelector('#categorizedTable tbody');
        tableBody.innerHTML = '';
        
        data.forEach(item => {
            const row = document.createElement('tr');
            
            const confidenceClass = this.getConfidenceClass(item.confidence);
            
            row.innerHTML = `
                <td>${this.truncateText(item.problem, 80)}</td>
                <td>${item.category}</td>
                <td><span class="confidence-score ${confidenceClass}">${item.confidence}%</span></td>
                <td>${this.truncateText(item.similar_reference, 60)}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    getConfidenceClass(confidence) {
        if (confidence >= 80) return 'confidence-high';
        if (confidence >= 60) return 'confidence-medium';
        return 'confidence-low';
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    toggleDetailsView() {
        const detailsTable = document.getElementById('detailsTable');
        const btn = document.getElementById('viewDetailsBtn');
        
        if (detailsTable.style.display === 'none' || !detailsTable.style.display) {
            detailsTable.style.display = 'block';
            detailsTable.classList.add('slide-up');
            btn.innerHTML = '<i class="fas fa-eye-slash"></i> Detayları Gizle';
        } else {
            detailsTable.style.display = 'none';
            btn.innerHTML = '<i class="fas fa-eye"></i> Detayları Görüntüle';
        }
    }
    
    async downloadResult() {
        if (!this.resultData || !this.resultData.download_url) {
            this.showMessage('İndirilebilir dosya bulunamadı.', 'error');
            return;
        }
        
        try {
            const response = await fetch(this.resultData.download_url);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.resultData.filename || 'kategorize_edilmis_dosya.xml';
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            window.URL.revokeObjectURL(url);
            
            this.showMessage('Dosya başarıyla indirildi!', 'success');
            
        } catch (error) {
            console.error('Download error:', error);
            this.showMessage('Dosya indirme hatası!', 'error');
        }
    }
    
    showMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());
        
        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const icon = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle';
        messageDiv.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        // Insert at top of container
        const container = document.querySelector('.rag-container');
        container.insertBefore(messageDiv, container.firstChild);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new RAGSystem();
});

// Utility functions for error handling
window.addEventListener('error', (e) => {
    console.error('JavaScript error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});
