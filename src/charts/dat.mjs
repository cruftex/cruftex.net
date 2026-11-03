/**
 * Parse the benchmark `.dat` tables (whitespace separated, one header row).
 *
 * Plain tables:  `label  CHM  cache2k  Caffeine  Guava`
 * JMH tables:    `param  cache2k error lowerConvidence upperConvidence  Caffeine error ...`
 * The JMH `name error lower upper` groups are folded into one series with a
 * confidence interval. Lines starting with `#` are comments.
 *
 * Returns { x: [...row labels in file order], series: [...names],
 *           rows: [{ x, series, value, error?, lower?, upper? }] }
 */
export function parseDat(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));
  if (!lines.length) throw new Error("empty .dat file");
  const cols = lines[0].split(/\s+/);
  const series = [];
  const columns = []; // { name, i, errorAt? }
  for (let i = 1; i < cols.length;) {
    const name = cols[i];
    const jmh =
      cols[i + 1] === "error" &&
      /^lower/i.test(cols[i + 2] ?? "") &&
      /^upper/i.test(cols[i + 3] ?? "");
    columns.push({ name, i, jmh });
    series.push(name);
    i += jmh ? 4 : 1;
  }
  const x = [];
  const rows = [];
  for (const line of lines.slice(1)) {
    const f = line.split(/\s+/);
    x.push(f[0]);
    for (const c of columns) {
      const row = { x: f[0], series: c.name, value: +f[c.i] };
      if (c.jmh) {
        row.error = +f[c.i + 1];
        row.lower = +f[c.i + 2];
        row.upper = +f[c.i + 3];
      }
      rows.push(row);
    }
  }
  return { x, series, rows };
}
