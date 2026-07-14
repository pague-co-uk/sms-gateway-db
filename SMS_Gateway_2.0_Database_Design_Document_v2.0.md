# SMS Gateway 2.0 Database Design Document v1.2

## 1. Database Principles

### Source of Truth

  Data             Source of Truth
  ---------------- -----------------------
  Clients          Database
  Users            Database
  API Keys         Database
  SMPP Accounts    Database
  Float            Append-only Ledger
  Messages         Database
  Message Status   Message Status Events
  Retry History    Message Attempts
  Audit            Audit Log

Redis is **never** authoritative. RabbitMQ is **never** authoritative.
Both are infrastructure.

## Multi-tenancy

The system is multi-tenant. Every business table contains `clientId`
except global tables.

### Global Tables

-   Role
-   Permission
-   RolePermission

Everything else belongs to a client.

## ID Strategy

-   Internal IDs: UUID
-   External IDs:
    -   `CLI_xxxxxxxx`
    -   `MSG_xxxxxxxx`
    -   `API_xxxxxxxx`
    -   `SMPP_xxxxxxxx`

UUIDs remain the primary keys while public IDs are stable business
identifiers.

## Naming Convention

Models use PascalCase (`Client`, `User`, `ApiKey`) while tables use
snake_case via Prisma `@@map`.

## Timestamp Convention

Mutable entities:

-   createdAt
-   updatedAt

Immutable entities:

-   createdAt

## Status Convention

Use lifecycle enums rather than booleans.

Examples:

-   ACTIVE
-   SUSPENDED
-   DISABLED
-   REVOKED

## Money

Always use `Decimal(18,4)`.

## Soft Deletes

Avoid soft deletes. Prefer lifecycle states and only add `deletedAt`
where restoration is a genuine business requirement.

## sms-gateway-db Responsibilities

The package exposes only:

-   Prisma Client
-   Prisma Module
-   Prisma Service
-   Health Check
-   Migrations
-   Seeders
-   Generated Types

No repositories, domain services or business logic.

------------------------------------------------------------------------

# 2. Identity Module

## Responsibilities

-   Multi-tenancy
-   Portal authentication
-   User management
-   RBAC

Not responsible for API keys, SMPP, messaging or billing.

## Entities

### Client

Tenant boundary.

Fields:

-   id
-   publicId
-   companyName
-   displayName
-   email
-   phone
-   status
-   rateLimitPerSecond
-   timezone
-   currency
-   metadata
-   createdAt
-   updatedAt

Owns:

-   Users
-   ApiKeys
-   SmppAccounts
-   SenderIds
-   Messages
-   FloatLedgerEntries
-   AuditLogs
-   WebhookEndpoint

Indexes:

-   publicId (UNIQUE)
-   email (UNIQUE)
-   status
-   createdAt

### User

Portal user only.

Fields:

-   id
-   clientId
-   firstName
-   lastName
-   email
-   passwordHash
-   status
-   lastLoginAt
-   version
-   createdAt
-   updatedAt

Indexes:

-   email (UNIQUE)
-   clientId
-   status

### Role

Roles are **global**.

Examples:

-   Platform Administrator
-   Client Administrator
-   Client User
-   Auditor
-   Billing Administrator
-   Support Engineer

Fields:

-   id
-   name
-   description
-   system
-   createdAt
-   updatedAt

### Permission

Permissions are **granular** and follow dot notation.

Examples:

-   client.create
-   client.view
-   client.update
-   client.delete
-   client.suspend
-   user.create
-   user.assign-role
-   apikey.rotate
-   smpp.create
-   ledger.topup
-   message.submit
-   report.export
-   audit.view
-   platform.manage

Fields:

-   id
-   name
-   description
-   module
-   createdAt

Indexes:

-   name (UNIQUE)

### UserRole

Fields:

-   userId
-   roleId
-   assignedBy
-   assignedAt

Composite key:

-   userId
-   roleId

### RolePermission

Fields:

-   roleId
-   permissionId

Composite key:

-   roleId
-   permissionId

## RBAC Decisions

-   Roles are global.
-   Permissions are granular.
-   Users never receive permissions directly.
-   Permissions are assigned only through roles.
-   Explicit join tables are preferred over Prisma implicit
    many-to-many.

## Permission Registry

The canonical permission catalogue lives in application code. During
deployment or startup, the application synchronizes the registry with
the `permissions` table to keep all environments consistent.

------------------------------------------------------------------------

# 3. Authentication Module

## Responsibilities

Authentication only. Authorization remains the responsibility of the
Identity module.

Supported authentication mechanisms:

1.  Portal users (Email + Password → Session/JWT)
2.  HTTP clients (API Key)
3.  SMPP clients (`system_id` + password)

Authentication identities and credentials are deliberately separated.

## ApiKey

Represents an HTTP API credential owned by a client.

Fields:

-   id
-   publicId
-   clientId
-   name
-   keyHash
-   prefix
-   status
-   lastUsedAt
-   expiresAt
-   revokedAt
-   createdAt
-   updatedAt

Security:

-   Plaintext key is shown only once.
-   Only the hash is stored.

