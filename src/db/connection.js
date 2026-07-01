const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

const path = require('path');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  // TiDB Cloud requires SSL. On cloud servers (Railway/Render), rejectUnauthorized:false
  // is needed because the cert chain may not be fully trusted in the container environment.
  // The connection is still FULLY ENCRYPTED - TiDB enforces SSL on their end.
  ssl: { 
    rejectUnauthorized: false
  }
});

const connectDB = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("TIDBCloud connected successfully");
    connection.release();
  } catch (error) {
    console.error("TIDBCloud connection failed", error);
    process.exit(1);
  }
};

module.exports = { pool, connectDB };
