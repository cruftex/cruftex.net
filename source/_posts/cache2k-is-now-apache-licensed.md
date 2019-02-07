title: 'cache2k - the high performance Java caching library is now Apache licensed!'
tags:
  - Java
  - caching
  - cache2k
date: 2016-04-07 15:20:48
---


Good news, everyone! After continuously receiving mails and the growing popularity in the Android community 
I finally decided to switch the license of cache2k to Apache. Why it was GPL in the first place? Well, read on...

<!-- more -->

## Why GPL in the first place?

The GPL license does not mean that it is required to make the source of any product that uses the library available
in public, but, it is required to make the source available to everyone that gets the bundled product.

One of a key business principles at [headissue](https://headissue.com) is to ship the source code to our customers.
We think that it is important to convince with actions rather then lock in the customer to our business by
keeping the source for ourselves. Because of that principle, the GPL is essentially a perfect fit for us. Another factor
is that we concentrate on server applications, so the code does never leave a customers server.

So, the general thinking was, why should we share something with less restrictions that we do not need for
our own business from other products' licenses? Furthermore, I admit it, sticking to GPL gives more potential
to other business models such as dual licensing.

## Why Apache now?

It's an adjustment to facts. Interestingly, cache2k got popular in the Android community and people are using
it to build highly efficient smart phone applications. Due to the GPL rules every application distributed with
cache2k would need to be licensed under GPL as well and you need to deliver the source code alongside as well. 
For Android developers, the GPL has a much more restrictive meaning then for server side developers, since, 
instead of shipping (distributing in license lingo) to a single server you put your code in the app store and 
make it publicly available. Distributing your binary to everyone, also means you have to make the source
code available to everyone as well. Did this happen for the applications using cache2k? No, it did not. So now 
I have two options: Sue everyone who is using cache2k and obeying the license, or, face the facts. 
Well, think about it, should I sue everyone who just put trust in a new caching library and gave valuable feedback?!

It is not my intention to blame people using cache2k, because of not adhering to the licensing details, instead, 
I really believe meanwhile, that if I market something as a library usable for Android, and as open source, people
expect that they can use it without restrictions.

It's the Apache license now, as an adoption to reality.

## About cache2k

Cache2k is a high performance Java caching library which concentrates on caching inside a Java JVM. The 
[benchmarks](http://cache2k.org/benchmarks.html) show that it is the fastest available caching library for Java.
We are currently restructuring the API, improving the documentation and work towards a 1.0 version.