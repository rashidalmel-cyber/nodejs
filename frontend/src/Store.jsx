import { useI18n } from "./i18n";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Grid2X2,
  Heart,
  Minus,
  Package,
  Plus,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Link,
  NavLink,
  Outlet,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { allRecords, api, money, priceOf } from "./api";
import { useDebounce, useLoad } from "./hooks";
import {
  EmptyState,
  ErrorState,
  Loading,
  LanguageSwitcher,
  Logo,
  Pagination,
  ProductCard,
  ProductImage,
  SearchInput,
} from "./components";
import { useCart } from "./CartContext";

export function StoreLayout() {
  const { t } = useI18n();
  const { count } = useCart();
  return (
    <div className="store-layout">
      <div className="announcement">
        <span>{t("اختيارات جديدة. تفاصيل تصنع الفرق.")}</span>
        <span className="announcement-secondary">
          {t("أهلًا بك في مدار")} <Sparkles size={13} />
        </span>
      </div>
      <header className="store-header">
        <div className="container header-inner">
          <Logo />
          <nav className="store-nav" aria-label={t("التنقل الرئيسي")}>
            <NavLink end to="/">
              {t("المتجر")}
            </NavLink>
            <Link to="/#catalogue">{t("جميع المنتجات")}</Link>
            <NavLink to="/admin">
              {t("لوحة الإدارة")} <Settings2 size={14} />
            </NavLink>
          </nav>
          <div className="header-actions">
            <LanguageSwitcher />
            <Link
              className="cart-link"
              to="/cart"
              aria-label={t("سلة التسوق، {0} منتجات", [count])}
            >
              <ShoppingBag size={21} />
              <span>{t("السلة")}</span>
              <b>{count}</b>
            </Link>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="store-footer">
        <div className="container footer-content">
          <div>
            <Logo small />
            <p>{t("كل ما تحتاجه، في مدارك.")}</p>
          </div>
          <div className="footer-links">
            <Link to="/">{t("المتجر")}</Link>
            <Link to="/cart">{t("سلة التسوق")}</Link>
            <Link to="/admin">{t("إدارة المتجر")}</Link>
          </div>
          <span className="footer-credit">
            {t("صُنع للاكتشاف")} <span>✳</span> {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}

export function Store() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const keyword = params.get("keyword") || "";
  const category = params.get("category") || "";
  const sort = params.get("sort") || "-createdAt";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(keyword);
  const debounced = useDebounce(search);
  const { add } = useCart();
  useEffect(() => setSearch(keyword), [keyword]);
  useEffect(() => {
    if (debounced === keyword) return;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (debounced) next.set("keyword", debounced);
        else next.delete("keyword");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [debounced]);
  const update = (key, value) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  const categories = useLoad((signal) => allRecords("categories", signal), []);
  const query = new URLSearchParams({
    page,
    limit: 25,
    sort,
    ...(keyword ? { keyword } : {}),
    ...(category ? { category } : {}),
  }).toString();
  const products = useLoad(
    (signal) => api(`products?${query}`, { signal }),
    [query],
  );
  const activeCategory = categories.data?.find((item) => item._id === category);
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <span className="pill">
            <span /> {t("اختيارات بعناية، لحياتك اليومية")}
          </span>
          <h1>
            {t("أشياء تحبّها.")}
            <br />
            <span>{t("كلّ يوم.")}</span>
          </h1>
          <p>
            {t("اكتشف منتجات تجمع بين الجودة والتصميم.")}
            <br />
            {t("اختياراتك القادمة تبدأ من هنا.")}
          </p>
          <a className="button primary" href="#catalogue">
            {t("اكتشف التشكيلة")} <ArrowLeft size={18} />
          </a>
          <div className="hero-footnote">
            <span className="mini-stars">✳ ✳ ✳</span>
            <span>{t("مساحة واحدة. خيارات أكثر.")}</span>
          </div>
        </div>
        <div className="hero-art">
          <span className="art-orbit orbit-one" />
          <span className="art-orbit orbit-two" />
          <span className="hero-art-label">THE EVERYDAY EDIT / 01</span>
          <div className="hero-product">
            <img
              src="/hero-phone.webp"
              alt={t("هاتف من تشكيلة الإلكترونيات")}
            />
            <span className="art-shadow" />
          </div>
          <div className="floating-note">
            <span className="note-icon">
              <Sparkles size={20} />
            </span>
            <span>
              <b>{t("تفاصيل تستحق الاكتشاف")}</b>
              <small>{t("تصفّح. اختر. استمتع.")}</small>
            </span>
            <ArrowLeft size={18} />
          </div>
          <span className="hero-art-number">01 — 25</span>
        </div>
      </section>
      <section className="benefits container" aria-label={t("مزايا المتجر")}>
        <div>
          <Package size={21} />
          <span>
            {t("تشكيلة متنوعة")}
            <small>{t("كل اختياراتك في مكان واحد")}</small>
          </span>
        </div>
        <div>
          <ShieldCheck size={21} />
          <span>
            {t("تفاصيل واضحة")}
            <small>{t("الأسعار والمخزون أمامك")}</small>
          </span>
        </div>
        <div>
          <Heart size={21} />
          <span>
            {t("اختيارات على ذوقك")}
            <small>{t("ابحث عن الشيء الذي تحبّه")}</small>
          </span>
        </div>
      </section>
      <section className="catalogue container" id="catalogue">
        <div className="section-heading">
          <div>
            <span className="eyebrow accent">{t("اكتشف مدار")}</span>
            <h2>
              {activeCategory?.name || t("اختيارات لكل يوم")}
              <span className="heading-spark">✳</span>
            </h2>
            <p>{t("منتجات تستحق مكانًا في يومك.")}</p>
          </div>
          <span className="collection-label">
            <Grid2X2 size={16} /> {t("التشكيلة الكاملة")}
          </span>
        </div>
        <div className="category-tabs" aria-label={t("تصفية حسب التصنيف")}>
          <button
            className={!category ? "active" : ""}
            onClick={() => update("category", "")}
          >
            {t("كل المنتجات")}
          </button>
          {categories.data?.map((item) => (
            <button
              key={item._id}
              className={category === item._id ? "active" : ""}
              onClick={() => update("category", item._id)}
            >
              {item.name}
            </button>
          ))}
          {categories.error && (
            <button onClick={categories.reload}>
              {t("إعادة تحميل التصنيفات")}
            </button>
          )}
        </div>
        <div className="catalogue-toolbar">
          <SearchInput value={search} onChange={setSearch} />
          <div className="sort-control">
            <SlidersHorizontal size={17} />
            <label htmlFor="store-sort">{t("الترتيب:")}</label>
            <select
              id="store-sort"
              value={sort}
              onChange={(event) => update("sort", event.target.value)}
            >
              <option value="-createdAt">{t("الأحدث أولًا")}</option>
              <option value="price">{t("السعر: الأقل أولًا")}</option>
              <option value="-price">{t("السعر: الأعلى أولًا")}</option>
              <option value="-sold">{t("الأكثر مبيعًا")}</option>
              <option value="title">{t("الاسم")}</option>
            </select>
          </div>
        </div>
        {products.loading ? (
          <div
            className="product-grid skeleton-grid"
            role="status"
            aria-label={t("جارٍ تحميل المنتجات")}
          >
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="skeleton-card">
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : products.error ? (
          <ErrorState message={products.error} retry={products.reload} />
        ) : products.data?.data.length ? (
          <>
            <div className="result-line">
              <span>
                {products.data.results} {t("منتجًا في هذه الصفحة")}
              </span>
              <span>
                {t("صفحة")} {page}
              </span>
            </div>
            <div className="product-grid">
              {products.data.data.map((product) => (
                <ProductCard key={product._id} product={product} add={add} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title={t("لم نجد منتجات هنا")}
            description={t("جرّب كلمة بحث أخرى أو اختر تصنيفًا مختلفًا.")}
          >
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setParams({});
              }}
            >
              {t("عرض كل المنتجات")}
            </button>
          </EmptyState>
        )}
        {!products.error && !products.loading && (
          <Pagination
            page={page}
            count={products.data?.results || 0}
            onChange={(value) => {
              update("page", String(value));
              document
                .getElementById("catalogue")
                .scrollIntoView({ behavior: "smooth" });
            }}
          />
        )}
      </section>
      <section className="closing-banner container">
        <span className="banner-spark">✳</span>
        <div>
          <span className="eyebrow">{t("على ذوقك، وفي وقتك")}</span>
          <h2>{t("التفاصيل الصغيرة تصنع يومًا أجمل.")}</h2>
        </div>
        <a className="button secondary" href="#catalogue">
          {t("تابع الاكتشاف")} <ArrowLeft size={17} />
        </a>
      </section>
    </>
  );
}

export function ProductDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const product = useLoad(
    (signal) => api(`products/${id}`, { signal }).then((result) => result.data),
    [id],
  );
  const { add } = useCart();
  const [selected, setSelected] = useState("");
  const [count, setCount] = useState(1);
  useEffect(() => {
    setSelected("");
    setCount(1);
    window.scrollTo(0, 0);
  }, [id]);
  if (product.loading) return <Loading />;
  if (product.error)
    return (
      <div className="container">
        <ErrorState message={product.error} retry={product.reload} />
      </div>
    );
  const item = product.data;
  const images = [
    ...new Set([item.imageCover, ...(item.images || [])].filter(Boolean)),
  ];
  return (
    <div className="container detail-page">
      <nav className="breadcrumb">
        <Link to="/">{t("المتجر")}</Link>
        <ArrowLeft size={13} />
        <span>{item.title}</span>
      </nav>
      <div className="detail-grid">
        <div>
          <ProductImage
            className="detail-image"
            src={selected || item.imageCover}
            alt={item.title}
          />
          <div className="thumbnails">
            {images.map((src, index) => (
              <button
                key={src}
                aria-label={t("عرض صورة {0}", [index + 1])}
                className={
                  (selected || item.imageCover) === src ? "active" : ""
                }
                onClick={() => setSelected(src)}
              >
                <ProductImage src={src} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="detail-info">
          <span className="pill">
            <span />
            {item.brand?.name || item.category?.name || t("تشكيلة مدار")}
          </span>
          <h1>{item.title}</h1>
          <div className="detail-price price" dir="ltr">
            {money(priceOf(item))}
            {item.priceAfterDiscount != null && <del>{money(item.price)}</del>}
          </div>
          <p className="product-description">{item.description}</p>
          <dl className="product-meta">
            <div>
              <dt>{t("التصنيف")}</dt>
              <dd>{item.category?.name || "—"}</dd>
            </div>
            {item.brand && (
              <div>
                <dt>{t("العلامة التجارية")}</dt>
                <dd>{item.brand.name}</dd>
              </div>
            )}
            <div>
              <dt>{t("التوفر")}</dt>
              <dd className={item.quantity ? "text-green" : "text-red"}>
                {item.quantity
                  ? t("{0} قطعة متوفرة", [item.quantity])
                  : t("نفدت الكمية")}
              </dd>
            </div>
            {item.colors?.length > 0 && (
              <div>
                <dt>{t("الألوان")}</dt>
                <dd>{item.colors.join("، ")}</dd>
              </div>
            )}
            {item.ratingsAverage && (
              <div>
                <dt>{t("التقييم")}</dt>
                <dd>★ {item.ratingsAverage} / 5</dd>
              </div>
            )}
          </dl>
          <div className="detail-actions">
            <div className="quantity-control">
              <button
                aria-label={t("تقليل الكمية")}
                disabled={count <= 1}
                onClick={() => setCount(count - 1)}
              >
                <Minus size={16} />
              </button>
              <span>{count}</span>
              <button
                aria-label={t("زيادة الكمية")}
                disabled={count >= item.quantity}
                onClick={() => setCount(count + 1)}
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              className="button primary"
              disabled={!item.quantity}
              onClick={() => add(item, count)}
            >
              <ShoppingBag size={19} />
              {item.quantity ? t("أضف إلى السلة") : t("غير متوفر حاليًا")}
            </button>
          </div>
          <p className="muted small-text">
            <Check size={15} /> {t("الأسعار بالدولار الأمريكي")}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Cart() {
  const { t } = useI18n();
  const { items, changeCount, remove } = useCart();
  const total = items.reduce(
    (sum, item) => sum + priceOf(item) * item.count,
    0,
  );
  return (
    <div className="container cart-page">
      <nav className="breadcrumb">
        <Link to="/">{t("المتجر")}</Link>
        <ArrowLeft size={13} />
        <span>{t("السلة")}</span>
      </nav>
      <div className="section-heading">
        <div>
          <span className="eyebrow accent">{t("اختياراتك")}</span>
          <h1>
            {t("سلة التسوق")}
            <span className="heading-spark">✳</span>
          </h1>
        </div>
        <Link className="text-link" to="/">
          {t("تابع التسوّق")} <ArrowLeft size={16} />
        </Link>
      </div>
      {!items.length ? (
        <EmptyState
          title={t("السلة بانتظار اختياراتك")}
          description={t("اكتشف التشكيلة وأضف المنتجات التي تحبها.")}
        >
          <Link className="button primary" to="/">
            {t("اكتشف المتجر")} <ArrowLeft size={17} />
          </Link>
        </EmptyState>
      ) : (
        <div className="cart-grid">
          <div className="cart-items">
            {items.map((item) => (
              <article className="cart-item" key={item._id}>
                <Link to={`/products/${item._id}`}>
                  <ProductImage src={item.imageCover} alt={item.title} />
                </Link>
                <div className="cart-item-info">
                  <span className="eyebrow">
                    {item.brand?.name || item.category?.name}
                  </span>
                  <Link to={`/products/${item._id}`}>
                    <h3>{item.title}</h3>
                  </Link>
                  <span className="price" dir="ltr">
                    {money(priceOf(item))}
                  </span>
                </div>
                <div className="quantity-control">
                  <button
                    aria-label={t("تقليل كمية {0}", [item.title])}
                    disabled={item.count <= 1}
                    onClick={() => changeCount(item._id, item.count - 1)}
                  >
                    <Minus size={14} />
                  </button>
                  <span>{item.count}</span>
                  <button
                    aria-label={t("زيادة كمية {0}", [item.title])}
                    disabled={item.count >= item.quantity}
                    onClick={() => changeCount(item._id, item.count + 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  className="icon-button danger-text"
                  aria-label={t("إزالة {0} من السلة", [item.title])}
                  onClick={() => remove(item._id)}
                >
                  <Trash2 size={18} />
                </button>
              </article>
            ))}
          </div>
          <aside className="order-summary">
            <h2>{t("ملخّص السلة")}</h2>
            <div>
              <span>
                {t("المنتجات (")}
                {items.reduce((sum, item) => sum + item.count, 0)})
              </span>
              <b dir="ltr">{money(total)}</b>
            </div>
            <div className="summary-total">
              <span>{t("المجموع التقديري")}</span>
              <b dir="ltr">{money(total)}</b>
            </div>
            <p className="notice">
              <ShoppingBag size={18} />
              {t(
                "السلة محفوظة على هذا الجهاز. إتمام الشراء والدفع غير متاحين حاليًا.",
              )}
            </p>
            <Link className="button primary" to="/">
              {t("متابعة التسوّق")} <ArrowLeft size={17} />
            </Link>
            <p className="small-text muted">
              {t("السعر والمخزون قد يتغيّران بعد الإضافة.")}
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
