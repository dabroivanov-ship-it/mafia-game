declare module 'socket.io' {
  interface Socket {
    userId?: number;
    userRole?: string;
    isAdmin?: boolean;
    isModerator?: boolean;
    isWatcher?: boolean;
    isStaff?: boolean;
    displayName?: string;
    username?: string;
  }
}

export {};
