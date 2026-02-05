# Remediation Plan — Bills & Reminders Security + Data Integrity Fixes

## Overview

This plan addresses **27 identified issues** (6 Critical, 12 Medium, 9 Low) discovered during design review of the implementation plan. The fixes are staged in 3 progressive phases to maintain a clean git history and allow testing at each stage.

**Key Changes:**
- Implement HttpOnly refresh token rotation with session tracking (C2)
- Add database constraints for cascades and ownership enforcement (C6, C5)
- Fix overdue logic and bill cycle advancement bugs (C4, C3)
- Add validation, indexes, and rate limiting (Medium issues)
- Improve UX and testing coverage (Low issues)

---

## Phase 1: CRITICAL FIXES (Issues C1-C6)

### 1.1 Schema Changes — Refresh Token + Cascades + Constraints

**Updated Prisma Schema:**

```prisma
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String
  createdAt     DateTime       @default(now())
  bills         Bill[]
  reminderRules ReminderRule[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessionId    String   @unique  // reuse detection
  familyId     String              // rotation tracking
  token        String   @unique     // hashed refresh token
  expiresAt    DateTime
  isRevoked    Boolean  @default(false)
  createdAt    DateTime @default(now())
  
  @@index([userId, isRevoked])
  @@index([sessionId])
  @@index([familyId])
  @@index([expiresAt])
}

model Bill {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  amount        Decimal?      @db.Decimal(10, 2)  // M1: still nullable, but validated in service
  currency      String?       // M2: will be validated against ISO 4217 in Zod
  isRecurring   Boolean
  frequency     Frequency?    
  dueDate       DateTime      
  nextDueDate   DateTime      
  lastPaidAt    DateTime?     
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt  // L3: explicit @updatedAt
  reminderRule  ReminderRule?
  
  @@index([userId])            // M11: performance
  @@index([nextDueDate])       // M11: dashboard queries
  @@index([userId, isActive])  // composite for active bills
}

model ReminderRule {
  id              String         @id @default(cuid())
  billId          String         @unique
  bill            Bill           @relation(fields: [billId], references: [id], onDelete: Cascade)  // C6: cascade
  offsetDays      Int            @default(0)
  remindAt        DateTime       
  status          ReminderStatus @default(PENDING)
  dismissedUntil  DateTime?      
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt  // L3
  
  @@index([remindAt])           // M11: reminder queries
  @@index([status, remindAt])   // composite for active reminders
}

enum Frequency {
  MONTHLY
  WEEKLY
  YEARLY
}

enum ReminderStatus {
  PENDING
  DISMISSED
}
```

**Key Changes:**
- **C6**: Added `onDelete: Cascade` to Bill → ReminderRule and User → all relations
- **C2**: New `RefreshToken` model with sessionId (reuse detection), familyId (rotation tracking)
- **M4**: Removed redundant `ReminderRule.userId` (derivable via billId → Bill.userId)
- **M11**: Added indexes on `Bill.nextDueDate`, `Bill.userId`, `ReminderRule.remindAt`
- **L3**: Added explicit `@updatedAt` to Bill and ReminderRule
- **M1**: Added DB constraint `@db.Decimal(10, 2)` for amount (validation in service layer)

**Migration Command:**
```bash
npx prisma migrate dev --name "add-refresh-tokens-and-cascades"
```

---

### 1.2 Auth Module — Refresh Token Rotation (C2 + C1)

**New Files:**
- `src/modules/auth/refreshToken.service.ts`: Token generation, rotation, revocation
- `src/modules/auth/refreshToken.repository.ts`: DB operations for refresh tokens

**Endpoints:**

#### Updated: POST /api/auth/login & POST /api/auth/register
- Return: `{ user: { id, email } }` (L5 fix: no need for /me call)
- Set HttpOnly cookie: `refreshToken` (7d expiry)
- Issue short-lived JWT in response body (15min exp)

#### New: POST /api/auth/refresh
- Read `refreshToken` from HttpOnly cookie
- Validate + check reuse (if sessionId exists, revoke entire family)
- Issue new JWT (response body) + new refresh token (HttpOnly cookie)
- Revoke old refresh token
- Return: `{ token, user }`

#### New: POST /api/auth/logout
- Revoke refresh token by sessionId
- Clear HttpOnly cookie
- Return 204

**Security Enhancements:**
- C1: Update CORS config to `credentials: true` (required for HttpOnly cookies)
- JWT exp reduced from 7d → 15min
- Refresh token exp: 7d, but auto-rotates on each /refresh call
- Reuse detection: If a revoked sessionId is presented, revoke entire familyId

