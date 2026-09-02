// Which auth backend the running build uses. Set VITE_AUTH_PROVIDER=local
// (see .env.offline) to switch the app to the client-side SQLite basic-auth
// provider instead of Firebase/Google sign-in.
export const isLocalAuthProvider = import.meta.env.VITE_AUTH_PROVIDER === 'local';
