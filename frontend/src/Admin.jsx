import { useI18n } from "./i18n";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Boxes,
  ChevronLeft,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  Layers3,
  LoaderCircle,
  Menu,
  Package,
  Pencil,
  Plus,
  Tag,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { allRecords, api, money, priceOf } from "./api";
import { useLoad } from "./hooks";
import {
  EmptyState,
  ErrorState,
  Loading,
  LanguageSwitcher,
  Logo,
  Modal,
  Pagination,
  ProductImage,
  SearchInput,
} from "./components";
import { RecordForm } from "./Forms";

export const resources = {
  products: {
    title: "المنتجات",
    singular: "منتج",
    icon: Package,
    description: "كل منتجاتك، بتفاصيلها وفي مكان واحد.",
  },
  categories: {
    title: "التصنيفات",
    singular: "تصنيف",
    icon: Layers3,
    description: "نظّم التشكيلة ليسهل على عملائك اكتشافها.",
  },
  subcategories: {
    title: "التصنيفات الفرعية",
    singular: "تصنيف فرعي",
    icon: FolderTree,
    description: "تفاصيل أكثر، وتنظيم أفضل لمنتجاتك.",
  },
  brands: {
    title: "العلامات التجارية",
    singular: "علامة تجارية",
    icon: Tag,
    description: "العلامات التي تشكّل هوية متجرك.",
  },
};

