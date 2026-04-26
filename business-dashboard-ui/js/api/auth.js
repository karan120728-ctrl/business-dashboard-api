const AuthAPI = {
    login: async (email, password) => {
        const response = await fetch(`${window.API_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Login failed');
        return data;
    },
    register: async (userData) => {
        const response = await fetch(`${window.API_URL}/users/createUser`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Registration failed');
        return data;
    },
    logout: () => {
        localStorage.clear();
        window.location.href = 'login.html';
    }
};

window.AuthAPI = AuthAPI;
