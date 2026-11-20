export const websocketMessage = {
  sync: 0,
  awareness: 1,
  auth: 2,
  queryAwareness: 3,
} as const;

export const websocketClose = {
  unauthorized: 4_401,
  forbidden: 4_403,
  notFound: 4_404,
  invalidMessage: 4_422,
  documentRestored: 4_409,
  serverRestart: 4_503,
} as const;
