/**
 * Reports.js - تقارير الحضور وتصدير Excel والطباعة
 * Reports, Analytics, Excel Export with UTF-8 Arabic support, and Print formatting
 */

const ReportsModule = {
    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Export Attendance to Excel button
        const btnExportExcel = document.getElementById('btn-export-excel');
        if (btnExportExcel) {
            btnExportExcel.addEventListener('click', () => this.exportAttendanceToExcel());
        }

        // Export Members to Excel button
        const btnExportMembers = document.getElementById('btn-export-members');
        if (btnExportMembers) {
            btnExportMembers.addEventListener('click', () => this.exportMembersToExcel());
        }

        // Print Attendance Report button
        const btnPrintReport = document.getElementById('btn-print-attendance');
        if (btnPrintReport) {
            btnPrintReport.addEventListener('click', () => this.printAttendanceReport());
        }
    },

    /**
     * Export Attendance to Excel (.xlsx or UTF-8 CSV)
     */
    exportAttendanceToExcel() {
        const records = App.state.attendance;
        if (records.length === 0) {
            App.showToast('لا توجد سجلات حضور لتصديرها', 'warning');
            return;
        }

        const dateFilter = document.getElementById('filter-attendance-date')?.value || '';
        const exportData = records.filter(r => !dateFilter || r.date === dateFilter);

        if (window.XLSX) {
            // SheetJS export
            const wsData = [
                ['كود العضو', 'الاسم الكامل', 'القسم / الصف', 'التاريخ', 'وقت الحضور', 'وقت الانصراف', 'الحالة', 'ملاحظات'],
                ...exportData.map(r => [
                    r.memberId,
                    r.name,
                    r.department || '',
                    r.date,
                    r.checkIn || '',
                    r.checkOut || '',
                    r.status,
                    r.notes || ''
                ])
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, 'سجل الحضور');
            const fileName = `سجل_الحضور_${dateFilter || 'الكامل'}.xlsx`;
            XLSX.writeFile(wb, fileName);
            App.showToast('تم تصدير ملف الإكسيل بنجاح', 'success');
        } else {
            // UTF-8 BOM CSV Fallback (100% Arabic support in Excel)
            let csvContent = '\uFEFF'; // BOM for Arabic Excel
            csvContent += 'كود العضو,الاسم الكامل,القسم / الصف,التاريخ,وقت الحضور,وقت الانصراف,الحالة,ملاحظات\r\n';

            exportData.forEach(r => {
                const escapeCsv = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
                csvContent += [
                    escapeCsv(r.memberId),
                    escapeCsv(r.name),
                    escapeCsv(r.department),
                    escapeCsv(r.date),
                    escapeCsv(r.checkIn),
                    escapeCsv(r.checkOut),
                    escapeCsv(r.status),
                    escapeCsv(r.notes)
                ].join(',') + '\r\n';
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `سجل_الحضور_${dateFilter || 'الكامل'}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            App.showToast('تم تصدير السجل بنجاح (CSV متوافق مع Excel)', 'success');
        }
    },

    /**
     * Export Members list to Excel
     */
    exportMembersToExcel() {
        const members = App.state.members;
        if (members.length === 0) {
            App.showToast('لا توجد بيانات أعضاء لتصديرها', 'warning');
            return;
        }

        if (window.XLSX) {
            const wsData = [
                ['كود العضو', 'الاسم الكامل', 'القسم / الصف', 'الدور / الصفة', 'رقم الهاتف', 'تاريخ التسجيل'],
                ...members.map(m => [
                    m.id,
                    m.name,
                    m.department || '',
                    m.role || '',
                    m.phone || '',
                    m.dateJoined || ''
                ])
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, 'قائمة الأعضاء');
            XLSX.writeFile(wb, 'قائمة_الأعضاء_والطلاب.xlsx');
            App.showToast('تم تصدير قائمة الأعضاء بنجاح', 'success');
        } else {
            let csvContent = '\uFEFF';
            csvContent += 'كود العضو,الاسم الكامل,القسم / الصف,الدور / الصفة,رقم الهاتف,تاريخ التسجيل\r\n';

            members.forEach(m => {
                const escapeCsv = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
                csvContent += [
                    escapeCsv(m.id),
                    escapeCsv(m.name),
                    escapeCsv(m.department),
                    escapeCsv(m.role),
                    escapeCsv(m.phone),
                    escapeCsv(m.dateJoined)
                ].join(',') + '\r\n';
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'قائمة_الأعضاء.csv';
            a.click();
            URL.revokeObjectURL(url);
            App.showToast('تم تصدير قائمة الأعضاء بنجاح', 'success');
        }
    },

    /**
     * Print Daily Attendance Report
     */
    printAttendanceReport() {
        window.print();
    }
};

window.ReportsModule = ReportsModule;
