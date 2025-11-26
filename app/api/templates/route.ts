import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/templates - List all message templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");
    
    const where = channel ? { channel } : {};
    
    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    
    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create a new message template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      name,
      channel,
      subject,
      body: templateBody,
    } = body;
    
    // Validate required fields
    if (!name || !channel || !templateBody) {
      return NextResponse.json(
        { error: "Missing required fields: name, channel, body" },
        { status: 400 }
      );
    }
    
    const template = await prisma.messageTemplate.create({
      data: {
        name,
        channel,
        subject,
        body: templateBody,
      },
    });
    
    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
