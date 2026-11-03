// Hit rate by cache size for every trace. The .dat files were recovered from the
// 2016 gnuplot SVGs (scripts/recover-hitrate-svg.mjs); `pnpm charts` renders them.
const TRACES = {
  Cpp: "Cpp",
  Glimpse: "Glimpse",
  Multi2: "Multi2",
  Oltp: "OLTP",
  OrmAccessBusytime: "OrmAccessBusytime",
  OrmAccessNight: "OrmAccessNight",
  Sprite: "Sprite",
  TotalRandom1000: "random pattern (1000 keys)",
  UmassFinancial1: "UmassFinancial1",
  UmassFinancial2: "UmassFinancial2",
  UmassWebSearch1: "UmassWebSearch1",
  Web07: "Web07",
  Web12: "Web12",
  Zipf10k: "Zipfian pattern (10k keys)",
  Zipf900: "Zipfian pattern (900 keys)",
};

export default Object.entries(TRACES).map(([key, name]) => ({
  out: `trace${key}hitrateProducts.chart.svg`,
  data: `trace${key}hitrateProducts.dat`,
  title: `Hit rate by cache size, ${name} trace`,
  preset: "lines",
  note: "OPT = optimal replacement (Belady), RAND = random eviction; LRU and CLOCK are reference implementations from cache2k-benchmark.",
  unit: "%",
  yLabel: "hit rate in %",
  xAxisLabel: "cache size (entries)",
  xLabel: x => Number(x).toLocaleString("en-US"),
}));
