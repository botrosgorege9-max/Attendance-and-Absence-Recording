/**
 * Scanner.js - ماسح الرمز السريع المتطور
 * Advanced QR Scanner Module supporting Webcams, Native BarcodeDetector, File Uploads
 */

const ScannerModule = {
    html5QrCode: null,
    isScanning: false,
    selectedCameraId: null,
    lastScannedData: null,
    lastScanTimestamp: 0,
    scanCooldownMs: 2500, // Cooldown to avoid repeat scans

    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Mode buttons
        document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                App.state.settings.scannerMode = btn.getAttribute('data-mode');
                App.saveState();
                App.showToast(`تم تغيير وضع الماسح إلى: ${btn.textContent.trim()}`, 'info');
            });
        });

        // Camera select dropdown
        const cameraSelect = document.getElementById('camera-select');
        if (cameraSelect) {
            cameraSelect.addEventListener('change', (e) => {
                this.selectedCameraId = e.target.value;
                if (this.isScanning) {
                    this.stopScanner().then(() => this.startScanner());
                }
            });
        }

        // Toggle camera start/stop button
        const btnToggleCam = document.getElementById('btn-toggle-camera');
        if (btnToggleCam) {
            btnToggleCam.addEventListener('click', () => {
                if (this.isScanning) {
                    this.stopScanner();
                    btnToggleCam.innerHTML = '<i class="fas fa-video"></i> تشغيل الكاميرا';
                    btnToggleCam.classList.remove('btn-danger');
                    btnToggleCam.classList.add('btn-primary');
                } else {
                    this.startScanner();
                    btnToggleCam.innerHTML = '<i class="fas fa-video-slash"></i> إيقاف الكاميرا';
                    btnToggleCam.classList.remove('btn-primary');
                    btnToggleCam.classList.add('btn-danger');
                }
            });
        }

        // Image file scan fallback
        const fileInput = document.getElementById('qr-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleImageScan(e));
        }

        // Manual ID input trigger
        const manualInput = document.getElementById('scanner-manual-input');
        const manualBtn = document.getElementById('scanner-manual-submit');

        const triggerManual = () => {
            const val = manualInput.value.trim();
            if (val) {
                this.handleCodeDecoded(val);
                manualInput.value = '';
            }
        };

        if (manualBtn) manualBtn.addEventListener('click', triggerManual);
        if (manualInput) {
            manualInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') triggerManual();
            });
        }
    },

    // Populate available cameras
    async getCameras() {
        const select = document.getElementById('camera-select');
        if (!select) return;

        try {
            if (window.Html5Qrcode) {
                const devices = await Html5Qrcode.getCameras();
                select.innerHTML = '';
                if (devices && devices.length > 0) {
                    devices.forEach((cam, index) => {
                        const opt = document.createElement('option');
                        opt.value = cam.id;
                        opt.textContent = cam.label || `كاميرا ${index + 1}`;
                        select.appendChild(opt);
                    });
                    if (!this.selectedCameraId) {
                        // Prefer back camera if mobile, else first
                        const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('خلفية'));
                        this.selectedCameraId = backCam ? backCam.id : devices[0].id;
                        select.value = this.selectedCameraId;
                    }
                } else {
                    select.innerHTML = '<option value="">لا توجد كاميرات مكتشفة</option>';
                }
            }
        } catch(err) {
            console.warn('Error fetching cameras:', err);
            select.innerHTML = '<option value="">الكاميرا الافتراضية</option>';
        }
    },

    // Start Live QR Scanner
    async startScanner() {
        const readerEl = document.getElementById('reader');
        if (!readerEl) return;

        if (this.isScanning) return;

        await this.getCameras();

        try {
            if (window.Html5Qrcode) {
                if (!this.html5QrCode) {
                    this.html5QrCode = new Html5Qrcode('reader');
                }

                const config = {
                    fps: 15,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.333333
                };

                const cameraId = this.selectedCameraId || { facingMode: 'environment' };

                await this.html5QrCode.start(
                    cameraId,
                    config,
                    (decodedText) => this.handleCodeDecoded(decodedText),
                    (errorMessage) => {
                        // Continuous scanning ignore routine frame drops
                    }
                );

                this.isScanning = true;
                this.updateScannerStatus(true);
            } else {
                this.initNativeBarcodeScanner();
            }
        } catch(err) {
            console.error('Camera start error:', err);
            this.updateScannerStatus(false, 'تعذر فتح الكاميرا (تأكد من إعطاء إذن الوصول للكاميرا للمتصفح)');
            App.showToast('يرجى السماح للمتصفح باستخدام الكاميرا', 'warning');
        }
    },

    // Stop Live QR Scanner
    async stopScanner() {
        if (!this.isScanning) return;

        try {
            if (this.html5QrCode) {
                await this.html5QrCode.stop();
            }
        } catch(err) {
            console.warn('Error stopping scanner:', err);
        } finally {
            this.isScanning = false;
            this.updateScannerStatus(false);
        }
    },

    // Native BarcodeDetector Fallback (Supported out-of-the-box in Chrome & Edge)
    async initNativeBarcodeScanner() {
        if ('BarcodeDetector' in window) {
            try {
                const detector = new BarcodeDetector({ formats: ['qr_code'] });
                const video = document.getElementById('scanner-video');
                if (!video) return;

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                video.srcObject = stream;
                await video.play();
                this.isScanning = true;
                this.updateScannerStatus(true);

                const detectLoop = async () => {
                    if (!this.isScanning) return;
                    try {
                        const barcodes = await detector.detect(video);
                        if (barcodes.length > 0) {
                            this.handleCodeDecoded(barcodes[0].rawValue);
                        }
                    } catch(e){}
                    if (this.isScanning) requestAnimationFrame(detectLoop);
                };
                detectLoop();
            } catch(e) {
                this.updateScannerStatus(false, 'تعذر تشغيل الكاميرا المحلية');
            }
        } else {
            this.updateScannerStatus(false, 'المتصفح يحتاج مكتبة المسح. يرجى التأكد من الاتصال بالإنترنت أول مرة أو مسح صورة.');
        }
    },

    // Scan from Image file fallback
    async handleImageScan(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            if (window.Html5Qrcode) {
                if (!this.html5QrCode) {
                    this.html5QrCode = new Html5Qrcode('reader');
                }
                const result = await this.html5QrCode.scanFile(file, true);
                this.handleCodeDecoded(result);
            } else if ('BarcodeDetector' in window) {
                const detector = new BarcodeDetector({ formats: ['qr_code'] });
                const img = new Image();
                img.src = URL.createObjectURL(file);
                img.onload = async () => {
                    const barcodes = await detector.detect(img);
                    if (barcodes.length > 0) {
                        this.handleCodeDecoded(barcodes[0].rawValue);
                    } else {
                        App.showToast('لم يتم العثور على رمز QR داخل الصورة', 'warning');
                    }
                };
            }
        } catch(err) {
            App.showToast('فشل قراءة الرمز من الصورة', 'danger');
        }
    },

    // Process Decoded QR Code
    handleCodeDecoded(decodedText) {
        const now = Date.now();
        // Check cooldown to prevent rapid multi-scans
        if (this.lastScannedData === decodedText && (now - this.lastScanTimestamp) < this.scanCooldownMs) {
            return;
        }

        this.lastScannedData = decodedText;
        this.lastScanTimestamp = now;

        // Process Attendance
        const res = AttendanceModule.processScan(decodedText);
        this.renderScanResult(res);

        if (res.success) {
            App.playSound('success');
            App.showToast(res.message, 'success');
        } else {
            if (res.type === 'not_found') {
                App.playSound('error');
                App.showToast(res.message, 'danger');
            } else {
                App.playSound('warning');
                App.showToast(res.message, 'warning');
            }
        }
    },

    // Render result details in UI
    renderScanResult(result) {
        const resultCard = document.getElementById('last-scan-container');
        if (!resultCard) return;

        // Clear animations
        resultCard.classList.remove('success-pulse', 'warning-pulse', 'danger-pulse');
        void resultCard.offsetWidth; // trigger reflow

        if (result.success) {
            resultCard.classList.add('success-pulse');
            const m = result.member;
            resultCard.innerHTML = `
                <div class="member-avatar-lg">
                    ${m.name.charAt(0)}
                </div>
                <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.25rem;">${m.name}</h3>
                <span class="badge ${result.status === 'متأخر' ? 'badge-warning' : 'badge-success'}" style="font-size: 0.95rem; margin-bottom: 0.75rem;">
                    <i class="fas fa-check-circle"></i> تم تسجيل ${result.action} (${result.status})
                </span>

                <div class="scan-details-list">
                    <div class="detail-row">
                        <span>رقم المعرف:</span>
                        <span style="font-family: monospace;">${m.id}</span>
                    </div>
                    <div class="detail-row">
                        <span>القسم / الصف:</span>
                        <span>${m.department || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span>الوظيفة / الدور:</span>
                        <span>${m.role || '-'}</span>
                    </div>
                    <div class="detail-row">
                        <span>التوقيت:</span>
                        <span style="color: var(--primary);">${result.time}</span>
                    </div>
                </div>

                <div style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted);">
                    جاهز للمسح التالي...
                </div>
            `;
        } else {
            const isWarning = result.type !== 'not_found';
            resultCard.classList.add(isWarning ? 'warning-pulse' : 'danger-pulse');

            resultCard.innerHTML = `
                <div class="member-avatar-lg" style="background: ${isWarning ? 'var(--warning)' : 'var(--danger)'};">
                    <i class="fas ${isWarning ? 'fa-exclamation' : 'fa-times'}"></i>
                </div>
                <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem; color: ${isWarning ? 'var(--warning)' : 'var(--danger)'};">
                    ${result.message}
                </h3>
                ${result.member ? `
                    <div class="scan-details-list">
                        <div class="detail-row">
                            <span>الاسم:</span>
                            <span>${result.member.name}</span>
                        </div>
                        <div class="detail-row">
                            <span>المعرف:</span>
                            <span style="font-family: monospace;">${result.member.id}</span>
                        </div>
                    </div>
                ` : `
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0.5rem;">
                        تأكد من إضافة العضو إلى النظام أو صحة رمز الـ QR.
                    </p>
                `}
                <div style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted);">
                    جاهز للمسح التالي...
                </div>
            `;
        }
    },

    updateScannerStatus(active, message = null) {
        const badge = document.getElementById('scanner-status-badge');
        if (!badge) return;

        if (active) {
            badge.innerHTML = '<span class="live-dot"></span> الكاميرا نشطة وجاهزة للمسح';
            badge.style.display = 'flex';
        } else {
            badge.innerHTML = message || 'الكاميرا متوقفة';
            if (!message) badge.style.display = 'none';
        }
    }
};

window.ScannerModule = ScannerModule;
