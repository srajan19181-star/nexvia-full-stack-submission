import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@aureva/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Eye, Heart, ShoppingBag, Star, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { post, put } from "../lib/api";
import type { Product } from "../lib/types";
import { useUiStore } from "../lib/ui-store";
import { Button } from "./ui";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const [quickView, setQuickView] = useState(false);
  const queryClient = useQueryClient();
  const openCart = useUiStore((state) => state.openCart);
  const variant = product.variants[0];
  const add = useMutation({
    mutationFn: () => put("/cart/items", { productVariantId: variant!.id, quantity: 1 }),
    onSuccess: () => {
      toast.success("Added to your bag");
      setQuickView(false);
      openCart();
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const wish = useMutation({
    mutationFn: () => post(`/wishlist/${product.id}`),
    onSuccess: () => {
      toast.success("Saved to your wishlist");
      void queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <motion.article className="group" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: Math.min(index * 0.05, 0.25) }}>
        <div className="relative">
          <Link to={`/product/${product.slug}`} className="block aspect-[4/5] overflow-hidden rounded-[6px] bg-[var(--surface)]">
            <img className="size-full object-cover transition duration-700 group-hover:scale-[1.04]" src={product.images[0]?.url} alt={product.images[0]?.altText ?? product.name} loading="lazy" />
            <span className="absolute left-3 top-3 rounded-[4px] bg-[var(--ivory)]/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">{product.category.name}</span>
          </Link>
          <button className="absolute bottom-3 left-1/2 flex -translate-x-1/2 translate-y-2 items-center gap-2 rounded-[5px] bg-[var(--ivory)] px-3 py-2 text-xs font-bold opacity-0 shadow-lg transition group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100" onClick={() => setQuickView(true)} aria-label={`Quick view ${product.name}`}>
            <Eye size={15} /> Quick view
          </button>
        </div>
        <div className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{product.vendor.storeName}</p>
              <Link to={`/product/${product.slug}`} className="mt-1 block font-semibold">{product.name}</Link>
            </div>
            <button aria-label={`Save ${product.name} to wishlist`} disabled={wish.isPending} onClick={() => wish.mutate()} className="p-1.5"><Heart size={18} /></button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <span className="font-bold">{variant ? formatMoney(variant.price, variant.currency) : "Unavailable"}</span>
              {variant?.compareAtPrice && <span className="ml-2 text-sm text-[var(--muted)] line-through">{formatMoney(variant.compareAtPrice, variant.currency)}</span>}
            </div>
            <button disabled={!variant || add.isPending} onClick={() => add.mutate()} className="grid size-9 place-items-center rounded-[5px] bg-[var(--charcoal)] text-white" aria-label={`Add ${product.name} to cart`}><ShoppingBag size={17} /></button>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-[var(--muted)]"><Star size={13} fill="currentColor" />{Number(product.averageRating).toFixed(1)} <span>({product.reviewCount})</span></div>
        </div>
      </motion.article>
      <QuickView product={product} open={quickView} pending={add.isPending} onAdd={() => add.mutate()} onClose={() => setQuickView(false)} />
    </>
  );
}

function QuickView({ product, open, pending, onAdd, onClose }: { product: Product; open: boolean; pending: boolean; onAdd: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const variant = product.variants[0];
  const available = (variant?.inventory?.quantity ?? 0) - (variant?.inventory?.reserved ?? 0);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`quick-view-${product.id}`} tabIndex={-1} className="relative grid w-full max-w-3xl overflow-hidden rounded-[8px] bg-[var(--ivory)] shadow-2xl outline-none md:grid-cols-2" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} onClick={(event) => event.stopPropagation()}>
            <button className="absolute right-3 top-3 z-10 rounded-[5px] bg-[var(--ivory)] p-2 shadow" onClick={onClose} aria-label="Close quick view"><X size={19} /></button>
            <img className="aspect-[4/5] size-full object-cover" src={product.images[0]?.url} alt={product.images[0]?.altText ?? product.name} />
            <div className="flex flex-col justify-center p-7 sm:p-9">
              <p className="eyebrow">{product.vendor.storeName}</p>
              <h2 id={`quick-view-${product.id}`} className="mt-2 font-editorial text-4xl">{product.name}</h2>
              <div className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]"><Star size={15} fill="currentColor" /> {Number(product.averageRating).toFixed(1)} from {product.reviewCount} reviews</div>
              <p className="mt-5 line-clamp-4 text-sm leading-6 text-[var(--muted)]">{product.description}</p>
              <div className="mt-6 flex items-baseline gap-3"><strong className="text-xl">{variant ? formatMoney(variant.price, variant.currency) : "Unavailable"}</strong>{variant?.compareAtPrice && <span className="text-sm text-[var(--muted)] line-through">{formatMoney(variant.compareAtPrice, variant.currency)}</span>}</div>
              <p className="mt-2 text-xs text-[var(--muted)]">{available > 0 ? `${available} available` : "Currently unavailable"}</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Button disabled={!variant || available < 1 || pending} onClick={onAdd}>{pending ? "Adding…" : "Add to bag"}</Button>
                <Link className="btn btn-secondary" onClick={onClose} to={`/product/${product.slug}`}>View details</Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
