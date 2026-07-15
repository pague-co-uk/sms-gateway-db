# SMS Gateway DB API Reference

This reference covers version `1.0.0` of `@pague-co-uk/sms-gateway-db`.

The package publishes one root entry point: `@pague-co-uk/sms-gateway-db`. Its public API consists of one factory function and two direct re-exports from `@prisma/client`. The Prisma schema is shipped with the package, but schema models and enums are exposed through Prisma's generated client rather than as separately exported SDK symbols.

# Database

## createPrismaClient

### Purpose

Creates a new Prisma client configured to access the SMS Gateway database. Use it where an application needs to own the lifecycle of a `PrismaClient`, such as its composition root or a NestJS provider factory.

### Signature

```ts
function createPrismaClient(
  options?: Prisma.PrismaClientOptions,
): PrismaClient;
```

### Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `options` | `Prisma.PrismaClientOptions` | No | Standard Prisma client options, including datasource overrides, logging, error formatting, and query extensions supported by the installed Prisma version. |

### Returns

A new `PrismaClient` instance. The function does not connect to the database by itself; Prisma connects when a query is run or when `$connect()` is called.

### Throws

No exceptions are thrown directly by the factory. Constructing or using the returned Prisma client can surface Prisma configuration, engine, connection, and query errors.

### Example

```ts
import { createPrismaClient } from '@pague-co-uk/sms-gateway-db';

const prisma = createPrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

await prisma.$connect();

const activeClients = await prisma.client.findMany({
  where: { status: 'ACTIVE' },
  select: { id: true, publicId: true, displayName: true },
});

await prisma.$disconnect();
```

### Best Practices

Create one long-lived client per application process and disconnect it during graceful shutdown. Do not create a client for every request, message, or database operation: each client owns connection-pool resources. Use `Prisma.PrismaClientOptions` to override the datasource only in controlled environments such as tests.

### Related APIs

`PrismaClient` and `Prisma`.

# Common Types

## PrismaClient

### Purpose

The generated Prisma database client class, re-exported directly from `@prisma/client`. It provides model delegates for the SMS Gateway schema and lifecycle methods such as `$connect()`, `$disconnect()`, `$transaction()`, and `$extends()`.

### Signature

```ts
export { PrismaClient } from '@prisma/client';
```

Its constructor and complete method surface are defined by the installed `@prisma/client` package (`6.16.3` in this package's dependencies).

### Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `options` | `Prisma.PrismaClientOptions` | No | Constructor options accepted by the upstream Prisma client. |

### Returns

`new PrismaClient(options?)` returns a Prisma client bound to this package's generated schema.

### Throws

No exceptions are thrown directly by the re-export. Prisma operations can reject with Prisma errors for invalid queries, constraints, connection problems, and engine failures.

### Constructor

```ts
new PrismaClient(options?: Prisma.PrismaClientOptions)
```

### Properties

The generated client exposes delegates for schema models such as `client`, `user`, `role`, `permission`, `apiKey`, `message`, `smppAccount`, and other models defined in `prisma/schema.prisma`. The exact delegate and generated type surface belongs to Prisma and is versioned with the generated client.

### Methods

Use Prisma lifecycle and query APIs, including `$connect()`, `$disconnect()`, `$transaction()`, `$queryRaw`, and model delegate operations such as `prisma.client.findUnique()`.

### Lifecycle

Create once, optionally call `$connect()` during startup, and always call `$disconnect()` during graceful shutdown. The package does not manage client lifecycle or provide a singleton.

### Thread safety

Use one client instance per Node.js process. Do not share an instance across worker threads; create a client in each worker process/thread that performs database access.

### Example

```ts
import { PrismaClient } from '@pague-co-uk/sms-gateway-db';

const prisma = new PrismaClient();

const account = await prisma.smppAccount.findUnique({
  where: { systemId: 'gateway-primary' },
});
```

### Best Practices

Prefer `createPrismaClient()` when a local factory improves dependency injection or test setup; otherwise construct this class directly. Treat generated Prisma delegates and schema types as the authoritative database contract.

### Related APIs

`createPrismaClient`, `Prisma`.

## Prisma

### Purpose

The Prisma namespace, re-exported directly from `@prisma/client`. It contains generated input, payload, filtering, transaction, extension, error, and utility types used to write type-safe queries against the SMS Gateway schema.

### Signature

```ts
export { Prisma } from '@prisma/client';
```

### Parameters

Not applicable; `Prisma` is an upstream namespace re-export, not a function or class.

### Returns

Not applicable.

### Throws

No exceptions are thrown directly.

### Properties

The namespace contains Prisma-generated values and types. Common members include generated `*WhereInput`, `*CreateInput`, `*Select`, `*Include`, transaction helpers, and Prisma error classes. Its complete surface is owned by the installed `@prisma/client` version.

### Example

```ts
import { Prisma, createPrismaClient } from '@pague-co-uk/sms-gateway-db';

const prisma = createPrismaClient();

const where: Prisma.ClientWhereInput = {
  status: 'ACTIVE',
  companyName: { contains: 'Pague' },
};

const clients = await prisma.client.findMany({ where });
```

### Best Practices

Import generated types with `import type` when they are used only at compile time. Do not hand-maintain copies of schema input types; regenerate the Prisma client after schema changes.

### Related APIs

`PrismaClient`, `createPrismaClient`.

# Errors

This package declares no package-specific error classes. Database errors originate from Prisma and should be handled using Prisma's documented error types from the `Prisma` namespace.

# Constants

This package declares no package-specific constants.

# Documentation Review

- Undocumented public exports: none. The root declaration exports `createPrismaClient`, `PrismaClient`, and `Prisma`.
- Public API design: the surface is intentionally small and delegates database access and generated types to Prisma.
- APIs exposing external implementation details: `PrismaClient` and `Prisma` deliberately expose the upstream Prisma API; this makes the Prisma version part of the package contract.
- Missing JSDoc: `createPrismaClient` has no source JSDoc. Adding it would improve editor documentation.
- Simplification opportunity: none required. The factory is a useful dependency-injection seam while direct Prisma re-exports preserve familiar Prisma usage.

# Public API Summary

```text
Database
  createPrismaClient()

Common Types
  PrismaClient
  Prisma

Errors
  (no package-specific exports)

Constants
  (no package-specific exports)
```