**Files Changed:**
- `src/app.ts`: Update CORS to `{ origin: FRONTEND_URL, credentials: true }`
- `src/modules/auth/routes.ts`: Add /refresh, /logout routes
- `src/modules/auth/controller.ts`: Update login/register to set cookies
- Frontend axios config: Add `withCredentials: true`

---

### 1.3 Bill Logic Fixes (C3 + C4)

**C3: computeNextDueDate — Add Max Iteration Cap**

```typescript
// src/utils/dates.ts
export function computeNextDueDate({
  isRecurring,
  frequency,
  dueDate,
  now = new Date()
}: ComputeNextDueDateParams): Date {
  if (!isRecurring) {
    return dueDate;
  }
  
  let nextDue = new Date(dueDate);
  let iterations = 0;
  const MAX_ITERATIONS = 500; // C3: hard cap (500 weeks = ~9.6 years)
  
  while (nextDue < now && iterations < MAX_ITERATIONS) {
    nextDue = advanceOneCycle(nextDue, frequency);
    iterations++;
  }
  
  if (iterations >= MAX_ITERATIONS) {
    // Fallback: set to next cycle from now
    console.warn(`computeNextDueDate hit max iterations for bill with dueDate: ${dueDate}`);
    return advanceOneCycle(now, frequency);
  }
  
  return nextDue;
}
```

**C4: Fix Overdue Logic — Check Before Advancing**

```typescript
// src/modules/bills/service.ts - payBill() method

async payBill(billId: string, userId: string, paidAt: Date = new Date()) {
  const bill = await this.repository.findById(billId, userId);
  
  if (!bill) throw new NotFoundError('Bill not found');
  if (!bill.isActive) throw new BadRequestError('Cannot pay inactive bill'); // M9
  
  // C4 FIX: Update lastPaidAt BEFORE advancing nextDueDate
  // This prevents false overdue window
  await this.repository.update(billId, { lastPaidAt: paidAt });
  
  if (bill.isRecurring) {
    const newNextDueDate = advanceOneCycle(bill.nextDueDate, bill.frequency);
    await this.repository.update(billId, { nextDueDate: newNextDueDate });
    
    // M3: Update remindAt when nextDueDate changes
    if (bill.reminderRule) {
      const newRemindAt = computeRemindAt(newNextDueDate, bill.reminderRule.offsetDays);
      await reminderService.updateRemindAt(bill.reminderRule.id, newRemindAt);
    }
  } else {
    await this.repository.update(billId, { isActive: false });
  }
  
  return this.repository.findById(billId, userId);
}
```

---

### 1.4 Reminder Ownership Enforcement (C5)

**Add Ownership Checks:**

```typescript
// src/modules/reminders/service.ts

async updateReminderRule(id: string, userId: string, data: UpdateReminderData) {
  // C5 FIX: Verify ownership via Bill relation
  const rule = await prisma.reminderRule.findUnique({
    where: { id },
    include: { bill: true }
  });
  
  if (!rule || rule.bill.userId !== userId) {
    throw new NotFoundError('Reminder rule not found');
  }
  
  // ... rest of update logic
}

async dismissReminder(id: string, userId: string, days: number = 1) {
  const rule = await this.getOwnedRule(id, userId); // C5: ownership helper
  
  const dismissedUntil = addDays(new Date(), days);
  return prisma.reminderRule.update({
    where: { id },
    data: {
      status: 'DISMISSED',
      dismissedUntil
    }
  });
}

// Helper method
private async getOwnedRule(id: string, userId: string) {
  const rule = await prisma.reminderRule.findUnique({
    where: { id },
    include: { bill: true }
  });
  
  if (!rule || rule.bill.userId !== userId) {
    throw new NotFoundError('Reminder rule not found');
  }
  
  return rule;
}
```

**Files Changed:**
- `src/modules/reminders/routes.ts`: All routes now pass userId to service
- `src/modules/reminders/service.ts`: Add ownership checks to PATCH, dismiss, undismiss
- `src/middleware/auth.ts`: Ensure userId is attached to req.user

---

### 1.5 Testing — Critical Path Coverage

**New Tests (Jest + Supertest):**

