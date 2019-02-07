title: Java Caching Benchmarks 2016 - Part 2
tags:
  - Java
  - caching
  - cache2k
  - benchmark
date: 2016-05-09 17:03:39
---


The work on improving my old [Java Caching Benchmarks](http://cache2k.org/benchmarks.html) continues.
This post takes a closer look at the aspect eviction efficiency. For this comparison we take Guava and 
EHCache2 and compare it to the new kids on the block Caffeine and [cache2k](http://cache2k.org).

<!-- more -->

## How (not) to benchmark

To simulate a real cache scenario some obvious approach would be to construct a benchmark like this:

```` java
    Cache<Integer, Integer> cache = ....
    int[] trace = ...
    for (int i = 0; i < trace.length; i++) {
      Integer value = cache.get(trace[i]);
      if (value == null) {
        Thread.sleep(10);
        cache.put(i, i);
      }
    }
````

The idea is to have an array of cache keys and request the keys from the cache. The array represents either some random
pattern or real cache operations recorded from an application. If the value is not available
from the cache, it is a cache miss and the value needs to be computed or loaded from a database. To simulate the
miss penalty we sleep for 10 milliseconds.

Of course, `Thread.sleep` is unreliable and will produce jitter, especially in the area of 10 milliseconds. 
But that is not the point. Let's say we had chosen 10 milliseconds, because the average latency of
 a database access in our infrastructure is 10 milliseconds. But what happens if we don't query a 
 local database but an external webservice and have 300 milliseconds latency? If we would benchmark 
 with a higher simulated latency, clearly the throughput of the cache that achieves a better hit rate 
 will get better, too.  

The performance effect of cache miss inside the JVM and the local machine can vary per scenario, too. 
The value might be computed inside the VM, the data may be retrieved from a local SSD  or the request goes 
over the network. We cannot simulate or try out all these variations. For our benchmarks 
the idea is to isolate the different aspects. In this blog post I will focus on the eviction algorithm
efficiency. In the next blog post I will take a deeper look at runtime overhead for eviction.

### The Caches

In this benchmark run we focus on these cache implementations:

  - Google Guava Cache, Version 19, default settings
  - EHCache, Version 2.10.1, default settings
  - Caffeine, Version 2.3.0, default settings
  - cache2k, Version 0.26-BETA, default settings
  
The JVM settings and hardware is irrelevant for this benchmark, since we focus on efficiency of the eviction algorithm
and not on the runtime performance.

Caffeine needs two special setup parameters for the benchmark:

```` java
    int maxSize = ...
    Caffeine.newBuilder()
      .maximumSize(maxSize)
      .executor(Runnable::run)
      .initialCapacity(_maxElements)
      ...
````

With the `executor` parameter the eviction is within the same thread. If this wouldn't be specified the
eviction will be delayed and the cache would hold more then the configured maximum size, thus leading
to wrong results. With the `initialCapacity` parameter Caffeine is instructed to collect data for the eviction
algorithm right from the beginning. Setting this parameter is a courtesy to Caffeine, because otherwise 
Caffeine cannot perform well for very short traces. 

Why is _hazelcast_, _Infinispan_ or _XY-Cache_ not included? Because I currently focus on cache implementations
that are optimized for the use in the local JVM heap. The benchmark concentrates on the effects inside
a single VM.

### Eviction Algorithms

Guava and EHCache use LRU. Caffeine uses an algorithm, recently invented, called Window-TinyLFU. 
Cache2k uses an improved and optimized version of the Clock-Pro algorithm.

Still, LRU (least recently used) is the mostly used eviction algorithm today. It is simple and easy to 
implement and achieves quite useful results. Another algorithm is LFU (least frequently used). 
Instead deciding based on the recency it decides based on the frequency. 
Entries that were accessed more often will be kept. Although yielding better performance for some workloads, 
LFU is not useful as a universal algorithm.
 
On the other side LRU, not addressing the frequency aspect, is problematic, too. For example
a scan over the whole data set, will sweep out entries in the cache that were frequently accessed 
before and after.

Caffeine and cache2k use modern algorithms that address both aspects, the recency and the frequency.
The basic idea is to detect entries accessed more frequently and protect them in a hot set, while
evicting entries only seen once faster as LRU would do.

Only cache2k is using an algorithm that allows full concurrent access. To achieve that, 
no temporal information for the access is recorded, only an access counter is incremented. 

Going more into detail here, is beyond this article. For more information the various papers are 
the best source.

## Traces, Traces, Traces

To compare the cache efficiency we use different access patterns, and run them against a cache
implementation with a specific size limit. For this article I used traces from four different sources.
 
The source of the traces _Cpp_, _Glimpse_, _Multi2_ and _Sprite_ is from the authors of these
papers:

  * J. Kim, J. Choi, J. Kim, S. Noh, S. Min, Y. Cho, and C. Kim,
    "A Low-Overhead, High-Performance Unified Buffer Management Scheme
    that Exploits Sequential and Looping References",
    *4th Symposium on Operating System Design & Implementation, October 2000.*
  *  D. Lee, J. Choi, J. Kim, S. Noh, S. Min, Y. Cho and C. Kim,
    "On the Existence of a Spectrum of Policies that Subsumes the Least Recently Used
     (LRU) and Least Frequently Used (LFU) Policies", *Proceeding of 1999 ACM
     SIGMETRICS Conference, May 1999.*

All these traces are short and have limited practical value today. These traces are used 
in a lot of papers about cache eviction algorithms. That is why I always run them and compare the
results to the outcomes of the papers.

The _OLTP_ trace was used within the ARC paper:

  * Nimrod Megiddo and Dharmendra S. Modha, "ARC: A Self-Tuning, Low Overhead 
    Replacement Cache," USENIX Conference on File and Storage Technologies (FAST 03), 
    San Francisco, CA, pp. 115-130, March 31-April 2, 2003. 
    
The traces _UmassFinancial_ and _UmassWebsearch_ are available from the 
[UMass Trace Repository](http://traces.cs.umass.edu/index.php/Storage/Storage)

All traces from the sources above are disk I/O traces, which means all traces contain
a sequence of disk block numbers. The used block size of this traces is usually 512 bytes. But, the access 
pattern of a Java object cache, is different to that of a disk buffer in an operating system. We need to be aware of
this mismatch, when comparing Java caches with these traces. 

To fill the gap of missing middleware traces, the traces _Web07_, _Web12_, _OrmAccessBusy_ and _OrmAccessNight_ are
 traces from a Java application provided by headissue GmbH. The traces are made public in the 
 [cache2k benchmark](http://github.com/cache2k/cache2k-benchmark)
  project on GitHub. As far as I know, these are the only public available access traces of a Java application.

## The Graphs

The graph shows the achieved hit rate for a cache implementation with a specified cache size.
 The cache implementations _LRU_ and _CLOCK_ are reference implementations from the 
 [cache2k-benchmark](http://github.com/cache2k/cache2k-benchmark) package.
 
 _OPT_ is a hypothetical cache implementation that can see into the future and only evicts entries that
will never be used again or the reuse is farthest away. This is also known as Belady's algorithm. To calculate OPT
the simulator code of Caffeine is used.

_RAND_ is the simplest eviction algorithm possible. It selects the eviction candidate by random. The result
shown is actually not from 'perfect random', but from a realistic cache implementation. The evicted entry
is chosen by a forward moving a pointer inside the cache hash table.

### Random Pattern

We start with a complete random pattern of 1000 different values. 

Trace length: 3 million, Unique keys: 1000, Maximum possible hit rate: 99.97%

{% asset_img traceTotalRandom1000hitrateProducts.svg 'Random Pattern hit rates comparison' %}

The main purpose of this pattern, is to find out whether one of the implementations is cheating. Since the pattern 
is random, every algorithm has no chance to predict what will be accessed in the future. A cache implementation can 
always cheat the benchmark, by caching a bit more entries then the limit requested. If some implementation
achieves a better hit rate for a random pattern, that means it is caching more entries. As we can see, 
the results are almost identical for all implementations. All fine.

### Oltp Trace

A trace from a OLTP workload, used by the authors of the ARC algorithm.

Trace length: 914145, Unique keys: 186880, Maximum possible hit rate: 79.56%

{% asset_img traceOltphitrateProducts.svg 'OLTP Trace hit rates comparison' %}

### UmassFinancial2 Trace

A trace from the Umass Trace Repository, described as: "I/O traces from OLTP applications running at two large 
financial institutions". From the original trace only the first 1 million requests are used. The trace contains
I/O requests for continuous blocks. From each request only the first block address
is used. This should make the trace data more relevant to the access of objects.

Trace length: 1 million, Unique keys: 102742, Maximum possible hit rate: 89.73%

{% asset_img  traceUmassFinancial2hitrateProducts.svg 'UmassFinancial2 Trace hit rates comparison' %}

### UmassWebSearch1 Trace

A trace from the Umass Trace Repository, described as: "I/O traces from a popular search engine". 
From the original trace only the first 1 million requests are used. The trace contains
I/O requests for continuous blocks. From each request only the first block address
is used. This should make the trace data more relevant to the access of objects.

The low possible hit rate is quite atypical for this trace.

Trace length: 1 million, Unique keys:470248 , Maximum possible hit rate: 52.98%

{% asset_img traceUmassWebSearch1hitrateProducts.svg 'UmassWebSearch1 Trace hit rates comparison' %}

### OrmAccessBusytime Trace

This trace represents requests from a Java application to an object relational mapper for unique instances
 of entities. The trace was extracted during a busy period at daytime. The requested objects are a
 mixture of products and user data. Besides the user activity also some analytical jobs happen
 in short periodic bursts.
 
Trace length: 5 million, Unique keys: 76349, Maximum possible hit rate: 85.61%

{% asset_img traceOrmAccessBusytimehitrateProducts.svg 'OrmAccessBusytime Trace hit rates comparison' %}

### Web12 Trace

The trace represents requests to product detail pages of an e-commerce site in december, the busiest month.
For the trace we just use integer numbers. Each unique URL is represented by one number.

Trace length: 95607, Unique keys: 13756, Maximum possible hit rate: 85.61%

{% asset_img traceWeb12hitrateProducts.svg 'Web12 Trace hit rates comparison' %}

### The Zipfian Pattern

The Zipfian pattern is a random distribution, but the probability of each value follows Zipf's law. The result
is a typical long-tail distribution with a head of 'hot' values and a tail of 'cold' values. This pattern is
 used quite often for comparing caches. The used pattern generator is from the YCSB benchmark.

Trace length: 10 million, Unique keys: 10000, Maximum possible hit rate: 99.9%

{% asset_img traceZipf10khitrateProducts.svg 'Zipfian Pattern hit rates comparison' %}

### More Graphs....

The above is only a subset of all traces. The complete set of graphs is available at
[Java Caching Benchmarks 2016 - Part 2 - The Graphs](/2016/Java-Caching-Benchmarks-2016-Part-2-graphs.html)

## Conclusion

The new kids on the block, Caffeine and cache2k, perform superior to Guava and EHCache2, when operated
 with a useful cache size. Cache2k seems to be ahead for analytical workloads. Other
  workloads are in favor of Caffeine (`UmassWebSearch1`). I assume that Caffeine is keeping hot data longer
  then cache2k when the workload shifts.
  
In case the cache is too small, the scenario may become 'LRU-friendly'
 as we can see in the `OrmAccessBusytime` graph. Caffeine has a weak spot here. For cache sizes below 5000 it
 actually performs below random eviction. Cache2k is also affected from this, but stays closely above random, 
 so at least it makes sometimes a useful decision. After informing Ben Manes, the author auf Caffeine, he confirmed
 on this and is working on an improved version.
 
The new eviction algorithms of cache2k and Caffeine have a lot of internal tuning parameters. At the end 
of the day, it depends on how these parameters are set and which traces are valued more important to
 optimize for. Vice versa, it is always possible to bias a benchmark, by selecting traces, your favorite
 cache looks best with.
 
As stated in the last blog post, I am the author of [cache2k](http://cache2k.org). The goal of the benchmarks is
 to see how cache2k performs and to be able to detect performance regressions while developing and see in which
areas to improve. Cache2k is optimized towards high concurrent read accesses, as shown in the last 
blog post. Because of that engineering direction, there is less information available for the eviction 
algorithm. This is a general disadvantage for achieving the highest eviction efficiency. This comparison shows
 that it is well compensated.

## The Missing Trace

For these benchmark altogether 10 different traces are used. While other benchmarks pick only
two or three traces, this shows a more diverse result and detects weak spots. But still this is not
a useful or representative set of traces. We need more traces hitting a Java cache under 
different scenarios.
