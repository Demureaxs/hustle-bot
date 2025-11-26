import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createOutreachLog } from "@/lib/outreach";

const CONTEXT = "API:outreach/log";

/**
 * POST /api/outreach/log
 * 
 * Creates an OutreachLog record and updates the associated Prospect.status where appropriate.
 * 
 * Request body:
 * - prospectId: string (required) - ID of the prospect
 * - campaignId?: string - ID of the campaign
 * - channel: string (required) - channel used (email, dm, whatsapp, linkedin, etc.)
 * - templateId?: string - ID of the template used
 * - body?: string - actual message body (after template substitution)
 * - status: string (required) - status of the outreach (pending, sent, delivered, failed, replied)
 * - error?: string - error message if failed
 * - sentAt?: string (ISO date) - when the message was sent
 * - deliveredAt?: string (ISO date) - when the message was delivered
 * - repliedAt?: string (ISO date) - when the reply was received
 * - metadata?: object - additional metadata
 */
export async function POST(request: NextRequest) {
  logger.functionEntry("POST /api/outreach/log", {});

  try {
    // Parse request body
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
      status,
      error: errorMessage,
      sentAt,
      deliveredAt,
      repliedAt,
      metadata,
    } = body;

    // Validate required fields
    if (!prospectId) {
      logger.warn(CONTEXT, "Missing required field: prospectId");
      return NextResponse.json(
        { error: "Missing required field: prospectId" },
        { status: 400 }
      );
    }

    if (typeof prospectId !== "string") {
      logger.warn(CONTEXT, "Invalid prospectId type", { type: typeof prospectId });
      return NextResponse.json(
        { error: "Invalid prospectId: must be a string" },
        { status: 400 }
      );
    }

    if (!channel) {
      logger.warn(CONTEXT, "Missing required field: channel");
      return NextResponse.json(
        { error: "Missing required field: channel" },
        { status: 400 }
      );
    }

    if (typeof channel !== "string") {
      logger.warn(CONTEXT, "Invalid channel type", { type: typeof channel });
      return NextResponse.json(
        { error: "Invalid channel: must be a string" },
        { status: 400 }
      );
    }

    if (!status) {
      logger.warn(CONTEXT, "Missing required field: status");
      return NextResponse.json(
        { error: "Missing required field: status" },
        { status: 400 }
      );
    }

    if (typeof status !== "string") {
      logger.warn(CONTEXT, "Invalid status type", { type: typeof status });
      return NextResponse.json(
        { error: "Invalid status: must be a string" },
        { status: 400 }
      );
    }

    // Validate status value
    const validStatuses = ["pending", "sent", "delivered", "failed", "replied"];
    if (!validStatuses.includes(status)) {
      logger.warn(CONTEXT, "Invalid status value", { status, validStatuses });
      return NextResponse.json(
        { error: `Invalid status: must be one of ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate optional fields if provided
    if (campaignId !== undefined && typeof campaignId !== "string") {
      logger.warn(CONTEXT, "Invalid campaignId type", { type: typeof campaignId });
      return NextResponse.json(
        { error: "Invalid campaignId: must be a string" },
        { status: 400 }
      );
    }

    if (templateId !== undefined && typeof templateId !== "string") {
      logger.warn(CONTEXT, "Invalid templateId type", { type: typeof templateId });
      return NextResponse.json(
        { error: "Invalid templateId: must be a string" },
        { status: 400 }
      );
    }

    if (messageBody !== undefined && typeof messageBody !== "string") {
      logger.warn(CONTEXT, "Invalid body type", { type: typeof messageBody });
      return NextResponse.json(
        { error: "Invalid body: must be a string" },
        { status: 400 }
      );
    }

    if (errorMessage !== undefined && typeof errorMessage !== "string") {
      logger.warn(CONTEXT, "Invalid error type", { type: typeof errorMessage });
      return NextResponse.json(
        { error: "Invalid error: must be a string" },
        { status: 400 }
      );
    }

    if (metadata !== undefined && (typeof metadata !== "object" || metadata === null || Array.isArray(metadata))) {
      logger.warn(CONTEXT, "Invalid metadata type", { type: typeof metadata });
      return NextResponse.json(
        { error: "Invalid metadata: must be an object" },
        { status: 400 }
      );
    }

    logger.info(CONTEXT, "Creating outreach log", {
      prospectId,
      campaignId,
      channel,
      status,
    });

    // Create the outreach log
    const log = await createOutreachLog({
      prospectId: prospectId as string,
      campaignId: campaignId as string | undefined,
      channel: channel as string,
      templateId: templateId as string | undefined,
      body: messageBody as string | undefined,
      status: status as string,
      error: errorMessage as string | undefined,
      sentAt: sentAt as string | undefined,
      deliveredAt: deliveredAt as string | undefined,
      repliedAt: repliedAt as string | undefined,
      metadata: metadata as Record<string, unknown> | undefined,
    });

    logger.info(CONTEXT, "Outreach log created successfully", {
      logId: log.id,
      prospectId: log.prospectId,
      status: log.status,
    });

    logger.functionExit("POST /api/outreach/log", {
      success: true,
      data: { logId: log.id },
    });

    return NextResponse.json(
      { data: log },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(CONTEXT, "Failed to create outreach log", {
      error: error instanceof Error ? error : new Error(String(error)),
    });

    // Handle specific error cases
    if (errorMessage === "Prospect not found") {
      logger.functionExit("POST /api/outreach/log", { success: false });
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 400 }
      );
    }

    if (errorMessage === "Campaign not found") {
      logger.functionExit("POST /api/outreach/log", { success: false });
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 400 }
      );
    }

    logger.functionExit("POST /api/outreach/log", { success: false });
    return NextResponse.json(
      { error: "Failed to create outreach log" },
      { status: 500 }
    );
  }
}
