#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { CitationEntry, CitationDatabase } from '../src/types';

const DB_PATH = resolve(__dirname, '..', 'citations.json');
const SCHEMA_PATH = resolve(__dirname, '..', 'schema.json');

function loadDB(): CitationDatabase {
  const data = readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function lookup(id: string): void {
  const db = loadDB();
  const entry = db.find(e => e.id === id);
  if (!entry) {
    console.error(`Error: Entry '${id}' not found`);
    process.exit(1);
  }
  console.log(JSON.stringify(entry, null, 2));
}

function search(term: string): void {
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

function filterByTag(tag: string): void {
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

function toBibtex(ids: string[]): void {
  const db = loadDB();
  
  const entries = ids.map(id => {
    const entry = db.find(e => e.id === id);
    if (!entry) {
      console.error(`Warning: Entry '${id}' not found, skipping`);
      return null;
    }
    return entry;
  }).filter((e): e is CitationEntry => e !== null);
  
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

function validate(): void {
  try {
    const dbData = readFileSync(DB_PATH, 'utf8');
    const schemaData = readFileSync(SCHEMA_PATH, 'utf8');
    
    const db = JSON.parse(dbData) as CitationDatabase;
    const schema = JSON.parse(schemaData);
    
    console.log('✓ citations.json is valid JSON');
    console.log('✓ schema.json is valid JSON');
    
    const ajv = new Ajv({ 
      strict: true,
      allErrors: true,
      verbose: true 
    });
    addFormats(ajv);
    
    const validateFn = ajv.compile(schema);
    const valid = validateFn(db);
    
    if (!valid) {
      console.error('\n✗ Schema validation failed:\n');
      validateFn.errors?.forEach((err: ErrorObject, i: number) => {
        const path = err.instancePath || '(root)';
        console.error(`  [${i + 1}] ${path}: ${err.message}`);
        if (err.params) {
          console.error(`      params: ${JSON.stringify(err.params)}`);
        }
      });
      process.exit(1);
    }
    
    console.log('✓ citations.json conforms to schema');
    
    const ids = db.map((e: CitationEntry) => e.id);
    const duplicates = ids.filter((item: string, index: number) => ids.indexOf(item) !== index);
    
    if (duplicates.length > 0) {
      console.error(`\n✗ Duplicate IDs found: ${duplicates.join(', ')}`);
      process.exit(1);
    }
    
    console.log('✓ No duplicate IDs');
    
    const sortedIds = [...ids].sort();
    const outOfOrder: string[] = [];
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
    console.error(`\n✗ Validation failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'lookup':
    if (!args[0]) {
      console.error('Usage: bun run scripts/cite.ts lookup <id>');
      process.exit(1);
    }
    lookup(args[0]);
    break;
  case 'search':
    if (!args[0]) {
      console.error('Usage: bun run scripts/cite.ts search <term>');
      process.exit(1);
    }
    search(args[0]);
    break;
  case 'tags':
    if (!args[0]) {
      console.error('Usage: bun run scripts/cite.ts tags <tag>');
      process.exit(1);
    }
    filterByTag(args[0]);
    break;
  case 'bibtex':
    if (args.length === 0) {
      console.error('Usage: bun run scripts/cite.ts bibtex <id>...');
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
