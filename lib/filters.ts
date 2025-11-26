/**
 * Filtering Engine for Hustle Bot
 * 
 * This module provides a flexible, type-safe filtering system that can:
 * 1. Be expressed in JSON and stored in the database
 * 2. Translate filter descriptions into database queries (Prisma)
 * 3. Filter in-memory collections
 */

// Supported comparison operators
export type ComparisonOperator = 
  | "eq"        // equals (=)
  | "neq"       // not equals (!=)
  | "gt"        // greater than (>)
  | "gte"       // greater than or equal (>=)
  | "lt"        // less than (<)
  | "lte"       // less than or equal (<=)
  | "in"        // value is in array
  | "notIn"     // value is not in array
  | "contains"  // string contains substring
  | "startsWith" // string starts with
  | "endsWith"  // string ends with
  | "between";  // value is between two values (inclusive)

// Supported logical operators
export type LogicalOperator = "AND" | "OR";

// A single filter condition
export interface FilterCondition {
  field: string;           // The field to filter on (e.g., "status", "role", "location")
  operator: ComparisonOperator;
  value: FilterValue;      // The value to compare against
}

// Value types for filter conditions
export type FilterValue = 
  | string 
  | number 
  | boolean 
  | null 
  | string[] 
  | number[] 
  | { min: number | string; max: number | string }; // For 'between' operator

// A group of conditions combined with a logical operator
export interface FilterGroup {
  logic: LogicalOperator;
  conditions: Array<FilterCondition | FilterGroup>;
}

// Root filter can be a single condition, a group, or null (no filter)
export type Filter = FilterCondition | FilterGroup | null;

/**
 * Type guard to check if a filter is a FilterGroup
 */
export function isFilterGroup(filter: Filter): filter is FilterGroup {
  return filter !== null && "logic" in filter && "conditions" in filter;
}

/**
 * Type guard to check if a filter is a FilterCondition
 */
export function isFilterCondition(filter: Filter): filter is FilterCondition {
  return filter !== null && "field" in filter && "operator" in filter && "value" in filter;
}

/**
 * Validate a filter structure
 */
export function validateFilter(filter: unknown): filter is Filter {
  if (filter === null) return true;
  
  if (typeof filter !== "object") return false;
  
  // Check if it's a condition
  if ("field" in filter && "operator" in filter && "value" in filter) {
    const cond = filter as FilterCondition;
    return typeof cond.field === "string" && 
           typeof cond.operator === "string" &&
           isValidOperator(cond.operator);
  }
  
  // Check if it's a group
  if ("logic" in filter && "conditions" in filter) {
    const group = filter as FilterGroup;
    return (group.logic === "AND" || group.logic === "OR") &&
           Array.isArray(group.conditions) &&
           group.conditions.every(c => validateFilter(c));
  }
  
  return false;
}

function isValidOperator(op: string): op is ComparisonOperator {
  return ["eq", "neq", "gt", "gte", "lt", "lte", "in", "notIn", "contains", "startsWith", "endsWith", "between"].includes(op);
}

/**
 * Convert a filter to Prisma where clause
 * Note: This handles basic fields. For JSON fields stored as strings, 
 * you may need to filter in-memory after fetching
 */
export function filterToPrismaWhere(filter: Filter): Record<string, unknown> {
  if (filter === null) return {};
  
  if (isFilterCondition(filter)) {
    return conditionToPrismaWhere(filter);
  }
  
  if (isFilterGroup(filter)) {
    const subConditions = filter.conditions.map(c => filterToPrismaWhere(c));
    return filter.logic === "AND" 
      ? { AND: subConditions }
      : { OR: subConditions };
  }
  
  return {};
}

function conditionToPrismaWhere(condition: FilterCondition): Record<string, unknown> {
  const { field, operator, value } = condition;
  
  switch (operator) {
    case "eq":
      return { [field]: { equals: value } };
    case "neq":
      return { [field]: { not: value } };
    case "gt":
      return { [field]: { gt: value } };
    case "gte":
      return { [field]: { gte: value } };
    case "lt":
      return { [field]: { lt: value } };
    case "lte":
      return { [field]: { lte: value } };
    case "in":
      return { [field]: { in: value } };
    case "notIn":
      return { [field]: { notIn: value } };
    case "contains":
      return { [field]: { contains: value } };
    case "startsWith":
      return { [field]: { startsWith: value } };
    case "endsWith":
      return { [field]: { endsWith: value } };
    case "between":
      if (typeof value === "object" && value !== null && !Array.isArray(value) && "min" in value && "max" in value) {
        return { 
          AND: [
            { [field]: { gte: value.min } },
            { [field]: { lte: value.max } }
          ]
        };
      }
      return {};
    default:
      return {};
  }
}

/**
 * Apply a filter to an in-memory collection
 * Useful for filtering after fetching or for JSON fields
 */
export function filterCollection<T extends Record<string, unknown>>(
  items: T[],
  filter: Filter
): T[] {
  if (filter === null) return items;
  
  return items.filter(item => evaluateFilter(item, filter));
}

function evaluateFilter<T extends Record<string, unknown>>(item: T, filter: Filter): boolean {
  if (filter === null) return true;
  
  if (isFilterCondition(filter)) {
    return evaluateCondition(item, filter);
  }
  
  if (isFilterGroup(filter)) {
    if (filter.logic === "AND") {
      return filter.conditions.every(c => evaluateFilter(item, c));
    } else {
      return filter.conditions.some(c => evaluateFilter(item, c));
    }
  }
  
  return true;
}

