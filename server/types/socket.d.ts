declare module 'socket.io' {
  interface Socket {
    userId?: number;
    userRole?: string;
    isAdmin?: boolean;
    displayName?: string;
    username?: string;
  }
}

export {};
