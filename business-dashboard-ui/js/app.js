document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('flowops_token');
    if (!token && window.location.pathname.indexOf('login.html') === -1) {
        window.location.href = 'login.html';
        return;
    }
    if (token) {
        // Fetch live rate first, then init app
        fetchLiveRate().finally(() => {
            initApp();
            // Apply saved currency preference to toggle buttons
            setTimeout(() => { if (typeof setCurrency === 'function') setCurrency(activeCurrency); }, 100);
        });
    }
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
        'users-link': ['superadmin', 'admin']
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

    // Handle elements that should be hidden ONLY for drivers
    document.querySelectorAll('.driver-hidden').forEach(el => {
        if (role === 'driver') {
            el.classList.add('hidden');
        } else {
            el.classList.remove('hidden');
        }
    });

    // Handle elements that should be shown ONLY for drivers
    document.querySelectorAll('.driver-only').forEach(el => {
        if (role === 'driver') {
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
        if (displayCode) displayCode.innerText = currentUser.business_code || currentUser.inviteCode || currentUser.businessCode || '------';
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
    
    // Responsive Sidebar Initialization
    setupResponsiveSidebar();
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

function setupResponsiveSidebar() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const navLinks = document.querySelectorAll('.nav-link');

    const toggleSidebar = () => {
        sidebar.classList.toggle('sidebar-open');
        overlay.classList.toggle('hidden');
        document.body.classList.toggle('sidebar-open');
    };

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebar();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            if (sidebar.classList.contains('sidebar-open')) {
                toggleSidebar();
            }
        });
    }

    // Close sidebar when clicking a nav link on mobile
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 1024 && sidebar.classList.contains('sidebar-open')) {
                toggleSidebar();
            }
        });
    });

    // Close sidebar on window resize if switching to desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            sidebar.classList.remove('sidebar-open');
            overlay.classList.add('hidden');
            document.body.classList.remove('sidebar-open');
        }
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
    if (viewName === 'inventory') loadInventory();
    if (viewName === 'products') loadProducts();
    if (viewName === 'orders') loadOrders();
    if (viewName === 'payments') loadPayments();
    if (viewName === 'users') loadUsers();
    if (viewName === 'batches') loadBatches();
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
    bind('btn-create-batch', handleOpenBatchModal);
    bind('btn-start-camera', startCameraStream);
    bind('btn-capture-photo', capturePhoto);
    bind('btn-start-tracking', startGpsTracking);
    bind('btn-stop-tracking', stopGpsTracking);
    bind('btn-manual-search', handleManualLocationSearch);
    
    // File input fallback for Camera
    const proofInput = document.getElementById('proof-file-input');
    if (proofInput) proofInput.onchange = handleProofFileUpload;

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
    bindForm('form-stock', handleUpdateStock);
    bindForm('form-order', handleCreateOrder);
    bindForm('form-batch', handleAssignBatch);
    bindForm('form-user', handleAddUser);
    bindForm('form-edit-user', handleUpdateUserRole);
    bindForm('assign-driver-form', handleAssignDriver);
    bindForm('submit-proof-form', handleSubmitProof);

    // Live price conversion preview in Add Product form
    const priceInput = document.getElementById('prod-price');
    const priceCurrSel = document.getElementById('prod-price-currency');
    const priceConverted = document.getElementById('prod-price-converted');
    const updatePricePreview = () => {
        if (!priceInput || !priceCurrSel || !priceConverted) return;
        const val = parseFloat(priceInput.value);
        if (isNaN(val) || val <= 0) { priceConverted.innerText = ''; return; }
        const currency = priceCurrSel.value;
        if (currency === 'INR') {
            const usd = val / LIVE_INR_RATE;
            priceConverted.innerHTML = `<i class='fa-solid fa-arrows-rotate' style='font-size:0.7rem'></i> = $${usd.toFixed(2)} USD (stored internally)`;
        } else {
            const inr = val * LIVE_INR_RATE;
            priceConverted.innerHTML = `<i class='fa-solid fa-arrows-rotate' style='font-size:0.7rem'></i> = ₹${Math.round(inr).toLocaleString('en-IN')} INR`;
        }
    };
    if (priceInput) priceInput.addEventListener('input', updatePricePreview);
    if (priceCurrSel) priceCurrSel.addEventListener('change', updatePricePreview);

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
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = val; };
        
        // Use formatCurrency which now respects activeCurrency global
        setVal('metric-revenue', formatCurrency(data.totalRevenue));
        setVal('metric-outstanding', formatCurrency(data.outstandingAmount));
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
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No products yet. Add your first product!</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>${formatCurrency(p.price)}</td>
                <td><span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
                <td><button class="btn btn-secondary btn-sm" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `).join('');
        // innerHTML needed for formatCurrency HTML
        tbody.querySelectorAll('td:nth-child(2)').forEach((td, i) => {
            td.innerHTML = formatCurrency(items[i].price);
        });
    } catch(e) { console.error('loadProducts error:', e); }
}

async function handleAddProduct(e) {
    e.preventDefault();
    const rawPrice = parseFloat(document.getElementById('prod-price').value);
    const priceCurrency = document.getElementById('prod-price-currency').value || 'USD';
    const prodName = document.getElementById('prod-name').value;

    if (!prodName || isNaN(rawPrice) || rawPrice <= 0) {
        return showToast('Name and a valid price are required', 'error');
    }
    
    // Always store in USD — convert if INR was entered
    const priceInUSD = toUSD(rawPrice, priceCurrency);
    const data = { 
        name: prodName, 
        price: parseFloat(priceInUSD.toFixed(4)), 
        description: document.getElementById('prod-desc').value 
    };
    
    setBtnLoading('btn-submit-product', true, 'Save Product');
    try { 
        await window.ProductsAPI.create(data); 
        // Feedback based on input currency
        const displayPrice = priceCurrency === 'INR' ? `₹${rawPrice.toLocaleString('en-IN')}` : `$${rawPrice.toFixed(2)}`;
        showToast(`Product Added! Price: ${displayPrice}`);
        
        closeModal('modal-product');
        // Reset form
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-desc').value = '';
        if (document.getElementById('prod-price-converted')) {
            document.getElementById('prod-price-converted').innerText = '';
        }
        loadProducts(); 
    }
    catch(e) { showToast(e.message || 'Failed to add product', 'error'); }
    finally { setBtnLoading('btn-submit-product', false, 'Save Product'); }
}

window.deleteProduct = (id) => showConfirmModal("Delete product?", async () => {
    try { await window.ProductsAPI.delete(id); loadProducts(); } catch(e) {}
});

/* ================= INVENTORY LOGIC ================= */
async function loadInventory() {
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;
    try {
        const res = await window.ProductsAPI.getAll(); 
        const items = res.products || [];
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No inventory yet. Add a product first!</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(p => {
            const stockColor = p.stock_quantity <= 0 ? 'color: var(--danger); font-weight: bold;' 
                             : (p.stock_quantity < 10 ? 'color: var(--warning); font-weight: bold;' : '');
            return `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.unit_size || '-'}</td>
                <td style="${stockColor}">${p.stock_quantity} remaining</td>
                <td>${formatCurrency(p.price)}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="openStockModal(${p.id}, ${p.price}, ${p.stock_quantity}, '${p.unit_size || ''}')"><i class="fa-solid fa-boxes-packing"></i> Manage Stock</button></td>
            </tr>
        `}).join('');
    } catch(e) { console.error('loadInventory error:', e); }
}

window.openStockModal = (id, price, stock, unit) => {
    document.getElementById('stock-product-id').value = id;
    
    // 🔥 DYNAMIC CURRENCY: Show price in INR if activeCurrency is INR
    const displayPrice = activeCurrency === 'INR' ? Math.round(price * LIVE_INR_RATE) : price;
    document.getElementById('stock-price').value = displayPrice;
    document.getElementById('stock-currency-label').innerText = `(${activeCurrency})`;

    document.getElementById('stock-quantity').value = stock;
    document.getElementById('stock-unit').value = unit || '';
    openModal('modal-stock');
};

async function handleUpdateStock(e) {
    e.preventDefault();
    const id = document.getElementById('stock-product-id').value;
    let price = parseFloat(document.getElementById('stock-price').value);
    const stock_quantity = parseInt(document.getElementById('stock-quantity').value);
    const unit_size = document.getElementById('stock-unit').value;

    // 🔥 DYNAMIC SAVE: Convert back to USD if the Admin typed it in INR
    if (activeCurrency === 'INR' && !isNaN(price)) {
        price = price / LIVE_INR_RATE;
    }

    const updates = { stock_quantity, unit_size };
    if (!isNaN(price)) updates.price = price;

    setBtnLoading('btn-submit-stock', true, 'Save Inventory');
    try {
        await window.API.put(`/products/${id}`, updates);
        showToast("Inventory Updated!");
        closeModal('modal-stock');
        loadInventory();
        if(!document.getElementById('view-products').classList.contains('hidden')) loadProducts(); 
    } catch(err) { showToast(err.message || 'Failed to update stock', 'error'); }
    finally { setBtnLoading('btn-submit-stock', false, 'Save Inventory'); }
}

/* ================= ORDERS & LOGISTICS ================= */
async function openOrderModal() {
    try {
        const pres = await window.ProductsAPI.getAll();
        const cSel = document.getElementById('order-customer');
        const pSel = document.getElementById('order-product');
        const searchInput = document.getElementById('order-customer-search');
        const adminSection = document.getElementById('admin-customer-selection');
        const customerDisplay = document.getElementById('customer-info-display');
        
        // Populate Products — include stock_quantity as data-stock (Force numeric)
        if (pSel) {
            pSel.innerHTML = '<option value="" data-price="0" data-stock="-1">Select Product...</option>' + 
                pres.products.map(p => {
                    const s = (p.stock_quantity !== undefined && p.stock_quantity !== null) ? p.stock_quantity : -1;
                    return `<option value="${p.id}" data-price="${p.price}" data-stock="${s}">${p.name} (${formatCurrency(p.price)})</option>`;
                }).join('');
        }

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
            let self = cres.customers.find(c => c.email.toLowerCase() === currentUser.email.toLowerCase());
            
            if (!self) {
                // Auto-create customer profile to fix the button not working issue
                try {
                    await window.CustomersAPI.create({
                        name: currentUser.name || 'Customer',
                        email: currentUser.email,
                        phone: '',
                        address: ''
                    });
                    const newCres = await window.CustomersAPI.getAll();
                    self = newCres.customers.find(c => c.email.toLowerCase() === currentUser.email.toLowerCase());
                } catch(err) {
                    console.error("Failed to auto-create customer profile:", err);
                }
            }

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
        
        const updateOrderPreview = () => {
            const opt = pSel.options[pSel.selectedIndex];
            const price = parseFloat(opt.getAttribute('data-price') || 0);
            const stock = parseInt(opt.getAttribute('data-stock') ?? -1);
            const qty = parseInt(document.getElementById('order-qty').value || 1);
            
            console.log(`[OrderPreview] Product: ${opt.text}, Stock: ${stock}, Requested: ${qty}`);
            
            document.getElementById('order-total-preview').innerText = formatCurrency(price * qty);

            const hint = document.getElementById('stock-availability-hint');
            const warningBox = document.getElementById('order-stock-warning');
            const warningMsg = document.getElementById('order-stock-warning-msg');

            if (!hint || !warningBox || !warningMsg) return;

            if (pSel.value && stock >= 0) {
                // Show availability hint
                hint.style.display = 'block';
                if (stock === 0) {
                    hint.innerHTML = `<span style="color:#ef4444; font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> Out of stock</span>`;
                } else if (qty > stock) {
                    hint.innerHTML = `<span style="color:#f59e0b; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Only ${stock} in stock</span>`;
                } else {
                    hint.innerHTML = `<span style="color:#10b981; font-weight:600;"><i class="fa-solid fa-circle-check"></i> ${stock} available</span>`;
                }

                // Show/hide warning banner
                if (qty > stock) {
                    const shortage = qty - stock;
                    warningMsg.innerText = `You are ordering ${qty} units but only ${stock} are currently in stock. The remaining ${shortage} unit(s) will be backordered — delivery may be delayed. You can still proceed if that's okay.`;
                    warningBox.classList.remove('hidden');
                } else {
                    warningBox.classList.add('hidden');
                }
            } else {
                hint.style.display = 'none';
                warningBox.classList.add('hidden');
            }
        };

        pSel.onchange = updateOrderPreview;
        document.getElementById('order-qty').oninput = updateOrderPreview;
        
        openModal('modal-order');
    } catch(e) {
        console.error(e);
        showToast("Error loading order form", "error");
    }
}

