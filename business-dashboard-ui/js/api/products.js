const ProductsAPI = {
    getAll: (search = '') => Api.get(`/products?search=${encodeURIComponent(search)}`),
    create: (data) => Api.post('/products', data),
    delete: (id) => Api.delete(`/products/${id}`)
};
window.ProductsAPI = ProductsAPI;
