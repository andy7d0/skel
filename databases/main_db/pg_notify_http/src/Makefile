out=pg_notify_http

.SUFFIXES: .c

#CC=gcc
# For FreeBSD you should add -pthread to LDFLAGS.
CFLAGS=-DUNIX $(ARCH_FLAGS) -I/usr/include/postgresql $(add_CPPFLAGS) -g
LDFLAGS= $(ARCH_FLAGS) -lcurl -levent -lpq -largp -g

OBJS=$(out).o
$(out): $(OBJS)
	$(CC) $(OBJS) $(LDFLAGS)  -o $@ $(add_libs)
clean:
	for i in $(out) $(OBJS) ; do test -r "$$i" || continue ; rm "$$i" ; done
.c.o:
	$(CC) $(CFLAGS) -c -o $@ $<