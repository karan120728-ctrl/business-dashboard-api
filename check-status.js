require('dotenv').config();
const { pool } = require('./src/db/connection');

async function testStatus() {
    const [users] = await pool.query("SELECT * FROM users");
    console.log(users.map(u => ({ id: u.id, name: u.name, role: u.role, status: u.status })));
    process.exit(0);
}
testStatus();
