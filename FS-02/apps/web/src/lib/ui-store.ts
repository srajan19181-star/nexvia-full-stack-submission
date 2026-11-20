import { create } from "zustand";

type UiState = {
  cartOpen: boolean;
  closeCart: () => void;
  openCart: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  cartOpen: false,
  closeCart: () => set({ cartOpen: false }),
  openCart: () => set({ cartOpen: true }),
}));
