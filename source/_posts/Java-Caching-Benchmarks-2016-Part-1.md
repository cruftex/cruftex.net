title: Java Caching Benchmarks 2016 - Part 1
tags:
  - Java
  - caching
  - cache2k
  - benchmark
  - JMH
date: 2016-03-16 16:26:16
---

Looking around, my [benchmarks](http://cache2k.org/benchmarks.html) comparing several Java caches, 
like Guava, EHCache, Infinispan and [cache2k](http://cache2k.org) are still the most comprehensive ones
 you can find focusing on Java heap only cache performance. But, it's two years since I published them.
There are new products and better ways to do benchmarks now. So, it's time for an update!

This post is about some fundamental topics and starts with a first set of benchmarks that compare 
fast in heap caches with Java's `ConcurrentHashMap`. Why this? Well, read on....

<!-- more -->

## The Flaw

Of course, there will never be a benchmark without any flaws. But, my previous benchmarks have a major 
flaw: Most of them are only single threaded. This has two effects: 
The real world throughput of concurrent applications may be different. Furthermore, 
implementations can "cheat" the benchmark by utilizing more threads to do more work in less time.

A second thing: The benchmark is only using integer keys and values. Although this is a flaw, too, for now
we continue with this. Testing with different types will be more interesting in case serialization comes into play. 
We will start looking into this, when starting benchmarks for off heap or persistence features. 

## Switching to JMH

JMH has become the de facto standard to do (micro) benchmarks on the JVM. The previous benchmarks had loops 
to repeat the operations, let's say, 100000 times. With JMH, that is all gone. We just can say: 'Dear JMH, measure 
the throughput in how many operations per second and use a benchmark duration of 10 seconds'. 
JMH also makes sure that the operations are not just optimized away by the Java compiler, which is a typical source of error.

## Comparing Apples and Bananas

But now, back to the topic, the benchmarks themselves. For the first set of benchmarks I decided to do only 
scenarios without the need of eviction. That means the whole key space of the benchmark is fitting always 
into the cache. What? "No eviction, but isn’t that the essence of caching?", you might say. 
That is true, but for the first batch of benchmarks I like to be able to compare against the performance of 
`ConcurrentHashMap`.

Why to compare against the performance of a map? First of all the performance of `ConcurrentHashMap` is a 
benchmark in the real sense of the word. Smart guys, knowing lots about concurrency, the JVM and 
modern computer architecture spent some effort to get it fast. So why not
learn from it, by comparing against it? The second reason, is typical software engineer thinking: 
"Do I need a full fledged cache or can I go faster and use just a `HashMap` or a `ConcurrentHashMap`?". 

So, it is not like comparing apple and bananas, but like comparing a swiss army knife with a knife. 
For some scenarios the simple knife will do the job. Some times you need a few features that you get
from a swiss army knife, but you have fear it is to heavy. Knowing the performance difference is 
critical information.

## Test Setup

For reproduction here is the setup. For the moment I just use my notebook for benchmarking. The hardware
may change in the future to a more stable and server grade setup.

All benchmarks run with integers as keys and values.

### Compared Caches and Versions

For our first benchmark run we use these "cache" implementations:

  - Google Guava Cache, Version 19
  - Caffeine, Version 2.1
  - Cache2k, Version 0.23
  - ConcurrentHashMap (CHM) from JDK 1.8.0_45
  
EHCache, which is a very popular Java (in heap) cache, is missing at the moment. We will add it in a later update.
  
### Environment
  
  - JDK 1.8.0_45
  - JMH 1.11.3
  - JVM flags: -server -Xmx2G
  - Intel(R) Core(TM) i7-5600U CPU @ 2.60GHz, 1x4GB, 1x16GB @ DDR3 1600MHz  
  - 2 cores with hyperthreading enabled
  
Note, the asymmetrical RAM configuration of the test machine is not desirable for benchmarking, 
we need to use another hardware in the future.

### JMH Configuration

  - Warmup iterations: 5
  - Measure iterations: 5
  - Max iteration time: 20 seconds
  
## Benchmark 1: Populate Parallel Once

The first benchmark is about inserting entries in the cache. The run variants are: The number of entries inserted and 
the number of parallel threads used for insertion. The run mode is "one shot", which means each run is doing the 
task once. The result is the runtime in seconds. 

{% asset_img populateParallelOnce-1-notitle.svg 'Populate Parallel Once' benchmark result for one thread %}

{% asset_img populateParallelOnce-2-notitle.svg 'Populate Parallel Once' benchmark result for two threads %}

{% asset_img populateParallelOnce-4-notitle.svg 'Populate Parallel Once' benchmark result for four threads %}

### Reference information

- Benchmark source: [PopulateParallelOnceBenchmark.java](https://github.com/cache2k/cache2k-benchmark/blob/master/jmh-suite/src/main/java/org/cache2k/benchmark/jmh/suite/noEviction/symmetrical/PopulateParallelOnceBenchmark.java)
- Raw data (ASCII text table): [populateParallelOnce-1.dat](populateParallelOnce-1.dat), [populateParallelOnce-2.dat](populateParallelOnce-2.dat), [populateParallelOnce-4.dat](populateParallelOnce-4.dat)  

### Notes

For the caches, cache2k does best on insert on a single thread. That is a little surprising, since Caffeine actually
 utilizes more threads internally to do its work, while cache2k does not. For two threads the runtime of cache2k doubles,
 because there is a lock contention and I did nothing to optimize for this scenario but cache2k performs better
 then Guava and only a little worse then Caffeine. Only Caffeine profits a little from the additional thread.

The four thread result is missing for Caffeine, since there was a VM crash with an out of memory problem on
one test run.

Generally the four thread result isn't much different from the two thread result, since it is only a 2 core machine.
I expected a far better result for the hyperthreaded cores.

### Methodology Critique

The idea of the benchmark is to get an isolated performance value for inserting entries into a cache. JMH does
multiple iterations and starts with some warmup iteration before doing the iterations that count for the result.
After each iteration the cache content is disposed and a new cache is created.
That means the GC of the previous cache content will influence the performance result. For better isolation we should
force the GC outside the measure time interval.

## Benchmark 2: Memory Consumption

We use the benchmark above and measure the consumed Java heap space. After each benchmark iteration, a garbage collection 
is done and the used memory in the heap is recorded.

{% asset_img populateParallelOnce-memory-notitle.svg Heap memory consumption after inserting %}

### Reference information

- Raw data (ASCII text table): [populateParallelOnce-memory.dat](populateParallelOnce-memory.dat)

### Notes

cache2k and Guava have the lowest measured memory consumption. Of course CHM has a lower memory consumption because
 it is not a real cache and doesn't need the extra overhead for it. Please keep in mind that this is the
 memory consumption for this specific benchmark only, you cannot say anything general, yet. Things will look different
 if expiry is enabled or after some eviction took place.

## Benchmark 3: Read Only

 This benchmark populates the cache with 100k entries. The workload is accessing entries in a random pattern
 with different hit rates. The main goal is to check how different hit rations influence the 
 throughput.

{% asset_img readOnly-notitle.svg 'Read Only' benchmark result for 1, 2 and 4 threads and 100, 50 and 33 percent hit ratio %}

### Reference information

- Benchmark source: [ReadOnlyBenchmark.java](https://github.com/cache2k/cache2k-benchmark/blob/master/jmh-suite/src/main/java/org/cache2k/benchmark/jmh/suite/noEviction/symmetrical/ReadOnlyBenchmark.java)
- Raw data (ASCII text table): [readOnly.dat](readOnly.dat)  

### Notes

Honestly, this is a good example on how not to do charts, since I squeezed three different aspects into it: products, 
threads and the hit ratio.

Of course, CHM does best. For the caches, single thread performance of cache2k is superior. For two threads Caffeine
is better in case the hit rate is 50% or 33%. For all thread counts the cache2k throughput is better then half of CHMs
throughput for 100% hitrate.

## Benchmark 4: Combined Read/Write

Three benchmarks. "ro" doing reads only in 8 threads, "rw" doing reads and writes in 6 and 2 threads, "wo" doing writes 
in 8 threads. The cache is populated in advance  with the test data set. No eviction and no inserts happen during the 
benchmark time. The test data size is 11k, the cache size 32k. This benchmark is almost identical to the one in caffeine.

{% asset_img combinedReadWrite-notitle.svg 'Combined Read/Write' %}

### Reference information

- Benchmark source: [CombinedReadWriteBenchmark.java](https://github.com/cache2k/cache2k-benchmark/blob/master/jmh-suite/src/main/java/org/cache2k/benchmark/jmh/suite/noEviction/asymmetrical/CombinedReadWriteBenchmark.java)
- Raw data (ASCII text table): [combinedReadWrite.dat](combinedReadWrite.dat)  

### Notes

For read only and mostly read scenarios cache2k has the best performance. There is a big drop for concurrent writes
 to cache2k.

## How to Reproduce

If you want to reproduce the values or want to do your own benchmarks on your favorite server hardware. Do it!
 You'll find the current stuff at: [cache2k-benchmark GitHub page](https://github.com/cache2k/cache2k-benchmark)

````
git clone https://github.com/headissue/cache2k-benchmark.git
git checkout 27634762258f2d4dd2abca81f5807ec9ecd73239
cd cache2k-benchmark

mvn -DskipTests pacakge

# this runs the benchmark suite (takes at least 6 hours, for only a quick check use --quick)
bash jmh-run.sh

# plot the graphs
bash processJmhResult.sh process
````

The results will be written to: `target/jmh-result`.

The raw json data of this benchmark is here: [data.json.gz](data.json.gz).

## Lessons Learned

Some final thoughts on what we already learned from the first batch of benchmarks.

### Simple Benchmarks, but some Interesting Results

The benchmarks are not sufficient to get an idea of how real world applications will behave. But only concentrating
on these few benchmarks lead to some interesting insights. Learned: Concentrate on a few things, do it correctly and 
be surprised what you find with a "little" afford.

### Lost in Variations

With all variables we have now (cache vendors, cache sizes and threads) it is a total of 119 benchmark runs. 
Doing 5 warmup and 5 measure iterations of 20 seconds each leads to a total runtime of 6 hours. Well, but this is 
only the beginning of some thorough cache benchmarks. We want to check more cache implementations, more benchmark 
scenarios, different VMs and  VM parameters.

So we need to be very careful about what we want to benchmark. We will probably end up with benchmark times of several
days.

### Don't do Benchmarks on Your Notebook

For a serious evaluation on how well a cache behaves in multi threaded contexts we need more cores. For a stable 
benchmark hardware we should have at least 4 cores. Doing benchmarks about what
cache will work better with hyperthreading is not really a worthy goal.

### Threads, Cores and CPU Utilization

I am still not happy with the measurement of different thread counts. Doing the benchmarks with different threads
gives us an idea how well a cache behaves for concurrent requests. But, this can be misinterpreted. Since a cache
may use additional threads to do its work, benchmarking with one thread doesn't mean that only a single CPU core
was utilized.

If we expect to know from a benchmark how fast something will be for a fixed set of resources, the benchmarks with 
varying threads are all wrong. 

### cache2k does well

Since I am the author of cache2k and the benchmarks, this won't be a surprise for the reader. But, it is a surprise
to me. I didn't select nice benchmarks for cache2k on purpose nor I did tune cache2k for these benchmarks

## Next on this Channel

Stand by for some more updates in the next weeks, which will feature:

 - Benchmarks with a new cache2k version
 - Benchmarks with eviction
 - single threaded benchmarks with different hash table implementations
 - use some reasonable and stable hardware
 - taking a look on memory and thread resources

## Join the Fun!
   
My own primary target is to see where cache2k can improve. But, OTOH, the benchmarks are useful for
other caching vendors and caching users, too.

If you like to contribute, you are welcome! There are a lot of tiny things, that can be done:
  
  - Add more cache vendors
  - Add JSR107 based benchmark(s)
  - Add more benchmark scenarios
  - Make some nicer charts with D3?!
  - provide CPU time on recent multi processor hardware

Before starting working on a topic, please open and/or check the issue tracker at
 [cache2k-benchmark](https://github.com/cache2k/cache2k-benchmark)