```typescript
// tests/auth.test.ts
describe('Refresh Token Flow', () => {
  it('should issue refresh token on login and rotate on /refresh', async () => { /* C2 */ });
  it('should detect reuse and revoke family', async () => { /* C2 reuse detection */ });
  it('should logout and revoke refresh token', async () => { /* C2 */ });
});

// tests/bills.test.ts
describe('computeNextDueDate', () => {
  it('should handle past dates with WEEKLY frequency', async () => { /* C3 */ });
  it('should cap at MAX_ITERATIONS and fallback', async () => { /* C3 */ });
});

describe('payBill', () => {
  it('should update lastPaidAt before advancing nextDueDate', async () => { /* C4 */ });
  it('should not create false overdue window', async () => { /* C4 */ });
});

// tests/reminders.test.ts
describe('Reminder Ownership', () => {
  it('should reject PATCH from non-owner', async () => { /* C5 */ });
  it('should reject dismiss from non-owner', async () => { /* C5 */ });
});

// tests/cascade.test.ts
describe('Cascade Deletes', () => {
  it('should delete reminderRule when bill is deleted', async () => { /* C6 */ });
  it('should delete bills and reminders when user is deleted', async () => { /* C6 */ });
});
```

**Commits for Phase 1:**
- `feat: add refresh token model with session tracking (C2)`
- `feat: implement refresh token rotation and reuse detection (C2)`
- `fix: add onDelete cascade to bill and reminder relations (C6)`
- `fix: cap computeNextDueDate iterations and add fallback (C3)`
- `fix: update lastPaidAt before advancing cycle (C4)`
- `fix: enforce reminder ownership on PATCH/dismiss/undismiss (C5)`
- `fix: enable CORS credentials for httponly cookies (C1)`
- `test: add critical path tests (C2-C6)`

---

## Phase 2: MEDIUM FIXES (Issues M1-M12)

### 2.1 Validation Improvements (M2, M7, M8, M10)

**M2: Currency ISO 4217 Validation**

```typescript
// src/modules/bills/validators.ts
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', /* ... ISO 4217 list */];

const billSchema = z.object({
  currency: z.string().refine(
    (val) => !val || VALID_CURRENCIES.includes(val.toUpperCase()),
    { message: 'Invalid ISO 4217 currency code' }
  ).optional(),
  // ...
});
```

**M7: Warn on Past Due Dates for One-Time Bills**

```typescript
// src/modules/bills/service.ts - createBill()
if (!isRecurring && dueDate < new Date()) {
  console.warn(`Creating one-time bill with past due date: ${dueDate}`);
  // Still allow creation, but log for monitoring
}
```

**M8: Cross-Field Validation**

```typescript
const billSchema = z.object({
  isRecurring: z.boolean(),
  frequency: z.enum(['MONTHLY', 'WEEKLY', 'YEARLY']).nullable(),
  // ...
}).refine(
  (data) => !data.isRecurring || data.frequency !== null,
  { message: 'Recurring bills must have a frequency', path: ['frequency'] }
);
```

**M10: Dashboard Query Validation**

```typescript
// src/modules/dashboard/validators.ts
const overviewQuerySchema = z.object({
  days: z.string().optional().default('7').transform(Number).pipe(
    z.number().int().min(1).max(365)
  )
});
```

---

### 2.2 Pagination (M6)

**Add Pagination to GET /api/bills:**

```typescript
// src/modules/bills/routes.ts
router.get('/', auth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  
  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where: { userId: req.user.id },
      skip,
      take: limit,
      orderBy: { nextDueDate: 'asc' }
    }),
    prisma.bill.count({ where: { userId: req.user.id } })
  ]);
  
  res.json({
    data: bills,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});
```

---

### 2.3 Rate Limiting Expansion (M12)

**Update app.ts:**

```typescript
// src/app.ts
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many auth requests'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // M12: rate limit all API endpoints
  message: 'Too many requests'
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);
```

---

### 2.4 Null Handling & Derived Field Sync (M1, M3)

**M1: Amount Null Handling**

```typescript
// src/modules/bills/service.ts
async getBillsWithAggregates(userId: string) {
  const bills = await prisma.bill.findMany({ where: { userId } });
  
  // Sum only non-null amounts
  const totalDue = bills
    .filter(b => b.amount !== null && b.isActive)
    .reduce((sum, b) => sum + Number(b.amount), 0);
    
  return { bills, totalDue };
}
```

**M3: Sync remindAt on nextDueDate Changes**

