const InvoicesAPI = {
    getStats: async () => {
        const res = await API.get('/invoices/stats');
        return res.data;
    },
    getAll: async () => {
        const res = await API.get('/invoices');
        return res.data;
    }
};

window.InvoicesAPI = InvoicesAPI;
