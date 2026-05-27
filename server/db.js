// ============================================================
// DATABASE — PostgreSQL connection + schema
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        mobile VARCHAR(15) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        mvp_count INTEGER DEFAULT 0,
        series_won INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Database initialized');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
}

// ── User functions ──
async function createUser({ name, username, mobile, passwordHash }) {
  const result = await pool.query(
    `INSERT INTO users (name, username, mobile, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, username, mobile, games_played, games_won, mvp_count, series_won`,
    [name, username, mobile, passwordHash]
  );
  return result.rows[0];
}

async function findUserByLogin(login) {
  // login = username OR mobile
  const result = await pool.query(
    `SELECT * FROM users WHERE username = $1 OR mobile = $1 LIMIT 1`,
    [login]
  );
  return result.rows[0];
}

async function findUserById(id) {
  const result = await pool.query(
    `SELECT id, name, username, mobile, games_played, games_won, mvp_count, series_won, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

async function updateUser(id, { name, username, mobile, passwordHash }) {
  const fields = [];
  const values = [];
  let idx = 1;
  if (name)         { fields.push(`name = $${idx++}`);          values.push(name); }
  if (username)     { fields.push(`username = $${idx++}`);      values.push(username); }
  if (mobile)       { fields.push(`mobile = $${idx++}`);        values.push(mobile); }
  if (passwordHash) { fields.push(`password_hash = $${idx++}`); values.push(passwordHash); }
  if (fields.length === 0) return findUserById(id);
  values.push(id);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
     RETURNING id, name, username, mobile, games_played, games_won, mvp_count, series_won`,
    values
  );
  return result.rows[0];
}

async function incrementStat(userId, stat, amount = 1) {
  const validStats = ['games_played', 'games_won', 'mvp_count', 'series_won'];
  if (!validStats.includes(stat)) return;
  await pool.query(`UPDATE users SET ${stat} = ${stat} + $1 WHERE id = $2`, [amount, userId]);
}

async function getLeaderboard(limit = 50) {
  const result = await pool.query(
    `SELECT id, name, username, games_played, games_won, mvp_count, series_won
     FROM users
     ORDER BY series_won DESC, games_won DESC, mvp_count DESC, games_played DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

module.exports = {
  pool, initDatabase,
  createUser, findUserByLogin, findUserById, updateUser,
  incrementStat, getLeaderboard,
};
