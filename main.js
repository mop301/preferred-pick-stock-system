const express = require('express'); // Creates Web Server
const db = require('./db'); // <-- import our db module
const path = require('path');
const app = express(); // My server

app.use(express.json()); // Lets server read JSON requests
app.use(express.static(path.join(__dirname))); // Serves frontend static files from current directory

// ----------------------
// Helper functions
// ----------------------

// Checks if a location exists in the database
function locationExists(location) {
  const stmt = db.prepare('SELECT location FROM locations WHERE location = ?');
  return stmt.get(location) !== undefined;
}

// Gets stock quantity for a SKU at a location
function getStock(sku, location) {
  const stmt = db.prepare('SELECT * FROM inventory WHERE sku = ? AND location = ?');
  return stmt.get(sku, location);
}

// Adds stock to a location, or updates quantity if already exists
function addStock(sku, location, qty) {
  const stmt = db.prepare(`
    INSERT INTO inventory (sku, location, quantity) VALUES (?, ?, ?)
    ON CONFLICT(sku, location) DO UPDATE SET quantity = quantity + ?
  `);
  stmt.run(sku, location, qty, qty);
}

// Removes stock from a location, throws error if not enough stock
function removeStock(sku, location, qty) {
  const stock = getStock(sku, location);

  if (!stock || stock.quantity < qty) {
    throw new Error('Not enough stock');
  }

  const stmt = db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE sku = ? AND location = ?');
  stmt.run(qty, sku, location);
}

// ----------------------
// Stock Move Endpoint
// ----------------------

