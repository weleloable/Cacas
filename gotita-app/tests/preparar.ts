// Ningún test toca la red. Si algo intenta hablar con Supabase, que reviente
// aquí y no en silencio con datos vacíos.
global.fetch = (() => {
  throw new Error('Un test ha intentado usar fetch. Los gate tests no usan red.');
}) as unknown as typeof fetch;
