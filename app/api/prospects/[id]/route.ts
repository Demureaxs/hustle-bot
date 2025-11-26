import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/prospects/[id] - Get a single prospect
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: {
        outreachLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    
    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }
    
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
    console.error("Error fetching prospect:", error);
    return NextResponse.json(
      { error: "Failed to fetch prospect" },
      { status: 500 }
    );
  }
}

// PATCH /api/prospects/[id] - Update a prospect
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
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
    
    const updateData: Record<string, unknown> = {};
    
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (company !== undefined) updateData.company = company;
    if (location !== undefined) updateData.location = location;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);
    if (status !== undefined) updateData.status = status;
    if (score !== undefined) updateData.score = score;
    
    const prospect = await prisma.prospect.update({
      where: { id },
      data: updateData,
    });
    
    return NextResponse.json({
      data: {
        ...prospect,
        tags: JSON.parse(prospect.tags),
        metadata: JSON.parse(prospect.metadata),
      },
    });
  } catch (error) {
    console.error("Error updating prospect:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update prospect" },
      { status: 500 }
    );
  }
}

// DELETE /api/prospects/[id] - Delete a prospect
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    await prisma.prospect.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting prospect:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete prospect" },
      { status: 500 }
    );
  }
}
