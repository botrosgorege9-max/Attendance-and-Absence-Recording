/**
 * Attendance.js - محرك تسجيل الحضور والانصراف وقواعد التوقيت
 * Attendance Engine, Check-in / Check-out, and Logs Table
 */

const AttendanceModule = {
    init() {
        this.setupEventListeners();
        this.renderAttendanceTable();
    },

    setupEventListeners() {
        // Attendance filter controls
        const filterDate = document.getElementById('filter-attendance-date');
        const filterDept = document.getElementById('filter-attendance-dept');
        const filterStatus = document.getElementById('filter-attendance-status');
        const searchInput = document.getElementById('attendance-search-input');

        if (filterDate) {
            // Default to today
            filterDate.value = new Date().toISOString().split('T')[0];
            filterDate.addEventListener('change', () => this.renderAttendanceTable());
        }

        if (filterDept) {
            filterDept.addEventListener('change', () => this.renderAttendanceTable());
        }

        if (filterStatus) {
            filterStatus.addEventListener('change', () => this.renderAttendanceTable());
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderAttendanceTable());
        }

        // Quick Manual Attendance modal or input
        const btnManualModal = document.getElementById('btn-manual-attendance');
        const modalManual = document.getElementById('manual-attendance-modal');
        const btnCloseManual = document.getElementById('btn-close-manual-modal');
        const formManual = document.getElementById('manual-attendance-form');

        if (btnManualModal) {
            btnManualModal.addEventListener('click', () => {
                this.populateManualSelect();
                if (modalManual) modalManual.classList.add('active');
            });
        }

        if (btnCloseManual && modalManual) {
            btnCloseManual.addEventListener('click', () => modalManual.classList.remove('active'));
            modalManual.addEventListener('click', (e) => {
                if (e.target === modalManual) modalManual.classList.remove('active');
            });
        }

        if (formManual) {
            formManual.addEventListener('submit', (e) => {
                e.preventDefault();
                const memberId = document.getElementById('manual-member-select').value;
                const mode = document.getElementById('manual-mode-select').value;
                if (!memberId) {
                    App.showToast('يرجى اختيار العضو', 'warning');
                    return;
                }
                const res = this.processScan(memberId, mode);
                if (res.success) {
                    App.playSound('success');
                    App.showToast(res.message, 'success');
                    if (modalManual) modalManual.classList.remove('active');
                } else {
                    App.playSound('warning');
                    App.showToast(res.message, 'warning');
                }
            });
        }
    },

    // Populate manual select dropdown
    populateManualSelect() {
        const select = document.getElementById('manual-member-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- اختر العضو المطلوب --</option>' +
            App.state.members.map(m => `<option value="${m.id}">${m.name} (${m.id}) - ${m.department || m.role}</option>`).join('');
    },

    /**
     * Process Scan from QR Code or Manual
     * @param {string} rawData - Scanned QR text (normally the Member ID)
     * @param {string} explicitMode - 'auto' | 'checkin' | 'checkout'
     */
    processScan(rawData, explicitMode = null) {
        if (!rawData) return { success: false, message: 'رمز فارغ' };

        const cleanId = rawData.trim();
        // Look up member
        const member = App.state.members.find(m => m.id === cleanId || m.id.toLowerCase() === cleanId.toLowerCase());

        if (!member) {
            return {
                success: false,
                message: `الرمز غير مسجل في النظام (${cleanId})`,
                type: 'not_found'
            };
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentTimeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const time24 = now.toTimeString().split(' ')[0].substring(0, 5); // "HH:MM"

        const mode = explicitMode || App.state.settings.scannerMode || 'auto';

        // Check if there is already an attendance record for today
        let record = App.state.attendance.find(r => r.memberId === member.id && r.date === todayStr);

        // Determine if late
        const lateThreshold = App.state.settings.lateThreshold || '08:30';
        const isLate = time24 > lateThreshold;
        const initialStatus = isLate ? 'متأخر' : 'حاضر';

        if (mode === 'checkin') {
            if (record) {
                return {
                    success: false,
                    member,
                    message: `تم تسجيل حضور (${member.name}) مسبقاً اليوم في ${record.checkIn}`,
                    type: 'already_checked_in',
                    record
                };
            }

            // Create record
            const newRecord = {
                id: 'ATT-' + Date.now(),
                memberId: member.id,
                name: member.name,
                department: member.department,
                role: member.role,
                date: todayStr,
                checkIn: currentTimeStr,
                checkOut: null,
                status: initialStatus,
                notes: isLate ? `تسجيل بعد موعد الحضور (${lateThreshold})` : 'حضور منتظم'
            };

            App.state.attendance.push(newRecord);
            App.saveState();
            this.renderAttendanceTable();
            App.renderStats();
            App.renderRecentScans();

            return {
                success: true,
                member,
                status: initialStatus,
                action: 'حضور',
                time: currentTimeStr,
                message: `تم تسجيل حضور: ${member.name} (${initialStatus})`,
                record: newRecord
            };
        }

        if (mode === 'checkout') {
            if (!record) {
                // Member didn't check in today, but check out requested
                const newRecord = {
                    id: 'ATT-' + Date.now(),
                    memberId: member.id,
                    name: member.name,
                    department: member.department,
                    role: member.role,
                    date: todayStr,
                    checkIn: '--:--',
                    checkOut: currentTimeStr,
                    status: 'انصراف مباشر',
                    notes: 'تسجيل انصراف دون تسجيل حضور سابق'
                };
                App.state.attendance.push(newRecord);
                App.saveState();
                this.renderAttendanceTable();
                App.renderStats();
                App.renderRecentScans();

                return {
                    success: true,
                    member,
                    status: 'انصراف',
                    action: 'انصراف',
                    time: currentTimeStr,
                    message: `تم تسجيل انصراف: ${member.name}`,
                    record: newRecord
                };
            }

            if (record.checkOut) {
                return {
                    success: false,
                    member,
                    message: `تم تسجيل انصراف (${member.name}) مسبقاً اليوم في ${record.checkOut}`,
                    type: 'already_checked_out',
                    record
                };
            }

            // Update record checkout
            record.checkOut = currentTimeStr;
            App.saveState();
            this.renderAttendanceTable();
            App.renderStats();
            App.renderRecentScans();

            return {
                success: true,
                member,
                status: record.status,
                action: 'انصراف',
                time: currentTimeStr,
                message: `تم تسجيل انصراف: ${member.name}`,
                record
            };
        }

        // Smart Auto Mode:
        // If not recorded today -> Record Check-in
        // If already recorded today and checkout is null -> Record Check-out
        // If already checked out -> Inform user
        if (!record) {
            const newRecord = {
                id: 'ATT-' + Date.now(),
                memberId: member.id,
                name: member.name,
                department: member.department,
                role: member.role,
                date: todayStr,
                checkIn: currentTimeStr,
                checkOut: null,
                status: initialStatus,
                notes: isLate ? `تسجيل متأخر عن ${lateThreshold}` : 'حضور في الموعد'
            };
            App.state.attendance.push(newRecord);
            App.saveState();
            this.renderAttendanceTable();
            App.renderStats();
            App.renderRecentScans();

            return {
                success: true,
                member,
                status: initialStatus,
                action: 'حضور',
                time: currentTimeStr,
                message: `تم تسجيل حضور: ${member.name} (${initialStatus})`,
                record: newRecord
            };
        } else if (!record.checkOut) {
            // Already checked in, record check out
            record.checkOut = currentTimeStr;
            App.saveState();
            this.renderAttendanceTable();
            App.renderStats();
            App.renderRecentScans();

            return {
                success: true,
                member,
                status: 'تم الانصراف',
                action: 'انصراف',
                time: currentTimeStr,
                message: `تم تسجيل انصراف: ${member.name}`,
                record
            };
        } else {
            return {
                success: false,
                member,
                message: `تم تسجيل الحضور والانصراف بالكامل اليوم لـ (${member.name})`,
                type: 'completed_today',
                record
            };
        }
    },

    deleteRecord(recordId) {
        if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
            App.state.attendance = App.state.attendance.filter(r => r.id !== recordId);
            App.saveState();
            this.renderAttendanceTable();
            App.renderStats();
            App.renderRecentScans();
            App.showToast('تم حذف السجل بنجاح', 'info');
        }
    },

    renderAttendanceTable() {
        const tbody = document.getElementById('attendance-table-body');
        if (!tbody) return;

        const filterDate = document.getElementById('filter-attendance-date')?.value || '';
        const filterDept = document.getElementById('filter-attendance-dept')?.value || '';
        const filterStatus = document.getElementById('filter-attendance-status')?.value || '';
        const searchInput = (document.getElementById('attendance-search-input')?.value || '').toLowerCase().trim();

        // Populate department filter options if needed
        const deptSelect = document.getElementById('filter-attendance-dept');
        if (deptSelect && deptSelect.options.length <= 1) {
            const depts = [...new Set(App.state.members.map(m => m.department).filter(Boolean))];
            depts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                deptSelect.appendChild(opt);
            });
        }

        const filtered = App.state.attendance.filter(r => {
            if (filterDate && r.date !== filterDate) return false;
            if (filterDept && r.department !== filterDept) return false;
            if (filterStatus && r.status !== filterStatus) return false;
            if (searchInput) {
                const matchName = r.name.toLowerCase().includes(searchInput);
                const matchId = r.memberId.toLowerCase().includes(searchInput);
                if (!matchName && !matchId) return false;
            }
            return true;
        }).reverse(); // Most recent first

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
                        لا توجد سجلات حضور تطابق الفلاتر المحددة.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(r => `
            <tr>
                <td><strong>${r.name}</strong></td>
                <td><code style="font-weight: 700;">${r.memberId}</code></td>
                <td>${r.department || '-'}</td>
                <td>${r.date}</td>
                <td><span style="color: var(--success); font-weight: 700;">${r.checkIn || '-'}</span></td>
                <td><span style="color: var(--info); font-weight: 700;">${r.checkOut || '-'}</span></td>
                <td>
                    <span class="badge ${r.status === 'متأخر' ? 'badge-warning' : r.status === 'غائب' ? 'badge-danger' : 'badge-success'}">
                        ${r.status}
                    </span>
                </td>
                <td class="no-print">
                    <button class="btn btn-danger btn-icon" onclick="AttendanceModule.deleteRecord('${r.id}')" title="حذف السجل">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
};

window.AttendanceModule = AttendanceModule;
