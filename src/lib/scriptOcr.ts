import type { Role } from '../../supabase/functions/_shared/types.ts';

export interface OcrRoleMatch {
  role: Role;
  /** The original OCR line, retained for the user's review. */
  line: string;
  /** One-based line number in the original OCR text. */
  lineNumber: number;
}

export interface OcrRoleMatches {
  matches: OcrRoleMatch[];
  unmatchedLines: string[];
}

function aliasPattern(alias: string): string {
  return Array.from(alias.normalize('NFKC').replace(/[\s_-]/g, ''))
    .map(character => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s_-]*');
}

/**
 * Extract role headings, not arbitrary mentions inside ability text.
 * Results still need human confirmation: OCR cannot establish whether a role
 * heading belongs to the actual script, an example, or a footnote.
 * Uncertain spellings are deliberately left unmatched rather than guessed.
 */
export function matchOcrRoles(text: string, catalog: readonly Role[]): OcrRoleMatches {
  const candidates = catalog.flatMap(role => [...new Set([role.name, role.id])]
    .filter(alias => alias.trim())
    .map(alias => ({
      role,
      length: alias.replace(/[\s_-]/g, '').length,
      pattern: new RegExp(`^${aliasPattern(alias)}(?=$|[\\s:：|｜（(【\\[]|[)）\\]】](?:$|[\\s:：|｜]))`, 'iu'),
    })))
    .sort((a, b) => b.length - a.length);
  const matches: OcrRoleMatch[] = [];
  const unmatchedLines: string[] = [];
  const seen = new Set<string>();

  text.split(/\r\n?|\n/).forEach((original, index) => {
    const line = original.normalize('NFKC').trim();
    if (!line) return;
    // Typical OCR list prefixes / printed brackets around the role name.
    const heading = line.replace(/^(?:(?:[•●·*\-]\s*)|(?:\d{1,3}[.、)\]]\s*))/, '')
      .replace(/^[【\[(]\s*/, '');
    const found = candidates.find(candidate => candidate.pattern.test(heading));
    if (!found) {
      unmatchedLines.push(original.trim());
      return;
    }
    if (seen.has(found.role.id)) return;
    seen.add(found.role.id);
    matches.push({ role: found.role, line: original.trim(), lineNumber: index + 1 });
  });

  return { matches, unmatchedLines };
}
