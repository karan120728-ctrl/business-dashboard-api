document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('flowops_token');
    if (!token && window.location.pathname.indexOf('login.html') === -1) {
        window.location.href = 'login.html';
        return;
    }
    if (token) initApp();
});

let currentUser = null;
let allCustomers = [];
let allProducts = [];
let allOrders = [];

let salesChartInstance = null;
let statusChartInstance = null;
let dashboardChartData = null;
let socket = null;
let notifications = [];

function setupUI() {
    const role = currentUser.role;
    
    // RBX: Role-Based Experience Sidebar
    const links = {
        'dashboard-link': ['superadmin', 'admin', 'driver', 'customer'],
        'customers-link': ['superadmin', 'admin'],
        'products-link': ['superadmin', 'admin'],
        'orders-link': ['superadmin', 'admin', 'driver', 'customer'],
        'users-link': ['superadmin']
    };

    Object.keys(links).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (links[id].includes(role)) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });

    // Handle all admin-only elements
    document.querySelectorAll('.admin-only').forEach(el => {
        if (role === 'admin' || role === 'superadmin') {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    // Sidebar Branding based on Role
    const sidebarTitle = document.querySelector('.sidebar-header h2');
    const sidebarTagline = document.querySelector('.sidebar-tagline');
    
    if (role === 'driver') {
        if (sidebarTitle) sidebarTitle.innerText = 'Driver App';
        if (sidebarTagline) sidebarTagline.innerText = 'Your delivery workspace.';
    } else if (role === 'customer') {
        if (sidebarTitle) sidebarTitle.innerText = 'My FlowOps';
        if (sidebarTagline) sidebarTagline.innerText = 'Track your orders easily.';
    } else {
        if (sidebarTitle) sidebarTitle.innerText = 'FlowOps';
        if (sidebarTagline) sidebarTagline.innerText = 'Manage everything in one place.';
    }

    const nameEl = document.getElementById('user-name-display');
    const roleEl = document.getElementById('user-role-badge');
    if (nameEl) nameEl.innerText = currentUser.name || 'User';
    if (roleEl) {
        roleEl.innerText = (role || 'User').toUpperCase();
        roleEl.className = `badge ${role === 'superadmin' || role === 'admin' ? 'badge-warning' : 'badge-neutral'}`;
    }

    // Show Invite Code for Admins
    const inviteContainer = document.getElementById('invite-code-container');
    const displayCode = document.getElementById('display-invite-code');
    if (inviteContainer && (role === 'admin' || role === 'superadmin')) {
        inviteContainer.classList.remove('hidden');
        if (displayCode) displayCode.innerText = currentUser.business_code || '------';
    } else if (inviteContainer) {
        inviteContainer.classList.add('hidden');
    }
}

// Global function for copying invite code
window.copyInviteCode = () => {
    const code = document.getElementById('display-invite-code').innerText;
    if (code && code !== '------') {
        navigator.clipboard.writeText(code).then(() => {
            showToast('Invite Code copied to clipboard!', 'success');
        });
    }
};

function initApp() {
    try {
        currentUser = JSON.parse(localStorage.getItem('flowops_user') || '{}');
    } catch(e) {
        currentUser = {};
    }
    
    setupUI();
    document.getElementById('app-layout').classList.remove('hidden');

    // Navigation setup
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            switchView(view);
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    document.getElementById('btn-logout').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // Profile Dropdown Toggle
    const profileTrigger = document.getElementById('profile-trigger');
    const profileMenu = document.getElementById('profile-dropdown-menu');
    if (profileTrigger && profileMenu) {
        profileTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle('hidden');
            if (document.getElementById('notification-dropdown-menu')) {
                document.getElementById('notification-dropdown-menu').classList.add('hidden');
            }
        });
    }

    // Modals Initialization
    initModals();
    
    // Notifications Initialization
    initNotifications();

    // Default View Selection for RBX
    if (currentUser.role === 'driver' || currentUser.role === 'customer') {
        switchView('orders'); 
        const ordersLink = document.getElementById('orders-link');
        if (ordersLink) {
            navLinks.forEach(l => l.classList.remove('active'));
            ordersLink.classList.add('active');
        }
    } else {
        switchView('dashboard');
    }

    // Global click listener for dropdowns
    document.addEventListener('click', () => {
        if (profileMenu) profileMenu.classList.add('hidden');
        const notifMenu = document.getElementById('notification-dropdown-menu');
        if (notifMenu) notifMenu.classList.add('hidden');
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.remove('hidden');
    
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    if (viewName === 'dashboard') {
        if (currentUser.role === 'driver') renderDriverDashboard();
        else if (currentUser.role === 'customer') renderCustomerDashboard();
        else loadDashboard(); 
    }
    
    if (viewName === 'customers') loadCustomers();
    if (viewName === 'products') loadProducts();
    if (viewName === 'orders') loadOrders();
    if (viewName === 'users') loadUsers();
}

/* ================= RBX DASHBOARDS ================= */
function renderDriverDashboard() {
    const dash = document.getElementById('view-dashboard');
    dash.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: var(--shadow-sm); text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🚛</div>
            <h2>Hello, ${currentUser.name}!</h2>
            <p style="color: var(--text-muted); margin-bottom: 2rem;">You are logged in as a <strong>Driver</strong>. Focus on your deliveries today.</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; max-width: 400px; margin: 0 auto;">
                <button class="btn btn-primary" onclick="switchView('orders')">View My Orders</button>
                <button class="btn btn-secondary" onclick="showToast('Driver Support is coming soon!', 'info')">Driver Support</button>
            </div>
        </div>
    `;
}

function renderCustomerDashboard() {
    const dash = document.getElementById('view-dashboard');
    dash.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: var(--shadow-sm);">
            <h2>Welcome, ${currentUser.name}!</h2>
            <p style="color: var(--text-muted); margin-bottom: 2rem;">Track your recent orders and manage your account.</p>
            <div class="metrics-grid">
                <div class="metric-card" onclick="switchView('orders')" style="cursor:pointer">
                    <div class="metric-icon"><i class="fa-solid fa-cart-shopping"></i></div>
                    <div class="metric-data">
                        <h3>My Orders</h3>
                        <p id="cust-order-count">Loading...</p>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i class="fa-solid fa-credit-card"></i></div>
                    <div class="metric-data">
                        <h3>Total Spent</h3>
                        <p id="cust-total-spent">$0.00</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    window.OrdersAPI.getAll().then(orders => {
        const countEl = document.getElementById('cust-order-count');
        const spentEl = document.getElementById('cust-total-spent');
        if (countEl) countEl.innerText = orders.length;
        if (spentEl) {
            const total = orders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
            spentEl.innerText = formatCurrency(total);
        }
    }).catch(() => {});
}

/* ================= MODAL & UX LOGIC ================= */
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    const firstInput = modal.querySelector('input, select');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('hidden');
    const form = modal.querySelector('form');
    if (form) form.reset();
}

function setBtnLoading(btnId, isLoading, originalText = "Save") {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? `<i class="fa-solid fa-spinner fa-spin"></i> Processing...` : originalText;
}

function initModals() {
    // Buttons bindings
    const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('btn-add-customer', () => openModal('modal-customer'));
    bind('btn-add-product', () => openModal('modal-product'));
    bind('btn-create-order', openOrderModal);
    bind('btn-add-user', () => openModal('modal-user'));
    bind('btn-start-camera', startCameraStream);
    bind('btn-capture-photo', capturePhoto);
    bind('btn-start-tracking', startGpsTracking);
    bind('btn-stop-tracking', stopGpsTracking);
    bind('btn-manual-search', handleManualLocationSearch);

    // Close buttons
    document.querySelectorAll('.modal-close, .close-modal, .close-modal-btn').forEach(btn => {
        btn.onclick = (e) => {
            const modal = e.target.closest('.modal');
            if(modal) closeModal(modal.id);
        }
    });

    // Forms
    const bindForm = (id, fn) => { const el = document.getElementById(id); if(el) el.onsubmit = fn; };
    bindForm('form-customer', handleAddCustomer);
    bindForm('form-product', handleAddProduct);
    bindForm('form-order', handleCreateOrder);
    bindForm('form-user', handleAddUser);
    bindForm('form-edit-user', handleUpdateUserRole);
    bindForm('assign-driver-form', handleAssignDriver);
    bindForm('submit-proof-form', handleSubmitProof);

    // Interval for Auto-polling
    setInterval(() => {
        const currentView = document.querySelector('.view:not(.hidden)');
        if (currentView) {
            const vid = currentView.id.replace('view-', '');
            if (vid === 'dashboard' && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) loadDashboard();
            if (vid === 'orders') loadOrders();
        }
    }, 60000);
}

/* ================= DASHBOARD & CHARTS ================= */
async function loadDashboard() {
    try {
        const data = await window.AnalyticsAPI.getDashboard();
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
        setVal('metric-revenue', formatCurrency(data.totalRevenue));
        setVal('metric-today', formatCurrency(data.todayRevenue));
        setVal('metric-weekly', formatCurrency(data.weeklyRevenue));
        setVal('metric-monthly', formatCurrency(data.monthlyRevenue));
        
        renderGrowth('growth-today', data.todayGrowth);
        renderGrowth('growth-weekly', data.weeklyGrowth);
        renderGrowth('growth-monthly', data.monthlyGrowth);

        document.querySelectorAll('.skeleton-text').forEach(el => el.classList.remove('skeleton-text'));
        dashboardChartData = data.charts;
        renderSalesChart('monthly');
        renderStatusChart();

        const toggle = document.getElementById('sales-chart-period');
        if (toggle) {
            const newToggle = toggle.cloneNode(true);
            toggle.parentNode.replaceChild(newToggle, toggle);
            newToggle.addEventListener('change', (e) => renderSalesChart(e.target.value));
        }
    } catch(err) { console.error(err); }
}

function renderGrowth(elementId, value) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const num = parseFloat(value);
    if (isNaN(num) || num === 0) {
        el.innerHTML = `No change`;
        el.className = 'growth-indicator growth-neutral';
    } else if (num > 0) {
        el.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> +${num}%`;
        el.className = 'growth-indicator growth-positive';
    } else {
        el.innerHTML = `<i class="fa-solid fa-arrow-trend-down"></i> ${num}%`;
        el.className = 'growth-indicator growth-negative';
    }
}

function renderSalesChart(period) {
    const ctx = document.getElementById('salesChart');
    if (!ctx || !dashboardChartData) return;
    const dataSet = dashboardChartData.sales[period] || [];
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dataSet.map(d => d.label),
            datasets: [{
                label: 'Revenue',
                data: dataSet.map(d => parseFloat(d.sales)),
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function renderStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx || !dashboardChartData) return;
    const data = dashboardChartData.statusWise;
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.status.toUpperCase()),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#94a3b8', '#ef4444']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
    });
}

