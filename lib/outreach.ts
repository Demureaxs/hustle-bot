/**
 * Outreach Service Module for Hustle Bot
 *
 * Encapsulates Prisma logic for outreach log operations with comprehensive logging.
 */

import prisma from "@/lib/db";
import { logger } from "@/lib/logger";

const CONTEXT = "OutreachService";

/**
 * Outreach log payload for creation
 */
export interface OutreachLogPayload {
  prospectId: string;
  campaignId?: string;
  channel: string;
  templateId?: string;
  body?: string;
  status?: string;
  error?: string;
  sentAt?: Date | string;
  deliveredAt?: Date | string;
  repliedAt?: Date | string;
  metadata?: Record<string, unknown>;
}

/**
 * Parsed outreach log with JSON fields deserialized
 */
export interface ParsedOutreachLog {
  id: string;
  prospectId: string;
  campaignId: string | null;
  channel: string;
  templateId: string | null;
  body: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  repliedAt: Date | null;
  status: string;
  error: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  prospect?: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
  };
  campaign?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Options for listing outreach logs
 */
export interface ListOutreachLogsOptions {
  campaignId?: string;
  prospectId?: string;
  status?: string;
  channel?: string;
  limit?: number;
  offset?: number;
}

/**
 * Result of listing outreach logs with pagination
 */
export interface ListOutreachLogsResult {
  logs: ParsedOutreachLog[];
  total: number;
}

/**
 * Mapping from outreach status to prospect status
 */
const OUTREACH_TO_PROSPECT_STATUS: Record<string, string> = {
  sent: "messaged",
  delivered: "messaged",
  replied: "responded",
};

/**
 * Parse a raw outreach log from the database into the parsed format
 */
function parseOutreachLog(
  raw: {
    id: string;
    prospectId: string;
    campaignId: string | null;
    channel: string;
    templateId: string | null;
    body: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    repliedAt: Date | null;
    status: string;
    error: string | null;
    metadata: string;
    createdAt: Date;
    updatedAt: Date;
    prospect?: {
      id: string;
      name: string;
      company: string | null;
      email: string | null;
    };
    campaign?: {
      id: string;
      name: string;
    } | null;
  }
): ParsedOutreachLog {
  logger.debug(CONTEXT, "parseOutreachLog: parsing raw outreach log", { logId: raw.id });

  let parsedMetadata: Record<string, unknown> = {};

  try {
    parsedMetadata = JSON.parse(raw.metadata);
    logger.debug(CONTEXT, "parseOutreachLog: metadata parsed successfully", {
      metadataKeys: Object.keys(parsedMetadata),
    });
  } catch (error) {
    logger.warn(CONTEXT, "parseOutreachLog: failed to parse metadata, using empty object", {
      logId: raw.id,
      rawMetadata: raw.metadata,
    });
  }

  return {
    ...raw,
    metadata: parsedMetadata,
  };
}

/**
 * Parse date from string or Date
 */
function parseDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  try {
    return new Date(value);
  } catch {
    logger.warn(CONTEXT, "parseDate: failed to parse date", { value });
    return null;
  }
}

/**
 * Create an outreach log and update prospect status if appropriate
 */
