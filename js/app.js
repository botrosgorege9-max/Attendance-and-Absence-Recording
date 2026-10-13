/**
 * App.js - النواة الأساسية للنظام وإدارة الحالة
 * Core Application Manager, State, Sounds, and UI
 */

const App = {
    // Current application state
    state: {
        activeTab: 'tab-dashboard',
        theme: 'light',
        settings: {
            orgName: 'كنيسة القديس الأنبا أنطونيوس - اجتماع الشباب والخدام',
            workStartTime: '18:30',
            lateThreshold: '19:15',
            workEndTime: '21:00',
            soundEnabled: true,
            cooldownSeconds: 3,
            scannerMode: 'auto' // 'checkin', 'checkout', 'auto'
        },
        members: [],
        attendance: [] // Array of { id, memberId, name, department, date, checkIn, checkOut, status, notes }
    },

    // Audio synthesizer for instant sound effects
    audioCtx: null,

    init() {
        this.loadState();
        this.setupEventListeners();
        this.setupClock();
        this.applyTheme(this.state.theme);

        // Initialize sub-modules
        if (window.MembersModule) MembersModule.init();
        if (window.ScannerModule) ScannerModule.init();
        if (window.AttendanceModule) AttendanceModule.init();
        if (window.ReportsModule) ReportsModule.init();

        this.renderStats();
        this.renderRecentScans();
    },

    // Load data from LocalStorage
    loadState() {
        const savedSettings = localStorage.getItem('qr_attend_settings');
        if (savedSettings) {
            try { 
                const parsed = JSON.parse(savedSettings);
                if (parsed.orgName && !parsed.orgName.includes('أكاديمية')) {
                    this.state.settings = { ...this.state.settings, ...parsed };
                }
            } catch(e){}
        }

        const savedTheme = localStorage.getItem('qr_attend_theme');
        if (savedTheme) this.state.theme = savedTheme;

        const savedMembers = localStorage.getItem('qr_attend_members');
        if (savedMembers) {
            try { 
                const members = JSON.parse(savedMembers);
                if (members.length > 0 && members[0].id && members[0].id.startsWith('MEM-')) {
                    // Update previous demo data to church demo data
                    this.seedDemoData(true);
                } else {
                    this.state.members = members;
                }
            } catch(e){}
        } else {
            // Seed with sample data on first launch
            this.seedDemoData();
        }

        const savedAttendance = localStorage.getItem('qr_attend_records');
        if (savedAttendance) {
            try { this.state.attendance = JSON.parse(savedAttendance); } catch(e){}
        }
    },

    // Save data to LocalStorage
    saveState() {
        localStorage.setItem('qr_attend_settings', JSON.stringify(this.state.settings));
        localStorage.setItem('qr_attend_theme', this.state.theme);
        localStorage.setItem('qr_attend_members', JSON.stringify(this.state.members));
        localStorage.setItem('qr_attend_records', JSON.stringify(this.state.attendance));
    },

    // Setup global listeners
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.nav-link[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = btn.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });

        // Theme toggle
        const themeBtn = document.getElementById('btn-toggle-theme');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const newTheme = this.state.theme === 'light' ? 'dark' : 'light';
                this.applyTheme(newTheme);
            });
        }

        // Settings form
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            this.populateSettingsForm();
            settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSettingsFromForm();
            });
        }

        // Backup & Restore
        const btnBackup = document.getElementById('btn-backup-data');
        if (btnBackup) {
            btnBackup.addEventListener('click', () => this.exportBackup());
        }

        const fileRestore = document.getElementById('file-restore-data');
        if (fileRestore) {
            fileRestore.addEventListener('change', (e) => this.importBackup(e));
        }

        const btnReset = document.getElementById('btn-reset-data');
        if (btnReset) {
            btnReset.addEventListener('click', () => this.resetAllData());
        }

        const btnLoadDemo = document.getElementById('btn-load-demo');
        if (btnLoadDemo) {
            btnLoadDemo.addEventListener('click', () => {
                this.seedDemoData(true);
                this.showToast('تم تحميل البيانات التجريبية بنجاح!', 'success');
            });
        }
    },

    // Switch active view/tab
    switchTab(tabId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-tab') === tabId);
        });
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === tabId);
        });
        this.state.activeTab = tabId;

        // Trigger specific tab handlers
        if (tabId === 'tab-scanner' && window.ScannerModule) {
            ScannerModule.startScanner();
        } else if (window.ScannerModule) {
            ScannerModule.stopScanner();
        }

        if (tabId === 'tab-dashboard') {
            this.renderStats();
            this.renderRecentScans();
        }

        if (tabId === 'tab-badges' && window.MembersModule) {
            MembersModule.renderBadges();
        }

        if (tabId === 'tab-attendance' && window.AttendanceModule) {
            AttendanceModule.renderAttendanceTable();
        }
    },

    // Real-time Clock
    setupClock() {
        const clockEl = document.getElementById('live-clock');
        const dateEl = document.getElementById('live-date');

        const update = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const dateStr = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            if (clockEl) clockEl.textContent = timeStr;
            if (dateEl) dateEl.textContent = dateStr;
        };
        update();
        setInterval(update, 1000);
    },

    // Theme Switcher
    applyTheme(theme) {
        this.state.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('qr_attend_theme', theme);
        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    },

    // Sound Synthesizer (No external audio files required)
    playSound(type = 'success') {
        if (!this.state.settings.soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!this.audioCtx) this.audioCtx = new AudioContext();
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

            const ctx = this.audioCtx;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'success') {
                // Two-tone cheerful chime (E5 -> A5)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(659.25, now);
                osc.frequency.setValueAtTime(880, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
            } else if (type === 'warning') {
                // Double tap alert
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(330, now + 0.12);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
                osc.start(now);
                osc.stop(now + 0.28);
            } else if (type === 'error') {
                // Low buzz error
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(160, now);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            }
        } catch(e) {
            console.warn('Audio playback failed', e);
        }
    },

    // Toast Notification System
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'warning') icon = 'fa-exclamation-triangle';
        if (type === 'danger') icon = 'fa-times-circle';

        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // Render Dashboard Stats
    renderStats() {
        const todayStr = new Date().toISOString().split('T')[0];
        const totalMembers = this.state.members.length;
        const todayRecords = this.state.attendance.filter(r => r.date === todayStr);

        const presentCount = todayRecords.filter(r => r.status === 'حاضر' || r.status === 'متأخر').length;
        const lateCount = todayRecords.filter(r => r.status === 'متأخر').length;
        const absentCount = Math.max(0, totalMembers - presentCount);
        const rate = totalMembers > 0 ? Math.round((presentCount / totalMembers) * 100) : 0;

        const elTotal = document.getElementById('stat-total-members');
        const elPresent = document.getElementById('stat-present-today');
        const elLate = document.getElementById('stat-late-today');
        const elAbsent = document.getElementById('stat-absent-today');
        const elRate = document.getElementById('stat-rate');

        if (elTotal) elTotal.textContent = totalMembers;
        if (elPresent) elPresent.textContent = presentCount;
        if (elLate) elLate.textContent = lateCount;
        if (elAbsent) elAbsent.textContent = absentCount;
        if (elRate) elRate.textContent = `${rate}%`;

        const orgTitle = document.getElementById('display-org-name');
        if (orgTitle) orgTitle.textContent = this.state.settings.orgName;
    },

    // Render Recent Scans in Dashboard
    renderRecentScans() {
        const tbody = document.getElementById('dashboard-recent-scans');
        if (!tbody) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const recent = this.state.attendance
            .filter(r => r.date === todayStr)
            .slice(-6)
            .reverse();

        if (recent.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
                        لا توجد عمليات حضور مسجلة اليوم حتى الآن.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = recent.map(r => `
            <tr>
                <td><strong>${r.name}</strong></td>
                <td><span style="font-family: monospace;">${r.memberId}</span></td>
                <td>${r.department || '-'}</td>
                <td><strong>${r.checkIn || '-'}</strong></td>
                <td>
                    <span class="badge ${r.status === 'متأخر' ? 'badge-warning' : 'badge-success'}">
                        ${r.status}
                    </span>
                </td>
            </tr>
        `).join('');
    },

    // Settings Management
    populateSettingsForm() {
        const s = this.state.settings;
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('setting-org-name', s.orgName);
        setVal('setting-start-time', s.workStartTime);
        setVal('setting-late-time', s.lateThreshold);
        setVal('setting-end-time', s.workEndTime);
        setVal('setting-cooldown', s.cooldownSeconds);

        const chkSound = document.getElementById('setting-sound-enabled');
        if (chkSound) chkSound.checked = s.soundEnabled;
    },

    saveSettingsFromForm() {
        this.state.settings.orgName = document.getElementById('setting-org-name').value.trim() || 'نظام الحضور';
        this.state.settings.workStartTime = document.getElementById('setting-start-time').value;
        this.state.settings.lateThreshold = document.getElementById('setting-late-time').value;
        this.state.settings.workEndTime = document.getElementById('setting-end-time').value;
        this.state.settings.cooldownSeconds = parseInt(document.getElementById('setting-cooldown').value, 10) || 3;
        this.state.settings.soundEnabled = document.getElementById('setting-sound-enabled').checked;

        this.saveState();
        this.renderStats();
        this.showToast('تم حفظ الإعدادات بنجاح', 'success');
    },

    // Backup & Export (JSON)
    exportBackup() {
        const data = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            settings: this.state.settings,
            members: this.state.members,
            attendance: this.state.attendance
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `نسخة_احتياطية_الحضور_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('تم تصدير النسخة الاحتياطية بنجاح', 'success');
    },

    // Import Backup
    importBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.members && Array.isArray(data.members)) {
                    this.state.members = data.members;
                    if (data.attendance) this.state.attendance = data.attendance;
                    if (data.settings) this.state.settings = { ...this.state.settings, ...data.settings };
                    this.saveState();

                    if (window.MembersModule) MembersModule.renderMembersTable();
                    if (window.AttendanceModule) AttendanceModule.renderAttendanceTable();
                    this.renderStats();
                    this.populateSettingsForm();

                    this.showToast('تمت استعادة البيانات بنجاح!', 'success');
                } else {
                    this.showToast('ملف غير صالح أو تالف', 'danger');
                }
            } catch(err) {
                this.showToast('خطأ أثناء قراءة الملف', 'danger');
            }
        };
        reader.readAsText(file);
    },

    // Reset Data
    resetAllData() {
        if (confirm('هل أنت متأكد من رغبتك في مسح جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.')) {
            this.state.attendance = [];
            this.saveState();
            if (window.AttendanceModule) AttendanceModule.renderAttendanceTable();
            this.renderStats();
            this.renderRecentScans();
            this.showToast('تم تصفير سجلات الحضور بنجاح', 'info');
        }
    },

    // Seed realistic Demo Data for testing
    seedDemoData(force = false) {
        if (!force && this.state.members.length > 0) return;

        const sampleMembers = [
            { id: 'ANT-1001', name: 'مينا يوسف حبيب', department: 'أسرة القديس أثناسيوس', phone: '01223456781', role: 'خادم', dateJoined: '2026-09-01' },
            { id: 'ANT-1002', name: 'مارينا سمير بولس', department: 'مرحلة ثانوي (بنات)', phone: '01223456782', role: 'مخدومة', dateJoined: '2026-09-01' },
            { id: 'ANT-1003', name: 'بيشوي عاطف رزق', department: 'مرحلة جامعيين', phone: '01223456783', role: 'شماس ومخدوم', dateJoined: '2026-09-01' },
            { id: 'ANT-1004', name: 'كيرلس هاني إسكندر', department: 'فريق الكورال والترانيم', phone: '01223456784', role: 'مرنم وخادم', dateJoined: '2026-09-01' },
            { id: 'ANT-1005', name: 'فيرينا مجدي فوزي', department: 'مرحلة إعدادي (بنات)', phone: '01223456785', role: 'مخدومة', dateJoined: '2026-09-01' },
            { id: 'ANT-1006', name: 'أ. ريمون شكري غالي', department: 'أمانة الخدمة والاجتماع', phone: '01223456786', role: 'أمين الاجتماع', dateJoined: '2025-01-15' }
        ];

        this.state.members = sampleMembers;
        this.saveState();

        if (window.MembersModule) {
            MembersModule.renderMembersTable();
            MembersModule.renderBadges();
        }
        this.renderStats();
    }
};

// Auto start on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
