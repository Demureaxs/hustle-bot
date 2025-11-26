import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { selectProspectsForCampaign } from "@/lib/campaigns";

const CONTEXT = "API:campaigns/[id]/select-prospects";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/campaigns/[id]/select-prospects
 * 
 * Uses the campaign's filter engine to select eligible prospects for outreach.
 * 
 * Request body:
 * - limit?: number (default 50) - max prospects to return
 * - statusIn?: string[] (default ["approved"]) - filter by prospect status
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  logger.functionEntry("POST /api/campaigns/[id]/select-prospects", {});

  try {
    const { id } = await params;
    logger.info(CONTEXT, "Selecting prospects for campaign", { campaignId: id });

    // Parse request body
    let body: { limit?: number; statusIn?: string[] } = {};
    try {
      body = await request.json();
      logger.debug(CONTEXT, "Request body parsed", {
        limit: body.limit,
        statusIn: body.statusIn,
      });
    } catch {
      logger.debug(CONTEXT, "No request body or invalid JSON, using defaults");
    }

    const { limit, statusIn } = body;

    // Validate limit if provided
    if (limit !== undefined) {
      logger.branchTaken(CONTEXT, "limit provided in request", { limit });
      if (typeof limit !== "number" || limit < 1 || limit > 100) {
        logger.warn(CONTEXT, "Invalid limit value", { limit });
        return NextResponse.json(
          { error: "Invalid limit: must be a number between 1 and 100" },
          { status: 400 }
        );
      }
    }

    // Validate statusIn if provided
    if (statusIn !== undefined) {
      logger.branchTaken(CONTEXT, "statusIn provided in request", { statusIn });
      if (!Array.isArray(statusIn) || !statusIn.every((s) => typeof s === "string")) {
        logger.warn(CONTEXT, "Invalid statusIn value", { statusIn });
        return NextResponse.json(
          { error: "Invalid statusIn: must be an array of strings" },
          { status: 400 }
        );
      }
    }

    // Select prospects using the campaign service
    logger.debug(CONTEXT, "Calling selectProspectsForCampaign", { campaignId: id, limit, statusIn });

    const result = await selectProspectsForCampaign(id, {
      limit,
      statusIn,
    });

    logger.info(CONTEXT, "Prospects selected successfully", {
      campaignId: result.campaignId,
      campaignName: result.campaignName,
      count: result.count,
    });

    logger.functionExit("POST /api/campaigns/[id]/select-prospects", {
      success: true,
      data: { count: result.count },
    });

    return NextResponse.json({
      data: result.prospects,
      campaign: {
        id: result.campaignId,
        name: result.campaignName,
      },
      count: result.count,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(CONTEXT, "Failed to select prospects for campaign", {
      error: error instanceof Error ? error : new Error(String(error)),
    });

    // Handle specific error cases
    if (errorMessage === "Campaign not found") {
      logger.functionExit("POST /api/campaigns/[id]/select-prospects", { success: false });
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    logger.functionExit("POST /api/campaigns/[id]/select-prospects", { success: false });
    return NextResponse.json(
      { error: "Failed to select prospects for campaign" },
      { status: 500 }
    );
  }
}
