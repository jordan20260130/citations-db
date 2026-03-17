#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CitationEntry, CitationDatabase } from '../src/types';

const DB_PATH = resolve(__dirname, '..', 'citations.json');

interface ArxivMetadata {
  arxivId: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  tags: string[];
}

async function fetchArxiv(id: string): Promise<string> {
  const baseId = id.replace(/v\d+$/, '');
  const url = `https://export.arxiv.org/api/query?id_list=${baseId}`;
  
  const response = await fetch(url);
  return response.text();
}

function parseArxivXml(xml: string): ArxivMetadata {
  const entryMatch = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/);
  if (!entryMatch) {
    throw new Error('No entry found in arXiv response');
  }
  const entry = entryMatch[1];
  
  const idMatch = entry.match(/<id>([^<]+)<\/id>/);
  if (!idMatch) throw new Error('Could not parse arXiv ID');
  const fullId = idMatch[1];
  
  const versionMatch = fullId.match(/arxiv\.org\/abs\/\d+\.\d+(v\d+)$/);
  const version = versionMatch ? versionMatch[1] : 'v1';
  
  const arxivIdMatch = fullId.match(/(\d{4}\.\d{4,5})/);
  if (!arxivIdMatch) throw new Error('Could not parse arXiv ID format');
  const arxivId = arxivIdMatch[1] + version;
  
  const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  if (!titleMatch) throw new Error('Could not parse title');
  const title = titleMatch[1].trim().replace(/\s+/g, ' ');
  
  const authorMatches = entry.matchAll(/<author[^>]*>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g);
  const authors: string[] = [];
  for (const match of authorMatches) {
    const name = match[1].trim();
    const parts = name.split(/\s+/);
    if (parts.length === 1) {
      authors.push(name);
    } else {
      const last = parts.pop();
      const first = parts.join(' ');
      authors.push(`${last}, ${first}`);
    }
  }
  
  const publishedMatch = entry.match(/<published>(\d{4})/);
  if (!publishedMatch) throw new Error('Could not parse year');
  const year = parseInt(publishedMatch[1], 10);
  
  const abstractMatch = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
  const abstract = abstractMatch ? abstractMatch[1].trim().replace(/\s+/g, ' ') : '';
  
  const categoryMatches = entry.matchAll(/<category[^>]*term="([^"]+)"/g);
  const tags: string[] = [];
  for (const match of categoryMatches) {
    tags.push(match[1]);
  }
  
  return {
    arxivId,
    title,
    authors,
    year,
    abstract,
    tags
  };
}

function generateId(authors: string[], year: number, title: string): string {
  const firstAuthor = authors[0];
  const lastName = firstAuthor.split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
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
  const arxivInput = process.argv[2];
  
  if (!arxivInput) {
    console.error('Usage: bun run scripts/add-arxiv.ts <arxiv_id>');
    console.error('');
    console.error('Examples:');
    console.error('  bun run scripts/add-arxiv.ts 2301.07041');
    console.error('  bun run scripts/add-arxiv.ts 2301.07041v2');
    process.exit(1);
  }
  
  console.log(`Fetching arXiv:${arxivInput}...`);
  
  try {
    const xml = await fetchArxiv(arxivInput);
    const data = parseArxivXml(xml);
    
    console.log(`Found: ${data.title}`);
    console.log(`Authors: ${data.authors.join(', ')}`);
    console.log(`Year: ${data.year}`);
    console.log(`arXiv ID (versioned): ${data.arxivId}`);
    
    const id = generateId(data.authors, data.year, data.title);
    console.log(`Generated ID: ${id}`);
    
    const db = loadDB();
    
    if (db.some(e => e.id === id)) {
      console.error(`\nError: Entry with ID '${id}' already exists`);
      process.exit(1);
    }
    
    if (db.some(e => e.arxiv && e.arxiv.startsWith(data.arxivId.replace(/v\d+$/, '')))) {
      console.error(`\nWarning: Entry with arXiv ID ${data.arxivId} may already exist`);
    }
    
    const entry: CitationEntry = {
      id,
      authors: data.authors,
      title: data.title,
      year: data.year,
      arxiv: data.arxivId,
      venue: 'arXiv preprint',
      bibtex_type: 'preprint',
      tags: data.tags,
      abstract: data.abstract,
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
