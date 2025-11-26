import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/outreach - List outreach logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const skip = (page - 1) * limit;
    
    // Filters
    const campaignId = searchParams.get("campaignId");
    const prospectId = searchParams.get("prospectId");
    const status = searchParams.get("status");
    const channel = searchParams.get("channel");
    
    const where: Record<string, unknown> = {};
    
    if (campaignId) where.campaignId = campaignId;
    if (prospectId) where.prospectId = prospectId;
    if (status) where.status = status;
    if (channel) where.channel = channel;
    
    const [logs, total] = await Promise.all([
      prisma.outreachLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          prospect: {
            select: {
              id: true,
              name: true,
              company: true,
              email: true,
            },
          },
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.outreachLog.count({ where }),
    ]);
    
    const parsedLogs = logs.map(log => ({
      ...log,
      metadata: JSON.parse(log.metadata),
    }));
    
    return NextResponse.json({
      data: parsedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching outreach logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch outreach logs" },
      { status: 500 }
    );
  }
}

// POST /api/outreach - Create a new outreach log (record outreach attempt)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
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
      return NextResponse.json(
        { error: "Missing required fields: prospectId, channel" },
        { status: 400 }
      );
    }
    
    // Verify prospect exists
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
    });
    
    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 400 }
      );
    }
    
    // Verify campaign exists if provided
    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 400 }
        );
      }
    }
    
    const log = await prisma.outreachLog.create({
      data: {
        prospectId,
        campaignId,
        channel,
        templateId,
        body: messageBody,
        sentAt: sentAt ? new Date(sentAt) : null,
        deliveredAt: deliveredAt ? new Date(deliveredAt) : null,
        repliedAt: repliedAt ? new Date(repliedAt) : null,
        status,
        error: errorMessage,
        metadata: JSON.stringify(metadata),
      },
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
    
    // If message was sent, update prospect status
    if (status === "sent" || status === "delivered") {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: { status: "messaged" },
      });
    }
    
    return NextResponse.json({
      data: {
        ...log,
        metadata: JSON.parse(log.metadata),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating outreach log:", error);
    return NextResponse.json(
      { error: "Failed to create outreach log" },
      { status: 500 }
    );
  }
}
