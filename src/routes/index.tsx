import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bot, Clock, MapPin, ShieldCheck, Star, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-market.jpg";
import { categoriesQuery, productsQuery, shopsQuery } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useStore } from "@/lib/store";
import { discountPct, distanceKm } from "@/lib/market";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LocalLoop — Shop from stores in your neighbourhood" },
      { name: "description", content: "Discover nearby shops, compare prices, check stock and get same-day delivery or pickup with LocalLoop." },
      { property: "og:title", content: "LocalLoop — Shop from stores in your neighbourhood" },
      { property: "og:description", content: "Nearby shops, real stock, same-day delivery or pickup." },
    ],
  }),
  component: Home,
});

function Section({ title, to, children }: { title: string; to?: "/products" | "/shops"; children: React.ReactNode }) {
  return (
    <section className="mx-auto mt-12 max-w-7xl px-4">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        {to && <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">See all <ArrowRight className="h-4 w-4" /></Link>}
      </div>
      {children}
    </section>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
);

function Home() {
  const { location } = useStore();
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: shops = [] } = useQuery(shopsQuery);

  const nearShops = [...shops]
    .map((s) => ({ ...s, d: distanceKm(location, s) ?? 99 }))
    .sort((a, b) => a.d - b.d);
  const trending = [...products].sort((a, b) => b.sold_count - a.sold_count).slice(0, 5);
  const deals = [...products].sort((a, b) => discountPct(b.price, b.mrp) - discountPct(a.price, a.mrp)).slice(0, 5);
  const fresh = [...products].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const recommended = [...products]
    .filter((p) => p.stock > 0)
    .map((p) => ({ p, score: Number(p.rating) * 2 - (distanceKm(location, p.shop ?? {}) ?? 10) * 0.5 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.p);

  return (
    <div className="pb-8">
      <section className="relative mx-auto mt-4 max-w-7xl overflow-hidden px-4">
        <div className="relative overflow-hidden rounded-3xl">
          <img src={heroImg} alt="A neighbourhood kirana store at golden hour" width={1600} height={912} className="h-[420px] w-full object-cover sm:h-[480px]" />
          <div className="absolute inset-0 bg-hero-overlay" />
          <div className="absolute inset-0 flex flex-col justify-center gap-4 p-6 text-secondary-foreground sm:p-12">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1 text-xs font-bold text-primary-foreground">
              <MapPin className="h-3.5 w-3.5" /> Delivering in {location.name}
            </span>
            <h1 className="max-w-xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">Your street's shops, one tap away.</h1>
            <p className="max-w-md text-base opacity-90 sm:text-lg">Real stock from real stores near you. Same-day delivery or quick pickup — and every rupee stays in the neighbourhood.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg"><Link to="/products">Start shopping</Link></Button>
              <Button asChild size="lg" variant="outline" className="border-secondary-foreground/40 bg-transparent text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground">
                <Link to="/assistant"><Bot className="h-4 w-4" /> Ask the AI assistant</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs sm:text-sm">
          {[{ i: Clock, t: "Delivered in under 2 hrs" }, { i: Store, t: `${shops.length} verified local stores` }, { i: ShieldCheck, t: "Pay on delivery available" }].map(({ i: I, t }) => (
            <div key={t} className="flex items-center gap-2 rounded-xl bg-muted p-3"><I className="h-4 w-4 shrink-0 text-primary" />{t}</div>
          ))}
        </div>
      </section>

      <Section title="Popular categories">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-11">
          {cats.map((c) => (
            <Link key={c.id} to="/products" search={{ category: c.slug }} className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-3 text-center text-xs font-medium shadow-soft transition hover:-translate-y-0.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent"><CategoryIcon name={c.icon} className="h-6 w-6 text-accent-foreground" /></span>
              <span className="line-clamp-2">{c.name}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Shops near you" to="/shops">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {nearShops.map((s) => (
            <Link key={s.id} to="/shops/$id" params={{ id: s.id }} className="w-64 shrink-0 rounded-2xl border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><CategoryIcon name={s.category?.icon} className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.area} · {s.d.toFixed(1)} km</div>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
              <div className="mt-2 flex items-center gap-1 text-xs"><Star className="h-3 w-3 fill-primary text-primary" /> {Number(s.rating).toFixed(1)}</div>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Trending nearby" to="/products"><Grid>{trending.map((p) => <ProductCard key={p.id} p={p} />)}</Grid></Section>
      <Section title="Recommended for you"><Grid>{recommended.map((p) => <ProductCard key={p.id} p={p} />)}</Grid></Section>
      <Section title="Best deals" to="/products"><Grid>{deals.map((p) => <ProductCard key={p.id} p={p} />)}</Grid></Section>
      <Section title="Recently added"><Grid>{fresh.map((p) => <ProductCard key={p.id} p={p} />)}</Grid></Section>

      <Section title="What neighbours say">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { n: "Divya R., Adyar", t: "Vegetables from Green Basket arrived in 40 minutes, fresher than the supermarket." },
            { n: "Karthik S., T. Nagar", t: "I check if Annapoorna has stock before walking over. Saves me trips every week." },
            { n: "Meena P., Mylapore", t: "Ordered a cake for my son's birthday at 5pm, picked it up at 6. Lovely." },
          ].map((r) => (
            <figure key={r.n} className="rounded-2xl bg-accent p-5">
              <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-primary text-primary" />)}</div>
              <blockquote className="mt-2 text-accent-foreground">"{r.t}"</blockquote>
              <figcaption className="mt-3 text-sm font-semibold">{r.n}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <section className="mx-auto mt-12 max-w-7xl px-4">
        <div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-secondary p-8 text-secondary-foreground sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Own a shop? Bring it online in 10 minutes.</h2>
            <p className="mt-1 opacity-80">Manage stock, accept orders and see what sells — with an AI assistant built in.</p>
          </div>
          <Button asChild size="lg"><Link to="/shop">Register your shop</Link></Button>
        </div>
      </section>
    </div>
  );
}
