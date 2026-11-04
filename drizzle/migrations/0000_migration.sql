create type public.app_role as enum ('admin','shop_owner','customer');
create type public.shop_status as enum ('pending','approved','rejected','suspended');
create type public.order_status as enum ('placed','accepted','preparing','ready','out_for_delivery','delivered','completed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, phone text, city text default 'Chennai',
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null, unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile write" on public.profiles for update to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles(user_id, role) values (new.id, 'customer');
  if new.raw_user_meta_data->>'account_type' = 'shop_owner' then
    insert into public.user_roles(user_id, role) values (new.id, 'shop_owner');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.claim_first_admin() returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.user_roles where role='admin') then return false; end if;
  insert into public.user_roles(user_id, role) values (auth.uid(), 'admin');
  return true;
end $$;
grant execute on function public.claim_first_admin() to authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, slug text not null unique, icon text default 'Package',
  sort int not null default 0
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "cat read" on public.categories for select using (true);
create policy "cat admin" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null, description text, category_id uuid references public.categories(id),
  address text, area text, city text default 'Chennai', phone text, gstin text,
  lat double precision, lng double precision,
  delivery_fee numeric not null default 30, free_delivery_above numeric not null default 499,
  offers_delivery boolean not null default true, offers_pickup boolean not null default true,
  rating numeric not null default 4.5, status shop_status not null default 'pending',
  image_url text, created_at timestamptz not null default now()
);
grant select on public.shops to anon, authenticated;
grant insert, update, delete on public.shops to authenticated;
grant all on public.shops to service_role;
alter table public.shops enable row level security;
create policy "shop public read" on public.shops for select using (status='approved' or owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "shop owner insert" on public.shops for insert to authenticated with check (owner_id = auth.uid() and status='pending' and public.has_role(auth.uid(),'shop_owner'));
create policy "shop owner update" on public.shops for update to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "shop admin delete" on public.shops for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- owners cannot self-approve
create or replace function public.guard_shop_status() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status is distinct from old.status and not public.has_role(auth.uid(),'admin') then
    new.status := old.status;
  end if;
  return new;
end $$;
create trigger shops_guard before update on public.shops for each row execute function public.guard_shop_status();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.categories(id),
  name text not null, description text, brand text, unit text default '1 pc',
  price numeric not null check (price >= 0), mrp numeric not null check (mrp >= 0),
  stock int not null default 0 check (stock >= 0), low_stock_threshold int not null default 5,
  image_url text, rating numeric not null default 4.3, sold_count int not null default 0,
  active boolean not null default true, created_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "prod read" on public.products for select using (
  (active and exists (select 1 from public.shops s where s.id=shop_id and s.status='approved'))
  or exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=auth.uid())
  or public.has_role(auth.uid(),'admin'));
create policy "prod owner write" on public.products for all to authenticated
  using (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=auth.uid()) or public.has_role(auth.uid(),'admin'))
  with check (exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=auth.uid()) or public.has_role(auth.uid(),'admin'));

create table public.addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  label text default 'Home', line1 text not null, area text, city text default 'Chennai', pincode text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.addresses to authenticated;
grant all on public.addresses to service_role;
alter table public.addresses enable row level security;
create policy "own addr" on public.addresses for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null, shop_id uuid not null references public.shops(id),
  status order_status not null default 'placed',
  fulfilment text not null default 'delivery', payment_method text not null default 'cod',
  payment_status text not null default 'pending',
  subtotal numeric not null, delivery_fee numeric not null default 0, discount numeric not null default 0, total numeric not null,
  address_text text, history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "order read" on public.orders for select to authenticated using (
  customer_id=auth.uid() or exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=auth.uid()) or public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null, price numeric not null, quantity int not null check (quantity > 0)
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "item read" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid()
   or exists (select 1 from public.shops s where s.id=o.shop_id and s.owner_id=auth.uid())
   or public.has_role(auth.uid(),'admin'))));

