/**
 * Filtering Engine for Hustle Bot
 * 
 * This module provides a flexible, type-safe filtering system that can:
 * 1. Be expressed in JSON and stored in the database
 * 2. Translate filter descriptions into database queries (Prisma)
 * 3. Filter in-memory collections
 */

import { logger } from "@/lib/logger";

const CONTEXT = "FiltersEngine";

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
  logger.debug(CONTEXT, "isFilterGroup: checking filter type");
  const result = filter !== null && "logic" in filter && "conditions" in filter;
  logger.debug(CONTEXT, "isFilterGroup: result", { isGroup: result });
  return result;
}

/**
 * Type guard to check if a filter is a FilterCondition
 */
export function isFilterCondition(filter: Filter): filter is FilterCondition {
  logger.debug(CONTEXT, "isFilterCondition: checking filter type");
  const result = filter !== null && "field" in filter && "operator" in filter && "value" in filter;
  logger.debug(CONTEXT, "isFilterCondition: result", { isCondition: result });
  return result;
}

/**
 * Validate a filter structure
 */
export function validateFilter(filter: unknown): filter is Filter {
  logger.functionEntry("validateFilter", { filterType: typeof filter });

  if (filter === null) {
    logger.branchTaken(CONTEXT, "filter is null - valid");
    logger.functionExit("validateFilter", { success: true, data: { valid: true } });
    return true;
  }
  
  if (typeof filter !== "object") {
    logger.branchTaken(CONTEXT, "filter is not an object - invalid", { type: typeof filter });
    logger.functionExit("validateFilter", { success: true, data: { valid: false } });
    return false;
  }
  
  // Check if it's a condition
  if ("field" in filter && "operator" in filter && "value" in filter) {
    logger.branchTaken(CONTEXT, "filter appears to be a condition");
    const cond = filter as FilterCondition;
    const isValid = typeof cond.field === "string" && 
           typeof cond.operator === "string" &&
           isValidOperator(cond.operator);
    logger.debug(CONTEXT, "validateFilter: condition validation result", {
      field: cond.field,
      operator: cond.operator,
      isValid,
    });
    logger.functionExit("validateFilter", { success: true, data: { valid: isValid } });
    return isValid;
  }
  
  // Check if it's a group
  if ("logic" in filter && "conditions" in filter) {
    logger.branchTaken(CONTEXT, "filter appears to be a group");
    const group = filter as FilterGroup;
    const logicValid = group.logic === "AND" || group.logic === "OR";
    const isArray = Array.isArray(group.conditions);
    
    logger.debug(CONTEXT, "validateFilter: group structure check", {
      logic: group.logic,
      logicValid,
      isArray,
      conditionCount: isArray ? group.conditions.length : 0,
    });

    if (!logicValid || !isArray) {
      logger.functionExit("validateFilter", { success: true, data: { valid: false } });
      return false;
    }

    // Validate each condition in the group
    for (let i = 0; i < group.conditions.length; i++) {
      logger.loopIteration(CONTEXT, "validating group condition", {
        current: i + 1,
        total: group.conditions.length,
      });
      if (!validateFilter(group.conditions[i])) {
        logger.debug(CONTEXT, "validateFilter: condition at index failed validation", { index: i });
        logger.functionExit("validateFilter", { success: true, data: { valid: false } });
        return false;
      }
    }

    logger.loopComplete(CONTEXT, "group condition validation", {
      totalIterations: group.conditions.length,
      successCount: group.conditions.length,
    });
    logger.functionExit("validateFilter", { success: true, data: { valid: true } });
    return true;
  }
  
  logger.branchTaken(CONTEXT, "filter structure not recognized - invalid");
  logger.functionExit("validateFilter", { success: true, data: { valid: false } });
  return false;
}

function isValidOperator(op: string): op is ComparisonOperator {
  const validOps = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "notIn", "contains", "startsWith", "endsWith", "between"];
  const isValid = validOps.includes(op);
  logger.debug(CONTEXT, "isValidOperator: checking operator", { operator: op, isValid });
  return isValid;
}

/**
 * Convert a filter to Prisma where clause
 * Note: This handles basic fields. For JSON fields stored as strings, 
 * you may need to filter in-memory after fetching
 */
