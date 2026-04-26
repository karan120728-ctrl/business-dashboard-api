const ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    DRIVER: 'driver',
    CUSTOMER: 'customer'
};

const ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
};

module.exports = {
    ROLES,
    ORDER_STATUS
};
