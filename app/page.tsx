"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  totalProspects: number;
  activeCampaigns: number;
  pendingOutreach: number;
}

interface StatusStats {
  totalProspects: number;
  byStatus: Record<string, number>;
  activeCampaigns: number;
  recentOutreach: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statusStats, setStatusStats] = useState<StatusStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/scheduler/housekeeping");
        const data = await response.json();
        
        if (response.ok) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    const runHousekeeping = async () => {
      try {
        const response = await fetch("/api/scheduler/housekeeping", { method: "POST" });
        const data = await response.json();
        
        if (response.ok && data.results?.statsUpdated) {
          setStatusStats(data.results.statsUpdated);
        }
      } catch (error) {
        console.error("Failed to run housekeeping:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    runHousekeeping();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Hustle Bot Dashboard
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">
            Automated lead generation and outreach control center
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Total Prospects
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
              {loading ? "-" : (statusStats?.totalProspects ?? stats?.totalProspects ?? 0)}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Active Campaigns
            </div>
            <div className="text-3xl font-bold text-blue-600 mt-2">
              {loading ? "-" : (statusStats?.activeCampaigns ?? stats?.activeCampaigns ?? 0)}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Recent Outreach (7d)
            </div>
            <div className="text-3xl font-bold text-purple-600 mt-2">
              {loading ? "-" : (statusStats?.recentOutreach ?? 0)}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Pending Outreach
            </div>
            <div className="text-3xl font-bold text-orange-600 mt-2">
              {loading ? "-" : (stats?.pendingOutreach ?? 0)}
            </div>
          </div>
        </div>

        {/* Prospect Status Breakdown */}
        {statusStats?.byStatus && Object.keys(statusStats.byStatus).length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Prospects by Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {[
                { key: "new", label: "New", color: "bg-blue-100 text-blue-800" },
                { key: "reviewed", label: "Reviewed", color: "bg-yellow-100 text-yellow-800" },
                { key: "approved", label: "Approved", color: "bg-green-100 text-green-800" },
                { key: "messaged", label: "Messaged", color: "bg-purple-100 text-purple-800" },
                { key: "responded", label: "Responded", color: "bg-emerald-100 text-emerald-800" },
                { key: "disqualified", label: "Disqualified", color: "bg-red-100 text-red-800" },
              ].map(({ key, label, color }) => (
                <div key={key} className="text-center">
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${color}`}>
                    {label}
                  </div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                    {statusStats.byStatus[key] ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link
            href="/prospects"
            className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Prospects
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  View, filter, and manage all prospects
                </p>
              </div>
              <span className="text-2xl">👥</span>
            </div>
          </Link>

          <Link
            href="/campaigns"
            className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Campaigns
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Create and manage outreach campaigns
                </p>
              </div>
              <span className="text-2xl">📣</span>
            </div>
          </Link>
        </div>

        {/* Integration Guide */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Integration Endpoints
          </h2>
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-4">
              <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-900 rounded text-xs">
                POST /api/prospects/bulk-upsert
              </code>
              <span className="text-zinc-600 dark:text-zinc-400">
                Bulk import prospects from scrapers
              </span>
            </div>
            <div className="flex items-start gap-4">
              <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-900 rounded text-xs">
                POST /api/scheduler/batch
              </code>
              <span className="text-zinc-600 dark:text-zinc-400">
                Get next batch of prospects for outreach
              </span>
            </div>
            <div className="flex items-start gap-4">
              <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-900 rounded text-xs">
                POST /api/outreach
              </code>
              <span className="text-zinc-600 dark:text-zinc-400">
                Log outreach attempts and results
              </span>
            </div>
            <div className="flex items-start gap-4">
              <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-900 rounded text-xs">
                POST /api/scheduler/housekeeping
              </code>
              <span className="text-zinc-600 dark:text-zinc-400">
                Run periodic housekeeping tasks
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