async function handleCreateOrder(e) {
    e.preventDefault();
    const customerId = document.getElementById('order-customer').value;
    const pSel = document.getElementById('order-product');
    const productId = pSel.value;
    const qty = parseInt(document.getElementById('order-qty').value);

    if (!customerId || !productId) return showToast("Select customer and product", "error");

    // Pre-flight stock check — warn BEFORE placing the order
    const selectedOpt = pSel.options[pSel.selectedIndex];
    let stock = parseInt(selectedOpt.getAttribute('data-stock') ?? -1);
    
    // Safety Fallback: If stock is -1, try to find it in the products list
    if (stock === -1) {
        try {
            const pres = await window.ProductsAPI.getAll();
            const p = pres.products.find(x => x.id == productId);
            if (p) stock = p.stock_quantity;
        } catch(err) { console.error("Fallback stock check failed", err); }
    }

    console.log(`[CreateOrder] Final Check - Product: ${selectedOpt.text}, Stock: ${stock}, Requested: ${qty}`);

    if (stock >= 0 && qty > stock) {
        const shortage = qty - stock;
        const productName = selectedOpt.text.split(' (')[0];
        
        // Use a standard browser alert for visibility check
        console.warn("STOCK SHORTAGE DETECTED! Showing modal...");
        
        const confirmed = await new Promise(resolve => {
            showConfirmModal(
                `⚠️ Stock Shortage: ${productName}`,
                () => resolve(true),
                () => resolve(false),
                `You ordered ${qty} units but only ${stock} are available right now. The missing ${shortage} unit(s) will be backordered and your delivery may be delayed. Do you want to continue?`,
                'Yes, I accept the delay',
                'Cancel'
            );
        });
        
        console.log(`[CreateOrder] Confirmation result: ${confirmed}`);
        if (!confirmed) return;
    }

    const data = {
        customer: customerId,
        products: [{ product: productId, quantity: qty }]
    };

    setBtnLoading('btn-submit-order', true, 'Create Order');
    try {
        await window.OrdersAPI.create(data);
        showToast("Order Created!");
        closeModal('modal-order');
        loadOrders();
    } catch(err) {
        console.error("Order Creation Error:", err);
        showToast(err.message || "Failed to create order", "error");
    } finally {
        setBtnLoading('btn-submit-order', false, 'Create Order');
    }
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
            
            if (o.status === 'delivered' && o.proof_image_url) {
                actions += ` <button class="btn btn-success btn-sm" onclick="openImagePreview('${o.proof_image_url}', 'Order #${o.id} Proof')"><i class="fa-solid fa-image"></i> Proof</button>`;
            }

            // Allow assignment if confirmed OR out_for_delivery (for re-assignment/substitution)
            if ((o.status === 'confirmed' || o.status === 'out_for_delivery') && isStaff) {
                const btnText = o.status === 'out_for_delivery' ? 'Re-assign' : 'Assign';
                actions += ` <button class="btn btn-primary btn-sm" onclick="openAssignDriver(${o.id})">${btnText}</button>`;
            }

            if (o.status === 'out_for_delivery') {
                if (isDriver) {
                    actions += ` <button class="btn btn-warning btn-sm" onclick="openDriverTracking(${o.id})"><i class="fa-solid fa-location-crosshairs"></i> GPS</button>`;
                    actions += ` <button class="btn btn-success btn-sm" onclick="openSubmitProof(${o.id})"><i class="fa-solid fa-camera"></i> Proof</button>`;
                }
                if (isStaff) {
                    actions += ` <button class="btn btn-primary btn-sm" onclick="openTimeline(${o.id})" title="View live driver location"><i class="fa-solid fa-map-location-dot"></i> Live Map</button>`;
                }
            }
            // Add copy payment link button if unpaid/overdue
            if (isStaff && (o.payment_status === 'unpaid' || o.payment_status === 'overdue')) {
                actions += ` <button class="btn btn-neutral btn-sm" onclick="copyPaymentLinkByOrderId(${o.id})" title="Copy Link"><i class="fa-solid fa-link"></i></button>`;
                actions += ` <button class="btn btn-success btn-sm" onclick="sendPaymentWhatsApp(${o.id})" title="Send via WhatsApp" style="background:#25D366; border-color:#25D366;"><i class="fa-brands fa-whatsapp"></i></button>`;
                actions += ` <button class="btn btn-primary btn-sm" onclick="sendPaymentEmail(${o.id})" title="Send via Email"><i class="fa-solid fa-envelope"></i></button>`;
            }

            // Pay Now button for customers
            if (currentUser.role === 'customer' && (o.payment_status === 'unpaid' || o.payment_status === 'overdue')) {
                actions += ` <button class="btn btn-success btn-sm" onclick="payOrder(${o.id})" style="background:var(--primary); border-color:var(--primary);"><i class="fa-solid fa-credit-card"></i> Pay Now</button>`;
            }

            let pBadgeClass = 'warning';
            if (o.payment_status === 'paid') pBadgeClass = 'success';
            if (o.payment_status === 'overdue') pBadgeClass = 'danger';

            const isCustomer = currentUser.role === 'customer';
            const checkboxHtml = isStaff ? `<td class="driver-hidden admin-only"><input type="checkbox" class="order-batch-cb" value="${o.id}" data-status="${o.status}" ${o.status !== 'pending' && o.status !== 'confirmed' ? 'disabled' : ''}></td>` : '';
            
            // Clean status label with proper casing for all users
            const statusLabel = o.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            return `<tr>
                ${checkboxHtml}
                <td>#${o.id}</td>
                ${isStaff ? `<td class="admin-only">${o.customer_name}</td>` : ''}
                <td>${formatCurrency(o.total_amount)}</td>
                ${isStaff ? `<td class="admin-only">${o.batch_id ? `<span class="badge badge-neutral" style="background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe;">Route #${o.batch_id}</span>` : '<span style="color:#d1d5db; font-size:0.8rem;">Single</span>'}</td>` : ''}
                <td>${formatDate(o.created_at)}</td>
                <td><span class="badge badge-${o.status === 'delivered' ? 'success' : (o.status === 'out_for_delivery' ? 'primary' : 'warning')}">${statusLabel}</span></td>
                <td><span class="badge badge-${pBadgeClass}">${(o.payment_status || 'unpaid').toUpperCase()}</span></td>
                ${isStaff ? `<td>
                    <select class="input" onchange="updateOrderStatus(${o.id}, this.value, ${o.driver_id || 'null'}, '${o.status}')" ${!isStaff || o.status === 'delivered' ? 'disabled' : ''}>
                        <option value="pending" ${o.status === 'pending' ? 'selected' : ''} ${o.status !== 'pending' ? 'disabled' : ''}>Pending</option>
                        <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''} ${o.status === 'out_for_delivery' ? 'disabled' : ''}>Confirmed</option>
                        <option value="out_for_delivery" ${o.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
                        <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    </select>
                </td>` : ''}
                <td class="table-actions">${actions}</td>
            </tr>`;
        }).join('');
    } catch(e) { console.error(e); }
}

