# Setup
Let's get our hands dirty


## GlibC Version

Native libc version different than target use `LD_PRELOAD`
```python
from pwn import *

libc = ELF('./libc.so.6')
main = ELF('./300')
r = main.process(env={'LD_PRELOAD' : libc.path})
```

* If not provided, use libc search database: https://libc.blukat.me/
* Loader and Libc dependencies may screw you over :/


## Symbols

* libc is part of a distro
    - e.g. Ubuntu 17.10
* Use distro's symbols
    - e.g. [libc6-dbg](https://launchpad.net/~ubuntu-security/+archive/ubuntu/ppa/+build/12759262/+files/libc6-dbg_2.24-9ubuntu2.2_amd64.deb) 
* Unapck and load debug file to gdb using `add-symbol-file`
    ```python
    def gdb_load_symbols_cmd(sym_file, elf, base):
        sec_str = []
        for s in elf.sections:
            if not s.name or not s.header.sh_addr:
                continue

            sec_str.append('-s {} 0x{:x}'.format(s.name, base + s.header.sh_addr))

        text_addr = elf.get_section_by_name('.text').header.sh_addr + base
        return 'add-symbol-file {} 0x{:x} {} \n'.format(sym_file, text_addr, ' '.join(sec_str))

    dbg_file = './libc-2.24.debug'
    gdb.attach(r,
        gdb_load_symbols_cmd(dbg_file, libc, r.libs()[libc.path]))
    ```


## Sources

* libc is part of a distro
    - e.g. Ubuntu 17.10
* Distros provide sources
    - e.g. [glibc-source](https://launchpad.net/~ubuntu-security/+archive/ubuntu/ppa/+build/12759262/+files/glibc-source_2.24-9ubuntu2.2_all.deb)
* Unpack it and let gdb find it using the `substitute-path` command
    ```python
    gdb.attach(r,
        gdb_load_symbols_cmd(dbg_file, libc, r.libs()[libc.path])) + """
        set substitute-path /build/glibc-mXZSwJ ./glibc-src
        """
    ```
    - The original source can be found using `info source`



## Putting It All Together

```python
from pwn import *

libc = ELF('./libc.so.6')
main = ELF('./300')
dbg_file = './libc-2.24.debug'

r = main.process(env={'LD_PRELOAD' : libc.path})

def gdb_load_symbols_cmd(sym_file, elf, base):
    sec_str = []
    for s in elf.sections:
        if not s.name or not s.header.sh_addr:
            continue

        sec_str.append('-s {} 0x{:x}'.format(s.name, base + s.header.sh_addr))

    text_addr = elf.get_section_by_name('.text').header.sh_addr + base
    return 'add-symbol-file {} 0x{:x} {} \n'.format(sym_file, text_addr, ' '.join(sec_str))

gdb.attach(r,
    gdb_load_symbols_cmd(dbg_file, libc, r.libs()[libc.path]) + """
    set substitute-path /build/glibc-mXZSwJ ./glibc-src
    b malloc""")

r.interactive()
```