Indexes:

-   clientId
-   keyHash (UNIQUE)
-   status
-   expiresAt

## PortalSession

Represents an authenticated browser session.

Fields:

-   id
-   userId
-   sessionTokenHash
-   ipAddress
-   userAgent
-   lastActivityAt
-   expiresAt
-   revokedAt
-   createdAt

Only hashed session tokens are stored.

Indexes:

-   userId
-   expiresAt
-   lastActivityAt

## RefreshToken

Represents a refresh credential tied to a portal session.

Fields:

-   id
-   sessionId
-   tokenHash
-   expiresAt
-   revokedAt
-   replacedById
-   createdAt

Every refresh rotates the token and links to the replacement token.

Indexes:

-   sessionId
-   tokenHash (UNIQUE)
-   replacedById

## Authentication Security Decisions

-   Argon2id for passwords.
-   Store only hashed API keys.
-   Store only hashed session tokens.
-   Store only hashed refresh tokens.
-   Rotate refresh tokens on every refresh.
-   Revoking a session invalidates all associated refresh tokens.
-   Track IP address, user agent and last activity for every session.

## Authentication Event

Dedicated security event table for authentication-related activity.

Example events:

-   LOGIN_SUCCESS
-   LOGIN_FAILED
-   LOGOUT
-   SESSION_REVOKED
-   API_KEY_CREATED
-   API_KEY_REVOKED
-   PASSWORD_CHANGED
-   REFRESH_TOKEN_ROTATED

Each event records:

-   actor
-   authenticationType
-   ipAddress
-   userAgent
-   timestamp
-   outcome
-   failureReason (optional)

Authentication events complement the Audit Log by recording security
activity rather than administrative changes.

------------------------------------------------------------------------

# Remaining Modules

-   Billing
-   SMPP
-   Messaging
-   Notifications
-   Auditing
-   Reporting
-   Infrastructure

These will be completed before generating the Prisma schema.

------------------------------------------------------------------------

# 4. Billing Module

## Purpose

The Billing module is responsible for the financial integrity of the
platform.

It owns:

-   Client float
-   Top-ups
-   Debits
-   Refunds
-   Manual adjustments
-   Financial auditability

It does **not** calculate message routing or delivery outcomes. It
records the financial consequences of those outcomes.

## Design Principles

### Append-only Ledger

The ledger is immutable.

Transactions are never updated or deleted.

Corrections are performed by creating compensating entries.

### No Balance Column

There is **no** `balance` field stored in the database.

Current balance is derived from:

``` text
SUM(ledger.amount)
```

Redis maintains a cached derived balance purely for performance. The
database ledger remains the only source of truth.

### Every Transaction Has a Reference

Each ledger entry must explain *why* it exists.

Examples:

  Transaction         Reference Type
  ------------------- ----------------
  Top-up              ADMIN
  Message debit       MESSAGE
  Refund              MESSAGE
  Manual adjustment   ADMIN

This guarantees complete traceability.

## FloatLedgerEntry

Fields:

-   id
-   clientId
-   amount (Decimal(18,4))
-   transactionType
-   referenceType
-   referenceId
-   description
-   createdBy
-   createdAt

### Relationships

-   Belongs to Client
-   Optionally references User (administrator)
-   References the business entity responsible for the transaction

## Enumerations

### LedgerTransactionType

-   TOPUP
-   DEBIT
-   REFUND
-   ADJUSTMENT

### LedgerReferenceType

-   MESSAGE
-   ADMIN
-   SYSTEM
-   IMPORT

## Balance Calculation

    Current Balance =
    SUM(CREDITS) - SUM(DEBITS)

Redis caches this value after each successful transaction.

## Redis Cache Strategy

Redis stores:

    float:{clientId}

The cache is updated immediately after a successful ledger write.

If the cache is missing, the balance is recalculated from the ledger and
repopulated.

## Reconciliation

A scheduled reconciliation job periodically:

1.  Calculates the balance directly from the ledger.
2.  Reads the Redis cached balance.
3.  Compares both values.
4.  Corrects the cache if they differ.

This guarantees Redis never becomes authoritative.

## Concurrency

All debits execute inside a database transaction.

Process:

1.  Read cached balance.
2.  Validate sufficient funds.
3.  Insert ledger entry.
4.  Commit transaction.
5.  Update Redis cache.

If the transaction rolls back, Redis is **not** updated.

## Indexing

Indexes:

-   clientId
-   createdAt
-   transactionType
-   referenceType
-   referenceId

## Future Extensions

The model supports future additions without redesign:

-   Automated billing
-   Invoicing
-   Promotional credits
-   Reserved balances
-   Multi-currency support

------------------------------------------------------------------------

# Remaining Modules

-   SMPP
-   Messaging
-   Notifications
-   Auditing
-   Reporting
-   Infrastructure

------------------------------------------------------------------------

# 5. Messaging Module

## Purpose

The Messaging module is the core of the platform. It owns the complete
lifecycle of every submitted SMS, independent of whether it originated
from the HTTP API or SMPP.

## Core Entities

### Message

Represents the business message submitted by a client.

Fields include:

