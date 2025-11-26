import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { listCampaigns, createCampaign } from "@/lib/campaigns";
import { validateFilter, type Filter } from "@/lib/filters";

const CONTEXT = "API:campaigns";

// GET /api/campaigns - List all campaigns
export async function GET(request: NextRequest) {
  logger.functionEntry("GET /api/campaigns", {});

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true" || searchParams.get("activeOnly") === "true";
    
    logger.debug(CONTEXT, "GET request parameters", { activeOnly });
    
    const campaigns = await listCampaigns(activeOnly);

    logger.info(CONTEXT, "Campaigns retrieved successfully", { count: campaigns.length });
    logger.functionExit("GET /api/campaigns", { success: true, data: { count: campaigns.length } });
    
    return NextResponse.json({ data: campaigns });
  } catch (error) {
    logger.error(CONTEXT, "Error fetching campaigns", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    logger.functionExit("GET /api/campaigns", { success: false });
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST /api/campaigns - Create a new campaign
export async function POST(request: NextRequest) {
  logger.functionEntry("POST /api/campaigns", {});

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
      logger.debug(CONTEXT, "Request body parsed", {
        hasName: !!body.name,
        hasFilters: !!body.filters,
        hasTemplateId: !!body.templateId,
      });
    } catch (error) {
      logger.warn(CONTEXT, "Failed to parse request body", {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    
    const {
      name,
      description,
      filters,
      templateId,
      active = true,
    } = body;
    
    // Validate required fields
    if (!name) {
      logger.warn(CONTEXT, "Missing required field: name");
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }
    
    // Validate filter structure if provided
    if (filters && !validateFilter(filters)) {
      logger.warn(CONTEXT, "Invalid filter structure");
      return NextResponse.json(
        { error: "Invalid filter structure" },
        { status: 400 }
      );
    }

    logger.info(CONTEXT, "Creating campaign", { name });
    
    const campaign = await createCampaign({
      name: name as string,
      description: description as string | undefined,
      filters: filters as Filter | undefined,
      templateId: templateId as string | undefined,
      active: active as boolean,
    });

    logger.info(CONTEXT, "Campaign created successfully", { id: campaign.id, name: campaign.name });
    logger.functionExit("POST /api/campaigns", { success: true, data: { id: campaign.id } });
    
    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(CONTEXT, "Error creating campaign", {
      error: error instanceof Error ? error : new Error(String(error)),
    });

    if (errorMessage === "Invalid filter structure") {
      logger.functionExit("POST /api/campaigns", { success: false });
      return NextResponse.json(
        { error: "Invalid filter structure" },
        { status: 400 }
      );
    }

    if (errorMessage === "Message template not found") {
      logger.functionExit("POST /api/campaigns", { success: false });
      return NextResponse.json(
        { error: "Message template not found" },
        { status: 400 }
      );
    }

    logger.functionExit("POST /api/campaigns", { success: false });
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
