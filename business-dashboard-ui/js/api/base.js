class ApiClient {
    static async request(endpoint, options = {}) {
        const token = localStorage.getItem('flowops_token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${window.API_URL}${endpoint}`, {
                ...options,
                headers
            });

            if (response.status === 401) {
                // Auto logout on token expiry
                localStorage.removeItem('flowops_token');
                localStorage.removeItem('flowops_user');
                window.location.href = 'login.html';
                return null;
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            return data;
        } catch (error) {
            showToast(error.message, 'error');
            throw error;
        }
    }

    static get(endpoint) { return this.request(endpoint); }
    static post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }
    static put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); }
    static patch(endpoint, body) { return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }); }
    static delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
}

window.Api = ApiClient;
window.API = ApiClient;