-   id
-   publicId
-   clientId
-   senderId
-   destination
-   messageBody
-   encoding
-   segmentCount
-   cost
-   currentStatus
-   submittedAt
-   createdAt
-   updatedAt

The Message record is immutable after submission except for its
denormalized `currentStatus`.

### MessageAttempt

Represents an individual delivery attempt.

Each retry or failover creates a new attempt.

Fields include:

-   id
-   messageId
-   attemptNumber
-   route
-   provider
-   queue
-   consumer
-   status
-   startedAt
-   completedAt
-   latency
-   providerMessageId
-   failureReason
-   traceId

One Message can have many MessageAttempts.

### MessageStatusEvent

Immutable history of status transitions.

Example lifecycle:

-   QUEUED
-   ROUTED
-   SUBMITTED
-   DELIVERED
-   FAILED
-   EXPIRED

Fields:

-   id
-   messageId
-   status
-   source
-   details
-   createdAt

## Design Decisions

-   One recipient per Message.
-   Bulk sending creates multiple Message records.
-   Current status is denormalized onto Message for fast queries.
-   Complete history is preserved in MessageStatusEvent.
-   Retries never overwrite previous attempts.
-   Idempotency is enforced at submission using a client supplied
    idempotency key or message identifier.
-   Transport-independent model supporting both HTTP and SMPP.

## Indexes

Message:

-   publicId (UNIQUE)
-   clientId
-   currentStatus
-   submittedAt
-   destination

MessageAttempt:

-   messageId
-   attemptNumber
-   provider

MessageStatusEvent:

-   messageId
-   createdAt
-   status

------------------------------------------------------------------------

# 6. SMPP Module

## Purpose

Provides credentials and sender identities for SMPP clients.

## SmppAccount

Fields:

-   id
-   clientId
-   publicId
-   systemId
-   passwordHash
-   status
-   maxBindCount
-   enquireLinkInterval
-   createdAt
-   updatedAt

## SenderId

Fields:

-   id
-   clientId
-   sender
-   status
-   isDefault
-   approvedAt
-   createdAt
-   updatedAt

## Design Decisions

-   SMPP authentication is independent from portal authentication.
-   Sender IDs are first-class entities.
-   Multiple sender IDs per client.
-   One default sender per client.

------------------------------------------------------------------------

# 7. Notifications Module

## Purpose

Manage client callbacks for message status notifications.

## WebhookEndpoint

Fields:

-   id
-   clientId
-   url
-   secret
-   enabled
-   createdAt
-   updatedAt

## WebhookDelivery

Represents a delivery attempt for a webhook notification.

Fields:

-   id
-   webhookEndpointId
-   messageId
-   status
-   responseCode
-   responseBody
-   attemptedAt

## Design Decisions

-   One webhook endpoint per client for v1.
-   Failed webhook deliveries are recorded but not endlessly retried.
-   Clients may poll the status API if webhook delivery fails.

------------------------------------------------------------------------

# 8. Auditing Module

## Purpose

Provide complete traceability of administrative and security actions.

## AuditLog

Fields:

-   id
-   clientId
-   entity
-   entityId
-   action
-   performedBy
-   oldValues
-   newValues
-   ipAddress
-   userAgent
-   createdAt

## AuthenticationEvent

Records authentication-related activity.

Examples:

-   LOGIN_SUCCESS
-   LOGIN_FAILED
-   LOGOUT
-   SESSION_REVOKED
-   API_KEY_CREATED
-   API_KEY_REVOKED
-   PASSWORD_CHANGED
-   REFRESH_TOKEN_ROTATED

## Design Decisions

-   AuditLog records business and administrative changes.
-   AuthenticationEvent records security activity.
-   Neither table replaces structured application logs.

------------------------------------------------------------------------

# 9. Reporting Module

## Purpose

Support fast dashboards without querying raw message tables.

## RollupHourly

Aggregates metrics per client, route and hour.

## RollupDaily

Aggregates metrics per client, route and day.

Metrics include:

-   submitted
-   delivered
-   failed
-   refunded
-   cost
-   revenue
-   averageLatency

## Design Decisions

-   Rollups are generated by scheduled jobs.
-   Portal dashboards query rollups rather than raw messages.

------------------------------------------------------------------------

# 10. Infrastructure Module

## Purpose

Optional infrastructure support tables.

Potential entities:

### OutboxEvent

Supports reliable event publication if the Outbox Pattern is adopted.

### IdempotencyKey

Stores processed submission keys when a dedicated idempotency table is
preferred.

## Design Decisions

These entities are optional and should only be introduced when
operational requirements justify them. They are intentionally excluded
from the initial implementation to keep the schema focused.

------------------------------------------------------------------------

# Overall Design Principles

-   Client is the tenant boundary.
-   Roles are global.
-   Permissions are granular.
-   Authentication is separated from authorization.
-   Financial integrity is maintained through an append-only ledger.
-   Messages are transport-independent.
-   Retry history is immutable.
-   Redis is a cache, never a source of truth.
-   RabbitMQ is transport infrastructure, never a source of truth.
-   The database package contains infrastructure only.
-   Business logic belongs in the application services.