window.updateOrderStatus = async (id, status, driverId, currentStatus) => {
    // BUSINESS RULE: Cannot move back from Delivered
    if (currentStatus === 'delivered' && status !== 'delivered') {
        showToast("Cannot change status of a Delivered order.", "error");
        loadOrders();
        return;
    }

    // BUSINESS RULE: Cannot go out for delivery without a driver via dropdown
    if (status === 'out_for_delivery' && (!driverId || driverId === null)) {
        showToast("Use the 'Assign' button to set an order to Out for Delivery.", "error");
        loadOrders();
        return;
    }

    if (status === 'delivered') {
        const role = currentUser.role;
        if (role === 'driver') {
            // Drivers MUST provide proof
            showToast("Driver must provide proof image to confirm delivery", "warning");
            openSubmitProof(id);
            loadOrders();
            return;
        } else {
            // Admins get a choice: Upload proof OR just mark as delivered
            showConfirmModal("Mark as Delivered? You can upload a proof image or just update the status.", () => {
                // Nested confirm for Admin convenience
                const choice = confirm("Press OK to upload a Proof Image, or Cancel to mark as delivered without an image.");
                if (choice) {
                    openSubmitProof(id);
                } else {
                    // Admin override: No proof needed
                    forceUpdateStatus(id, status);
                }
            });
            loadOrders();
            return;
        }
    }
    forceUpdateStatus(id, status);
};

async function forceUpdateStatus(id, status) {
    try { 
        await window.OrdersAPI.updateStatus(id, status); 
        showToast("Status Updated"); 
        loadOrders(); 
    } catch(e) { showToast(e.message || "Failed to update status", "error"); }
}

