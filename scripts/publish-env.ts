/**
 * Read the store credentials a publish script needs. Exits with a clear
 * message naming the missing variables (never their values).
 */
export function requireEnv<const K extends string>(names: readonly K[]): Record<K, string> {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  return Object.fromEntries(names.map((name) => [name, process.env[name]!])) as Record<
    K,
    string
  >;
}