/* ================= CRUD OPERATIONS ================= */
async function loadCustomers() {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;
    try {
        const res = await window.CustomersAPI.getAll();
        const items = res.customers || [];
        tbody.innerHTML = items.length ? items.map(c => `
            <tr>
                <td>${c.name}</td>
                <td>${c.email}</td>
                <td>${c.phone || '-'}</td>
                <td><span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                <td><button class="btn btn-secondary btn-sm" onclick="deleteCustomer(${c.id})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `).join('') : '<tr><td colspan="5">No customers found.</td></tr>';
    } catch(e) {}
}

async function handleAddCustomer(e) {
    e.preventDefault();
    const data = { 
        name: document.getElementById('cust-name').value, 
        email: document.getElementById('cust-email').value, 
        phone: document.getElementById('cust-phone').value, 
        address: '' 
    };
    if (!data.name || !data.email) return showToast("Name and email required", "error");
    setBtnLoading('btn-submit-customer', true, 'Save Customer');
    try { 
        await window.CustomersAPI.create(data); 
        showToast("Customer Added!"); 
        closeModal('modal-customer'); 
        loadCustomers(); 
    }
    catch(e) {} finally { setBtnLoading('btn-submit-customer', false, 'Save Customer'); }
}

window.deleteCustomer = (id) => showConfirmModal("Delete customer?", async () => {
    try { await window.CustomersAPI.delete(id); loadCustomers(); } catch(e) {}
});

