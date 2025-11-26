"use client";

import { useState, useEffect, useCallback } from "react";
import type { Prospect, ProspectStatus, ApiResponse, PaginationInfo } from "@/lib/types";

const STATUS_COLORS: Record<ProspectStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  reviewed: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  messaged: "bg-purple-100 text-purple-800",
  responded: "bg-emerald-100 text-emerald-800",
  disqualified: "bg-red-100 text-red-800",
};

const STATUS_OPTIONS: ProspectStatus[] = [
  "new",
  "reviewed",
  "approved",
  "messaged",
  "responded",
  "disqualified",
];

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", "20");
      
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/prospects?${params}`);
      const data: ApiResponse<Prospect[]> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch prospects");
      }

      setProspects(data.data);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, sourceFilter, searchQuery]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  const updateProspectStatus = async (id: string, status: ProspectStatus) => {
    try {
      const response = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      // Update local state
      setProspects(prev =>
        prev.map(p => (p.id === id ? { ...p, status } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Prospects
          </h1>
          <div className="text-sm text-zinc-500">
            {pagination?.total ?? 0} total prospects
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Name, company, role..."
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Source
              </label>
              <input
                type="text"
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="reddit, upwork..."
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStatusFilter("");
                  setSourceFilter("");
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

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

        {/* Prospects Table */}
        {!loading && prospects.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700">
                  {prospects.map((prospect) => (
                    <tr key={prospect.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {prospect.name}
                        </div>
                        {prospect.email && (
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            {prospect.email}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-zinc-100">
                        {prospect.company || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-zinc-100">
                        {prospect.role || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                        {prospect.source}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {prospect.score !== null ? (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            prospect.score >= 70 ? "bg-green-100 text-green-800" :
                            prospect.score >= 40 ? "bg-yellow-100 text-yellow-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {prospect.score}
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[prospect.status]}`}>
                          {prospect.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <select
                          value={prospect.status}
                          onChange={(e) => updateProspectStatus(prospect.id, e.target.value as ProspectStatus)}
                          className="px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        >
                          {STATUS_OPTIONS.map(status => (
                            <option key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && prospects.length === 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              No prospects found. Start by adding prospects through the API or scraping.
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Showing page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages}
                className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
