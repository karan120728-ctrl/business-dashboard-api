const CustomersAPI = {
    getAll: (search = '') => Api.get(`/customer?search=${encodeURIComponent(search)}`),
    create: (data) => Api.post('/customer', data),
    delete: (id) => Api.delete(`/customer/${id}`)
};
window.CustomersAPI = CustomersAPI;