window.payOrder = async (id) => {
    try {
        console.log(`[FlowOps] Initiating payment for Order #${id}`);
        showToast("Opening Secure Payment...", "info");
        
        const res = await window.OrdersAPI.createPaymentSession(id);
        
        if (res.status === 'success' && res.url) {
            // Using replace for mobile to prevent back-button loops
            window.location.assign(res.url);
        } else {
            throw new Error(res.message || "Failed to generate payment link");
        }
    } catch(e) {
        console.error("[FlowOps] Payment Error:", e);
        showToast(e.message || "Payment gateway unavailable", "error");
    }
};

/* ================= BATCH & ROUTING LOGIC ================= */
function toggleBatchActions() {
    const checked = document.querySelectorAll('.order-batch-cb:checked');
    const actions = document.getElementById('batch-actions');
    if (actions) {
        if (checked.length > 0) actions.classList.remove('hidden');
        else actions.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const selectAll = document.getElementById('selectAllOrders');
    if(selectAll) {
        selectAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.order-batch-cb:not([disabled])').forEach(cb => {
                cb.checked = isChecked;
            });
            toggleBatchActions();
        });
    }

    const tbodyOrders = document.getElementById('orders-tbody');
    if(tbodyOrders) {
        tbodyOrders.addEventListener('change', (e) => {
            if (e.target.classList.contains('order-batch-cb')) {
                toggleBatchActions();
            }
        });
    }
});

async function handleOpenBatchModal() {
    const checked = document.querySelectorAll('.order-batch-cb:checked');
    if (checked.length === 0) return showToast("Select at least one order", "error");
    
    try {
        const users = await window.UsersAPI.getAll();
        const drivers = (Array.isArray(users) ? users : (users.users || [])).filter(u => u.role === 'driver');
        const sel = document.getElementById('batch-driver');
        
        sel.innerHTML = '<option value="">Select Driver...</option>' + 
            drivers.map(d => {
                const busyCount = parseInt(d.active_orders || 0);
                const statusText = busyCount > 0 ? ` (Busy: ${busyCount} stops)` : ' (Available)';
                const color = busyCount > 0 ? '#f59e0b' : '#1bbf72';
                return `<option value="${d.id}" style="color: ${color}; font-weight: 500;">${d.name}${statusText}</option>`;
            }).join('');
            
        openModal('modal-batch');
    } catch(e) { 
        console.error("Load Drivers Error:", e);
        showToast("Failed to load drivers", "error"); 
    }
}

async function handleAssignBatch(e) {
    e.preventDefault();
    const driverId = document.getElementById('batch-driver').value;
    const checked = Array.from(document.querySelectorAll('.order-batch-cb:checked')).map(cb => cb.value);

    if (!driverId) return showToast("Select a driver", "error");
    if (checked.length === 0) return showToast("No orders selected", "error");

    setBtnLoading('btn-submit-batch', true, 'Assigning...');
    try {
        await window.BatchesAPI.create(driverId, checked);
        showToast("Route Assigned Successfully!", "success");
        closeModal('modal-batch');
        
        // Reset checkbox state
        const selectAll = document.getElementById('selectAllOrders');
        if (selectAll) selectAll.checked = false;
        
        toggleBatchActions();
        loadOrders();
    } catch(err) {
        console.error("Batch Error:", err);
        showToast(err.message || "Failed to assign batch", "error");
    } finally {
        setBtnLoading('btn-submit-batch', false, 'Send Route to Driver');
    }
}

/* ================= PAYMENTS ================= */
async function loadPayments() {
    try {
        const statsRes = await window.InvoicesAPI.getStats();
        const stats = statsRes.stats;
        
        document.getElementById('metric-total-paid').innerText = formatCurrency(stats.total_paid);
        document.getElementById('metric-paid-count').innerText = `${stats.paid_count} invoices`;
        
        document.getElementById('metric-total-unpaid').innerText = formatCurrency(stats.total_unpaid);
        document.getElementById('metric-unpaid-count').innerText = `${stats.unpaid_count} invoices`;
        
        document.getElementById('metric-total-overdue').innerText = formatCurrency(stats.total_overdue);
        document.getElementById('metric-overdue-count').innerText = `${stats.overdue_count} invoices`;

        const invRes = await window.InvoicesAPI.getAll();
        const tbody = document.getElementById('invoices-tbody');
        tbody.innerHTML = invRes.invoices.map(i => {
            let pBadgeClass = 'warning';
            if (i.status === 'paid') pBadgeClass = 'success';
            if (i.status === 'overdue') pBadgeClass = 'danger';

            let actions = '';
            if (i.status !== 'paid') {
                actions = `<button class="btn btn-neutral btn-sm" onclick="copyDirectPaymentLink('${i.payment_token}')" title="Copy Link"><i class="fa-solid fa-link"></i></button>`;
                actions += ` <button class="btn btn-success btn-sm" onclick="sendPaymentWhatsApp(${i.order_id})" title="Send via WhatsApp" style="background:#25D366; border-color:#25D366;"><i class="fa-brands fa-whatsapp"></i></button>`;
                actions += ` <button class="btn btn-primary btn-sm" onclick="sendPaymentEmail(${i.order_id})" title="Send via Email"><i class="fa-solid fa-envelope"></i></button>`;
            }

            return `<tr>
                <td>#${i.id}</td>
                <td>${i.customer_name} <br><small class="text-muted">${i.customer_email}</small></td>
                <td>
                    <a href="#" onclick="switchView('orders'); return false;">#${i.order_id}</a>
                    <br><small class="text-muted" style="font-weight:500;">${i.product_details || 'N/A'}</small>
                </td>
                <td>${formatCurrency(i.amount)}</td>
                <td>${formatDate(i.due_date)}</td>
                <td><span class="badge badge-${pBadgeClass}">${i.status.toUpperCase()}</span></td>
                <td>${actions}</td>
            </tr>`;
        }).join('');
    } catch(e) {
        console.error(e);
    }
}

window.copyDirectPaymentLink = (token) => {
    const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const url = `${window.location.origin}${basePath}/pay.html?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast("Payment link copied to clipboard!", "success");
    });
};

window.getInvoiceByOrderId = async (orderId) => {
    try {
        const res = await window.InvoicesAPI.getAll();
        return res.invoices.find(i => i.order_id === orderId);
    } catch(e) {
        return null;
    }
};

window.generatePaymentMessage = (invoice) => {
    const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const url = `${window.location.origin}${basePath}/pay.html?token=${invoice.payment_token}`;
    const message = `Hi ${invoice.customer_name},\n\nYour order #${invoice.order_id} has been delivered. Please pay your invoice of ${formatCurrency(invoice.amount)} securely using this link:\n${url}\n\nThank you for choosing FlowOps!`;
    return { url, message };
};

window.copyPaymentLinkByOrderId = async (orderId) => {
    try {
        const invoice = await window.getInvoiceByOrderId(orderId);
        if (invoice) {
            window.copyDirectPaymentLink(invoice.payment_token);
        } else {
            showToast("No invoice found for this order. It may have been delivered before the invoicing system was added.", "error");
        }
    } catch(e) {
        showToast("Error fetching invoice link.", "error");
    }
};

