import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { 
  parseFilterFromJSON, 
  filterToPrismaWhere,
  filterCollection,
  isFilterGroup,
  isFilterCondition 
} from "@/lib/filters";

/**
 * POST /api/scheduler/batch
 * 
 * Returns the next batch of eligible prospects for outreach for each active campaign.
 * Can be called by external schedulers (cron, GitHub Actions) to get prospects for processing.
 * 
 * Request body:
 * - limit: number (default 10) - max prospects per campaign
 * - campaignId: string (optional) - only process specific campaign
 * - statuses: string[] (optional) - only get prospects with these statuses (default: ["approved"])
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const limit = Math.min(body.limit || 10, 100);
    const campaignId = body.campaignId;
    const statuses = body.statuses || ["approved"];
    
    // Get active campaigns
    const campaigns = await prisma.campaign.findMany({
      where: {
        active: true,
        ...(campaignId ? { id: campaignId } : {}),
      },
      include: {
        messageTemplate: true,
      },
    });
    
    if (campaigns.length === 0) {
      return NextResponse.json({
        data: [],
        message: "No active campaigns found",
      });
    }
    
    const results = [];
    
    for (const campaign of campaigns) {
      // Parse campaign filter
      const filter = parseFilterFromJSON(campaign.filters);
      
      // Build base Prisma where clause
      let where: Record<string, unknown> = {};
      
      if (filter) {
        where = filterToPrismaWhere(filter);
      }
      
      // Add status filter
      where.status = { in: statuses };
      
      // Get prospects who have NOT been messaged in this campaign
      const messagedProspectIds = await prisma.outreachLog.findMany({
        where: {
          campaignId: campaign.id,
          status: { in: ["sent", "delivered", "replied", "pending"] },
        },
        select: { prospectId: true },
        distinct: ["prospectId"],
      });
      
      const messagedIds = messagedProspectIds.map(p => p.prospectId);
      
      if (messagedIds.length > 0) {
        where.id = { notIn: messagedIds };
      }
      
      // Fetch prospects
      const prospects = await prisma.prospect.findMany({
        where,
        take: limit,
        orderBy: [
          { score: "desc" },
          { createdAt: "desc" },
        ],
      });
      
      // Parse JSON fields
      let parsedProspects = prospects.map(p => ({
        ...p,
        tags: JSON.parse(p.tags),
        metadata: JSON.parse(p.metadata),
      }));
      
      // Apply any metadata-based filters in memory
      if (filter && hasMetadataFilters(filter)) {
        parsedProspects = filterCollection(
          parsedProspects as unknown as Record<string, unknown>[],
          filter
        ) as typeof parsedProspects;
      }
      
      results.push({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          template: campaign.messageTemplate,
        },
        prospects: parsedProspects,
        count: parsedProspects.length,
      });
    }
    
    return NextResponse.json({
      data: results,
      totalProspects: results.reduce((sum, r) => sum + r.count, 0),
    });
  } catch (error) {
    console.error("Error getting batch:", error);
    return NextResponse.json(
      { error: "Failed to get batch" },
      { status: 500 }
    );
  }
}

// Helper to check if filter contains metadata-based conditions
function hasMetadataFilters(filter: ReturnType<typeof parseFilterFromJSON>): boolean {
  if (!filter) return false;
  
  if (isFilterCondition(filter)) {
    return filter.field.startsWith("metadata.");
  }
  
  if (isFilterGroup(filter)) {
    return filter.conditions.some(c => hasMetadataFilters(c));
  }
  
  return false;
}
