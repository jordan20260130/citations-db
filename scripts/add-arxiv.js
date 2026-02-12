#!/usr/bin/env node
/**
 * Add arXiv paper to citation database
 * 
 * Usage:
 *   node scripts/add-arxiv.js <arxiv_id>
 * 
 * Examples:
 *   node scripts/add-arxiv.js 2301.07041
 *   node scripts/add-arxiv.js 2301.07041v2
 * 
 * Fetches metadata from arXiv API and adds entry with versioned ID.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DB_PATH = path.join(__dirname, '..', 'citations.json');

function fetchArxiv(id) {
  return new Promise((resolve, reject) => {
    // Strip version if present for API query
    const baseId = id.replace(/v\d+$/, '');
    const url = `https://export.arxiv.org/api/query?id_list=${baseId}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseArxivXml(xml) {
  // Extract entry from Atom feed
  const entryMatch = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/);
  if (!entryMatch) {
    throw new Error('No entry found in arXiv response');
  }
  const entry = entryMatch[1];
  
  // Get versioned ID from arxiv link
  const idMatch = entry.match(/<id>([^<]+)<\/id>/);
  if (!idMatch) throw new Error('Could not parse arXiv ID');
  const fullId = idMatch[1];
  
  // Extract version from the ID URL
  const versionMatch = fullId.match(/arxiv\.org\/abs\/\d+\.\d+(v\d+)$/);
  const version = versionMatch ? versionMatch[1] : 'v1';
  
  // Get base arxiv ID (YYMM.number)
  const arxivIdMatch = fullId.match(/(\d{4}\.\d{4,5})/);
  if (!arxivIdMatch) throw new Error('Could not parse arXiv ID format');
  const arxivId = arxivIdMatch[1] + version;
  
  // Title
  const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  if (!titleMatch) throw new Error('Could not parse title');
  const title = titleMatch[1].trim().replace(/\s+/g, ' ');
  
  // Authors
  const authorMatches = entry.matchAll(/<author[^>]*>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g);
  const authors = [];
  for (const match of authorMatches) {
    // Convert "First Last" to "Last, First" format
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
  
  // Published date (for year)
  const publishedMatch = entry.match(/<published>(\d{4})/);
  if (!publishedMatch) throw new Error('Could not parse year');
  const year = parseInt(publishedMatch[1], 10);
  
  // Abstract
  const abstractMatch = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
  const abstract = abstractMatch ? abstractMatch[1].trim().replace(/\s+/g, ' ') : '';
  
  // Categories/tags
  const categoryMatches = entry.matchAll(/<category[^>]*term="([^"]+)"/g);
  const tags = [];
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

function generateId(authors, year, title) {
  // Create ID from first author's last name + year + first word of title
  const firstAuthor = authors[0];
  const lastName = firstAuthor.split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
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
  const arxivInput = process.argv[2];
  
  if (!arxivInput) {
    console.error('Usage: node scripts/add-arxiv.js <arxiv_id>');
    console.error('');
    console.error('Examples:');
    console.error('  node scripts/add-arxiv.js 2301.07041');
    console.error('  node scripts/add-arxiv.js 2301.07041v2');
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
    
    // Generate ID
    const id = generateId(data.authors, data.year, data.title);
    console.log(`Generated ID: ${id}`);
    
    // Load current database
    const db = loadDB();
    
    // Check for duplicate
    if (db.some(e => e.id === id)) {
      console.error(`\nError: Entry with ID '${id}' already exists`);
      process.exit(1);
    }
    
    // Check for duplicate arxiv
    if (db.some(e => e.arxiv && e.arxiv.startsWith(data.arxivId.replace(/v\d+$/, '')))) {
      console.error(`\nWarning: Entry with arXiv ID ${data.arxivId} may already exist`);
    }
    
    // Create entry
    const entry = {
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
    
    // Add to database
    db.push(entry);
    
    // Sort by ID (alphabetical)
    db.sort((a, b) => a.id.localeCompare(b.id));
    
    // Save
    saveDB(db);
    
    console.log(`\n✓ Added entry: ${id}`);
    console.log(`  Run 'node scripts/cite.js validate' to verify`);
    
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

main();
