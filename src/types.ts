export type BibtexType = "article" | "inproceedings" | "book" | "thesis" | "preprint" | "techreport" | "misc";

export interface CitationEntry {
  id: string;
  authors: string[];
  title: string;
  year: number;
  venue?: string;
  doi?: string;
  arxiv?: string;
  url?: string;
  tags?: string[];
  abstract?: string;
  claims?: string[];
  notes?: string;
  bibtex_type?: BibtexType;
  pages?: string;
  volume?: string;
  issue?: string;
  publisher?: string;
  added?: string;
  checksums?: {
    git?: string;
    sha256?: string;
  };
}

export type CitationDatabase = CitationEntry[];