async function loadProducts() {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;
    try {
        const res = await window.ProductsAPI.getAll();
        const items = res.products || [];
        tbody.innerHTML = items.length ? items.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>${formatCurrency(p.price)}</td>
                <td><span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
                <td><button class="btn btn-secondary btn-sm" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `).join('') : '<tr><td colspan="4">No products found.</td></tr>';
    } catch(e) {}
}

async function handleAddProduct(e) {
    e.preventDefault();
    const data = { 
        name: document.getElementById('prod-name').value, 
        price: parseFloat(document.getElementById('prod-price').value), 
        description: document.getElementById('prod-desc').value 
    };
    if (!data.name || isNaN(data.price)) return showToast("Name and price required", "error");
    setBtnLoading('btn-submit-product', true, 'Save Product');
    try { 
        await window.ProductsAPI.create(data); 
        showToast("Product Added!"); 
        closeModal('modal-product'); 
        loadProducts(); 
    }
    catch(e) {} finally { setBtnLoading('btn-submit-product', false, 'Save Product'); }
}

window.deleteProduct = (id) => showConfirmModal("Delete product?", async () => {
    try { await window.ProductsAPI.delete(id); loadProducts(); } catch(e) {}
});

/* ================= ORDERS & LOGISTICS ================= */
async function openOrderModal() {
    try {
        const pres = await window.ProductsAPI.getAll();
        const cSel = document.getElementById('order-customer');
        const pSel = document.getElementById('order-product');
        const searchInput = document.getElementById('order-customer-search');
        const adminSection = document.getElementById('admin-customer-selection');
        const customerDisplay = document.getElementById('customer-info-display');
        
        // Populate Products
        if (pSel) pSel.innerHTML = '<option value="" data-price="0">Select Product...</option>' + pres.products.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} (${formatCurrency(p.price)})</option>`).join('');

        if (currentUser.role === 'customer') {
            // Role: Customer - Auto select self
            if (adminSection) adminSection.classList.add('hidden');
            if (customerDisplay) {
                customerDisplay.classList.remove('hidden');
                document.getElementById('display-cust-name').innerText = currentUser.name;
                document.getElementById('display-cust-email').innerText = currentUser.email;
            }
            
            // Find customer record by email
            const cres = await window.CustomersAPI.getAll();
            const self = cres.customers.find(c => c.email.toLowerCase() === currentUser.email.toLowerCase());
            if (self) {
                // We must ensure the option exists so the .value assignment works
                cSel.innerHTML = `<option value="${self.id}">${self.name}</option>`;
                cSel.value = self.id;
            } else {
                showToast("Your customer profile was not found. Please contact admin.", "error");
                return;
            }
        } else {
            // Role: Admin/SuperAdmin
            if (adminSection) adminSection.classList.remove('hidden');
            if (customerDisplay) customerDisplay.classList.add('hidden');
            
            const cres = await window.CustomersAPI.getAll();
            allCustomers = cres.customers || [];
            
            const renderCustOptions = (list) => {
                cSel.innerHTML = '<option value="">Select Customer...</option>' + list.map(c => 
                    `<option value="${c.id}">${c.name} ${c.phone ? `(${c.phone})` : `[${c.email}]`}</option>`
                ).join('');
            };
            
            renderCustOptions(allCustomers);

            // Add Search logic
            if (searchInput) {
                searchInput.value = '';
                searchInput.oninput = (e) => {
                    const q = e.target.value.toLowerCase();
                    const filtered = allCustomers.filter(c => 
                        c.name.toLowerCase().includes(q) || 
                        (c.phone && c.phone.includes(q)) ||
                        c.email.toLowerCase().includes(q)
                    );
                    renderCustOptions(filtered);
                };
            }
        }
        
        pSel.onchange = () => {
            const opt = pSel.options[pSel.selectedIndex];
            const price = parseFloat(opt.getAttribute('data-price') || 0);
            const qty = parseInt(document.getElementById('order-qty').value || 1);
            document.getElementById('order-total-preview').innerText = formatCurrency(price * qty);
        };
        document.getElementById('order-qty').oninput = pSel.onchange;
        
        openModal('modal-order');
    } catch(e) {
        console.error(e);
        showToast("Error loading order form", "error");
    }
}

