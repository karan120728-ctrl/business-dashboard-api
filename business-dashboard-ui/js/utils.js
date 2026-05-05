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

const INR_RATE = 83.5; // 1 USD = 83.5 INR (update as needed)

function formatCurrency(amount) {
    const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format((amount || 0) * INR_RATE);
    return `${usd} <span style="color:var(--text-muted); font-size:0.85em;">/ ${inr}</span>`;
}

function formatCurrencyPlain(amount) {
    // Plain text version without HTML span (for titles/attributes)
    const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format((amount || 0) * INR_RATE);
    return `${usd} / ${inr}`;
}

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
