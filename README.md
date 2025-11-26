# Hustle Bot

Automated lead generation and outreach system powered by AI. A Next.js 16+ application with persistent data storage, deep filtering controls, and integration points for scraping and outreach automation.

## 🚀 Features

- **Prospect Management**: Track and manage leads from multiple sources (Reddit, Upwork, Craigslist, Google Maps, etc.)
- **Campaign System**: Create targeted outreach campaigns with flexible filtering
- **Deep Filtering Engine**: Build complex filters with AND/OR logic, comparisons, and multiple operators
- **Outreach Tracking**: Log and monitor all outreach attempts and responses
- **Scheduling & Automation**: Ready-to-use endpoints for cron jobs and external workers
- **API-First Design**: RESTful API for integration with scrapers and outreach tools
- **AI Intelligence**: Integrates with Google Gemini for lead relevance scoring
- **Multi-Channel Outreach**: Support for email, WhatsApp, LinkedIn, and more

## 🛠️ Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Database**: SQLite via Prisma ORM (with better-sqlite3 adapter)
- **Styling**: Tailwind CSS 4

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Demureaxs/hustle-bot.git
   cd hustle-bot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up the database**:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Create environment file** (optional - defaults work for local development):
   ```bash
   # .env.local
   DATABASE_FILE=./prisma/dev.db
   GEMINI_API_KEY=your_api_key_here  # Optional, for AI scoring
   ```

5. **Run the development server**:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## 📊 Data Model

### Prospect
Stores lead information from various sources.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique identifier |
| source | string | Source system (e.g., "reddit", "upwork") |
| externalId | string | Unique ID from source system |
| name | string | Prospect name |
| role | string? | Role/title (e.g., "Founder", "CEO") |
| company | string? | Company name |
| location | string? | Geographic location |
| email | string? | Email address |
| phone | string? | Phone number |
| tags | string[] | Tags for categorization |
| metadata | object | Additional data (JSON) |
| status | enum | new, reviewed, approved, messaged, responded, disqualified |
| score | number? | AI relevance score (0-100) |

### Campaign
Defines outreach campaigns with filters.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique identifier |
| name | string | Campaign name |
| description | string? | Description |
| filters | object | JSON filter definition |
| templateId | string? | Associated message template |
| active | boolean | Whether campaign is active |

### MessageTemplate
Reusable message templates.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique identifier |
| name | string | Template name |
| channel | string | Channel (email, dm, whatsapp, etc.) |
| subject | string? | Subject line (for email) |
| body | string | Message body with placeholders |

### OutreachLog
Tracks outreach attempts and results.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique identifier |
| prospectId | string | Associated prospect |
| campaignId | string? | Associated campaign |
| channel | string | Communication channel |
| body | string? | Actual message sent |
| status | enum | pending, sent, delivered, failed, replied |
| sentAt | datetime? | When message was sent |
| repliedAt | datetime? | When reply was received |

## 🔍 Filter System

The filtering engine supports complex queries with multiple operators and logical composition.

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| eq | Equals | `status = "approved"` |
| neq | Not equals | `status != "disqualified"` |
| gt, gte | Greater than (or equal) | `score >= 70` |
| lt, lte | Less than (or equal) | `score < 50` |
| in | Value in list | `location in ["US", "Canada"]` |
| notIn | Value not in list | `status not in ["disqualified"]` |
| contains | String contains | `role contains "Founder"` |
| startsWith | String starts with | `name startsWith "John"` |
| endsWith | String ends with | `email endsWith "@gmail.com"` |
| between | Value in range | `score between 50 and 90` |

### Example Filter

```json
{
  "logic": "AND",
  "conditions": [
    { "field": "status", "operator": "eq", "value": "approved" },
    { "field": "role", "operator": "contains", "value": "Founder" },
    { "field": "location", "operator": "in", "value": ["US", "Canada"] },
    { "field": "score", "operator": "gte", "value": 70 }
  ]
}
```

This filter matches: "Approved prospects who are Founders, located in US or Canada, with a score of 70 or higher."

## 🔌 API Endpoints

### Prospects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prospects` | List prospects with filtering |
| POST | `/api/prospects` | Create a prospect |
| GET | `/api/prospects/[id]` | Get prospect details |
| PATCH | `/api/prospects/[id]` | Update prospect |
| DELETE | `/api/prospects/[id]` | Delete prospect |
| POST | `/api/prospects/bulk-upsert` | Bulk import/update prospects |

#### Query Parameters (GET /api/prospects)
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50, max: 100)
- `status` - Filter by status
- `source` - Filter by source
- `search` - Search name, company, role, email
- `filter` - JSON filter string