export function filterToPrismaWhere(filter: Filter): Record<string, unknown> {
  logger.functionEntry("filterToPrismaWhere", { hasFilter: filter !== null });

  if (filter === null) {
    logger.branchTaken(CONTEXT, "filter is null, returning empty where clause");
    logger.functionExit("filterToPrismaWhere", { success: true, data: { keys: [] } });
    return {};
  }
  
  if (isFilterCondition(filter)) {
    logger.branchTaken(CONTEXT, "filter is a condition");
    const result = conditionToPrismaWhere(filter);
    logger.functionExit("filterToPrismaWhere", { success: true, data: { keys: Object.keys(result) } });
    return result;
  }
  
  if (isFilterGroup(filter)) {
    logger.branchTaken(CONTEXT, "filter is a group", { logic: filter.logic, conditionCount: filter.conditions.length });
    
    const subConditions: Record<string, unknown>[] = [];
    for (let i = 0; i < filter.conditions.length; i++) {
      logger.loopIteration(CONTEXT, "converting condition to prisma where", {
        current: i + 1,
        total: filter.conditions.length,
      });
      subConditions.push(filterToPrismaWhere(filter.conditions[i]));
    }
    logger.loopComplete(CONTEXT, "condition conversion", { totalIterations: filter.conditions.length });

    const result = filter.logic === "AND" 
      ? { AND: subConditions }
      : { OR: subConditions };
    
    logger.functionExit("filterToPrismaWhere", { success: true, data: { logic: filter.logic, subConditionCount: subConditions.length } });
    return result;
  }
  
  logger.branchTaken(CONTEXT, "filter type not recognized, returning empty where clause");
  logger.functionExit("filterToPrismaWhere", { success: true, data: { keys: [] } });
  return {};
}

function conditionToPrismaWhere(condition: FilterCondition): Record<string, unknown> {
  const { field, operator, value } = condition;
  logger.debug(CONTEXT, "conditionToPrismaWhere: converting condition", { field, operator, valueType: typeof value });
  
  let result: Record<string, unknown>;
  
  switch (operator) {
    case "eq":
      logger.branchTaken(CONTEXT, "operator: eq");
      result = { [field]: { equals: value } };
      break;
    case "neq":
      logger.branchTaken(CONTEXT, "operator: neq");
      result = { [field]: { not: value } };
      break;
    case "gt":
      logger.branchTaken(CONTEXT, "operator: gt");
      result = { [field]: { gt: value } };
      break;
    case "gte":
      logger.branchTaken(CONTEXT, "operator: gte");
      result = { [field]: { gte: value } };
      break;
    case "lt":
      logger.branchTaken(CONTEXT, "operator: lt");
      result = { [field]: { lt: value } };
      break;
    case "lte":
      logger.branchTaken(CONTEXT, "operator: lte");
      result = { [field]: { lte: value } };
      break;
    case "in":
      logger.branchTaken(CONTEXT, "operator: in", { valueIsArray: Array.isArray(value) });
      result = { [field]: { in: value } };
      break;
    case "notIn":
      logger.branchTaken(CONTEXT, "operator: notIn", { valueIsArray: Array.isArray(value) });
      result = { [field]: { notIn: value } };
      break;
    case "contains":
      logger.branchTaken(CONTEXT, "operator: contains");
      result = { [field]: { contains: value } };
      break;
    case "startsWith":
      logger.branchTaken(CONTEXT, "operator: startsWith");
      result = { [field]: { startsWith: value } };
      break;
    case "endsWith":
      logger.branchTaken(CONTEXT, "operator: endsWith");
      result = { [field]: { endsWith: value } };
      break;
    case "between":
      logger.branchTaken(CONTEXT, "operator: between");
      if (typeof value === "object" && value !== null && !Array.isArray(value) && "min" in value && "max" in value) {
        logger.debug(CONTEXT, "conditionToPrismaWhere: between with valid min/max", { min: value.min, max: value.max });
        result = { 
          AND: [
            { [field]: { gte: value.min } },
            { [field]: { lte: value.max } }
          ]
        };
      } else {
        logger.warn(CONTEXT, "conditionToPrismaWhere: between operator with invalid value structure");
        result = {};
      }
      break;
    default:
      logger.warn(CONTEXT, "conditionToPrismaWhere: unknown operator", { operator });
      result = {};
  }

  logger.debug(CONTEXT, "conditionToPrismaWhere: result", { field, resultKeys: Object.keys(result) });
  return result;
}

