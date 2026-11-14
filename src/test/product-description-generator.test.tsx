import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductDescriptionGenerator } from "@/components/ProductDescriptionGenerator";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => generate }));
vi.mock("@/lib/ai.functions", () => ({ describeProduct: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("Product description draft workflow", () => {
  it("generates from the provided fields and applies only the owner-reviewed draft", async () => {
    generate.mockResolvedValue({ description: "A soft, washable cotton towel." });
    const apply = vi.fn();
    render(<ProductDescriptionGenerator name="Cotton towel" category="Home essentials" brand="Local cotton" unit="1 pc" onApply={apply} />);
    fireEvent.change(screen.getByLabelText("Key details"), { target: { value: "100% cotton; machine washable" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate description" }));
    await screen.findByLabelText("AI draft");
    expect(generate).toHaveBeenCalledWith({ data: { name: "Cotton towel", category: "Home essentials", details: "100% cotton; machine washable\nBrand: Local cotton\nUnit: 1 pc" } });
    expect(apply).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("AI draft"), { target: { value: "Reviewed cotton towel description." } });
    fireEvent.click(screen.getByRole("button", { name: "Use description" }));
    expect(apply).toHaveBeenCalledWith("Reviewed cotton towel description.");
  });
  it("preserves details and permits explicit recovery after a failed call", async () => {
    generate.mockRejectedValue(new Error("AI generation unavailable"));
    render(<ProductDescriptionGenerator name="Cotton towel" category="Home essentials" brand="" unit="" onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Key details"), { target: { value: "100% cotton" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate description" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Key details")).toHaveValue("100% cotton");
    await waitFor(() => expect(screen.getByRole("button", { name: "Generate description" })).toBeEnabled());
    expect(generate).toHaveBeenCalledTimes(1);
  });
});