window.sendPaymentWhatsApp = async (orderId) => {
    const invoice = await window.getInvoiceByOrderId(orderId);
    if (!invoice) return showToast("No invoice found for this order.", "error");
    
    const { message } = window.generatePaymentMessage(invoice);
    // If we had the phone number, we could use https://wa.me/NUMBER?text=
    // Since phone isn't reliably retrieved here, we just open WhatsApp Web selection
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
};

window.sendPaymentEmail = async (orderId) => {
    const invoice = await window.getInvoiceByOrderId(orderId);
    if (!invoice) return showToast("No invoice found for this order.", "error");
    
    const { message } = window.generatePaymentMessage(invoice);
    const subject = `Invoice for Order #${invoice.order_id}`;
    const emailUrl = `mailto:${invoice.customer_email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.open(emailUrl, '_blank');
};

/* ================= ADMIN LIVE MAP TRACKING ================= */
let _adminMap = null;
let _adminMapMarker = null;
let _adminPollInterval = null;
let _adminTrackingOrderId = null;

window.openAdminLiveMap = async (orderId) => {
    _adminTrackingOrderId = orderId;
    openModal('order-timeline-modal');

    // Small delay to ensure the modal/map div is visible
    setTimeout(async () => {
        const liveSection = document.getElementById('live-map-section');
        if (liveSection) liveSection.style.display = 'block';

        const mapDiv = document.getElementById('timeline-map');
        if (!mapDiv) return;

        // Destroy old map if exists
        if (_adminMap) { _adminMap.remove(); _adminMap = null; }

        // Default center: New Delhi
        const defaultLat = 28.6139, defaultLng = 77.2090;
        _adminMap = L.map(mapDiv).setView([defaultLat, defaultLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(_adminMap);

        const driverIcon = L.divIcon({
            className: '',
            html: '<div style="background:#4f46e5;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff;"><i class="fa-solid fa-truck" style="font-size:14px;"></i></div>',
            iconSize: [32, 32], iconAnchor: [16, 16]
        });
        _adminMapMarker = L.marker([defaultLat, defaultLng], { icon: driverIcon }).addTo(_adminMap);
        _adminMapMarker.bindPopup('<b>Driver Location</b><br>Waiting for GPS...').openPopup();

        // Immediate fetch
        await _fetchAdminLocation();

        // Start polling every 5 seconds as Socket.io fallback
        if (_adminPollInterval) clearInterval(_adminPollInterval);
        _adminPollInterval = setInterval(_fetchAdminLocation, 5000);
    }, 300);
};

const _fetchAdminLocation = async () => {
    if (!_adminTrackingOrderId || !_adminMap) return;
    try {
        const data = await window.OrdersAPI.getLocation(_adminTrackingOrderId);
        if (data && data.delivery_location) {
            const [lat, lng] = data.delivery_location.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
                _adminMap.setView([lat, lng], 15);
                _adminMapMarker.setLatLng([lat, lng]);
                const label = data.driver_name ? `${data.driver_name} (${data.vehicle_number})` : 'Driver';
                _adminMapMarker.getPopup().setContent(`<b>${label}</b><br>Last updated: ${new Date().toLocaleTimeString()}`);
                document.getElementById('live-map-timestamp').innerText = `Updated: ${new Date().toLocaleTimeString()}`;
                document.getElementById('live-driver-info').innerHTML = data.driver_name
                    ? `<i class='fa-solid fa-truck'></i> <b>${data.driver_name}</b> — Vehicle: ${data.vehicle_number || 'N/A'}`
                    : '<i class="fa-solid fa-clock"></i> Waiting for driver to start GPS...';
                const gmapsLink = document.getElementById('link-admin-google-maps');
                if (gmapsLink) { gmapsLink.href = `https://www.google.com/maps?q=${lat},${lng}`; gmapsLink.style.display = 'flex'; }
            }
        }
    } catch(e) { /* silent fail on poll */ }
};

// Stop polling when the modal closes
document.addEventListener('click', (e) => {
    if (e.target.closest('.modal-close') && _adminPollInterval) {
        clearInterval(_adminPollInterval);
        _adminPollInterval = null;
        _adminTrackingOrderId = null;
    }
});

