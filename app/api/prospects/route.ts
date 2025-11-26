import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { filterToPrismaWhere, parseFilterFromJSON } from "@/lib/filters";

// GET /api/prospects - List prospects with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const skip = (page - 1) * limit;
    
    // Basic filters
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const search = searchParams.get("search");
    
    // Advanced filter (JSON)
    const filterJson = searchParams.get("filter");
    
    // Build where clause
    let where: Record<string, unknown> = {};
    
    if (status) {
      where.status = status;
    }
    
    if (source) {
      where.source = source;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { company: { contains: search } },
        { role: { contains: search } },
        { email: { contains: search } },
      ];
    }
    
    // Apply advanced filter
    if (filterJson) {
      const filter = parseFilterFromJSON(filterJson);
      if (filter) {
        const filterWhere = filterToPrismaWhere(filter);
        where = { ...where, ...filterWhere };
      }
    }
    
    // Fetch prospects
    const [prospects, total] = await Promise.all([
      prisma.prospect.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.prospect.count({ where }),
    ]);
    
    // Parse JSON fields for response
    const parsedProspects = prospects.map(p => ({
      ...p,
      tags: JSON.parse(p.tags),
      metadata: JSON.parse(p.metadata),
    }));
    
    return NextResponse.json({
      data: parsedProspects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching prospects:", error);
    return NextResponse.json(
      { error: "Failed to fetch prospects" },
      { status: 500 }
    );
  }
}

// POST /api/prospects - Create a new prospect
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
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
      return NextResponse.json(
        { error: "Missing required fields: source, externalId, name" },
        { status: 400 }
      );
    }
    
    const prospect = await prisma.prospect.create({
      data: {
        source,
        externalId,
        name,
        role,
        company,
        location,
        email,
        phone,
        tags: JSON.stringify(tags),
        metadata: JSON.stringify(metadata),
        status,
        score,
      },
    });
    
    return NextResponse.json({
      data: {
        ...prospect,
        tags: JSON.parse(prospect.tags),
        metadata: JSON.parse(prospect.metadata),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating prospect:", error);
    // Check for unique constraint violation
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Prospect with this source and externalId already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create prospect" },
      { status: 500 }
    );
  }
}
