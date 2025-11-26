"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Campaign, ApiResponse } from "@/lib/types";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", description: "" });

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/campaigns");
      const data: ApiResponse<Campaign[]> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch campaigns");
      }

      setCampaigns(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCampaign),
      });

      if (!response.ok) {
        throw new Error("Failed to create campaign");
      }

      setShowCreateForm(false);
      setNewCampaign({ name: "", description: "" });
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const toggleCampaignActive = async (id: string, active: boolean) => {
    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });

      if (!response.ok) {
        throw new Error("Failed to update campaign");
      }

      setCampaigns(prev =>
        prev.map(c => (c.id === id ? { ...c, active } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete campaign");
      }

      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Campaigns
          </h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            New Campaign
          </button>
        </div>

        {/* Create Campaign Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                Create Campaign
              </h2>
              <form onSubmit={createCampaign}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newCampaign.description}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
          </div>
        )}

        {/* Campaigns Grid */}
        {!loading && campaigns.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {campaign.name}
                      </h3>
                      <span
                        className={`inline-flex mt-1 px-2 py-1 text-xs font-semibold rounded-full ${
                          campaign.active
                            ? "bg-green-100 text-green-800"
                            : "bg-zinc-100 text-zinc-800"
                        }`}
                      >
                        {campaign.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={campaign.active}
                        onChange={(e) => toggleCampaignActive(campaign.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {campaign.description && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                      {campaign.description}
                    </p>
                  )}

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Filter Summary
                    </h4>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded p-3 text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {campaign.filterSummary || "No filter (all records)"}
                    </div>
                  </div>

                  {campaign.messageTemplate && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Template: {campaign.messageTemplate.name}
                      </h4>
                      <span className="text-xs text-zinc-500">
                        ({campaign.messageTemplate.channel})
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="flex-1 px-3 py-2 text-center text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/campaigns/${campaign.id}/prospects`}
                      className="flex-1 px-3 py-2 text-center text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600"
                    >
                      Prospects
                    </Link>
                    <button
                      onClick={() => deleteCampaign(campaign.id)}
                      className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && campaigns.length === 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              No campaigns yet. Create your first campaign to start organizing outreach.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Campaign
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