-- atomic order placement; items: [{product_id, quantity}]
create or replace function public.place_order(_shop_id uuid, _items jsonb, _fulfilment text, _payment_method text, _address text, _coupon text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare _uid uuid := auth.uid(); _order uuid; _sub numeric := 0; _fee numeric := 0; _disc numeric := 0;
  _it jsonb; _p record; _shop record;
begin
  if _uid is null then raise exception 'Sign in required'; end if;
  select * into _shop from shops where id=_shop_id and status='approved';
  if not found then raise exception 'Shop not available'; end if;
  insert into orders(customer_id, shop_id, fulfilment, payment_method, subtotal, total, address_text, history)
    values (_uid, _shop_id, _fulfilment, _payment_method, 0, 0, _address,
      jsonb_build_array(jsonb_build_object('status','placed','at',now()))) returning id into _order;
  for _it in select * from jsonb_array_elements(_items) loop
    select * into _p from products where id=(_it->>'product_id')::uuid and shop_id=_shop_id and active for update;
    if not found then raise exception 'Product unavailable'; end if;
    if _p.stock < (_it->>'quantity')::int then raise exception 'Only % left of %', _p.stock, _p.name; end if;
    update products set stock = stock - (_it->>'quantity')::int, sold_count = sold_count + (_it->>'quantity')::int where id=_p.id;
    insert into order_items(order_id, product_id, name, price, quantity) values (_order, _p.id, _p.name, _p.price, (_it->>'quantity')::int);
    _sub := _sub + _p.price * (_it->>'quantity')::int;
  end loop;
  if _fulfilment='delivery' and _sub < _shop.free_delivery_above then _fee := _shop.delivery_fee; end if;
  if upper(coalesce(_coupon,''))='LOOP10' then _disc := least(round(_sub*0.10), 100); end if;
  update orders set subtotal=_sub, delivery_fee=_fee, discount=_disc, total=_sub+_fee-_disc where id=_order;
  if _shop.owner_id is not null then
    insert into notifications(user_id, title, body, link) values (_shop.owner_id, 'New order', 'You received a new order worth ₹'||(_sub+_fee-_disc), '/shop/orders');
  end if;
  return _order;
end $$;

create or replace function public.update_order_status(_order uuid, _status order_status)
returns void language plpgsql security definer set search_path=public as $$
declare _o record; _is_owner boolean; _it record;
begin
  select o.*, s.owner_id into _o from orders o join shops s on s.id=o.shop_id where o.id=_order;
  if not found then raise exception 'Not found'; end if;
  _is_owner := _o.owner_id = auth.uid() or public.has_role(auth.uid(),'admin');
  if _status='cancelled' then
    if not (_is_owner or (_o.customer_id=auth.uid() and _o.status in ('placed','accepted'))) then raise exception 'Cannot cancel at this stage'; end if;
    for _it in select * from order_items where order_id=_order loop
      update products set stock=stock+_it.quantity, sold_count=greatest(0,sold_count-_it.quantity) where id=_it.product_id;
    end loop;
  elsif not _is_owner then raise exception 'Not allowed'; end if;
  if _o.status in ('cancelled','completed') then raise exception 'Order already closed'; end if;
  update orders set status=_status,
    payment_status = case when _status in ('delivered','completed') and payment_method='cod' then 'paid' else payment_status end,
    history = history || jsonb_build_array(jsonb_build_object('status',_status,'at',now())) where id=_order;
  insert into notifications(user_id, title, body, link) values (_o.customer_id, 'Order update', 'Your order is now '||replace(_status::text,'_',' '), '/orders/'||_order);
end $$;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null, author_name text, rating int not null check (rating between 1 and 5), comment text,
  created_at timestamptz not null default now()
);
grant select on public.reviews to anon, authenticated;
grant insert, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "rev read" on public.reviews for select using (true);
create policy "rev write" on public.reviews for insert to authenticated with check (user_id=auth.uid());
create policy "rev del" on public.reviews for delete to authenticated using (user_id=auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.wishlist (
  user_id uuid not null, product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id, product_id)
);
grant select, insert, delete on public.wishlist to authenticated;
grant all on public.wishlist to service_role;
alter table public.wishlist enable row level security;
create policy "own wish" on public.wishlist for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  title text not null, body text, link text, read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notif" on public.notifications for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.orders;