window.openTimeline = async (id) => {
    try {
        const orders = await window.OrdersAPI.getAll();
        const o = orders.find(x => x.id == id);
        if (!o) return showToast('Order not found', 'error');

        const statusOrder = ['pending', 'confirmed', 'out_for_delivery', 'delivered'];
        const curIdx = statusOrder.indexOf(o.status);

        const mkNode = (title, date, icon, color, desc, step) => {
            const active = step <= curIdx;
            return `<div class="timeline-item ${active ? 'active' : ''}">
                <div class="timeline-icon" style="background:${active ? color : '#e2e8f0'}"><i class="${icon}"></i></div>
                <div class="timeline-content">
                    <div class="timeline-header"><h5>${title}</h5><span class="timeline-date">${date ? formatDateTime(date) : (active ? 'In Progress' : 'Pending')}</span></div>
                    ${desc ? `<p class="timeline-desc">${desc}</p>` : ''}
                </div>
            </div>`;
        };

        const driverDesc = o.driver_name ? `<i class='fa-solid fa-user'></i> ${o.driver_name} &nbsp;|&nbsp; <i class='fa-solid fa-car'></i> ${o.vehicle_number || 'N/A'}` : 'Awaiting assignment';

        // Build proof section
        let proofDesc = '';
        if (o.proof_image_url) {
            const ts = o.delivered_at ? `Delivered at: ${formatDateTime(o.delivered_at)}` : 'Proof uploaded';
            proofDesc = `<div style="margin-top:0.75rem; padding:0.5rem; background:rgba(16,185,129,0.05); border-radius:10px; border:1px solid rgba(16,185,129,0.1);">
                <img src="${o.proof_image_url}" onclick="openImagePreview('${o.proof_image_url}', '${ts}')" 
                    style="width:100%; max-height:220px; border-radius:8px; cursor:pointer; object-fit:cover; display:block; margin:0 auto;"
                    title="Click to view full size" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                <div style="display:none; padding:1rem; text-align:center; color:var(--text-muted);">
                    <i class='fa-solid fa-image-slash' style='font-size:2rem; display:block; margin-bottom:0.5rem;'></i> Image failed to load
                </div>
                <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem; margin-top:0.6rem; font-size:0.75rem; color:#10b981; font-weight:600;">
                    <i class='fa-solid fa-certificate'></i> Verified Delivery
                </div>
                <p style="font-size:0.7rem; color:var(--text-muted); text-align:center; margin-top:0.2rem;">
                    ${ts}
                </p>
            </div>`;
        } else if (o.status === 'delivered') {
            proofDesc = `<div style="padding:0.75rem; background:rgba(239,68,68,0.05); border-radius:8px; border:1px dashed rgba(239,68,68,0.2); text-align:center; font-size:0.8rem; color:var(--text-muted);">
                <i class='fa-solid fa-triangle-exclamation' style="color:#f59e0b;"></i> No proof image available for this delivery.
            </div>`;
        }

        const content = document.getElementById('timeline-container');
        content.innerHTML =
            mkNode('Order Placed', o.created_at, 'fa-solid fa-receipt', '#10b981', '', 0) +
            mkNode('Confirmed & Packed', o.packed_at || (curIdx >= 1 ? o.created_at : null), 'fa-solid fa-box', '#3b82f6', '', 1) +
            mkNode('Out for Delivery', o.out_for_delivery_at, 'fa-solid fa-truck', '#f59e0b', driverDesc, 2) +
            mkNode('Delivered ✅', o.delivered_at, 'fa-solid fa-check', '#10b981', proofDesc, 3);

        // Show live map for admins if out_for_delivery
        const liveSection = document.getElementById('live-map-section');
        if (liveSection) {
            const isAdminOrCustomer = ['admin', 'superadmin', 'customer'].includes(currentUser.role);
            if (o.status === 'out_for_delivery' && isAdminOrCustomer) {
                liveSection.style.display = 'block';
            } else {
                liveSection.style.display = 'none';
            }
        }

        openModal('order-timeline-modal');

        // If out_for_delivery, init admin map
        if (o.status === 'out_for_delivery') {
            _adminTrackingOrderId = id;
            setTimeout(async () => {
                const mapDiv = document.getElementById('timeline-map');
                if (!mapDiv) return;
                if (_adminMap) { _adminMap.remove(); _adminMap = null; }
                if (_adminPollInterval) clearInterval(_adminPollInterval);

                const defaultLat = 28.6139, defaultLng = 77.2090;
                _adminMap = L.map(mapDiv).setView([defaultLat, defaultLng], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(_adminMap);

                const driverIcon = L.divIcon({
                    className: '',
                    html: '<div style="background:#4f46e5;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff;"><i class="fa-solid fa-truck" style="font-size:14px;"></i></div>',
                    iconSize: [32, 32], iconAnchor: [16, 16]
                });
                _adminMapMarker = L.marker([defaultLat, defaultLng], { icon: driverIcon }).addTo(_adminMap)
                    .bindPopup('<b>Driver</b><br>Waiting for GPS signal...').openPopup();

                await _fetchAdminLocation();
                _adminPollInterval = setInterval(_fetchAdminLocation, 5000);
            }, 300);
        }
    } catch(e) {
        console.error('Timeline error:', e);
        showToast('Failed to load order timeline', 'error');
    }
};

// Full screen image preview
window.openImagePreview = (src, caption) => {
    document.getElementById('full-screen-img').src = src;
    document.getElementById('full-screen-img-caption').innerText = caption || '';
    openModal('image-preview-modal');
};

/* ================= LOGISTICS TOOLS ================= */
window.openAssignDriver = async (id) => {
    document.getElementById('assign-driver-order-id').value = id;
    const users = await window.UsersAPI.getAll();
    const drivers = (Array.isArray(users) ? users : (users.users || [])).filter(u => u.role === 'driver');
    const sel = document.getElementById('driver-selection');
    
    sel.innerHTML = '<option value="">Select Driver...</option>' + 
        drivers.map(d => {
            const busyCount = parseInt(d.active_orders || 0);
            const statusText = busyCount > 0 ? ` (Busy: ${busyCount} active)` : ' (Available)';
            const color = busyCount > 0 ? '#f59e0b' : '#1bbf72';
            return `<option value="${d.id}" style="color: ${color}; font-weight: 500;">${d.name}${statusText}</option>`;
        }).join('');
    
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

    // Init Leaflet map for driver tracking modal
    setTimeout(() => {
        const mapDiv = document.getElementById('tracking-map');
        if (!mapDiv) return;
        if (_trackingMap) { _trackingMap.remove(); _trackingMap = null; }

        const defaultLat = 28.6139, defaultLng = 77.2090;
        _trackingMap = L.map(mapDiv).setView([defaultLat, defaultLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(_trackingMap);

        const myIcon = L.divIcon({
            className: '',
            html: '<div style="background:#10b981;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff;"><i class="fa-solid fa-location-dot" style="font-size:14px;"></i></div>',
            iconSize: [32, 32], iconAnchor: [16, 16]
        });
        _trackingMarker = L.marker([defaultLat, defaultLng], { icon: myIcon }).addTo(_trackingMap);
        _trackingMarker.bindPopup('Your Location').openPopup();
    }, 300);
};

async function startGpsTracking() {
    _trackingOrderId = document.getElementById('tracking-order-id').value;
    
    // Check permissions first to give better feedback
    if (navigator.permissions && navigator.permissions.query) {
        try {
            const status = await navigator.permissions.query({ name: 'geolocation' });
            if (status.state === 'denied') {
                alert("📍 Location Access Blocked!\n\nPlease click the lock icon in your browser URL bar and set Location to 'Allow', then refresh the page.");
                return;
            }
        } catch(e) {}
    }

    document.getElementById('btn-start-tracking').disabled = true;
    document.getElementById('btn-stop-tracking').disabled = false;
    document.getElementById('tracking-status-badge').innerHTML = '<span style="width:8px; height:8px; background:#10b981; border-radius:50%; display:inline-block; animation: pulse 1s infinite;"></span> GPS Active';
    document.getElementById('tracking-status-badge').style.color = '#10b981';
    document.getElementById('tracking-status-badge').style.background = 'rgba(16,185,129,0.1)';

    // Request high accuracy position once to force the system prompt
    navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true });

    _gpsWatchId = navigator.geolocation.watchPosition(async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        
        // Dynamic accuracy: Accept first reading, then filter for < 100m
        if (!_trackingMarker.getLatLng().lat || accuracy < 100) {
            document.getElementById('tracking-coords').innerText = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
            document.getElementById('tracking-accuracy').innerText = `Accuracy: ${accuracy.toFixed(1)}m`;

            // Update driver's map marker
            if (_trackingMap && _trackingMarker) {
                _trackingMap.setView([lat, lng], 16); // Zoom in more for "live" feel
                _trackingMarker.setLatLng([lat, lng]);
                _trackingMarker.getPopup().setContent(`<b>Driver Location</b><br>Accuracy: ${accuracy.toFixed(1)}m`);
            }

            // Update Google Maps external button
            const gmBtn = document.getElementById('btn-open-google-maps');
            if (gmBtn) {
                gmBtn.style.display = 'flex';
                gmBtn.onclick = () => window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
            }

            // Send to backend + broadcast via socket
            try {
                await window.OrdersAPI.updateLocation(_trackingOrderId, { lat, lng });
            } catch(err) {
                console.error('Location update failed:', err);
            }
        }
    }, (err) => {
        let msg = "GPS Error";
        if (err.code === 1) msg = "Permission Denied. Please enable GPS in browser settings.";
        else if (err.code === 3) msg = "GPS Timeout. Please ensure you are outdoors.";
        
        showToast(msg, 'error');
        stopGpsTracking();
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
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
        // Check permission explicitly for better feedback
        if (navigator.permissions && navigator.permissions.query) {
            const status = await navigator.permissions.query({ name: 'camera' });
            if (status.state === 'denied') {
                throw new Error("Permission Denied");
            }
        }

        _cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = document.getElementById('webcam-video');
        video.srcObject = _cameraStream;
        video.style.display = 'block';
        document.getElementById('camera-placeholder').style.display = 'none';
        document.getElementById('btn-capture-photo').classList.remove('hidden');
    } catch(e) { 
        showToast("Direct Camera Blocked. Using System Camera instead.", "warning");
        // Fallback: Click the hidden file input that has capture="camera"
        const fallbackInput = document.getElementById('camera-fallback-input');
        if (fallbackInput) fallbackInput.click();
    }
}
function stopCameraStream() { 
    if(_cameraStream) {
        _cameraStream.getTracks().forEach(t => t.stop());
        _cameraStream = null;
    }
    const btn = document.getElementById('btn-capture-photo');
    if (btn) btn.classList.add('hidden');
}
function capturePhoto() {
    const video = document.getElementById('webcam-video');
    // High-efficiency resizing for Cloud DB compatibility
    const MAX_WIDTH = 640; 
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.getElementById('capture-canvas');
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 0.5 quality is the "sweet spot" for small size + clear proof
    const data = canvas.toDataURL('image/webp', 0.5); 
    
    const img = document.getElementById('proof-preview-img');
    img.src = data; 
    img.style.display = 'block';
    video.style.display = 'none';
    stopCameraStream();
    document.getElementById('submit-proof-submit').disabled = false;
}

async function handleProofFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById('capture-canvas');
            const MAX_WIDTH = 640;
            const scale = Math.min(1, MAX_WIDTH / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const data = canvas.toDataURL('image/webp', 0.5);
            const preview = document.getElementById('proof-preview-img');
            preview.src = data;
            preview.style.display = 'block';
            document.getElementById('webcam-video').style.display = 'none';
            document.getElementById('camera-placeholder').style.display = 'none';
            document.getElementById('submit-proof-submit').disabled = false;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
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
            <td>
                <button class="btn btn-secondary btn-sm" onclick="openEditUser(${u.id}, '${u.role}', ${u.is_active})" title="Edit User"><i class="fa-solid fa-user-pen"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})" style="margin-left: 5px;" title="Delete User Permanently"><i class="fa-solid fa-trash"></i></button>
            </td>
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
        await window.API.post('/users/createUser', data); 
        showToast("User Added!"); 
        closeModal('modal-user'); 
        loadUsers(); 
    } catch(e) {} finally { setBtnLoading('btn-submit-user', false, 'Save User'); }
}

