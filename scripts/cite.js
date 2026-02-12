#!/usr/bin/env node
/**
 * Citation Database CLI
 * 
 * Usage:
 *   node cite.js lookup <id>           # Show entry by ID
 *   node cite.js search <term>         # Search titles/authors
 *   node cite.js tags <tag>            # Filter by tag
 *   node cite.js bibtex <id>...        # Generate BibTeX
 *   node cite.js validate              # Validate against schema
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'citations.json');
const SCHEMA_PATH = path.join(__dirname, '..', 'schema.json');

function loadDB() {
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function lookup(id) {
  const db = loadDB();
  const entry = db.find(e => e.id === id);
  if (!entry) {
    console.error(`Error: Entry '${id}' not found`);
    process.exit(1);
  }
  console.log(JSON.stringify(entry, null, 2));
}

function search(term) {
  const db = loadDB();
  const regex = new RegExp(term, 'i');
  const matches = db.filter(e => 
    regex.test(e.title) || 
    e.authors.some(a => regex.test(a)) ||
    (e.abstract && regex.test(e.abstract))
  );
  
  if (matches.length === 0) {
    console.log('No matches found');
    return;
  }
  
  matches.forEach(e => {
    console.log(`${e.id}: ${e.title} (${e.year})`);
  });
}

function filterByTag(tag) {
  const db = loadDB();
  const matches = db.filter(e => e.tags && e.tags.includes(tag));
  
  if (matches.length === 0) {
    console.log(`No entries with tag '${tag}'`);
    return;
  }
  
  matches.forEach(e => {
    console.log(`${e.id}: ${e.title} (${e.year})`);
  });
}

function toBibtex(ids) {
  const db = loadDB();
  
  const entries = ids.map(id => {
    const entry = db.find(e => e.id === id);
    if (!entry) {
      console.error(`Warning: Entry '${id}' not found, skipping`);
      return null;
    }
    return entry;
  }).filter(Boolean);
  
  entries.forEach(e => {
    const type = e.bibtex_type || 'article';
    const authors = e.authors.join(' and ');
    
    console.log(`@${type}{${e.id},`);
    console.log(`  author = {${authors}},`);
    console.log(`  title = {${e.title}},`);
    console.log(`  year = {${e.year}},`);
    if (e.venue) console.log(`  journal = {${e.venue}},`);
    if (e.doi) console.log(`  doi = {${e.doi}},`);
    if (e.arxiv) console.log(`  eprint = {${e.arxiv}},`);
    if (e.url) console.log(`  url = {${e.url}},`);
    if (e.pages) console.log(`  pages = {${e.pages}},`);
    if (e.volume) console.log(`  volume = {${e.volume}},`);
    if (e.publisher) console.log(`  publisher = {${e.publisher}},`);
    console.log('}');
    console.log();
  });
}

function validate() {
  // Simple JSON parse validation
  try {
    loadDB();
    console.log('✓ citations.json is valid JSON');
    
    // Check for duplicate IDs
    const db = loadDB();
    const ids = db.map(e => e.id);
    const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
    
    if (duplicates.length > 0) {
      console.error(`✗ Duplicate IDs found: ${duplicates.join(', ')}`);
      process.exit(1);
    }
    
    console.log('✓ No duplicate IDs');
    console.log(`✓ ${db.length} entries in database`);
  } catch (err) {
    console.error(`✗ Validation failed: ${err.message}`);
    process.exit(1);
  }
}

// CLI
const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'lookup':
    if (!args[0]) {
      console.error('Usage: node cite.js lookup <id>');
      process.exit(1);
    }
    lookup(args[0]);
    break;
  case 'search':
    if (!args[0]) {
      console.error('Usage: node cite.js search <term>');
      process.exit(1);
    }
    search(args[0]);
    break;
  case 'tags':
    if (!args[0]) {
      console.error('Usage: node cite.js tags <tag>');
      process.exit(1);
    }
    filterByTag(args[0]);
    break;
  case 'bibtex':
    if (args.length === 0) {
      console.error('Usage: node cite.js bibtex <id>...');
      process.exit(1);
    }
    toBibtex(args);
    break;
  case 'validate':
    validate();
    break;
  default:
    console.log('Citation Database CLI');
    console.log('');
    console.log('Commands:');
    console.log('  lookup <id>        Show entry by ID');
    console.log('  search <term>      Search titles/authors');
    console.log('  tags <tag>         Filter by tag');
    console.log('  bibtex <id>...     Generate BibTeX');
    console.log('  validate           Validate database');
    process.exit(1);
}
