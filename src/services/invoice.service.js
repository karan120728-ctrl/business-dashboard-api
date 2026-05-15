const { pool } = require("../db/connection");
const crypto = require("crypto");
const AppError = require("../utils/AppError");

class InvoiceService {
    // Generated when order is delivered
    async createInvoice(business_id, order_id, customer_id, amount) {
        // Double Invoice Protection
        const [existing] = await pool.query(
            `SELECT id FROM invoices WHERE order_id = ?`,
            [order_id]
        );
        if (existing.length > 0) return existing[0].id;

        // Due date = delivered_at + 3 days
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);

        // Secure token for payment link, valid until due_date (or +7 days grace)
        const paymentToken = crypto.randomBytes(32).toString("hex");
        const tokenExpiresAt = new Date(dueDate);
        tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // 7 days grace period after due date

        const [result] = await pool.query(
            `INSERT INTO invoices (business_id, order_id, customer_id, amount, status, due_date, payment_token, token_expires_at)
             VALUES (?, ?, ?, ?, 'unpaid', ?, ?, ?)`,
            [business_id, order_id, customer_id, amount, dueDate, paymentToken, tokenExpiresAt]
        );

        return result.insertId;
    }

    async getInvoices(business_id) {
        const [rows] = await pool.query(
            `SELECT i.*, o.total_amount, c.name as customer_name, c.email as customer_email 
             FROM invoices i
             JOIN orders o ON i.order_id = o.id
             JOIN customers c ON i.customer_id = c.id
             WHERE i.business_id = ?
             ORDER BY i.created_at DESC`,
            [business_id]
        );

        // Cron job fallback
        const now = new Date();
        for (let row of rows) {
            if (new Date(row.due_date) < now && row.status === 'unpaid') {
                row.status = 'overdue';
            }
        }

        return rows;
    }

    async getDashboardStats(business_id) {
        const [rows] = await pool.query(
            `SELECT 
                COUNT(*) as total_invoices,
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
                SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as total_unpaid,
                SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as total_overdue,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
                COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_count,
                COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
             FROM invoices
             WHERE business_id = ?`,
            [business_id]
        );
        return rows[0];
    }

    async getInvoiceByToken(token) {
        const [rows] = await pool.query(
            `SELECT i.*, o.total_amount, c.name as customer_name, c.email as customer_email, b.name as business_name
             FROM invoices i
             JOIN orders o ON i.order_id = o.id
             JOIN customers c ON i.customer_id = c.id
             JOIN businesses b ON i.business_id = b.id
             WHERE i.payment_token = ?`,
            [token]
        );

        if (rows.length === 0) {
            throw new AppError("Invalid payment token", 404);
        }

        const invoice = rows[0];
        
        if (invoice.used_at) {
            throw new AppError("Payment link has already been used", 400);
        }

        if (new Date() > new Date(invoice.token_expires_at)) {
            throw new AppError("Payment link has expired", 400);
        }

        // Cron job fallback
        if (new Date(invoice.due_date) < new Date() && invoice.status === 'unpaid') {
            invoice.status = 'overdue';
        }

        return invoice;
    }

    async markInvoiceAsPaid(invoiceId, paymentId = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [invoices] = await connection.query("SELECT status, order_id FROM invoices WHERE id = ?", [invoiceId]);
            if (invoices.length === 0) throw new AppError("Invoice not found", 404);
            const invoice = invoices[0];
            
            if (invoice.status === 'paid') {
                await connection.rollback();
                return { message: "Invoice is already paid", invoice_id: invoiceId };
            }

            // Update invoice status atomically (now includes paid_at and razorpay_payment_id)
            await connection.query(
                `UPDATE invoices SET status = 'paid', used_at = NOW(), updated_at = NOW(), paid_at = NOW(), razorpay_payment_id = ? WHERE id = ?`,
                [paymentId, invoiceId]
            );

            // Sync order payment status atomically
            await connection.query(
                `UPDATE orders SET payment_status = 'paid' WHERE id = ?`,
                [invoice.order_id]
            );

            await connection.commit();
            return { message: "Payment successful", invoice_id: invoiceId };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async simulatePayment(token) {
        const invoice = await this.getInvoiceByToken(token);
        return await this.markInvoiceAsPaid(invoice.id);
    }

    async markOverdue() {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Find invoices that are unpaid and past their due date
            const [invoices] = await connection.query(
                `SELECT id, order_id, business_id FROM invoices 
                 WHERE status = 'unpaid' AND due_date < NOW()`
            );

            if (invoices.length > 0) {
                const invoiceIds = invoices.map(i => i.id);
                const orderIds = invoices.map(i => i.order_id);

                // Update invoices
                await connection.query(
                    `UPDATE invoices SET status = 'overdue' WHERE id IN (?)`,
                    [invoiceIds]
                );

                // Update orders
                await connection.query(
                    `UPDATE orders SET payment_status = 'overdue' WHERE id IN (?)`,
                    [orderIds]
                );
            }

            await connection.commit();
            return invoices.length;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new InvoiceService();
