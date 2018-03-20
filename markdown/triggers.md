# Flow Hijacking
Become a Wizard


## GlibC Malloc Hooks
* `__free_hook()`, `__malloc_hook()`, `realloc_hook()`
    ```C
    void * __libc_malloc (size_t bytes) {
      void *(*hook) (size_t, const void *) =
        atomic_forced_read (__malloc_hook);
      if (__builtin_expect (hook != NULL, 0))
        return (*hook)(bytes, RETURN_ADDRESS (0));
    ```
* Attacker invokes API calls
* May also be reached from I/O system
* Example: [UAFIO: 0ctf Quals 2017 - BabyHeap2017](http://uaf.io/exploitation/2017/03/19/0ctf-Quals-2017-BabyHeap2017.html)

Note: IO system - printf uses malloc/realloc/free internally when sizes are large engouh


## GlibC dlopen Hook
* `_dl_open_hook->dlopen_mode()`
* Invoked upon `dlopen`
* Attacker can esily trigger it:
    - design detectable error => `malloc_printerr` => print backtrace => dlopen
* Naturally combined with frontlink attack
* Write-up:
    - PoC||GTFO 0x18 - House of fun

Note:
Since GlibC 2.27 `malloc_printerr` simply exits


## GlibC FILE Struct
* `_IO_list_all->_vtable.__overflow()`
* Invoked upon process termination
* Attacker can easily triggrer it similar to `_dlopn_hook`
* Partially mitigated with `IO_validate_vtable` 
* Write-ups:
    - The original [House of Orange](http://4ngelboy.blogspot.lu/2016/10/hitcon-ctf-qual-2016-house-of-orange.html)
    - With [mitigation bypass](https://github.com/chksum0/writeups/blob/master/34c3/300/writeup.md)


## `malloc_printerr` Mitigation
* Version 2.27
* `malloc_printerr` calls `abort`
* Mitigate (complicate) use of process termination hooks
    - dlopen
    - File Struct


## Program's Specific
* Return Addresses
* Vtables
* Function Pointers
