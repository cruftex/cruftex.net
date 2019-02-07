title: cache2k v0.20 "Utsire" released
date: 2014-12-01 17:43:41
tags:
 - Java
 - caching
 - cache2k
---

It has been a while since the last release, so this release is rather meaty. The most changes and new lines of 
code is for the upcoming persistence support. Persistence is yet unfinished, there is still a lot of restructuring and 
stabilizing going on. Here are the highlights.

<!-- more -->

## No dependencies

The dependency on a logging framework and the JSR305 annotations packages was removed. The JSR305 annotations are useful, but
the spec unfinished or "dormant" as the JCP pages states. Using the annotations within the cache2k API, would have meant
 that these annotation "sneak into" all applications that use cache2k. Bad idea!

From now on we will try to keep a "no dependencies" policy. If we need a dependency then this is optional and/or a 
separate maven module.

## Logging abstraction

There is a simple logging abstraction. By default java.util.logging is used. If apache commons logging is present, all
 output is gated through commons logging. I have plans to switch to slf4j in the future. Vote for it in 
 [GitHub issue 7](https://github.com/headissue/cache2k/issues/7).
 
## New interface for the expiry policy

The interface to determine the entry expiry received a major overhaul. The old interface is still present but will be removed
in the near future.

## Exception support

Version 0.19 already had support for exceptions. In a read through configuration, exceptions from the cache source,  
are cached and rethrown wrapped into a `PropagatedCacheException`. Caching exceptions needs some deeper elaboration, I will
spend a separate blog entry on that.

## Android support

For the support of android we switched back to language level 1.6. The only thing I really miss is the diamond operator.
All code, that is especially the JMX support, that needs packages from below `javax.*` that is not available on android
went to another module (cache2k-ee). If you want to have an android compatible cache use the following maven pom snippet:

      <dependency>
        <groupId>org.cache2k</groupId>
        <artifactId>cache2k-api</artifactId>
        <version>${cache2k-version}</version>
      </dependency>
      <dependency>
          <groupId>org.cache2k</groupId>
          <artifactId>cache2k-core</artifactId>
          <version>${cache2k-version}</version>
          <scope>runtime</scope>
      </dependency>

If you want to have a full featured cache, use this:
 
     <dependency>
        <groupId>org.cache2k</groupId>
        <artifactId>cache2k-api</artifactId>
        <version>${cache2k-version}</version>
      </dependency>
      <dependency>
          <groupId>org.cache2k</groupId>
          <artifactId>cache2k-ee</artifactId>
          <version>${cache2k-version}</version>
          <scope>runtime</scope>
      </dependency>

## Configuration for "tunable constants"

Within the cache2k implementation there are a lot of constants. One example is the hash load factor, which 
is 64 percent by default. While there is no need to change this value, it feels unwise to bury such values 
deep in the code and have no mechanism to change it. This magic number and others are factored out and there 
is some documentation for it on the implementing class. Look out for the Tunable subclass.

It is possible to change these values, by providing a property file at `/org/cache2k/tuning.properties`.
Here is an example content:

    # increase load factor to save memory
    org.cache2k.impl.BaseCache.Tunable.hashLoadPercent=80
    # switch off randomization for tests
    org.cache2k.impl.BaseCache.Tunable.disableHashRandomization=true

For the normal usage of cache2k there is no need to change/tune such a value. This mechanism is by intention totally
decoupled from the normal cache configuration. Maybe this concept proves useful to provide a "tuning" for different
platforms and CPU achitectures, like android, Java 7, amd64, PowerPC, etc...

The fine print: The "tunable constants" configuration is not an official API, so there will no notice of changes.

## iIteration

The method `Cache.iterator()` was added. It supports a fully concurrent iteration of the cache contents.
 The iterator also implements the Closable interface. After the iteration is finished, or not used any more, 
 it is best to close the iterator to free resources immediately.

## Persistence preview

The persistence support is not finished yet and should be considered on "alpha level". It is
included and can be tested. The upcoming release will finalize the persistence support. 
Maybe it is ready for christmas?

The default, and yet only, persistence implementation writes the data to a single file and 
keeps the index with the keys in the Java heap. To activate persistence simply add `persistence()`
to the configuration builder. Some options are available, see 
[JavaDoc StorageConfiguration.Builder](http://cache2k.org/cache2k-api/apidocs/index.html?org/cache2k/StorageConfiguration.Builder.html).

## Complete list of changes
 
You will find the brief list of changes in [0.20 release notes](http://cache2k.org/0/20.html)
