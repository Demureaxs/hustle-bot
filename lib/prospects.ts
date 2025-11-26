/**
 * Prospects Service Module for Hustle Bot
 *
 * Encapsulates Prisma logic for prospect operations with comprehensive logging.
 */

import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Prisma } from "@/app/generated/prisma/client";

const CONTEXT = "ProspectsService";

/**
 * Prospect payload for creation/update
 */
export interface ProspectPayload {
  source: string;
  externalId: string;
  name: string;
  role?: string;
  company?: string;
  location?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  status?: string;
  score?: number;
}

/**
 * Parsed prospect with JSON fields deserialized
 */
export interface ParsedProspect {
  id: string;
  source: string;
  externalId: string;
  name: string;
  role: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  status: string;
  score: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Options for listing prospects
 */
export interface ListProspectsOptions {
  status?: string;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
  filter?: Prisma.ProspectWhereInput;
}

/**
 * Result of listing prospects with pagination
 */
export interface ListProspectsResult {
  prospects: ParsedProspect[];
  total: number;
}

/**
 * Result of bulk upsert operation
 */
export interface BulkUpsertResult {
  total: number;
  created: number;
  updated: number;
  errorCount: number;
  errors: string[];
}

/**
 * Parse a raw prospect from the database into the parsed format
 */
function parseProspect(
  raw: {
    id: string;
    source: string;
    externalId: string;
    name: string;
    role: string | null;
    company: string | null;
    location: string | null;
    email: string | null;
    phone: string | null;
    tags: string;
    metadata: string;
    status: string;
    score: number | null;
    createdAt: Date;
    updatedAt: Date;
  }
): ParsedProspect {
  logger.debug(CONTEXT, "parseProspect: parsing raw prospect", { prospectId: raw.id });

  let parsedTags: string[] = [];
  let parsedMetadata: Record<string, unknown> = {};

  try {
    parsedTags = JSON.parse(raw.tags);
    logger.debug(CONTEXT, "parseProspect: tags parsed successfully", { tagCount: parsedTags.length });
  } catch (error) {
    logger.warn(CONTEXT, "parseProspect: failed to parse tags, using empty array", {
      prospectId: raw.id,
      rawTags: raw.tags,
    });
  }

  try {
    parsedMetadata = JSON.parse(raw.metadata);
    logger.debug(CONTEXT, "parseProspect: metadata parsed successfully", {
      metadataKeys: Object.keys(parsedMetadata),
    });
  } catch (error) {
    logger.warn(CONTEXT, "parseProspect: failed to parse metadata, using empty object", {
      prospectId: raw.id,
      rawMetadata: raw.metadata,
    });
  }

  return {
    ...raw,
    tags: parsedTags,
    metadata: parsedMetadata,
  };
}

/**
 * Get a single prospect by ID
 */
export async function getProspectById(id: string): Promise<ParsedProspect | null> {
  logger.functionEntry("getProspectById", { id });

  try {
    logger.dbOperationStart(CONTEXT, "prisma.prospect.findUnique", { id });

    const prospect = await prisma.prospect.findUnique({
      where: { id },
    });

    if (prospect) {
      logger.dbOperationSuccess(CONTEXT, "prisma.prospect.findUnique", { found: true, id });
      const parsed = parseProspect(prospect);
      logger.functionExit("getProspectById", { success: true, data: { id: parsed.id } });
      return parsed;
    } else {
      logger.dbOperationSuccess(CONTEXT, "prisma.prospect.findUnique", { found: false, id });
      logger.functionExit("getProspectById", { success: true, data: null });
      return null;
    }
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.prospect.findUnique", error);
    logger.functionExit("getProspectById", { success: false });
    throw error;
  }
}

/**
 * Get a prospect by source and externalId
 */
export async function getProspectBySourceAndExternalId(
  source: string,
  externalId: string
): Promise<ParsedProspect | null> {
  logger.functionEntry("getProspectBySourceAndExternalId", { source, externalId });

  try {
    logger.dbOperationStart(CONTEXT, "prisma.prospect.findUnique (source_externalId)", {
      source,
      externalId,
    });

    const prospect = await prisma.prospect.findUnique({
      where: {
        source_externalId: {
          source,
          externalId,
        },
      },
    });

    if (prospect) {
      logger.dbOperationSuccess(CONTEXT, "prisma.prospect.findUnique (source_externalId)", {
        found: true,
        id: prospect.id,
      });
      const parsed = parseProspect(prospect);
      logger.functionExit("getProspectBySourceAndExternalId", { success: true, data: { id: parsed.id } });
      return parsed;
    } else {
      logger.dbOperationSuccess(CONTEXT, "prisma.prospect.findUnique (source_externalId)", {
        found: false,
      });
      logger.functionExit("getProspectBySourceAndExternalId", { success: true, data: null });
      return null;
    }
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.prospect.findUnique (source_externalId)", error);
    logger.functionExit("getProspectBySourceAndExternalId", { success: false });
    throw error;
  }
}

/**
 * List prospects with optional filtering and pagination
 */
export async function listProspects(options: ListProspectsOptions = {}): Promise<ListProspectsResult> {
  logger.functionEntry("listProspects", { ...options });

  const { status, source, search, limit = 50, offset = 0, filter } = options;

  // Build where clause
  const where: Prisma.ProspectWhereInput = { ...filter };

  logger.debug(CONTEXT, "listProspects: building where clause", { initialFilter: !!filter });

  if (status) {
    logger.branchTaken(CONTEXT, "status filter applied", { status });
    where.status = status;
  }

  if (source) {
    logger.branchTaken(CONTEXT, "source filter applied", { source });
    where.source = source;
  }

  if (search) {
    logger.branchTaken(CONTEXT, "search filter applied", { search });
    where.OR = [
      { name: { contains: search } },
      { company: { contains: search } },
      { role: { contains: search } },
      { email: { contains: search } },
    ];
  }

  logger.debug(CONTEXT, "listProspects: where clause built", { whereKeys: Object.keys(where) });

  try {
    logger.dbOperationStart(CONTEXT, "prisma.prospect.findMany + count", {
      limit,
      offset,
      whereKeys: Object.keys(where),
    });

    const [prospects, total] = await Promise.all([
      prisma.prospect.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.prospect.count({ where }),
    ]);

    logger.dbOperationSuccess(CONTEXT, "prisma.prospect.findMany + count", {
      returnedCount: prospects.length,
      total,
    });

    logger.debug(CONTEXT, "listProspects: parsing prospects", { count: prospects.length });

    const parsedProspects = prospects.map((p) => parseProspect(p));

    logger.functionExit("listProspects", {
      success: true,
      data: { count: parsedProspects.length, total },
    });

    return {
      prospects: parsedProspects,
      total,
    };
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.prospect.findMany + count", error);
    logger.functionExit("listProspects", { success: false });
    throw error;
  }
}

/**
 * Create a new prospect
 */
export async function createProspect(payload: ProspectPayload): Promise<ParsedProspect> {
  logger.functionEntry("createProspect", { source: payload.source, externalId: payload.externalId });

  const data = {
    source: payload.source,
    externalId: payload.externalId,
    name: payload.name,
    role: payload.role,
    company: payload.company,
    location: payload.location,
    email: payload.email,
    phone: payload.phone,
    tags: JSON.stringify(payload.tags || []),
    metadata: JSON.stringify(payload.metadata || {}),
    status: payload.status || "new",
    score: payload.score,
  };

  try {
    logger.dbOperationStart(CONTEXT, "prisma.prospect.create", {
      source: data.source,
      externalId: data.externalId,
    });

    const prospect = await prisma.prospect.create({ data });

    logger.dbOperationSuccess(CONTEXT, "prisma.prospect.create", { id: prospect.id });

    const parsed = parseProspect(prospect);
    logger.functionExit("createProspect", { success: true, data: { id: parsed.id } });
    return parsed;
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.prospect.create", error);
    logger.functionExit("createProspect", { success: false });
    throw error;
  }
}

/**
 * Update a prospect by ID
 */
export async function updateProspect(
  id: string,
  updates: Partial<Omit<ProspectPayload, "source" | "externalId">>
): Promise<ParsedProspect> {
  logger.functionEntry("updateProspect", { id, updateKeys: Object.keys(updates) });

  const data: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    logger.branchTaken(CONTEXT, "updating name");
    data.name = updates.name;
  }
  if (updates.role !== undefined) {
    logger.branchTaken(CONTEXT, "updating role");
    data.role = updates.role;
  }
  if (updates.company !== undefined) {
    logger.branchTaken(CONTEXT, "updating company");
    data.company = updates.company;
  }
  if (updates.location !== undefined) {
    logger.branchTaken(CONTEXT, "updating location");
    data.location = updates.location;
  }
  if (updates.email !== undefined) {
    logger.branchTaken(CONTEXT, "updating email");
    data.email = updates.email;
  }
  if (updates.phone !== undefined) {
    logger.branchTaken(CONTEXT, "updating phone");
    data.phone = updates.phone;
  }
  if (updates.tags !== undefined) {
    logger.branchTaken(CONTEXT, "updating tags", { tagCount: updates.tags.length });
    data.tags = JSON.stringify(updates.tags);
  }
  if (updates.metadata !== undefined) {
    logger.branchTaken(CONTEXT, "updating metadata", { metadataKeys: Object.keys(updates.metadata) });
    data.metadata = JSON.stringify(updates.metadata);
  }
  if (updates.status !== undefined) {
    logger.branchTaken(CONTEXT, "updating status", { status: updates.status });
    data.status = updates.status;
  }
  if (updates.score !== undefined) {
    logger.branchTaken(CONTEXT, "updating score", { score: updates.score });
    data.score = updates.score;
  }

