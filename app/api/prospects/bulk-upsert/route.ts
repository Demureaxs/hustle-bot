import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

interface ProspectPayload {
  source: string;
  externalId: string;
  name: string;
  role?: string;
  company?: string;
  location?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  status?: string;
  score?: number;
}

// POST /api/prospects/bulk-upsert - Bulk upsert prospects from scrapers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!Array.isArray(body.prospects)) {
      return NextResponse.json(
        { error: "Expected 'prospects' array in request body" },
        { status: 400 }
      );
    }
    
    const prospects: ProspectPayload[] = body.prospects;
    
    // Validate all prospects have required fields
    const invalidProspects = prospects.filter(
      p => !p.source || !p.externalId || !p.name
    );
    
    if (invalidProspects.length > 0) {
      return NextResponse.json(
        { 
          error: "Some prospects are missing required fields (source, externalId, name)",
          invalidCount: invalidProspects.length,
        },
        { status: 400 }
      );
    }
    
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };
    
    // Process prospects in a transaction
    await prisma.$transaction(async (tx) => {
      for (const prospect of prospects) {
        try {
          // Try to find existing prospect by source + externalId
          const existing = await tx.prospect.findUnique({
            where: {
              source_externalId: {
                source: prospect.source,
                externalId: prospect.externalId,
              },
            },
          });
          
          const data = {
            name: prospect.name,
            role: prospect.role,
            company: prospect.company,
            location: prospect.location,
            email: prospect.email,
            phone: prospect.phone,
            tags: JSON.stringify(prospect.tags || []),
            metadata: JSON.stringify(prospect.metadata || {}),
            status: prospect.status || "new",
            score: prospect.score,
          };
          
          if (existing) {
            // Update existing prospect (merge data)
            await tx.prospect.update({
              where: { id: existing.id },
              data: {
                ...data,
                // Preserve existing status unless explicitly provided
                status: prospect.status || existing.status,
                // Merge metadata
                metadata: JSON.stringify({
                  ...JSON.parse(existing.metadata),
                  ...(prospect.metadata || {}),
                }),
              },
            });
            results.updated++;
          } else {
            // Create new prospect
            await tx.prospect.create({
              data: {
                source: prospect.source,
                externalId: prospect.externalId,
                ...data,
              },
            });
            results.created++;
          }
        } catch (error) {
          results.errors.push(`Failed to upsert ${prospect.source}:${prospect.externalId}: ${error}`);
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      results: {
        total: prospects.length,
        created: results.created,
        updated: results.updated,
        errorCount: results.errors.length,
        errors: results.errors.length > 0 ? results.errors.slice(0, 10) : undefined, // Limit error messages
      },
    });
  } catch (error) {
    console.error("Error bulk upserting prospects:", error);
    return NextResponse.json(
      { error: "Failed to bulk upsert prospects" },
      { status: 500 }
    );
  }
}
