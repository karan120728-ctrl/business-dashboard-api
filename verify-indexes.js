require('dotenv').config();
const { pool } = require('./src/db/connection');
const initDB = require('./src/db/init');

async function verify() {
  console.log("Initializing DB and adding indexes...");
  await initDB();
  
  console.log("\n--- EXPLAIN QUERY ANALYZE ---");
  const [explain] = await pool.query("EXPLAIN SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = 1 AND o.payment_status = 'paid' AND DATE(o.delivered_at) = CURDATE()");
  
  console.log(JSON.stringify(explain, null, 2));
  
  // Verify it uses the index
  if (explain[0].key && explain[0].key.includes('idx_')) {
      console.log("\n✅ SUCCESS: Database query planner is using the new index: " + explain[0].key);
  } else {
      console.log("\n⚠️ WARNING: Database might still be using full table scans.");
  }
  process.exit(0);
}
verify();
