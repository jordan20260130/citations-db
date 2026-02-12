# Citation Database

A ground-truth citation database to prevent hallucinated references in academic writing.

## Why?

When writing papers, it's easy to:
- Misremember which paper said what
- Cite the wrong year or authors
- Hallucinate entire references that don't exist

This database is the single source of truth. If it's not in here, don't cite it.

## Schema

See `schema.json` for the full JSON Schema. Key fields:

- `id`: Unique key (e.g., `du2019llm_debate`)
- `authors`: Array of "Last, First" strings
- `title`: Paper title
- `year`: Publication year
- `venue`: Journal/conference/publisher
- `doi`: DOI (must start with `10.`)
- `arxiv`: arXiv ID
- `url`: Direct URL if available
- `tags`: Topic tags for filtering
- `abstract`: Paper abstract
- `claims`: Key findings (what you can actually cite)
- `notes`: Your commentary
- `bibtex_type`: For BibTeX export

## Usage

### CLI Commands

```bash
node scripts/cite.js lookup <id>           # Show entry by ID
node scripts/cite.js search <term>         # Search titles/authors
node scripts/cite.js tags <tag>            # Filter by tag
node scripts/cite.js bibtex <id>...        # Generate BibTeX
node scripts/cite.js validate              # Validate database
node scripts/add-arxiv.js <arxiv_id>       # Add paper from arXiv
```

### Or use npm scripts

```bash
npm run validate
npm run lookup -- du2019llm_debate
npm run search -- "multi-agent"
npm run tags -- moe
npm run bibtex -- du2019llm_debate liang2024debate
npm run add-arxiv -- 2401.11817
```

## Adding Entries

### From arXiv (easiest)

```bash
node scripts/add-arxiv.js 2401.11817
```

This fetches metadata from arXiv, generates an ID, and inserts the entry in alphabetical order. The arXiv ID always includes the version number (e.g., `2401.11817v2`).

### Manual

1. Add to `citations.json` (keep IDs alphabetical!)
2. Validate: `node scripts/cite.js validate`
3. Commit with descriptive message

## License

MIT
