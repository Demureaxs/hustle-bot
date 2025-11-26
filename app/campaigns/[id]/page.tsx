"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { 
  Campaign, 
  FilterCondition, 
  FilterGroup, 
  Filter, 
  ComparisonOperator,
  ApiResponse 
} from "@/lib/types";

const FIELD_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "source", label: "Source" },
  { value: "role", label: "Role" },
  { value: "company", label: "Company" },
  { value: "location", label: "Location" },
  { value: "score", label: "Score" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
];

const OPERATOR_OPTIONS: { value: ComparisonOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater than or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less than or equal" },
  { value: "in", label: "in (comma separated)" },
  { value: "between", label: "between" },
];

interface ConditionEditorProps {
  condition: FilterCondition;
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
}

function ConditionEditor({ condition, onChange, onRemove }: ConditionEditorProps) {
  const handleValueChange = (value: string) => {
    if (condition.operator === "in") {
      // Parse comma-separated values
      const values = value.split(",").map(v => v.trim()).filter(Boolean);
      onChange({ ...condition, value: values });
    } else if (condition.operator === "between") {
      // Handle between as min,max
      const [min, max] = value.split(",").map(v => v.trim());
      onChange({ ...condition, value: { min: min || "", max: max || "" } });
    } else if (["gt", "gte", "lt", "lte", "score"].includes(condition.field) || 
               ["gt", "gte", "lt", "lte"].includes(condition.operator)) {
      // Try to parse as number
      const num = parseFloat(value);
      onChange({ ...condition, value: isNaN(num) ? value : num });
    } else {
      onChange({ ...condition, value });
    }
  };

  const getDisplayValue = (): string => {
    if (Array.isArray(condition.value)) {
      return condition.value.join(", ");
    } else if (typeof condition.value === "object" && condition.value !== null && "min" in condition.value) {
      return `${condition.value.min}, ${condition.value.max}`;
    }
    return String(condition.value ?? "");
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
      <select
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value })}
        className="px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
      >
        {FIELD_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as ComparisonOperator })}
        className="px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
      >
        {OPERATOR_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <input
        type="text"
        value={getDisplayValue()}
        onChange={(e) => handleValueChange(e.target.value)}
        placeholder={condition.operator === "between" ? "min, max" : condition.operator === "in" ? "value1, value2, ..." : "value"}
        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
      />

      <button
        onClick={onRemove}
        className="p-2 text-red-600 hover:bg-red-100 rounded"
      >
        ✕
      </button>
    </div>
  );
}

interface FilterBuilderProps {
  filter: Filter;
  onChange: (filter: Filter) => void;
}

function FilterBuilder({ filter, onChange }: FilterBuilderProps) {
  const isGroup = filter && "logic" in filter;
  const group: FilterGroup = isGroup 
    ? filter as FilterGroup
    : { logic: "AND", conditions: filter ? [filter as FilterCondition] : [] };

  const addCondition = () => {
    const newCondition: FilterCondition = {
      field: "status",
      operator: "eq",
      value: "",
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const updateCondition = (index: number, condition: FilterCondition | FilterGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = condition;
    onChange({ ...group, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      onChange(null);
    } else if (newConditions.length === 1 && !("logic" in newConditions[0])) {
      onChange(newConditions[0]);
    } else {
      onChange({ ...group, conditions: newConditions });
    }
  };

  const toggleLogic = () => {
    onChange({
      ...group,
      logic: group.logic === "AND" ? "OR" : "AND",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Match
        </span>
        <button
          onClick={toggleLogic}
          className={`px-3 py-1 rounded text-sm font-medium ${
            group.logic === "AND"
              ? "bg-blue-100 text-blue-700"
              : "bg-purple-100 text-purple-700"
          }`}
        >
          {group.logic === "AND" ? "ALL" : "ANY"} conditions
        </button>
      </div>

      <div className="space-y-3">
        {group.conditions.map((condition, index) => (
          <div key={index}>
            {"field" in condition ? (
              <ConditionEditor
                condition={condition}
                onChange={(c) => updateCondition(index, c)}
                onRemove={() => removeCondition(index)}
              />
            ) : (
              <div className="pl-4 border-l-2 border-zinc-300">
                <FilterBuilder
                  filter={condition}
                  onChange={(f) => f && updateCondition(index, f as FilterGroup)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addCondition}
        className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600"
      >
        + Add Condition
      </button>
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState<Filter>(null);

  const fetchCampaign = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      const data: ApiResponse<Campaign> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch campaign");
      }

      setCampaign(data.data);
      setName(data.data.name);
      setDescription(data.data.description || "");
      setFilter(data.data.filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const saveCampaign = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          filters: filter,
        }),
      });

      const data: ApiResponse<Campaign> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save campaign");
      }

      setCampaign(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-zinc-500">Campaign not found</p>
          <Link href="/campaigns" className="text-blue-600 hover:underline">
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/campaigns"
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Edit Campaign
          </h1>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Campaign Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Filter Builder */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              Filter Conditions
            </label>
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
              <FilterBuilder filter={filter} onChange={setFilter} />
            </div>
          </div>

          {/* Current Filter Preview */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Filter Preview (JSON)
            </label>
            <pre className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg text-sm font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto">
              {JSON.stringify(filter, null, 2) || "null"}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <Link
              href={`/campaigns/${campaignId}/prospects`}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600"
            >
              View Matching Prospects
            </Link>
            <button
              onClick={saveCampaign}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
