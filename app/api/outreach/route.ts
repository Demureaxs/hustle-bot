import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { listOutreachLogs, createOutreachLog } from "@/lib/outreach";

const CONTEXT = "API:outreach";

// GET /api/outreach - List outreach logs
export async function GET(request: NextRequest) {
  logger.functionEntry("GET /api/outreach", {});

  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;
    
    // Filters
    const campaignId = searchParams.get("campaignId") || undefined;
    const prospectId = searchParams.get("prospectId") || undefined;
    const status = searchParams.get("status") || undefined;
    const channel = searchParams.get("channel") || undefined;

    logger.debug(CONTEXT, "GET request parameters", {
      page,
      limit,
      offset,
      campaignId,
      prospectId,
      status,
      channel,
    });
    
    const result = await listOutreachLogs({
      campaignId,
      prospectId,
      status,
      channel,
      limit,
      offset,
    });

    logger.info(CONTEXT, "Outreach logs retrieved successfully", {
      count: result.logs.length,
      total: result.total,
    });

    logger.functionExit("GET /api/outreach", {
      success: true,
      data: { count: result.logs.length, total: result.total },
    });
    
    return NextResponse.json({
      data: result.logs,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    logger.error(CONTEXT, "Error fetching outreach logs", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    logger.functionExit("GET /api/outreach", { success: false });
    return NextResponse.json(
      { error: "Failed to fetch outreach logs" },
      { status: 500 }
    );
  }
}

// POST /api/outreach - Create a new outreach log (record outreach attempt)
export async function POST(request: NextRequest) {
  logger.functionEntry("POST /api/outreach", {});

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
      logger.debug(CONTEXT, "Request body parsed", {
        hasProspectId: !!body.prospectId,
        hasCampaignId: !!body.campaignId,
        channel: body.channel,
        status: body.status,
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
      prospectId,
      campaignId,
      channel,
      templateId,
      body: messageBody,
      sentAt,
      deliveredAt,
      repliedAt,
      status = "pending",
      error: errorMessage,
      metadata = {},
    } = body;
    
    // Validate required fields
    if (!prospectId || !channel) {
      logger.warn(CONTEXT, "Missing required fields", {
        hasProspectId: !!prospectId,
        hasChannel: !!channel,
      });
      return NextResponse.json(
        { error: "Missing required fields: prospectId, channel" },
        { status: 400 }
      );
    }

    logger.info(CONTEXT, "Creating outreach log", {
      prospectId,
      campaignId,
      channel,
      status,
    });
    
    const log = await createOutreachLog({
      prospectId: prospectId as string,
      campaignId: campaignId as string | undefined,
      channel: channel as string,
      templateId: templateId as string | undefined,
      body: messageBody as string | undefined,
      sentAt: sentAt as string | undefined,
      deliveredAt: deliveredAt as string | undefined,
      repliedAt: repliedAt as string | undefined,
      status: status as string,
      error: errorMessage as string | undefined,
      metadata: metadata as Record<string, unknown>,
    });

    logger.info(CONTEXT, "Outreach log created successfully", { id: log.id });
    logger.functionExit("POST /api/outreach", { success: true, data: { id: log.id } });
    
    return NextResponse.json({ data: log }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(CONTEXT, "Error creating outreach log", {
      error: error instanceof Error ? error : new Error(String(error)),
    });

    if (errorMessage === "Prospect not found") {
      logger.functionExit("POST /api/outreach", { success: false });
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 400 }
      );
    }

    if (errorMessage === "Campaign not found") {
      logger.functionExit("POST /api/outreach", { success: false });
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 400 }
      );
    }

    logger.functionExit("POST /api/outreach", { success: false });
    return NextResponse.json(
      { error: "Failed to create outreach log" },
      { status: 500 }
    );
  }
}