app.post('/move-stock', (req, res) => {
  const { sku, fromLocation, toLocation, quantity } = req.body;

  try {
    // Validate locations exist
    if (!locationExists(fromLocation)) {
      return res.status(400).json({
        success: false,
        error: `Location '${fromLocation}' does not exist`
      });
    }

    if (!locationExists(toLocation)) {
      return res.status(400).json({
        success: false,
        error: `Location '${toLocation}' does not exist`
      });
    }

    // 1. Move stock
    removeStock(sku, fromLocation, quantity);
    addStock(sku, toLocation, quantity);

    // 2. Check preferred location
    const stmt = db.prepare('SELECT location FROM preferred_locations WHERE sku = ?');

    res.json({
      success: true,
      moved: {
        sku,
        fromLocation,
        toLocation,
        quantity
      },
    });

  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// ----------------------
// View inventory
// ----------------------

app.get('/inventory', (req, res) => {
  const stmt = db.prepare('SELECT * FROM inventory');
  const inventory = stmt.all();
  res.json(inventory);
});

app.get('/api/sku/:sku', (req, res) => {
  const { sku } = req.params;
  const skuUpper = sku.toUpperCase();
  
  // Check if SKU exists in skus table
  const skuCheck = db.prepare('SELECT sku FROM skus WHERE sku = ?').get(skuUpper);
  if (!skuCheck) {
    return res.status(404).json({
      success: false,
      error: `SKU '${skuUpper}' not found`
    });
  }
  
  // Get inventory for this SKU
  const stmt = db.prepare('SELECT * FROM inventory WHERE sku = ?');
  const skuData = stmt.all(skuUpper);
  
  res.json({
    success: true,
    sku: skuUpper,
    locations: skuData
  });
});

// ----------------------
// Preferred Locations API
// ----------------------

app.get('/api/preferred-locations', (req, res) => {
  const stmt = db.prepare('SELECT sku, location FROM preferred_locations');
  const rows = stmt.all();
  
  // Convert to object format {sku: location}
  const locations = {};
  rows.forEach(row => {
    locations[row.sku] = row.location;
  });
  
  res.json(locations);
});

// ----------------------
// SKUs API
// ----------------------

app.get('/api/skus', (req, res) => {
  const stmt = db.prepare('SELECT sku FROM skus ORDER BY sku');
  const rows = stmt.all();
  const skus = rows.map(row => row.sku);
  res.json(skus);
});

app.post('/api/skus', (req, res) => {
  const { sku } = req.body;

  if (!sku) {
    return res.status(400).json({
      success: false,
      error: 'SKU is required'
    });
  }

  const skuUpper = sku.toUpperCase();

  try {
    const stmt = db.prepare('INSERT INTO skus (sku) VALUES (?)');
    stmt.run(skuUpper);

    res.json({
      success: true,
      message: `SKU '${skuUpper}' added`,
      sku: skuUpper
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        success: false,
        error: `SKU '${skuUpper}' already exists`
      });
    }
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ----------------------
// Locations API
// ----------------------

app.get('/api/locations', (req, res) => {
  const stmt = db.prepare('SELECT location FROM locations ORDER BY location');
  const rows = stmt.all();
  const locations = rows.map(row => row.location);
  res.json(locations);
});

app.post('/api/locations', (req, res) => {
  const { location } = req.body;

  if (!location) {
    return res.status(400).json({
      success: false,
      error: 'Location is required'
    });
  }

  const locationUpper = location.toUpperCase();

  try {
    const stmt = db.prepare('INSERT INTO locations (location) VALUES (?)');
    stmt.run(locationUpper);

    res.json({
      success: true,
      message: `Location '${locationUpper}' added`,
      location: locationUpper
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        success: false,
        error: `Location '${locationUpper}' already exists`
      });
    }
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ----------------------
// Replenishment Report Endpoint
// ----------------------

app.get('/api/replen-report', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        p.sku,
        p.location AS preferredPick,
        GROUP_CONCAT(i.location || ' (' || i.quantity || ')') AS otherLocations
      FROM preferred_locations p
      JOIN replen_thresholds t ON t.sku = p.sku
      JOIN inventory i ON i.sku = p.sku AND i.location != p.location
      WHERE
        COALESCE(
          (SELECT quantity 
           FROM inventory 
           WHERE sku = p.sku AND location = p.location), 
          0
        ) < t.threshold
        AND i.quantity > 0
      GROUP BY p.sku, p.location
    `);

    const rows = stmt.all();
    res.json(rows);

  } catch (err) {
    console.error('Error generating replen report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ----------------------
// Set Thresholds Endpoint
// ----------------------

app.post('/api/set-thresholds', (req, res) => {
  const { skus, threshold } = req.body;
  if (!Array.isArray(skus) || skus.length === 0 || !threshold) {
    return res.status(400).json({ error: "SKUs and threshold required" });
  }

  const insertStmt = db.prepare(`
    INSERT INTO replen_thresholds (sku, threshold)
    VALUES (?, ?)
    ON CONFLICT(sku) DO UPDATE SET threshold = ?
  `);

  const insertMany = db.transaction((skus) => {
    for (const sku of skus) {
      insertStmt.run(sku.toUpperCase(), threshold, threshold);
    }
  });

  try {
    insertMany(skus);
    res.json({ success: true, message: `Threshold set for ${skus.length} SKUs` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/preferred-locations', (req, res) => {
  const { sku, location } = req.body;

  if (!sku || !location) {
    return res.status(400).json({
      success: false,
      error: 'SKU and location are required'
    });
  }

  const skuUpper = sku.toUpperCase();
  const locationUpper = location.toUpperCase();

  // Validate SKU exists
  const skuCheck = db.prepare('SELECT sku FROM skus WHERE sku = ?').get(skuUpper);
  if (!skuCheck) {
    return res.status(400).json({
      success: false,
      error: `SKU '${skuUpper}' does not exist`
    });
  }

  // Validate location exists
  if (!locationExists(locationUpper)) {
    return res.status(400).json({
      success: false,
      error: `Location '${locationUpper}' does not exist`
    });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO preferred_locations (sku, location) VALUES (?, ?)
      ON CONFLICT(sku) DO UPDATE SET location = ?
    `);
    stmt.run(skuUpper, locationUpper, locationUpper);

    res.json({
      success: true,
      message: `Preferred location set for ${skuUpper}`,
      sku: skuUpper,
      location: locationUpper
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/preferred-locations/:sku', (req, res) => {
  const { sku } = req.params;
  const { location } = req.body;

  if (!location) {
    return res.status(400).json({
      success: false,
      error: 'Location is required'
    });
  }

  try {
    const checkStmt = db.prepare('SELECT sku FROM preferred_locations WHERE sku = ?');
    const existing = checkStmt.get(sku.toUpperCase());

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `No preferred location found for SKU: ${sku}`
      });
    }

    const updateStmt = db.prepare('UPDATE preferred_locations SET location = ? WHERE sku = ?');
    updateStmt.run(location.toUpperCase(), sku.toUpperCase());

    res.json({
      success: true,
      message: `Location updated for ${sku}`,
      sku: sku.toUpperCase(),
      location: location.toUpperCase()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/preferred-locations/:sku', (req, res) => {
  const { sku } = req.params;

  try {
    const checkStmt = db.prepare('SELECT sku FROM preferred_locations WHERE sku = ?');
    const existing = checkStmt.get(sku.toUpperCase());

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `No preferred location found for SKU: ${sku}`
      });
    }

    const deleteStmt = db.prepare('DELETE FROM preferred_locations WHERE sku = ?');
    deleteStmt.run(sku.toUpperCase());

    res.json({
      success: true,
      message: `Preferred location deleted for ${sku}`,
      sku: sku.toUpperCase()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ----------------------
// Start Server
// ----------------------

const server = app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

// Close database on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  db.close();
  server.close();
  process.exit(0);
});