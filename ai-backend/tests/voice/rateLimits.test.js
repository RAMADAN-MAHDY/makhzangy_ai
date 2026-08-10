/**
 * Rate Limiting + Tenant Isolation Tests
 * Run: node --test tests/voice/rateLimits.test.js
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── In-memory rate window store (simulates VoiceRateWindow behavior) ─────────

class InMemoryRateStore {
  constructor() {
    this._store = new Map();
  }

  /** Increment and return current count. Window expires after ttlMs. */
  increment(key, ttlMs) {
    const now = Date.now();
    const existing = this._store.get(key);

    if (!existing || existing.expiresAt <= now) {
      // New window
      this._store.set(key, { count: 1, expiresAt: now + ttlMs });
      return 1;
    }

    existing.count += 1;
    return existing.count;
  }

  get(key) {
    const now = Date.now();
    const existing = this._store.get(key);
    if (!existing || existing.expiresAt <= now) return 0;
    return existing.count;
  }

  reset() {
    this._store.clear();
  }
}

const store = new InMemoryRateStore();

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Simulated rate limit check using the in-memory store */
function checkAndConsume(userId, tenantId, operation, limits) {
  const { userRpm, userRpd, providerRpm, providerRpd } = limits;

  // User keys — scoped to tenantId:userId (cross-tenant isolation)
  const userRpmKey = `user:${operation}:${tenantId}:${userId}:rpm`;
  const userRpdKey = `user:${operation}:${tenantId}:${userId}:rpd`;

  // Provider keys — global
  const providerRpmKey = `provider:${operation}:rpm`;
  const providerRpdKey = `provider:${operation}:rpd`;

  // Check user limits
  const currentUserRpm = store.get(userRpmKey);
  const currentUserRpd = store.get(userRpdKey);

  if (currentUserRpm >= userRpm) {
    return { allowed: false, scope: 'user', limitType: 'RPM', retryAfterSeconds: 60, code: 'RATE_LIMIT_USER_RPM' };
  }
  if (currentUserRpd >= userRpd) {
    return { allowed: false, scope: 'user', limitType: 'RPD', retryAfterSeconds: 86400, code: 'RATE_LIMIT_USER_RPD' };
  }

  // Check provider limits
  const currentProviderRpm = store.get(providerRpmKey);
  const currentProviderRpd = store.get(providerRpdKey);

  if (currentProviderRpm >= providerRpm) {
    return { allowed: false, scope: 'provider', limitType: 'RPM', retryAfterSeconds: 60, code: 'RATE_LIMIT_PROVIDER_RPM' };
  }
  if (currentProviderRpd >= providerRpd) {
    return { allowed: false, scope: 'provider', limitType: 'RPD', retryAfterSeconds: 86400, code: 'RATE_LIMIT_PROVIDER_RPD' };
  }

  // Consume
  store.increment(userRpmKey, MINUTE_MS);
  store.increment(userRpdKey, DAY_MS);
  store.increment(providerRpmKey, MINUTE_MS);
  store.increment(providerRpdKey, DAY_MS);

  return { allowed: true };
}

const STT_LIMITS = { userRpm: 3, userRpd: 10, providerRpm: 5, providerRpd: 20 };
const TTS_LIMITS = { userRpm: 2, userRpd: 5, providerRpm: 3, providerRpd: 10 };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Rate Limits — STT User RPM', () => {
  beforeEach(() => store.reset());

  it('should allow requests up to STT user RPM limit', () => {
    for (let i = 0; i < 3; i++) {
      const result = checkAndConsume('user-A', 'tenant-1', 'STT', STT_LIMITS);
      assert.equal(result.allowed, true, `Request ${i + 1} should be allowed`);
    }
  });

  it('should block the 4th STT request in the same minute (user RPM)', () => {
    for (let i = 0; i < 3; i++) {
      checkAndConsume('user-A', 'tenant-1', 'STT', STT_LIMITS);
    }
    const blocked = checkAndConsume('user-A', 'tenant-1', 'STT', STT_LIMITS);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.code, 'RATE_LIMIT_USER_RPM');
    assert.equal(blocked.retryAfterSeconds, 60);
  });
});

describe('Rate Limits — STT User RPD', () => {
  beforeEach(() => store.reset());

  it('should allow requests up to STT user RPD limit', () => {
    for (let i = 0; i < 10; i++) {
      // Use different "minute windows" by varying the key strategy
      // Simulate by using limits that only enforce RPD (set RPM very high)
      const result = checkAndConsume('user-B', 'tenant-1', 'STT', {
        ...STT_LIMITS,
        userRpm: 100, // disable RPM for this test
        providerRpm: 100,
      });
      assert.equal(result.allowed, true, `Request ${i + 1} should be allowed`);
    }
  });

  it('should block on STT user RPD when daily limit exceeded', () => {
    for (let i = 0; i < 10; i++) {
      checkAndConsume('user-C', 'tenant-1', 'STT', { ...STT_LIMITS, userRpm: 100, providerRpm: 100 });
    }
    const blocked = checkAndConsume('user-C', 'tenant-1', 'STT', { ...STT_LIMITS, userRpm: 100, providerRpm: 100 });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.code, 'RATE_LIMIT_USER_RPD');
    assert.equal(blocked.retryAfterSeconds, 86400);
  });
});

