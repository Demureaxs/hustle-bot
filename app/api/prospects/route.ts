import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { listProspects, createProspect } from "@/lib/prospects";
import { filterToPrismaWhere, parseFilterFromJSON } from "@/lib/filters";
import type { Prisma } from "@/app/generated/prisma/client";

const CONTEXT = "API:prospects";

// GET /api/prospects - List prospects with optional filtering
export async function GET(request: NextRequest) {
  logger.functionEntry("GET /api/prospects", {});

  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination - support both page/limit and offset/limit
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = searchParams.has("offset") 
      ? parseInt(searchParams.get("offset") || "0")
      : (page - 1) * limit;
    
    // Basic filters
    const status = searchParams.get("status") || undefined;
    const source = searchParams.get("source") || undefined;
    const search = searchParams.get("search") || undefined;
    
    // Advanced filter (JSON)
    const filterJson = searchParams.get("filter");

    logger.debug(CONTEXT, "GET request parameters", {
      page,
      limit,
      offset,
      status,
      source,
      hasSearch: !!search,
      hasAdvancedFilter: !!filterJson,
    });
    
    // Build additional filter from advanced filter JSON
    let additionalFilter: Prisma.ProspectWhereInput | undefined;
    if (filterJson) {
      logger.branchTaken(CONTEXT, "parsing advanced filter JSON");
      const filter = parseFilterFromJSON(filterJson);
      if (filter) {
        additionalFilter = filterToPrismaWhere(filter) as Prisma.ProspectWhereInput;
        logger.debug(CONTEXT, "Advanced filter parsed", { filterKeys: Object.keys(additionalFilter) });
      } else {
        logger.warn(CONTEXT, "Failed to parse advanced filter JSON");
      }
    }
    
    // List prospects using service
    const result = await listProspects({
      status,
      source,
      search,
      limit,
      offset,
      filter: additionalFilter,
    });
    
    logger.info(CONTEXT, "Prospects retrieved successfully", {
      count: result.prospects.length,
      total: result.total,
    });

    logger.functionExit("GET /api/prospects", {
      success: true,
      data: { count: result.prospects.length, total: result.total },
    });
    
    return NextResponse.json({
      data: result.prospects,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    logger.error(CONTEXT, "Error fetching prospects", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    logger.functionExit("GET /api/prospects", { success: false });
    return NextResponse.json(
      { error: "Failed to fetch prospects" },
      { status: 500 }
    );
  }
}

// POST /api/prospects - Create a new prospect
export async function POST(request: NextRequest) {
  logger.functionEntry("POST /api/prospects", {});

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
      logger.debug(CONTEXT, "Request body parsed", {
        hasSource: !!body.source,
        hasExternalId: !!body.externalId,
        hasName: !!body.name,
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
      source,
      externalId,
      name,
      role,
      company,
      location,
      email,
      phone,
      tags = [],
      metadata = {},
      status = "new",
      score,
    } = body;
    
    // Validate required fields
    if (!source || !externalId || !name) {
      logger.warn(CONTEXT, "Missing required fields", {
        hasSource: !!source,
        hasExternalId: !!externalId,
        hasName: !!name,
      });
      return NextResponse.json(
        { error: "Missing required fields: source, externalId, name" },
        { status: 400 }
      );
    }

    logger.info(CONTEXT, "Creating prospect", { source, externalId });
    
    const prospect = await createProspect({
      source: source as string,
      externalId: externalId as string,
      name: name as string,
      role: role as string | undefined,
      company: company as string | undefined,
      location: location as string | undefined,
      email: email as string | undefined,
      phone: phone as string | undefined,
      tags: tags as string[],
      metadata: metadata as Record<string, unknown>,
      status: status as string,
      score: score as number | undefined,
    });

    logger.info(CONTEXT, "Prospect created successfully", { id: prospect.id });
    logger.functionExit("POST /api/prospects", { success: true, data: { id: prospect.id } });
    
    return NextResponse.json({ data: prospect }, { status: 201 });
  } catch (error) {
    const errorCode = (error as { code?: string }).code;
    
    logger.error(CONTEXT, "Error creating prospect", {
      error: error instanceof Error ? error : new Error(String(error)),
      errorCode,
    });

    // Check for unique constraint violation
    if (errorCode === "P2002") {
      logger.functionExit("POST /api/prospects", { success: false });
      return NextResponse.json(
        { error: "Prospect with this source and externalId already exists" },
        { status: 409 }
      );
    }

    logger.functionExit("POST /api/prospects", { success: false });
    return NextResponse.json(
      { error: "Failed to create prospect" },
      { status: 500 }
    );
  }
}
