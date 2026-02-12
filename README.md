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
```

### Or use npm scripts

```bash
npm run validate
npm run lookup -- du2019llm_debate
npm run search -- "multi-agent"
npm run tags -- moe
npm run bibtex -- du2019llm_debate liang2024debate
```

## Adding Entries

1. Add to `citations.json`
2. Validate: `node scripts/cite.js validate`
3. Commit with descriptive message

## License

MIT
