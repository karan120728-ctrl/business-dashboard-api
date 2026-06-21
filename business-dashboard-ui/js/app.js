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
    if (viewName === 'products') loadProducts();
    if (viewName === 'orders') loadOrders();
    if (viewName === 'payments') loadPayments();
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
    bindForm('form-order', handleCreateOrder);
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

            return `<tr>
                <td>#${o.id}</td>
                <td>${o.customer_name}</td>
                <td>${formatCurrency(o.total_amount)}</td>
                <td>${formatDate(o.created_at)}</td>
                <td><span class="badge badge-${o.status === 'delivered' ? 'success' : (o.status === 'out_for_delivery' ? 'primary' : 'warning')}">${o.status.toUpperCase()}</span></td>
                <td><span class="badge badge-${pBadgeClass}">${(o.payment_status || 'unpaid').toUpperCase()}</span></td>
                <td>
                    <select class="input" onchange="updateOrderStatus(${o.id}, this.value, ${o.driver_id || 'null'}, '${o.status}')" ${!isStaff || o.status === 'delivered' ? 'disabled' : ''}>
                        <option value="pending" ${o.status === 'pending' ? 'selected' : ''} ${o.status !== 'pending' ? 'disabled' : ''}>Pending</option>
                        <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''} ${o.status === 'out_for_delivery' ? 'disabled' : ''}>Confirmed</option>
                        <option value="out_for_delivery" ${o.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
                        <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    </select>
                </td>
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
                <td><a href="#" onclick="switchView('orders'); return false;">#${i.order_id}</a></td>
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
    // Mark all as read locally so renderNotifications() doesn't bring the badge back
    notifications.forEach(n => n.is_read = 1);
    // Also persist to server silently
    try { window.Api.patch('/notifications/read-all'); } catch(e) {}
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
function showConfirmModal(m, fn) { if(confirm(m)) fn(); }