/**
 * Apply a filter to an in-memory collection
 * Useful for filtering after fetching or for JSON fields
 */
export function filterCollection<T extends Record<string, unknown>>(
  items: T[],
  filter: Filter
): T[] {
  logger.functionEntry("filterCollection", { itemCount: items.length, hasFilter: filter !== null });

  if (filter === null) {
    logger.branchTaken(CONTEXT, "filter is null, returning all items");
    logger.functionExit("filterCollection", { success: true, data: { resultCount: items.length } });
    return items;
  }
  
  logger.debug(CONTEXT, "filterCollection: applying filter to items");
  const result = items.filter(item => evaluateFilter(item, filter));
  
  logger.debug(CONTEXT, "filterCollection: filtering complete", {
    inputCount: items.length,
    outputCount: result.length,
    filteredOut: items.length - result.length,
  });
  
  logger.functionExit("filterCollection", { success: true, data: { resultCount: result.length } });
  return result;
}

function evaluateFilter<T extends Record<string, unknown>>(item: T, filter: Filter): boolean {
  logger.debug(CONTEXT, "evaluateFilter: evaluating item against filter");

  if (filter === null) {
    logger.branchTaken(CONTEXT, "filter is null - item passes");
    return true;
  }
  
  if (isFilterCondition(filter)) {
    logger.branchTaken(CONTEXT, "evaluating single condition", { field: filter.field });
    return evaluateCondition(item, filter);
  }
  
  if (isFilterGroup(filter)) {
    logger.branchTaken(CONTEXT, "evaluating filter group", { logic: filter.logic, conditionCount: filter.conditions.length });
    
    if (filter.logic === "AND") {
      logger.debug(CONTEXT, "evaluateFilter: AND logic - all conditions must pass");
      for (let i = 0; i < filter.conditions.length; i++) {
        if (!evaluateFilter(item, filter.conditions[i])) {
          logger.debug(CONTEXT, "evaluateFilter: AND condition failed", { conditionIndex: i });
          return false;
        }
      }
      return true;
    } else {
      logger.debug(CONTEXT, "evaluateFilter: OR logic - any condition can pass");
      for (let i = 0; i < filter.conditions.length; i++) {
        if (evaluateFilter(item, filter.conditions[i])) {
          logger.debug(CONTEXT, "evaluateFilter: OR condition passed", { conditionIndex: i });
          return true;
        }
      }
      return false;
    }
  }
  
  logger.branchTaken(CONTEXT, "filter type not recognized - item passes by default");
  return true;
}

