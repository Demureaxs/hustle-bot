import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { 
  validateFilter, 
  filterToReadableString, 
  parseFilterFromJSON,
  filterToPrismaWhere,
  filterCollection,
  type Filter 
} from "@/lib/filters";

// GET /api/campaigns - List all campaigns
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    
    const where = activeOnly ? { active: true } : {};
    
    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        messageTemplate: true,
      },
      orderBy: { createdAt: "desc" },
    });
    
    // Parse filters and add readable summaries
    const parsedCampaigns = campaigns.map(c => {
      const filter = parseFilterFromJSON(c.filters);
      return {
        ...c,
        filters: filter,
        filterSummary: filterToReadableString(filter),
      };
    });
    
    return NextResponse.json({ data: parsedCampaigns });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST /api/campaigns - Create a new campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      name,
      description,
      filters,
      templateId,
      active = true,
    } = body;
    
    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }
    
    // Validate filter structure if provided
    if (filters && !validateFilter(filters)) {
      return NextResponse.json(
        { error: "Invalid filter structure" },
        { status: 400 }
      );
    }
    
    // Verify template exists if provided
    if (templateId) {
      const template = await prisma.messageTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        return NextResponse.json(
          { error: "Message template not found" },
          { status: 400 }
        );
      }
    }
    
    const campaign = await prisma.campaign.create({
      data: {
        name,
        description,
        filters: JSON.stringify(filters || {}),
        templateId,
        active,
      },
      include: {
        messageTemplate: true,
      },
    });
    
    const parsedFilter = parseFilterFromJSON(campaign.filters);
    
    return NextResponse.json({
      data: {
        ...campaign,
        filters: parsedFilter,
        filterSummary: filterToReadableString(parsedFilter),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
