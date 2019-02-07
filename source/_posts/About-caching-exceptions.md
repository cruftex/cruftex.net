title: About caching exceptions
tags:
  - Java
  - caching
  - cache2k
date: 2014-12-07 18:43:59
---

In the version 0.20 of cache2k we shipped an enhanced exception support. So it is time for some 
mumblings on caching and how to handle exceptions.

<!-- more -->

## Cache aside or read-through caching

Let's start with some basics. There are two typical usage patterns to integrate a cache into an application.

In the cache aside pattern the application queries the cache and in the case of a miss, 
it requests or generated the data. Here is the typical look of it:

``` java
    Data data = cache.get(key);
    if (data == null) {
      data = generateData(key);
      cache.put(key, data);
    }
```

The other approach is the read-through configuration. The cache is configured with a data source and calls it 
in case of a cache miss.

``` java
    // cache building:
    Cache cache = CacheBuilder.newCache(Data.class, String.class)
      .source(new CacheSource() {
        public Data get(String key) {
          generateData(key);
        }
      })
      .build();
    // cache usage:
    Data data = cache.get(key);
```
    
I prefer the read-through configuration for many reasons. The code is cleaner, and it does not need 
"to know" how to generate or fetch the data. It is simply a more object oriented approach. Another reason 
to use the read-through pattern is the blocking feature of cache2k. Blocking means that there will be no more
 than one request of the same 
 key to the cache source.
 
What happens in the case `generateData` throws an exception? In the cache aside pattern this is obvious, since 
`generateData` is called by the application, it has to handle it. If the read-through pattern is used, it is possible
for the cache to do "its thing" with the exception.
 
## The JSR107 cache loader versus the cache2k cache source

For the read-through pattern the java caching standard (JSR107) defines the `CacheLoader` interface to fetch the data:

``` java
      public interface CacheLoader<K, V> {
        V load(K key) throws CacheLoaderException;
        Map<K, V> loadAll(Iterable<? extends K> keys) throws CacheLoaderException;
      }
```

JSR107 applications need to wrap any exception to a `CacheLoaderException`. The cache2k `CacheSource` interface is 
more simple:

``` java
      public interface CacheSource<K, V> {
        public V get(K key) throws Exception;
      }
```

Applications implementing the `CacheSource` interface are allowed to throw any exception. I opted against the JSR107 
design for two reasons: First, it leads to boiler plate wrapping code; Second, the cache needs to have some
countermeasures against exceptions anyway, so the wrapping can be done within the cache without additional overhead.  

## Ouch, an exception, what to do with it? 
 
So what are the options of the cache, when the cache source throws an exception? Let's do a quick brainstorming:
 
   - Wrap the exception and throw it. Don't do any caching, so next time the application calls `get()` try to fetch 
     the data again from the source
   - Store the exception in the cache. Each time the key is requested with `get()` throw a new wrapped exception of 
     the original exception.
   - If there is a valid value in the cache from a previous call of the cache source, return that value instead of
     throwing an exception.
   - Store the exception in the cache, but do a quick expiry, so the fetch from the source is retried after a 
     short period of time.
   - Combinations of the above....

Did I miss anything? What is useful in your application scenario? 
 
## cache2k exception support 
 
cache2k does support all the possible behaviour outlined above. For tweaking the semantics when exceptions 
turn up, there are the following builder options:

   - *suppressExceptions(boolean)*: Switch on or off the suppression of exceptions, if the cache already contains 
     a value for a requested key.    
   - *exceptionExpiryDuration(long v, TimeUnit u)*: After the expiry time the cache tries another fetch from the source.
   - *exceptionExpiryCalculator(ExceptionExpiryCalculator c)*: Provides a calculator that returns a custom expiry 
     for an exception. This way temporary exceptions may be treated different.
       
The method `get()` or `peek()` throws a wrapped exception, called `PropagatedCacheException`, if the cache source
had thrown an exception and it was not possible to suppress the exception.

The iteration of the cache entries, never throws an exception. Thus, the `CacheEntry` interface has the method 
`getException()` to check whether there was an exception for that specific entry. If an exception is suppressed, it 
is not stored in the cache. In this case there is no way to determine from the `CacheEntry` properties, whether the 
last fetch operation was successful or caused an exception.
 
There are statistics counters that get incremented for each exception thrown by the cache source. It is possible 
to access it via JMX:
 
``` java
        /**
         * Number of exceptions thrown by the {@link org.cache2k.CacheSource}.
         */
        long getFetchExceptionCnt();
        /**
         * Number of exceptions thrown by the CacheSource that were ignored and
         * the previous data value got returned.
         */
        long getSuppressedExceptionCnt();
```
  
## Bulk operations and exceptions
   
It is possible to retrieve multiple cache entries in one method call via `Cache.getAll()`. There is also a 
`BulkCacheSource` interface, which is used by the cache to fetch multiple entries at once. What should happen if
an exception occurs during a bulk operation?

Let's consider an example: The cache client wants to retrieve keys 1, 2 and 3. For key 3 there is a mapped entry in
 the cache, so it calls the bulk source to fetch the value for key 1 and 2. This operation is not successful and leads
 to an exception. What should be the outcome of the operation? Should `getAll()` throw an exception or return only
 the value for key 3?
 
The current implementation goes by the rule "be as specific as possible and return as much valid values as possible".
This leads to: The `Cache.getAll()` operation always returns a map with the requested keys and never produces 
an exception. Only when the map is accessed an exception is thrown, if that key had caused an exception.

## The default behaviour

The default behaviour tries to be useful in most situations. If nothing is configured explicitly, the caching
 of exceptions is switched on. If there is an entry expiry, the expiry time of an exception will be one 
 tenth of the configured value expiry time.

## Is this really useful?

Since exceptions are an intrinsic Java feature you have to deal with them in any way. Advanced exception handling 
adds some complexity to a cache implementation. So is it really worth while or better just
ignore it and throw an exception right when it happens? 

Inexperienced programmers might overuse exceptions instead of defining proper return values.
But if exceptions are not cached, and exceptions are used to communicate some conditions to the callee (e.g.
a `FileNotFoundException`), the performance characteristics of the application may suffer dramatically. The cache
is just bypassed.

There are many conditions in applications that may lead to exceptions. E.g.: A temporary network outage,
a resource shortage (connection pool limit, thread pool limit), a seldom requested corner case. In many situations 
the cache can do something useful. One useful thing is to suppress an exception, if there is still a value in 
the cache. This makes the whole application more robust against temporary problems, without the need to write 
any additional code.
 
## The cons of exception caching
 
There are some pitfalls with cached exceptions. The most subtle one is the fact that, when the cache rethrows
an exception and you analyze it, you may think it just happened. However, that exception might happened in the past
and you have no idea when exactly it happened. Second, you also don't know whether one exceptions is the identical
one and just thrown multiple times, or happened multiple times in reality. So besides that caching exceptions
might be useful, this all may be vary confusing.

For this pitfall it is probably a good idea to add a timestamp to an exception. If an exception gets logged, you
can compare the log timestamp and the exception timestamp and see that it was a cached exception. That is something
that will be added in the next releases.
