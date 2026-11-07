import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Bot, Heart, LayoutDashboard, LocateFixed, LogOut, MapPin, Package, Search, Shield, ShoppingCart, Store, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { AREAS } from "@/lib/market";
import { supabase } from "@/integrations/supabase/client";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warm font-display text-lg font-extrabold text-primary-foreground shadow-soft">
        L
      </span>
      <span className="font-display text-xl font-extrabold tracking-tight">
        Local<span className="text-primary">Loop</span>
      </span>
    </Link>
  );
}

function LocationPicker() {
  const { location, setLocation } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Deliver to</span>
          <span className="font-semibold">{location.name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            if (!navigator.geolocation) { toast.error("Location not supported on this device"); return; }
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setLocation({ name: "Current location", lat: pos.coords.latitude, lng: pos.coords.longitude });
                setOpen(false);
              },
              () => toast.error("Location permission denied — pick an area instead"),
            );
          }}
        >
          <LocateFixed className="h-4 w-4" /> Use my current location
        </Button>
        <div className="my-1 border-t" />
        {AREAS.map((a) => (
          <Button key={a.name} variant="ghost" className="w-full justify-start" onClick={() => { setLocation(a); setOpen(false); }}>
            {a.name}, Chennai
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function NotificationBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  useEffect(() => {
    const ch = supabase
      .channel(`notif-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (p) => {
        toast((p.new as { title: string }).title, { description: (p.new as { body: string }).body });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);
  const unread = data.filter((n) => !n.read).length;
  return (
    <Popover onOpenChange={async (o) => {
      if (!o && unread) { await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false); qc.invalidateQueries({ queryKey: ["notifications"] }); }
    }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-2 font-semibold">Notifications</div>
        <div className="max-h-80 overflow-auto">
          {data.length === 0 && <p className="p-4 text-sm text-muted-foreground">You're all caught up.</p>}
          {data.map((n) => (
            <a key={n.id} href={n.link ?? "#"} className={`block border-b px-4 py-2 text-sm ${n.read ? "" : "bg-accent/50"}`}>
              <div className="font-medium">{n.title}</div>
              <div className="text-muted-foreground">{n.body}</div>
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SiteHeader() {
  const { user, hasRole, signOut } = useAuth();
  const { count } = useStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/products", search: { q: q || undefined } });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Logo />
        <div className="hidden md:block"><LocationPicker /></div>
        <form onSubmit={search} className="relative ml-auto hidden max-w-md flex-1 sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rice, chargers, cakes…" className="rounded-full pl-9" />
        </form>
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <Button asChild variant="ghost" size="icon" aria-label="AI assistant"><Link to="/assistant"><Bot className="h-5 w-5" /></Link></Button>
          <Button asChild variant="ghost" size="icon" aria-label="Wishlist"><Link to="/account" search={{ tab: "wishlist" }}><Heart className="h-5 w-5" /></Link></Button>
          <Button asChild variant="ghost" size="icon" className="relative" aria-label="Cart">
            <Link to="/cart">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{count}</span>}
            </Link>
          </Button>
          {user && <NotificationBell userId={user.id} />}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full" aria-label="Account"><User className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/account"><User className="h-4 w-4" /> My account</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/orders"><Package className="h-4 w-4" /> My orders</Link></DropdownMenuItem>
                {hasRole("shop_owner") && <DropdownMenuItem asChild><Link to="/shop"><Store className="h-4 w-4" /> Shop dashboard</Link></DropdownMenuItem>}
                {hasRole("admin") && <DropdownMenuItem asChild><Link to="/admin"><Shield className="h-4 w-4" /> Admin panel</Link></DropdownMenuItem>}
                {!hasRole("shop_owner") && <DropdownMenuItem asChild><Link to="/shop"><LayoutDashboard className="h-4 w-4" /> Sell on LocalLoop</Link></DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await qc.cancelQueries(); qc.clear(); await signOut(); navigate({ to: "/", replace: true }); }}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3 md:hidden">
        <LocationPicker />
      </div>
      <form onSubmit={search} className="relative px-4 pb-3 sm:hidden">
        <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-[70%] text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search nearby products" className="rounded-full pl-9" />
      </form>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-secondary text-secondary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="font-display text-2xl font-extrabold">Local<span className="text-primary">Loop</span></div>
          <p className="mt-2 max-w-sm text-sm opacity-80">Your neighbourhood shops, online. Order from stores within a few kilometres and get it delivered the same day — or pick it up on your way home.</p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="font-semibold">Shop</div>
          <Link to="/products" className="block opacity-80 hover:opacity-100">All products</Link>
          <Link to="/shops" className="block opacity-80 hover:opacity-100">Nearby stores</Link>
          <Link to="/assistant" className="block opacity-80 hover:opacity-100">AI shopping assistant</Link>
        </div>
        <div className="space-y-2 text-sm">
          <div className="font-semibold">Business</div>
          <Link to="/shop" className="block opacity-80 hover:opacity-100">Sell on LocalLoop</Link>
          <Link to="/orders" className="block opacity-80 hover:opacity-100">Track an order</Link>
          <Link to="/account" search={{ tab: "help" }} className="block opacity-80 hover:opacity-100">Help & complaints</Link>
        </div>
      </div>
    </footer>
  );
}