async function handleCreateOrder(e) {
    e.preventDefault();
    const data = { 
        customer: document.getElementById('order-customer').value, 
        products: [{ 
            product: document.getElementById('order-product').value, 
            quantity: parseInt(document.getElementById('order-qty').value) 
        }] 
    };
    if (!data.customer || !data.products[0].product) return showToast("Select customer and product", "error");
    setBtnLoading('btn-submit-order', true, 'Create Order');
    try { 
        await window.OrdersAPI.create(data); 
        showToast("Order Created!"); 
        closeModal('modal-order'); 
        loadOrders(); 
    }
    catch(e) {
        console.error("Order Creation Error:", e);
        showToast(e.message || "Failed to create order", "error");
    } finally { setBtnLoading('btn-submit-order', false, 'Create Order'); }
}

async function loadOrders() {
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;
    try {
        const orders = await window.OrdersAPI.getAll();
        tbody.innerHTML = orders.map(o => {
            const isStaff = currentUser.role === 'admin' || currentUser.role === 'superadmin';
            const isDriver = currentUser.role === 'driver';
            let actions = `<button class="btn btn-secondary btn-sm" onclick="openTimeline(${o.id})"><i class="fa-solid fa-route"></i> Track</button>`;
            if (o.status === 'confirmed' && isStaff) actions += ` <button class="btn btn-primary btn-sm" onclick="openAssignDriver(${o.id})">Assign</button>`;
            if (o.status === 'out_for_delivery' && isDriver) {
                actions += ` <button class="btn btn-warning btn-sm" onclick="openDriverTracking(${o.id})">GPS</button>`;
                actions += ` <button class="btn btn-success btn-sm" onclick="openSubmitProof(${o.id})">Proof</button>`;
            }
            return `<tr>
                <td>#${o.id}</td>
                <td>${o.customer_name}</td>
                <td>${formatCurrency(o.total_amount)}</td>
                <td>${formatDate(o.created_at)}</td>
                <td><span class="badge badge-${o.status === 'delivered' ? 'success' : (o.status === 'out_for_delivery' ? 'primary' : 'warning')}">${o.status.toUpperCase()}</span></td>
                <td>
                    <select class="input" onchange="updateOrderStatus(${o.id}, this.value)" ${!isStaff ? 'disabled' : ''}>
                        <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="out_for_delivery" ${o.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
                        <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    </select>
                </td>
                <td>${actions}</td>
            </tr>`;
        }).join('');
    } catch(e) {}
}

