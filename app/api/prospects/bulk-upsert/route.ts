import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { bulkUpsertProspects, type ProspectPayload } from "@/lib/prospects";

const CONTEXT = "API:prospects/bulk-upsert";

// POST /api/prospects/bulk-upsert - Bulk upsert prospects from scrapers
export async function POST(request: NextRequest) {
  logger.functionEntry("POST /api/prospects/bulk-upsert", {});

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
      logger.debug(CONTEXT, "Request body parsed", {
        hasProspects: !!body.prospects,
        isArray: Array.isArray(body.prospects),
        count: Array.isArray(body.prospects) ? body.prospects.length : 0,
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
    
    if (!Array.isArray(body.prospects)) {
      logger.warn(CONTEXT, "Expected 'prospects' array in request body", {
        receivedType: typeof body.prospects,
      });
      return NextResponse.json(
        { error: "Expected 'prospects' array in request body" },
        { status: 400 }
      );
    }
    
    const prospects = body.prospects as Record<string, unknown>[];

    logger.info(CONTEXT, "Starting bulk upsert", { prospectCount: prospects.length });
    
    // Validate all prospects have required fields
    const invalidProspects: number[] = [];
    for (let i = 0; i < prospects.length; i++) {
      const p = prospects[i];
      if (!p.source || !p.externalId || !p.name) {
        logger.debug(CONTEXT, "Invalid prospect found", {
          index: i,
          hasSource: !!p.source,
          hasExternalId: !!p.externalId,
          hasName: !!p.name,
        });
        invalidProspects.push(i);
      }
    }
    
    if (invalidProspects.length > 0) {
      logger.warn(CONTEXT, "Some prospects are missing required fields", {
        invalidCount: invalidProspects.length,
        invalidIndices: invalidProspects.slice(0, 10),
      });
      return NextResponse.json(
        { 
          error: "Some prospects are missing required fields (source, externalId, name)",
          invalidCount: invalidProspects.length,
        },
        { status: 400 }
      );
    }

    // Convert to ProspectPayload type
    const prospectPayloads: ProspectPayload[] = prospects.map(p => ({
      source: p.source as string,
      externalId: p.externalId as string,
      name: p.name as string,
      role: p.role as string | undefined,
      company: p.company as string | undefined,
      location: p.location as string | undefined,
      email: p.email as string | undefined,
      phone: p.phone as string | undefined,
      tags: p.tags as string[] | undefined,
      metadata: p.metadata as Record<string, unknown> | undefined,
      status: p.status as string | undefined,
      score: p.score as number | undefined,
    }));
    
    // Perform bulk upsert using service
    const results = await bulkUpsertProspects(prospectPayloads);

    logger.info(CONTEXT, "Bulk upsert completed", {
      total: results.total,
      created: results.created,
      updated: results.updated,
      errorCount: results.errorCount,
    });

    logger.functionExit("POST /api/prospects/bulk-upsert", {
      success: true,
      data: { created: results.created, updated: results.updated },
    });
    
    return NextResponse.json({
      success: true,
      results: {
        total: results.total,
        created: results.created,
        updated: results.updated,
        errorCount: results.errorCount,
        errors: results.errorCount > 0 ? results.errors.slice(0, 10) : undefined,
      },
    });
  } catch (error) {
    logger.error(CONTEXT, "Error bulk upserting prospects", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    logger.functionExit("POST /api/prospects/bulk-upsert", { success: false });
    return NextResponse.json(
      { error: "Failed to bulk upsert prospects" },
      { status: 500 }
    );
  }
}
