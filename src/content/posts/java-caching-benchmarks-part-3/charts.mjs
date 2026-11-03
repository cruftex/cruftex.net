// Charts of this post, rendered by `pnpm charts` from the JMH .dat files in CMS/ and G1/.
// The x parameter is "threads-size-factor" or "threads-size-hitrate"; each chart varies one of them.
const by = {
  size: x => `${x.split("-")[1]} entries`,
  thread: x => {
    const t = x.split("-")[0];
    return `${t} thread${t === "1" ? "" : "s"}`;
  },
  factor: x => `Zipfian factor ${x.split("-")[2]}`,
  hitrate: x => `${x.split("-")[2]} % target hit rate`,
};

const NOTE = "Whiskers show the 99.9 % confidence interval reported by JMH.";

const chart = (file, { vary, unit, title, series, yLabel }) => ({
  out: `${file}.chart.svg`,
  data: `${file}.dat`,
  title,
  note: NOTE,
  preset: "bars",
  unit,
  xLabel: by[vary],
  series,
  yLabel,
});

export default [
  chart("CMS/ZipfianSequenceLoadingBenchmark-bySize-4x10", {
    vary: "size",
    unit: "ops/s",
    title:
      "ZipfianSequenceLoadingBenchmark, operations per second by cache size, 4 threads, Zipfian factor 10, CMS",
  }),
  chart("CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-bySize-4x10", {
    vary: "size",
    unit: "%",
    yLabel: "effective hit rate in %",
    title:
      "ZipfianSequenceLoadingBenchmark, effective hit rate by cache size, 4 threads, Zipfian factor 10, CMS",
  }),
  chart("CMS/ZipfianSequenceLoadingBenchmark-byThread-1Mx10", {
    vary: "thread",
    unit: "ops/s",
    title:
      "ZipfianSequenceLoadingBenchmark, operations per second by thread count, 1M entries, Zipfian factor 10, CMS",
  }),
  chart("CMS/ZipfianSequenceLoadingBenchmark-byFactor-1M-4", {
    vary: "factor",
    unit: "ops/s",
    title:
      "ZipfianSequenceLoadingBenchmark, operations per second by Zipfian factor, 1M entries, 4 threads, CMS",
  }),
  chart("CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-byFactor-1M-4", {
    vary: "factor",
    unit: "%",
    yLabel: "effective hit rate in %",
    title:
      "ZipfianSequenceLoadingBenchmark, effective hit rate by Zipfian factor, 1M entries, 4 threads, CMS",
  }),
  chart("G1/ZipfianSequenceLoadingBenchmark-bySize-4x10", {
    vary: "size",
    unit: "ops/s",
    title:
      "ZipfianSequenceLoadingBenchmark, operations per second by cache size, 4 threads, Zipfian factor 10, G1",
  }),
  chart("CMS/RandomSequenceBenchmark-byHitrate-4-1M", {
    vary: "hitrate",
    unit: "ops/s",
    title:
      "RandomSequenceBenchmark, operations per second by target hit rate, 4 threads, 1M entries, CMS",
  }),
  chart("CMS/RandomSequenceBenchmarkEffectiveHitrate-byHitrate-4-1M", {
    vary: "hitrate",
    unit: "%",
    yLabel: "effective hit rate in %",
    title:
      "RandomSequenceBenchmark, effective hit rate by target hit rate, 4 threads, 1M entries, CMS",
  }),
  chart("CMS/RandomSequenceBenchmark-bySize-4x50", {
    vary: "size",
    unit: "ops/s",
    title:
      "RandomSequenceBenchmark, operations per second by cache size, 4 threads, 50 % target hit rate, CMS",
  }),
  chart("G1/RandomSequenceBenchmark-bySize-4x50", {
    vary: "size",
    unit: "ops/s",
    title:
      "RandomSequenceBenchmark, operations per second by cache size, 4 threads, 50 % target hit rate, G1",
  }),
  chart("CMS/RandomSequenceBenchmarkScanCount-bySize-4x80", {
    vary: "size",
    unit: "",
    yLabel: "cache2k, scanned entries per eviction",
    title:
      "RandomSequenceBenchmark, scan count by cache size, 4 threads, 80 % target hit rate, CMS",
  }),
  chart("CMS/RandomSequenceBenchmarkScanCount-byHitrate-4x1M", {
    vary: "hitrate",
    unit: "",
    yLabel: "cache2k, scanned entries per eviction",
    title:
      "RandomSequenceBenchmark, scan count by target hit rate, 4 threads, 1M entries, CMS",
  }),
  chart("CMS/ZipfianSequenceLoadingBenchmarkScanCount-bySize-4x10", {
    vary: "size",
    unit: "",
    yLabel: "cache2k, scanned entries per eviction",
    title:
      "ZipfianSequenceLoadingBenchmark, scan count by cache size, 4 threads, Zipfian factor 10, CMS",
  }),
  {
    out: "CMS/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-10M-5.chart.svg",
    data: "CMS/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-10M-5.dat",
    title:
      "ZipfianSequenceLoadingBenchmark, memory consumption, 10M entries, 4 threads, Zipfian factor 5, CMS",
    preset: "bars",
    unit: "bytes",
    series: ["usedMem_settled", "VmHWM"],
  },
  {
    out: "G1/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-1M-5.chart.svg",
    data: "G1/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-1M-5.dat",
    title:
      "ZipfianSequenceLoadingBenchmark, memory consumption, 1M entries, 4 threads, Zipfian factor 5, G1",
    preset: "bars",
    unit: "bytes",
    series: ["usedMem_settled", "VmHWM"],
  },
];
