import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { 
  parseFilterFromJSON, 
  filterToPrismaWhere,
  filterCollection,
  isFilterGroup,
  isFilterCondition 
} from "@/lib/filters";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/campaigns/[id]/prospects - Get prospects eligible for outreach for this campaign
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const skip = (page - 1) * limit;
    
    // Additional status constraint (e.g., only get approved prospects)
    const statusFilter = searchParams.get("status"); // Comma-separated statuses
    
    // Exclude already messaged (for outreach batch)
    const excludeMessaged = searchParams.get("excludeMessaged") === "true";
    
    // Fetch campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });
    
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }
    
    if (!campaign.active) {
      return NextResponse.json(
        { error: "Campaign is not active" },
        { status: 400 }
      );
    }
    
    // Parse campaign filter
    const filter = parseFilterFromJSON(campaign.filters);
    
    // Build base Prisma where clause
    let where: Record<string, unknown> = {};
    
    // Apply campaign filter (for direct DB fields)
    if (filter) {
      where = filterToPrismaWhere(filter);
    }
    
    // Add status filter if provided
    if (statusFilter) {
      const statuses = statusFilter.split(",").map(s => s.trim());
      where.status = { in: statuses };
    }
    
    // Exclude already messaged prospects if requested
    if (excludeMessaged) {
      // Get prospects who have been messaged in this campaign
      const messagedProspectIds = await prisma.outreachLog.findMany({
        where: {
          campaignId: id,
          status: { in: ["sent", "delivered", "replied"] },
        },
        select: { prospectId: true },
        distinct: ["prospectId"],
      });
      
      const messagedIds = messagedProspectIds.map(p => p.prospectId);
      
      if (messagedIds.length > 0) {
        where.id = { notIn: messagedIds };
      }
    }
    
    // Fetch prospects
    const [prospects, total] = await Promise.all([
      prisma.prospect.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { score: "desc" }, // Prioritize high-score prospects
          { createdAt: "desc" },
        ],
      }),
      prisma.prospect.count({ where }),
    ]);
    
    // Parse JSON fields and apply any metadata-based filters in memory
    let parsedProspects = prospects.map(p => ({
      ...p,
      tags: JSON.parse(p.tags),
      metadata: JSON.parse(p.metadata),
    }));
    
    // If there are metadata-based filters, apply them in memory
    // This is a simplified approach - in production you might want to 
    // handle this differently or use a database that supports JSON queries
    if (filter && hasMetadataFilters(filter)) {
      parsedProspects = filterCollection(
        parsedProspects as unknown as Record<string, unknown>[],
        filter
      ) as typeof parsedProspects;
    }
    
    return NextResponse.json({
      data: parsedProspects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
    });
  } catch (error) {
    console.error("Error fetching eligible prospects:", error);
    return NextResponse.json(
      { error: "Failed to fetch eligible prospects" },
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
