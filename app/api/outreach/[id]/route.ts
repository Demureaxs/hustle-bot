import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { updateOutreachLog, getOutreachLogById } from "@/lib/outreach";

const CONTEXT = "API:outreach/[id]";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/outreach/[id] - Get a single outreach log
export async function GET(request: NextRequest, { params }: RouteParams) {
  logger.functionEntry("GET /api/outreach/[id]", {});

  try {
    const { id } = await params;
    logger.info(CONTEXT, "Getting outreach log", { id });
    
    const log = await getOutreachLogById(id);
    
    if (!log) {
      logger.warn(CONTEXT, "Outreach log not found", { id });
      logger.functionExit("GET /api/outreach/[id]", { success: false });
      return NextResponse.json(
        { error: "Outreach log not found" },
        { status: 404 }
      );
    }

    logger.info(CONTEXT, "Outreach log retrieved successfully", { id });
    logger.functionExit("GET /api/outreach/[id]", { success: true, data: { id } });
    
    return NextResponse.json({ data: log });
  } catch (error) {
    logger.error(CONTEXT, "Error fetching outreach log", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    logger.functionExit("GET /api/outreach/[id]", { success: false });
    return NextResponse.json(
      { error: "Failed to fetch outreach log" },
      { status: 500 }
    );
  }
}

// PATCH /api/outreach/[id] - Update an outreach log (e.g., mark as delivered, replied)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  logger.functionEntry("PATCH /api/outreach/[id]", {});

  try {
    const { id } = await params;
    logger.info(CONTEXT, "Updating outreach log", { id });

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
      sentAt,
      deliveredAt,
      repliedAt,
      status,
      error: errorMessage,
      metadata,
    } = body;
    
    const log = await updateOutreachLog(id, {
      sentAt: sentAt as string | undefined,
      deliveredAt: deliveredAt as string | undefined,
      repliedAt: repliedAt as string | undefined,
      status: status as string | undefined,
      error: errorMessage as string | undefined,
      metadata: metadata as Record<string, unknown> | undefined,
    });

    logger.info(CONTEXT, "Outreach log updated successfully", { id, newStatus: log.status });
    logger.functionExit("PATCH /api/outreach/[id]", { success: true, data: { id } });
    
    return NextResponse.json({ data: log });
  } catch (error) {
    const errorCode = (error as { code?: string }).code;
    
    logger.error(CONTEXT, "Error updating outreach log", {
      error: error instanceof Error ? error : new Error(String(error)),
      errorCode,
    });

    if (errorCode === "P2025") {
      logger.functionExit("PATCH /api/outreach/[id]", { success: false });
      return NextResponse.json(
        { error: "Outreach log not found" },
        { status: 404 }
      );
    }

    logger.functionExit("PATCH /api/outreach/[id]", { success: false });
    return NextResponse.json(
      { error: "Failed to update outreach log" },
      { status: 500 }
    );
  }
}
