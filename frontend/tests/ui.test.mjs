import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { checkLanguages } from "./language-checks.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = path.join(root, "tests", "artifacts");
const category = {
  _id: "507f1f77bcf86cd799439011",
  name: "إلكترونيات",
  slug: "electronics",
};
const otherCategory = {
  _id: "507f1f77bcf86cd799439012",
  name: "صوتيات",
  slug: "audio",
};
const brand = { _id: "507f1f77bcf86cd799439031", name: "Madar", slug: "madar" };
const subcategory = {
  _id: "507f1f77bcf86cd799439021",
  name: "هواتف",
  slug: "phones",
  category,
};
const catalogue = {
  categories: [category, otherCategory],
  brands: [brand],
  subcategories: [subcategory],
  products: Array.from({ length: 28 }, (_, index) => ({
    _id: (index + 100).toString(16).padStart(24, "0"),
    title:
      index === 0
        ? "Studio phone"
        : index === 1
          ? "Pocket speaker"
          : `Everyday phone ${index + 1}`,
    description:
      "A carefully selected product for your everyday essentials and daily life.",
    price: 100 + index * 10,
    ...(index === 0 ? { priceAfterDiscount: 89 } : {}),
    quantity: index === 2 ? 0 : 12,
    imageCover: "/hero-phone.webp",
    images: ["/hero-phone.webp"],
    colors: ["Black"],
    category: index === 1 ? otherCategory : category,
    subcategories: index === 1 ? [] : [subcategory],
    brand,
    createdAt: "2026-01-01T12:00:00Z",
  })),
};
const firstProduct = catalogue.products[0];
let checks = 0;
let uploadCalls = 0;
let failProducts = false;
let failSave = false;
let browser;
let devServer;
let expressServer;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

