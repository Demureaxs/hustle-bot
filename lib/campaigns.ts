/**
 * Campaigns Service Module for Hustle Bot
 *
 * Encapsulates Prisma logic for campaign operations with comprehensive logging.
 */

import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  validateFilter,
  filterToReadableString,
  parseFilterFromJSON,
  filterToPrismaWhere,
  filterCollection,
  isFilterGroup,
  isFilterCondition,
  type Filter,
} from "@/lib/filters";
import type { Prisma } from "@/app/generated/prisma/client";

const CONTEXT = "CampaignsService";

/**
 * Campaign payload for creation/update
 */
export interface CampaignPayload {
  name: string;
  description?: string;
  filters?: Filter;
  templateId?: string;
  active?: boolean;
}

/**
 * Parsed campaign with JSON fields deserialized
 */
export interface ParsedCampaign {
  id: string;
  name: string;
  description: string | null;
  filters: Filter;
  filterSummary: string;
  templateId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  messageTemplate?: {
    id: string;
    name: string;
    channel: string;
    subject: string | null;
    body: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

/**
 * Options for selecting prospects for a campaign
 */
export interface SelectProspectsOptions {
  limit?: number;
  statusIn?: string[];
}

/**
 * Result of prospect selection
 */
export interface SelectProspectsResult {
  campaignId: string;
  campaignName: string;
  prospects: Array<{
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
  }>;
  count: number;
}

/**
 * Parse a raw campaign from the database into the parsed format
 */
function parseCampaign(
  raw: {
    id: string;
    name: string;
    description: string | null;
    filters: string;
    templateId: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    messageTemplate?: {
      id: string;
      name: string;
      channel: string;
      subject: string | null;
      body: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }
): ParsedCampaign {
  logger.debug(CONTEXT, "parseCampaign: parsing raw campaign", { campaignId: raw.id });

  let parsedFilters: Filter = null;

  try {
    parsedFilters = parseFilterFromJSON(raw.filters);
    logger.debug(CONTEXT, "parseCampaign: filters parsed successfully", {
      hasFilters: parsedFilters !== null,
    });
  } catch (error) {
    logger.warn(CONTEXT, "parseCampaign: failed to parse filters, using null", {
      campaignId: raw.id,
      rawFilters: raw.filters,
    });
  }

  return {
    ...raw,
    filters: parsedFilters,
    filterSummary: filterToReadableString(parsedFilters),
  };
}

/**
 * Get a single campaign by ID
 */
export async function getCampaignById(
  id: string,
  includeTemplate: boolean = true
): Promise<ParsedCampaign | null> {
  logger.functionEntry("getCampaignById", { id, includeTemplate });

  try {
    logger.dbOperationStart(CONTEXT, "prisma.campaign.findUnique", { id, includeTemplate });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: includeTemplate ? { messageTemplate: true } : undefined,
    });

    if (campaign) {
      logger.dbOperationSuccess(CONTEXT, "prisma.campaign.findUnique", { found: true, id });
      const parsed = parseCampaign(campaign);
      logger.functionExit("getCampaignById", { success: true, data: { id: parsed.id } });
      return parsed;
    } else {
      logger.dbOperationSuccess(CONTEXT, "prisma.campaign.findUnique", { found: false, id });
      logger.functionExit("getCampaignById", { success: true, data: null });
      return null;
    }
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.campaign.findUnique", error);
    logger.functionExit("getCampaignById", { success: false });
    throw error;
  }
}

/**
 * List campaigns with optional filtering
 */
export async function listCampaigns(activeOnly: boolean = false): Promise<ParsedCampaign[]> {
  logger.functionEntry("listCampaigns", { activeOnly });

  const where: Prisma.CampaignWhereInput = {};

  if (activeOnly) {
    logger.branchTaken(CONTEXT, "activeOnly filter applied");
    where.active = true;
  } else {
    logger.branchTaken(CONTEXT, "no activeOnly filter, returning all");
  }

  try {
    logger.dbOperationStart(CONTEXT, "prisma.campaign.findMany", { activeOnly });

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        messageTemplate: true,
      },
      orderBy: { createdAt: "desc" },
    });

    logger.dbOperationSuccess(CONTEXT, "prisma.campaign.findMany", {
      returnedCount: campaigns.length,
    });

    logger.debug(CONTEXT, "listCampaigns: parsing campaigns", { count: campaigns.length });

    const parsedCampaigns = campaigns.map((c) => parseCampaign(c));

    logger.functionExit("listCampaigns", { success: true, data: { count: parsedCampaigns.length } });

    return parsedCampaigns;
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.campaign.findMany", error);
    logger.functionExit("listCampaigns", { success: false });
    throw error;
  }
}

/**
 * Create a new campaign
 */
