title: Java Caching Benchmarks Part 3 - The Finals
tags:
  - Java
  - caching
  - cache2k
  - benchmark
date: 2017-09-01 18:07:11
---


In the third article about caching libraries benchmarking it is finally time for a benchmark
scenario which stresses the caches in different aspects. Besides that, we take a look whether the different 
approach to eviction in cache2k has any negative effects and whether the implementation is robust and 
has production quality (spoiler: yes, it is!).
 
<!-- more -->

The impatient reader can skip to the [Conclusion](#Conclusion). The rest of the article is organized as follows:
We present two different benchmark scenarios to utilize the different cache eviction algorithms, then we take a
look at the memory consumption and compare the Jar file sizes of the different implementations.

<!-- toc -->

## Benchmark Setup

The benchmark code is available at the GitHub project [cache2k benchmark](https://github.com/cache2k/cache2k-benchmark)

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

We use these "cache" implementations:

  - Google Guava Cache, Version 20
  - Caffeine, Version 2.5.2
  - [cache2k](https://cache2k.org), Version 1.0.0.Final
  - EHCache, Version 2.10.3
  
### JMH Setup

The JMH command line arguments are: `-f 2 -wi 5 -w 30s -i 3 -r 30s` which results in:
 
 - Forks: 2 (meaning 2 runs in a newly started JVM)
 - Warmup: 5 iterations, 30 seconds each
 - Measurement: 3 iterations, 30 seconds each
 
The five warmup iterations with 30 seconds each lead to 2:30 minutes warmup. The long warmup is
needed especially for the benchmark runs with large heap sizes (10M cache entries) to allow the
garbage collector to adapt and have a more steadily behavior. 

### Threads and Cores

The number of threads equals the number of cores available to the JVM. To disable cores we use the 
Linux CPU hotplug feature. This way only the enabled processors are exposed by the OS and the 
Java method `Runtime.getRuntime().availableProcessors()` is identical to the number of usable physical 
processor cores. No hyper threading is in effect.

### Plots Units and Confidence

In the plots below units are in SI (base 10), meaning 1MB is 10^6 bytes. This way the unit prefixes
for operations/s and bytes/s are identical. 

Every bar is plotted with a confidence interval. The interval does not represent  the upper and 
lower bounds of a measured value, but it is much more sensitive. The confidence interval is 
calculated by JMH with a level of 99.9%. This means, the likelihood that the value is between the 
shown interval is 99.9%. 



## Altogether Now: A Comprehensive Benchmark

In [Part 1](https://cruftex.net/2016/03/16/Java-Caching-Benchmarks-2016-Part-1.html) we focused on comparing cache
implementations to hash maps, which means the test scenario did not trigger the eviction. In 
[Part 2](https://cruftex.net/2016/05/09/Java-Caching-Benchmarks-2016-Part-2.html) we focused on benchmarking
the different eviction algorithms. Both benchmarks were designed to test two aspects of caching in isolation. This gives
 interesting insights in detailed aspects, however, the outcome may be totally different in 
 other scenarios. For example, the eviction algorithm in Part 2 is only utilized by one thread and a cache 
 implementation may react different when called by concurrent threads. 
 
We combine the different aspects into one benchmark:

- A skewed access pattern via the Zipfian distribution to utilize the cache eviction algorithm
- Different key space sizes, yielding different hit rates 
- A cache miss gets significant penalty by burning a defined amount of CPU cycles 
- Read through operation, which is used commonly, but may result in additional blocking overhead

The access pattern is artificially generated via the so called Zipfian distribution. This
represents the simulation of a skewed sequence typically found in applications today. The Zipfian distribution
 is widely used for benchmarking key/value stores. The generation algorithm was originally described in
 ["Quickly Generating Billion-Record Synthetic Databases", Jim Gray et al, SIGMOD 1994](http://dl.acm.org/citation.cfm?doid=191839.191886).
 
 
In some other cache benchmarks, the access sequence and key objects are calculated in advance.
This way the benchmark only covers the performance of the cache access itself. This approach was tested in 
different variations, but showed to be problematic. If the sequence is to small, eviction algorithms can adapt to it and show unrealistic high hit rates. Furthermore, 
a separate sequence is needed for each thread. To avoid any adapting effects on the repetition the sequences
must be much longer then the cache size. For big cache sizes, like the 10 million entries used in the benchmark, 
this is not feasible. The best solution proved to be an online generation of the access sequence. 
The Zipfian generator implementation from the Yahoo! YCSB benchmark was improved for a fast and 
low overhead generation by replacing the used random number generator. The fast random sequence 
generator `XorShift1024StarRandomGenerator` of the [DSI utilities](http://dsiutils.di.unimi.it/) is used.
This means, the sequence generation and the creation of the integer objects for the cache keys is included in the 
performance measurements.

 
The Zipfian sequence is used in variations to yield different cache hit rates. The Zipfian factor 10 means
the generation of a key number space 10 times bigger then the cache size. A certain Zipfian factor yields
approximately the same hit rate for different cache sizes. 

The cache operates in read through mode. A cache miss causes a call to a cache loader, which adds a penalty by
burning CPU cycles via JMH's black hole: `Blackhole.consumeCPU(1000)`. Other benchmarks use, for example, `Thread.sleep(10)`
to sleep for 10 milliseconds and simulate I/O latency. Sleeping exactly for that small amount of time is 
not working consistently. Such code would be biased by the operating system scheduler.

The benchmark source is in [ZipfianSequenceLoadingBenchmark.java](https://github.com/cache2k/cache2k-benchmark/blob/e4cd7a8c491bf275545b3003932c2eebb69606e9/jmh-suite/src/main/java/org/cache2k/benchmark/jmh/suite/eviction/symmetrical/ZipfianSequenceLoadingBenchmark.java).

{% asset_img CMS/ZipfianSequenceLoadingBenchmark-bySize-4x10-notitle.svg 'ZipfianSequenceLoadingBenchmark, operations per second by cache size at 4 threads and Zipfian factor 10' %}
For the graph above there is an [Alternative Image](CMS/ZipfianSequenceLoadingBenchmark-bySize-4x10-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmark-bySize-4x10.dat) available. 

Doing CPU profiling with a cache size of 1M and Zipfian factor 10 and 4 threads and cache2k, shows that 35% of the CPU cycles are 
spent in the black hole. If more work is done in the loader, cache implementations would benefit differently 
according to their achieved hit rates. As explained before, the throughput is also determined by the speed of the random number generator.
Benchmarking the random number generator and the generation of the integer keys alone, results in 23 million operations per 
second for the CMS collector and 13 million operations per second for the G1 collector. Interpreting the graph and concluding
that the fastest cache is about 50% faster then its competitor is wrong (cache2k vs. Caffeine with 100K entries), since 
the benchmark code itself has a significant overhead. Comparing only the time spent in the cache code, the performance difference would be
bigger.

Let's take also a look at the achieved hit rates: 

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-bySize-4x10-notitle.svg 'ZipfianSequenceLoadingBenchmark, effective hit rate by cache size at 4 threads and Zipfian factor 10' %}
For the graph above there is an [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-bySize-4x10-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-bySize-4x10.dat) available. 

Caffeine and cache2k have significant better hit rates by about 4%, cache2k is slightly better than Caffeine by about 0.15%.

The next benchmark is done with a different number of threads and CPU cores. Es explained above, the number of available CPU cores is identical to the number of
benchmark threads. Let's take a look at the results for one, two and four cores:

{% asset_img CMS/ZipfianSequenceLoadingBenchmark-byThread-1Mx10-notitle.svg 'ZipfianSequenceLoadingBenchmark, operations per second by thread count with cache size 1M and Zipfian factor 10' %}
For the graph above there is an [Alternative Image](CMS/ZipfianSequenceLoadingBenchmark-byThread-1Mx10-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmark-byThread-1Mx10.dat) available. 

EHCache2 does not scale well in this scenario with the additional cores, which is probably caused by the additional locking overhead in the blocking read through configuration. 
Caffeine has low performance with only one or two cores and much better performance with four cores. This is most likely caused by the fact that
Caffeine uses multiple threads for the eviction. When only one or a few cores are available the inter thread communication produces overhead 
and has no benefit.

By varying the size of the Zipfian distribution we can yield different hit rates. Here is the performance with different Zipfian factors:

{% asset_img CMS/ZipfianSequenceLoadingBenchmark-byFactor-1M-4-notitle.svg 'ZipfianSequenceLoadingBenchmark, operations per second by Zipfian factor with cache size 1M at 4 threads' %}
For the graph above there is an [Alternative Image](CMS/ZipfianSequenceLoadingBenchmark-byFactor-1M-4-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmark-byFactor-1M-4.dat) available. 

The corresponding effective hit rates per cache are:

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-byFactor-1M-4-notitle.svg 'ZipfianSequenceLoadingBenchmark, effective hit rate by Zipfian factor with cache size 1M at 4 threads' %}
For the graph above there is an [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-byFactor-1M-4-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkEffectiveHitrate-byFactor-1M-4.dat) available. 

cache2k is optimized for a minimal overhead at high hit rates. Some work is postponed as long as possible until eviction time. 
That's why the relative advantage of cache2k becomes less for lower hit rates.
 
We also did another benchmark run with the new G1 collector. Let's take a look at the first statistic with the different collector implementation:
 
{% asset_img G1/ZipfianSequenceLoadingBenchmark-bySize-4x10-notitle.svg 'ZipfianSequenceLoadingBenchmark, operations per second by cache size at 4 threads and Zipfian factor 10 and G1 collector' %}
For the graph above there is an [Alternative Image](G1/ZipfianSequenceLoadingBenchmark-bySize-4x10-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmark-bySize-4x10.dat) available. 

Around a cache size of 1M entries cache2k highly profits from its low allocation rates. All other cache implementations have a higher allocation rate, resulting in lower throughput. 
At a cache size of 10M we can see that cache2k and Guava have a higher loss. At this size these two cache implementations cause more work with G1 
then other implementations. In the next benchmark, this effect becomes even more visible.

## Worst Case Eviction Performance

Since cache2k has an eviction algorithm, which may have different performance outcomes depending on the access sequence, we
do another benchmark to check the most unfavorable working conditions. This is important to make sure that there are no
unexpected draw backs when used in varying production scenarios.

cache2k uses the eviction algorithm Clock-Pro (described in 
[USENIX'05: "CLOCK-Pro: An Effective Improvement of the CLOCK Replacement"](http://www.ece.eng.wayne.edu/~sjiang/pubs/papers/jiang05_CLOCK-Pro.pdf), 
which scans through a circular list of entries (the clock) for an eviction candidate. This has a theoretical worst case performance of O(n), 
which means eviction performance will decrease linear by the number of cached items. cache2k incorporates 
the following changes to improve eviction efficiency and worst case runtime:
 
- Instead of a reference bit a reference counter is used
- An adaptive threshold based on the access frequency is used to search for an eviction candidate
- Separate clocks for hot and cold are used and the entry order in the hot working set is reshuffled according to the recent reference
 
{% asset_img clocks.svg 'Improved Clock-Pro eviction using two separate clocks' %}
 
Nevertheless, the theoretical categorization of O(n) remains. However, the theoretical big-O notation means there is 
no mathematical proof that the worst case performance is in a better big-O category. Theory gives us an indication that 
the worst case performance may be a problem, so how does it practically look like? Let's quote Richard P. Feynman: 
_It doesn't matter how beautiful your theory is, it doesn't matter how smart you are. If it doesn't agree 
with experiment, it's wrong._ One prominent example where the theoretical performance does not match with 
practical performance is the QuickSort algorithm, as discussed in 
[Why is quicksort better than mergesort?](http://stackoverflow.com/questions/70402/why-is-quicksort-better-than-mergesort)

To simulate a worst case scenario we use a random access pattern. Because of the uniform distribution across the key
space, cache2k with Clock-Pro will need to do a longer scan to find a good eviction candidate. While there can be
artificially constructed sequences for a known cache size and internal tuning parameters that might trigger 
even longer scans, we believe that the random sequence yields the worst eviction performance that can be observed 
in practice.

Besides evaluating the behavior of cache2k, a benchmark with a random pattern can be used to verify that caches
have a comparable eviction policies. When the size parameter is honored correctly all caches are expected 
to produce the identical hit rate.
 
Alike to the benchmark described before, the access sequence is generated by a separate random generator per thread. The
fast random sequence generator `XorShift1024StarRandomGenerator` of the [DSI utilities](http://dsiutils.di.unimi.it/) is used.
This time, a cache miss gets no extra penalty. Since the effective hit rate is identical across cache 
implementations, the penalty would change the performance result by a constant factor. So in this benchmark, the performance 
is solely determined by the sequence generator and the cache operations.

{% asset_img CMS/RandomSequenceBenchmark-byHitrate-4-1M-notitle.svg 'RandomSequenceBenchmark, operations per second by hit rate at 4 threads and 1M cache size' %}
For the graph above there is an [Alternative Image](CMS/RandomSequenceBenchmark-byHitrate-4-1M-notitle-print.svg) and [Raw Data](CMS/RandomSequenceBenchmark-byHitrate-4-1M.dat) available. 

Let's check also, whether the effective hit rate is on the same level:

{% asset_img CMS/RandomSequenceBenchmarkEffectiveHitrate-byHitrate-4-1M-notitle.svg 'RandomSequenceBenchmark, effective hit rate by thread count at 4 threads and 1M cache size' %}
For the graph above there is an [Alternative Image](CMS/RandomSequenceBenchmarkEffectiveHitrate-byHitrate-4-1M-notitle-print.svg) and [Raw Data](CMS/RandomSequenceBenchmarkEffectiveHitrate-byHitrate-4-1M.dat) available. 

To see how the cache size has an effect on the performance, let's take a look at different sizes with constant 
thread count and hit rate:

{% asset_img CMS/RandomSequenceBenchmark-bySize-4x50-notitle.svg 'RandomSequenceBenchmark, operations per second by cache size at 4 threads and 50 percent target hit rate' %}
For the graph above there is an [Alternative Image](CMS/RandomSequenceBenchmark-bySize-4x50-notitle-print.svg) and [Raw Data](CMS/RandomSequenceBenchmark-bySize-4x50.dat) available. 

As we can see, the performance of cache2k is behaving similar to other caches when the cache size grows larger.

We also did a benchmark run with the new G1 garbage collector:

{% asset_img G1/RandomSequenceBenchmark-bySize-4x50-notitle.svg 'RandomSequenceBenchmark, operations per second by cache size at 4 threads and 50 percent target hit rate with G1 collector' %}
For the graph above there is an [Alternative Image](G1/RandomSequenceBenchmark-bySize-4x50-notitle-print.svg) and [Raw Data](G1/RandomSequenceBenchmark-bySize-4x50.dat) available. 

With the new G1 collector all cache implementations have significantly reduced performance, when cache sizes get large. 
The implementations cache2k and the Google Guava cache have a even higher performance drop for G1. Doing CPU profiling 
with cache2k reveals that 30-40% of the CPU time is spent in refinement tasks of G1 which is caused by inter region
reference updates. This benchmark shows that throughput oriented applications with lots of reference mutations and 
large heaps, should not choose the G1 collector. The effects of G1 with large cache sizes need to undergo a 
deeper analysis in case this becomes more relevant in practice.

This is an extreme test scenario to reveal limits. We unintentionally constructed a scenario where the use of the 
G1 collector has a rather big performance loss. 10 million entries and a cache operating at a hit rate of 50% would
be a rare operating condition. Most likely this is found in through put oriented applications which should better
choose the CMS collector. Within more common working conditions, as we have shown above, cache2k achieves 
a performance gain with G1 when compared to other cache libraries. 


## Average Items Scanned in Clock-Pro

As explained above cache2k uses the Clock-Pro algorithm, which scans the cache entries organized in a 
circular data structure to select the best entry to evict. There is no upper bound in the number of 
scanned entries in cache2k. In this chapter we investigate how the scan effort changes with the cache 
size.
 
When cache parameters are known there is a theoretical chance to construct an artificial access 
pattern that triggers a full scan over all entries. Such a access pattern could be a vector for 
DOS-attacks. But after the full scan, all access counters are zeroed and the attack sequence 
needs to be repeated and cover all cached entries. The costs sending and processing the attack 
sequence would thus be much higher then the caused damage.

Using the internal counters of cache2k, we can extract the average number of entries scanned per single eviction. 
This allows us to get insight in the different eviction costs at different working
conditions. Let's take a look how different cache sizes affect the number scans:

{% asset_img CMS/RandomSequenceBenchmarkScanCount-bySize-4x80-notitle.svg 'RandomSequenceBenchmark, scan count by cache size at 4 threads and 80 percent target hit rate' %}
For the graph above there is an [Alternative Image](CMS/RandomSequenceBenchmarkScanCount-bySize-4x80-notitle-print.svg) and [Raw Data](CMS/RandomSequenceBenchmarkScanCount-bySize-4x80.dat) available. 

This result is rather surprising. The scan counts are almost identical for the same hit rates for any cache size. 
For reference the raw values:
  
- Size 100K: 6.003983263650306
- Size 1M: 6.004637918679662
- Size 10M: 6.004827089682682

The modified Clock-Pro algorithm in cache2k works well, for a worst case access sequence the scan 
count does not increase significantly when the cache becomes bigger.

For different hit rates the scan counts look like:

{% asset_img CMS/RandomSequenceBenchmarkScanCount-byHitrate-4x1M-notitle.svg 'RandomSequenceBenchmark, scan count by hit rate at 4 threads and 1M cache size' %}
For the graph above there is an [Alternative Image](CMS/RandomSequenceBenchmarkScanCount-byHitrate-4x1M-notitle-print.svg) and [Raw Data](CMS/RandomSequenceBenchmarkScanCount-byHitrate-4x1M.dat) available. 

The scan count increases for higher hit rates, because all the cache contents become "hotter". 
The amount of additional scanning when hit rates become higher can be tuned by some internal parameters.
As we can show with this benchmark, the tuning parameters are chosen in a way that the additional 
scanning work in the eviction, does not outweigh the performance gains of the improved hit rate.
With high hit rates cache2k has still less overhead then other cache libraries.

Finally, we take a look at the scan counts for the first benchmark:

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkScanCount-bySize-4x10-notitle.svg 'ZipfianSequenceLoadingBenchmark, scan count by cache size at 4 threads and Zipfian factor 10' %}
For the graph above there is an [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkScanCount-bySize-4x10-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkScanCount-bySize-4x10.dat) available. 

For a typical skewed access sequence the average scan count is very low. In the tested scenarios it is
below two. For realistic (means non-random) access sequences the experiment shows that the scan count 
is decreasing for higher cache sizes. This practical result is in contradiction to the theoretical evaluation.



## Memory Consumption

For evaluation of the memory consumptions we use the first benchmark (`ZipfianSequenceLoadingBenchmark`). 
The details of the metrics and measurement procedure were presented in a previous blog post 
[The 6 Memory Metrics You Should Track in Your Java Benchmarks](https://cruftex.net/2017/03/28/The-6-Memory-Metrics-You-Should-Track-in-Your-Java-Benchmarks.html).
For brevity we concentrate on two metrics only. *usedMem_settled* represents the used memory 
that the JVM reports at the end of the benchmark. This is a static measure, and does not take into 
account usage differences when operations are ongoing. The *VmHWM* metric represents the peak memory 
consumption as reported by the operating system, thus also including dynamic effects like garbage collection.

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-10M-5-notitle.svg 'ZipfianSequenceLoadingBenchmark, memory consumption with 10M cache size at 4 threads and Zipfian factor 5' %}
For the graph above there is an [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-10M-5-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-10M-5.dat) available. 

In the tested scenario cache2k has 11% higher static memory consumption then Caffeine. In this scenario 
the payload data (the keys and values) is only integer objects. With larger data sizes in practical applications, 
the difference in static memory consumption between the cache implementations would be much lower.

The peak memory consumption differs more drastically. cache2k achieves a lower peak memory consumption because of its 
low allocation rates, which leads to less garbage collector activity. Depending on the cache utilization, cache size
and the hit rates the total memory consumption will differ. Here is a rather extreme example with the G1 collector:

{% asset_img G1/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-1M-5-notitle.svg 'ZipfianSequenceLoadingBenchmark, memory consumption with 1M cache size at 4 threads and Zipfian factor 20' %}
For the graph above there is an [Alternative Image](G1/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-1M-5-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-1M-5.dat) available. 

Interesting side note: Since the cache eviction produces garbage, increasing the cache size can have a 
dramatic effect on the peak memory consumption and can actually lower the amount of needed memory, 
since less breathing space for the garbage collector is needed. 

Looking only at the statically used heap memory, can give the wrong idea on the really used physical
memory in operation.  

## Jar File Sizes

Finally let's take a look at the jar file sizes:

- caffeine-2.5.2.jar: 1.007.339 bytes
- cache2k-all-1.0.0.Final.jar: 387.771 bytes
- cache2k-api-1.0.0.Final.jar + cache2k-core-1.0.0.Final.jar: 321.816 bytes
- ehcache-core-2.10.3.jar: 1.386.653 bytes
- guava-20.0.jar: 2.442625 bytes
- guava cache only alternative: com.nytimes.android:cache-2.0.3.jar: 160.474 bytes

For Guava cache users that don't need the whole Guava library, New York Times provides a jar file that only 
contains the cache functionality. For Android or environments where small (download) sizes matter Guava and 
cache2k are the best choice. Compared to the features, the Caffeine jar is rather big, which is caused 
by a high number of generated classes.


 
## Benchmark Shortcomings
 
All of our benchmark scenarios intentionally stress the cache heavily to amplify differences in the 
cache implementations and reveal weaknesses. The outcome in real applications will differ. 

Here is a summary of noteworthy things that may influence the real world performance:

- The value and key in the benchmark is only an integer object. Larger and more complex objects, will 
  lead to higher allocation rates. The overhead in the internal data structures of the cache becomes 
  less significant.
- Different latency and CPU cycles for loading a cache value
- CPU time used by the application
- interactive or throughput oriented workload
- selected garbage collector and its tuning values
- forced full GC between iterations may influence benchmark results
- A real world access sequence is different to the Zipfian sequence

The last point cannot be stressed enough. Testing with the Zipfian distribution is heavily in favor of 
caches that keep entries longer that are accessed more often (frequency aspect). Since the access pattern is always
in the identical value range, a cache could actually stop replacing entries after a set of hot entries is
established. Next benchmarks should modify the value ranges to test the speed of adaption, e.g. in a phase
change of the application.

Running all benchmarks with CMS and G1 collector with the needed precision takes four days on one machine.
Especially the large cache size of 10M needs longer benchmark run times. Because of the long running times, we only
test three variations of thread counts, cache size and hit rate each.



## Future Work

A lot of work went into this blog post and at some time it is important to publish results rather than to
 continue digging deeper. This is what we left for the future:

- Use a sweeping Zipfian sequence, to test adoption speed (see above) 
- Benchmarks with higher number of cores/threads
- Benchmark with latency
- Clock-Pro eviction: Analyze/compare the scan counts with the original algorithm
- Clock-Pro eviction: Deeper analysis of worst case patterns close to 100% hit rate
- Clock-Pro eviction: Capping the eviction scans, will reduce computing cost for random access patterns
- Deeper analysis of the interaction with G1, e.g. benchmark runs with a finer variation of cache sizes
- Improve cache2k eviction for the G1 collector
- In general caching and GC interaction is worth further research, e.g. analyze balance between cache 
  size and GC activity 


## Conclusion

cache2k uses an alternative eviction algorithm (Clock-Pro) that reduces the latency overhead of the cache access
to a minimum. Analyzing the benchmark results we can see that cache2k has better performance then other caches
when operating at high hit rates, approximately above 80%. With lower hit rates, that cause more eviction activity, 
the performance of cache2k is at least on the same level than other cache implementations.

Since the Clock-Pro algorithm eviction runtime could theoretically grow linear to the cache size, cache2k contains 
improvements over the original algorithm. Our experiments prove that the implementation performs stable in the worst 
possible scenarios. Because of this intensive testing we can say that the implementation has production quality.
 
As the achieved hit rates show, Caffeine and cache2k use both an effective and modern eviction algorithm that
performs better than LRU for the Zipfian sequence. 

Because of its low allocation rates, cache2k performs better with the upcoming G1 garbage collector then other 
caches in typical working conditions. 

The memory overhead differs for each cache implementation. When compared to Guava or Caffeine, cache2k has 
slightly more static memory overhead. However, in high throughput scenarios cache2k can achieve a much lower 
total memory consumption because of its low allocation rates.

