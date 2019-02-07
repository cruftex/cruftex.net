
BASE=/home/jeans/ideaWork/cache2k-internal
CMS=$BASE/jmh-result-20170324-CMS-1M-4T-2fullWarumups
G1=$BASE/jmh-result-20170324-G1-1M-4T-2fullWarumups

cpy() {
echo $1...
cp -a $CMS/$1-notitle.svg CMS/
cp -a $G1/$1-notitle.svg G1/
cp -a $CMS/$1-notitle-print.svg CMS/
cp -a $G1/$1-notitle-print.svg G1/
cp -a $CMS/$1.dat CMS/
cp -a $G1/$1.dat G1/
}

for I in ZipfianSequenceLoadingBenchmark \
         ZipfianSequenceLoadingBenchmarkMemoryUsed4-1M-10 \
         ZipfianSequenceLoadingBenchmarkMemory4-1M-10-total \
         ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRate \
         ZipfianSequenceLoadingBenchmarkMemory4-1M-10-allocRatePerOp \
         ZipfianSequenceLoadingBenchmarkMemory4-1M-10-VmHWM-sorted \
         ZipfianSequenceLoadingBenchmarkMemory4-1M-10-usedHeap-sorted; do
  cpy $I;
done