async function mockApi(route) {
  const request = route.request();
  const url = new URL(request.url());
  const [resource, id] = url.pathname.replace("/api/v1/", "").split("/");
  const method = request.method();
  const respond = (data, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  if (resource === "images") {
    uploadCalls += 1;
    check(
      Boolean(request.postDataJSON().base64Image),
      "Uploads send an encoded image.",
    );
    return respond({ success: true, imageUrl: "/hero-phone.webp" });
  }
  if (resource === "products" && failProducts)
    return respond({ message: "Test connection unavailable." }, 503);
  const records = catalogue[resource];
  if (!records) return respond({ message: "Not found." }, 404);
  if (method === "GET") {
    if (id)
      return respond({
        status: "success",
        data: records.find((record) => record._id === id),
      });
    let data = [...records];
    const keyword = url.searchParams.get("keyword")?.toLowerCase();
    if (keyword)
      data = data.filter((record) =>
        `${record.title || record.name} ${record.description || ""}`
          .toLowerCase()
          .includes(keyword),
      );
    if (url.searchParams.has("category"))
      data = data.filter(
        (record) => record.category?._id === url.searchParams.get("category"),
      );
    if (url.searchParams.get("sort") === "price")
      data.sort((a, b) => a.price - b.price);
    if (url.searchParams.get("sort") === "-price")
      data.sort((a, b) => b.price - a.price);
    const limit = Number(url.searchParams.get("limit")) || 25;
    const page = Number(url.searchParams.get("page")) || 1;
    data = data.slice((page - 1) * limit, page * limit);
    return respond({
      status: "success",
      data,
      results: data.length,
      page,
      limit,
    });
  }
  if (method === "DELETE") {
    catalogue[resource] = records.filter((record) => record._id !== id);
    return respond({ status: "success", message: "Deleted." });
  }
  if (failSave)
    return respond(
      {
        message: "Validation failed.",
        errors: [{ path: "title", msg: "Product title is invalid." }],
      },
      400,
    );
  const body = request.postDataJSON();
  if (body.category)
    body.category = catalogue.categories.find(
      (record) => record._id === body.category,
    );
  if (body.brand)
    body.brand = catalogue.brands.find((record) => record._id === body.brand);
  if (body.subcategories)
    body.subcategories = body.subcategories.map((value) =>
      catalogue.subcategories.find((record) => record._id === value),
    );
  const record = id
    ? Object.assign(
        records.find((item) => item._id === id),
        body,
      )
    : {
        ...body,
        _id: Date.now().toString(16).padStart(24, "0"),
        createdAt: new Date().toISOString(),
      };
  if (!id) records.push(record);
  return respond({ status: "success", data: record }, id ? 200 : 201);
}

try {
  await mkdir(artifacts, { recursive: true });
  devServer = await createServer({
    root,
    configFile: path.join(root, "vite.config.js"),
    server: { port: 5174, strictPort: true, host: "127.0.0.1" },
  });
  await devServer.listen();
  const ready = await fetch("http://127.0.0.1:5174/");
  check(ready.status === 200, "The frontend serves successfully.");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : { channel: "chrome" }),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  await context.route("**/api/v1/**", mockApi);
  // UI verification is deterministic and does not need external fonts or services.
  await context.route("https://fonts.googleapis.com/**", (route) =>
    route.abort(),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5174/");
  await page.locator(".product-card").first().waitFor();
  check(
    (await page.locator(".product-card").count()) === 25,
    "Store pages contain 25 products.",
  );
  check(
    (await page.locator("html").getAttribute("dir")) === "rtl",
    "The frontend uses RTL layout.",
  );
  check(
    await page
      .getByRole("button", { name: "إضافة Everyday phone 3 إلى السلة" })
      .isDisabled(),
    "Out-of-stock products cannot be added.",
  );
  await page.screenshot({
    path: path.join(artifacts, "store-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".product-card").length === 3,
  );
  check(
    new URL(page.url()).searchParams.get("page") === "2",
    "Pagination updates the URL and results.",
  );
  await page.getByRole("button", { name: "صوتيات", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".product-card").length === 1,
  );
  check(
    (await page.locator(".product-title").textContent()).includes(
      "Pocket speaker",
    ),
    "Category filtering returns matching products.",
  );
  check(
    !new URL(page.url()).searchParams.has("page"),
    "Changing category resets pagination.",
  );
  await page.getByRole("button", { name: "كل المنتجات", exact: true }).click();
  await page.locator(".search-input input").fill("Studio");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".product-card").length === 1 &&
      document.querySelector(".product-title")?.textContent === "Studio phone",
  );
  check(
    new URL(page.url()).searchParams.get("keyword") === "Studio",
    "Search updates the API query and URL.",
  );
  await page
    .getByRole("button", { name: "إضافة Studio phone إلى السلة" })
    .click();
  await page.getByRole("link", { name: /سلة التسوق، 1 منتجات/ }).click();
  check(
    (await page.locator(".cart-item").textContent()).includes("Studio phone"),
    "The bag contains the chosen product.",
  );
  await page.getByRole("button", { name: "زيادة كمية Studio phone" }).click();
  check(
    (await page.locator(".summary-total").textContent()).includes("$178.00"),
    "Bag totals use discounted prices and quantities.",
  );
  await page.reload();
  await page.locator(".cart-item").waitFor();
  check(
    (await page.locator(".quantity-control span").textContent()) === "2",
    "The bag persists after reload.",
  );
  await page.goto(`http://127.0.0.1:5174/products/${firstProduct._id}`);
  await page.locator(".detail-info").waitFor();
  check(
    (await page.locator("h1").textContent()) === "Studio phone",
    "Product detail routes load their record.",
  );
  await page.getByRole("button", { name: "زيادة الكمية", exact: true }).click();
  await page
    .getByRole("button", { name: "أضف إلى السلة", exact: true })
    .click();
  await page.goto("http://127.0.0.1:5174/cart");
  await page.locator(".cart-item").waitFor();
  check(
    (await page.locator(".quantity-control span").textContent()) === "4",
    "Detail quantities are added to the shared bag.",
  );
  await page
    .getByRole("button", { name: "إزالة Studio phone من السلة" })
    .click();
  check(
    await page
      .getByRole("heading", { name: "السلة بانتظار اختياراتك" })
      .isVisible(),
    "Removing the last item shows an empty bag.",
  );

  await page.goto("http://127.0.0.1:5174/admin");
  await page.locator(".stat-card").first().waitFor();
  check(
    (await page.locator(".stat-card strong").first().textContent()) === "28",
    "The dashboard counts all product pages.",
  );
  await page.screenshot({
    path: path.join(artifacts, "admin-desktop.png"),
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:5174/admin/categories");
  await page
    .getByRole("button", { name: "إضافة تصنيف", exact: true })
    .first()
    .click();
  await page.getByLabel("الاسم", { exact: true }).fill("إكسسوارات");
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تعديل إكسسوارات", exact: true })
    .waitFor();
  check(
    catalogue.categories.some((item) => item.name === "إكسسوارات"),
    "Category creation sends a POST and refreshes the list.",
  );
  await page
    .getByRole("button", { name: "تعديل إكسسوارات", exact: true })
    .click();
  await page.getByLabel("الاسم", { exact: true }).fill("هدايا مميزة");
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await page
    .getByRole("button", { name: "حذف هدايا مميزة", exact: true })
    .waitFor();
  check(
    catalogue.categories.some((item) => item.name === "هدايا مميزة"),
    "Editing a category sends its updated name.",
  );
  await page
    .getByRole("button", { name: "حذف هدايا مميزة", exact: true })
    .click();
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  check(
    catalogue.categories.some((item) => item.name === "هدايا مميزة"),
    "Canceling deletion keeps the record.",
  );
  await page
    .getByRole("button", { name: "حذف هدايا مميزة", exact: true })
    .click();
  await page.getByRole("button", { name: "تأكيد الحذف", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  check(
    !catalogue.categories.some((item) => item.name === "هدايا مميزة"),
    "Confirmed deletion removes the record.",
  );

  await page.goto("http://127.0.0.1:5174/admin/subcategories");
  await page
    .getByRole("button", { name: "إضافة تصنيف فرعي", exact: true })
    .first()
    .click();
  await page.getByLabel("الاسم", { exact: true }).fill("إكسسوارات هواتف");
  await page
    .getByLabel("التصنيف الرئيسي", { exact: true })
    .selectOption(category._id);
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تعديل إكسسوارات هواتف", exact: true })
    .waitFor();
  check(
    catalogue.subcategories.some(
      (item) =>
        item.name === "إكسسوارات هواتف" && item.category._id === category._id,
    ),
    "Subcategory forms save their parent category.",
  );

  await page.goto("http://127.0.0.1:5174/admin/products?new=1");
  await page.getByLabel("اسم المنتج", { exact: true }).fill("Test headphones");
  await page
    .getByLabel("وصف المنتج", { exact: false })
    .fill(
      "Comfortable wireless headphones with a carefully designed sound experience.",
    );
  await page
    .getByLabel("التصنيف الرئيسي", { exact: true })
    .selectOption(category._id);
  await page
    .getByLabel("العلامة التجارية (اختياري)", { exact: true })
    .selectOption(brand._id);
  await page.getByLabel("هواتف", { exact: true }).check();
  await page.getByLabel("السعر ($)", { exact: true }).fill("120");
  await page.getByLabel("بعد الخصم ($)", { exact: false }).fill("99");
  await page.getByLabel("الكمية المتاحة", { exact: true }).fill("8");
  await page.locator("input[type=file]").setInputFiles({
    name: "cover.webp",
    mimeType: "image/webp",
    buffer: await readFile(path.join(root, "public", "hero-phone.webp")),
  });
  await page.waitForFunction(
    () =>
      document.querySelector('input[placeholder="https://…"]')?.value ===
      "/hero-phone.webp",
  );
  check(uploadCalls === 1, "The editor uploads a cover through the image API.");
  failSave = true;
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await page.locator(".form-errors").waitFor();
  check(
    (await page.locator(".form-errors").textContent()).includes(
      "Product title is invalid.",
    ),
    "The editor displays server field errors.",
  );
  check(
    (await page.getByLabel("اسم المنتج", { exact: true }).inputValue()) ===
      "Test headphones",
    "Failed submission preserves form values.",
  );
  failSave = false;
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  const created = catalogue.products.find(
    (item) => item.title === "Test headphones",
  );
  check(
    created?.price === 120 &&
      created.priceAfterDiscount === 99 &&
      created.quantity === 8,
    "Product creation sends numeric price and quantity fields.",
  );
  check(
    created?.category?._id === category._id &&
      created.brand?._id === brand._id &&
      created.subcategories[0]._id === subcategory._id,
    "Product relationships are saved as selected IDs.",
  );
  await page.locator(".resource-toolbar input").fill("Test headphones");
  await page
    .getByRole("button", { name: "تعديل Test headphones", exact: true })
    .click();
  await page
    .getByLabel("اسم المنتج", { exact: true })
    .fill("Updated headphones");
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  check(
    created.title === "Updated headphones",
    "Product updates use the selected record.",
  );
  await page.locator(".resource-toolbar input").fill("Updated headphones");
  await page
    .getByRole("button", { name: "حذف Updated headphones", exact: true })
    .click();
  await page.getByRole("button", { name: "تأكيد الحذف", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  check(
    !catalogue.products.some((item) => item.title === "Updated headphones"),
    "Products can be deleted after confirmation.",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:5174/");
  await page.locator(".product-card").first().waitFor();
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "The storefront fits a mobile viewport.",
  );
  await page.screenshot({
    path: path.join(artifacts, "store-mobile.png"),
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:5174/admin");
  await page.locator(".stat-card").first().waitFor();
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "The admin layout fits a mobile viewport.",
  );
  await page.getByRole("button", { name: "فتح القائمة", exact: true }).click();
  check(
    await page
      .locator(".admin-sidebar")
      .evaluate((element) => element.classList.contains("open")),
    "The mobile admin menu opens.",
  );
  await page
    .locator(".admin-sidebar")
    .getByRole("link", { name: "العلامات التجارية", exact: true })
    .click();
  await page.getByRole("heading", { name: /العلامات التجارية/ }).waitFor();
  check(
    !(await page
      .locator(".admin-sidebar")
      .evaluate((element) => element.classList.contains("open"))),
    "Navigating closes the mobile menu.",
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".admin-sidebar").getBoundingClientRect().left >=
      innerWidth,
  );
  await page.screenshot({
    path: path.join(artifacts, "admin-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "إضافة علامة تجارية", exact: true })
    .first()
    .click();
  await page.getByLabel("الاسم", { exact: true }).fill("Local brand");
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تعديل Local brand", exact: true })
    .waitFor();
  check(
    catalogue.brands.some((item) => item.name === "Local brand"),
    "Brand creation works on mobile.",
  );

  failProducts = true;
  await page.goto("http://127.0.0.1:5174/");
  await page.getByRole("heading", { name: "تعذّر تحميل البيانات" }).waitFor();
  check(
    await page
      .getByRole("button", { name: "أعد المحاولة", exact: true })
      .isVisible(),
    "API failure exposes a retry action.",
  );
  failProducts = false;
  await page.getByRole("button", { name: "أعد المحاولة", exact: true }).click();
  await page.locator(".product-card").first().waitFor();
  check(
    (await page.locator(".product-card").count()) === 25,
    "Retry restores the catalogue.",
  );
  await checkLanguages({
    page,
    check,
    artifacts,
    productId: firstProduct._id,
    failProducts: (value) => {
      failProducts = value;
    },
  });
  check(errors.length === 0, `No browser runtime errors: ${errors.join("; ")}`);

  // Verify same-origin production hosting without opening a database connection.
  const require = createRequire(import.meta.url);
  const app = require("../../backend/app");
  expressServer = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => expressServer.once("listening", resolve));
  const address = `http://127.0.0.1:${expressServer.address().port}`;
  for (const route of [
    "/",
    "/admin",
    "/admin/products",
    "/cart",
    `/products/${firstProduct._id}`,
  ]) {
    const response = await fetch(`${address}${route}`);
    check(
      response.status === 200 &&
        (await response.text()).includes('<div id="root">'),
      `Express serves the built React route ${route}.`,
    );
  }
  const missingApi = await fetch(`${address}/api/v1/not-a-route`);
  check(
    missingApi.status === 404 &&
      (await missingApi.json()).message.includes("Route not found"),
    "Unknown API routes remain JSON 404 responses.",
  );
  console.log(
    `Passed ${checks} browser and production hosting checks. API data is mocked; no database records or Cloudinary assets changed.`,
  );
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    await page
      .screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true })
      .catch(() => {});
    console.error(`UI check failed at ${page.url()}`);
  }
  throw error;
} finally {
  await browser?.close();
  await devServer?.close();
  if (expressServer)
    await new Promise((resolve) => expressServer.close(resolve));
}
