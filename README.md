# HustleBot V2 (Next.js Port)

Automated lead generation and outreach system powered by AI. Ported from React SPA to Next.js 15 (App Router).

## 🚀 Features

- **Multi-Source Scraping**:
  - **Reddit**: Scans `r/forhire`, `r/jobbit`, etc. for relevant gigs.
  - **Upwork**: Monitors RSS feeds for specific keywords.
  - **Craigslist**: Checks local classifieds for gigs.
  - **Google Maps**: Finds local businesses without websites (using Puppeteer).
- **AI Intelligence**:
  - Uses **Google Gemini 2.5 Flash** to analyze lead relevance (0-100 score).
  - Generates personalized, high-converting cold outreach pitches.
- **WhatsApp Automation**:
  - Integrated "Click to Chat" for instant outreach.
  - Standalone worker for automated session management.
- **Local Database**:
  - Stores leads in `better-sqlite3` to prevent duplicates.

## 🛠️ Prerequisites

- **Node.js** (v18 or higher)
- **Google Gemini API Key** (Get one from Google AI Studio)
- **WhatsApp Account** (Phone with WhatsApp installed)

## 📦 Installation

1.  **Clone the repository** (if not already done).
2.  **Install dependencies**:
    ```bash
    npm install
    ```

## ⚙️ Configuration

1.  Create a `.env.local` file in the root directory:
    ```bash
    cp .env.example .env.local # If example exists, otherwise just create it
    ```
2.  Add your API Key:
    ```env
    GEMINI_API_KEY=your_api_key_here
    ```

## 🏃‍♂️ Running Locally

### 1. Start the WhatsApp Worker (Optional)

If you want to maintain a persistent WhatsApp session:

```bash
npx tsx src/workers/whatsapp-worker.ts
```

_Scan the QR code with your phone when prompted._

### 2. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Verify Scrapers (Backend Test)

To test the scraping logic without the UI:

```bash
npx tsx test-scrapers.ts
```

## 🐳 Docker Deployment

The application is containerized for easy deployment.

1.  **Build and Run**:
    ```bash
    docker-compose up --build -d
    ```
2.  **Access**:
    The app will be available at `http://localhost:3000`.
    _Note: Puppeteer runs in headless mode inside the container._

## 📂 Project Structure

- `src/app`: Next.js App Router pages and layouts.
- `src/actions`: Server Actions for backend logic (Scraping, AI).
- `src/components`: UI Components (ConfigPanel, LeadFeed).
- `src/lib`: Utilities (Database, Gemini Client).
- `src/workers`: Standalone background workers.

## 🛡️ Anti-Ban Measures

- Random User-Agent rotation for scrapers.
- Randomized delays between requests.
- Local caching of leads to prevent over-fetching.
# hustle-bot
