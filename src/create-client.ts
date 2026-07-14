import { PrismaClient, Prisma } from '@prisma/client';

export function createPrismaClient(
  options?: Prisma.PrismaClientOptions,
): PrismaClient {
  return new PrismaClient(options);
}