#### Bulk Upsert (POST /api/prospects/bulk-upsert)
```json
{
  "prospects": [
    {
      "source": "reddit",
      "externalId": "abc123",
      "name": "John Doe",
      "role": "Founder",
      "company": "Startup Inc",
      "location": "US",
      "tags": ["tech", "saas"],
      "metadata": { "companySize": 10 },
      "score": 85
    }
  ]
}
```

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/[id]` | Get campaign details |
| PATCH | `/api/campaigns/[id]` | Update campaign |
| DELETE | `/api/campaigns/[id]` | Delete campaign |
| GET | `/api/campaigns/[id]/prospects` | Get matching prospects |

#### Get Campaign Prospects Parameters
- `page`, `limit` - Pagination
- `status` - Additional status filter (comma-separated)
- `excludeMessaged` - Exclude already messaged (true/false)

### Message Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List templates |
| POST | `/api/templates` | Create template |
| GET | `/api/templates/[id]` | Get template |
| PATCH | `/api/templates/[id]` | Update template |
| DELETE | `/api/templates/[id]` | Delete template |

### Outreach

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/outreach` | List outreach logs |
| POST | `/api/outreach` | Log outreach attempt |
| PATCH | `/api/outreach/[id]` | Update outreach status |

#### Log Outreach (POST /api/outreach)
```json
{
  "prospectId": "uuid",
  "campaignId": "uuid",
  "channel": "email",
  "body": "Hello {{name}}...",
  "status": "sent",
  "sentAt": "2024-01-15T10:00:00Z"
}
```

### Scheduler / Automation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scheduler/housekeeping` | Get system status |
| POST | `/api/scheduler/housekeeping` | Run housekeeping tasks |
| POST | `/api/scheduler/batch` | Get next batch for outreach |

#### Get Batch (POST /api/scheduler/batch)
```json
{
  "limit": 10,
  "campaignId": "optional-uuid",
  "statuses": ["approved"]
}
```

Response:
```json
{
  "data": [
    {
      "campaign": { "id": "...", "name": "...", "template": {...} },
      "prospects": [...],
      "count": 10
    }
  ],
  "totalProspects": 10
}
```

## 🤖 Integration Guide

### For Scrapers

1. Scrape leads from your sources
2. Format them according to the prospect schema
3. Send to `POST /api/prospects/bulk-upsert`
4. The system will create new prospects or update existing ones based on `source + externalId`

```javascript
// Example scraper integration
const prospects = scrapedData.map(item => ({
  source: "reddit",
  externalId: item.id,
  name: item.author,
  role: extractRole(item.title),
  company: extractCompany(item.body),
  metadata: { postUrl: item.url, subreddit: item.subreddit },
  score: aiRelevanceScore(item)
}));

await fetch("/api/prospects/bulk-upsert", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prospects })
});
```

### For Outreach Workers

1. Call `POST /api/scheduler/batch` to get prospects ready for outreach
2. Send messages through your channel (email, WhatsApp, LinkedIn, etc.)
3. Log results via `POST /api/outreach`
4. Update delivery/reply status via `PATCH /api/outreach/[id]`

```javascript
// Example outreach worker
const { data } = await fetch("/api/scheduler/batch", {
  method: "POST",
  body: JSON.stringify({ limit: 10, statuses: ["approved"] })
}).then(r => r.json());

for (const batch of data) {
  const { campaign, prospects } = batch;
  
  for (const prospect of prospects) {
    const message = renderTemplate(campaign.template, prospect);
    
    try {
      const result = await sendMessage(prospect.email, message);
      
      await fetch("/api/outreach", {
        method: "POST",
        body: JSON.stringify({
          prospectId: prospect.id,
          campaignId: campaign.id,
          channel: "email",
          body: message,
          status: "sent",
          sentAt: new Date().toISOString()
        })
      });
    } catch (error) {
      await fetch("/api/outreach", {
        method: "POST",
        body: JSON.stringify({
          prospectId: prospect.id,
          campaignId: campaign.id,
          channel: "email",
          status: "failed",
          error: error.message
        })
      });
    }
  }
}
```

### For Schedulers (Cron/GitHub Actions)

Set up periodic calls to:
- `POST /api/scheduler/housekeeping` - Run daily to update statuses and clean up stale data
- `POST /api/scheduler/batch` - Trigger batch processing as needed

Example GitHub Actions workflow:
```yaml
name: Hustle Bot Scheduler
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  housekeeping:
    runs-on: ubuntu-latest
    steps:
      - name: Run housekeeping
        run: |
          curl -X POST ${{ secrets.HUSTLE_BOT_URL }}/api/scheduler/housekeeping
```

## 🏗️ Project Structure

```
hustle-bot/
├── app/
│   ├── api/                    # API routes
│   │   ├── campaigns/          # Campaign endpoints
│   │   ├── outreach/           # Outreach logging
│   │   ├── prospects/          # Prospect management
│   │   ├── scheduler/          # Automation endpoints
│   │   └── templates/          # Message templates
│   ├── campaigns/              # Campaign UI pages
│   ├── prospects/              # Prospects UI page
│   ├── generated/              # Prisma generated client
│   ├── layout.tsx
│   └── page.tsx                # Dashboard
├── lib/
│   ├── db.ts                   # Database client
│   ├── filters.ts              # Filtering engine
│   └── types.ts                # TypeScript types
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
├── package.json
└── README.md
```

## 🔧 Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Open Prisma Studio (DB GUI)
npx prisma studio
```

## 📜 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
