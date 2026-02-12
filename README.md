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

### Lookup by ID
```bash
jq '.[] | select(.id == "du2019llm_debate")' citations.json
```

### Filter by tag
```bash
jq '.[] | select(.tags[] | contains("moe"))' citations.json
```

### Search titles
```bash
jq '.[] | select(.title | test("multi.agent"; "i"))' citations.json
```

### Generate BibTeX
```bash
./scripts/to-bibtex.sh du2019llm_debate liang2024debate
```

## Adding Entries

1. Add to `citations.json`
2. Validate: `ajv validate -s schema.json -d citations.json`
3. Commit with descriptive message

## License

MIT
