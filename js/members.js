/**
 * Members.js - إدارة الطلاب والموظفين وبطاقات الـ QR
 * Member Management, CRUD, and ID Badge Generation
 */

const MembersModule = {
    editingId: null,

    init() {
        this.setupEventListeners();
        this.renderMembersTable();
    },

    setupEventListeners() {
        // Add member button & modal
        const btnAdd = document.getElementById('btn-add-member');
        const modal = document.getElementById('member-modal');
        const btnCloseModal = document.getElementById('btn-close-member-modal');
        const btnCancelModal = document.getElementById('btn-cancel-member-modal');
        const memberForm = document.getElementById('member-form');

        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.openModal());
        }

        if (btnCloseModal) {
            btnCloseModal.addEventListener('click', () => this.closeModal());
        }

        if (btnCancelModal) {
            btnCancelModal.addEventListener('click', () => this.closeModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        }

        if (memberForm) {
            memberForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSaveMember();
            });
        }

        // Search input
        const searchInput = document.getElementById('member-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderMembersTable());
        }

        const qrPreviewModal = document.getElementById('qr-preview-modal');
        if (qrPreviewModal) {
            qrPreviewModal.addEventListener('click', (e) => {
                if (e.target === qrPreviewModal) qrPreviewModal.classList.remove('active');
            });
        }

        const btnDownloadQr = document.getElementById('btn-download-single-qr');
        if (btnDownloadQr) {
            btnDownloadQr.addEventListener('click', () => {
                const canvas = document.querySelector('#qr-preview-box canvas');
                if (canvas) {
                    const link = document.createElement('a');
                    link.download = `QR_${this.currentPreviewMember?.id || 'code'}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                }
            });
        }

        // Print Badges button
        const btnPrintBadges = document.getElementById('btn-print-badges');
        if (btnPrintBadges) {
            btnPrintBadges.addEventListener('click', () => {
                window.print();
            });
        }
    },

    openModal(member = null) {
        const modal = document.getElementById('member-modal');
        const title = document.getElementById('modal-member-title');
        const inputId = document.getElementById('member-input-id');
        const inputName = document.getElementById('member-input-name');
        const inputDept = document.getElementById('member-input-dept');
        const inputPhone = document.getElementById('member-input-phone');
        const inputRole = document.getElementById('member-input-role');

        if (member) {
            this.editingId = member.id;
            title.textContent = 'تعديل بيانات العضو';
            inputId.value = member.id;
            inputId.disabled = true; // Don't change ID when editing
            inputName.value = member.name;
            inputDept.value = member.department || '';
            inputPhone.value = member.phone || '';
            inputRole.value = member.role || 'طالب';
        } else {
            this.editingId = null;
            title.textContent = 'إضافة عضو جديد للاجتماع';
            inputId.disabled = false;
            // Generate auto ID: ANT-XXXX
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            inputId.value = `ANT-${randomNum}`;
            inputName.value = '';
            inputDept.value = '';
            inputPhone.value = '';
            inputRole.value = 'مخدوم';
        }

        modal.classList.add('active');
        inputName.focus();
    },

    closeModal() {
        const modal = document.getElementById('member-modal');
        if (modal) modal.classList.remove('active');
        this.editingId = null;
    },

    handleSaveMember() {
        const id = document.getElementById('member-input-id').value.trim();
        const name = document.getElementById('member-input-name').value.trim();
        const dept = document.getElementById('member-input-dept').value.trim();
        const phone = document.getElementById('member-input-phone').value.trim();
        const role = document.getElementById('member-input-role').value;

        if (!id || !name) {
            App.showToast('يرجى كتابة الاسم ورقم المعرف', 'warning');
            return;
        }

        if (this.editingId) {
            // Update existing
            const idx = App.state.members.findIndex(m => m.id === this.editingId);
            if (idx !== -1) {
                App.state.members[idx] = {
                    ...App.state.members[idx],
                    name,
                    department: dept,
                    phone,
                    role
                };
                App.showToast('تم تحديث البيانات بنجاح', 'success');
            }
        } else {
            // Check unique ID
            if (App.state.members.some(m => m.id === id)) {
                App.showToast('رقم المعرف مستخدم بالفعل لشخص آخر!', 'danger');
                return;
            }
            App.state.members.push({
                id,
                name,
                department: dept,
                phone,
                role,
                dateJoined: new Date().toISOString().split('T')[0]
            });
            App.showToast('تمت إضافة العضو بنجاح', 'success');
        }

        App.saveState();
        this.renderMembersTable();
        this.renderBadges();
        App.renderStats();
        this.closeModal();
    },

    deleteMember(id) {
        const member = App.state.members.find(m => m.id === id);
        if (!member) return;

        if (confirm(`هل أنت متأكد من حذف (${member.name})؟`)) {
            App.state.members = App.state.members.filter(m => m.id !== id);
            App.saveState();
            this.renderMembersTable();
            this.renderBadges();
            App.renderStats();
            App.showToast('تم حذف العضو بنجاح', 'info');
        }
    },

    renderMembersTable() {
        const tbody = document.getElementById('members-table-body');
        if (!tbody) return;

        const searchFilter = (document.getElementById('member-search-input')?.value || '').toLowerCase().trim();

        const filtered = App.state.members.filter(m => {
            if (!searchFilter) return true;
            return m.name.toLowerCase().includes(searchFilter) ||
                   m.id.toLowerCase().includes(searchFilter) ||
                   (m.department && m.department.toLowerCase().includes(searchFilter));
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        لا يوجد أعضاء يطابقون البحث. اضغط على "إضافة عضو" للبدء.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(m => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 800;">
                            ${m.name.charAt(0)}
                        </div>
                        <div>
                            <strong>${m.name}</strong>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${m.role || 'عضو'}</div>
                        </div>
                    </div>
                </td>
                <td><code style="font-weight: 700; background: var(--bg-card-subtle); padding: 2px 6px; border-radius: 4px;">${m.id}</code></td>
                <td>${m.department || '-'}</td>
                <td>${m.phone || '-'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="MembersModule.previewSingleBadge('${m.id}')" title="عرض الـ QR">
                        <i class="fas fa-qrcode"></i> عرض الرمز
                    </button>
                </td>
                <td>
                    <div style="display: flex; gap: 0.4rem;">
                        <button class="btn btn-secondary btn-icon" onclick="MembersModule.editMember('${m.id}')" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-icon" onclick="MembersModule.deleteMember('${m.id}')" title="حذف">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    editMember(id) {
        const member = App.state.members.find(m => m.id === id);
        if (member) this.openModal(member);
    },

    // Render Printable Badges Grid
    renderBadges() {
        const container = document.getElementById('badges-container');
        if (!container) return;

        const members = App.state.members;
        if (members.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    لا توجد بطاقات متاحة للطباعة. أضف أعضاء أولاً.
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        members.forEach(member => {
            const badgeCard = document.createElement('div');
            badgeCard.className = 'id-badge';
            badgeCard.id = `badge-${member.id}`;

            badgeCard.innerHTML = `
                <div class="badge-header-strip">
                    <img src="images/saint_anthony.jpg" alt="القديس الأنبا أنطونيوس" class="badge-saint-mini">
                    <div style="text-align: right;">
                        <div style="font-size: 0.82rem; font-weight: 800; color: #facc15;">كنيسة القديس الأنبا أنطونيوس</div>
                        <div style="font-size: 0.7rem; color: #e2e8f0; font-weight: 600;">اجتماع الشباب والخدام</div>
                    </div>
                </div>
                <div class="badge-qr-box" id="qr-container-${member.id}"></div>
                <div class="badge-name">${member.name}</div>
                <div class="badge-role">${member.department || member.role || 'عضو الاجتماع'}</div>
                <div class="badge-id-code">${member.id}</div>
            `;

            container.appendChild(badgeCard);

            // Generate QR code inside
            const qrTarget = document.getElementById(`qr-container-${member.id}`);
            if (qrTarget && window.QRCode) {
                new QRCode(qrTarget, {
                    text: member.id,
                    width: 140,
                    height: 140,
                    colorDark: '#0f172a',
                    colorLight: '#ffffff'
                });
            }
        });
    },

    // Preview and download single QR card
    previewSingleBadge(id) {
        const member = App.state.members.find(m => m.id === id);
        if (!member) return;
        this.currentPreviewMember = member;

        const modal = document.getElementById('qr-preview-modal');
        const title = document.getElementById('qr-preview-title');
        const box = document.getElementById('qr-preview-box');
        const desc = document.getElementById('qr-preview-desc');

        title.textContent = `رمز QR: ${member.name}`;
        desc.textContent = `المعرف: ${member.id} | ${member.department || member.role}`;
        box.innerHTML = '';

        if (window.QRCode) {
            new QRCode(box, {
                text: member.id,
                width: 220,
                height: 220,
                colorDark: '#0f172a',
                colorLight: '#ffffff'
            });
        }

        modal.classList.add('active');
    }
};

window.MembersModule = MembersModule;
