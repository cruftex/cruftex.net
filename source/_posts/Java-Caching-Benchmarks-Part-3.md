title: Java Caching Benchmarks Part 3 - The Finals
tags:
  - Java
  - caching
  - cache2k
  - benchmark
date: 2017-09-01 18:07:11
---


In the third article about caching libraries benchmarking it is finally time for a benchmark
scenario which stresses the caches in different aspects. Also, we will analyze if the different approaches to eviction in cache2k have any negative effects and if their implementation is robust and is of production quality (spoiler: yes, it is!).
 
<!-- more -->

Impatient readers can skip to the [Conclusion](#Conclusion).

In the rest of the article below points are discussed:

•	Two benchmark scenarios which use different cache eviction algorithms.

•	Memory consumption and comparison between size of jar files for different implementations.

<!-- toc -->

## Benchmark Setup

Benchmark code is available at GitHub project [cache2k benchmark](https://github.com/cache2k/cache2k-benchmark)

### Environment
  
  - JDK: Oracle Version JDK 1.8.0_131, VM 25.131-b11
  - JVM flags: `-server -Xmx10G -XX:BiasedLockingStartupDelay=0` (with and without `-XX:+UseG1GC`)
  - JMH Version: 1.18 
  - CPU: Intel(R) Xeon(R) CPU E3-1240 v5 @ 3.50GHz, 4 physical cores
  - CPU L1 cache: 4 x 32 KB 8-way set associative instruction caches, 4 x 32 KB 8-way set associative data caches
  - CPU L2 cache: 4 x 256 KB 4-way set associative caches
  - CPU L3 cache: 8 MB 16-way set associative shared cache
  - RAM: 32GB total, 2x16GB DRR4 at 2133 MHz
  - OS: Ubuntu 14.04
  - Kernel: 4.4.0-57-generic
  
### Compared Caches and Versions

We will compare cache2k with these 'cache' implementations:

  - Google Guava Cache, Version 20
  - Caffeine, Version 2.5.2
  - [cache2k](https://cache2k.org), Version 1.0.0.Final
  - EHCache, Version 2.10.3
  
### JMH Setup

The JMH command line arguments `-f 2 -wi 5 -w 30s -i 3 -r 30s` result in:
 
 - Forks: 2 (2 runs in a newly started JVM)
 - Warmup: 5 iterations, 30 seconds each
 - Measurement: 3 iterations, 30 seconds each
 
Five warmup iterations with 30 seconds each lead to 2:30 minutes warmup. Longer warmup is needed especially 
for the benchmark runs with large heap sizes (10M cache entries) to allow garbage collector to adapt and have 
steadier behavior. 

### Threads and Cores

Number of threads are equal to the number of cores available in the JVM. To disable cores we can use the 
Linux CPU hotplug feature. This way only enabled processors are exposed by the OS and output of 
the Java method `Runtime.getRuntime().availableProcessors()` is equal to the number of usable physical 
processor cores. No hyper threading is in effect.

### Plots Units and Confidence

In below plots measuring units are in SI (base 10) which means 1MB is 10^6 bytes. This ensures measurement units
for operations/s and bytes/s are same. 

Every bar chart has a confidence interval associated with it. This interval does not just represent the upper and 
lower bounds of a measured value, but it shows a range of potential values. Confidence interval is 
calculated by JMH with a level of 99.9% (which means likelihood that the actual value is between the 
shown interval is 99.9%). 



## A Comprehensive Benchmark

[Part 1](https://cruftex.net/2016/03/16/Java-Caching-Benchmarks-2016-Part-1.html) of the series was focused on comparing cache
implementations to hashmaps in which case test scenario did not trigger the eviction while  [Part 2 ](https://cruftex.net/2016/05/09/Java-Caching-Benchmarks-2016-Part-2.html) was focused on benchmarking different eviction algorithms. Both benchmarks were designed to test two different aspects of caching in isolation and they have given interesting insights in detailed aspects.

However, outcome may be totally different in other scenarios such as if concurrent threads utilize the eviction algorithm as opposed to only one thread as in Part 2.
  
We have combined few such aspects into one benchmark:

- A skewed access pattern via the Zipfian distribution to utilize the cache eviction algorithm
- Different key space sizes, yielding different hit rates 
- A cache miss gets significant penalty by burning a defined amount of CPU cycles 
- Read through operation which is commonly used, but may result in additional blocking overhead

Access pattern is artificially generated via the so-called Zipfian distribution. This access pattern represents simulation 
of a skewed sequence typically found in applications these days. The Zipfian distribution is widely used for 
benchmarking key/value stores. The algorithm was originally described in ["Quickly Generating Billion-Record Synthetic Databases", Jim Gray et al, SIGMOD 1994](http://dl.acm.org/citation.cfm?doid=191839.191886).
 
 
In few other cache benchmarks, access sequence and key objects are calculated in advance because of which the benchmark 
only covers the performance of cache access. This approach is tested in different variations but showed to be problematic
in few cases. If the sequence is too small, eviction algorithms can adapt to it and show unrealistic high hit rates. 
Furthermore, a separate sequence is needed for each thread. To avoid any adapting effects on the repetition, the sequences 
must be much longer then the cache size. Big cache sizes are like 10 million entries in the benchmark which is not feasible. 
The best solution proved to be for this is the online generation of the access sequence. The Zipfian generator implementation 
from the Yahoo! YCSB benchmark was improved for a fast and slow overhead generation by replacing the used random number generator by the fast-random sequence generator `XorShift1024StarRandomGenerator` of the [DSI utilities](http://dsiutils.di.unimi.it/). This means, 
the sequence generation and the creation of the integer objects for the cache keys is included in the performance measurements.

 
The Zipfian sequence is used in variations to yield different cache hit rates. Zipfian factor 10 signifies generation of a 
key number space 10 times bigger then the cache size. A certain Zipfian factor yields approximately the same hit rate for 
different cache sizes.

Cache operates in read through mode. A cache miss gives a call to a cache loader, which adds a penalty by burning CPU cycles 
via JMH’s black hole: `Blackhole.consumeCPU(1000)`. Other benchmarks use `Thread.sleep(10)` (or something similar)
to sleep for 10 milliseconds and simulate I/O latency. Using Thread.sleep() for such small time may result in inconsistency. 
Such code would be impacted by the operating system scheduler.

Benchmark source file: [ZipfianSequenceLoadingBenchmark.java](https://github.com/cache2k/cache2k-benchmark/blob/e4cd7a8c491bf275545b3003932c2eebb69606e9/jmh-suite/src/main/java/org/cache2k/benchmark/jmh/suite/eviction/symmetrical/ZipfianSequenceLoadingBenchmark.java).

{% asset_img CMS/ZipfianSequenceLoadingBenchmark-bySize-4x10-notitle.svg 'ZipfianSequenceLoadingBenchmark, operations per second by cache size at 4 threads and Zipfian factor 10' %}

For the above graph [Alternative Image](CMS/ZipfianSequenceLoadingBenchmark-bySize-4x10-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmark-bySize-4x10.dat) is available. 

CPU profiling with a cache size of 1M and Zipfian factor 10, 4 threads and cache2k shows that 35% of the CPU cycles are 
spent in black hole. If this time is used for loader, hit rates of cache implementations would improve. As explained before, 
the throughput is also determined by the speed of the random number generator. Benchmarking the random number generator and the generation of the integer keys alone, results in 23 million operations per second for the CMS collector and 13 million operations 
per second for the G1 collector. Interpreting the graph and concluding that the fastest cache is about 50% faster than its 
competitor would be wrong (cache2k vs. Caffeine with 100K entries), since the benchmark code itself has a significant overhead. Comparing only the time spent in the cache code, performance difference would be bigger.

Let's look at the achieved hit rates: 

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-bySize-4x10-notitle.svg 'ZipfianSequenceLoadingBenchmark, effective hit rate by cache size at 4 threads and Zipfian factor 10' %}

For the above graph [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-bySize-4x10-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-bySize-4x10.dat) is available. 

Caffeine and cache2k have significantly higher hit rates by about 4%, cache2k is slightly better than Caffeine by about 0.15%.

Another benchmark is analyzed with different number of threads and CPU cores. As explained earlier, number of available CPU cores is equal to the number of benchmark threads. 

Let's look at the results for one, two and four cores:

{% asset_img CMS/ZipfianSequenceLoadingBenchmark-byThread-1Mx10-notitle.svg 'ZipfianSequenceLoadingBenchmark, operations per second by thread count with cache size 1M and Zipfian factor 10' %}

For the above graph [Alternative Image](CMS/ZipfianSequenceLoadingBenchmark-byThread-1Mx10-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmark-byThread-1Mx10.dat) is available. 

EHCache2 does not scale well in this scenario with the additional cores, which is probably caused due to additional locking overhead in the blocking read through configuration. 

Caffeine has low performance with one or two cores but better performance with four cores. This is most likely caused due to the fact that Caffeine uses multiple threads for the eviction. With one or a few cores available the inter thread communication produces overhead and causes delay.

By varying the size of Zipfian distribution we can yield different hit rates. Below chart shows the performance with different Zipfian factors:

{% asset_img CMS/ZipfianSequenceLoadingBenchmark-byFactor-1M-4-notitle.svg 'ZipfianSequenceLoadingBenchmark, operations per second by Zipfian factor with cache size 1M at 4 threads' %}

For the above graph [Alternative Image](CMS/ZipfianSequenceLoadingBenchmark-byFactor-1M-4-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmark-byFactor-1M-4.dat) is available. 

The corresponding effective hit rates per cache are:

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-byFactor-1M-4-notitle.svg 'ZipfianSequenceLoadingBenchmark, effective hit rate by Zipfian factor with cache size 1M at 4 threads' %}

For the above graph [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-byFactor-1M-4-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-byFactor-1M-4.dat) is available. 

cache2k is optimized in such a way that there will be minimal overhead at high hit rates. Few processes are delayed by maximum possible time until eviction. That's why the relative advantage of cache2k becomes lesser for lower hit rates.
 
We also analyazed another benchmark run with the new G1 collector. Let's look at the first statistic with different collector implementation:
 
{% asset_img G1/ZipfianSequenceLoadingBenchmark-bySize-4x10-notitle.svg 'ZipfianSequenceLoadingBenchmark, operations per second by cache size at 4 threads and Zipfian factor 10 and G1 collector' %}

For the above graph [Alternative Image](G1/ZipfianSequenceLoadingBenchmark-bySize-4x10-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmark-bySize-4x10.dat) is available. 

With a cache size of around 1M entries cache2k highly profits from its low allocation rates. All other cache implementations have a higher allocation rate resulting in lower throughput. With cache size of 10M cache2k and Guava face higher loss because with this cache size these two cache implementations cause more work with G1 than other implementations. In the next benchmark, this impact becomes even more visible.

## Worst Case Eviction Performance

As cache2k uses eviction algorithm, which may have different performance outcomes depending on the access sequence. We
will analyze another benchmark to check the most unfavorable working conditions. This is to make sure that there are no
unexpected drawbacks when used in varying production scenarios.

cache2k uses the eviction algorithm Clock-Pro (described in 
[USENIX'05: "CLOCK-Pro: An Effective Improvement of the CLOCK Replacement"](http://www.ece.eng.wayne.edu/~sjiang/pubs/papers/jiang05_CLOCK-Pro.pdf), 
which scans through a circular list of entries (the clock) for an eviction candidate. This algorithm has a theoretical worst case performance of O(n), which means eviction performance will decrease linearly with the number of cached items. cache2k incorporates 
below changes to improve eviction efficiency and worst case runtime:
 
- A reference counter is used instead of a reference bit
- Adaptive threshold based on the access frequency is used to search for an eviction candidate
- Separate clocks are used for hot and cold and the entry order in the hot working set is reshuffled according to the recent reference
 
{% asset_img clocks.svg 'Improved Clock-Pro eviction using two separate clocks' %}
 
Nevertheless, the question of theoretical categorization of O(n) remains. However, the theoretical big-O notation means there is 
no mathematical proof that the worst case performance is in a better big-O category. Theory gives us an indication that 
the worst case performance may be a problem, so how does it practically look like? Let's quote Richard P. Feynman: 
_It doesn't matter how beautiful your theory is, it doesn't matter how smart you are. If it doesn't agree 
with experiment, it's wrong._ One prominent example where the theoretical performance does not match with 
practical performance is the QuickSort algorithm, as discussed in 
[Why is quicksort better than mergesort?](http://stackoverflow.com/questions/70402/why-is-quicksort-better-than-mergesort)

To simulate a worst case scenario we use a random access pattern. Because of the uniform distribution across the key
space, cache2k with Clock-Pro will need a longer scan to find a good eviction candidate. While there can be
artificially constructed sequences for a known cache size and internal tuning parameters which might trigger 
even longer scans, we believe that random sequence yields the worst eviction performance that can be observed 
in practice.

Besides evaluating the behavior of cache2k, a benchmark with a random pattern can be used to verify that caches
have a comparable eviction policies. When the size parameter is honored correctly all caches are expected 
to produce the same hit rate.
 
Similar to the benchmark described before, the access sequence is generated by a separate random generator per thread. Fast random sequence generator `XorShift1024StarRandomGenerator` of the [DSI utilities](http://dsiutils.di.unimi.it/) is used for the purpose.
In this case a cache miss gets no extra penalty. As the effective hit rate is identical across cache 
implementations, the penalty would change the performance result by a constant factor. So in this benchmark, the performance 
is solely determined by the sequence generator and the cache operations.

{% asset_img CMS/RandomSequenceBenchmark-byHitrate-4-1M-notitle.svg 'RandomSequenceBenchmark, operations per second by hit rate at 4 threads and 1M cache size' %}
For the above graph [Alternative Image](CMS/RandomSequenceBenchmark-byHitrate-4-1M-notitle-print.svg) and [Raw Data](CMS/RandomSequenceBenchmark-byHitrate-4-1M.dat) is available. 

Let's also verify if the effective hit rate is on the same level:

{% asset_img CMS/RandomSequenceBenchmarkEffectiveHitrate-byHitrate-4-1M-notitle.svg 'RandomSequenceBenchmark, effective hit rate by thread count at 4 threads and 1M cache size' %}
For the above graph [Alternative Image](CMS/RandomSequenceBenchmarkEffectiveHitrate-byHitrate-4-1M-notitle-print.svg) and [Raw Data](CMS/RandomSequenceBenchmarkEffectiveHitrate-byHitrate-4-1M.dat) is available. 

To see how the cache size impacts the performance, let's look at different cache sizes with constant thread count and hit rate:

{% asset_img CMS/RandomSequenceBenchmark-bySize-4x50-notitle.svg 'RandomSequenceBenchmark, operations per second by cache size at 4 threads and 50 percent target hit rate' %}
For the above graph there is an [Alternative Image](CMS/RandomSequenceBenchmark-bySize-4x50-notitle-print.svg) and [Raw Data](CMS/RandomSequenceBenchmark-bySize-4x50.dat) is available. 

As we can see, the performance of cache2k is similar to other cache implementations when the cache size is increased.

We also analyzed a benchmark run with the new G1 garbage collector:

{% asset_img G1/RandomSequenceBenchmark-bySize-4x50-notitle.svg 'RandomSequenceBenchmark, operations per second by cache size at 4 threads and 50 percent target hit rate with G1 collector' %}

For the above graph [Alternative Image](G1/RandomSequenceBenchmark-bySize-4x50-notitle-print.svg) and [Raw Data](G1/RandomSequenceBenchmark-bySize-4x50.dat) is available. 

With the new G1 collector all cache implementations show significantly reduced performance, when cache sizes are increased. 
The implementations cache2k and the Google Guava cache have a even higher performance drop for G1. Doing CPU profiling 
with cache2k reveals that 30-40% of the CPU time is spent in refinement tasks of G1 which is caused by inter region
reference updates. This benchmark shows that throughput oriented applications with lots of reference mutations and 
larger heaps, should not choose the G1 collector. The effects of G1 with large cache sizes need to undergo a 
deeper analysis in case this becomes more relevant in practice.

This is an extreme test scenario to reveal limits of cache2k. We unintentionally constructed a scenario where the use of 
G1 collector has rather big performance loss. 10 million entries and a cache operating at a hit rate of 50% would
be a rare operating condition. Most likely this can be found in throughput oriented applications which should better
choose the CMS collector. With normal working conditions as we have shown above, cache2k achieves 
a performance gain with G1 as compared to other cache libraries. 


## Average Items Scanned in Clock-Pro

As explained above cache2k uses the Clock-Pro algorithm, which scans the cache entries organized in a 
circular data structure to select the best entry to evict. There is no upper bound in the number of 
scanned entries in cache2k. In this chapter we investigate how the scan effort changes with the cache 
size.
 
When cache parameters are known, there is a theoretical chance to construct the artificial access 
pattern that triggers a full scan over all entries. Such access pattern could be a vector for 
DOS-attacks. But after full scan, all access counters are zeroed, the attack sequence 
needs to be repeated and all cached entries need to be covered. The costs of sending and processing the attack 
sequence would thus be much higher than the caused damage.

Using the internal counters of cache2k, we can extract average number of entries scanned per eviction. 
This allows us to get an insight into  different eviction costs at different working
conditions. Let's look at how different cache sizes affect the number scans:

{% asset_img CMS/RandomSequenceBenchmarkScanCount-bySize-4x80-notitle.svg 'RandomSequenceBenchmark, scan count by cache size at 4 threads and 80 percent target hit rate' %}

For the above graph [Alternative Image](CMS/RandomSequenceBenchmarkScanCount-bySize-4x80-notitle-print.svg) and [Raw Data](CMS/RandomSequenceBenchmarkScanCount-bySize-4x80.dat) is available. 

The results are rather surprising. Scan counts are almost equal for same hit rates for any cache size. 
Raw values for reference:
  
- Size 100K: 6.003983263650306
- Size 1M: 6.004637918679662
- Size 10M: 6.004827089682682

The modified Clock-Pro algorithm in cache2k works well, for a worst case access sequence the scan 
count does not increase significantly when the cache becomes bigger.

For different hit rates the scan counts look like:

{% asset_img CMS/RandomSequenceBenchmarkScanCount-byHitrate-4x1M-notitle.svg 'RandomSequenceBenchmark, scan count by hit rate at 4 threads and 1M cache size' %}

For the above graph [Alternative Image](CMS/RandomSequenceBenchmarkScanCount-byHitrate-4x1M-notitle-print.svg) and [Raw Data](CMS/RandomSequenceBenchmarkScanCount-byHitrate-4x1M.dat) is available. 

The scan count increases for higher hit rates because all the cache contents become 'hotter'. The amount of additional scanning 
when hit rates become higher can be tuned by some internal parameters. As we can see with this benchmark, the tuning parameters are chosen in a way that additional scanning work in the eviction, does not outweigh the performance gains of the improved hit rate.
With high hit rates cache2k has still less overhead than other cache libraries.

Finally, we will take a look at the scan counts for the first benchmark:

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkScanCount-bySize-4x10-notitle.svg 'ZipfianSequenceLoadingBenchmark, scan count by cache size at 4 threads and Zipfian factor 10' %}

For the above graph [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkScanCount-bySize-4x10-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkScanCount-bySize-4x10.dat) is available. 

For a typical skewed access sequence the average scan count is very low. In tested scenarios it is
below two. For realistic (non-random) access sequences, experiment shows that the scan count 
decreases for higher cache sizes. Result of this practical scenario is in contradiction to the theoretical evaluation.



## Memory Consumption

For evaluation of the memory consumptions we use the first benchmark (`ZipfianSequenceLoadingBenchmark`). 
The details of metrics and measurement procedure were presented in a previous blog post 
[The 6 Memory Metrics You Should Track in Your Java Benchmarks](https://cruftex.net/2017/03/28/The-6-Memory-Metrics-You-Should-Track-in-Your-Java-Benchmarks.html).
For concision we concentrate on two metrics only. *usedMem_settled* represents used memory 
that the JVM reports at the end of the benchmark. This is a static measure and does not take into 
account differences in usage when operations are ongoing. The *VmHWM* metric represents peak memory 
consumption as reported by the operating system, thus it also includs dynamic effects like garbage collection.

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-10M-5-notitle.svg 'ZipfianSequenceLoadingBenchmark, memory consumption with 10M cache size at 4 threads and Zipfian factor 5' %}

For the above graph [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-10M-5-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-10M-5.dat) is available. 

In the tested scenario cache2k has 11% higher static memory consumption then Caffeine. In this scenario 
the payload data (keys and values) is only integer objects. With larger data sizes in practical applications, 
the difference in static memory consumption between the cache implementations would be much lower.

The peak memory consumption differs more drastically. Cache2k achieves a lower peak memory consumption because of its 
low allocation rates which leads to less garbage collector activity. Depending on the cache utilization, cache size
and hit rates, the total memory consumption will differ. Here is a rather extreme case example with the G1 collector:

{% asset_img G1/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-1M-5-notitle.svg 'ZipfianSequenceLoadingBenchmark, memory consumption with 1M cache size at 4 threads and Zipfian factor 20' %}

For the above graph [Alternative Image](G1/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-1M-5-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-1M-5.dat) is available. 

Interesting side note: Since cache eviction produces garbage, increasing the cache size could have a 
dramatic effect on the peak memory consumption and can actually lower the amount of needed memory, as less garbage collector needs less breathing space. 

Only the static used heap memory can give the wrong idea about the actual used physical memory in operation.  

## Jar File Sizes

Finally let's look at the jar file sizes:

- caffeine-2.5.2.jar: 1.007.339 bytes
- cache2k-all-1.0.0.Final.jar: 387.771 bytes
- cache2k-api-1.0.0.Final.jar + cache2k-core-1.0.0.Final.jar: 321.816 bytes
- ehcache-core-2.10.3.jar: 1.386.653 bytes
- guava-20.0.jar: 2.442625 bytes
- guava cache only alternative: com.nytimes.android:cache-2.0.3.jar: 160.474 bytes

For Guava cache users who don't need the whole Guava library, New York Times has provided a jar file which contains only
the cache functionality. For Android or other environments where download size matters Guava and 
cache2k are the best choices. Compared to other features the Caffeine jar is rather big due to high number of generated classes.


 
## Benchmark Shortcomings
 
All of our benchmark scenarios intentionally stress the cache heavily to amplify differences in the 
cache implementations and reveal weaknesses. The outcome in real applications will be much better. 

Here is a summary of noteworthy points that may influence the real world performance:

- The value and key in the benchmark is only an integer object. Larger and more complex objects, will 
  lead to higher allocation rates. The overhead in the internal data structures of the cache becomes 
  less significant.
- Different latency and CPU cycles for loading a cache value
- CPU time used by the application
- Interactive or throughput oriented workload
- Selected garbage collector and its tuning values
- forced full GC between iterations may influence benchmark results
- A real world access sequence is different to the Zipfian sequence

The last point cannot be stressed enough. Testing with the Zipfian distribution is heavily in favor of 
caches which keep frequently used entries for longer time(frequency aspect). As the access pattern is always
in same value range, a cache could actually stop replacing entries after a set of hot entries is
established. Next benchmarks should modify the value ranges to test the speed of adaption e.g. in a phase
change of the application.

Running all benchmarks with CMS and G1 collector with the needed precision takes four days on one machine.
Especially the large cache size of 10M needs longer benchmark run times. Because of the time required for run, we could only
test three variations of thread counts, cache size and hit rate each.



## Future Work

A lot of work went into this blog post and at this point it is important to publish results rather than to
 continue digging deeper. This is what we left for the future:

- Use a sweeping Zipfian sequence, to test adaption speed (see above) 
- Benchmarks with higher number of cores/threads
- Benchmark with latency
- Clock-Pro eviction: Analyze/compare the scan counts with the original algorithm
- Clock-Pro eviction: Deeper analysis of worst case patterns close to 100% hit rate
- Clock-Pro eviction: Capping the eviction scans will reduce computing cost for random access patterns
- Deeper analysis of the interaction with G1 e.g. benchmark runs with a finer variation of cache sizes
- Improve cache2k eviction for the G1 collector
- In general caching and GC interaction is worth further research  e.g. analyze balance between cache 
  size and GC activity 


## Conclusion

Cache2k uses an alternative eviction algorithm (Clock-Pro) that reduces the latency overhead of the cache access
to a minimum. After analyzing the benchmark results we can see that cache2k has better performance than other caches
when operating at high hit rates, approximately above 80%. With lower hit rates which cause more eviction activity, 
the performance of cache2k is at least on the same level than other cache implementations.

Since the Clock-Pro algorithm eviction runtime could theoretically grow linear with the cache size, cache2k shows 
improvements over the original algorithm. Our experiments have proven that the implementation performance is stable in the worst 
possible scenarios. Because of this intensive testing we can say that the implementation has production quality.
 
As the achieved hit rates show, Caffeine and cache2k use both an effective and modern eviction algorithm that
performs better than LRU for the Zipfian sequence. 

Because of its low allocation rates, cache2k performs better with the upcoming G1 garbage collector than other 
caches in typical working conditions. 

The memory overhead differs for each cache implementation. When compared to Guava or Caffeine, cache2k has 
slightly more static memory overhead. However, in high throughput scenarios cache2k can achieve a much lower 
total memory consumption because of its low allocation rates.