function evaluateCondition<T extends Record<string, unknown>>(item: T, condition: FilterCondition): boolean {
  const { field, operator, value } = condition;
  
  // Handle nested fields (e.g., "metadata.companySize")
  const itemValue = getNestedValue(item, field);
  
  switch (operator) {
    case "eq":
      return itemValue === value;
    case "neq":
      return itemValue !== value;
    case "gt":
      return typeof itemValue === "number" && typeof value === "number" && itemValue > value;
    case "gte":
      return typeof itemValue === "number" && typeof value === "number" && itemValue >= value;
    case "lt":
      return typeof itemValue === "number" && typeof value === "number" && itemValue < value;
    case "lte":
      return typeof itemValue === "number" && typeof value === "number" && itemValue <= value;
    case "in":
      return Array.isArray(value) && (value as (string | number)[]).includes(itemValue as string | number);
    case "notIn":
      return Array.isArray(value) && !(value as (string | number)[]).includes(itemValue as string | number);
    case "contains":
      return typeof itemValue === "string" && typeof value === "string" && 
             itemValue.toLowerCase().includes(value.toLowerCase());
    case "startsWith":
      return typeof itemValue === "string" && typeof value === "string" && 
             itemValue.toLowerCase().startsWith(value.toLowerCase());
    case "endsWith":
      return typeof itemValue === "string" && typeof value === "string" && 
             itemValue.toLowerCase().endsWith(value.toLowerCase());
    case "between":
      if (typeof value === "object" && value !== null && !Array.isArray(value) && "min" in value && "max" in value) {
        const numValue = typeof itemValue === "number" ? itemValue : parseFloat(String(itemValue));
        const min = typeof value.min === "number" ? value.min : parseFloat(String(value.min));
        const max = typeof value.max === "number" ? value.max : parseFloat(String(value.max));
        return !isNaN(numValue) && !isNaN(min) && !isNaN(max) && numValue >= min && numValue <= max;
      }
      return false;
    default:
      return true;
  }
}

function getNestedValue<T extends Record<string, unknown>>(obj: T, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Convert a filter to a human-readable summary
 */
export function filterToReadableString(filter: Filter, indent: number = 0): string {
  if (filter === null) return "No filter (all records)";
  
  const pad = "  ".repeat(indent);
  
  if (isFilterCondition(filter)) {
    return `${pad}${filter.field} ${operatorToSymbol(filter.operator)} ${formatValue(filter.value)}`;
  }
  
  if (isFilterGroup(filter)) {
    const separator = filter.logic === "AND" ? " AND " : " OR ";
    if (filter.conditions.length === 0) return `${pad}(empty)`;
    
    if (filter.conditions.every(c => isFilterCondition(c))) {
      // Simple case: all conditions at same level
      return filter.conditions
        .map(c => filterToReadableString(c, 0))
        .join(separator);
    }
    
    // Complex case: nested groups
    return `${pad}(\n${filter.conditions.map(c => filterToReadableString(c, indent + 1)).join(`\n${pad}${filter.logic}\n`)}\n${pad})`;
  }
  
  return "Invalid filter";
}

function operatorToSymbol(operator: ComparisonOperator): string {
  const symbols: Record<ComparisonOperator, string> = {
    eq: "=",
    neq: "≠",
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
    in: "in",
    notIn: "not in",
    contains: "contains",
    startsWith: "starts with",
    endsWith: "ends with",
    between: "between",
  };
  return symbols[operator] || operator;
}

function formatValue(value: FilterValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  if (typeof value === "object" && "min" in value && "max" in value) {
    return `${value.min} and ${value.max}`;
  }
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

/**
 * Parse a filter from JSON string (safely)
 */
export function parseFilterFromJSON(jsonString: string): Filter | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (validateFilter(parsed)) {
      return parsed;
    }
    console.error("Invalid filter structure");
    return null;
  } catch {
    console.error("Failed to parse filter JSON");
    return null;
  }
}

/**
 * Create common filter presets
 */
export const FilterPresets = {
  // Get all new prospects
  newProspects: (): Filter => ({
    field: "status",
    operator: "eq",
    value: "new",
  }),
  
  // Get approved prospects ready for outreach
  approvedForOutreach: (): Filter => ({
    logic: "AND",
    conditions: [
      { field: "status", operator: "eq", value: "approved" },
    ],
  }),
  
  // Example: Founders in US/Canada with company size 2-50
  foundersSmallCompanies: (): Filter => ({
    logic: "AND",
    conditions: [
      { field: "status", operator: "eq", value: "approved" },
      { field: "role", operator: "contains", value: "Founder" },
      { field: "location", operator: "in", value: ["US", "Canada", "USA", "United States"] },
    ],
  }),
  
  // High-score prospects
  highScoreProspects: (minScore: number = 70): Filter => ({
    logic: "AND",
    conditions: [
      { field: "score", operator: "gte", value: minScore },
      { field: "status", operator: "in", value: ["new", "reviewed", "approved"] },
    ],
  }),
};

/**
 * Example campaign filter as documented in requirements
 * "status = approved AND role contains Founder AND location in [US, Canada] 
 *  AND companySize between 2 and 50 AND lastSeenAt > X"
 */
export const exampleCampaignFilter: Filter = {
  logic: "AND",
  conditions: [
    { field: "status", operator: "eq", value: "approved" },
    { field: "role", operator: "contains", value: "Founder" },
    { field: "location", operator: "in", value: ["US", "Canada"] },
    // Note: For metadata fields, these would be filtered in-memory after JSON parsing
    // This is a simplified representation
  ],
};
