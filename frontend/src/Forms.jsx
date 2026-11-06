import { useI18n } from "./i18n";
import { Children, cloneElement, isValidElement, useId, useState } from "react";
import { ImagePlus, LoaderCircle, Save, Upload } from "lucide-react";
import { allRecords, api, idOf, readFile } from "./api";
import { useLoad } from "./hooks";
import { ErrorState, Loading, Modal, ProductImage } from "./components";

export function Field({ label, children, hint, error, className = "" }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ["input", "textarea", "select"].includes(child.type)
          ? cloneElement(child, {
              id,
              "aria-describedby":
                [hint && `${id}-hint`, error && `${id}-error`]
                  .filter(Boolean)
                  .join(" ") || undefined,
              "aria-invalid": error ? true : undefined,
            })
          : child,
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}

function FormErrors({ error }) {
  const { t } = useI18n();
  return error ? (
    <div className="form-errors" role="alert">
      <b>{t("تعذّر حفظ التغييرات")}</b>
      <p>{t(error.message)}</p>
      {error.errors?.length > 0 && (
        <ul>
          {error.errors.map((item, index) => (
            <li key={index}>{t(item.msg)}</li>
          ))}
        </ul>
      )}
    </div>
  ) : null;
}

export function RecordForm({ resource, record, onClose, onSaved }) {
  const { t } = useI18n();
  const product = resource === "products";
  const nested = resource === "subcategories";
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [form, setForm] = useState(() => ({
    name: record?.name || "",
    title: record?.title || "",
    description: record?.description || "",
    category: idOf(record?.category),
    brand: idOf(record?.brand),
    subcategories: (record?.subcategories || []).map(idOf),
    price: record?.price ?? "",
    priceAfterDiscount: record?.priceAfterDiscount ?? "",
    quantity: record?.quantity ?? 0,
    imageCover: record?.imageCover || "",
    images: (record?.images || []).join("\n"),
    colors: (record?.colors || []).join("، "),
  }));
  const references = useLoad(
    async (signal) => {
      if (product) {
        const [categories, brands, subcategories] = await Promise.all(
          ["categories", "brands", "subcategories"].map((name) =>
            allRecords(name, signal),
          ),
        );
        return { categories, brands, subcategories };
      }
      if (nested) return { categories: await allRecords("categories", signal) };
      return {};
    },
    [resource],
  );
  const set = (key, value) =>
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "category" ? { subcategories: [] } : {}),
    }));
  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (
      product &&
      form.priceAfterDiscount !== "" &&
      Number(form.priceAfterDiscount) >= Number(form.price)
    ) {
      setError(
        new Error(t("السعر بعد الخصم يجب أن يكون أقل من السعر الأصلي.")),
      );
      return;
    }
    if (
      product &&
      record?.subcategories?.length &&
      !form.subcategories.length
    ) {
      setError(
        new Error(t("اختر تصنيفًا فرعيًا واحدًا على الأقل لهذا المنتج.")),
      );
      return;
    }
    let body;
    if (product) {
      body = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        price: Number(form.price),
        quantity: Number(form.quantity),
        imageCover: form.imageCover.trim(),
        images: form.images
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        colors: form.colors
          .split(/[,،]/)
          .map((item) => item.trim())
          .filter(Boolean),
        ...(form.priceAfterDiscount !== ""
          ? { priceAfterDiscount: Number(form.priceAfterDiscount) }
          : {}),
        ...(form.brand ? { brand: form.brand } : {}),
        ...(form.subcategories.length
          ? { subcategories: form.subcategories }
          : {}),
      };
    } else
      body = {
        name: form.name.trim(),
        ...(nested ? { category: form.category } : {}),
      };
    setBusy(true);
    try {
      await api(`${resource}${record ? `/${record._id}` : ""}`, {
        method: record ? "PUT" : "POST",
        body,
      });
      onSaved();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setUploadError(t("اختر صورة PNG أو JPEG أو WebP لا تتجاوز 5 MB."));
      return;
    }
    setUploading(true);
    try {
      const result = await api("images/upload-cover", {
        method: "POST",
        body: { base64Image: await readFile(file) },
      });
      set("imageCover", result.imageUrl);
    } catch (reason) {
      setUploadError(reason.message);
    } finally {
      setUploading(false);
    }
  };
  const labels = {
    products: t("المنتج"),
    categories: t("التصنيف"),
    brands: t("العلامة التجارية"),
    subcategories: t("التصنيف الفرعي"),
  };
  const subcategories =
    references.data?.subcategories?.filter(
      (item) => idOf(item.category) === form.category,
    ) || [];
  return (
    <Modal
      title={`${record ? t("تعديل") : t("إضافة")} ${labels[resource]}`}
      subtitle={t("تفاصيل واضحة لتجربة تسوّق أفضل.")}
      wide={product}
      busy={busy || uploading}
      onClose={onClose}
    >
      {references.loading ? (
        <Loading />
      ) : references.error ? (
        <ErrorState message={references.error} retry={references.reload} />
      ) : (
        <form onSubmit={submit} className="record-form">
          <fieldset disabled={busy || uploading}>
            <FormErrors error={error} />
            {!product ? (
              <Field label={t("الاسم")}>
                <input
                  autoFocus
                  required
                  minLength={nested ? 2 : 3}
                  maxLength={32}
                  value={form.name}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder={t("أدخل الاسم")}
                />
              </Field>
            ) : (
              <>
                <div className="form-section-heading">
                  <span>01</span>
                  <h3>{t("المعلومات الأساسية")}</h3>
                </div>
                <Field label={t("اسم المنتج")}>
                  <input
                    autoFocus
                    required
                    minLength={3}
                    maxLength={100}
                    value={form.title}
                    onChange={(event) => set("title", event.target.value)}
                    placeholder={t("مثال: سماعات لاسلكية")}
                  />
                </Field>
                <Field label={t("وصف المنتج")} hint={t("من 20 إلى 2000 حرف.")}>
                  <textarea
                    required
                    minLength={20}
                    maxLength={2000}
                    rows={4}
                    value={form.description}
                    onChange={(event) => set("description", event.target.value)}
                    placeholder={t("اكتب أهم مواصفات المنتج وتفاصيله…")}
                  />
                </Field>
              </>
            )}
            {(product || nested) && (
              <Field label={t("التصنيف الرئيسي")}>
                <select
                  required
                  value={form.category}
                  onChange={(event) => set("category", event.target.value)}
                >
                  <option value="">{t("اختر التصنيف")}</option>
                  {references.data.categories.map((item) => (
                    <option value={item._id} key={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {!references.data.categories.length && (
                  <small className="field-error">
                    {t("أضف تصنيفًا رئيسيًا من صفحة التصنيفات أولًا.")}
                  </small>
                )}
              </Field>
            )}
            {product && (
              <>
                <div className="form-grid">
                  <Field label={t("العلامة التجارية (اختياري)")}>
                    <select
                      value={form.brand}
                      onChange={(event) => set("brand", event.target.value)}
                    >
                      <option disabled={Boolean(record?.brand)} value="">
                        {t("دون علامة تجارية")}
                      </option>
                      {references.data.brands.map((item) => (
                        <option value={item._id} key={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={t("الألوان (اختياري)")}
                    hint={t("افصل الألوان بفاصلة.")}
                  >
                    <input
                      value={form.colors}
                      onChange={(event) => set("colors", event.target.value)}
                      placeholder={t("أسود، أبيض")}
                    />
                  </Field>
                </div>
                {form.category && subcategories.length > 0 && (
                  <div className="field">
                    <span>{t("التصنيفات الفرعية")}</span>
                    <div className="checkbox-list">
                      {subcategories.map((item) => (
                        <label key={item._id}>
                          <input
                            type="checkbox"
                            checked={form.subcategories.includes(item._id)}
                            onChange={(event) =>
                              set(
                                "subcategories",
                                event.target.checked
                                  ? [...form.subcategories, item._id]
                                  : form.subcategories.filter(
                                      (id) => id !== item._id,
                                    ),
                              )
                            }
                          />
                          {item.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="form-section-heading">
                  <span>02</span>
                  <h3>{t("السعر والمخزون")}</h3>
                </div>
                <div className="form-grid three">
                  <Field label={t("السعر ($)")}>
                    <input
                      required
                      type="number"
                      min="0"
                      max="200000"
                      step="0.01"
                      value={form.price}
                      onChange={(event) => set("price", event.target.value)}
                      dir="ltr"
                    />
                  </Field>
                  <Field
                    label={t("بعد الخصم ($)")}
                    hint={
                      record?.priceAfterDiscount != null
                        ? t("اتركه فارغًا للإبقاء على الخصم الحالي.")
                        : t("اختياري")
                    }
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.priceAfterDiscount}
                      onChange={(event) =>
                        set("priceAfterDiscount", event.target.value)
                      }
                      dir="ltr"
                    />
                  </Field>
                  <Field label={t("الكمية المتاحة")}>
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      max={Number.MAX_SAFE_INTEGER}
                      value={form.quantity}
                      onChange={(event) => set("quantity", event.target.value)}
                      dir="ltr"
                    />
                  </Field>
                </div>
                <div className="form-section-heading">
                  <span>03</span>
                  <h3>{t("صور المنتج")}</h3>
                </div>
                <div className="upload-area">
                  {form.imageCover ? (
                    <ProductImage
                      src={form.imageCover}
                      alt={t("معاينة صورة الغلاف")}
                    />
                  ) : (
                    <ImagePlus size={34} />
                  )}
                  <div>
                    <b>{t("صورة الغلاف")}</b>
                    <p>{t("PNG، JPEG أو WebP · حتى 5 MB")}</p>
                    <label className="button secondary upload-button">
                      {uploading ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Upload size={16} />
                      )}
                      {uploading ? t("جارٍ الرفع…") : t("رفع صورة")}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={upload}
                        disabled={busy || uploading}
                      />
                    </label>
                  </div>
                </div>
                {uploadError && (
                  <p className="field-error" role="alert">
                    {t(uploadError)}
                  </p>
                )}
                <Field
                  label={t("رابط صورة الغلاف")}
                  hint={t("يمكنك إدخال رابط مباشر أو رفع صورة من جهازك.")}
                >
                  <input
                    required
                    value={form.imageCover}
                    onChange={(event) => set("imageCover", event.target.value)}
                    placeholder="https://…"
                    dir="ltr"
                  />
                </Field>
                <Field
                  label={t("صور إضافية (اختياري)")}
                  hint={t("ضع رابط كل صورة في سطر مستقل.")}
                >
                  <textarea
                    rows={3}
                    value={form.images}
                    onChange={(event) => set("images", event.target.value)}
                    placeholder="https://…"
                    dir="ltr"
                  />
                </Field>
              </>
            )}
          </fieldset>
          <div className="form-actions">
            <button
              type="submit"
              disabled={busy || uploading}
              className="button primary"
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Save size={17} />
              )}
              {busy ? t("جارٍ الحفظ…") : t("حفظ التغييرات")}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy || uploading}
              onClick={onClose}
            >
              {t("إلغاء")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
