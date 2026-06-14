declare module 'socket.io' {
  interface Socket {
    userId?: number;
    userRole?: string;
    isAdmin?: boolean;
    isModerator?: boolean;
    isStaff?: boolean;
    displayName?: string;
    username?: string;
  }
}

export {};
