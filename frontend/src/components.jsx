import { useI18n } from "./i18n";
import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ImageOff,
  Languages,
  LoaderCircle,
  RefreshCw,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { money, priceOf } from "./api";

export function Logo({ small = false }) {
  const { t } = useI18n();
  return (
    <Link
      className={`logo ${small ? "small" : ""}`}
      to="/"
      aria-label={t("مدار، الصفحة الرئيسية")}
    >
      <span className="logo-mark">{t("م")}</span>
      <span>
        {t("مدار")}
        <span className="logo-dot">.</span>
      </span>
    </Link>
  );
}

export function ProductImage({ src, alt = "", className = "" }) {
  const { t } = useI18n();
  return (
    <div className={`product-image ${className}`}>
      {src ? (
        <img
          key={src}
          src={src}
          alt={alt}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true;
            event.currentTarget.nextElementSibling.hidden = false;
          }}
        />
      ) : null}
      <span className="image-fallback" hidden={Boolean(src)}>
        <ImageOff size={30} />
        <small>{t("الصورة غير متاحة")}</small>
      </span>
    </div>
  );
}

export function Loading({ label = "جارٍ تحميل البيانات…" }) {
  const { t } = useI18n();
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={26} />
      <span>{t(label)}</span>
    </div>
  );
}

export function ErrorState({ message, retry }) {
  const { t } = useI18n();
  return (
    <div className="state-panel error-state" role="alert">
      <span className="state-icon">
        <RefreshCw size={28} />
      </span>
      <h3>{t("تعذّر تحميل البيانات")}</h3>
      <p>{t(message)}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          <RefreshCw size={16} /> {t("أعد المحاولة")}
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "لا توجد نتائج",
  description = "جرّب تغيير البحث أو الفلاتر.",
  children,
}) {
  const { t } = useI18n();
  return (
    <div className="state-panel">
      <span className="state-icon">
        <ShoppingBag size={30} />
      </span>
      <h3>{t(title)}</h3>
      <p>{t(description)}</p>
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "ابحث عن منتج…",
}) {
  const { t } = useI18n();
  return (
    <div className="search-input">
      <Search size={19} />
      <input
        aria-label={t(placeholder)}
        placeholder={t(placeholder)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          className="icon-button"
          aria-label={t("مسح البحث")}
          onClick={() => onChange("")}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  count,
  limit = 25,
  onChange,
  disabled = false,
}) {
  const { t } = useI18n();
  if (page === 1 && count < limit) return null;
  return (
    <nav className="pagination" aria-label={t("صفحات النتائج")}>
      <button
        className="button secondary"
        disabled={disabled || page === 1}
        onClick={() => onChange(page - 1)}
      >
        <ArrowRight size={16} />
        {t("السابق")}
      </button>
      <span>
        {t("صفحة")} <b>{page}</b>
      </span>
      <button
        className="button secondary"
        disabled={disabled || count < limit}
        onClick={() => onChange(page + 1)}
      >
        {t("التالي")}
        <ArrowLeft size={16} />
      </button>
    </nav>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  busy = false,
}) {
  const { t } = useI18n();
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close.current();
      }}
    >
      <header className="modal-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          disabled={busy}
          className="icon-button"
          aria-label={t("إغلاق")}
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function ProductCard({ product, add }) {
  const { t } = useI18n();
  const discount =
    product.priceAfterDiscount != null &&
    product.priceAfterDiscount < product.price;
  return (
    <article className="product-card">
      <Link to={`/products/${product._id}`} className="product-card-art">
        <ProductImage src={product.imageCover} alt={product.title} />
        {discount && (
          <span className="discount-badge">
            −
            {Math.round((1 - product.priceAfterDiscount / product.price) * 100)}
            %
          </span>
        )}
        {product.quantity === 0 && (
          <span className="stock-badge">{t("نفدت الكمية")}</span>
        )}
      </Link>
      <div className="product-card-body">
        <span className="eyebrow">
          {product.brand?.name || product.category?.name || t("تشكيلة مدار")}
        </span>
        <Link to={`/products/${product._id}`} className="product-title">
          {product.title}
        </Link>
        <div className="product-card-bottom">
          <div className="price" dir="ltr">
            {money(priceOf(product))}
            {discount && <del>{money(product.price)}</del>}
          </div>
          <button
            className="add-button"
            disabled={!product.quantity}
            aria-label={t("إضافة {0} إلى السلة", [product.title])}
            onClick={() => add(product)}
          >
            <ShoppingBag size={19} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function Toast({ message, onClose }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 3200);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  return message ? (
    <div className="toast" role="status">
      <CheckCircle2 size={20} />
      {t(message)}
      <button
        className="icon-button"
        aria-label={t("إغلاق التنبيه")}
        onClick={onClose}
      >
        <X size={16} />
      </button>
    </div>
  ) : null;
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();
  const nextLanguage = language === "ar" ? "en" : "ar";
  return (
    <button
      className="language-switcher"
      type="button"
      aria-label={
        language === "ar" ? "Switch to English" : "التبديل إلى العربية"
      }
      onClick={() => setLanguage(nextLanguage)}
    >
      <Languages size={17} />
      <span lang={nextLanguage}>
        {language === "ar" ? "English" : "العربية"}
      </span>
    </button>
  );
}