export function AdminLayout() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button mobile-only"
            aria-label={t("إغلاق القائمة")}
            onClick={() => setOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <span className="workspace-label">{t("مساحة الإدارة")}</span>
        <nav aria-label={t("لوحة الإدارة")} onClick={() => setOpen(false)}>
          <NavLink end to="/admin">
            <LayoutDashboard size={19} />
            {t("نظرة عامة")}
          </NavLink>
          {Object.entries(resources).map(([key, value]) => (
            <NavLink key={key} to={`/admin/${key}`}>
              <value.icon size={19} />
              {t(value.title)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="store-status">
            <span className="status-dot" />
            <span>
              {t("متجر مدار")}
              <small>{t("إدارة الكتالوج")}</small>
            </span>
          </div>
          <Link to="/">
            {t("زيارة المتجر")} <ExternalLink size={16} />
          </Link>
          <p>{t("بيئة محلية · دون تسجيل دخول")}</p>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label={t("إغلاق القائمة")}
          onClick={() => setOpen(false)}
        />
      )}
      <div className="admin-body">
        <header className="admin-topbar">
          <div>
            <button
              className="icon-button mobile-only"
              aria-label={t("فتح القائمة")}
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>{t("مدار")}</span>
            <ChevronLeft size={13} />
            <span className="muted">{t("لوحة الإدارة")}</span>
          </div>
          <div className="header-actions">
            <LanguageSwitcher />
            <Link to="/" className="button secondary small">
              {t("معاينة المتجر")} <ArrowUpLeft size={16} />
            </Link>
          </div>
        </header>
        <main className="admin-main">
          <Outlet />
        </main>
        <footer className="admin-footer">
          {t("مدار / مساحة واحدة لإدارة التفاصيل.")}
        </footer>
      </div>
    </div>
  );
}

export function Overview() {
  const { t } = useI18n();
  const state = useLoad(async (signal) => {
    const [products, categories, brands] = await Promise.all(
      ["products", "categories", "brands"].map((resource) =>
        allRecords(resource, signal),
      ),
    );
    return { products, categories, brands };
  }, []);
  const products = state.data?.products || [];
  const stats = [
    {
      title: t("إجمالي المنتجات"),
      value: products.length,
      icon: Package,
      className: "green",
      caption: t("ضمن تشكيلة المتجر"),
    },
    {
      title: t("القطع المتوفرة"),
      value: products.reduce((sum, item) => sum + item.quantity, 0),
      icon: Boxes,
      className: "blue",
      caption: t("جاهزة في المخزون"),
    },
    {
      title: t("التصنيفات"),
      value: state.data?.categories.length || 0,
      icon: Layers3,
      className: "orange",
      caption: t("لتنظيم تجربة الاكتشاف"),
    },
    {
      title: t("العلامات التجارية"),
      value: state.data?.brands.length || 0,
      icon: Tag,
      className: "purple",
      caption: t("ضمن كتالوج مدار"),
    },
  ];
  const lowStock = products.filter((item) => item.quantity < 6);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow accent">{t("مساحتك، تحت السيطرة")}</span>
          <h1>
            {t("أهلًا بك في مدار")} <span className="heading-spark">✳</span>
          </h1>
          <p>{t("نظرة على متجرك، والتفاصيل التي تستحق اهتمامك.")}</p>
        </div>
        <Link className="button primary" to="/admin/products?new=1">
          <Plus size={18} />
          {t("إضافة منتج")}
        </Link>
      </div>
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorState message={state.error} retry={state.reload} />
      ) : (
        <>
          <div className="stats-grid">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.title}>
                <div>
                  <span>{stat.title}</span>
                  <span className={`stat-icon ${stat.className}`}>
                    <stat.icon size={21} />
                  </span>
                </div>
                <strong>{stat.value.toLocaleString("en-US")}</strong>
                <p>{stat.caption}</p>
              </article>
            ))}
          </div>
          <div className="overview-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>{t("أحدث المنتجات")}</h2>
                  <p>{t("آخر الإضافات إلى تشكيلتك.")}</p>
                </div>
                <Link className="text-link" to="/admin/products">
                  {t("عرض الكل")} <ArrowLeft size={15} />
                </Link>
              </div>
              {products.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("المنتج")}</th>
                        <th>{t("السعر")}</th>
                        <th>{t("المخزون")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.slice(0, 6).map((item) => (
                        <tr key={item._id}>
                          <td>
                            <Link
                              className="table-product"
                              to={`/products/${item._id}`}
                            >
                              <ProductImage src={item.imageCover} alt="" />
                              <span>
                                <b>{item.title}</b>
                                <small>{item.category?.name || "—"}</small>
                              </span>
                            </Link>
                          </td>
                          <td className="numeric">{money(priceOf(item))}</td>
                          <td>
                            <Stock value={item.quantity} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={t("ابدأ بأول منتج")}
                  description={t("أضف منتجاتك لتظهر هنا وفي المتجر.")}
                >
                  <Link className="button primary" to="/admin/products?new=1">
                    {t("إضافة منتج")}
                  </Link>
                </EmptyState>
              )}
            </section>
            <div className="overview-aside">
              <section className="quick-panel">
                <span className="quick-spark">✳</span>
                <span className="eyebrow">{t("كل التفاصيل، من هنا")}</span>
                <h2>
                  {t("متجر مرتب.")}
                  <br />
                  {t("تجربة أجمل.")}
                </h2>
                <p>
                  {t(
                    "نظّم المنتجات، حدّث الأسعار، واجعل تشكيلتك جاهزة للاكتشاف.",
                  )}
                </p>
                <Link to="/" className="button">
                  {t("تصفّح المتجر")} <ArrowLeft size={17} />
                </Link>
              </section>
              <section className="panel stock-alert">
                <div className="panel-heading">
                  <h2>
                    <TriangleAlert size={18} /> {t("متابعة المخزون")}
                  </h2>
                </div>
                {lowStock.length ? (
                  <>
                    <p>
                      {t("لديك")} <b>{lowStock.length}</b>{" "}
                      {t("منتجًا بمخزون منخفض أو نافد.")}
                    </p>
                    <Link className="text-link" to="/admin/products?stock=low">
                      {t("مراجعة المنتجات")} <ArrowLeft size={15} />
                    </Link>
                  </>
                ) : (
                  <p className="text-green">
                    {t("المخزون متوفر لجميع المنتجات.")}
                  </p>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Stock({ value }) {
  const { t } = useI18n();
  return (
    <span
      className={`stock-tag ${value === 0 ? "out" : value < 6 ? "low" : ""}`}
    >
      <span />
      {value === 0 ? t("نفد المخزون") : t("{0} متوفر", [value])}
    </span>
  );
}

export function ResourcePage({ notify }) {
  const { t } = useI18n();
  const { resource } = useParams();
  return resources[resource] ? (
    <ResourceContent key={resource} resource={resource} notify={notify} />
  ) : (
    <EmptyState
      title={t("الصفحة غير موجودة")}
      description={t("اختر صفحة من قائمة الإدارة.")}
    />
  );
}

function ResourceContent({ resource, notify }) {
  const { t, locale } = useI18n();
  const info = {
    ...resources[resource],
    title: t(resources[resource].title),
    singular: t(resources[resource].singular),
    description: t(resources[resource].description),
  };
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState(
    () => new URLSearchParams(window.location.search).get("stock") || "all",
  );
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const state = useLoad((signal) => allRecords(resource, signal), [resource]);
  const product = resource === "products";
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("new")) {
      setEditing(null);
      window.history.replaceState({}, "", `/admin/${resource}`);
    }
  }, [resource]);
  const filtered = (state.data || []).filter((item) => {
    const matches = [
      item.title,
      item.name,
      item.category?.name,
      item.brand?.name,
    ].some((value) =>
      value?.toLowerCase().includes(search.toLowerCase().trim()),
    );
    return (
      matches &&
      (!product ||
        stock === "all" ||
        (stock === "low" ? item.quantity < 6 : item.quantity === 0))
    );
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const confirmDelete = async () => {
    setDeleteError("");
    setDeletingBusy(true);
    try {
      await api(`${resource}/${deleting._id}`, { method: "DELETE" });
      setDeleting(null);
      state.reload();
      notify(t("تم حذف السجل بنجاح"));
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeletingBusy(false);
    }
  };
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow accent">{t("إدارة الكتالوج")}</span>
          <h1>
            {info.title}
            <span className="count-chip">{state.data?.length ?? "—"}</span>
          </h1>
          <p>{info.description}</p>
        </div>
        <button className="button primary" onClick={() => setEditing(null)}>
          <Plus size={18} />
          {t("إضافة")} {info.singular}
        </button>
      </div>
      <section className="panel resource-panel">
        <div className="resource-toolbar">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder={t("ابحث في {0}…", [info.title])}
          />
          {product && (
            <select
              aria-label={t("تصفية المخزون")}
              value={stock}
              onChange={(event) => {
                setStock(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t("كل حالات المخزون")}</option>
              <option value="low">{t("مخزون منخفض أو نافد")}</option>
              <option value="out">{t("نفد المخزون")}</option>
            </select>
          )}
          <span className="toolbar-count">
            {filtered.length} {t("سجل")}
          </span>
        </div>
        {state.loading ? (
          <Loading />
        ) : state.error ? (
          <ErrorState message={state.error} retry={state.reload} />
        ) : !rows.length ? (
          <EmptyState
            title={
              search
                ? t("لا توجد نتائج للبحث")
                : t("لا توجد {0} بعد", [info.title])
            }
            description={
              search
                ? t("جرّب كلمة بحث مختلفة.")
                : t("أضف أول سجل لتبدأ بتنظيم متجرك.")
            }
          >
            {!search && (
              <button
                className="button primary"
                onClick={() => setEditing(null)}
              >
                <Plus size={16} />
                {t("إضافة")} {info.singular}
              </button>
            )}
          </EmptyState>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{product ? t("المنتج") : t("الاسم")}</th>
                    {product && (
                      <>
                        <th>{t("التصنيف")}</th>
                        <th>{t("السعر")}</th>
                        <th>{t("المخزون")}</th>
                      </>
                    )}
                    {resource === "subcategories" && (
                      <th>{t("التصنيف الرئيسي")}</th>
                    )}
                    <th>{t("تاريخ الإضافة")}</th>
                    <th>
                      <span className="sr-only">{t("الإجراءات")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item._id}>
                      <td>
                        {product ? (
                          <Link
                            className="table-product"
                            to={`/products/${item._id}`}
                          >
                            <ProductImage src={item.imageCover} alt="" />
                            <span>
                              <b>{item.title}</b>
                              <small>
                                {item.brand?.name || t("دون علامة تجارية")}
                              </small>
                            </span>
                          </Link>
                        ) : (
                          <div className="table-name">
                            <span className="record-icon">
                              <info.icon size={18} />
                            </span>
                            <span>
                              <b>{item.name}</b>
                              <small>{item.slug}</small>
                            </span>
                          </div>
                        )}
                      </td>
                      {product && (
                        <>
                          <td>{item.category?.name || "—"}</td>
                          <td className="numeric">{money(priceOf(item))}</td>
                          <td>
                            <Stock value={item.quantity} />
                          </td>
                        </>
                      )}
                      {resource === "subcategories" && (
                        <td>{item.category?.name || t("تصنيف محذوف")}</td>
                      )}
                      <td className="date-cell">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString(locale)
                          : "—"}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={t("تعديل {0}", [
                              item.title || item.name,
                            ])}
                            title={t("تعديل")}
                            onClick={() => setEditing(item)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button danger-text"
                            aria-label={t("حذف {0}", [item.title || item.name])}
                            title={t("حذف")}
                            onClick={() => {
                              setDeleteError("");
                              setDeleting(item);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                {t("عرض")} {(currentPage - 1) * 25 + 1}–
                {Math.min(currentPage * 25, filtered.length)} {t("من")}{" "}
                {filtered.length}
              </span>
              <Pagination
                page={currentPage}
                count={currentPage < pages ? 25 : 0}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </section>
      {editing !== undefined && (
        <RecordForm
          resource={resource}
          record={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            state.reload();
            notify(t("تم حفظ التغييرات بنجاح"));
          }}
        />
      )}
      {deleting && (
        <Modal
          title={t("حذف {0}؟", [info.singular])}
          onClose={() => setDeleting(null)}
          busy={deletingBusy}
        >
          <div className="confirm-delete">
            <span className="delete-symbol">
              <Trash2 size={25} />
            </span>
            <p>
              {t("سيتم حذف")} <b>{deleting.title || deleting.name}</b>{" "}
              {t("نهائيًا.")}
            </p>
            {resource !== "products" && (
              <p className="muted">
                {t(
                  "قد توجد منتجات مرتبطة بهذا السجل. راجع العلاقات قبل الحذف.",
                )}
              </p>
            )}
            {deleteError && (
              <p className="field-error" role="alert">
                {t(deleteError)}
              </p>
            )}
            <div className="form-actions">
              <button
                disabled={deletingBusy}
                className="button danger"
                onClick={confirmDelete}
              >
                {deletingBusy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Trash2 size={16} />
                )}
                {t("تأكيد الحذف")}
              </button>
              <button
                disabled={deletingBusy}
                className="button secondary"
                onClick={() => setDeleting(null)}
              >
                {t("إلغاء")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
