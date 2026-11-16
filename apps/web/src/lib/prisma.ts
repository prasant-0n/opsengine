import { PrismaClient } from "@prisma/client";

// Shared Prisma client for apps/web (root-auth used per-file clients; this is
// the canonical singleton for new code).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
