import { I18nProvider, useI18n } from "./i18n";
import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import { CartProvider } from "./CartContext";
import { Cart, ProductDetail, Store, StoreLayout } from "./Store";
import { AdminLayout, Overview, ResourcePage } from "./Admin";
import { EmptyState, Toast } from "./components";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-600.css";
import "@fontsource/roboto/latin-700.css";
import "@fontsource/tajawal/arabic-400.css";
import "@fontsource/tajawal/arabic-500.css";
import "@fontsource/tajawal/arabic-700.css";
import "./styles.css";

function PageTitle() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = pathname.startsWith("/admin")
      ? t("مدار | لوحة الإدارة")
      : pathname === "/cart"
        ? t("مدار | سلة التسوق")
        : t("مدار | المتجر");
  }, [pathname, t]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const notify = useCallback((text) => setMessage(text), []);
  const closeToast = useCallback(() => setMessage(""), []);
  return (
    <BrowserRouter>
      <CartProvider notify={notify}>
        <PageTitle />
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<Store />} />
            <Route path="products/:id" element={<ProductDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route
              path="*"
              element={
                <EmptyState
                  title={t("الصفحة غير موجودة")}
                  description={t("يمكنك العودة إلى المتجر لمتابعة التصفح.")}
                >
                  <Link to="/" className="button primary">
                    {t("العودة للمتجر")}
                  </Link>
                </EmptyState>
              }
            />
          </Route>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route
              path=":resource"
              element={<ResourcePage notify={notify} />}
            />
          </Route>
        </Routes>
        <Toast message={message} onClose={closeToast} />
      </CartProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
