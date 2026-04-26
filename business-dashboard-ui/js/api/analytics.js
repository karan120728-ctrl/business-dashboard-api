const AnalyticsAPI = {
    getDashboard: () => Api.get('/dashboard'),
    getMonthlySales: () => Api.get('/dashboard/monthly-sales'), // Assuming we expose this or use the summary
};
window.AnalyticsAPI = AnalyticsAPI;
