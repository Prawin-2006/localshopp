import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AREAS } from "./market";

export interface CartItem {
  product_id: string;
  shop_id: string;
  shop_name: string;
  name: string;
  price: number;
  unit?: string | null;
  quantity: number;
  stock: number;
}
type Loc = { name: string; lat: number; lng: number };

interface StoreState {
  cart: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (product_id: string, qty: number) => void;
  remove: (product_id: string) => void;
  clearShop: (shop_id: string) => void;
  count: number;
  location: Loc;
  setLocation: (l: Loc) => void;
}

const Ctx = createContext<StoreState | null>(null);
const CART_KEY = "localloop.cart";
const LOC_KEY = "localloop.location";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [location, setLoc] = useState<Loc>(AREAS[0]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem(CART_KEY);
      if (c) setCart(JSON.parse(c));
      const l = localStorage.getItem(LOC_KEY);
      if (l) setLoc(JSON.parse(l));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, ready]);

  const value: StoreState = {
    cart,
    count: cart.reduce((a, b) => a + b.quantity, 0),
    add: (item, qty = 1) =>
      setCart((c) => {
        const ex = c.find((i) => i.product_id === item.product_id);
        if (ex) return c.map((i) => (i === ex ? { ...i, quantity: Math.min(i.stock, i.quantity + qty) } : i));
        return [...c, { ...item, quantity: Math.min(item.stock, qty) }];
      }),
    setQty: (id, qty) =>
      setCart((c) =>
        c.flatMap((i) => (i.product_id !== id ? [i] : qty <= 0 ? [] : [{ ...i, quantity: Math.min(i.stock, qty) }])),
      ),
    remove: (id) => setCart((c) => c.filter((i) => i.product_id !== id)),
    clearShop: (sid) => setCart((c) => c.filter((i) => i.shop_id !== sid)),
    location,
    setLocation: (l) => {
      setLoc(l);
      localStorage.setItem(LOC_KEY, JSON.stringify(l));
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}
