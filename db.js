//Makes database and tables, adds test data if empty

const Database = require('better-sqlite3'); // Database Library
const path = require('path');

// Creates or opens database file
const db = new Database(path.join(__dirname, './preferred_pick.db'));

// Create tables if they don't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS skus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location TEXT UNIQUE NOT NULL
    );

     CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT NOT NULL,
        location TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity >= 0),
        UNIQUE(sku, location),
        FOREIGN KEY(location) REFERENCES locations(location),
        FOREIGN KEY(sku) REFERENCES skus(sku) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS preferred_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        location TEXT NOT NULL,
        FOREIGN KEY(location) REFERENCES locations(location),
        FOREIGN KEY(sku) REFERENCES skus(sku) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS replen_thresholds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        threshold INTEGER NOT NULL,
        FOREIGN KEY(sku) REFERENCES skus(sku) ON DELETE CASCADE
    );
`);

// Add test locations if empty
const locationsCount = db.prepare('SELECT COUNT(*) as count FROM locations').get();
if (locationsCount.count === 0) {
    const insertLocation = db.prepare('INSERT INTO locations (location) VALUES (?)');
    const insertLocationsTransaction = db.transaction((locations) => {
        for (const loc of locations) {
            insertLocation.run(loc);
        }
    });
    // Suffixes to append for each number
    const suffixes = ['A', 'B', 'C'];

    // Define your location ranges
    const locationRanges = {
        A: { min: 1, max: 26, suffixes },
        B: { min: 1, max: 21, suffixes },
        C: { min: 1, max: 8, suffixes },
        D: { min: 1, max: 15, suffixes },
        E: { min: 1, max: 21, suffixes },
        R: { min: 1, max: 2, suffixes: ['A', 'B', 'C', 'D'] },
    };

    let allLocations = [];

    // Add ranges
    for (const row in locationRanges) {
        const { min, max, suffixes } = locationRanges[row];
        for (let num = min; num <= max; num++) {
            for (const suffix of suffixes) {
                allLocations.push(`${row}${num}${suffix}`);
            }
        }
    }

    const specificLocations = ['A27', 'B0', 'B22', 'D16', 'E0', 'S1', 'S2', 'IN', 'T1', 'T2', 'T3', 'T4'];
    allLocations.push(...specificLocations);

    insertLocationsTransaction(allLocations);

    console.log('Bulk locations added!');
}

// Add test SKUs if empty
const skusCount = db.prepare('SELECT COUNT(*) as count FROM skus').get();
if (skusCount.count === 0) {
    const insertSku = db.prepare('INSERT OR IGNORE INTO skus (sku) VALUES (?)');

    // All SKUs in an array
    const skus = [
        'CHZ', 'BGY', 'CKC', 'TNR', 'MAJ', 'YSZ',
        'DYF', 'LKU', 'WWG', 'DEN', 'IBI', 'CYG',
        'BUD', 'EAI', 'UTD', 'TSC'
    ];

    // Wrap inserts in a transaction
    const insertSkusTransaction = db.transaction((skusList) => {
        for (const sku of skusList) {
            insertSku.run(sku);
        }
    });

    insertSkusTransaction(skus);
    console.log('Test SKUs added!');
}

// Add test data if empty
const inventoryCount = db.prepare('SELECT COUNT(*) as count FROM inventory').get();
if (inventoryCount.count === 0) {
    const insertInventory = db.prepare('INSERT OR REPLACE INTO inventory (sku, location, quantity) VALUES (?, ?, ?)');
    // Define all inventory data in an array
    const inventoryData = [
        { sku: 'CHZ', location: 'A1A', quantity: 640 },
        { sku: 'CHZ', location: 'C3B', quantity: 4000 },
        { sku: 'CHZ', location: 'C5C', quantity: 12000 },
        { sku: 'CKC', location: 'A1B', quantity: 960 },
        { sku: 'CKC', location: 'C4B', quantity: 6000 },
        { sku: 'TNR', location: 'B0', quantity: 4320 },
        { sku: 'MAJ', location: 'B0', quantity: 4 },
        { sku: 'MAJ', location: 'E17C', quantity: 70 },
        { sku: 'YSZ', location: 'S1', quantity: 2345 },
        { sku: 'DYF', location: 'S1', quantity: 1467 },
        { sku: 'LKU', location: 'S2', quantity: 425 },
        { sku: 'WWG', location: 'S2', quantity: 678 },
        { sku: 'DEN', location: 'S2', quantity: 123 },
        { sku: 'IBI', location: 'R2A', quantity: 14 },
        { sku: 'IBI', location: 'R1D', quantity: 200 },
        { sku: 'IBI', location: 'IN', quantity: 100 },
        { sku: 'CYG', location: 'D3A', quantity: 12 },
        { sku: 'CYG', location: 'D1A', quantity: 3 },
        { sku: 'BUD', location: 'D10A', quantity: 10 },
        { sku: 'BUD', location: 'D8B', quantity: 16 },
        { sku: 'EAI', location: 'D2A', quantity: 8 },
        { sku: 'EAI', location: 'E5B', quantity: 16 },
        { sku: 'UTD', location: 'E0', quantity: 13 },
        { sku: 'TSC', location: 'E0', quantity: 27 }
    ];

    // Wrap inserts in a single transaction
    const insertInventoryTransaction = db.transaction((data) => {
        for (const item of data) {
            insertInventory.run(item.sku, item.location, item.quantity);
        }
    });
    insertInventoryTransaction(inventoryData);
    console.log('Test inventory added!');
}

// Add test preferred locations if empty
const preferredCount = db.prepare('SELECT COUNT(*) as count FROM preferred_locations').get();
if (preferredCount.count === 0) {
    const insertPreferred = db.prepare('INSERT OR REPLACE INTO preferred_locations (sku, location) VALUES (?, ?)');
    // Define preferred locations in an array
    const preferredData = [
        { sku: 'CHZ', location: 'A1A' },
        { sku: 'CYG', location: 'D1A' },
        // Add more preferred locations here
    ];

    // Wrap inserts in a single transaction
    const insertPreferredTransaction = db.transaction((data) => {
        for (const item of data) {
            insertPreferred.run(item.sku, item.location);
        }
    });
    insertPreferredTransaction(preferredData);
    console.log('Added test preferred locations!');
}

// Add test thresholds if empty
const thresholdsCount = db.prepare('SELECT COUNT(*) as count FROM replen_thresholds').get();
if (thresholdsCount.count === 0) {
    const insertThreshold = db.prepare('INSERT OR REPLACE INTO replen_thresholds (sku, threshold) VALUES (?, ?)');

    // Define all thresholds in an array
    const thresholdData = [
        { sku: 'CHZ', threshold: 800 },
        { sku: 'CKC', threshold: 900 },
        { sku: 'CYG', threshold: 4 },
        // Add more SKU thresholds as needed
    ];

    // Wrap inserts in a single transaction
    const insertThresholdTransaction = db.transaction((data) => {
        for (const item of data) {
            insertThreshold.run(item.sku, item.threshold);
        }
    });
    insertThresholdTransaction(thresholdData);
    console.log('Added test replenishment thresholds!');
}

module.exports = db;