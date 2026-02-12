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
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

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
  try {
    // Load and parse files
    const dbData = fs.readFileSync(DB_PATH, 'utf8');
    const schemaData = fs.readFileSync(SCHEMA_PATH, 'utf8');
    
    const db = JSON.parse(dbData);
    const schema = JSON.parse(schemaData);
    
    console.log('✓ citations.json is valid JSON');
    console.log('✓ schema.json is valid JSON');
    
    // Strict schema validation with Ajv (draft-07)
    const ajv = new Ajv({ 
      strict: true,
      allErrors: true,
      verbose: true 
    });
    addFormats(ajv);
    
    const validate = ajv.compile(schema);
    const valid = validate(db);
    
    if (!valid) {
      console.error('\n✗ Schema validation failed:\n');
      validate.errors.forEach((err, i) => {
        const path = err.instancePath || '(root)';
        console.error(`  [${i + 1}] ${path}: ${err.message}`);
        if (err.params) {
          console.error(`      params: ${JSON.stringify(err.params)}`);
        }
      });
      process.exit(1);
    }
    
    console.log('✓ citations.json conforms to schema');
    
    // Check for duplicate IDs
    const ids = db.map(e => e.id);
    const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
    
    if (duplicates.length > 0) {
      console.error(`\n✗ Duplicate IDs found: ${duplicates.join(', ')}`);
      process.exit(1);
    }
    
    console.log('✓ No duplicate IDs');
    
    // Check alphabetical ordering
    const sortedIds = [...ids].sort();
    const outOfOrder = [];
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] !== sortedIds[i]) {
        outOfOrder.push(ids[i]);
      }
    }
    
    if (outOfOrder.length > 0) {
      console.error(`\n✗ IDs are not in alphabetical order`);
      console.error(`  First out-of-order: ${outOfOrder[0]}`);
      console.error(`  Expected order: ${sortedIds.join(', ')}`);
      process.exit(1);
    }
    
    console.log('✓ IDs are in alphabetical order');
    console.log(`✓ ${db.length} entries in database`);
    console.log('\nAll validations passed! 🎉');
    
  } catch (err) {
    console.error(`\n✗ Validation failed: ${err.message}`);
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error('\n  Note: Ajv is required. Run: npm install ajv');
    }
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
