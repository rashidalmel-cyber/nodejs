export class ApiError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.errors = errors;
  }
}

export async function api(path, { body, ...options } = {}) {
  let response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      ...options,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(
      "تعذّر الاتصال بالخادم. تأكد من تشغيل الـ Backend ثم أعد المحاولة.",
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      result?.message || "تعذّر إتمام العملية. حاول مرة أخرى.",
      result?.errors,
    );
  if (
    !result ||
    (result.data === undefined && !result.success && !result.status)
  ) {
    throw new ApiError(
      "استجابة غير متوقعة من الخادم. تحقق من إعداد اتصال الـ API.",
    );
  }
  return result;
}

export async function allRecords(resource, signal) {
  const records = [];
  for (let page = 1; page <= 1000; page += 1) {
    const result = await api(`${resource}?page=${page}&limit=100`, { signal });
    records.push(...result.data);
    if (result.data.length < 100) return records;
  }
  throw new ApiError("عدد السجلات كبير جدًا. يرجى تضييق نطاق البحث.");
}

export const idOf = (value) => value?._id || value || "";
export const priceOf = (product) => product.priceAfterDiscount ?? product.price;
export const money = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value || 0,
  );

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("تعذّرت قراءة الصورة."));
    reader.readAsDataURL(file);
  });
}
