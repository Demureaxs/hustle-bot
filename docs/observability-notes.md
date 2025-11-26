# Observability Notes

This document identifies potential failure points in the Hustle Bot control plane based on the extensive logging instrumentation added to the codebase. These failure points are designed to help operators diagnose and triage production issues.

## Failure Point 1: Prisma Client Initialization Issues

### Description
The Prisma client relies on the `@prisma/adapter-better-sqlite3` adapter and a generated client at `app/generated/prisma`. If the adapter is misconfigured, the database file is missing, or the generated client is out of date, the application will fail to connect to the database.

### What Would Be Logged

```
[2024-01-15T10:23:45.123Z] [ERROR] [ProspectsService] DB operation failed: prisma.prospect.findMany {
  "errorMessage": "PrismaClientInitializationError: Unable to establish a database connection",
  "errorStack": "PrismaClientInitializationError: Unable to establish a database connection\n    at PrismaClient._request..."
}
```

Or for adapter-specific issues:

```
[2024-01-15T10:23:45.123Z] [ERROR] [CampaignsService] DB operation failed: prisma.campaign.findMany {
  "errorMessage": "Error: SQLITE_CANTOPEN: unable to open database file",
  "errorStack": "Error: SQLITE_CANTOPEN: unable to open database file\n    at Database..."
}
```

### How to Triage

1. **Check if the Prisma client is generated**: Look for the `app/generated/prisma` directory. If missing, run `npx prisma generate`.

2. **Verify the database file exists**: The default path is `dev.db` in the project root. Check the `DATABASE_FILE` environment variable if set.

3. **Verify the adapter configuration**: Ensure `@prisma/adapter-better-sqlite3` is installed and the version matches `@prisma/client`.

4. **Check file permissions**: Ensure the application has read/write access to the database file and its directory.

---

## Failure Point 2: Campaign Filter JSON Shape Mismatches

### Description
The Campaign model stores filters as a JSON string in the `filters` column. If the JSON does not match the expected `Filter` type structure (FilterCondition or FilterGroup), the filter engine will fail to parse or apply it correctly.

### What Would Be Logged

```
[2024-01-15T10:23:45.123Z] [DEBUG] [FiltersEngine] parseFilterFromJSON: attempting to parse JSON {"inputLength":156}
[2024-01-15T10:23:45.124Z] [DEBUG] [FiltersEngine] parseFilterFromJSON: JSON parsed successfully {"parsedType":"object"}
[2024-01-15T10:23:45.125Z] [DEBUG] [validateFilter] validateFilter: filter appears to be a condition
[2024-01-15T10:23:45.126Z] [DEBUG] [FiltersEngine] validateFilter: condition validation result {"field":"status","operator":"invalid_op","isValid":false}
[2024-01-15T10:23:45.127Z] [WARN] [FiltersEngine] parseFilterFromJSON: invalid filter structure {"parsedType":"object"}
```

Or for completely malformed JSON:

```
[2024-01-15T10:23:45.123Z] [DEBUG] [FiltersEngine] parseFilterFromJSON: attempting to parse JSON {"inputLength":42}
[2024-01-15T10:23:45.124Z] [ERROR] [FiltersEngine] parseFilterFromJSON: failed to parse JSON {
  "errorMessage": "Unexpected token } in JSON at position 41",
  "inputPreview": "{ \"field\": \"status\", \"operator\": \"eq\", }"
}
```

### How to Triage

1. **Identify the problematic campaign**: Look for the campaign ID in surrounding logs. The service layer logs the campaign ID when fetching.

2. **Inspect the raw filter JSON**: Query the database directly:
   ```sql
   SELECT id, name, filters FROM Campaign WHERE id = '<campaign_id>';
   ```

3. **Validate the filter structure manually**: Ensure it follows one of these patterns:
   - **FilterCondition**: `{ "field": "...", "operator": "...", "value": ... }`
   - **FilterGroup**: `{ "logic": "AND"|"OR", "conditions": [...] }`

4. **Check for common issues**:
   - Missing required fields (`field`, `operator`, `value` for conditions)
   - Invalid operator (must be one of: eq, neq, gt, gte, lt, lte, in, notIn, contains, startsWith, endsWith, between)
   - Invalid logic value (must be "AND" or "OR")
   - Trailing commas or malformed JSON

---

## Failure Point 3: Bulk Upsert Payload Malformation or Uniqueness Conflicts

### Description
The bulk upsert endpoint expects an array of prospect payloads with specific required fields (`source`, `externalId`, `name`). Malformed payloads or conflicts with the unique constraint on `(source, externalId)` can cause partial or complete failures.

### What Would Be Logged

For validation failures:

```
[2024-01-15T10:23:45.123Z] [DEBUG] [API:prospects/bulk-upsert] Request body parsed {"hasProspects":true,"isArray":true,"count":50}
[2024-01-15T10:23:45.124Z] [DEBUG] [API:prospects/bulk-upsert] Invalid prospect found {"index":23,"hasSource":true,"hasExternalId":false,"hasName":true}
[2024-01-15T10:23:45.125Z] [WARN] [API:prospects/bulk-upsert] Some prospects are missing required fields {"invalidCount":3,"invalidIndices":[23,31,45]}
```

For database errors during upsert:

```
[2024-01-15T10:23:45.123Z] [INFO] [ProspectsService] bulkUpsertProspects: starting transaction {"prospectCount":50}
[2024-01-15T10:23:45.124Z] [DEBUG] [ProspectsService] Loop: processing prospect {"current":24,"total":50,"itemSummary":{"source":"reddit","externalId":"abc123"}}
[2024-01-15T10:23:45.125Z] [ERROR] [ProspectsService] bulkUpsertProspects: error processing prospect {
  "source": "reddit",
  "externalId": "abc123",
  "errorMessage": "Unique constraint failed on the constraint: `Prospect_source_externalId_key`"
}
[2024-01-15T10:23:45.500Z] [DEBUG] [ProspectsService] Loop complete: prospect processing {"totalIterations":50,"successCount":47,"errorCount":3}
```

### How to Triage

1. **Check the error counts in the response**: The endpoint returns `errorCount` and first 10 error messages in the response.

2. **Look for validation failures**: Search logs for "Invalid prospect found" or "missing required fields" to identify malformed payloads.

3. **Check for unique constraint violations**: If errors mention "Unique constraint failed", there may be duplicate entries in the input or existing records with the same `(source, externalId)`.

4. **Inspect the input payload**: The logs show which indices failed validation. Have the scraper team verify the data at those positions.

5. **Review concurrent requests**: If multiple bulk upserts are running concurrently with overlapping data, consider serializing requests or using a queue.

---

## Additional Debugging Tips

### Enabling DEBUG Level Logging

Set the environment variable to see all debug-level logs:

```bash
LOG_LEVEL=DEBUG npm run dev
```

### Key Log Patterns to Search For

| Pattern | Meaning |
|---------|---------|
| `[ERROR]` | Critical errors that prevented an operation |
| `[WARN]` | Validation failures or recoverable issues |
| `DB operation failed` | Database query/mutation errors |
| `Function entry` / `Function exit` | Track request flow through service functions |
| `Branch taken` | Understand which code paths were executed |
| `Loop:` / `Loop complete` | Track iteration progress for bulk operations |

### Correlating Logs Across Requests

Look for the context tag (e.g., `[API:prospects/bulk-upsert]`, `[ProspectsService]`) to trace a single request through the system. Function names are also logged to help follow the call stack.
