const UsersAPI = {
    getAll: () => Api.get(`/users`),
};
window.UsersAPI = UsersAPI;
