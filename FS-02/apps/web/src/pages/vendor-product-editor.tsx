import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Upload } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Field, SectionTitle } from "../components/ui";
import { api, post, put } from "../lib/api";

type VariantForm = { name: string; sku: string; price: number; compareAtPrice: number | null; currency: string; stock: number; attributes: Record<string, string> };
type ProductForm = { name: string; slug: string; description: string; categoryId: string; currency: string; images: string[]; specifications: Record<string, string>; variants: VariantForm[] };
const blankVariant = (): VariantForm => ({ name: "Standard", sku: "", price: 0, compareAtPrice: null, currency: "INR", stock: 0, attributes: {} });
const initialProduct: ProductForm = { name: "", slug: "", description: "", categoryId: "", currency: "INR", images: [], specifications: {}, variants: [blankVariant()] };

export default function VendorProductEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<any[]>("/categories") });
  const products = useQuery({ queryKey: ["vendor-products"], queryFn: () => api<any[]>("/vendors/products"), enabled: Boolean(id) });
  const [form, setForm] = useState<ProductForm>(initialProduct);
  const [specificationText, setSpecificationText] = useState("material: \norigin: India\ncare: ");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const product = products.data?.find((value) => value.id === id);
    if (!product) return;
    const specifications = product.specifications ?? {};
    setForm({ name: product.name, slug: product.slug, description: product.description, categoryId: product.categoryId, currency: product.currency, images: product.images.map((image: any) => image.url), specifications, variants: product.variants.map((variant: any) => ({ name: variant.name, sku: variant.sku, price: variant.price, compareAtPrice: variant.compareAtPrice ?? null, currency: variant.currency, stock: variant.inventory?.quantity ?? 0, attributes: variant.attributes ?? {} })) });
    setSpecificationText(Object.entries(specifications).map(([key, value]) => `${key}: ${String(value)}`).join("\n"));
  }, [products.data, id]);

  const save = useMutation({
    mutationFn: () => {
      const primary = form.variants[0]!;
      const payload = { ...form, price: primary.price, compareAtPrice: primary.compareAtPrice, sku: primary.sku, stock: primary.stock, specifications: parsePairs(specificationText), variants: form.variants };
      return id ? put(`/vendors/products/${id}`, payload) : post("/vendors/products", payload);
    },
    onSuccess: () => { toast.success(id ? "Product sent for review" : "Product submitted for review"); navigate("/vendor-portal/products"); },
    onError: (error: Error) => toast.error(error.message),
  });

  function updateVariant(index: number, patch: Partial<VariantForm>) {
    setForm((current) => ({ ...current, variants: current.variants.map((variant, position) => position === index ? { ...variant, ...patch } : variant) }));
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const signed = await post<{ id: string; uploadUrl: string; publicUrl: string }>("/vendors/uploads/presign", { fileName: file.name, contentType: file.type, size: file.size });
      const sent = await fetch(signed.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!sent.ok) throw new Error("Storage rejected the upload");
      await post(`/vendors/uploads/${signed.id}/complete`);
      setForm((current) => ({ ...current, images: [...current.images, signed.publicUrl] }));
      toast.success("Image uploaded and verified");
    } catch (error) { toast.error((error as Error).message); } finally { setUploading(false); }
  }

  return <><SectionTitle title={id ? "Edit product" : "New product"} description="Products return to moderation after material catalog changes." /><form className="card grid max-w-4xl gap-5 p-7" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
    <Field label="Product name"><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, ...(!id ? { slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") } : {}) })} required /></Field>
    <Field label="Description"><textarea className="input min-h-32" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></Field>
    <Field label="Category"><select className="input" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required><option value="">Select category</option>{categories.data?.flatMap((category) => [category, ...(category.children ?? [])]).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
    <Field label="Specifications (one key: value per line)"><textarea className="input min-h-28 font-mono text-sm" value={specificationText} onChange={(event) => setSpecificationText(event.target.value)} /></Field>
    <fieldset className="grid gap-4"><div className="flex items-center justify-between"><legend className="font-bold">Variants & inventory</legend><Button type="button" variant="secondary" onClick={() => setForm({ ...form, variants: [...form.variants, { ...blankVariant(), name: `Variant ${form.variants.length + 1}` }] })}><Plus size={16} />Add variant</Button></div>{form.variants.map((variant, index) => <div className="grid gap-3 rounded-[6px] border border-[var(--border)] p-4 sm:grid-cols-2 lg:grid-cols-6" key={index}><Field label="Name"><input className="input" value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} required /></Field><Field label="SKU"><input className="input" value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} required /></Field><Field label="Price (paise)"><input className="input" type="number" min="0" value={variant.price} onChange={(event) => updateVariant(index, { price: Number(event.target.value) })} required /></Field><Field label="Compare at"><input className="input" type="number" min="0" value={variant.compareAtPrice ?? ""} onChange={(event) => updateVariant(index, { compareAtPrice: event.target.value ? Number(event.target.value) : null })} /></Field><Field label="Stock"><input className="input" type="number" min="0" value={variant.stock} onChange={(event) => updateVariant(index, { stock: Number(event.target.value) })} required /></Field><div className="flex items-end"><Button type="button" className="w-full" variant="secondary" disabled={form.variants.length === 1} onClick={() => setForm({ ...form, variants: form.variants.filter((_, position) => position !== index) })}><Trash2 size={16} />Remove</Button></div></div>)}</fieldset>
    <Field label="Product images"><label className="btn btn-secondary w-fit cursor-pointer"><Upload size={16} />{uploading ? "Uploading…" : "Upload image"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label></Field>
    {form.images.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{form.images.map((url, index) => <div className="relative" key={url}><img className="aspect-square w-full rounded-[5px] object-cover" src={url} alt="" /><button type="button" className="absolute right-1 top-1 rounded-[4px] bg-white px-2 py-1 text-xs" onClick={() => setForm({ ...form, images: form.images.filter((_, position) => position !== index) })}>Remove</button></div>)}</div>}
    <Button disabled={save.isPending || uploading || !form.images.length || form.variants.some((variant) => !variant.sku)}>{id ? "Save and resubmit" : "Submit product"}</Button>
  </form></>;
}

function parsePairs(value: string) {
  return Object.fromEntries(value.split("\n").map((line) => line.split(":", 2).map((part) => part.trim())).filter((parts): parts is [string, string] => Boolean(parts[0] && parts[1])));
}
