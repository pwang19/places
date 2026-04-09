import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

type ErrWithResponse = Error & {
  response?: { status: number; data: Record<string, unknown> };
};

/** Tag search (axios-like shape for TagInput). */
const TagFinder = {
  async get(_path, config) {
    if (!isSupabaseConfigured() || !supabase) {
      const err = new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY") as ErrWithResponse;
      err.response = { status: 500, data: { message: err.message } };
      throw err;
    }
    const q = (config?.params?.q || "").trim();
    if (!q) {
      return { data: { status: "Success", data: { tags: [] } } };
    }
    const { data, error } = await supabase
      .from("tags")
      .select("id,name")
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(20);
    if (error) {
      const err = new Error(error.message) as ErrWithResponse;
      err.response = { status: 400, data: { message: error.message } };
      throw err;
    }
    return { data: { status: "Success", data: { tags: data || [] } } };
  },
};

export default TagFinder;
