const InvoicesAPI = {
    getStats: async () => {
        const res = await API.get('/invoices/stats');
        return res;
    },
    getAll: async () => {
        const res = await API.get('/invoices');
        return res;
    }
};

window.InvoicesAPI = InvoicesAPI;
