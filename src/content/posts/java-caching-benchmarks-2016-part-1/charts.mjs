// Charts of this post, rendered by `pnpm charts` from the .dat files next to it.
const entries = x => `${Number(x) / 1e6}M entries`;
const threadsHitrate = x => {
  const [t, h] = x.split("-");
  return `${t} thread${t === "1" ? "" : "s"}, ${h} %`;
};

// CHM is a reference, the data files are listed in the post itself.
const common = {
  dataLink: false,
  note: "CHM = ConcurrentHashMap, no eviction, as reference.",
};

export default [
  ...[1, 2, 4].map(t => ({
    ...common,
    out: `populateParallelOnce-${t}.chart.svg`,
    data: `populateParallelOnce-${t}.dat`,
    title: `Populate Parallel Once benchmark, ${t} thread${t === 1 ? "" : "s"}: runtime by cache size`,
    preset: "bars",
    unit: "s",
    yLabel: "runtime in seconds",
    xLabel: entries,
  })),
  {
    ...common,
    out: "populateParallelOnce-memory.chart.svg",
    data: "populateParallelOnce-memory.dat",
    title: "Heap memory after inserting, by cache size",
    preset: "bars",
    unit: "MB",
    yLabel: "heap memory in MB",
    xLabel: entries,
  },
  {
    ...common,
    out: "readOnly.chart.svg",
    data: "readOnly.dat",
    title: "Read Only benchmark: operations per second by threads and hit rate",
    preset: "bars",
    unit: "ops/s",
    xLabel: threadsHitrate,
    xTickRotate: -25,
  },
  {
    ...common,
    out: "combinedReadWrite.chart.svg",
    data: "combinedReadWrite.dat",
    title: "Combined Read/Write benchmark: operations per second",
    preset: "bars",
    unit: "ops/s",
    xLabel: {
      readOnly: "read only",
      readWrite: "read and write",
      writeOnly: "write only",
    },
  },
];
