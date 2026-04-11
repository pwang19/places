/**
 * Optional: create dev email users + app_admins row for "admin".
 * If you already created users in the Dashboard, skip this script.
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: SEED_EMAIL_DOMAIN (default places.local), DEV_SEED_PASSWORD (default DevPass123!)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = (process.env.SEED_EMAIL_DOMAIN || "places.local").toLowerCase();
const password = process.env.DEV_SEED_PASSWORD || "DevPass123!";

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  { local: "user1", name: "Dev User 1" },
  { local: "user2", name: "Dev User 2" },
  { local: "admin", name: "Dev Admin" },
];

async function main() {
  const { error: admErr } = await supabase.from("app_admins").upsert(
    { username: "admin" },
    { onConflict: "username" }
  );
  if (admErr) {
    console.error("app_admins upsert:", admErr.message);
    process.exit(1);
  }

  for (const { local, name } of users) {
    const email = `${local}@${domain}`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) {
      if (
        /already|registered|exists/i.test(error.message) ||
        error.status === 422
      ) {
        console.log("Skip (exists):", email);
        continue;
      }
      console.error(email, error.message);
      process.exit(1);
    }
    console.log("Created:", email, data.user?.id);
  }

  console.log("\nPassword (unless DEV_SEED_PASSWORD set):", password);
  console.log("client/.env: VITE_ALLOWED_EMAIL_DOMAIN=" + domain);
  console.log("client/.env: VITE_DEV_EMAIL_AUTH=true");
}

main();