window.updateOrderStatus = async (id, status) => {
    try { await window.OrdersAPI.updateStatus(id, status); showToast("Status Updated"); loadOrders(); } catch(e) {}
};

window.openTimeline = async (id) => {
    const orders = await window.OrdersAPI.getAll();
    const o = orders.find(x => x.id == id);
    if (!o) return;
    const statusOrder = ['pending', 'confirmed', 'out_for_delivery', 'delivered'];
    const curIdx = statusOrder.indexOf(o.status);
    const mkNode = (title, date, icon, color, desc, step) => {
        const active = step <= curIdx;
        return `<div class="timeline-item ${active ? 'active' : ''}">
            <div class="timeline-icon" style="background:${active ? color : '#e2e8f0'}"><i class="${icon}"></i></div>
            <div class="timeline-content">
                <div class="timeline-header"><h5>${title}</h5><span class="timeline-date">${date ? formatDate(date) : (active ? 'In Progress' : 'Pending')}</span></div>
                ${desc ? `<p class="timeline-desc">${desc}</p>` : ''}
            </div>
        </div>`;
    };
    const driverDesc = o.driver_name ? `Driver: ${o.driver_name} (${o.vehicle_number})` : 'Awaiting assignment';
    const content = document.getElementById('timeline-container');
    content.innerHTML = mkNode('Order Placed', o.created_at, 'fa-solid fa-receipt', '#10b981', '', 0) +
                        mkNode('Confirmed & Packed', o.packed_at || (curIdx >= 1 ? o.created_at : null), 'fa-solid fa-box', '#3b82f6', '', 1) +
                        mkNode('Out for Delivery', o.out_for_delivery_at, 'fa-solid fa-truck', '#f59e0b', driverDesc, 2) +
                        mkNode('Delivered ✅', o.delivered_at, 'fa-solid fa-check', '#10b981', o.proof_image_url ? 'Delivery proof uploaded' : '', 3);
    openModal('order-timeline-modal');
};

