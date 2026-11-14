import { describe, expect, it } from "vitest";
import { descriptionInput, descriptionOutput, descriptionMessages } from "@/lib/product-description";

describe("Product description generation", () => {
  const input = { name: "Cotton towel", category: "Home essentials", details: "100% cotton; 70 × 140 cm; machine washable" };
  it.each(["name", "category", "details"] as const)("requires %s", (field) => {
    expect(descriptionInput.safeParse({ ...input, [field]: "  " }).success).toBe(false);
  });
  it("passes name, category and key details to the model intact", () => {
    const messages = descriptionMessages(descriptionInput.parse(input));
    expect(JSON.parse(messages[1].content)).toEqual(input);
  });
  it("rejects an empty or missing generated description", () => {
    expect(descriptionOutput.safeParse({ description: " " }).success).toBe(false);
    expect(descriptionOutput.safeParse({}).success).toBe(false);
    expect(descriptionOutput.parse({ description: " A soft cotton towel. " }).description).toBe("A soft cotton towel.");
  });
});