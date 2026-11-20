import { useEffect, useRef } from "react";
import { formatMoney } from "@aureva/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Minus, Plus, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, put, remove } from "../lib/api";
import type { Cart } from "../lib/types";
import { useUiStore } from "../lib/ui-store";
import { Empty, Loading } from "./ui";

export function CartDrawer() {
  const open = useUiStore((state) => state.cartOpen);
  const close = useUiStore((state) => state.closeCart);
  const panel = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();
  const cart = useQuery({ queryKey: ["cart"], queryFn: () => api<Cart>("/cart"), enabled: open });
  const update = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => put("/cart/items", { productVariantId: id, quantity }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteItem = useMutation({
    mutationFn: (id: string) => remove(`/cart/items/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  const items = cart.data?.items ?? [];
  const subtotal = items.reduce((sum, item) => sum + item.productVariant.price * item.quantity, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[110] bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            tabIndex={-1}
            className="ml-auto flex h-full w-full max-w-md flex-col bg-[var(--ivory)] shadow-2xl outline-none"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
              <div>
                <p className="eyebrow">Your selection</p>
                <h2 id="cart-drawer-title" className="font-editorial text-3xl">Shopping bag</h2>
              </div>
              <button className="p-2" onClick={close} aria-label="Close shopping bag"><X /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cart.isLoading ? <Loading label="Loading your bag" /> : items.length ? (
                <div className="divide-y divide-[var(--border)]">
                  {items.map((item) => {
                    const available = (item.productVariant.inventory?.quantity ?? 0) - (item.productVariant.inventory?.reserved ?? 0);
                    return (
                      <article className="grid grid-cols-[78px_1fr] gap-4 py-5" key={item.id}>
                        <img className="aspect-[4/5] size-full rounded-[5px] object-cover" src={item.productVariant.product.images[0]?.url} alt={item.productVariant.product.name} />
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{item.productVariant.product.vendor.storeName}</p>
                              <Link onClick={close} className="mt-1 block text-sm font-bold" to={`/product/${item.productVariant.product.slug}`}>{item.productVariant.product.name}</Link>
                              <p className="text-xs text-[var(--muted)]">{item.productVariant.name}</p>
                            </div>
                            <button className="p-1" aria-label={`Remove ${item.productVariant.product.name}`} onClick={() => deleteItem.mutate(item.productVariant.id)}><Trash2 size={16} /></button>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 border border-[var(--border)] px-2 py-1 text-sm">
                              <button aria-label="Decrease quantity" disabled={item.quantity <= 1 || update.isPending} onClick={() => update.mutate({ id: item.productVariant.id, quantity: item.quantity - 1 })}><Minus size={13} /></button>
                              <span aria-live="polite">{item.quantity}</span>
                              <button aria-label="Increase quantity" disabled={item.quantity >= available || update.isPending} onClick={() => update.mutate({ id: item.productVariant.id, quantity: item.quantity + 1 })}><Plus size={13} /></button>
                            </div>
                            <strong className="text-sm">{formatMoney(item.productVariant.price * item.quantity, item.productVariant.currency)}</strong>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <Empty title="Your bag is empty" description="Discover objects made to stay." />}
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--canvas)] p-5">
              <p className="flex items-center justify-between text-lg"><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></p>
              <p className="mt-1 text-xs text-[var(--muted)]">Delivery and tax are calculated securely at checkout.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link className="btn btn-secondary" onClick={close} to="/cart">View bag</Link>
                {items.length ? <Link className="btn btn-primary" onClick={close} to="/checkout">Checkout <ArrowRight size={16} /></Link> : <span className="btn btn-primary cursor-not-allowed opacity-50">Checkout <ArrowRight size={16} /></span>}
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
