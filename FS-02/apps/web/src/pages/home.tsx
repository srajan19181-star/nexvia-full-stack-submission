import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Award, Leaf, PackageCheck, ShieldCheck } from "lucide-react";
import { motion, useScroll, useSpring } from "motion/react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ProductCard } from "../components/product";
import { Empty, Loading, SectionTitle } from "../components/ui";
import { api } from "../lib/api";
import type { Category, Product } from "../lib/types";

type Vendor = { id: string; storeName: string; slug: string; description: string; logoUrl?: string | null; bannerUrl?: string | null; _count: { products: number } };
const trustItems = [{ Icon: Leaf, label: "Considered materials" }, { Icon: PackageCheck, label: "Careful delivery" }, { Icon: ShieldCheck, label: "Secure checkout" }, { Icon: Award, label: "Verified makers" }];

export default function Home() {
  const hero = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 180, damping: 30, mass: 0.2 });
  const newProducts = useQuery({ queryKey: ["products", "home-new"], queryFn: () => api<Product[]>("/products?limit=4&sort=newest") });
  const trending = useQuery({ queryKey: ["products", "home-popular"], queryFn: () => api<Product[]>("/products?limit=4&sort=popular") });
  const topRated = useQuery({ queryKey: ["products", "home-rated"], queryFn: () => api<Product[]>("/products?limit=4&sort=rating") });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });
  const vendors = useQuery({ queryKey: ["vendors", "featured"], queryFn: () => api<Vendor[]>("/vendors") });

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      gsap.from("[data-hero-word]", { y: 70, opacity: 0, duration: 1, stagger: 0.1, ease: "power3.out" });
      gsap.from("[data-hero-media]", { clipPath: "inset(100% 0 0 0)", duration: 1.3, ease: "power3.inOut" });
      gsap.to("[data-hero-media] img", { scale: 1.08, scrollTrigger: { trigger: hero.current, start: "top top", end: "bottom top", scrub: true } });
    }, hero);
    return () => context.revert();
  }, []);

  return <>
    <motion.div className="fixed left-0 top-0 z-[120] h-[3px] w-full origin-left bg-[var(--copper)]" style={{ scaleX: progress }} aria-hidden="true" />
    <section ref={hero} className="container-shell grid min-h-[calc(100vh-110px)] items-center gap-10 py-12 lg:grid-cols-[.9fr_1.1fr]">
      <div className="relative z-10"><p className="eyebrow mb-5">The autumn edit · 2026</p><h1 className="font-editorial text-[clamp(4rem,9vw,8.5rem)] leading-[.78] tracking-[-.055em]"><span data-hero-word className="block">Objects</span><span data-hero-word className="block italic text-[var(--olive)]">worth</span><span data-hero-word className="block">keeping.</span></h1><p className="mt-8 max-w-lg text-lg leading-8 text-[var(--muted)]">A curated marketplace connecting discerning homes with independent makers and enduring design.</p><div className="mt-8 flex flex-wrap gap-3"><Link className="btn btn-primary" to="/products">Explore the collection <ArrowRight size={17} /></Link><Link className="btn btn-secondary" to="/vendors">Meet the makers</Link></div></div>
      <div data-hero-media className="relative h-[58vh] min-h-[460px] overflow-hidden rounded-[6px]"><img className="size-full object-cover" src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=88" srcSet="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=720&q=82 720w, https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=88 1400w" sizes="(min-width: 1024px) 55vw, 100vw" alt="Warm contemporary living room" fetchPriority="high" /><div className="glass absolute bottom-5 left-5 max-w-xs p-4"><p className="text-xs font-bold uppercase tracking-widest text-[var(--olive)]">Maker spotlight</p><p className="mt-2 font-editorial text-2xl">Form, function, and the human hand.</p></div></div>
    </section>
    <section className="border-y border-[var(--border)] bg-[var(--ivory)] py-7"><div className="container-shell grid grid-cols-2 gap-6 md:grid-cols-4">{trustItems.map(({ Icon, label }) => <div key={label} className="flex items-center gap-3 text-sm font-semibold"><Icon size={20} className="text-[var(--olive)]" />{label}</div>)}</div></section>
    <section className="container-shell py-24"><SectionTitle eyebrow="Browse with intention" title="Shop by category" description="Collections assembled around material, utility, and the rituals of daily life." />{categories.isLoading ? <Loading /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{categories.data?.slice(0, 4).map((category, index) => <motion.div key={category.id} whileHover={{ y: -4 }}><Link to={`/category/${category.slug}`} className="card block p-6"><span className="font-editorial text-3xl">0{index + 1}</span><h3 className="mt-12 text-lg font-bold">{category.name}</h3><p className="mt-2 text-sm text-[var(--muted)]">{category._count.products} considered pieces</p></Link></motion.div>)}</div>}</section>
    <section className="dark-section bg-[var(--charcoal)] py-24 text-[var(--ivory)]"><div className="container-shell"><SectionTitle eyebrow="Editorial collections" title="Material stories" description="Explore living collections shaped around craft, atmosphere, and use." /><div className="grid gap-5 lg:grid-cols-2">{categories.data?.slice(0, 2).map((category, index) => <Link className="group relative min-h-[420px] overflow-hidden rounded-[6px]" to={`/category/${category.slug}`} key={category.id}><img className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105" src={category.imageUrl} alt="" loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-7"><p className="text-xs font-bold uppercase tracking-widest text-white/80">Collection 0{index + 1}</p><h3 className="mt-2 font-editorial text-5xl text-white">{category.name}</h3><p className="mt-2 text-sm text-white/80">{category.description}</p></div></Link>)}</div></div></section>
    <ProductSection eyebrow="Most considered" title="Trending now" query={trending} action="/products?sort=popular" />
    <section className="container-shell py-10"><Link to="/deals" className="grid min-h-64 items-end overflow-hidden rounded-[6px] bg-[var(--olive)] p-8 text-white sm:p-12"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-white">A quieter kind of offer</p><h2 className="mt-3 max-w-3xl font-editorial text-5xl text-white sm:text-7xl">Lasting pieces, considered prices.</h2><span className="btn mt-7 border-white/30 text-white">Explore current offers <ArrowRight size={17} /></span></div></Link></section>
    <ProductSection eyebrow="Freshly considered" title="New to AUREVA" query={newProducts} action="/new" tone="surface" />
    <ProductSection eyebrow="Customer favourites" title="Top rated pieces" query={topRated} action="/products?sort=rating" />
    <section className="bg-[var(--surface)] py-24"><div className="container-shell"><SectionTitle eyebrow="Featured makers" title="Studios with a point of view" action={<Link className="btn btn-secondary" to="/vendors">View all makers</Link>} />{vendors.isLoading ? <Loading /> : vendors.data?.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{vendors.data.slice(0, 3).map((vendor) => <Link className="card p-6" to={`/vendor/${vendor.slug}`} key={vendor.id}><p className="font-editorial text-4xl">{vendor.storeName}</p><p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{vendor.description}</p><p className="mt-8 text-xs font-bold uppercase tracking-widest">{vendor._count.products} pieces · verified maker</p></Link>)}</div> : <Empty title="Makers are being curated" />}</div></section>
    <section className="container-shell grid gap-12 py-24 lg:grid-cols-2 lg:items-center"><img className="aspect-[4/3] size-full rounded-[6px] object-cover" src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85" srcSet="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=640&q=80 640w, https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85 1200w" sizes="(min-width: 1024px) 50vw, 100vw" alt="Artisan studio" loading="lazy" /><div className="lg:px-10"><p className="eyebrow">The AUREVA standard</p><h2 className="mt-4 font-editorial text-5xl sm:text-6xl">Less, but meaningfully better.</h2><p className="mt-6 leading-8 text-[var(--muted)]">We partner with makers who value honest materials, responsible production, and objects designed to grow more personal with time.</p><Link className="btn btn-primary mt-8" to="/about">Our point of view <ArrowRight size={17} /></Link></div></section>
  </>;
}

function ProductSection({ eyebrow, title, query, action, tone }: { eyebrow: string; title: string; query: ReturnType<typeof useQuery<Product[], Error>>; action: string; tone?: "surface" }) {
  return <section className={tone === "surface" ? "bg-[var(--surface)] py-24" : "container-shell py-24"}><div className={tone === "surface" ? "container-shell" : ""}><SectionTitle eyebrow={eyebrow} title={title} action={<Link className="btn btn-secondary" to={action}>View all <ArrowRight size={16} /></Link>} />{query.isLoading ? <Loading /> : query.data?.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">{query.data.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <Empty title="No products to show" />}</div></section>;
}
