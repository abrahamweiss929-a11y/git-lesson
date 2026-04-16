import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerTool } from "./index";
import type { ToolResult } from "./types";

registerTool(
  {
    name: "search_items",
    description:
      "Search the item catalog. Returns items matching the given filters. All filters are optional and combine with AND. Use this for questions like 'list all items', 'show me chemistry items', 'items for the DxC 700'.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Substring match on item_code or item_name (case-insensitive).",
        },
        manufacturer: {
          type: "string",
          description:
            "Exact match on manufacturer name (case-insensitive).",
        },
        category: {
          type: "string",
          description:
            "Exact match on category (e.g., 'Chemistry', 'Hematology').",
        },
        machine: {
          type: "string",
          description:
            "Exact match on machine name (e.g., 'DxC 700 AU').",
        },
        test_type: {
          type: "string",
          description: "Exact match on test_type (e.g., 'hCG', 'Glucose').",
        },
        item_type: {
          type: "string",
          description:
            "Exact match on item_type (e.g., 'Reagent', 'Calibrator').",
        },
        limit: {
          type: "integer",
          description: "Max rows to return. Default 100, max 1000.",
          minimum: 1,
          maximum: 1000,
        },
      },
      required: [],
    },
  },
  async (input): Promise<ToolResult> => {
    const limit = Math.min(Number(input.limit) || 100, 1000);
    let query = supabaseAdmin
      .from("item")
      .select(
        "id, item_code, item_name, manufacturer, category, machine, test_type, item_type, parts_per_box, tests_per_box, shelf_life_days, storage_requirements, average_order_qty, notes, created_at"
      )
      .order("item_code")
      .limit(limit);

    if (input.query) {
      const q = String(input.query);
      query = query.or(
        `item_code.ilike.%${q}%,item_name.ilike.%${q}%`
      );
    }
    if (input.manufacturer) {
      query = query.ilike("manufacturer", String(input.manufacturer));
    }
    if (input.category) {
      query = query.ilike("category", String(input.category));
    }
    if (input.machine) {
      query = query.ilike("machine", String(input.machine));
    }
    if (input.test_type) {
      query = query.ilike("test_type", String(input.test_type));
    }
    if (input.item_type) {
      query = query.ilike("item_type", String(input.item_type));
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, error: { code: "DB_ERROR", message: error.message } };
    }

    return {
      ok: true,
      data: data ?? [],
      summary: `Found ${data?.length ?? 0} items`,
    };
  }
);