export async function createOutreachLog(payload: OutreachLogPayload): Promise<ParsedOutreachLog> {
  logger.functionEntry("createOutreachLog", {
    prospectId: payload.prospectId,
    campaignId: payload.campaignId,
    channel: payload.channel,
    status: payload.status,
  });

  // Verify prospect exists
  logger.dbOperationStart(CONTEXT, "prisma.prospect.findUnique (verify)", {
    prospectId: payload.prospectId,
  });

  const prospect = await prisma.prospect.findUnique({
    where: { id: payload.prospectId },
  });

  if (!prospect) {
    logger.dbOperationSuccess(CONTEXT, "prisma.prospect.findUnique (verify)", { found: false });
    logger.warn(CONTEXT, "createOutreachLog: prospect not found", { prospectId: payload.prospectId });
    throw new Error("Prospect not found");
  }

  logger.dbOperationSuccess(CONTEXT, "prisma.prospect.findUnique (verify)", {
    found: true,
    prospectId: prospect.id,
  });

  // Verify campaign exists if provided
  if (payload.campaignId) {
    logger.dbOperationStart(CONTEXT, "prisma.campaign.findUnique (verify)", {
      campaignId: payload.campaignId,
    });

    const campaign = await prisma.campaign.findUnique({
      where: { id: payload.campaignId },
    });

    if (!campaign) {
      logger.dbOperationSuccess(CONTEXT, "prisma.campaign.findUnique (verify)", { found: false });
      logger.warn(CONTEXT, "createOutreachLog: campaign not found", {
        campaignId: payload.campaignId,
      });
      throw new Error("Campaign not found");
    }

    logger.dbOperationSuccess(CONTEXT, "prisma.campaign.findUnique (verify)", {
      found: true,
      campaignId: campaign.id,
    });
  }

  const status = payload.status || "pending";

  try {
    logger.dbOperationStart(CONTEXT, "prisma.outreachLog.create", {
      prospectId: payload.prospectId,
      channel: payload.channel,
      status,
    });

    const log = await prisma.outreachLog.create({
      data: {
        prospectId: payload.prospectId,
        campaignId: payload.campaignId,
        channel: payload.channel,
        templateId: payload.templateId,
        body: payload.body,
        sentAt: parseDate(payload.sentAt),
        deliveredAt: parseDate(payload.deliveredAt),
        repliedAt: parseDate(payload.repliedAt),
        status,
        error: payload.error,
        metadata: JSON.stringify(payload.metadata || {}),
      },
      include: {
        prospect: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.dbOperationSuccess(CONTEXT, "prisma.outreachLog.create", { logId: log.id });

    // Update prospect status based on outreach status
    const newProspectStatus = OUTREACH_TO_PROSPECT_STATUS[status];
    if (newProspectStatus) {
      logger.branchTaken(CONTEXT, "updating prospect status based on outreach status", {
        outreachStatus: status,
        newProspectStatus,
      });

      logger.dbOperationStart(CONTEXT, "prisma.prospect.update (status)", {
        prospectId: payload.prospectId,
        newStatus: newProspectStatus,
      });

      await prisma.prospect.update({
        where: { id: payload.prospectId },
        data: { status: newProspectStatus },
      });

      logger.dbOperationSuccess(CONTEXT, "prisma.prospect.update (status)", {
        prospectId: payload.prospectId,
        newStatus: newProspectStatus,
      });
    } else {
      logger.branchTaken(CONTEXT, "no prospect status update needed for outreach status", {
        outreachStatus: status,
      });
    }

    const parsed = parseOutreachLog(log);
    logger.functionExit("createOutreachLog", { success: true, data: { logId: parsed.id } });
    return parsed;
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.outreachLog.create", error);
    logger.functionExit("createOutreachLog", { success: false });
    throw error;
  }
}

/**
 * Update an outreach log by ID
 */
export async function updateOutreachLog(
  id: string,
  updates: Partial<Omit<OutreachLogPayload, "prospectId" | "campaignId" | "channel">>
): Promise<ParsedOutreachLog> {
  logger.functionEntry("updateOutreachLog", { id, updateKeys: Object.keys(updates) });

  const data: Record<string, unknown> = {};

  if (updates.templateId !== undefined) {
    logger.branchTaken(CONTEXT, "updating templateId");
    data.templateId = updates.templateId;
  }
  if (updates.body !== undefined) {
    logger.branchTaken(CONTEXT, "updating body");
    data.body = updates.body;
  }
  if (updates.sentAt !== undefined) {
    logger.branchTaken(CONTEXT, "updating sentAt");
    data.sentAt = parseDate(updates.sentAt);
  }
  if (updates.deliveredAt !== undefined) {
    logger.branchTaken(CONTEXT, "updating deliveredAt");
    data.deliveredAt = parseDate(updates.deliveredAt);
  }
  if (updates.repliedAt !== undefined) {
    logger.branchTaken(CONTEXT, "updating repliedAt");
    data.repliedAt = parseDate(updates.repliedAt);
  }
  if (updates.status !== undefined) {
    logger.branchTaken(CONTEXT, "updating status", { status: updates.status });
    data.status = updates.status;
  }
  if (updates.error !== undefined) {
    logger.branchTaken(CONTEXT, "updating error");
    data.error = updates.error;
  }
  if (updates.metadata !== undefined) {
    logger.branchTaken(CONTEXT, "updating metadata");
    data.metadata = JSON.stringify(updates.metadata);
  }

  try {
    logger.dbOperationStart(CONTEXT, "prisma.outreachLog.update", { id, updateKeys: Object.keys(data) });

    const log = await prisma.outreachLog.update({
      where: { id },
      data,
      include: {
        prospect: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.dbOperationSuccess(CONTEXT, "prisma.outreachLog.update", { logId: log.id });

    // Update prospect status if outreach status changed to replied
    if (updates.status === "replied") {
      logger.branchTaken(CONTEXT, "outreach status changed to replied, updating prospect status");

      logger.dbOperationStart(CONTEXT, "prisma.prospect.update (responded)", {
        prospectId: log.prospectId,
      });

      await prisma.prospect.update({
        where: { id: log.prospectId },
        data: { status: "responded" },
      });

      logger.dbOperationSuccess(CONTEXT, "prisma.prospect.update (responded)", {
        prospectId: log.prospectId,
      });
    }

    const parsed = parseOutreachLog(log);
    logger.functionExit("updateOutreachLog", { success: true, data: { logId: parsed.id } });
    return parsed;
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.outreachLog.update", error);
    logger.functionExit("updateOutreachLog", { success: false });
    throw error;
  }
}

/**
 * Get an outreach log by ID
 */
export async function getOutreachLogById(id: string): Promise<ParsedOutreachLog | null> {
  logger.functionEntry("getOutreachLogById", { id });

  try {
    logger.dbOperationStart(CONTEXT, "prisma.outreachLog.findUnique", { id });

    const log = await prisma.outreachLog.findUnique({
      where: { id },
      include: {
        prospect: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (log) {
      logger.dbOperationSuccess(CONTEXT, "prisma.outreachLog.findUnique", { found: true, logId: log.id });
      const parsed = parseOutreachLog(log);
      logger.functionExit("getOutreachLogById", { success: true, data: { logId: parsed.id } });
      return parsed;
    } else {
      logger.dbOperationSuccess(CONTEXT, "prisma.outreachLog.findUnique", { found: false });
      logger.functionExit("getOutreachLogById", { success: true, data: null });
      return null;
    }
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.outreachLog.findUnique", error);
    logger.functionExit("getOutreachLogById", { success: false });
    throw error;
  }
}

/**
 * List outreach logs with optional filtering and pagination
 */
export async function listOutreachLogs(
  options: ListOutreachLogsOptions = {}
): Promise<ListOutreachLogsResult> {
  logger.functionEntry("listOutreachLogs", { ...options });

  const { campaignId, prospectId, status, channel, limit = 50, offset = 0 } = options;

  const where: Record<string, unknown> = {};

  if (campaignId) {
    logger.branchTaken(CONTEXT, "campaignId filter applied", { campaignId });
    where.campaignId = campaignId;
  }

  if (prospectId) {
    logger.branchTaken(CONTEXT, "prospectId filter applied", { prospectId });
    where.prospectId = prospectId;
  }

  if (status) {
    logger.branchTaken(CONTEXT, "status filter applied", { status });
    where.status = status;
  }

  if (channel) {
    logger.branchTaken(CONTEXT, "channel filter applied", { channel });
    where.channel = channel;
  }

  logger.debug(CONTEXT, "listOutreachLogs: where clause built", { whereKeys: Object.keys(where) });

  try {
    logger.dbOperationStart(CONTEXT, "prisma.outreachLog.findMany + count", {
      limit,
      offset,
      whereKeys: Object.keys(where),
    });

    const [logs, total] = await Promise.all([
      prisma.outreachLog.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          prospect: {
            select: {
              id: true,
              name: true,
              company: true,
              email: true,
            },
          },
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.outreachLog.count({ where }),
    ]);

    logger.dbOperationSuccess(CONTEXT, "prisma.outreachLog.findMany + count", {
      returnedCount: logs.length,
      total,
    });

    logger.debug(CONTEXT, "listOutreachLogs: parsing logs", { count: logs.length });

    const parsedLogs = logs.map((log) => parseOutreachLog(log));

    logger.functionExit("listOutreachLogs", {
      success: true,
      data: { count: parsedLogs.length, total },
    });

    return {
      logs: parsedLogs,
      total,
    };
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.outreachLog.findMany + count", error);
    logger.functionExit("listOutreachLogs", { success: false });
    throw error;
  }
}
