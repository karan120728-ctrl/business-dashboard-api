const UsersAPI = {
    getAll: () => Api.get(`/users/getUser`),
};
window.UsersAPI = UsersAPI;