export async function createCampaign(payload: CampaignPayload): Promise<ParsedCampaign> {
  logger.functionEntry("createCampaign", { name: payload.name, hasFilters: !!payload.filters });

  // Validate filter structure if provided
  if (payload.filters) {
    logger.debug(CONTEXT, "createCampaign: validating filter structure");
    if (!validateFilter(payload.filters)) {
      logger.warn(CONTEXT, "createCampaign: invalid filter structure provided");
      throw new Error("Invalid filter structure");
    }
    logger.debug(CONTEXT, "createCampaign: filter structure valid");
  }

  // Verify template exists if provided
  if (payload.templateId) {
    logger.debug(CONTEXT, "createCampaign: verifying template exists", {
      templateId: payload.templateId,
    });

    logger.dbOperationStart(CONTEXT, "prisma.messageTemplate.findUnique", {
      templateId: payload.templateId,
    });

    const template = await prisma.messageTemplate.findUnique({
      where: { id: payload.templateId },
    });

    if (!template) {
      logger.dbOperationSuccess(CONTEXT, "prisma.messageTemplate.findUnique", { found: false });
      logger.warn(CONTEXT, "createCampaign: template not found", { templateId: payload.templateId });
      throw new Error("Message template not found");
    }

    logger.dbOperationSuccess(CONTEXT, "prisma.messageTemplate.findUnique", {
      found: true,
      templateId: template.id,
    });
  }

  try {
    logger.dbOperationStart(CONTEXT, "prisma.campaign.create", { name: payload.name });

    const campaign = await prisma.campaign.create({
      data: {
        name: payload.name,
        description: payload.description,
        filters: JSON.stringify(payload.filters || {}),
        templateId: payload.templateId,
        active: payload.active ?? true,
      },
      include: {
        messageTemplate: true,
      },
    });

    logger.dbOperationSuccess(CONTEXT, "prisma.campaign.create", { id: campaign.id });

    const parsed = parseCampaign(campaign);
    logger.functionExit("createCampaign", { success: true, data: { id: parsed.id } });
    return parsed;
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.campaign.create", error);
    logger.functionExit("createCampaign", { success: false });
    throw error;
  }
}

/**
 * Update a campaign by ID
 */
export async function updateCampaign(
  id: string,
  updates: Partial<CampaignPayload>
): Promise<ParsedCampaign> {
  logger.functionEntry("updateCampaign", { id, updateKeys: Object.keys(updates) });

  // Validate filter structure if provided
  if (updates.filters !== undefined && updates.filters !== null) {
    logger.debug(CONTEXT, "updateCampaign: validating filter structure");
    if (!validateFilter(updates.filters)) {
      logger.warn(CONTEXT, "updateCampaign: invalid filter structure provided");
      throw new Error("Invalid filter structure");
    }
    logger.debug(CONTEXT, "updateCampaign: filter structure valid");
  }

  const data: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    logger.branchTaken(CONTEXT, "updating name");
    data.name = updates.name;
  }
  if (updates.description !== undefined) {
    logger.branchTaken(CONTEXT, "updating description");
    data.description = updates.description;
  }
  if (updates.filters !== undefined) {
    logger.branchTaken(CONTEXT, "updating filters");
    data.filters = JSON.stringify(updates.filters);
  }
  if (updates.templateId !== undefined) {
    logger.branchTaken(CONTEXT, "updating templateId", { templateId: updates.templateId });
    data.templateId = updates.templateId;
  }
  if (updates.active !== undefined) {
    logger.branchTaken(CONTEXT, "updating active", { active: updates.active });
    data.active = updates.active;
  }

  try {
    logger.dbOperationStart(CONTEXT, "prisma.campaign.update", { id, updateKeys: Object.keys(data) });

    const campaign = await prisma.campaign.update({
      where: { id },
      data,
      include: {
        messageTemplate: true,
      },
    });

    logger.dbOperationSuccess(CONTEXT, "prisma.campaign.update", { id: campaign.id });

    const parsed = parseCampaign(campaign);
    logger.functionExit("updateCampaign", { success: true, data: { id: parsed.id } });
    return parsed;
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.campaign.update", error);
    logger.functionExit("updateCampaign", { success: false });
    throw error;
  }
}

/**
 * Delete a campaign by ID
 */
export async function deleteCampaign(id: string): Promise<void> {
  logger.functionEntry("deleteCampaign", { id });

  try {
    logger.dbOperationStart(CONTEXT, "prisma.campaign.delete", { id });

    await prisma.campaign.delete({
      where: { id },
    });

    logger.dbOperationSuccess(CONTEXT, "prisma.campaign.delete", { id });
    logger.functionExit("deleteCampaign", { success: true });
  } catch (error) {
    logger.dbOperationError(CONTEXT, "prisma.campaign.delete", error);
    logger.functionExit("deleteCampaign", { success: false });
    throw error;
  }
}

/**
 * Helper to check if filter contains metadata-based conditions
 */
