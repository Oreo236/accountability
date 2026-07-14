// Parses the speedyapply/2027-SWE-College-Jobs NEW_GRAD_USA.md table format.
// Real row shape (verified against the live source), e.g. FAANG+/Quant:
//   | <a href="https://company.com"><strong>Company</strong></a> | Position | Location | $200k/yr | <a href="https://apply/url"><img ...></a> | 3d |
// "Other" section omits the Salary column (5 cells instead of 6).
// Company/location cells are plain text except the Company and Posting cells, which wrap an <a href>.

const SECTIONS = [
  { start: '<!-- TABLE_FAANG_START -->', end: '<!-- TABLE_FAANG_END -->', category: 'FAANG+', hasSalary: true },
  { start: '<!-- TABLE_QUANT_START -->', end: '<!-- TABLE_QUANT_END -->', category: 'Quant', hasSalary: true },
  { start: '<!-- TABLE_START -->', end: '<!-- TABLE_END -->', category: 'Other', hasSalary: false },
];

function stripTags(cell) {
  return cell.replace(/<[^>]+>/g, '').trim();
}

function extractHref(cell) {
  const m = /<a\s+href="([^"]+)"/i.exec(cell);
  return m ? m[1] : null;
}

function extractCompanyName(cell) {
  const m = /<strong>([^<]+)<\/strong>/i.exec(cell);
  return m ? m[1].trim() : stripTags(cell);
}

function splitRow(line) {
  // Drop the leading/trailing empty cells produced by the outer pipes.
  const cells = line.split('|');
  return cells.slice(1, -1).map((c) => c.trim());
}

function parseSection(markdown, section) {
  const startIdx = markdown.indexOf(section.start);
  const endIdx = markdown.indexOf(section.end);
  if (startIdx === -1 || endIdx === -1) return [];

  const body = markdown.slice(startIdx + section.start.length, endIdx);
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'));

  const rows = [];
  for (const line of lines) {
    if (/^\|\s*-+\s*\|/.test(line)) continue; // separator row
    const cells = splitRow(line);
    const expected = section.hasSalary ? 6 : 5;
    if (cells.length < expected) continue;
    if (/^company$/i.test(stripTags(cells[0]))) continue; // header row

    const [companyCell, positionCell, locationCell, ...rest] = cells;
    const salaryCell = section.hasSalary ? rest[0] : null;
    const postingCell = section.hasSalary ? rest[1] : rest[0];
    const ageCell = section.hasSalary ? rest[2] : rest[1];

    const url = extractHref(postingCell);
    if (!url) continue;

    rows.push({
      company: extractCompanyName(companyCell),
      position: stripTags(positionCell),
      location: stripTags(locationCell),
      salary: salaryCell ? stripTags(salaryCell) : null,
      age: stripTags(ageCell),
      url,
      category: section.category,
    });
  }
  return rows;
}

export function parseListings(markdown) {
  return SECTIONS.flatMap((section) => parseSection(markdown, section));
}
