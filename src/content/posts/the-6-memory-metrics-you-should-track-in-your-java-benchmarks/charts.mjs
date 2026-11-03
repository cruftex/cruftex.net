// Charts of this post, rendered by `pnpm charts` from the JMH .dat files in CMS/ and G1/.
// All runs: ZipfianSequenceLoadingBenchmark, 4 threads, 1M entries, Zipfian factor 10.
const B = "ZipfianSequenceLoadingBenchmark";
const bars = (file, opts) => ({
  out: `${file}.chart.svg`,
  data: `${file}.dat`,
  preset: "bars",
  note: "Whiskers show the 99.9 % confidence interval reported by JMH.",
  ...opts,
});

export default [
  bars(`G1/${B}`, {
    title: "Throughput, G1 collector: operations per second",
    unit: "ops/s",
    xLabel: () => "4 threads, 1M entries, Zipfian factor 10",
  }),
  ...["CMS", "G1"].map(gc =>
    bars(`${gc}/${B}MemoryUsed4-1M-10`, {
      title: `Used memory, ${gc} collector`,
      unit: "bytes",
      series: [
        "usedHeap_settled",
        "usedMem_settled",
        "usedMem_fin",
        "usedMem_max",
      ],
    })
  ),
  ...["CMS", "G1"].map(gc =>
    bars(`${gc}/${B}Memory4-1M-10-total`, {
      title: `Total and resident memory, ${gc} collector`,
      unit: "bytes",
      series: ["totalMem_settled", "totalMem_max", "VmRSS", "VmHWM"],
    })
  ),
  ...["CMS", "G1"].map(gc =>
    bars(`${gc}/${B}Memory4-1M-10-allocRate`, {
      title: `Allocation rate, ${gc} collector`,
      unit: "bytes/s",
      series: ["allocRate(byte/s)"],
      yLabel: "allocation rate in bytes per second",
    })
  ),
  bars(`G1/${B}Memory4-1M-10-allocRatePerOp`, {
    title: "Allocated bytes per operation, G1 collector",
    unit: "bytes/op",
    series: ["allocRate(byte/op)"],
    yLabel: "allocated bytes per operation",
  }),
  bars(`G1/${B}Memory4-1M-10-usedHeap-sorted`, {
    title:
      "Used heap after full GC (usedHeap_settled), G1 collector, best first",
    unit: "bytes",
    series: ["usedHeap_settled"],
    yLabel: "usedHeap_settled",
  }),
  bars(`G1/${B}Memory4-1M-10-VmHWM-sorted`, {
    title: "Peak resident memory (VmHWM), G1 collector, best first",
    unit: "bytes",
    series: ["VmHWM"],
    yLabel: "VmHWM",
  }),
];
