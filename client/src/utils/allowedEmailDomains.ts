/** Split VITE_ALLOWED_EMAIL_DOMAIN; supports comma-separated list. */
export function parseAllowedEmailDomains(raw?: string): string[] {
  const s = (raw ?? "acts2.network").toLowerCase();
  return s
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

export function isEmailInAllowedDomains(
  email: string | null | undefined,
  domains: string[]
): boolean {
  if (!email || typeof email !== "string") return false;
  const lower = email.toLowerCase();
  return domains.some((domain) => lower.endsWith(`@${domain}`));
}

/** Google Sign-In `hosted_domain` accepts a single domain — use the first in the list. */
export function googleHostedDomain(domains: string[]): string {
  return domains[0] ?? "acts2.network";
}

/**
 * Dev quick-fill emails: if multiple domains are listed, use the last (e.g. places.local
 * after acts2.network). If one domain, use that.
 */
export function devQuickFillDomain(domains: string[]): string {
  if (domains.length <= 1) return domains[0] ?? "acts2.network";
  return domains[domains.length - 1];
}

/** For UI copy, e.g. "@a or @b" */
export function formatAllowedDomainsForMessage(domains: string[]): string {
  return domains.map((d) => `@${d}`).join(" or ");
}