```typescript
// src/modules/bills/service.ts - updateBill()
async updateBill(id: string, userId: string, data: UpdateBillData) {
  const bill = await this.repository.findById(id, userId);
  
  if (data.dueDate || data.isRecurring !== undefined || data.frequency) {
    // Recompute nextDueDate
    data.nextDueDate = computeNextDueDate({ /* ... */ });
    
    // M3: Sync remindAt if rule exists
    if (bill.reminderRule) {
      const newRemindAt = computeRemindAt(data.nextDueDate, bill.reminderRule.offsetDays);
      await prisma.reminderRule.update({
        where: { billId: id },
        data: { remindAt: newRemindAt }
      });
    }
  }
  
  return this.repository.update(id, data);
}
```

---

### 2.5 Query Param Validation (M5)

**Add Zod Validation to GET /api/reminders:**

```typescript
// src/modules/reminders/validators.ts
const getReminderQuerySchema = z.object({
  status: z.enum(['PENDING', 'DISMISSED']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
}).refine(
  (data) => !data.from || !data.to || new Date(data.from) <= new Date(data.to),
  { message: 'from must be before to' }
);
```

---

### 2.6 Code Consolidation (M2 overlap with L2 addressed in Low)

**Commits for Phase 2:**
- `feat: add ISO 4217 currency validation (M2)`
- `feat: add pagination to GET /api/bills (M6)`
- `feat: extend rate limiting to all API routes (M12)`
- `fix: add cross-field validation for recurring bills (M8)`
- `fix: sync remindAt on all nextDueDate updates (M3)`
- `fix: validate dashboard and reminder query params (M5, M10)`
- `fix: handle null amounts in dashboard aggregations (M1)`
- `refactor: add warning for past due dates on one-time bills (M7)`

---

## Phase 3: LOW PRIORITY (Issues L1-L9)

### 3.1 dismissedUntil Auto-Revert (L1)

**Approach: Query-time filtering instead of background job**

```typescript
// src/modules/reminders/service.ts
async getActionableReminders(userId: string) {
  const now = new Date();
  
  const reminders = await prisma.reminderRule.findMany({
    where: {
      bill: { userId, isActive: true },
      remindAt: { lte: now },
      OR: [
        { status: 'PENDING' },
        { status: 'DISMISSED', dismissedUntil: { lte: now } } // L1: auto-revert
      ]
    }
  });
  
  // Optionally update status back to PENDING inline:
  const toRevert = reminders.filter(r => r.status === 'DISMISSED' && r.dismissedUntil <= now);
  if (toRevert.length > 0) {
    await prisma.reminderRule.updateMany({
      where: { id: { in: toRevert.map(r => r.id) } },
      data: { status: 'PENDING', dismissedUntil: null }
    });
  }
  
  return reminders;
}
```

---

### 3.2 Consolidate Date Logic (L2)

**Merge computeNextDueDate and advanceOneCycle:**

```typescript
// src/utils/dates.ts
export function advanceOneCycle(date: Date, frequency: Frequency): Date {
  const next = new Date(date);
  switch (frequency) {
    case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
    case 'WEEKLY': next.setDate(next.getDate() + 7); break;
    case 'YEARLY': next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

export function computeNextDueDate(params: ComputeParams): Date {
  if (!params.isRecurring) return params.dueDate;
  
  let nextDue = new Date(params.dueDate);
  let iterations = 0;
  const MAX_ITERATIONS = 500;
  
  while (nextDue < params.now && iterations < MAX_ITERATIONS) {
    nextDue = advanceOneCycle(nextDue, params.frequency); // L2: reuse
    iterations++;
  }
  
  return iterations >= MAX_ITERATIONS 
    ? advanceOneCycle(params.now, params.frequency)
    : nextDue;
}
```

---

### 3.3 Frontend Improvements (L4, L5, L6)

**L4: Add Loading/Error/Empty States**

```vue
<!-- src/components/BillsList.vue -->
<template>
  <div>
    <LoadingSpinner v-if="loading" />
    <ErrorMessage v-else-if="error" :message="error" />
    <EmptyState v-else-if="bills.length === 0" message="No bills yet. Create one to get started." />
    <BillCard v-else v-for="bill in bills" :key="bill.id" :bill="bill" />
  </div>
</template>
```

**L5: Return User in Login/Register** (Already fixed in C2)

**L6: Content-Type Validation Middleware**

```typescript
// src/middleware/contentType.ts
export function requireJson(req, res, next) {
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: { code: 'INVALID_CONTENT_TYPE', message: 'Content-Type must be application/json' }
      });
    }
  }
  next();
}

// Apply to all JSON routes
app.use('/api', requireJson);
```

---