create table public.complaints (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, order_id uuid,
  subject text not null, message text not null, status text not null default 'open',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.complaints to authenticated;
grant all on public.complaints to service_role;
alter table public.complaints enable row level security;
create policy "comp read" on public.complaints for select to authenticated using (user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "comp ins" on public.complaints for insert to authenticated with check (user_id=auth.uid());
create policy "comp admin" on public.complaints for update to authenticated using (public.has_role(auth.uid(),'admin'));

-- seed
insert into public.categories(name, slug, icon, sort) values
('Groceries','groceries','ShoppingBasket',1),('Vegetables and Fruits','vegetables-fruits','Apple',2),
('Electronics','electronics','Tv',3),('Mobile Accessories','mobile-accessories','Smartphone',4),
('Fashion','fashion','Shirt',5),('Beauty and Personal Care','beauty','Sparkles',6),
('Home Appliances','home-appliances','Refrigerator',7),('Stationery','stationery','PenTool',8),
('Hardware','hardware','Wrench',9),('Bakery','bakery','Croissant',10),('Pharmacy','pharmacy','Pill',11);

insert into public.shops(id,name,description,category_id,address,area,lat,lng,rating,status,delivery_fee,free_delivery_above) values
('11111111-0000-0000-0000-000000000001','Annapoorna Stores','Family-run grocery since 1988. Rice, spices, oils and daily needs.',(select id from categories where slug='groceries'),'12 North Usman Rd','T. Nagar',13.0418,80.2341,4.7,'approved',25,399),
('11111111-0000-0000-0000-000000000002','Green Basket Fresh','Farm-fresh vegetables and fruits delivered every morning.',(select id from categories where slug='vegetables-fruits'),'4 LB Road','Adyar',13.0012,80.2565,4.6,'approved',20,299),
('11111111-0000-0000-0000-000000000003','Velu Electronics','Phones, chargers, earphones and small appliances.',(select id from categories where slug='electronics'),'88 Arcot Rd','Vadapalani',13.0500,80.2121,4.4,'approved',40,999),
('11111111-0000-0000-0000-000000000004','Sri Murugan Bakery','Fresh bread, puffs, cakes and tea-time snacks.',(select id from categories where slug='bakery'),'21 Kutchery Rd','Mylapore',13.0339,80.2687,4.8,'approved',30,299),
('11111111-0000-0000-0000-000000000005','Lakshmi Stationery','Notebooks, pens, art supplies and school needs.',(select id from categories where slug='stationery'),'5 Anna Salai','Teynampet',13.0410,80.2496,4.5,'approved',30,499),
('11111111-0000-0000-0000-000000000006','Apollo Neighbourhood Pharmacy','Medicines, wellness and personal care.',(select id from categories where slug='pharmacy'),'9 Velachery Main Rd','Velachery',12.9791,80.2209,4.6,'approved',0,0);

insert into public.products(shop_id,category_id,name,description,brand,unit,price,mrp,stock,rating,sold_count) values
('11111111-0000-0000-0000-000000000001',(select id from categories where slug='groceries'),'Basmati Rice','Long-grain aged basmati, ideal for biryani.','India Gate','1 kg',145,180,40,4.6,120),
('11111111-0000-0000-0000-000000000001',(select id from categories where slug='groceries'),'Biryani Masala','Aromatic blend for dum biryani.','Aachi','100 g',62,70,55,4.5,88),
('11111111-0000-0000-0000-000000000001',(select id from categories where slug='groceries'),'Sunflower Oil','Refined sunflower oil.','Gold Winner','1 L',155,175,30,4.3,64),
('11111111-0000-0000-0000-000000000001',(select id from categories where slug='groceries'),'Ghee','Pure cow ghee.','Aavin','500 ml',330,360,18,4.8,51),
('11111111-0000-0000-0000-000000000001',(select id from categories where slug='groceries'),'Toor Dal','Unpolished toor dal.','Local','1 kg',150,165,4,4.4,97),
('11111111-0000-0000-0000-000000000002',(select id from categories where slug='vegetables-fruits'),'Onion','Fresh red onions.','Farm','1 kg',38,50,80,4.4,210),
('11111111-0000-0000-0000-000000000002',(select id from categories where slug='vegetables-fruits'),'Tomato','Ripe country tomatoes.','Farm','1 kg',32,40,60,4.3,190),
('11111111-0000-0000-0000-000000000002',(select id from categories where slug='vegetables-fruits'),'Mint Leaves','Fresh pudina bunch.','Farm','1 bunch',10,15,45,4.5,140),
('11111111-0000-0000-0000-000000000002',(select id from categories where slug='vegetables-fruits'),'Banana (Robusta)','Sweet ripe bananas.','Farm','1 dozen',55,65,35,4.6,160),
('11111111-0000-0000-0000-000000000002',(select id from categories where slug='vegetables-fruits'),'Ginger Garlic','Fresh ginger & garlic combo.','Farm','250 g',40,50,3,4.2,75),
('11111111-0000-0000-0000-000000000003',(select id from categories where slug='mobile-accessories'),'20W Fast Charger','USB-C PD fast charger.','Boat','1 pc',599,999,25,4.3,42),
('11111111-0000-0000-0000-000000000003',(select id from categories where slug='mobile-accessories'),'Wireless Earbuds','Bluetooth 5.3, 30h battery.','Noise','1 pc',1299,2499,12,4.2,36),
('11111111-0000-0000-0000-000000000003',(select id from categories where slug='electronics'),'LED Bulb 9W','Cool daylight LED bulb.','Philips','1 pc',99,140,100,4.5,150),
('11111111-0000-0000-0000-000000000003',(select id from categories where slug='home-appliances'),'Electric Kettle','1.5 L stainless steel kettle.','Prestige','1 pc',899,1395,8,4.4,22),
('11111111-0000-0000-0000-000000000004',(select id from categories where slug='bakery'),'Veg Puffs','Flaky puffs, baked this morning.','House','2 pcs',40,40,30,4.7,300),
('11111111-0000-0000-0000-000000000004',(select id from categories where slug='bakery'),'Milk Bread','Soft sandwich bread.','House','400 g',45,50,20,4.6,180),
('11111111-0000-0000-0000-000000000004',(select id from categories where slug='bakery'),'Black Forest Cake','Classic half-kg cake.','House','500 g',450,520,5,4.9,60),
('11111111-0000-0000-0000-000000000005',(select id from categories where slug='stationery'),'A4 Notebook','200 pages ruled.','Classmate','1 pc',85,95,50,4.5,130),
('11111111-0000-0000-0000-000000000005',(select id from categories where slug='stationery'),'Gel Pen Pack','Pack of 10 blue gel pens.','Cello','10 pcs',90,120,40,4.4,95),
('11111111-0000-0000-0000-000000000006',(select id from categories where slug='pharmacy'),'Paracetamol 650','Strip of 15 tablets.','Dolo','15 tabs',30,32,100,4.7,250),
('11111111-0000-0000-0000-000000000006',(select id from categories where slug='beauty'),'Aloe Vera Gel','Soothing face & body gel.','Himalaya','150 ml',149,199,22,4.5,70);