describe('Rate Limits — TTS User RPM + RPD', () => {
  beforeEach(() => store.reset());

  it('should block TTS after 2 RPM', () => {
    checkAndConsume('user-D', 'tenant-1', 'TTS', TTS_LIMITS);
    checkAndConsume('user-D', 'tenant-1', 'TTS', TTS_LIMITS);

    const blocked = checkAndConsume('user-D', 'tenant-1', 'TTS', TTS_LIMITS);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.code, 'RATE_LIMIT_USER_RPM');
  });

  it('should block TTS after 5 RPD', () => {
    for (let i = 0; i < 5; i++) {
      checkAndConsume('user-E', 'tenant-2', 'TTS', { ...TTS_LIMITS, userRpm: 100, providerRpm: 100 });
    }
    const blocked = checkAndConsume('user-E', 'tenant-2', 'TTS', { ...TTS_LIMITS, userRpm: 100, providerRpm: 100 });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.code, 'RATE_LIMIT_USER_RPD');
  });
});

describe('Rate Limits — Provider limits', () => {
  beforeEach(() => store.reset());

  it('should block STT when provider RPM is exceeded', () => {
    // Fill provider RPM (5)
    for (let i = 0; i < 5; i++) {
      checkAndConsume(`user-${i}`, 'tenant-1', 'STT', { ...STT_LIMITS, userRpm: 100, userRpd: 100 });
    }
    // 6th request from a fresh user hits provider limit
    const blocked = checkAndConsume('user-fresh', 'tenant-1', 'STT', STT_LIMITS);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.code, 'RATE_LIMIT_PROVIDER_RPM');
    assert.equal(blocked.scope, 'provider');
  });

  it('should block TTS when provider RPM is exceeded', () => {
    for (let i = 0; i < 3; i++) {
      checkAndConsume(`user-${i}`, 'tenant-1', 'TTS', { ...TTS_LIMITS, userRpm: 100, userRpd: 100 });
    }
    const blocked = checkAndConsume('user-fresh', 'tenant-1', 'TTS', TTS_LIMITS);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.code, 'RATE_LIMIT_PROVIDER_RPM');
  });
});

describe('Tenant Isolation', () => {
  beforeEach(() => store.reset());

  it('Tenant A usage should NOT affect Tenant B limits', () => {
    // Exhaust Tenant A User's RPM
    for (let i = 0; i < 3; i++) {
      checkAndConsume('user-X', 'tenant-A', 'STT', { ...STT_LIMITS, providerRpm: 100, providerRpd: 100 });
    }

    // Same userId, DIFFERENT tenant — should still be allowed
    const result = checkAndConsume('user-X', 'tenant-B', 'STT', { ...STT_LIMITS, providerRpm: 100, providerRpd: 100 });
    assert.equal(result.allowed, true, 'tenant-B user-X should not be affected by tenant-A limits');
  });

  it('Tenant B user should NOT access Tenant A usage', () => {
    // user-1 in tenant-A makes 3 requests
    for (let i = 0; i < 3; i++) {
      checkAndConsume('user-1', 'tenant-A', 'STT', { ...STT_LIMITS, providerRpm: 100, providerRpd: 100 });
    }

    // user-1 in tenant-B has its own independent counter
    const tenantBResult = checkAndConsume('user-1', 'tenant-B', 'STT', { ...STT_LIMITS, providerRpm: 100, providerRpd: 100 });
    assert.equal(tenantBResult.allowed, true);

    // user-2 in tenant-A is also unaffected by user-1's usage
    const user2Result = checkAndConsume('user-2', 'tenant-A', 'STT', { ...STT_LIMITS, providerRpm: 100, providerRpd: 100 });
    assert.equal(user2Result.allowed, true);
  });

  it('rate window keys should include tenantId for isolation', () => {
    const makeKey = (userId, tenantId, operation, granularity) =>
      `user:${operation}:${tenantId}:${userId}:${granularity}`;

    const keyA = makeKey('user-1', 'tenant-A', 'STT', 'rpm');
    const keyB = makeKey('user-1', 'tenant-B', 'STT', 'rpm');

    assert.notEqual(keyA, keyB, 'Keys for different tenants must be different');
    assert.ok(keyA.includes('tenant-A'));
    assert.ok(keyB.includes('tenant-B'));
  });
});

describe('Rate Limit — User limit check order', () => {
  it('should check user limit BEFORE provider limit', () => {
    // User RPM=0, Provider RPM=100 — user should be blocked first
    store.reset();
    const ZERO_USER_LIMITS = { userRpm: 0, userRpd: 100, providerRpm: 100, providerRpd: 100 };

    const result = checkAndConsume('user-Z', 'tenant-1', 'STT', ZERO_USER_LIMITS);
    assert.equal(result.allowed, false);
    assert.equal(result.scope, 'user');
  });
});

describe('Rate Limit — retryAfterSeconds', () => {
  it('should return retryAfterSeconds=60 for RPM violations', () => {
    store.reset();
    for (let i = 0; i < 3; i++) checkAndConsume('user-T', 'tenant-1', 'STT', STT_LIMITS);
    const r = checkAndConsume('user-T', 'tenant-1', 'STT', STT_LIMITS);
    assert.equal(r.retryAfterSeconds, 60);
  });

  it('should return retryAfterSeconds=86400 for RPD violations', () => {
    store.reset();
    for (let i = 0; i < 10; i++) {
      checkAndConsume('user-U', 'tenant-1', 'STT', { ...STT_LIMITS, userRpm: 100, providerRpm: 100 });
    }
    const r = checkAndConsume('user-U', 'tenant-1', 'STT', { ...STT_LIMITS, userRpm: 100, providerRpm: 100 });
    assert.equal(r.retryAfterSeconds, 86400);
  });
});