/* ================= LOGISTICS TOOLS ================= */
window.openAssignDriver = async (id) => {
    document.getElementById('assign-driver-order-id').value = id;
    const users = await window.UsersAPI.getAll();
    const sel = document.getElementById('driver-selection');
    sel.innerHTML = '<option value="">Select Driver...</option>' + users.filter(u => u.role === 'driver').map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    openModal('assign-driver-modal');
};

async function handleAssignDriver(e) {
    e.preventDefault();
    const id = document.getElementById('assign-driver-order-id').value;
    const dId = document.getElementById('driver-selection').value;
    const dName = document.getElementById('driver-selection').options[document.getElementById('driver-selection').selectedIndex].text;
    const veh = document.getElementById('vehicle-number').value;
    if (!dId || !veh) return showToast("Driver and vehicle required", "error");
    setBtnLoading('assign-driver-submit', true, 'Assign & Start Delivery');
    try { 
        await window.OrdersAPI.assignDriver(id, { driver_id: dId, driver_name: dName, vehicle_number: veh }); 
        showToast("Driver Assigned!"); 
        closeModal('assign-driver-modal'); 
        loadOrders(); 
    }
    catch(e) {} finally { setBtnLoading('assign-driver-submit', false, 'Assign & Start Delivery'); }
}

/* GPS & CAMERA */
let _gpsWatchId = null;
let _trackingOrderId = null;
let _trackingMap = null;
let _trackingMarker = null;

window.openDriverTracking = (id) => {
    _trackingOrderId = id;
    document.getElementById('tracking-order-id').value = id;
    openModal('driver-tracking-modal');
};

function startGpsTracking() {
    _trackingOrderId = document.getElementById('tracking-order-id').value;
    document.getElementById('btn-start-tracking').disabled = true;
    document.getElementById('btn-stop-tracking').disabled = false;
    document.getElementById('tracking-status-badge').innerHTML = '<span style="width:8px; height:8px; background:#10b981; border-radius:50%; display:inline-block; animation: pulse 1s infinite;"></span> GPS Active';
    document.getElementById('tracking-status-badge').style.color = '#10b981';
    document.getElementById('tracking-status-badge').style.background = 'rgba(16,185,129,0.1)';

    _gpsWatchId = navigator.geolocation.watchPosition(async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        if (accuracy > 150) return;
        document.getElementById('tracking-coords').innerText = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
        document.getElementById('tracking-accuracy').innerText = `Accuracy: ${accuracy.toFixed(1)}m`;
        await window.OrdersAPI.updateLocation(_trackingOrderId, { lat, lng });
    }, (err) => {
        showToast("GPS Error: " + err.message, "error");
        stopGpsTracking();
    }, { enableHighAccuracy: true });
}

