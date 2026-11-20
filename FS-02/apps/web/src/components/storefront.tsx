import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Cart, Category } from "../lib/types";
import { useUiStore } from "../lib/ui-store";
import { CartDrawer } from "./cart-drawer";
import { Button } from "./ui";

type Suggestions = {
  products: Array<{ name: string; slug: string; vendor: { storeName: string }; category: { name: string } }>;
  vendors: Array<{ storeName: string; slug: string }>;
  categories: Array<{ name: string; slug: string }>;
};

function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const suggestions = useQuery({
    queryKey: ["suggestions", debounced],
    queryFn: () => api<Suggestions>(`/search/suggestions?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!search.trim()) return;
    navigate(`/search?q=${encodeURIComponent(search.trim())}&sort=relevance`);
    setFocused(false);
    onNavigate?.();
  }

  const isEmpty =
    suggestions.data &&
    suggestions.data.products.length === 0 &&
    suggestions.data.vendors.length === 0 &&
    suggestions.data.categories.length === 0;

  return (
    <form onSubmit={submit} className="relative w-full" role="search">
      <label className="relative block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
        <input
          className="input pl-10"
          aria-label="Search marketplace"
          placeholder="Search objects, makers, materials"
          value={search}
          onFocus={() => setFocused(true)}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && setFocused(false)}
        />
      </label>
      {focused && debounced.length >= 2 && (
        <div className="absolute left-0 right-0 top-[calc(100%+.4rem)] z-[90] max-h-[65vh] overflow-auto rounded-[8px] border border-[var(--border)] bg-[var(--ivory)] p-3 shadow-xl">
          {suggestions.isLoading ? (
            <p className="p-3 text-sm text-[var(--muted)]">Searching…</p>
          ) : (
            <>
              {suggestions.data?.products.map((product) => (
                <Link
                  onClick={() => {
                    setFocused(false);
                    onNavigate?.();
                  }}
                  className="block rounded-[5px] p-3 hover:bg-[var(--canvas)]"
                  to={`/product/${product.slug}`}
                  key={product.slug}
                >
                  <strong className="text-sm">{product.name}</strong>
                  <span className="ml-2 text-xs text-[var(--muted)]">
                    {product.vendor.storeName} · {product.category.name}
                  </span>
                </Link>
              ))}
              {suggestions.data?.vendors.map((vendor) => (
                <Link
                  onClick={() => onNavigate?.()}
                  className="block rounded-[5px] p-3 text-sm hover:bg-[var(--canvas)]"
                  to={`/vendor/${vendor.slug}`}
                  key={vendor.slug}
                >
                  Maker: <strong>{vendor.storeName}</strong>
                </Link>
              ))}
              {suggestions.data?.categories.map((category) => (
                <Link
                  onClick={() => onNavigate?.()}
                  className="block rounded-[5px] p-3 text-sm hover:bg-[var(--canvas)]"
                  to={`/category/${category.slug}`}
                  key={category.slug}
                >
                  Category: <strong>{category.name}</strong>
                </Link>
              ))}
              {isEmpty && <p className="p-3 text-sm text-[var(--muted)]">No suggestions yet. Press Enter for full search.</p>}
            </>
          )}
        </div>
      )}
    </form>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const openCart = useUiStore((state) => state.openCart);
  const { user } = useAuth();
  const cart = useQuery({ queryKey: ["cart"], queryFn: () => api<Cart>("/cart"), enabled: Boolean(user) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories"), staleTime: 60_000 });
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: () => api<Array<{ readAt: string | null }>>("/notifications"), enabled: Boolean(user), staleTime: 30_000 });
  const cartCount = cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const unread = notifications.data?.filter((item) => !item.readAt).length ?? 0;
  const accountPath = user?.roles.includes("ADMIN") ? "/admin" : user?.roles.includes("VENDOR") ? "/vendor-portal" : user ? "/account" : "/login";

  return (
    <>
      <div className="bg-[var(--charcoal)] px-4 py-2 text-center text-xs font-semibold tracking-wide text-[var(--ivory)]">
        Complimentary delivery over ₹2,500 · Thoughtfully sourced across India
      </div>
      <header className="glass sticky top-0 z-50">
        <div className="container-shell flex h-18 items-center gap-5">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <Link to="/" className="font-editorial text-3xl tracking-tight">AUREVA</Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold lg:flex" aria-label="Primary navigation">
            <div className="group relative py-6">
              <NavLink to="/products">Shop</NavLink>
              <div className="invisible absolute left-0 top-full w-[560px] translate-y-2 border border-[var(--border)] bg-[var(--ivory)] p-6 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <p className="eyebrow mb-4">Explore categories</p>
                <div className="grid grid-cols-2 gap-2">
                  {categories.data?.map((category) => (
                    <Link className="rounded-[5px] p-3 hover:bg-[var(--canvas)]" to={`/category/${category.slug}`} key={category.id}>
                      <strong>{category.name}</strong>
                      <span className="mt-1 block text-xs text-[var(--muted)]">{category._count.products} pieces</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <NavLink to="/new">New arrivals</NavLink>
            <NavLink to="/deals">Offers</NavLink>
            <NavLink to="/collections">Collections</NavLink>
            <NavLink to="/vendors">Makers</NavLink>
          </nav>
          <div className="ml-auto hidden max-w-md flex-1 md:block"><SearchBox /></div>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button className="p-2 md:hidden" onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={20} /></button>
            <Link className="p-2" to="/wishlist" aria-label="Wishlist"><Heart size={20} /></Link>
            {user && (
              <Link className="relative p-2" to="/notifications" aria-label={`${unread} unread notifications`}>
                <Bell size={20} />
                {unread > 0 && <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-[var(--copper)] text-[10px] text-white">{unread}</span>}
              </Link>
            )}
            <button className="relative p-2" onClick={() => user ? openCart() : navigate("/login")} aria-label={`Open cart with ${cartCount} items`}>
              <ShoppingBag size={20} />
              {cartCount > 0 && <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-[var(--olive)] text-[10px] text-white">{cartCount}</span>}
            </button>
            <Link className="p-2" to={accountPath} aria-label="Account"><UserRound size={20} /></Link>
          </div>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[80] bg-black/25 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.aside className="h-full w-[min(88vw,360px)] overflow-y-auto bg-[var(--ivory)] p-6" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} onClick={(event) => event.stopPropagation()}>
              <div className="mb-8 flex items-center justify-between"><span className="font-editorial text-3xl">AUREVA</span><button onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div>
              <SearchBox onNavigate={() => setOpen(false)} />
              <nav className="mt-8 grid gap-5 text-xl" aria-label="Mobile navigation">
                {([["Shop all", "/products"], ["New arrivals", "/new"], ["Offers", "/deals"], ["Collections", "/collections"], ["Makers", "/vendors"]] satisfies Array<[string, string]>).map(([label, to]) => <Link key={to} to={to} onClick={() => setOpen(false)}>{label}</Link>)}
              </nav>
              <Link className="btn btn-primary mt-10 w-full" to={accountPath} onClick={() => setOpen(false)}>{user ? "Your account" : "Sign in"}</Link>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {searchOpen && (
          <motion.div className="fixed inset-0 z-[100] bg-[var(--ivory)] p-5" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="mx-auto flex max-w-2xl items-center gap-3"><SearchBox onNavigate={() => setSearchOpen(false)} /><button onClick={() => setSearchOpen(false)} aria-label="Close search"><X /></button></div>
          </motion.div>
        )}
      </AnimatePresence>
      {user && <CartDrawer />}
    </>
  );
}

export function Footer() {
  const [email, setEmail] = useState("");
  const subscribe = useMutation({
    mutationFn: () => post("/newsletter", { email }),
    onSuccess: () => {
      setEmail("");
      toast.success("You’re on the AUREVA list");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <footer className="mt-24 bg-[var(--charcoal)] text-[var(--ivory)]">
      <div className="container-shell grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <p className="font-editorial text-4xl">AUREVA</p>
          <p className="mt-4 max-w-sm text-sm text-white/65">A considered marketplace for objects with provenance, purpose, and enduring character.</p>
          <form className="mt-6 flex max-w-sm gap-2" onSubmit={(event) => { event.preventDefault(); subscribe.mutate(); }}>
            <input className="input border-white/20 bg-white/10 text-white placeholder:text-white/50" aria-label="Newsletter email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email for occasional notes" />
            <Button variant="olive" disabled={subscribe.isPending}>Join</Button>
          </form>
        </div>
        <FooterLinks title="Discover" links={[["Shop all", "/products"], ["New arrivals", "/new"], ["Makers", "/vendors"], ["Collections", "/collections"]]} />
        <FooterLinks title="Care" links={[["Contact", "/contact"], ["FAQ", "/faq"], ["Shipping", "/shipping"], ["Returns", "/returns-policy"]]} />
        <FooterLinks title="Company" links={[["About", "/about"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Sell with us", "/vendor-portal/onboarding"]]} />
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/65">© {new Date().getFullYear()} AUREVA. Development marketplace.</div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: Array<[string, string]> }) {
  return <div><p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/65">{title}</p><div className="grid gap-3 text-sm">{links.map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}</div></div>;
}

export function StoreLayout() {
  return <div className="min-h-screen"><Header /><main><Outlet /></main><Footer /></div>;
}
