const OrdersAPI = {
    getAll: () => API.get('/orders'),
    create: (data) => API.post('/orders', data),
    updateStatus: (id, status) => API.patch(`/orders/${id}/status`, { status }),
    assignDriver: (id, data) => API.post(`/orders/${id}/assign-driver`, data),
    updateLocation: (id, data) => API.post(`/orders/${id}/update-location`, data),
    getLocation: (id) => API.get(`/orders/${id}/location`),
    submitProofFile: async (id, file) => {
        const token = localStorage.getItem('flowops_token');
        const formData = new FormData();
        formData.append('proof_image', file);
        const response = await fetch(`${window.API_URL}/orders/${id}/submit-proof`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Upload failed');
        return data;
    },
    submitProof: (id, data) => API.post(`/orders/${id}/submit-proof`, data),
    createPaymentSession: (id) => API.post(`/payments/create-session/${id}`)
};
window.OrdersAPI = OrdersAPI;
