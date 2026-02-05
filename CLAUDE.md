# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MadrasOne is a campus food ordering system for Madras Engineering College. It consists of two applications:
- **MEC-backend**: Express.js + TypeScript API server with Socket.IO
- **mecfoodapp**: Next.js 16 + React 19 frontend

## Commands

### Backend (MEC-backend/)
```bash
npm install          # Install dependencies
npm run dev          # Start development server (ts-node with watch)
npm run build        # Compile TypeScript to dist/
npm start            # Run production server (node dist/server.js)
npm run lint         # Run ESLint
npm test             # Run tests (if configured)
```

### Frontend (mecfoodapp/)
```bash
pnpm install         # Install dependencies
pnpm dev             # Start development server (localhost:3000)
pnpm build           # Production build
pnpm start           # Run production server
pnpm lint            # Run ESLint
```

## Architecture

### 5-Role RBAC System
The system uses hierarchical role levels:
1. **student** (level 1) - Place orders, manage wallet
2. **captain** (level 2) - Shop staff, manage orders
3. **owner** (level 3) - Full shop control, staff management
4. **accountant** (level 4) - Financial operations, user approvals
5. **superadmin** (level 5) - Full system access

Role middleware at `MEC-backend/src/shared/middleware/auth.middleware.ts` uses `minRole` checks.

### Backend Module Structure
Each module in `MEC-backend/src/modules/` follows the pattern:
- `*.model.ts` - Mongoose schema
- `*.service.ts` - Business logic
- `*.controller.ts` - HTTP handlers
- `*.routes.ts` - Express routes
- `*.validation.ts` - Zod schemas

### Frontend Dashboard Structure
`mecfoodapp/app/dashboard/[role]/` - Role-specific dashboards
`mecfoodapp/components/[role]/` - Role-specific components
`mecfoodapp/lib/context.tsx` - Global state (AppProvider wraps entire app)

### Real-time Updates
Socket.IO server in `MEC-backend/src/server.ts`:
- Requires JWT auth in handshake (mandatory)
- Room pattern: `order:${orderId}` for order updates, `vendor:${shopId}` for shop feeds
- Events: `orderUpdate`, `newOrder`

### API Client
`mecfoodapp/lib/api.ts` - Central API client with automatic token refresh and CSRF token handling
`mecfoodapp/lib/auth.ts` - Auth service (login, register, tokens)

## Key Files

- `MEC-backend/src/config/constants.ts` - Roles, order statuses, transaction types, rate limits
- `MEC-backend/src/shared/middleware/` - Auth, RBAC, validation, rate limiting, CSRF, IP blocking
- `MEC-backend/src/shared/utils/storage.util.ts` - Garage S3 operations
- `mecfoodapp/lib/context.tsx` - React context with user state, cart, auth

## Database

MongoDB with Mongoose. Core collections:
- Users (with balance field for wallet)
- Orders (with status enum: pending → preparing → ready → completed/cancelled)
- Transactions (audit log for all balance changes)
- Shops, FoodItems, Categories

## Environment Variables

