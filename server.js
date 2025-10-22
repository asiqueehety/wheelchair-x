const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize SQLite Database
const db = new sqlite3.Database('./wheelchair.db', (err) => {
  if (err) {
    console.error('❌ Database error:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});

// Create tables
function initializeDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS wheelchair_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    touchActive INTEGER,
    currentDirection TEXT,
    isMoving INTEGER,
    tiltMode INTEGER,
    totalDistanceMeters REAL,
    totalDistanceKm REAL,
    sessionDistanceMeters REAL,
    totalTimeSeconds INTEGER,
    timeHours INTEGER,
    timeMinutes INTEGER,
    timeSeconds INTEGER,
    wifiStrength INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS gesture_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    totalGestures INTEGER,
    upCount INTEGER,
    downCount INTEGER,
    leftCount INTEGER,
    rightCount INTEGER,
    lastGesture TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS gesture_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gesture TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('✅ Database tables initialized');
}

// API Endpoints

// Receive data from ESP32
app.post('/api/wheelchair/update', (req, res) => {
  const data = req.body;
  
  // Insert status data
  db.run(`INSERT INTO wheelchair_status (
    touchActive, currentDirection, isMoving, tiltMode,
    totalDistanceMeters, totalDistanceKm, sessionDistanceMeters,
    totalTimeSeconds, timeHours, timeMinutes, timeSeconds, wifiStrength
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    data.touchActive ? 1 : 0,
    data.currentDirection,
    data.isMoving ? 1 : 0,
    data.tiltMode ? 1 : 0,
    data.totalDistanceMeters,
    data.totalDistanceKm,
    data.sessionDistanceMeters,
    data.totalTimeSeconds,
    data.timeHours,
    data.timeMinutes,
    data.timeSeconds,
    data.wifiStrength
  ], (err) => {
    if (err) {
      console.error('❌ Insert error:', err);
      res.status(500).json({ error: 'Database error' });
    } else {
      console.log('📥 Data received from ESP32');
      res.json({ success: true });
    }
  });
});

// Update gesture statistics
app.post('/api/wheelchair/gesture', (req, res) => {
  const data = req.body;
  
  db.run(`INSERT INTO gesture_statistics (
    totalGestures, upCount, downCount, leftCount, rightCount, lastGesture
  ) VALUES (?, ?, ?, ?, ?, ?)`,
  [
    data.totalGestures,
    data.upCount,
    data.downCount,
    data.leftCount,
    data.rightCount,
    data.lastGesture
  ]);

  // Log individual gesture
  if (data.lastGesture) {
    db.run(`INSERT INTO gesture_log (gesture) VALUES (?)`, [data.lastGesture]);
  }

  res.json({ success: true });
});

// Get latest status for dashboard
app.get('/api/wheelchair/status', (req, res) => {
  db.get(`SELECT * FROM wheelchair_status ORDER BY id DESC LIMIT 1`, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(row || {});
    }
  });
});

// Get latest statistics
app.get('/api/wheelchair/statistics', (req, res) => {
  db.get(`SELECT * FROM gesture_statistics ORDER BY id DESC LIMIT 1`, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(row || {});
    }
  });
});

// Get recent gesture log
app.get('/api/wheelchair/log', (req, res) => {
  db.all(`SELECT * FROM gesture_log ORDER BY id DESC LIMIT 50`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Wheelchair Dashboard Server Running!`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 API Endpoint: http://localhost:${PORT}/api/wheelchair/update`);
  console.log(`\n✅ Waiting for ESP32 data...\n`);
});