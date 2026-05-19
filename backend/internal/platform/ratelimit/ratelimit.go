// Package ratelimit exposes a tiny in-memory rate limiter used by the API
// handlers that should not be cheap to spam (login, AI chat).
//
// The Limiter interface intentionally hides the storage so a Phase 2
// migration to Redis or any distributed limiter can drop in without touching
// any handler call sites.
package ratelimit

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// Limiter decides whether a request keyed by an arbitrary string is allowed.
type Limiter interface {
	Allow(key string) bool
	// Reset wipes any stored state for the key. Useful for tests; production
	// callers normally do not need it.
	Reset(key string)
}

// InMemory is a per-key token bucket limiter. It refills `burst` tokens over
// `window` and keeps state in process memory. Suitable for a single-instance
// deployment; replace with a Redis-backed implementation when scaling out.
type InMemory struct {
	mu      sync.Mutex
	rate    rate.Limit
	burst   int
	buckets map[string]*entry
	stop    chan struct{}
	stopped bool
}

type entry struct {
	limiter  *rate.Limiter
	lastUsed time.Time
}

// New creates an in-memory limiter granting `burst` tokens per `window`.
// A janitor goroutine evicts buckets idle for more than 10*window to keep
// memory bounded under attack-style key fanout.
func New(burst int, window time.Duration) *InMemory {
	if burst <= 0 {
		burst = 1
	}
	if window <= 0 {
		window = time.Minute
	}
	limit := rate.Limit(float64(burst) / window.Seconds())
	l := &InMemory{
		rate:    limit,
		burst:   burst,
		buckets: map[string]*entry{},
		stop:    make(chan struct{}),
	}
	go l.runJanitor(window * 10)
	return l
}

func (l *InMemory) Allow(key string) bool {
	if key == "" {
		key = "_default"
	}
	l.mu.Lock()
	bucket, ok := l.buckets[key]
	if !ok {
		bucket = &entry{limiter: rate.NewLimiter(l.rate, l.burst)}
		l.buckets[key] = bucket
	}
	bucket.lastUsed = time.Now()
	l.mu.Unlock()
	return bucket.limiter.Allow()
}

func (l *InMemory) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.buckets, key)
}

// Stop releases the janitor goroutine. Idempotent.
func (l *InMemory) Stop() {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.stopped {
		return
	}
	l.stopped = true
	close(l.stop)
}

func (l *InMemory) runJanitor(idleAfter time.Duration) {
	ticker := time.NewTicker(idleAfter)
	defer ticker.Stop()
	for {
		select {
		case <-l.stop:
			return
		case now := <-ticker.C:
			l.evictIdle(now, idleAfter)
		}
	}
}

func (l *InMemory) evictIdle(now time.Time, idleAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for key, bucket := range l.buckets {
		if now.Sub(bucket.lastUsed) > idleAfter {
			delete(l.buckets, key)
		}
	}
}
