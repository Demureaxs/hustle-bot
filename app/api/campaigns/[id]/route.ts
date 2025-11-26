import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getCampaignById, updateCampaign, deleteCampaign } from "@/lib/campaigns";
import { validateFilter, type Filter } from "@/lib/filters";
import prisma from "@/lib/db";

const CONTEXT = "API:campaigns/[id]";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/campaigns/[id] - Get a single campaign
export async function GET(request: NextRequest, { params }: RouteParams) {
  logger.functionEntry("GET /api/campaigns/[id]", {});

  try {
    const { id } = await params;
    logger.info(CONTEXT, "Getting campaign", { id });
    
    // Use prisma directly to include outreach logs
    logger.debug(CONTEXT, "Fetching campaign with template and outreach logs");
    
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        messageTemplate: true,
        outreachLogs: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    
    if (!campaign) {
      logger.warn(CONTEXT, "Campaign not found", { id });
      logger.functionExit("GET /api/campaigns/[id]", { success: false });
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }
    
    // Get parsed campaign for filter handling
    const parsedCampaign = await getCampaignById(id);
    
    logger.info(CONTEXT, "Campaign retrieved successfully", { id, outreachLogCount: campaign.outreachLogs.length });
    logger.functionExit("GET /api/campaigns/[id]", { success: true, data: { id } });
    
    return NextResponse.json({
      data: {
        ...campaign,
        filters: parsedCampaign?.filters,
        filterSummary: parsedCampaign?.filterSummary,
      },
    });
  } catch (error) {
    logger.error(CONTEXT, "Error fetching campaign", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    logger.functionExit("GET /api/campaigns/[id]", { success: false });
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

// PATCH /api/campaigns/[id] - Update a campaign
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  logger.functionEntry("PATCH /api/campaigns/[id]", {});

  try {
    const { id } = await params;
    logger.info(CONTEXT, "Updating campaign", { id });

    let body: Record<string, unknown>;
    try {
      body = await request.json();
      logger.debug(CONTEXT, "Request body parsed", { updateKeys: Object.keys(body) });
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
      active,
    } = body;
    
    // Validate filter structure if provided
    if (filters !== undefined && filters !== null && !validateFilter(filters)) {
      logger.warn(CONTEXT, "Invalid filter structure");
      return NextResponse.json(
        { error: "Invalid filter structure" },
        { status: 400 }
      );
    }
    
    const campaign = await updateCampaign(id, {
      name: name as string | undefined,
      description: description as string | undefined,
      filters: filters as Filter | undefined,
      templateId: templateId as string | undefined,
      active: active as boolean | undefined,
    });

    logger.info(CONTEXT, "Campaign updated successfully", { id });
    logger.functionExit("PATCH /api/campaigns/[id]", { success: true, data: { id } });
    
    return NextResponse.json({ data: campaign });
  } catch (error) {
    const errorCode = (error as { code?: string }).code;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(CONTEXT, "Error updating campaign", {
      error: error instanceof Error ? error : new Error(String(error)),
      errorCode,
    });

    if (errorCode === "P2025") {
      logger.functionExit("PATCH /api/campaigns/[id]", { success: false });
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (errorMessage === "Invalid filter structure") {
      logger.functionExit("PATCH /api/campaigns/[id]", { success: false });
      return NextResponse.json(
        { error: "Invalid filter structure" },
        { status: 400 }
      );
    }

    logger.functionExit("PATCH /api/campaigns/[id]", { success: false });
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns/[id] - Delete a campaign
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  logger.functionEntry("DELETE /api/campaigns/[id]", {});

  try {
    const { id } = await params;
    logger.info(CONTEXT, "Deleting campaign", { id });
    
    await deleteCampaign(id);

    logger.info(CONTEXT, "Campaign deleted successfully", { id });
    logger.functionExit("DELETE /api/campaigns/[id]", { success: true });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorCode = (error as { code?: string }).code;
    
    logger.error(CONTEXT, "Error deleting campaign", {
      error: error instanceof Error ? error : new Error(String(error)),
      errorCode,
    });

    if (errorCode === "P2025") {
      logger.functionExit("DELETE /api/campaigns/[id]", { success: false });
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    logger.functionExit("DELETE /api/campaigns/[id]", { success: false });
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
