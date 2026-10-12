// Directory: /app/bears/_store/index.ts
import { create } from 'zustand';

// State types
interface States {
  userInfo: any;
}

// useBearStore
export const useAuthStore = create<States>(() => ({
  userInfo: null,
}));