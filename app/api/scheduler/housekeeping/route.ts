import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * POST /api/scheduler/housekeeping
 * 
 * Runs periodic housekeeping tasks:
 * - Update prospect statuses based on outreach responses
 * - Clean up stale pending outreach logs
 * - Calculate/update derived statistics
 * 
 * Can be called by cron jobs or GitHub Actions
 */
export async function POST() {
  try {
    const results = {
      respondedProspects: 0,
      staleLogsUpdated: 0,
      statsUpdated: {
        totalProspects: 0,
        byStatus: {} as Record<string, number>,
        activeCampaigns: 0,
        recentOutreach: 0,
      },
    };
    
    // 1. Update prospect statuses based on replied outreach logs
    const repliedLogs = await prisma.outreachLog.findMany({
      where: {
        repliedAt: { not: null },
        prospect: {
          status: { not: "responded" },
        },
      },
      select: {
        prospectId: true,
      },
      distinct: ["prospectId"],
    });
    
    if (repliedLogs.length > 0) {
      const updated = await prisma.prospect.updateMany({
        where: {
          id: { in: repliedLogs.map(l => l.prospectId) },
        },
        data: { status: "responded" },
      });
      results.respondedProspects = updated.count;
    }
    
    // 2. Mark stale pending outreach logs as failed (older than 24 hours)
    const staleDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const staleUpdated = await prisma.outreachLog.updateMany({
      where: {
        status: "pending",
        createdAt: { lt: staleDate },
      },
      data: {
        status: "failed",
        error: "Timed out - no status update received",
      },
    });
    results.staleLogsUpdated = staleUpdated.count;
    
    // 3. Calculate statistics
    const [totalProspects, statusCounts, activeCampaigns, recentOutreach] = await Promise.all([
      prisma.prospect.count(),
      prisma.prospect.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.campaign.count({ where: { active: true } }),
      prisma.outreachLog.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        },
      }),
    ]);
    
    results.statsUpdated = {
      totalProspects,
      byStatus: statusCounts.reduce((acc, s) => {
        acc[s.status] = s._count.status;
        return acc;
      }, {} as Record<string, number>),
      activeCampaigns,
      recentOutreach,
    };
    
    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error running housekeeping:", error);
    return NextResponse.json(
      { error: "Failed to run housekeeping" },
      { status: 500 }
    );
  }
}

// GET for health check / status
export async function GET() {
  try {
    // Quick stats
    const [totalProspects, activeCampaigns, pendingOutreach] = await Promise.all([
      prisma.prospect.count(),
      prisma.campaign.count({ where: { active: true } }),
      prisma.outreachLog.count({ where: { status: "pending" } }),
    ]);
    
    return NextResponse.json({
      status: "ok",
      stats: {
        totalProspects,
        activeCampaigns,
        pendingOutreach,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting status:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
