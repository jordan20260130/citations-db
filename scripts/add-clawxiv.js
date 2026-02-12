#!/usr/bin/env node
/**
 * Add clawXiv paper to citation database
 * 
 * Usage:
 *   node scripts/add-clawxiv.js <clawxiv_id>
 * 
 * Examples:
 *   node scripts/add-clawxiv.js clawxiv.2602.00011
 *   node scripts/add-clawxiv.js 2602.00011
 * 
 * Fetches metadata from clawXiv API and adds entry.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DB_PATH = path.join(__dirname, '..', 'citations.json');
const CLAWXIV_API_BASE = 'https://www.clawxiv.org/api/v1';

function fetchClawxiv(paperId) {
  return new Promise((resolve, reject) => {
    // Ensure proper ID format
    const fullId = paperId.startsWith('clawxiv.') ? paperId : `clawxiv.${paperId}`;
    const url = `${CLAWXIV_API_BASE}/papers/${fullId}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

function fetchVersions(paperId) {
  return new Promise((resolve, reject) => {
    const fullId = paperId.startsWith('clawxiv.') ? paperId : `clawxiv.${paperId}`;
    const url = `${CLAWXIV_API_BASE}/papers/${fullId}/versions`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          resolve([]); // Versions endpoint might not exist or be empty
        }
      });
    }).on('error', () => resolve([]));
  });
}

function generateId(authors, year, title) {
  // Create ID from first author's last name + year + first word of title
  const firstAuthor = authors[0];
  const name = firstAuthor.name || firstAuthor;
  const lastName = name.split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const firstWord = title.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${lastName}${year}${firstWord}`;
}

function loadDB() {
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + '\n');
}

async function main() {
  const inputId = process.argv[2];
  
  if (!inputId) {
    console.error('Usage: node scripts/add-clawxiv.js <clawxiv_id>');
    console.error('');
    console.error('Examples:');
    console.error('  node scripts/add-clawxiv.js clawxiv.2602.00011');
    console.error('  node scripts/add-clawxiv.js 2602.00011');
    process.exit(1);
  }
  
  const paperId = inputId.startsWith('clawxiv.') ? inputId : `clawxiv.${inputId}`;
  const shortId = paperId.replace('clawxiv.', '');
  
  console.log(`Fetching clawXiv:${paperId}...`);
  
  try {
    const data = await fetchClawxiv(paperId);
    
    console.log(`Found: ${data.title}`);
    console.log(`Authors: ${data.authors.map(a => a.name).join(', ')}`);
    
    // Parse year from created_at
    const year = parseInt(data.created_at.substring(0, 4), 10);
    console.log(`Year: ${year}`);
    
    // Check for versions
    let versionSuffix = '';
    try {
      const versions = await fetchVersions(paperId);
      if (versions.length > 1) {
        versionSuffix = `v${versions.length}`;
        console.log(`Versions: ${versions.length} (using latest)`);
      }
    } catch (e) {
      // Ignore version fetch errors
    }
    
    // Generate ID
    const id = generateId(data.authors, year, data.title);
    console.log(`Generated ID: ${id}`);
    
    // Load current database
    const db = loadDB();
    
    // Check for duplicate
    if (db.some(e => e.id === id)) {
      console.error(`\nError: Entry with ID '${id}' already exists`);
      process.exit(1);
    }
    
    // Convert authors to "Last, First" format
    const formattedAuthors = data.authors.map(author => {
      const name = author.name;
      // If already in "Last, First" format, keep it
      if (name.includes(',')) return name;
      // Otherwise convert "First Last" to "Last, First"
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return name;
      const last = parts.pop();
      const first = parts.join(' ');
      return `${last}, ${first}`;
    });
    
    // Create entry
    const entry = {
      id,
      authors: formattedAuthors,
      title: data.title,
      year: year,
      venue: 'clawXiv',
      url: data.url,
      tags: data.categories,
      abstract: data.abstract,
      bibtex_type: 'misc',
      added: new Date().toISOString().split('T')[0]
    };
    
    // Add to database
    db.push(entry);
    
    // Sort by ID (alphabetical)
    db.sort((a, b) => a.id.localeCompare(b.id));
    
    // Save
    saveDB(db);
    
    console.log(`\n✓ Added entry: ${id}`);
    console.log(`  Run 'node scripts/cite.js validate' to verify`);
    console.log(`\n  REMINDER: Commit and push to both repos!`);
    console.log(`    git add citations.json`);
    console.log(`    git commit -m "Add ${id}"`);
    console.log(`    git push github main`);
    console.log(`    git push gitlab main`);
    
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

main();
