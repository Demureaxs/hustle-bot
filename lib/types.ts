// Shared types for the Hustle Bot UI

export interface Prospect {
  id: string;
  source: string;
  externalId: string;
  name: string;
  role: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  status: ProspectStatus;
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

export type ProspectStatus = 
  | "new" 
  | "reviewed" 
  | "approved" 
  | "messaged" 
  | "responded" 
  | "disqualified";

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  filters: Filter | null;
  filterSummary: string;
  templateId: string | null;
  messageTemplate: MessageTemplate | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachLog {
  id: string;
  prospectId: string;
  campaignId: string | null;
  channel: string;
  templateId: string | null;
  body: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  repliedAt: string | null;
  status: OutreachStatus;
  error: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  prospect?: Pick<Prospect, "id" | "name" | "company" | "email">;
  campaign?: Pick<Campaign, "id" | "name">;
}

export type OutreachStatus = 
  | "pending" 
  | "sent" 
  | "delivered" 
  | "failed" 
  | "replied";

// Filter types (re-exported from lib/filters for convenience)
export type ComparisonOperator = 
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "notIn"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "between";

export type LogicalOperator = "AND" | "OR";

export interface FilterCondition {
  field: string;
  operator: ComparisonOperator;
  value: FilterValue;
}

export type FilterValue = 
  | string 
  | number 
  | boolean 
  | null 
  | string[] 
  | number[] 
  | { min: number | string; max: number | string };

export interface FilterGroup {
  logic: LogicalOperator;
  conditions: Array<FilterCondition | FilterGroup>;
}

export type Filter = FilterCondition | FilterGroup | null;

// API Response types
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationInfo;
  error?: string;
}