function evaluateCondition<T extends Record<string, unknown>>(item: T, condition: FilterCondition): boolean {
  const { field, operator, value } = condition;
  
  // Handle nested fields (e.g., "metadata.companySize")
  const itemValue = getNestedValue(item, field);
  logger.debug(CONTEXT, "evaluateCondition: evaluating", { field, operator, itemValueType: typeof itemValue, valueType: typeof value });
  
  let result: boolean;
  
  switch (operator) {
    case "eq":
      result = itemValue === value;
      logger.debug(CONTEXT, "evaluateCondition: eq", { match: result });
      break;
    case "neq":
      result = itemValue !== value;
      logger.debug(CONTEXT, "evaluateCondition: neq", { match: result });
      break;
    case "gt":
      result = typeof itemValue === "number" && typeof value === "number" && itemValue > value;
      logger.debug(CONTEXT, "evaluateCondition: gt", { match: result });
      break;
    case "gte":
      result = typeof itemValue === "number" && typeof value === "number" && itemValue >= value;
      logger.debug(CONTEXT, "evaluateCondition: gte", { match: result });
      break;
    case "lt":
      result = typeof itemValue === "number" && typeof value === "number" && itemValue < value;
      logger.debug(CONTEXT, "evaluateCondition: lt", { match: result });
      break;
    case "lte":
      result = typeof itemValue === "number" && typeof value === "number" && itemValue <= value;
      logger.debug(CONTEXT, "evaluateCondition: lte", { match: result });
      break;
    case "in":
      result = Array.isArray(value) && (value as (string | number)[]).includes(itemValue as string | number);
      logger.debug(CONTEXT, "evaluateCondition: in", { match: result });
      break;
    case "notIn":
      result = Array.isArray(value) && !(value as (string | number)[]).includes(itemValue as string | number);
      logger.debug(CONTEXT, "evaluateCondition: notIn", { match: result });
      break;
    case "contains":
      result = typeof itemValue === "string" && typeof value === "string" && 
             itemValue.toLowerCase().includes(value.toLowerCase());
      logger.debug(CONTEXT, "evaluateCondition: contains", { match: result });
      break;
    case "startsWith":
      result = typeof itemValue === "string" && typeof value === "string" && 
             itemValue.toLowerCase().startsWith(value.toLowerCase());
      logger.debug(CONTEXT, "evaluateCondition: startsWith", { match: result });
      break;
    case "endsWith":
      result = typeof itemValue === "string" && typeof value === "string" && 
             itemValue.toLowerCase().endsWith(value.toLowerCase());
      logger.debug(CONTEXT, "evaluateCondition: endsWith", { match: result });
      break;
    case "between":
      if (typeof value === "object" && value !== null && !Array.isArray(value) && "min" in value && "max" in value) {
        const numValue = typeof itemValue === "number" ? itemValue : parseFloat(String(itemValue));
        const min = typeof value.min === "number" ? value.min : parseFloat(String(value.min));
        const max = typeof value.max === "number" ? value.max : parseFloat(String(value.max));
        result = !isNaN(numValue) && !isNaN(min) && !isNaN(max) && numValue >= min && numValue <= max;
        logger.debug(CONTEXT, "evaluateCondition: between", { numValue, min, max, match: result });
      } else {
        logger.warn(CONTEXT, "evaluateCondition: between operator with invalid value structure");
        result = false;
      }
      break;
    default:
      logger.warn(CONTEXT, "evaluateCondition: unknown operator, returning true", { operator });
      result = true;
  }
  
  return result;
}

function getNestedValue<T extends Record<string, unknown>>(obj: T, path: string): unknown {
  logger.debug(CONTEXT, "getNestedValue: getting nested value", { path });
  const parts = path.split(".");
  let current: unknown = obj;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    logger.debug(CONTEXT, "getNestedValue: traversing path part", { part, partIndex: i, totalParts: parts.length });
    
    if (current === null || current === undefined) {
      logger.debug(CONTEXT, "getNestedValue: current is null/undefined, returning undefined");
      return undefined;
    }
    if (typeof current !== "object") {
      logger.debug(CONTEXT, "getNestedValue: current is not an object, returning undefined", { currentType: typeof current });
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  
  logger.debug(CONTEXT, "getNestedValue: resolved value", { path, valueType: typeof current });
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
  logger.functionEntry("parseFilterFromJSON", { inputLength: jsonString?.length });

  try {
    logger.debug(CONTEXT, "parseFilterFromJSON: attempting to parse JSON");
    const parsed = JSON.parse(jsonString);
    logger.debug(CONTEXT, "parseFilterFromJSON: JSON parsed successfully", { parsedType: typeof parsed });
    
    if (validateFilter(parsed)) {
      logger.debug(CONTEXT, "parseFilterFromJSON: filter structure validated successfully");
      logger.functionExit("parseFilterFromJSON", { success: true, data: { valid: true } });
      return parsed;
    }
    
    logger.warn(CONTEXT, "parseFilterFromJSON: invalid filter structure", { parsedType: typeof parsed });
    logger.functionExit("parseFilterFromJSON", { success: true, data: { valid: false } });
    return null;
  } catch (error) {
    logger.error(CONTEXT, "parseFilterFromJSON: failed to parse JSON", {
      error: error instanceof Error ? error : new Error(String(error)),
      inputPreview: jsonString?.substring(0, 100),
    });
    logger.functionExit("parseFilterFromJSON", { success: false });
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