window.openEditUser = (id, role, isActive) => { 
    document.getElementById('edit-user-id').value = id; 
    document.getElementById('edit-user-role').value = role; 
    document.getElementById('edit-user-status').value = isActive ? "1" : "0";
    openModal('modal-edit-user'); 
};
async function handleUpdateUserRole(e) {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const role = document.getElementById('edit-user-role').value;
    const is_active = parseInt(document.getElementById('edit-user-status').value);
    
    setBtnLoading('btn-update-user', true, 'Save Changes');
    try { 
        await window.API.patch(`/users/${id}`, { role, is_active }); 
        showToast("User successfully updated!"); 
        closeModal('modal-edit-user'); 
        loadUsers(); 
    } catch(e) {} finally { setBtnLoading('btn-update-user', false, 'Save Changes'); }
}

window.deleteUser = async (id) => {
    showConfirmModal("Are you sure you want to permanently delete this user?", async () => {
        try {
            await window.API.delete(`/users/${id}`);
            showToast("User deleted permanently", "success");
            loadUsers();
        } catch (e) {
            if (e.message && e.message.includes("historical data")) {
                showToast("Cannot delete user with history. Please deactivate them instead.", "error");
            } else {
                showToast(e.message || "Failed to delete user", "error");
            }
        }
    });
};

window.regenerateInviteCode = async () => {
    showConfirmModal("Are you sure you want to regenerate the business invite code? Old codes will immediately become invalid for new signups.", async () => {
        try {
            const res = await window.API.post('/users/business/regenerate-code', {});
            if (res && res.newCode) {
                currentUser.inviteCode = res.newCode;
                document.getElementById('display-invite-code').textContent = res.newCode;
                showToast("Invite code regenerated successfully!", "success");
            }
        } catch (e) {
            showToast(e.message || "Failed to regenerate code", "error");
        }
    });
};

/* ================= REAL-TIME NOTIFICATIONS ================= */

// Helper: convert VAPID public key from base64url to Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Register Service Worker & Subscribe to Web Push
async function setupWebPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Web Push not supported in this browser.');
        return;
    }

    try {
        // 1. Register service worker (relative path works for Netlify)
        const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
        console.log('✅ Service Worker registered:', registration.scope);

        // 2. Ask for permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('⚠️ Notification permission denied.');
            return;
        }

        // 3. Subscribe to push
        const vapidKey = window.VAPID_PUBLIC_KEY;
        if (!vapidKey) return;

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });

        // 4. Send subscription to backend to save against this user
        await window.API.post('/users/push-subscription', { subscription });
        console.log('✅ Web Push subscription saved to server!');

    } catch (err) {
        console.error('❌ Web Push setup failed:', err.message);
    }
}

function initNotifications() {
    if (!currentUser || !currentUser.id) return;

    // 1. Setup Web Push (real OS notifications, works even when tab is closed)
    setupWebPush();

    // 2. Connect Socket for real-time in-app updates
    try {
        socket = io(window.API_URL.replace('/api', ''));
        
        socket.on('connect', () => {
            console.log("Real-time socket connected.");
            socket.emit('join', currentUser.id);
        });

        socket.on('notification', (data) => {
            showToast(`🔔 ${data.title}: ${data.message}`);
            notifications.unshift({ ...data, is_read: 0 });
            renderNotifications();
            playNotificationSound();
        });
    } catch(e) { console.error("Socket.io connection failed", e); }

    // 3. Load History
    loadNotificationHistory();

    // 4. UI Handlers
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
                await window.API.delete('/notifications/clear-all');
                notifications = [];
                renderNotifications();
            } catch(e) {}
        };
    }
}

async function loadNotificationHistory() {
    try {
        const data = await window.API.get('/notifications');
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
    // Mark all as read locally so renderNotifications() doesn't bring the badge back
    notifications.forEach(n => n.is_read = 1);
    // Also persist to server silently
    try { window.API.patch('/notifications/read-all'); } catch(e) {}
}

function playNotificationSound() {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(() => {});
}

/* UTILS */
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
function showConfirmModal(title, onConfirm, onCancel, message, confirmLabel, cancelLabel) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-msg');
    const titleEl = modal ? modal.querySelector('h3') : null;
    const confirmBtn = document.getElementById('btn-confirm');
    const cancelBtn = document.getElementById('btn-cancel-confirm');

    if (!modal || !confirmBtn || !cancelBtn) {
        // Fallback for missing modal
        if (confirm(message || title)) { if (onConfirm) onConfirm(); }
        else { if (onCancel) onCancel(); }
        return;
    }

    if (titleEl) titleEl.innerText = title || 'Are you sure?';
    if (msgEl) msgEl.innerText = message || 'This action cannot be undone.';
    if (confirmBtn) confirmBtn.innerText = confirmLabel || 'Yes, Proceed';
    if (cancelBtn) cancelBtn.innerText = cancelLabel || 'Cancel';

    modal.classList.remove('hidden');

    // Clone to remove old listeners
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.replaceWith(newConfirm);
    cancelBtn.replaceWith(newCancel);

    newConfirm.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (onConfirm) onConfirm();
    });
    newCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (onCancel) onCancel();
    });
}

