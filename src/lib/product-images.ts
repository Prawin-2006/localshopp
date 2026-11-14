import image0 from "@/assets/product-banana--robusta.jpg";
import image1 from "@/assets/product-basmati-rice.jpg";
import image2 from "@/assets/product-biryani-masala.jpg";
import image3 from "@/assets/product-black-forest-cake.jpg";
import image4 from "@/assets/product-ghee.jpg";
import image5 from "@/assets/product-ginger-garlic.jpg";
import image6 from "@/assets/product-milk-bread.jpg";
import image7 from "@/assets/product-mint-leaves.jpg";
import image8 from "@/assets/product-onion.jpg";
import image9 from "@/assets/product-sunflower-oil.jpg";
import image10 from "@/assets/product-tomato.jpg";
import image11 from "@/assets/product-toor-dal.jpg";
import image12 from "@/assets/product-veg-puffs.jpg";
import image13 from "@/assets/product-20w-fast-charger.jpg";
import image14 from "@/assets/product-a4-notebook.jpg";
import image15 from "@/assets/product-aloe-vera-gel.jpg";
import image16 from "@/assets/product-electric-kettle.jpg";
import image17 from "@/assets/product-gel-pen-pack.jpg";
import image18 from "@/assets/product-led-bulb-9w.jpg";
import image19 from "@/assets/product-paracetamol-650.jpg";
import image20 from "@/assets/product-wireless-earbuds.jpg";

// Illustrative catalog photography; seller-provided images take precedence.
const catalogImages: Record<string, string> = {
  "Banana (Robusta)": image0,
  "Basmati Rice": image1,
  "Biryani Masala": image2,
  "Black Forest Cake": image3,
  "Ghee": image4,
  "Ginger Garlic": image5,
  "Milk Bread": image6,
  "Mint Leaves": image7,
  "Onion": image8,
  "Sunflower Oil": image9,
  "Tomato": image10,
  "Toor Dal": image11,
  "Veg Puffs": image12,
  "20W Fast Charger": image13,
  "A4 Notebook": image14,
  "Aloe Vera Gel": image15,
  "Electric Kettle": image16,
  "Gel Pen Pack": image17,
  "LED Bulb 9W": image18,
  "Paracetamol 650": image19,
  "Wireless Earbuds": image20,
};

export function productImage(name: string, source?: string | null): string | undefined {
  return source || catalogImages[name];
}
