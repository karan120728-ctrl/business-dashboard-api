// Utils
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i> ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ===== CURRENCY SYSTEM ===== */
let LIVE_INR_RATE = 83.5; // fallback
let activeCurrency = localStorage.getItem('flowops_currency') || 'USD';

// Fetch live rate on app start
async function fetchLiveRate() {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data && data.rates && data.rates.INR) {
            LIVE_INR_RATE = data.rates.INR;
            const badge = document.getElementById('live-rate-badge');
            if (badge) badge.innerText = `1 USD = ₹${LIVE_INR_RATE.toFixed(2)}`;
        }
    } catch(e) {
        console.warn('Live rate fetch failed, using fallback:', LIVE_INR_RATE);
    }
}

function formatCurrency(amountUSD) {
    const amt = parseFloat(amountUSD) || 0;
    if (activeCurrency === 'INR') {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt * LIVE_INR_RATE);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);
}

function formatCurrencyPlain(amountUSD) {
    const amt = parseFloat(amountUSD) || 0;
    if (activeCurrency === 'INR') {
        return `₹${Math.round(amt * LIVE_INR_RATE).toLocaleString('en-IN')}`;
    }
    return `$${amt.toFixed(2)}`;
}

// Convert any input price to USD for storage
function toUSD(amount, fromCurrency) {
    const amt = parseFloat(amount) || 0;
    if (fromCurrency === 'INR') return amt / LIVE_INR_RATE;
    return amt;
}

// Called when user clicks USD or INR toggle
window.setCurrency = function(currency) {
    activeCurrency = currency;
    localStorage.setItem('flowops_currency', currency);

    // Update toggle button styles
    const usdBtn = document.getElementById('btn-currency-usd');
    const inrBtn = document.getElementById('btn-currency-inr');
    if (usdBtn && inrBtn) {
        if (currency === 'USD') {
            usdBtn.style.background = 'var(--primary)';
            usdBtn.style.color = '#fff';
            inrBtn.style.background = 'transparent';
            inrBtn.style.color = 'var(--text-muted)';
        } else {
            inrBtn.style.background = 'var(--primary)';
            inrBtn.style.color = '#fff';
            usdBtn.style.background = 'transparent';
            usdBtn.style.color = 'var(--text-muted)';
        }
    }

    // Re-render the current view
    if (typeof loadDashboard === 'function' && document.getElementById('view-dashboard') && !document.getElementById('view-dashboard').classList.contains('hidden')) {
        loadDashboard();
    }
    if (typeof loadOrders === 'function' && document.getElementById('view-orders') && !document.getElementById('view-orders').classList.contains('hidden')) {
        loadOrders();
    }
    if (typeof loadProducts === 'function' && document.getElementById('view-products') && !document.getElementById('view-products').classList.contains('hidden')) {
        loadProducts();
    }
};



function formatDate(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
}

function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-msg').innerText = message;
    modal.classList.remove('hidden');

    const confirmBtn = document.getElementById('btn-confirm');
    const cancelBtn = document.getElementById('btn-cancel-confirm');

    // Remove old listeners
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    newConfirm.addEventListener('click', () => {
        modal.classList.add('hidden');
        onConfirm();
    });
}
