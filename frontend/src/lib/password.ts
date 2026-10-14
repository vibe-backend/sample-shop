// Demo credentials still require a salted, deliberately slow verifier when persisted.
const ITERATIONS = 100_000;
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
export async function passwordHash(
  password: string,
  salt = hex(crypto.getRandomValues(new Uint8Array(16))),
): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2$${salt}$${hex(new Uint8Array(bits))}`;
}
export async function passwordMatches(password: string, verifier: string): Promise<boolean> {
  const parts = verifier.split('$');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const candidate = await passwordHash(password, parts[1]);
  let difference = candidate.length ^ verifier.length;
  for (let i = 0; i < candidate.length; i++) difference |= candidate.charCodeAt(i) ^ verifier.charCodeAt(i);
  return difference === 0;
}
