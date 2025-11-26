import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/outreach/[id] - Update an outreach log (e.g., mark as delivered, replied)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const {
      sentAt,
      deliveredAt,
      repliedAt,
      status,
      error: errorMessage,
      metadata,
    } = body;
    
    const updateData: Record<string, unknown> = {};
    
    if (sentAt !== undefined) updateData.sentAt = sentAt ? new Date(sentAt) : null;
    if (deliveredAt !== undefined) updateData.deliveredAt = deliveredAt ? new Date(deliveredAt) : null;
    if (repliedAt !== undefined) updateData.repliedAt = repliedAt ? new Date(repliedAt) : null;
    if (status !== undefined) updateData.status = status;
    if (errorMessage !== undefined) updateData.error = errorMessage;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);
    
    const log = await prisma.outreachLog.update({
      where: { id },
      data: updateData,
      include: {
        prospect: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    // Update prospect status based on outreach status
    if (status === "replied") {
      await prisma.prospect.update({
        where: { id: log.prospectId },
        data: { status: "responded" },
      });
    }
    
    return NextResponse.json({
      data: {
        ...log,
        metadata: JSON.parse(log.metadata),
      },
    });
  } catch (error) {
    console.error("Error updating outreach log:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Outreach log not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update outreach log" },
      { status: 500 }
    );
  }
}
