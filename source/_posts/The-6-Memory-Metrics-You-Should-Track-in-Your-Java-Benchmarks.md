title: The 6 Memory Metrics You Should Track in Your Java Benchmarks
tags:
  - Java
  - benchmark
  - JMH
  - Memory Consumption
  - Cache
date: 2017-03-28 11:56:13
---


Analyzing or monitoring the memory consumption of a Java application is no easy task,
but benchmarks require consistent results. Ironically, when I google for 
"benchmark java memory consumption" a Stackoverflow question of myself from 2015 
comes up first place. Well, two years later after trying a lot of things that did not work, it is time 
for a summary.

This blog post touches different subjects, including:

- Try and discuss all the different ways to get memory consumption metrics
- How to integrate memory consumption metrics in JMH
- Compare the memory consumption of in process caching libraries

The main focus will be on the first one.

<!-- more -->

The impatient reader can skip to the [Conclusion](#Conclusion). The rest of the article is organized as follows:
After giving a motivation, we present relevant techniques to measure memory consumption and show their practical results
based on an example benchmark. The benchmark and its setup is described at the end of the article.

<!-- toc -->

## Why Care?

Continuing creating different benchmarks for caching libraries and improving [cache2k](https://cache2k.org), we discovered that important 
information is missing. Let's look at a benchmark result:

{% asset_img G1/ZipfianSequenceLoadingBenchmark-notitle.svg 'ZipfianSequenceLoadingBenchmark with G1 collector, 4 threads, 1M cache entries, Zipfian factor 10, throughput in operations per second' %}
For the graph above there is an [Alternative Image](G1/ZipfianSequenceLoadingBenchmark-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmark.dat) available. 

The graph shows the throughput in operations per second for a capacity limit of 1M entries. The benchmark setup
is described in more detail at the end of the article.

A cache library could "cheat" and store more entries then configured. Contrary, when one cache is consuming effectively 
more memory then the other, the cache library with the better memory footprint can obviously store more entries 
within the same amount of memory and yield a better throughput.

A cache is a typical example of the [memory/time or space/time trade off](https://en.wikipedia.org/wiki/Space%E2%80%93time_tradeoff).
The throughput can be improved by increasing the memory. When benchmarking code with memory/time trade offs, keeping track
of the consumed memory is essential when comparing the different implementations.

## The Naive Approach

The first naive approach is asking the JVM how much memory is used. Here we have the first confusion.
We can retrieve the total memory via `Runtime.getRuntime().totalMemory()` and the free memory via 
`Runtime.getRuntime().freeMemory()` but obviously not the used memory. Calculating just the difference
isn't always correct, since a GC may happen between the two method calls.

Retrieving and calculating the used memory will result in lots of different values between the used memory
and the total memory. It just depends on when we do the call: After a GC, before the GC or somewhere in between.

We are looking for methods that produce reliable results with low variance, which don't produce extra overhead 
during benchmarking and can be recorded without extra effort.

## Metric: Object Graph Traversing Libraries

The memory size of an object can be determined by using the Java instrumentation functionality or via
methods in the `sun.misc.Unsafe` class. Based on this, several solutions exist to estimate the memory 
consumption of an object graph. The popular ones are:

- [EHCache sizeof](https://github.com/ehcache/sizeof)
- [Java Agent for Memory Measurements](https://github.com/jbellis/jamm) 

This method is used in the [Caffeine memory overhead comparison](https://github.com/ben-manes/caffeine/wiki/Memory-overhead).

Advantages:

- Different configurations can be evaluated quickly, no GC run or JVM restart is needed 

Disadvantages:

- It is difficult to use this method for benchmarking in general since choosing the root objects needs 
  some extra work and typically also knowledge about implementation details.
- Comparisons with this library typically select a root object reference and sum up the used memory of every object
  that is reachable by that root object. Other resources loaded by the benchmark target are ignored.
- It does not represent the real memory consumption: excludes memory allocation overhead, GC overhead, non heap data.

The procedure can be useful for a library developer to get quick insights, but is less useful to determine a realistic
value for memory consumption. When the total Java heap is traversed, the result is similar to the used heap space
metric.

## Metric: Used Memory after Forced GC

We can ask the JVM for the currently used memory:

````
    long getCurrentlyUsedMemory() {
      return
        ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed() +
        ManagementFactory.getMemoryMXBean().getNonHeapMemoryUsage().getUsed();
    }
````

With *used memory* we mean heap and non heap data. The non heap data includes memory areas just as
thread stacks and class caches. We will also record the heap only data with a separate metric.

Since Java is relying on garbage collection the used memory is floating between the minimum and maximum value.
Measuring the amount of used memory will yield different results depending on when the last GC run
happened. To get a reliable result about how much memory is used by the application, the logical idea
is to force a GC run and then obtain the value for the used memory. The first try looks like this:

````
    long getCurrentlyUsedMemory() {
      return
        ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed() +
        ManagementFactory.getMemoryMXBean().getNonHeapMemoryUsage().getUsed();
    }
    long getPossiblyReallyUsedMemory() {
      System.gc();
      return getCurrentlyUsedMemory();
    }
````

The problem with it, is that `System.gc()` triggers a concurrent garbage collection. When requesting
the usage values immediately after the `System.gc()` call the garbage collection is not finished yet.
To await the GC run to complete we can use counter values exposed by the JVM (BTW: I found that trick in the
JMH sources):

````
  long getGcCount() {
    long sum = 0;
    for (GarbageCollectorMXBean b : ManagementFactory.getGarbageCollectorMXBeans()) {
      long count = b.getCollectionCount();
      if (count != -1) { sum +=  count; }
    }
    return sum;
  }
  long getReallyUsedMemory() {
    long before = getGcCount();
    System.gc();
    while (getGcCount() == before);
    return getCurrentlyUsedMemory();
  }
````

Here is a debug example using this technique, with the classic CMS collector:

````
gcCount=25
36.692: [GC (System.gc()) [PSYoungGen: 855764K->38944K(1925120K)] 966467K->149647K(2325504K), 0.0670620 secs] [Times: user=0.27 sys=0.00, real=0.06 secs] 
36.759: [Full GC (System.gc()) [PSYoungGen: 38944K->0K(1925120K)] [ParOldGen: 110703K->111316K(400384K)] 149647K->111316K(2325504K), [Metaspace: 11212K->11212K(1058816K)], 0.4352339 secs] [Times: user=1.50 sys=0.00, real=0.44 secs] 
usedHeap=169860016, usedNonHeap=18995232, totalUsed=188855248, gcCount=27
````

We can see that actually two GC runs are reported for one call to `System.gc()`.

The result of this metric can be found in the graph below under the name *usedMem_fin*.

One result value is the average of 15 benchmark runs. We do spawn five JVM instances and do three benchmark runs 
inside the same process on the identical cache instance. The memory usage is determined after stopping the workload.
As we can see see in the graph below, the confidence interval is slightly bigger and the value slightly higher as in 
*usedMem_settled*, especially for the CMS collector. Possible reasons for the variance:
 
- For CMS: The metric update seems to lag behind the GC completion. A forced GC counts two GC runs, in G1 only one.
- The tested benchmark target may have buffered data, after the workload finishes. For example Caffeine uses queues
  to decouple the eviction from the applications threads
- JMH might run other cleanup and recording tasks in parallel  

An alternative approach to wait for the GC to complete is to check whether a finalizer is called on a fresh allocated
object, see the stackoverflow question mentioned at the beginning.

## Metric: Used Memory after Forced GC and Settling

To get rid of the variance and improve the accuracy we use the previous metric but run multiple full GC cycles 
until the value stabilizes. The code for that looks like:

````
    long getSettledUsedMemory() {
      long m;
      long m2 = getReallyUsedMemory();
      do {
        Thread.sleep(567)
        m = m2;
        m2 = getUsedMemory();
      } while (m2 < getReallyUsedMemory());
      return m;
    }
````

The result of this metric can be found in the graph below under the name *usedMem_settled*.

## Metric: Used Heap Memory

Various methods exists to obtain a heap dump or heap histogram of live objects (`VisualVM`, `jmap`, `jhat`). This can be 
used to determine the space occupied by all objects on the Java heap.
 
In our benchmarks we programmatically obtain a heap histogram via the JVM Attach API, specifically 
`sun.tools.attach.HotSpotVirtualMachine.heapHisto("-live")`. After the benchmark run the procedure
 waits until the used memory values stabilize and then prints the top objects from the heap dump, and extracts
 the used size of all live objects and stores it in the JMH results. The code to do this can be found
 in the [ForcesGcMemoryProfiler](https://github.com/cache2k/cache2k-benchmark/blob/e19e24aad1ac23c8a3397c32be5576b759267c98/jmh-suite/src/main/java/org/cache2k/benchmark/jmh/ForcedGcMemoryProfiler.java)

Advantages:

- The histogram gives insight into implementation differences
- Extracting the used heap size via the histogram has no measurement variance

Disadvantages:

- Does not represent the real memory consumption: excludes memory allocation overhead, GC overhead, non heap data
- The heap histogram cannot be retrieved via a standardized API, results may differ between JVM vendors

The result of this metric can be found in the graph below under the name *usedHeap_settled*.
Using heap histogram produces values with less variance than using 
`ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed()` since it reliably only counts live objects.
After settling with nothing happening in the JVM the values don't differ much.

## Metric: Maximum Used Memory via GC Notification

Another way to obtain a metric of the used memory is to register for notifications of the garbage collector activity, the
details are explained in the JavaDoc of [GarbageCollectionNotificationInfo](http://docs.oracle.com/javase/7/docs/jre/api/management/extension/com/sun/management/GarbageCollectionNotificationInfo.html).
In the information we can find the used and total size for all memory pools exactly after the end of the 
garbage collection run.

The metric we record in our benchmarks is the peak value of the used memory that gets reported during a benchmark run, in the
graphs it can be found by the name *usedMem_max*.

We could also use the GC notification to extract the value of the used heap memory. The problem is, that the
method enumerates all memory pools and the memory pool names differ by the GC type selected. Code
summing up only the heap pools would be fragile.

The values of the GC notification correspond to the values of the management beans.

## Showtime: Used Memory Graphs

Now its finally time for the first graph. Let's see how the metrics look like for the tested libraries:

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkMemoryUsed4-1M-10-notitle.svg 'ZipfianSequenceLoadingBenchmark with CMS collector, 4 threads, 1M cache entries, Zipfian factor 10, used memory' %}
For the graph above there is an [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkMemoryUsed4-1M-10-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkMemoryUsed4-1M-10.dat) available. 

As we can see *usedMem_fin* has low confidence. After another or more full GC runs the reported 
memory becomes a little smaller with no variance, as we can see in *usedMem_settled*. Guava seems to be most memory efficient, 
but looking on the *usedMem_max* metric it falls behind Caffeine and cache2k. This means that Guava either needs
more memory during operation, or it is less friendly with minor garbage collections. A detail that may be worth
some more investigations.

Doing the same with the G1 garbage collector (VM option `-XX:+UseG1GC`) shows another picture:

{% asset_img G1/ZipfianSequenceLoadingBenchmarkMemoryUsed4-1M-10-notitle.svg 'ZipfianSequenceLoadingBenchmark with G1 collector, 4 threads, 1M cache entries, Zipfian factor 10, used memory' %}
For the graph above there is an [Alternative Image](G1/ZipfianSequenceLoadingBenchmarkMemoryUsed4-1M-10-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmarkMemoryUsed4-1M-10.dat) available. 

The slight difference between *usedMem_fin* and *usedMem_settled* is gone. That means G1 is capable to collect garbage more reliable
on the first full GC run. Looking on the *useMem_max* metric we have an indicator how the cache
implementations are affected by the different collectors.

## Metric: Total Memory

The used memory after a GC isn't all the memory that is occupied by the JVM. The JVM reserves more memory to have 
"breathing space" for garbage collection. We call this the total memory or committed memory. The total memory 
is requested with

````
    long getTotalMemory() {
      return
        ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getCommitted() +
        ManagementFactory.getMemoryMXBean().getNonHeapMemoryUsage().getCommitted();
    }
````

To have a more compact naming we use the term *total* instead of *committed*. We extract two metrics. 
*totalMem_settled* is the total memory after the benchmark run and multiple full GCs. *totalMem_max* is the
maximum total memory that was reported by the GC notification.

## Metric: Process VmRSS and VmHWM reported by Linux

So far we only utilized JVM internal metrics. But is this the amount of memory that is really used?
Let's ask the operation system! Linux provides the metric resident set size (RSS) which is the amount of
physical memory that a process is using. Very conveniently for our benchmarking purposes, Linux provides 
another metric called high water mark ("HWM") which is the peak value of the resident set size.
 The metrics *VmRSS* and *VmHWM* are obtained via the proc interface in `/proc/<pid>/status`. 
See `man proc` for more details. The metric *VmHWM* isn't exposed by the usual linux tools.

## Showtime: Total/Committed Memory Graphs

Let's take a look at the results for the CMS collector:

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-total-notitle.svg 'ZipfianSequenceLoadingBenchmark with CMS collector, 4 threads, 1M cache entries, Zipfian factor 10, total memory' %}
For the graph above there is an [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-total-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-total.dat) available. 

Again we also did a benchmark run with the G1 collector:

{% asset_img G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-total-notitle.svg 'ZipfianSequenceLoadingBenchmark with G1 collector, 4 threads, 1M cache entries, Zipfian factor 10, total memory' %}
For the graph above there is an [Alternative Image](G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-total-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-total.dat) available. 

We can see that the total memory reported by the JVM is more then the memory reported by the operating system. The 
reason for this is, that the RSS metric is only reporting memory that is really used. The process may request more
memory from the OS and it is only claimed on the first write to that memory section. This technique is
called [memory overcommittment](https://en.wikipedia.org/wiki/Memory_overcommitment).

Looking at the values for *totalMem_max*, the G1 collector seems to request a high amount of memory, this is never used.
We can also see, that the G1 collector releases memory back to the OS after a full GC, while CMS does not.

## Metric: Allocation Rate

The values for the used memory reported by the JVM after a full GC and the value reported by the OS differ a lot.
To find out a possible cause, we can take a look at the allocation rate. This tells us how many objects (and garbage) a
 program is creating.

{% asset_img CMS/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRate-4-1M-10-notitle.svg 'ZipfianSequenceLoadingBenchmark with CMS collector, 4 threads, 1M cache entries, Zipfian factor 10, allocation rate' %}
For the graph above there is an [Alternative Image](CMS/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRate-notitle-print.svg) and [Raw Data](CMS/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRate.dat) available. 

The result with the G1 collector:

{% asset_img G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRate-4-1M-10-notitle.svg 'ZipfianSequenceLoadingBenchmark with G1 collector, 4 threads, 1M cache entries, Zipfian factor 10, allocation rate' %}
For the graph above there is an [Alternative Image](G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRate-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRate.dat) available. 

However looking at the absolute values does not makes sense, since the throughput is very different. We can normalize the allocation
 rate and calculate the allocated bytes per operation:

{% asset_img G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRatePerOp-4-1M-10-notitle.svg 'ZipfianSequenceLoadingBenchmark with G1 collector, 4 threads, 1M cache entries, Zipfian factor 10, normed allocation rate' %}
For the graph above there is an [Alternative Image](G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRatePerOp-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRatePerOp.dat) available. 

This graph is identical for the CMS and G1 collector.

The allocation rate is determined by JMH via the `GcProfiler` which uses `ThreadMXBean.getThreadAllocatedBytes`.

## Conclusion

To my knowledge this is the first systematic evaluation of different Java memory consumption metrics 
for its usage in benchmarking. We created the metric *usedMem_max* and discovered the hidden gem *VmHWM* that
proves useful for our purposes.

The major findings are:

- The presented metrics can be recorded alongside the benchmarking, and have no significant overhead
- More JVM restarts (forks in JMH lingo) increase the accuracy of the total memory consumptions, since outliers of 
  a single GC expansion are less relevant
- With code that has time/memory trade off effects, memory usage needs to be captured as well in the benchmark results.
- The metrics reported by the JVM have different accuracy and different caveats. The reported committed memory 
  is quite unreliable.
- Linux provides with *VmHWM*, which provides the peak memory usage. This allows us to reliably capture the highest 
  amount of memory consumption during a benchmark run. 
- Dynamic effects during the execution play in important role in the overall memory consumption
   
Highlighting the last point, let's take a look on the best performers according to *usedMem_settled*:

{% asset_img G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-usedHeap-sorted-notitle.svg 'ZipfianSequenceLoadingBenchmark with G1 collector, 4 threads, 1M cache entries, Zipfian factor 10, used heap memory, sorted by best performance' %}
For the graph above there is an [Alternative Image](G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-usedHeap-sorted-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-usedHeap-sorted.dat) available. 

In contrast, here are the best performers according to *VmHWM*:

{% asset_img G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-VmHWM-sorted-notitle.svg 'ZipfianSequenceLoadingBenchmark with G1 collector, 4 threads, 1M cache entries, Zipfian factor 10, peak memory usage reported by the operating system (VmHWM), sorted by best performance' %}
For the graph above there is an [Alternative Image](G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-VmHWM-sorted-notitle-print.svg) and [Raw Data](G1/ZipfianSequenceLoadingBenchmarkMemory4-1M-10-VmHWM-sorted.dat) available. 

Going back to our initial motivation we found that [cache2k](https://cache2k.org) has superior throughput and is consuming 
less real memory (according to *VmHWM* metric) then other cache products, for the tested benchmark scenario.
  
In our benchmark scenario the internal data structures of the cache dominate the used memory. 
This is intentional. The cache libraries will impact the overall memory consumption of real applications
not as much as shown here, because the payload data has a bigger size. It must also be noted that the 
differences between *VmHWM* and *usedMem_settled* will look more or less dramatic
 when different benchmark parameters are used (thread count, hitrate, thread count, etc.). 
 
Future work: Looking at the results there are a lot of phenomena that deserve a closer look.
Now that we have the tooling in place, we can use it for more detailed benchmarks. 
Tools and benchmarks can also be used for a deeper analysis of the effects
of the G1 garbage collector which will become the default for Java 9. Finally, it's the plan (or my wish) 
to integrate the memory consumption metrics into JMH to make it easily and widely available. 
Meaningful benchmarks of code that as memory/time trade offs and relies on garbage collection is an interesting 
topic and is worth some more thoughts. Instead of letting the memory expand unbounded the benchmark 
could force identical memory limits for all benchmark targets.

Based on the feedback I get, I will update this article and/or provide another article that is more hands-on
and includes the JMH options.

## Addendum: Benchmark Setup Description

For reproduction, here is the setup. The benchmark can be run with:

````
git clone https://github.com/cache2k/cache2k-benchmark.git
git checkout c9ce981eafb8bce5fd1d719fa618011129732dee
cd cache2k-benchmark
# compiles the benchmark and produces: jmh-suite/target/benchmarks.jar
mvn -DskipTests package
# runs the benchmarks, results are writen to: /var/run/shm/jmh-result
bash jmh-run.sh
# generate the graphs
bash processJmhResults.sh --dir /var/run/shm/jmh-result process
````

The code to obtain the metrics *usedHeap_settled* and *usedMem_settled* is in [ForcedGcMemoryProfiler.java](https://github.com/cache2k/cache2k-benchmark/blob/e4cd7a8c491bf275545b3003932c2eebb69606e9/jmh-suite/src/main/java/org/cache2k/benchmark/jmh/ForcedGcMemoryProfiler.java). 
The code to determine *usedMem_max* is in [GcProfiler.java](https://github.com/cache2k/cache2k-benchmark/blob/e4cd7a8c491bf275545b3003932c2eebb69606e9/jmh-suite/src/main/java/org/cache2k/benchmark/jmh/GcProfiler.java)

### Benchmark

The benchmark source is in [ZipfianSequenceLoadingBenchmark.java](https://github.com/cache2k/cache2k-benchmark/blob/e4cd7a8c491bf275545b3003932c2eebb69606e9/jmh-suite/src/main/java/org/cache2k/benchmark/jmh/suite/eviction/symmetrical/ZipfianSequenceLoadingBenchmark.java).
The benchmark is selected from a variety of cache benchmarks in the [cache2k benchmarks](https://github.com/cache2k/cache2k-benchmark) suite.
The cache is operated in a read through configuration, with a size limit of 1M entries. The
access pattern is a generated Zipfian distribution of 10M different numbers. Zipfian factor 10 means
we generate a number space 10 times then the cache size. We will use different factors in the upcoming
benchmarks to facilitate different hitrates. In this setup the hit rate turns out to be between 
77% and 82%. A cache miss gets a penalty via JMH's  blackhole: `Blackhole.consumeCPU(1000)`.

It is important to note that the payload data (key and value types) are only integer objects. When storing
bigger objects in the cache the differences in memory consumption between cache implementations would be
less noticeable.

The benchmark will be described in more detail in a following blog post. 

### Environment
  
  - JDK: Oracle Version JDK 1.8.0_121, VM 25.121-b13
  - JVM flags: -server -Xmx10G -XX:BiasedLockingStartupDelay=0 (with and without -XX:+UseG1GC)
  - JMH Version: 1.8 
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
  - Caffeine, Version 2.4.0
  - [cache2k](https://cache2k.org), Version 1.0.0.CR3
  - EHCache, Version 2.10.3
  
### JMH Setup

The JMH command line arguments are: `-gc true -f 5 -wi 2 -w 20s -i 3 -r 20s` which results in:
 
 - Forks: 5 (meaning 5 runs in a newly started JVM)
 - Warmup: 2 iterations, 20 s each
 - Measurement: 3 iterations, 20 s each
 - Before each iteration a forced garbage collection is done

### Threads and Cores

The benchmarks are run with four threads on four available CPU cores. The number of cores is set to four
via the Linux CPU hotplug feature.

### Plots With Confidence

In the plots below units are in SI (base 10), meaning 1MB is 10^6 bytes. This way the unit prefixes
for operations/s and bytes/s are identical. 

Every bar is plotted with a confidence interval. The interval does not represent 
 the upper and lower bounds of a measured value, instead it is much more sensitive.
 The confidence interval is calculated by JMH with a level of 99.9%.
This means the likelihood that the value is between the shown interval is 99.9%. 

## Updates

### Update from 2017-04-03

- Corrected JMH parameters and description.
- Conclusions: accuracy and multiple forks
- Allocation rate: How allocation rate is determined