function stopGpsTracking() { 
    if(_gpsWatchId) navigator.geolocation.clearWatch(_gpsWatchId);
    document.getElementById('btn-start-tracking').disabled = false;
    document.getElementById('btn-stop-tracking').disabled = true;
    document.getElementById('tracking-status-badge').innerHTML = '<span style="width:8px; height:8px; background:#ef4444; border-radius:50%; display:inline-block;"></span> GPS Inactive';
    document.getElementById('tracking-status-badge').style.color = '#ef4444';
    document.getElementById('tracking-status-badge').style.background = 'rgba(239,68,68,0.1)';
}

async function handleManualLocationSearch() {
    const q = document.getElementById('manual-location-search').value;
    if(!q) return;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
        const data = await res.json();
        if (data.length) {
            const { lat, lon, display_name } = data[0];
            await window.OrdersAPI.updateLocation(_trackingOrderId, { lat, lng: lon, address: display_name });
            showToast("Location updated manually");
        }
    } catch(e) {}
}

/* CAMERA POD */
let _cameraStream = null;
async function startCameraStream() {
    try {
        _cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = document.getElementById('webcam-video');
        video.srcObject = _cameraStream;
        video.style.display = 'block';
        document.getElementById('camera-placeholder').style.display = 'none';
    } catch(e) { showToast("Camera access denied", "error"); }
}
function stopCameraStream() { if(_cameraStream) _cameraStream.getTracks().forEach(t => t.stop()); }
function capturePhoto() {
    const video = document.getElementById('webcam-video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const data = canvas.toDataURL('image/jpeg');
    const img = document.getElementById('proof-preview-img');
    img.src = data; img.style.display = 'block';
    video.style.display = 'none';
    stopCameraStream();
    document.getElementById('submit-proof-submit').disabled = false;
}

window.openSubmitProof = (id) => { 
    document.getElementById('submit-proof-order-id').value = id; 
    document.getElementById('proof-preview-img').style.display = 'none';
    document.getElementById('webcam-video').style.display = 'none';
    document.getElementById('camera-placeholder').style.display = 'flex';
    document.getElementById('submit-proof-submit').disabled = true;
    openModal('submit-proof-modal'); 
};

async function handleSubmitProof(e) {
    e.preventDefault();
    const id = document.getElementById('submit-proof-order-id').value;
    const imgData = document.getElementById('proof-preview-img').src;
    if (!imgData || imgData.length < 100) return showToast("Capture a photo first", "error");
    setBtnLoading('submit-proof-submit', true, 'Confirm Delivery');
    try { 
        await window.OrdersAPI.submitProof(id, { proof_image: imgData }); 
        showToast("Delivery Confirmed! ✅"); 
        closeModal('submit-proof-modal'); 
        loadOrders(); 
    }
    catch(e) {} finally { setBtnLoading('submit-proof-submit', false, 'Confirm Delivery'); }
}

/* ================= USERS ================= */
async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    try {
        const users = await window.UsersAPI.getAll();
        tbody.innerHTML = users.map(u => `<tr>
            <td>${u.name}</td><td>${u.email}</td>
            <td><span class="badge ${u.role === 'admin' || u.role === 'superadmin' ? 'badge-warning' : 'badge-neutral'}">${u.role.toUpperCase()}</span></td>
            <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
            <td><button class="btn btn-secondary btn-sm" onclick="openEditUser(${u.id}, '${u.role}')"><i class="fa-solid fa-user-pen"></i></button></td>
        </tr>`).join('');
    } catch(e) {}
}

async function handleAddUser(e) {
    e.preventDefault();
    const data = { 
        name: document.getElementById('user-name').value, 
        email: document.getElementById('user-email').value, 
        password: document.getElementById('user-password').value, 
        role: document.getElementById('user-role').value 
    };
    if(!data.name || !data.email || !data.password) return showToast("Missing fields", "error");
    setBtnLoading('btn-submit-user', true, 'Save User');
    try { 
        await window.Api.post('/users/createUser', data); 
        showToast("User Added!"); 
        closeModal('modal-user'); 
        loadUsers(); 
    } catch(e) {} finally { setBtnLoading('btn-submit-user', false, 'Save User'); }
}

