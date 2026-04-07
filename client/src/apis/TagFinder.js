import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const TagFinder = {
  async get(_path, config) {
    if (!isSupabaseConfigured() || !supabase) {
      const err = new Error("Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY");
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
      const err = new Error(error.message);
      err.response = { status: 400, data: { message: error.message } };
      throw err;
    }
    return { data: { status: "Success", data: { tags: data || [] } } };
  },
};

export default TagFinder;
