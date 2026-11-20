import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Heart, Minus, Plus, ShieldCheck, Star, Truck } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatMoney } from "@aureva/shared";
import { ProductCard } from "../components/product";
import { Button, Empty, ErrorState, Loading, SectionTitle } from "../components/ui";
import { api, post, put } from "../lib/api";
import type { Product } from "../lib/types";
import { useUiStore } from "../lib/ui-store";
import { toast } from "sonner";

type ProductDetailData = Product & {
  specifications: Record<string, string>;
  reviews: Array<{ id: string; rating: number; title: string; body: string; createdAt: string; user: { name: string } }>;
  vendor: Product["vendor"] & { processingDays?: number; returnPolicy?: string | null };
};

export default function ProductDetail() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openCart = useUiStore((state) => state.openCart);
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const query = useQuery({ queryKey: ["product", slug], queryFn: () => api<ProductDetailData>(`/products/${slug}`) });
  const related = useQuery({ queryKey: ["related-products", slug], queryFn: () => api<Product[]>(`/products/${slug}/related`), enabled: Boolean(query.data) });

  useEffect(() => {
    if (query.data?.variants.length && !query.data.variants.some((variant) => variant.id === variantId)) setVariantId(query.data.variants[0]!.id);
  }, [query.data, variantId]);

  const variant = query.data?.variants.find((item) => item.id === variantId) ?? query.data?.variants[0];
  const available = Math.max(0, (variant?.inventory?.quantity ?? 0) - (variant?.inventory?.reserved ?? 0));
  const discount = useMemo(() => variant?.compareAtPrice && variant.compareAtPrice > variant.price ? Math.round((1 - variant.price / variant.compareAtPrice) * 100) : 0, [variant]);

  const add = useMutation({
    mutationFn: () => put("/cart/items", { productVariantId: variant!.id, quantity }),
    onSuccess: () => {
      toast.success("Added to your bag");
      openCart();
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const buyNow = useMutation({
    mutationFn: () => put("/cart/items", { productVariantId: variant!.id, quantity }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      navigate("/checkout");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const wish = useMutation({
    mutationFn: () => post(`/wishlist/${query.data!.id}`),
    onSuccess: () => {
      toast.success("Saved to your wishlist");
      void queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <Loading label="Curating product details" />;
  if (query.isError || !query.data) return <div className="container-shell py-20"><ErrorState message={(query.error as Error)?.message} /></div>;

  const product = query.data;
  const specifications = Object.entries(product.specifications ?? {});
  const image = product.images[imageIndex] ?? product.images[0];

  return (
    <div className="container-shell py-10">
      <nav className="mb-8 flex flex-wrap gap-2 text-sm text-[var(--muted)]" aria-label="Breadcrumb">
        <Link to="/products">Shop</Link><span>/</span><Link to={`/category/${product.category.slug}`}>{product.category.name}</Link><span>/</span><span aria-current="page">{product.name}</span>
      </nav>
      <div className="grid gap-10 lg:grid-cols-[1.15fr_.85fr]">
        <div className="grid gap-3 md:grid-cols-[90px_1fr]">
          <div className="order-2 flex gap-2 overflow-auto md:order-1 md:flex-col">
            {product.images.map((item, index) => (
              <button key={item.url} onClick={() => setImageIndex(index)} className={`aspect-square min-w-20 overflow-hidden rounded-[5px] border ${imageIndex === index ? "border-[var(--charcoal)]" : "border-transparent"}`} aria-label={`View image ${index + 1}`}>
                <img className="size-full object-cover" src={item.url} alt={item.altText || product.name} loading="lazy" />
              </button>
            ))}
          </div>
          <div className="group order-1 aspect-[4/5] overflow-hidden rounded-[6px] bg-[var(--surface)] md:order-2">
            <AnimatePresence mode="wait">
              {image && <motion.img key={image.url} className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" src={image.url} alt={image.altText || product.name} initial={{ opacity: 0.25 }} animate={{ opacity: 1 }} exit={{ opacity: 0.2 }} />}
            </AnimatePresence>
          </div>
        </div>
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Link className="eyebrow" to={`/vendor/${product.vendor.slug}`}>{product.vendor.storeName}</Link>
          <h1 className="mt-3 font-editorial text-5xl leading-none sm:text-6xl">{product.name}</h1>
          <div className="mt-4 flex items-center gap-2 text-sm"><Star size={16} fill="currentColor" /> {Number(product.averageRating).toFixed(1)} · {product.reviewCount} reviews</div>
          <div className="mt-7 flex flex-wrap items-center gap-3 text-2xl font-bold">
            {variant ? formatMoney(variant.price, variant.currency) : "Unavailable"}
            {variant?.compareAtPrice && <span className="text-base font-normal text-[var(--muted)] line-through">{formatMoney(variant.compareAtPrice, variant.currency)}</span>}
            {discount > 0 && <span className="rounded-[4px] bg-[var(--surface)] px-2 py-1 text-xs font-bold text-[var(--olive)]">SAVE {discount}%</span>}
          </div>
          <p className="mt-6 leading-7 text-[var(--muted)]">{product.description}</p>
          {product.variants.length > 1 && (
            <fieldset className="mt-7">
              <legend className="mb-3 text-xs font-bold uppercase tracking-widest">Choose a variant</legend>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((item) => {
                  const stock = Math.max(0, (item.inventory?.quantity ?? 0) - (item.inventory?.reserved ?? 0));
                  return <button key={item.id} type="button" disabled={stock === 0} onClick={() => { setVariantId(item.id); setQuantity(1); }} className={`rounded-[5px] border px-4 py-2 text-sm transition ${variant?.id === item.id ? "border-[var(--charcoal)] bg-[var(--charcoal)] text-white" : "border-[var(--border)] bg-[var(--ivory)]"} disabled:cursor-not-allowed disabled:opacity-45`}>{item.name}</button>;
                })}
              </div>
            </fieldset>
          )}
          <div className="my-7 border-y border-[var(--border)] py-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest">Quantity</p>
            <div className="flex w-32 items-center justify-between border border-[var(--border)] bg-[var(--ivory)] p-2">
              <button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button>
              <span aria-live="polite">{quantity}</span>
              <button aria-label="Increase quantity" disabled={quantity >= Math.min(20, available)} onClick={() => setQuantity(Math.min(20, available, quantity + 1))}><Plus size={16} /></button>
            </div>
            <p className={`mt-3 text-sm ${available > 0 ? "text-[var(--success)]" : "text-[var(--error)]"}`}>{available > 0 ? `${available} available · dispatches in ${product.vendor.processingDays ?? 3} business days` : "Currently unavailable"}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Button disabled={!variant || available < quantity || add.isPending} onClick={() => add.mutate()}>{add.isPending ? "Adding…" : "Add to bag"}</Button>
            <Button variant="olive" disabled={!variant || available < quantity || buyNow.isPending} onClick={() => buyNow.mutate()}>{buyNow.isPending ? "Preparing…" : "Buy now"}</Button>
            <Button variant="secondary" aria-label="Save to wishlist" disabled={wish.isPending} onClick={() => wish.mutate()}><Heart /></Button>
          </div>
          <div className="mt-7 grid gap-4 text-sm">
            <p className="flex gap-3"><Truck size={19} /> Delivery and seller-specific shipping calculated at checkout</p>
            <p className="flex gap-3"><ShieldCheck size={19} /> Secure provider payments and a verified seller</p>
          </div>
        </div>
      </div>

      <section className="mt-24 grid gap-10 border-t border-[var(--border)] pt-12 lg:grid-cols-2">
        <div><p className="eyebrow">Details</p><h2 className="mt-3 font-editorial text-4xl">Materials & specifications</h2>{specifications.length ? <dl className="mt-7 divide-y divide-[var(--border)]">{specifications.map(([label, value]) => <div className="grid grid-cols-2 gap-4 py-3" key={label}><dt className="text-sm text-[var(--muted)]">{label.replaceAll("_", " ")}</dt><dd className="text-sm font-semibold">{value}</dd></div>)}</dl> : <p className="mt-4 text-[var(--muted)]">No additional specifications supplied.</p>}</div>
        <div><p className="eyebrow">Seller care</p><h2 className="mt-3 font-editorial text-4xl">Made and fulfilled by {product.vendor.storeName}</h2><p className="mt-5 leading-7 text-[var(--muted)]">{product.vendor.returnPolicy ?? "Eligible unused items can be submitted for review through your order page within the configured return window."}</p><Link className="btn btn-secondary mt-6" to={`/vendor/${product.vendor.slug}`}>Visit maker storefront</Link></div>
      </section>

      <section className="mt-24 border-t border-[var(--border)] pt-12">
        <h2 className="font-editorial text-4xl">Customer notes</h2>
        {product.reviews.length ? <div className="mt-8 grid gap-4 md:grid-cols-2">{product.reviews.map((review) => <article key={review.id} className="card p-5"><p className="font-bold">{review.title || `${review.rating}/5 rating`}</p><p className="mt-2 text-sm text-[var(--muted)]">{review.body}</p><p className="mt-4 text-xs">{review.user.name} · verified purchase · {review.rating}/5</p></article>)}</div> : <Empty title="No published reviews yet" description="Verified customers can review this item after delivery." />}
      </section>

      <section className="mt-24">
        <SectionTitle eyebrow="Continue exploring" title="Related pieces" />
        {related.isLoading ? <Loading /> : related.data?.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">{related.data.slice(0, 4).map((item, index) => <ProductCard key={item.id} product={item} index={index} />)}</div> : <Empty title="No related pieces yet" />}
      </section>
    </div>
  );
}