Backend requires: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GARAGE_*` (S3)
Frontend requires: `NEXT_PUBLIC_API_URL`

See `.env.example` files in both directories.

---

## Security Implementation

### Security Confidence Score: 87.5%

This section documents the comprehensive security measures implemented in the MEC Food App.

### Security Middleware Stack (10 Layers)

The backend implements a multi-layered security architecture in `app.ts`:

1. **HTTPS Redirect** - Enforces HTTPS in production
2. **CORS Validation** - Proper hostname parsing, prevents bypass attacks
3. **Helmet.js Security Headers** - CSP, HSTS (1 year), X-Frame-Options, etc.
4. **Body Parser (10MB limit)** - Prevents memory exhaustion
5. **Cookie Parser** - httpOnly cookie support for refresh tokens
6. **IP Blocking** - Blocks IPs with 5+ rate limit violations for 1 hour
7. **CSRF Protection** - Double-submit cookie pattern on all /api/v1 routes
8. **Rate Limiting** - Multi-tiered based on endpoint sensitivity
9. **Request Logging** - Audit trail for security analysis
10. **Global Error Handler** - Sanitizes error messages in production

### Authentication Security

| Feature | Configuration |
|---------|--------------|
| Access Token Expiry | 15 minutes |
| Refresh Token Expiry | 7 days |
| Issuer Validation | Enabled (mecfoodapp) |
| Audience Validation | Enabled (mecfoodapp-users) |
| httpOnly Cookies | Production only |
| Account Lockout | 5 failed attempts = 15 min lockout |
| Password Requirements | 8+ chars, upper, lower, number, special |

### Rate Limiting Configuration

| Endpoint Type | Window | Max Requests |
|--------------|--------|--------------|
| General API | 15 min | 100 |
| Authentication | 15 min | 10 |
| Registration | 1 hour | 5 |
| Password Reset | 1 hour | 3 |
| OTP Requests | 10 min | 5 |
| Order Creation | 5 min | 5 |
| Payment Operations | 5 min | 3 |
| File Uploads | 10 min | 10 |
| Unauthenticated | 15 min | 30 |

### CSRF Protection

- **Pattern**: Double-submit cookie
- **Cookie Name**: `csrf_token`
- **Header Name**: `X-CSRF-Token`
- **Validation**: Constant-time comparison (timing-attack resistant)
- **Skipped**: GET, HEAD, OPTIONS, WebSocket, auth endpoints

Frontend must include CSRF token in all POST/PUT/PATCH/DELETE requests:
```typescript
// Automatically handled in mecfoodapp/lib/api.ts
const csrfToken = getCsrfToken(); // Read from cookie
headers['X-CSRF-Token'] = csrfToken;
```

### API Endpoint Protection

**Public Endpoints (18 total):**
- `/api/v1/auth/login`, `/api/v1/auth/register` - Rate limited
- `/api/v1/shops`, `/api/v1/menu/*` - Read-only
- `/api/v1/images/*` - Path validated (whitelist folders)
- `/swagger` - API documentation (consider protecting in production)

**Protected Endpoints (67 total):**
- All require valid JWT token
- Role-based access control enforced
- Shop ownership validated for owner/captain routes

### Security Files

| File | Purpose |
|------|---------|
| `shared/middleware/auth.middleware.ts` | JWT authentication |
| `shared/middleware/rbac.middleware.ts` | Role-based access control |
| `shared/middleware/csrf.middleware.ts` | CSRF protection |
| `shared/middleware/ip-block.middleware.ts` | IP blocking for repeat offenders |
| `shared/middleware/rate-limit.middleware.ts` | Multi-tiered rate limiting |
| `shared/middleware/validate.middleware.ts` | Zod input validation |
| `shared/middleware/error.middleware.ts` | Error sanitization |
| `modules/uploads/image-proxy.validation.ts` | Path traversal prevention |

### Vulnerabilities Fixed (Feb 2026)

| Vulnerability | Severity | Fix Applied |
|--------------|----------|-------------|
| IDOR in Order Endpoints | Critical | Shop filtering enforced based on user role |
| Path Traversal in Image Proxy | Critical | Folder whitelist + filename validation |
| Missing Route Validation | High | Zod validation on all routes |
| CORS Origin Bypass | High | Proper hostname parsing |
| Missing CSRF Protection | High | Double-submit cookie pattern |
| Query Param Token Exposure | Medium | WebSocket-only in production |
| Unauthenticated Socket.IO | Medium | JWT required for all connections |
| Error Message Info Leak | Medium | Sanitized error responses |

### Security Best Practices

When developing new features:

1. **Always add validation middleware** to new routes
2. **Use `requireAuth()` middleware** for protected endpoints
3. **Use `checkShopAccess()` middleware** for owner/captain routes
4. **Never expose internal errors** - use AppError class
5. **Mask sensitive data in logs** - see `maskEmail()` in shop.service.ts
6. **Test with different roles** - verify RBAC works correctly

### Security Audit Report

A comprehensive security audit report is available:
- `MEC-Food-App-Security-Audit-Report.pdf` - Full audit with graphs
- `security-audit-report.html` - Interactive version

---

## Testing Security

### Verify IDOR Protection
```bash
# Login as captain of Shop A, try to access Shop B's orders
curl -H "Authorization: Bearer <shop_a_captain_token>" \
  https://api.mecfoodapp.welocalhost.com/api/v1/orders/shop
# Should only return Shop A orders
```

### Verify CSRF Protection
```bash
# POST without CSRF token should fail
curl -X POST https://api.mecfoodapp.welocalhost.com/api/v1/orders \
  -H "Authorization: Bearer <token>" \
  -d '{"shopId": "...", "items": [...]}'
# Should return 403 CSRF_ERROR
```

### Verify Rate Limiting
```bash
# Send 11 login requests quickly
for i in {1..11}; do
  curl -X POST https://api.mecfoodapp.welocalhost.com/api/v1/auth/login \
    -d '{"username": "test", "password": "wrong"}'
done
# 11th request should return 429 RATE_LIMIT_EXCEEDED
```

### Verify Path Traversal Protection
```bash
# Try to access file outside allowed folders
curl https://api.mecfoodapp.welocalhost.com/api/v1/images/../../../etc/passwd
# Should return 400 Invalid image path
```