### 3.4 Enhanced Testing (L7)

**Add Missing Test Cases:**

```typescript
// tests/reminders.test.ts
describe('remindAt computation', () => {
  it('should compute remindAt = nextDueDate - offsetDays', async () => {});
});

// tests/bills.test.ts
describe('cross-field validation', () => {
  it('should reject isRecurring:true without frequency', async () => {});
});

describe('overdue derivation', () => {
  it('should mark overdue if nextDueDate < now and unpaid', async () => {});
  it('should not mark overdue if lastPaidAt >= nextDueDate', async () => {});
});

// tests/dashboard.test.ts
describe('dashboard aggregations', () => {
  it('should return overdue, due soon, and actionable reminders', async () => {});
  it('should respect ?days param for dueSoon threshold', async () => {});
});

// tests/pay.test.ts
describe('double-pay guard', () => {
  it('should prevent paying same bill twice in quick succession', async () => { /* L9 */ });
});
```

---

### 3.5 Email Security (L8)

**Sanitize Email Provider Errors:**

```typescript
// src/modules/reminders/email.service.ts
async sendReminderEmail(reminder: ReminderRule) {
  try {
    await emailProvider.send({ /* ... */ });
    return { success: true };
  } catch (error) {
    // L8: Don't leak provider internals
    console.error('Email send failed:', error);
    return { 
      success: false, 
      error: 'Failed to send email. Please try again later.' 
    };
  }
}
```

---

### 3.6 Idempotency on /pay (L9)

**Add Optimistic Locking or Recent Payment Check:**

```typescript
// src/modules/bills/service.ts
async payBill(billId: string, userId: string, paidAt: Date = new Date()) {
  const bill = await this.repository.findById(billId, userId);
  
  // L9: Prevent double-pay within 5 seconds
  if (bill.lastPaidAt) {
    const timeSinceLastPay = paidAt.getTime() - bill.lastPaidAt.getTime();
    if (timeSinceLastPay < 5000) {
      throw new BadRequestError('Bill was recently paid. Please wait before paying again.');
    }
  }
  
  // ... rest of pay logic
}
```

---

**Commits for Phase 3:**
- `feat: add dismissedUntil auto-revert on query (L1)`
- `refactor: consolidate date advance logic (L2)`
- `feat: add content-type validation middleware (L6)`
- `feat: add loading/error/empty UI states (L4)`
- `fix: sanitize email provider errors (L8)`
- `fix: add double-pay guard with time threshold (L9)`
- `test: expand test coverage for edge cases (L7)`

---

## Summary

### Total Commits: ~25 meaningful commits across 3 phases

**Phase 1 (Critical):** 8 commits  
**Phase 2 (Medium):** 8 commits  
**Phase 3 (Low):** 7 commits  
**Documentation:** 2 commits (update README with security notes, testing strategy)

### Testing Coverage After All Fixes:
- Auth: Login, register, refresh token rotation, reuse detection
- Bills: Ownership, nextDueDate computation, pay cycle, pagination
- Reminders: Ownership, remindAt sync, dismiss/undismiss, auto-revert
- Dashboard: Aggregations, query validation
- Edge Cases: Double-pay, null amounts, past due dates

### Migration Path:
1. Run `npx prisma migrate dev` after schema updates
2. Deploy backend with feature flags if needed
3. Update frontend axios config (`withCredentials: true`)
4. Test refresh token flow in staging
5. Monitor for reuse detection events (potential attack indicator)

### Key Decisions:
- **Refresh Tokens:** Session/family-based rotation in DB (not Redis for simplicity)
- **Cascades:** Prisma-level (not application-level) for data integrity
- **dismissedUntil:** Query-time logic (not cron job) for simplicity
- **Idempotency:** Time-based threshold (not distributed locks)

---

## Next Steps for Implementation

Since you're doing the coding, follow this workflow:

1. **Start with Phase 1** (Critical fixes)
   - Update Prisma schema first
   - Run migration
   - Implement refresh token service
   - Fix bill/reminder logic bugs
   - Add tests

2. **Validate Phase 1** before moving to Phase 2
   - All critical tests pass
   - Manual testing of refresh token flow
   - Verify cascades work

3. **Phase 2** (Medium fixes) can be done in parallel
   - Validation improvements are independent
   - Pagination is self-contained
   - Rate limiting is a one-line change

4. **Phase 3** (Low priority) can be deferred if timeline is tight

Let me know when you're ready to start a specific phase, and I can provide guidance on any particular issue!