window.openEditUser = (id, role) => { document.getElementById('edit-user-id').value = id; document.getElementById('edit-user-role').value = role; openModal('modal-edit-user'); };
async function handleUpdateUserRole(e) {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const role = document.getElementById('edit-user-role').value;
    setBtnLoading('btn-update-user', true, 'Save Changes');
    try { 
        await window.Api.patch(`/users/${id}`, { role }); 
        showToast("Role Updated!"); 
        closeModal('modal-edit-user'); 
        loadUsers(); 
    } catch(e) {} finally { setBtnLoading('btn-update-user', false, 'Save Changes'); }
}

/* ================= REAL-TIME NOTIFICATIONS ================= */
function initNotifications() {
    if (!currentUser || !currentUser.id) return;

    // 1. Connect Socket
    try {
        socket = io(window.API_URL.replace('/api', ''));
        
        socket.on('connect', () => {
            console.log("Real-time notifications connected.");
            socket.emit('join', currentUser.id);
        });

        socket.on('notification', (data) => {
            showToast(`🔔 ${data.title}: ${data.message}`);
            notifications.unshift({ ...data, is_read: 0 });
            renderNotifications();
            playNotificationSound();
        });
    } catch(e) { console.error("Socket.io connection failed", e); }

    // 2. Load History
    loadNotificationHistory();

    // 3. UI Handlers
    const trigger = document.getElementById('notification-trigger');
    const menu = document.getElementById('notification-dropdown-menu');
    const clearBtn = document.getElementById('btn-read-all');

    if (trigger && menu) {
        trigger.onclick = (e) => {
            e.stopPropagation();
            menu.classList.toggle('hidden');
            if (document.getElementById('profile-dropdown-menu')) {
                document.getElementById('profile-dropdown-menu').classList.add('hidden');
            }
            if (!menu.classList.contains('hidden')) markNotificationsAsRead();
        };
        menu.onclick = (e) => e.stopPropagation();
    }

    if (clearBtn) {
        clearBtn.onclick = async () => {
            try {
                await window.Api.patch('/notifications/read-all');
                notifications.forEach(n => n.is_read = 1);
                renderNotifications();
            } catch(e) {}
        };
    }
}

async function loadNotificationHistory() {
    try {
        const data = await window.Api.get('/notifications');
        notifications = data || [];
        renderNotifications();
    } catch(e) { console.error("Failed to load notifications", e); }
}

function renderNotifications() {
    const list = document.getElementById('notification-list');
    const countBadge = document.getElementById('notification-count');
    if (!list) return;

    const unreadCount = notifications.filter(n => !n.is_read).length;
    if (countBadge) {
        if (unreadCount > 0) {
            countBadge.innerText = unreadCount;
            countBadge.classList.remove('hidden');
        } else {
            countBadge.classList.add('hidden');
        }
    }

    if (notifications.length === 0) {
        list.innerHTML = '<div class="empty-state">No notifications yet</div>';
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item ${!n.is_read ? 'unread' : ''}">
            <div class="notification-icon">
                <i class="fa-solid ${n.title.includes('Assigned') ? 'fa-truck-fast' : 'fa-bell'}"></i>
            </div>
            <div class="notification-content">
                <h4>${n.title}</h4>
                <p>${n.message}</p>
                <span class="notification-time">${formatDate(n.created_at)}</span>
            </div>
        </div>
    `).join('');
}

function markNotificationsAsRead() {
    const countBadge = document.getElementById('notification-count');
    if (countBadge) countBadge.classList.add('hidden');
}

function playNotificationSound() {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(() => {});
}

/* UTILS */
function formatCurrency(v) { return '$' + parseFloat(v || 0).toFixed(2); }
function formatDate(d) { 
    if(!d) return '--';
    const date = new Date(d);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function showToast(m, t='success') { 
    const el = document.createElement('div'); 
    el.className = `toast toast-${t}`; 
    el.innerText = m; 
    document.body.appendChild(el); 
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
    }, 3000); 
}
function showConfirmModal(m, fn) { if(confirm(m)) fn(); }
