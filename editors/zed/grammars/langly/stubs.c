#define TS_HIDDEN
#include <string.h>
#include <stddef.h>

static char heap[1 << 20];
static size_t heap_pos = 0;

void *malloc(size_t size) {
    size_t aligned = (size + 7) & ~(size_t)7;
    if (heap_pos + aligned > sizeof(heap)) return 0;
    void *p = &heap[heap_pos];
    heap_pos += aligned;
    return p;
}

void *realloc(void *ptr, size_t size) {
    (void)size;
    return ptr;
}

void free(void *p) { (void)p; }

int memcmp(const void *a, const void *b, size_t n) {
    const unsigned char *x = a, *y = b;
    for (size_t i = 0; i < n; i++) {
        int d = x[i] - y[i];
        if (d) return d;
    }
    return 0;
}

void *memcpy(void *d, const void *s, size_t n) {
    char *dd = d; const char *ss = s;
    for (size_t i = 0; i < n; i++) dd[i] = ss[i];
    return d;
}

void *memmove(void *d, const void *s, size_t n) {
    unsigned char *dd = d; const unsigned char *ss = s;
    if (dd < ss) { for (size_t i=0; i<n; i++) dd[i]=ss[i]; }
    else { for (size_t i=n;i>0;) { --i; dd[i]=ss[i]; } }
    return d;
}

void *memset(void *d, int c, size_t n) {
    char *dd = d;
    for (size_t i = 0; i < n; i++) dd[i] = (char)c;
    return d;
}