  try {
    logger.dbOperationStart(CONTEXT, "prisma.prospect.update", { id, updateKeys: Object.keys(data) });

    const prospect = await prisma.prospect.update({
      where: { id },
      data,
    });

    logger.dbOperationSuccess(CONTEXT, "prisma.prospect.update", { id: prospect.id });

    const parsed = parseProspect(prospect);
    logger.functionExit("updateProspect", { success: true, data: { id: parsed.id } });
    return parsed;
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.prospect.update", error);
    logger.functionExit("updateProspect", { success: false });
    throw error;
  }
}

/**
 * Update prospect status
 */
export async function updateProspectStatus(id: string, status: string): Promise<ParsedProspect> {
  logger.functionEntry("updateProspectStatus", { id, status });
  return updateProspect(id, { status });
}

/**
 * Bulk upsert prospects - inserts new or updates existing based on source+externalId
 */
export async function bulkUpsertProspects(prospects: ProspectPayload[]): Promise<BulkUpsertResult> {
  logger.functionEntry("bulkUpsertProspects", { count: prospects.length });

  const result: BulkUpsertResult = {
    total: prospects.length,
    created: 0,
    updated: 0,
    errorCount: 0,
    errors: [],
  };

  logger.debug(CONTEXT, "bulkUpsertProspects: starting transaction", { prospectCount: prospects.length });

  try {
    await prisma.$transaction(async (tx) => {
      logger.debug(CONTEXT, "bulkUpsertProspects: transaction started");

      for (let i = 0; i < prospects.length; i++) {
        const prospect = prospects[i];

        logger.loopIteration(CONTEXT, "processing prospect", {
          current: i + 1,
          total: prospects.length,
          item: { source: prospect.source, externalId: prospect.externalId },
        });

        try {
          // Check if prospect exists
          logger.dbOperationStart(CONTEXT, "tx.prospect.findUnique (loop)", {
            source: prospect.source,
            externalId: prospect.externalId,
          });

          const existing = await tx.prospect.findUnique({
            where: {
              source_externalId: {
                source: prospect.source,
                externalId: prospect.externalId,
              },
            },
          });

          if (existing) {
            logger.branchTaken(CONTEXT, "prospect exists, updating", { existingId: existing.id });

            // Update existing
            const mergedMetadata = {
              ...JSON.parse(existing.metadata),
              ...(prospect.metadata || {}),
            };

            logger.dbOperationStart(CONTEXT, "tx.prospect.update (loop)", { id: existing.id });

            await tx.prospect.update({
              where: { id: existing.id },
              data: {
                name: prospect.name,
                role: prospect.role,
                company: prospect.company,
                location: prospect.location,
                email: prospect.email,
                phone: prospect.phone,
                tags: JSON.stringify(prospect.tags || []),
                metadata: JSON.stringify(mergedMetadata),
                status: prospect.status || existing.status,
                score: prospect.score,
              },
            });

            logger.dbOperationSuccess(CONTEXT, "tx.prospect.update (loop)", { id: existing.id });
            result.updated++;
          } else {
            logger.branchTaken(CONTEXT, "prospect does not exist, creating");

            // Create new
            logger.dbOperationStart(CONTEXT, "tx.prospect.create (loop)", {
              source: prospect.source,
              externalId: prospect.externalId,
            });

            const created = await tx.prospect.create({
              data: {
                source: prospect.source,
                externalId: prospect.externalId,
                name: prospect.name,
                role: prospect.role,
                company: prospect.company,
                location: prospect.location,
                email: prospect.email,
                phone: prospect.phone,
                tags: JSON.stringify(prospect.tags || []),
                metadata: JSON.stringify(prospect.metadata || {}),
                status: prospect.status || "new",
                score: prospect.score,
              },
            });

            logger.dbOperationSuccess(CONTEXT, "tx.prospect.create (loop)", { id: created.id });
            result.created++;
          }
        } catch (error) {
          const errorMessage = `Failed to upsert ${prospect.source}:${prospect.externalId}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(CONTEXT, "bulkUpsertProspects: error processing prospect", {
            source: prospect.source,
            externalId: prospect.externalId,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          result.errors.push(errorMessage);
          result.errorCount++;
        }
      }

      logger.loopComplete(CONTEXT, "prospect processing", {
        totalIterations: prospects.length,
        successCount: result.created + result.updated,
        errorCount: result.errorCount,
      });
    });

    logger.dbOperationSuccess(CONTEXT, "prisma.$transaction", {
      created: result.created,
      updated: result.updated,
      errors: result.errorCount,
    });
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.$transaction", error);
    throw error;
  }

  logger.functionExit("bulkUpsertProspects", {
    success: true,
    data: { created: result.created, updated: result.updated, errorCount: result.errorCount },
  });

  return result;
}

/**
 * Delete a prospect by ID
 */
export async function deleteProspect(id: string): Promise<void> {
  logger.functionEntry("deleteProspect", { id });

  try {
    logger.dbOperationStart(CONTEXT, "prisma.prospect.delete", { id });

    await prisma.prospect.delete({
      where: { id },
    });

    logger.dbOperationSuccess(CONTEXT, "prisma.prospect.delete", { id });
    logger.functionExit("deleteProspect", { success: true });
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.prospect.delete", error);
    logger.functionExit("deleteProspect", { success: false });
    throw error;
  }
}
