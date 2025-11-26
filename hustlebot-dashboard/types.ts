export enum LeadSource {
  REDDIT = 'Reddit',
  UPWORK = 'Upwork',
  MAPS = 'Google Maps',
}

export interface Lead {
  id: string;
  title: string;
  source: LeadSource;
  description: string;
  url?: string;
  postedAt: string;
  score: number; // 0-100 relevance score
  isNew: boolean;
  suggestedReply?: string; // New field for the generated pitch
  metadata?: {
    location?: string;
    website?: string;
    phone?: string;
  };
}

export interface AppConfig {
  targetNumber: string;
  keywords: string[];
  mapsQuery: string;
  mapsLocation: string;
  autoRefresh: boolean;
  // New Profile Fields
  userName: string;
  userPortfolio: string;
  userSkills: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}