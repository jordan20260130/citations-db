#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CitationEntry, CitationDatabase } from '../src/types';

const DB_PATH = resolve(__dirname, '..', 'citations.json');
const CLAWXIV_API_BASE = 'https://www.clawxiv.org/api/v1';

interface ClawxivAuthor {
  name: string;
}

interface ClawxivPaper {
  title: string;
  authors: ClawxivAuthor[];
  created_at: string;
  url: string;
  categories?: string[];
  abstract?: string;
}

interface ClawxivVersion {
  version: string;
}

async function fetchClawxiv(paperId: string): Promise<ClawxivPaper> {
  const fullId = paperId.startsWith('clawxiv.') ? paperId : `clawxiv.${paperId}`;
  const url = `${CLAWXIV_API_BASE}/papers/${fullId}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<ClawxivPaper>;
}

async function fetchVersions(paperId: string): Promise<ClawxivVersion[]> {
  const fullId = paperId.startsWith('clawxiv.') ? paperId : `clawxiv.${paperId}`;
  const url = `${CLAWXIV_API_BASE}/papers/${fullId}/versions`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }
    return response.json() as Promise<ClawxivVersion[]>;
  } catch {
    return [];
  }
}

function generateId(authors: string[], year: number, title: string): string {
  const firstAuthor = authors[0];
  const name = firstAuthor;
  const lastName = name.split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const firstWord = title.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${lastName}${year}${firstWord}`;
}

function loadDB(): CitationDatabase {
  const data = readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function saveDB(db: CitationDatabase): void {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + '\n');
}

async function main() {
  const inputId = process.argv[2];
  
  if (!inputId) {
    console.error('Usage: bun run scripts/add-clawxiv.ts <clawxiv_id>');
    console.error('');
    console.error('Examples:');
    console.error('  bun run scripts/add-clawxiv.ts clawxiv.2602.00011');
    console.error('  bun run scripts/add-clawxiv.ts 2602.00011');
    process.exit(1);
  }
  
  const paperId = inputId.startsWith('clawxiv.') ? inputId : `clawxiv.${inputId}`;
  
  console.log(`Fetching clawXiv:${paperId}...`);
  
  try {
    const data = await fetchClawxiv(paperId);
    
    console.log(`Found: ${data.title}`);
    console.log(`Authors: ${data.authors.map(a => a.name).join(', ')}`);
    
    const year = parseInt(data.created_at.substring(0, 4), 10);
    console.log(`Year: ${year}`);
    
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
    
    const id = generateId(data.authors.map(a => a.name), year, data.title);
    console.log(`Generated ID: ${id}`);
    
    const db = loadDB();
    
    if (db.some(e => e.id === id)) {
      console.error(`\nError: Entry with ID '${id}' already exists`);
      process.exit(1);
    }
    
    const formattedAuthors = data.authors.map(author => {
      const name = author.name;
      if (name.includes(',')) return name;
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return name;
      const last = parts.pop();
      const first = parts.join(' ');
      return `${last}, ${first}`;
    });
    
    const entry: CitationEntry = {
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
    
    db.push(entry);
    
    db.sort((a, b) => a.id.localeCompare(b.id));
    
    saveDB(db);
    
    console.log(`\n✓ Added entry: ${id}`);
    console.log(`  Run 'bun run scripts/cite.ts validate' to verify`);
    console.log(`\n  REMINDER: Commit and push to both repos!`);
    console.log(`    git add citations.json`);
    console.log(`    git commit -m "Add ${id}"`);
    console.log(`    git push github main`);
    console.log(`    git push gitlab main`);
    
  } catch (err) {
    console.error(`\nError: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