function hasMetadataFilters(filter: Filter): boolean {
  logger.debug(CONTEXT, "hasMetadataFilters: checking filter for metadata conditions");

  if (!filter) {
    logger.debug(CONTEXT, "hasMetadataFilters: filter is null, returning false");
    return false;
  }

  if (isFilterCondition(filter)) {
    const hasMetadata = filter.field.startsWith("metadata.");
    logger.debug(CONTEXT, "hasMetadataFilters: condition check", {
      field: filter.field,
      hasMetadata,
    });
    return hasMetadata;
  }

  if (isFilterGroup(filter)) {
    logger.debug(CONTEXT, "hasMetadataFilters: checking filter group conditions", {
      conditionCount: filter.conditions.length,
    });
    return filter.conditions.some((c) => hasMetadataFilters(c));
  }

  return false;
}

/**
 * Select prospects eligible for a campaign based on its filters
 */
export async function selectProspectsForCampaign(
  campaignId: string,
  options: SelectProspectsOptions = {}
): Promise<SelectProspectsResult> {
  logger.functionEntry("selectProspectsForCampaign", { campaignId, ...options });

  const { limit = 50, statusIn = ["approved"] } = options;

  // Get the campaign
  logger.dbOperationStart(CONTEXT, "prisma.campaign.findUnique (for selection)", { campaignId });

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    logger.dbOperationSuccess(CONTEXT, "prisma.campaign.findUnique (for selection)", { found: false });
    logger.warn(CONTEXT, "selectProspectsForCampaign: campaign not found", { campaignId });
    throw new Error("Campaign not found");
  }

  logger.dbOperationSuccess(CONTEXT, "prisma.campaign.findUnique (for selection)", {
    found: true,
    campaignId: campaign.id,
    campaignName: campaign.name,
  });

  // Parse campaign filter
  logger.debug(CONTEXT, "selectProspectsForCampaign: parsing campaign filter");
  const filter = parseFilterFromJSON(campaign.filters);
  logger.debug(CONTEXT, "selectProspectsForCampaign: filter parsed", { hasFilter: filter !== null });

  // Build base Prisma where clause
  let where: Prisma.ProspectWhereInput = {};

  if (filter) {
    logger.branchTaken(CONTEXT, "applying campaign filter to where clause");
    where = filterToPrismaWhere(filter) as Prisma.ProspectWhereInput;
    logger.debug(CONTEXT, "selectProspectsForCampaign: prisma where built", {
      whereKeys: Object.keys(where),
    });
  } else {
    logger.branchTaken(CONTEXT, "no campaign filter, using empty where clause");
  }

  // Add status filter
  logger.debug(CONTEXT, "selectProspectsForCampaign: adding status filter", { statusIn });
  where.status = { in: statusIn };

  // Get prospects who have NOT been messaged in this campaign
  logger.dbOperationStart(CONTEXT, "prisma.outreachLog.findMany (excluded prospects)", { campaignId });

  const messagedProspectIds = await prisma.outreachLog.findMany({
    where: {
      campaignId: campaign.id,
      status: { in: ["sent", "delivered", "replied", "pending"] },
    },
    select: { prospectId: true },
    distinct: ["prospectId"],
  });

  const messagedIds = messagedProspectIds.map((p) => p.prospectId);

  logger.dbOperationSuccess(CONTEXT, "prisma.outreachLog.findMany (excluded prospects)", {
    excludedCount: messagedIds.length,
  });

  if (messagedIds.length > 0) {
    logger.branchTaken(CONTEXT, "excluding already-messaged prospects", { count: messagedIds.length });
    where.id = { notIn: messagedIds };
  } else {
    logger.branchTaken(CONTEXT, "no prospects to exclude");
  }

  // Fetch prospects
  logger.dbOperationStart(CONTEXT, "prisma.prospect.findMany (selection)", {
    limit,
    whereKeys: Object.keys(where),
  });

  const prospects = await prisma.prospect.findMany({
    where,
    take: limit,
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
  });

  logger.dbOperationSuccess(CONTEXT, "prisma.prospect.findMany (selection)", {
    returnedCount: prospects.length,
  });

  // Parse JSON fields
  logger.debug(CONTEXT, "selectProspectsForCampaign: parsing prospect JSON fields", {
    count: prospects.length,
  });

  let parsedProspects = prospects.map((p) => ({
    ...p,
    tags: JSON.parse(p.tags) as string[],
    metadata: JSON.parse(p.metadata) as Record<string, unknown>,
  }));

  // Apply any metadata-based filters in memory
  if (filter && hasMetadataFilters(filter)) {
    logger.branchTaken(CONTEXT, "applying metadata filters in memory", {
      beforeCount: parsedProspects.length,
    });

    parsedProspects = filterCollection(
      parsedProspects as unknown as Record<string, unknown>[],
      filter
    ) as typeof parsedProspects;

    logger.debug(CONTEXT, "selectProspectsForCampaign: metadata filters applied", {
      afterCount: parsedProspects.length,
    });
  } else {
    logger.branchTaken(CONTEXT, "no metadata filters to apply in memory");
  }

  const result: SelectProspectsResult = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    prospects: parsedProspects,
    count: parsedProspects.length,
  };

  logger.functionExit("selectProspectsForCampaign", {
    success: true,
    data: { campaignId: campaign.id, count: result.count },
  });

  return result;
}
