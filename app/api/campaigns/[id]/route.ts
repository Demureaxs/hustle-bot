import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { 
  validateFilter, 
  filterToReadableString, 
  parseFilterFromJSON 
} from "@/lib/filters";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/campaigns/[id] - Get a single campaign
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
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
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }
    
    const filter = parseFilterFromJSON(campaign.filters);
    
    return NextResponse.json({
      data: {
        ...campaign,
        filters: filter,
        filterSummary: filterToReadableString(filter),
      },
    });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

// PATCH /api/campaigns/[id] - Update a campaign
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const {
      name,
      description,
      filters,
      templateId,
      active,
    } = body;
    
    // Validate filter structure if provided
    if (filters !== undefined && filters !== null && !validateFilter(filters)) {
      return NextResponse.json(
        { error: "Invalid filter structure" },
        { status: 400 }
      );
    }
    
    const updateData: Record<string, unknown> = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (filters !== undefined) updateData.filters = JSON.stringify(filters);
    if (templateId !== undefined) updateData.templateId = templateId;
    if (active !== undefined) updateData.active = active;
    
    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData,
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
    });
  } catch (error) {
    console.error("Error updating campaign:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns/[id] - Delete a campaign
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    await prisma.campaign.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
