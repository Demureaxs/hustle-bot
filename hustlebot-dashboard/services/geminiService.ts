import { GoogleGenAI } from "@google/genai";
import { Lead, LeadSource, AppConfig } from "../types";

const SYSTEM_INSTRUCTION = `
You are HustleBot, an elite lead generation AI. 
Your goal is to find freelance opportunities and business leads.
Analyze search results and map data to identify high-quality prospects.
Be concise, cynical, and profit-oriented.
When generating replies, be professional but punchy. No fluff.
`;

const cleanJson = (text: string): string => {
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }
  return cleaned;
};

export const findSocialLeads = async (
  keywords: string[],
  userProfile: Pick<AppConfig, 'userName' | 'userPortfolio' | 'userSkills'>
): Promise<Lead[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing in environment variables");

  const ai = new GoogleGenAI({ apiKey });
  
  // Refined query for "Hidden Gems"
  const query = `
  Find recent "hiring" posts on Reddit (specifically r/forhire, r/jobbit, r/freelance_forhire) and Upwork matching these keywords: ${keywords.join(", ")}. 
  Focus on posts looking for developers or designers posted in the last 24 hours.

  Also, for EACH lead found, generate a "suggestedReply".
  The reply should be a short direct message (DM) to the poster.
  Context for reply: My name is ${userProfile.userName}. My portfolio is ${userProfile.userPortfolio}. My skills are ${userProfile.userSkills}.
  
  Format the output strictly as a JSON array of objects. Do not include any explanation or markdown formatting outside the JSON.
  Each object must have:
  - title (string)
  - description (string)
  - url (string)
  - source (string: "Reddit" or "Upwork")
  - relevanceScore (number: 0-100)
  - suggestedReply (string: The generated DM draft)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: query,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    if (!text) return [];

    let rawLeads: any[] = [];
    try {
        rawLeads = JSON.parse(cleanJson(text));
    } catch (e) {
        console.warn("JSON Parse Error (Social):", text);
        return [];
    }
    
    return rawLeads.map((l: any, idx: number) => ({
      id: `soc-${Date.now()}-${idx}`,
      title: l.title || "Unknown Opportunity",
      source: (l.source && l.source.toLowerCase().includes("reddit")) ? LeadSource.REDDIT : LeadSource.UPWORK,
      description: l.description || "No description provided.",
      url: l.url,
      postedAt: new Date().toLocaleTimeString(),
      score: l.relevanceScore || 50,
      isNew: true,
      suggestedReply: l.suggestedReply || "No reply generated."
    }));
  } catch (error) {
    console.error("Social Scrape Error:", error);
    throw error;
  }
};

export const findMapsLeads = async (
  query: string,
  location: string,
  userProfile: Pick<AppConfig, 'userName' | 'userPortfolio' | 'userSkills'>
): Promise<Lead[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing in environment variables");

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
  Find "${query}" in ${location}. Return a list of businesses. 
  Identify if they appear to have a website or not based on the search results.
  
  Also, for EACH business without a website (or with a bad one), generate a "suggestedReply".
  Since this is a Maps lead, the reply should be a "Cold Call Script" or "Drop-in Script".
  Context: My name is ${userProfile.userName}, offering web services (${userProfile.userSkills}). Mention helping them get online to get more customers.
  
  Format the output strictly as a JSON array of objects. Do not include any explanation.
  Each object must have:
  - businessName (string)
  - address (string)
  - website (string or null)
  - phone (string or null)
  - leadScore (number: 0-100, higher if no website)
  - suggestedReply (string: The cold call script)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleMaps: {} }],
      },
    });

    const text = response.text;
    if (!text) return [];

    let rawLeads: any[] = [];
    try {
        rawLeads = JSON.parse(cleanJson(text));
    } catch (e) {
        console.warn("JSON Parse Error (Maps):", text);
        return [];
    }

    return rawLeads.map((l: any, idx: number) => ({
        id: `map-${Date.now()}-${idx}`,
        title: l.businessName,
        source: LeadSource.MAPS,
        description: `Address: ${l.address}. Phone: ${l.phone || 'N/A'}. Website: ${l.website || 'MISSING (Hot Lead!)'}`,
        url: l.website, 
        postedAt: new Date().toLocaleTimeString(),
        score: l.leadScore || (l.website ? 10 : 95), 
        isNew: true,
        suggestedReply: l.suggestedReply || "No script generated.",
        metadata: {
            location: l.address,
            website: l.website,
            phone: l.phone
        }
    }));

  } catch (error) {
    console.error("Maps Scrape Error:", error);
    throw error;
  }
};