import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getProspectById, updateProspect, deleteProspect } from "@/lib/prospects";
import prisma from "@/lib/db";

const CONTEXT = "API:prospects/[id]";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/prospects/[id] - Get a single prospect
export async function GET(request: NextRequest, { params }: RouteParams) {
  logger.functionEntry("GET /api/prospects/[id]", {});

  try {
    const { id } = await params;
    logger.info(CONTEXT, "Getting prospect", { id });
    
    // Use prisma directly to include outreach logs
    logger.debug(CONTEXT, "Fetching prospect with outreach logs");
    
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: {
        outreachLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    
    if (!prospect) {
      logger.warn(CONTEXT, "Prospect not found", { id });
      logger.functionExit("GET /api/prospects/[id]", { success: false });
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }

    logger.info(CONTEXT, "Prospect retrieved successfully", { id, outreachLogCount: prospect.outreachLogs.length });
    logger.functionExit("GET /api/prospects/[id]", { success: true, data: { id } });
    
    return NextResponse.json({
      data: {
        ...prospect,
        tags: JSON.parse(prospect.tags),
        metadata: JSON.parse(prospect.metadata),
        outreachLogs: prospect.outreachLogs.map(log => ({
          ...log,
          metadata: JSON.parse(log.metadata),
        })),
      },
    });
  } catch (error) {
    logger.error(CONTEXT, "Error fetching prospect", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    logger.functionExit("GET /api/prospects/[id]", { success: false });
    return NextResponse.json(
      { error: "Failed to fetch prospect" },
      { status: 500 }
    );
  }
}

// PATCH /api/prospects/[id] - Update a prospect
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  logger.functionEntry("PATCH /api/prospects/[id]", {});

  try {
    const { id } = await params;
    logger.info(CONTEXT, "Updating prospect", { id });

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
      role,
      company,
      location,
      email,
      phone,
      tags,
      metadata,
      status,
      score,
    } = body;
    
    const prospect = await updateProspect(id, {
      name: name as string | undefined,
      role: role as string | undefined,
      company: company as string | undefined,
      location: location as string | undefined,
      email: email as string | undefined,
      phone: phone as string | undefined,
      tags: tags as string[] | undefined,
      metadata: metadata as Record<string, unknown> | undefined,
      status: status as string | undefined,
      score: score as number | undefined,
    });

    logger.info(CONTEXT, "Prospect updated successfully", { id });
    logger.functionExit("PATCH /api/prospects/[id]", { success: true, data: { id } });
    
    return NextResponse.json({ data: prospect });
  } catch (error) {
    const errorCode = (error as { code?: string }).code;
    
    logger.error(CONTEXT, "Error updating prospect", {
      error: error instanceof Error ? error : new Error(String(error)),
      errorCode,
    });

    if (errorCode === "P2025") {
      logger.functionExit("PATCH /api/prospects/[id]", { success: false });
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }

    logger.functionExit("PATCH /api/prospects/[id]", { success: false });
    return NextResponse.json(
      { error: "Failed to update prospect" },
      { status: 500 }
    );
  }
}

// DELETE /api/prospects/[id] - Delete a prospect
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  logger.functionEntry("DELETE /api/prospects/[id]", {});

  try {
    const { id } = await params;
    logger.info(CONTEXT, "Deleting prospect", { id });
    
    await deleteProspect(id);

    logger.info(CONTEXT, "Prospect deleted successfully", { id });
    logger.functionExit("DELETE /api/prospects/[id]", { success: true });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorCode = (error as { code?: string }).code;
    
    logger.error(CONTEXT, "Error deleting prospect", {
      error: error instanceof Error ? error : new Error(String(error)),
      errorCode,
    });

    if (errorCode === "P2025") {
      logger.functionExit("DELETE /api/prospects/[id]", { success: false });
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }

    logger.functionExit("DELETE /api/prospects/[id]", { success: false });
    return NextResponse.json(
      { error: "Failed to delete prospect" },
      { status: 500 }
    );
  }
}
