import { createContext, useContext, useEffect, useState } from "react";

const Context = createContext(null);
const key = "madar-cart-v1";
function initialCart() {
  try {
    const records = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(records)
      ? records.filter(
          (item) =>
            item?._id &&
            Number.isSafeInteger(item.count) &&
            item.count > 0 &&
            Number.isFinite(item.price),
        )
      : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children, notify }) {
  const [items, setItems] = useState(initialCart);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      /* The in-memory cart remains usable when storage is unavailable. */
    }
  }, [items]);
  const add = (product, count = 1) => {
    if (!product.quantity) return;
    const existing = items.find((item) => item._id === product._id);
    if ((existing?.count || 0) + count > product.quantity) {
      notify("الكمية المطلوبة تتجاوز المخزون المتاح.");
      return;
    }
    setItems((current) => {
      const found = current.find((item) => item._id === product._id);
      return found
        ? current.map((item) =>
            item._id === product._id
              ? {
                  ...product,
                  count: Math.min(item.count + count, product.quantity),
                }
              : item,
          )
        : [...current, { ...product, count }];
    });
    notify("تمت إضافة المنتج إلى السلة");
  };
  const changeCount = (id, count) =>
    setItems((current) =>
      current.map((item) =>
        item._id === id
          ? { ...item, count: Math.max(1, Math.min(count, item.quantity)) }
          : item,
      ),
    );
  const remove = (id) =>
    setItems((current) => current.filter((item) => item._id !== id));
  return (
    <Context.Provider
      value={{
        items,
        add,
        changeCount,
        remove,
        count: items.reduce((sum, item) => sum + item.count, 0),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export const useCart = () => useContext(Context);
