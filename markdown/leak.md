# Leak
Leak It


##  Why
* Bypass ASLR
* Reliable exploit
* Verify version


## What
* Pointers to heap
    - Chunks are in the heap mapping
* Pointers to GlibC
    - Main arena in Glibc's data section


## How #1 - read UAF
* Freed chunks contain pointers
* The user-data coincides with `fd`
* Reading freed chunk leaks pointers
* In FastBin/tcache - fd points to the next fast chunk
* In Unsorted/Normal bins point to bin's head or next chunk
    - Head is in `main_arena` - i.e.  glibc's data section
    - Next chunk is in the heap


## Leak - Example
```C
p0 = malloc(0x100);
malloc(0x20);
p1 = malloc(0x120);
malloc(0x30);
free(p0);
free(p1);
printf("libc: %p, heap: %p\n", *p0, *p1);
```

```C 
            unsorted_bin
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^-|-----------------------------------+
                 | |    
                 +-+               
                                            
         +------------------------------------------------------+
Heap     |wildreness                                            |
         +------------------------------------------------------+
         |
        top
                                          

```
<!-- .element: class="fragment fade-in" -->

```C 
            unsorted_bin
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^-|-----------------------------------+
                 | |    
                 +-+               

         +------------------------------------------------------+
Heap     |101|...      |wildreness                              |
         +------------------------------------------------------+
             |         |
             p0       top
                                          

```
<!-- .element: class="fragment fade-over" data-code-focus="1" -->

```C 
            unsorted_bin
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^-|-----------------------------------+
                 | |    
                 +-+               

         +------------------------------------------------------+
Heap     |101|...      |21|...|wildreness                       |
         +------------------------------------------------------+
             |                |
             p0              top
                                          

```
<!-- .element: class="fragment fade-over" data-code-focus="2" -->

```C 
            unsorted_bin
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^-|-----------------------------------+
                 | |    
                 +-+               

         +------------------------------------------------------+
Heap     |101|...      |21|...|121|...      |wildreness         |
         +------------------------------------------------------+
             |                    |         |
             p0                  p1        top

```
<!-- .element: class="fragment fade-over" data-code-focus="3" -->

```C 
            unsorted_bin
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^-|-----------------------------------+
                 | |    
                 +-+               

         +------------------------------------------------------+
Heap     |101|...      |21|...|121|...      |31|...|wildreness  |
         +------------------------------------------------------+
             |                    |                |
             p0                  p1               top

```
<!-- .element: class="fragment fade-over" data-code-focus="4" -->

```C 
            unsorted_bin
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^-|-----------------------------------+
                 | |    
              +--+ |               
              |+---+             
              ||                            
         +----|v------------------------------------------------+
Heap     |101|fd|bk|...|21|...|121|...      |31|...|wildreness  |
         +------------------------------------------------------+
             |                    |                |
             p0                  p1               top
                                          

```
<!-- .element: class="fragment fade-over" data-code-focus="5" -->

```C 
            unsorted_bin
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^-|-----------------------------------+
                 | |    
              +--+ +--------------+
              |                   |
              |                   |
         +----|-------------------v-----------------------------+
Heap     |101|fd|bk|...|21|...|121|fd|bk|...|31|...|wildreness  |
         +-----^--------------------|---------------------------+
             | |                  | |              |
             p0|                 p1 |             top
               +------------------- +

```
<!-- .element: class="fragment fade-over" data-code-focus="6" -->

```C 
            unsorted_bin
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^-|-----------------------------------+
                 | |    
              +--+ +--------------+
              |                   |
              |                   |
         +----|-------------------v-----------------------------+
Heap     |101|fd|bk|...|21|...|121|fd|bk|...|31|...|wildreness  |
         +-----^--------------------|---------------------------+
             | |                  | |              |
             p0|                 p1 |             top
               +------------------- +

```
<!-- .element: class="fragment fade-over" data-code-focus="7" -->

Note: TODO code highlighting and walkthrough


## How #2 - overlapping chunks

* Allocate readable data
* Enlarge freed previous chunk
* Split synth chunk (`alloc`)
* Heap overwrites data with pointers
* Read pointers
* Examples:
    - [Isaac's Blog: 0CTF 2017 Quals - Baby Heap 2017](https://poning.me/2017/03/24/baby-heap-2017/)
    - [UAFIO: 0ctf Quals 2017 - BabyHeap2017](http://uaf.io/exploitation/2017/03/19/0ctf-Quals-2017-BabyHeap2017.html)


## Why Not - Partial Overwrite
* Exploitation with partial overwrites
    - Free two chunks
    - Partially overwrite first point to second
    - Partially overwrie second to point to GlibC
* Use the brute-force
* Examples:
    - [@_tsuro HITCON 2017 CTF: Damocles](https://gist.github.com/sroettger/e1a7f8ca5007e2646b8f8ce068ca6166)
    - [my  HITCON 2017 CTF: Damocles](https://gist.github.com/yannayl/301537016fde0f6fa8c0bbccf88fa7f3)


## Why Not #2 - Relative Write
* Allocate mmapped page adjacent to GlibC
* Relative partially overwrite pointer 
* Example of relative **complete** overwrite: [Isaac's Blog: PlaidCTF 2017: bigpicture](https://poning.me/2017/04/28/bigpicture/)
    - There actually **was** a leak in the challenge, but I think it can be done even without the leak
