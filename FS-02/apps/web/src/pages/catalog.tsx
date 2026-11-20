import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid2X2, List, SlidersHorizontal, X } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { formatMoney } from "@aureva/shared";
import { ProductCard } from "../components/product";
import { Button, Empty, ErrorState, Loading } from "../components/ui";
import { api, apiWithMeta } from "../lib/api";
import type { Category, Product } from "../lib/types";

type VendorOption = { id: string; storeName: string; slug: string };
type BrandOption = { id: string; name: string; slug: string };

export default function Catalog({ mode = "all" }: { mode?: "all" | "new" | "deals" }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const requestQuery = useMemo(() => {
    const value = new URLSearchParams(params);
    if (slug) value.set("category", slug);
    if (mode === "new") value.set("sort", "newest");
    if (mode === "deals") value.set("deals", "true");
    for (const key of ["minPrice", "maxPrice"]) {
      const raw = value.get(key);
      if (raw) value.set(key, String(Math.round(Number(raw) * 100)));
    }
    return value.toString();
  }, [params, slug, mode]);

  const products = useQuery({ queryKey: ["products", requestQuery], queryFn: () => apiWithMeta<Product[]>(`/products?${requestQuery}`) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });
  const vendors = useQuery({ queryKey: ["vendors"], queryFn: () => api<VendorOption[]>("/vendors") });
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => api<BrandOption[]>("/brands") });
  const categoryOptions = categories.data?.flatMap((category) => [category, ...category.children]) ?? [];
  const activeCategory = categoryOptions.find((category) => category.slug === slug);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    setParams(next);
  }

  function updateCategory(value: string) {
    const next = new URLSearchParams(params);
    next.delete("category");
    next.delete("page");
    navigate({ pathname: value ? `/category/${value}` : "/products", search: next.toString() });
    setFilters(false);
  }

  function clear() {
    if (slug) navigate("/products"); else setParams(new URLSearchParams());
    setFilters(false);
  }

  const page = Number(params.get("page") ?? 1);
  const pages = Number(products.data?.meta.pages ?? 1);
  const title = activeCategory?.name ?? (mode === "new" ? "New arrivals" : mode === "deals" ? "Considered offers" : params.get("q") ? `Results for “${params.get("q")}”` : "Shop all");

  return <section className="container-shell py-12">
    <div className="mb-10 flex items-end justify-between gap-6"><div><p className="eyebrow">Curated marketplace</p><h1 className="mt-2 font-editorial text-5xl sm:text-7xl">{title}</h1><p className="mt-3 text-[var(--muted)]">Objects selected for material integrity and lasting usefulness.</p></div><button className="btn btn-secondary lg:hidden" onClick={() => setFilters(true)}><SlidersHorizontal size={17} />Filters</button></div>
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside className={`${filters ? "fixed inset-0 z-[70] overflow-y-auto bg-[var(--ivory)] p-6" : "hidden"} space-y-7 lg:static lg:block lg:bg-transparent lg:p-0`} aria-label="Product filters">
        <div className="flex items-center justify-between lg:hidden"><strong>Filters</strong><button onClick={() => setFilters(false)} aria-label="Close filters"><X /></button></div>
        <Filter title="Category"><select aria-label="Category" className="input" value={slug ?? params.get("category") ?? ""} onChange={(event) => updateCategory(event.target.value)}><option value="">All categories</option>{categoryOptions.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}</select></Filter>
        <Filter title="Maker"><select aria-label="Maker" className="input" value={params.get("vendor") ?? ""} onChange={(event) => update("vendor", event.target.value)}><option value="">All makers</option>{vendors.data?.map((vendor) => <option key={vendor.id} value={vendor.slug}>{vendor.storeName}</option>)}</select></Filter>
        {Boolean(brands.data?.length) && <Filter title="Brand"><select aria-label="Brand" className="input" value={params.get("brand") ?? ""} onChange={(event) => update("brand", event.target.value)}><option value="">All brands</option>{brands.data?.map((brand) => <option key={brand.id} value={brand.slug}>{brand.name}</option>)}</select></Filter>}
        <Filter title="Price (₹)"><div className="grid grid-cols-2 gap-2"><input aria-label="Minimum price" className="input" type="number" min="0" placeholder="Min" value={params.get("minPrice") ?? ""} onChange={(event) => update("minPrice", event.target.value)} /><input aria-label="Maximum price" className="input" type="number" min="0" placeholder="Max" value={params.get("maxPrice") ?? ""} onChange={(event) => update("maxPrice", event.target.value)} /></div></Filter>
        <Filter title="Minimum rating"><select aria-label="Minimum rating" className="input" value={params.get("rating") ?? ""} onChange={(event) => update("rating", event.target.value)}><option value="">Any rating</option>{[4, 3, 2, 1].map((value) => <option value={value} key={value}>{value}+ stars</option>)}</select></Filter>
        <Filter title="Availability"><label className="flex gap-2 text-sm"><input type="checkbox" checked={params.get("inStock") === "true"} onChange={(event) => update("inStock", event.target.checked ? "true" : "")} />In stock only</label></Filter>
        <Button className="w-full" variant="secondary" onClick={clear}>Clear filters</Button>
      </aside>
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-[var(--muted)]">{Number(products.data?.meta.total ?? 0)} pieces</span><div className="flex items-center gap-2"><button className={`p-2 ${view === "grid" ? "bg-[var(--surface)]" : ""}`} onClick={() => setView("grid")} aria-label="Grid view"><Grid2X2 size={18} /></button><button className={`p-2 ${view === "list" ? "bg-[var(--surface)]" : ""}`} onClick={() => setView("list")} aria-label="List view"><List size={18} /></button><select aria-label="Sort products" className="input max-w-52" value={params.get("sort") ?? (params.get("q") ? "relevance" : "newest")} onChange={(event) => update("sort", event.target.value)}>{params.get("q") && <option value="relevance">Relevance</option>}<option value="newest">Newest</option><option value="popular">Most popular</option><option value="rating">Top rated</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></div></div>
        {products.isLoading ? <Loading /> : products.isError ? <ErrorState message={(products.error as Error).message} /> : products.data?.data.length ? view === "grid" ? <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">{products.data.data.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <div className="grid gap-3">{products.data.data.map((product) => <article className="card grid grid-cols-[90px_1fr] gap-4 p-3 sm:grid-cols-[110px_1fr_auto]" key={product.id}><img className="aspect-square size-full rounded-[5px] object-cover" src={product.images[0]?.url} alt={product.name} loading="lazy" /><div><p className="text-xs uppercase text-[var(--muted)]">{product.vendor.storeName}</p><h2 className="mt-1 font-bold">{product.name}</h2><p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{product.description}</p></div><strong className="col-span-2 px-1 sm:col-span-1 sm:p-3">{formatMoney(product.variants[0]?.price ?? 0)}</strong></article>)}</div> : <Empty title="No pieces match" description="Try clearing or adjusting your filters." />}
        {pages > 1 && <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination"><Button variant="secondary" disabled={page <= 1} onClick={() => update("page", String(page - 1))}>Previous</Button><span className="px-3 text-sm">Page {page} of {pages}</span><Button variant="secondary" disabled={page >= pages} onClick={() => update("page", String(page + 1))}>Next</Button></nav>}
      </div>
    </div>
  </section>;
}

function Filter({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset><legend className="mb-3 text-xs font-bold uppercase tracking-widest">{title}</legend>{children}</fieldset>;
}
