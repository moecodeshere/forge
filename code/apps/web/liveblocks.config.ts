declare global {
  interface Liveblocks {
    Presence: {
      cursor: { x: number; y: number } | null;
      selectedNodeId: string | null;
      userColor: string;
      userName: string;
    };
    Storage: {
      graph: {
        nodesJson: string;
        edgesJson: string;
        v: number;
      };
    };
    UserMeta: {
      id: string;
      info: { name: string; color: string };
    };
  }
}

export {};