/* ================= BATCHES & ROUTES (DRIVERS) ================= */
async function loadBatches() {
    const list = document.getElementById('batches-list');
    const stats = document.getElementById('driver-batch-stats');
    if (!list || !stats) return;

    try {
        const res = await window.BatchesAPI.getDriverBatches();
        const batches = Array.isArray(res) ? res : (res.batches || []);
        
        // Render Stats
        const total = batches.length;
        const pending = batches.filter(b => b.status !== 'completed').length;
        const completed = batches.filter(b => b.status === 'completed').length;
        
        stats.innerHTML = `
            <div class="metric-card">
                <div class="metric-icon" style="background: rgba(79, 70, 229, 0.1); color: var(--primary);"><i class="fa-solid fa-truck-ramp-box"></i></div>
                <div class="metric-data">
                    <h3>Total Routes</h3>
                    <p>${total}</p>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;"><i class="fa-solid fa-clock-rotate-left"></i></div>
                <div class="metric-data">
                    <h3>Active Runs</h3>
                    <p>${pending}</p>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;"><i class="fa-solid fa-circle-check"></i></div>
                <div class="metric-data">
                    <h3>Finished</h3>
                    <p>${completed}</p>
                </div>
            </div>
        `;

        if (batches.length === 0) {
            list.innerHTML = '<div style="grid-column: 1/-1; padding: 3rem; text-align: center; background: white; border-radius: 12px; border: 1px dashed var(--border-color); color: var(--text-muted);"><i class="fa-solid fa-route" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i> No routes assigned yet.</div>';
            return;
        }

        list.innerHTML = batches.map(b => {
            const progress = b.total_orders > 0 ? Math.round((b.completed_orders / b.total_orders) * 100) : 0;
            const isCompleted = b.status === 'completed' || (b.total_orders > 0 && b.completed_orders === b.total_orders);

            return `
                <div class="card" style="padding: 1.5rem; transition: transform 0.2s ease; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
                        <div>
                            <h3 style="margin-bottom: 0.25rem;">Route #${b.id}</h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted);">${formatDate(b.created_at)}</p>
                        </div>
                        <span class="badge badge-${isCompleted ? 'success' : 'primary'}">${(b.status || 'PENDING').toUpperCase()}</span>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.5rem; color: var(--text-muted);">
                            <span>Progress</span>
                            <span>${b.completed_orders} / ${b.total_orders} Stops</span>
                        </div>
                        <div style="height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                            <div style="width: ${progress}%; height: 100%; background: var(--primary);"></div>
                        </div>
                    </div>

                    <button class="btn btn-primary btn-block" onclick="openBatchDetail(${b.id})">
                        <i class="fa-solid fa-list-check"></i> ${isCompleted ? 'View Details' : 'Continue Deliveries'}
                    </button>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error(e);
        showToast("Error loading routes", "error");
    }
}

async function openBatchDetail(id) {
    try {
        const res = await window.BatchesAPI.getBatchDetails(id);
        const orders = Array.isArray(res) ? res : (res.orders || []);
        const modal = document.getElementById('modal-batch-detail');
        const titleEl = document.getElementById('batch-detail-title');
        const subtitleEl = document.getElementById('batch-detail-subtitle');
        const listEl = document.getElementById('batch-orders-list');
        const progressText = document.getElementById('batch-progress-text');
        const progressBar = document.getElementById('batch-progress-bar');
        const stopsLeftEl = document.getElementById('batch-stops-left');

        titleEl.innerText = `Route #${id}`;
        subtitleEl.innerText = `${orders.length} Stops Assigned`;

        const total = orders.length;
        const completed = orders.filter(o => o.status === 'delivered').length;
        const progress = Math.round((completed / total) * 100);

        progressText.innerText = `${progress}%`;
        progressBar.style.width = `${progress}%`;
        stopsLeftEl.innerText = (total - completed) || '0';

        listEl.innerHTML = orders.map(o => {
            const isDelivered = o.status === 'delivered';
            return `
                <div style="background: ${isDelivered ? 'rgba(16, 185, 129, 0.03)' : 'white'}; border: 1px solid ${isDelivered ? '#10b981' : '#e5e7eb'}; padding: 1.25rem; border-radius: 12px; display: flex; flex-direction: column; gap: 1rem;">
                    <div style="display: flex; align-items: flex-start; gap: 1rem;">
                        <div style="width: 40px; height: 40px; background: ${isDelivered ? '#10b981' : '#f3f4f6'}; color: ${isDelivered ? '#fff' : '#6b7280'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                            ${isDelivered ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-house"></i>'}
                        </div>
                        <div style="flex: 1;">
                            <h4 style="margin: 0; font-size: 1rem; color: var(--text-main);">${o.customer_name}</h4>
                            <p style="margin: 0.25rem 0; font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
                                <i class="fa-solid fa-location-dot" style="width: 15px;"></i> 
                                ${o.current_address || o.delivery_location || o.customer_address || 'Address not set'}
                            </p>
                            ${o.customer_phone ? `<p style="margin: 0; font-size: 0.8rem; color: var(--primary); font-weight: 500;"><i class="fa-solid fa-phone" style="width: 15px;"></i> ${o.customer_phone}</p>` : ''}
                        </div>
                        ${isDelivered ? '<div style="background: #10b981; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Done</div>' : ''}
                    </div>
                    
                    ${!isDelivered ? `
                    <div style="display: flex; gap: 0.75rem; padding-top: 0.5rem; border-top: 1px dashed #e5e7eb;">
                        <button class="btn btn-neutral" style="flex: 1; justify-content: center;" onclick="openDriverTracking(${o.id})">
                            <i class="fa-solid fa-location-crosshairs"></i> GPS
                        </button>
                        <button class="btn btn-success" style="flex: 1; justify-content: center;" onclick="handleMarkDeliveredInBatch(${o.id}, ${id})">
                            <i class="fa-solid fa-camera"></i> Delivered
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        openModal('modal-batch-detail');
    } catch (e) {
        console.error(e);
        showToast("Error loading route details", "error");
    }
}

async function handleMarkDeliveredInBatch(orderId, batchId) {
    // We reuse the existing submit proof flow
    openSubmitProof(orderId);
    
    // We need to listen for when the proof is submitted to refresh the batch view
    const originalSubmitProof = window.handleSubmitProof;
    window.handleSubmitProof = async (e) => {
        const success = await originalSubmitProof(e);
        if (success !== false) { // Assuming success if not explicitly false
             openBatchDetail(batchId);
             loadBatches();
        }
    };
}


function setBtnLoading(id, isLoading, text) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${text || 'Loading...'}`;
    } else {
        btn.disabled = false;
        btn.innerHTML = text || 'Submit';
    }
}

// Ensure BatchesAPI exists
if (!window.BatchesAPI) {
    window.BatchesAPI = {
        getDriverBatches: () => Api.get('/batches/driver'),
        getBatchDetails: (id) => Api.get(`/batches/${id}`),
        create: (driverId, orderIds) => Api.post('/batches', { 
            driver_id: driverId, 
            order_ids: orderIds.map(id => parseInt(id)) 
        })
    };
}
