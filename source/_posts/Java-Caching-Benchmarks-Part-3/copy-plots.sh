
BASE=/home/jeans/ideaWork/cache2k-internal
# CMS=$BASE/jmh-result-20170427-CMS-mixin0415-cache2k0427
# G1=$BASE/jmh-result-20170501-G1-all

CMS=$BASE/jmh-result-20170630-CMS-all
G1=$BASE/jmh-result-20170703-G1-all

cpy() {
echo $1...
cp -a $CMS/$1-notitle.svg CMS/
cp -a $G1/$1-notitle.svg G1/
cp -a $CMS/$1-notitle-print.svg CMS/
cp -a $G1/$1-notitle-print.svg G1/
cp -a $CMS/$1.dat CMS/
cp -a $G1/$1.dat G1/
}

for I in ZipfianSequenceLoadingBenchmark-bySize-4x5 \
        ZipfianSequenceLoadingBenchmarkEffectiveHitrate-bySize-4x5 \
        ZipfianSequenceLoadingBenchmarkScanCount-bySize-4x5 \
        ZipfianSequenceLoadingBenchmark-byThread-1Mx5 \
        ZipfianSequenceLoadingBenchmark-bySize-4x10 \
        ZipfianSequenceLoadingBenchmarkEffectiveHitrate-bySize-4x10 \
        ZipfianSequenceLoadingBenchmark-byThread-1Mx10 \
        ZipfianSequenceLoadingBenchmark-byThread-1Mx10 \
        ZipfianSequenceLoadingBenchmarkScanCount-bySize-4x10 \
        ZipfianSequenceLoadingBenchmark-byFactor-1M-4 \
        ZipfianSequenceLoadingBenchmarkEffectiveHitrate-byFactor-1M-4 \
        RandomSequenceBenchmarkScanCount-bySize-4x80 \
        RandomSequenceBenchmarkScanCount-byHitrate-4x1M \
        RandomSequenceBenchmark-byHitrate-4-1M \
        RandomSequenceBenchmarkEffectiveHitrate-byHitrate-4-1M \
        RandomSequenceBenchmark-bySize-4x50 \
        ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-10M-5 \
        ZipfianSequenceLoadingBenchmarkStaticPeakMemory4-1M-5; do
  cpy $I;
done
