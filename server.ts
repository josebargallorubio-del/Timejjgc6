import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = new Database('database.sqlite');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'worker',
    pin TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL, -- 1 (Monday) to 5 (Friday)
    start_time TEXT,
    end_time TEXT,
    start_time_2 TEXT,
    end_time_2 TEXT,
    UNIQUE(user_id, day_of_week),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    clock_in TEXT, -- HH:MM
    clock_out TEXT, -- HH:MM
    type TEXT NOT NULL, -- 'manual' or 'auto'
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Add new columns if they don't exist (for migration)
try {
  db.exec('ALTER TABLE schedules ADD COLUMN start_time_2 TEXT');
  db.exec('ALTER TABLE schedules ADD COLUMN end_time_2 TEXT');
} catch (e) {
  // Columns already exist
}

// Insert default admin if not exists
const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
if (!adminExists) {
  db.prepare('INSERT INTO users (name, role, pin) VALUES (?, ?, ?)').run('Admin', 'admin', '1234');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Login
  app.post('/api/login', (req, res) => {
    const { name, pin } = req.body;
    const user = db.prepare('SELECT id, name, role FROM users WHERE name = ? AND pin = ?').get(name, pin);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  // Get all users (admin only)
  app.get('/api/users', (req, res) => {
    const users = db.prepare('SELECT id, name, role, pin FROM users').all();
    res.json(users);
  });

  // Create user
  app.post('/api/users', (req, res) => {
    const { name, pin, role } = req.body;
    try {
      const result = db.prepare('INSERT INTO users (name, pin, role) VALUES (?, ?, ?)').run(name, pin, role || 'worker');
      res.json({ id: result.lastInsertRowid, name, role: role || 'worker' });
    } catch (error) {
      res.status(400).json({ error: 'User already exists or invalid data' });
    }
  });

  // Delete user
  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.prepare('DELETE FROM schedules WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM time_entries WHERE user_id = ?').run(id);
    res.json({ success: true });
  });

  // Get schedule for user
  app.get('/api/schedules/:userId', (req, res) => {
    const { userId } = req.params;
    const schedules = db.prepare('SELECT * FROM schedules WHERE user_id = ?').all(userId);
    res.json(schedules);
  });

  // Update schedule for user
  app.post('/api/schedules/:userId', (req, res) => {
    const { userId } = req.params;
    const { schedules } = req.body; // Array of { day_of_week, start_time, end_time, start_time_2, end_time_2 }
    
    const updateStmt = db.prepare(`
      INSERT INTO schedules (user_id, day_of_week, start_time, end_time, start_time_2, end_time_2)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, day_of_week) DO UPDATE SET
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      start_time_2 = excluded.start_time_2,
      end_time_2 = excluded.end_time_2
    `);

    const transaction = db.transaction((scheds) => {
      for (const s of scheds) {
        updateStmt.run(userId, s.day_of_week, s.start_time, s.end_time, s.start_time_2, s.end_time_2);
      }
    });

    transaction(schedules);
    res.json({ success: true });
  });

  // Get time entries
  app.get('/api/time-entries', (req, res) => {
    const { userId, date } = req.query;
    let query = 'SELECT time_entries.*, users.name as user_name FROM time_entries JOIN users ON time_entries.user_id = users.id';
    const params = [];
    
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
      if (date) {
        query += ' AND date = ?';
        params.push(date);
      }
    } else if (date) {
      query += ' WHERE date = ?';
      params.push(date);
    }
    
    query += ' ORDER BY date DESC, clock_in DESC';
    const entries = db.prepare(query).all(...params);
    res.json(entries);
  });

  // Clock in/out
  app.post('/api/clock', (req, res) => {
    const { userId, type, action, time, date } = req.body;
    // action: 'in' or 'out'
    // type: 'manual' or 'auto'
    
    if (action === 'in') {
      const result = db.prepare('INSERT INTO time_entries (user_id, date, clock_in, type) VALUES (?, ?, ?, ?)').run(userId, date, time, type);
      res.json({ id: result.lastInsertRowid });
    } else if (action === 'out') {
      // Find the latest open entry for today
      const entry = db.prepare('SELECT id FROM time_entries WHERE user_id = ? AND date = ? AND clock_out IS NULL ORDER BY id DESC LIMIT 1').get(userId, date);
      if (entry) {
        db.prepare('UPDATE time_entries SET clock_out = ? WHERE id = ?').run(time, entry.id);
        res.json({ success: true });
      } else {
        // If no open entry, create a new one with just clock_out (unusual but possible)
        const result = db.prepare('INSERT INTO time_entries (user_id, date, clock_out, type) VALUES (?, ?, ?, ?)').run(userId, date, time, type);
        res.json({ id: result.lastInsertRowid });
      }
    }
  });

  // Auto clock in/out for a whole day based on schedule
  app.post('/api/clock/auto-day', (req, res) => {
    const { userId, date, dayOfWeek } = req.body;
    
    const schedule = db.prepare('SELECT * FROM schedules WHERE user_id = ? AND day_of_week = ?').get(userId, dayOfWeek);
    if (!schedule || !schedule.start_time || !schedule.end_time) {
      return res.status(400).json({ error: 'No schedule defined for this day' });
    }

    // Check if there are already entries for this day
    const existing = db.prepare('SELECT id FROM time_entries WHERE user_id = ? AND date = ?').get(userId, date);
    if (existing) {
      return res.status(400).json({ error: 'Time entries already exist for this date' });
    }

    const transaction = db.transaction(() => {
      // First shift
      db.prepare('INSERT INTO time_entries (user_id, date, clock_in, clock_out, type) VALUES (?, ?, ?, ?, ?)').run(userId, date, schedule.start_time, schedule.end_time, 'auto');
      
      // Second shift if exists
      if (schedule.start_time_2 && schedule.end_time_2) {
        db.prepare('INSERT INTO time_entries (user_id, date, clock_in, clock_out, type) VALUES (?, ?, ?, ?, ?)').run(userId, date, schedule.start_time_2, schedule.end_time_2, 'auto');
      }
    });

    transaction();
    res.json({ success: true });
  });

  // Create time entry (admin)
  app.post('/api/time-entries', (req, res) => {
    const { user_id, date, clock_in, clock_out, type } = req.body;
    const result = db.prepare('INSERT INTO time_entries (user_id, date, clock_in, clock_out, type) VALUES (?, ?, ?, ?, ?)').run(user_id, date, clock_in, clock_out, type || 'manual');
    res.json({ id: result.lastInsertRowid });
  });

  // Update time entry (admin)
  app.put('/api/time-entries/:id', (req, res) => {
    const { id } = req.params;
    const { date, clock_in, clock_out } = req.body;
    db.prepare('UPDATE time_entries SET date = ?, clock_in = ?, clock_out = ? WHERE id = ?').run(date, clock_in, clock_out, id);
    res.json({ success: true });
  });

  // Delete time entry (admin)
  app.delete('/api/time-entries/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
