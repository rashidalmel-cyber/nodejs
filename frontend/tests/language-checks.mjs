import path from "node:path";

export async function checkLanguages({
  page,
  check,
  artifacts,
  productId,
  failProducts,
}) {
  await page.evaluate(async () => {
    await document.fonts.load('400 16px "Tajawal"', "مرحبا");
    await document.fonts.load('400 16px "Roboto"', "Hello");
  });
  check(
    await page.evaluate(
      () =>
        document.fonts.check('400 16px "Tajawal"', "مرحبا") &&
        document.fonts.check('400 16px "Roboto"', "Hello"),
    ),
    "Both fonts load from the local application.",
  );
  check(
    await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily.startsWith("Tajawal"),
    ),
    "Arabic uses Tajawal.",
  );
  await page
    .getByRole("button", { name: "Switch to English", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Explore the collection", exact: true })
    .waitFor();
  check(
    (await page.locator("html").getAttribute("lang")) === "en" &&
      (await page.locator("html").getAttribute("dir")) === "ltr",
    "Switching language sets English and LTR.",
  );
  check(
    await page
      .getByRole("link", { name: "Explore the collection", exact: true })
      .isVisible(),
    "Storefront content is translated to English.",
  );
  check(
    await page.getByPlaceholder("Search for a product…").isVisible(),
    "Search placeholders are translated.",
  );
  check(
    await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily.startsWith("Roboto"),
    ),
    "English uses Roboto.",
  );
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "The English store fits a mobile viewport.",
  );
  await page.screenshot({
    path: path.join(artifacts, "store-mobile-en.png"),
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "Add Studio phone to bag", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Product added to your bag" })
    .waitFor();
  check(
    await page
      .getByRole("status")
      .filter({ hasText: "Product added to your bag" })
      .isVisible(),
    "Cart notifications are translated.",
  );
  await page.reload();
  await page.locator(".product-card").first().waitFor();
  check(
    (await page.locator("html").getAttribute("lang")) === "en",
    "Language selection survives a reload.",
  );
  await page
    .getByRole("link", { name: "Shopping bag, 1 items", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Bag summary", exact: true })
    .waitFor();
  check(
    await page
      .getByRole("heading", { name: "Bag summary", exact: true })
      .isVisible(),
    "The shopping bag is translated and its contents survive language changes.",
  );
  await page.goto(`http://127.0.0.1:5174/products/${productId}`);
  await page.locator(".detail-info").waitFor();
  check(
    await page
      .getByRole("button", { name: "Add to bag", exact: true })
      .isVisible(),
    "Product details and actions are translated.",
  );
  check(
    await page
      .getByRole("button", { name: "View image 1", exact: true })
      .isVisible(),
    "Image accessibility labels are translated.",
  );

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("http://127.0.0.1:5174/");
  await page.locator(".product-card").first().waitFor();
  check(
    Math.round(
      await page
        .locator(".hero.container")
        .evaluate((element) => element.getBoundingClientRect().width),
    ) === 1400,
    "Store content has a maximum width of 1400px.",
  );
  await page.screenshot({
    path: path.join(artifacts, "store-desktop-en.png"),
    fullPage: false,
  });
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.locator(".stat-card").first().waitFor();
  check(
    await page.getByRole("link", { name: "Products", exact: true }).isVisible(),
    "Administration navigation is translated.",
  );
  check(
    await page.getByText("Total products", { exact: true }).isVisible(),
    "Dashboard statistics are translated.",
  );
  check(
    await page
      .locator(".admin-main")
      .evaluate((element) => element.getBoundingClientRect().width <= 1400),
    "Administration content is limited to 1400px.",
  );
  check(
    await page
      .locator(".admin-sidebar")
      .evaluate((element) => element.getBoundingClientRect().left === 0),
    "English administration places its sidebar on the left.",
  );
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page.locator(".resource-toolbar input").fill("Studio");
  await page
    .getByRole("button", { name: "Edit Studio phone", exact: true })
    .click();
  check(
    (await page.getByLabel("Product name", { exact: true }).inputValue()) ===
      "Studio phone",
    "English edit forms preserve the original product data.",
  );
  await page.getByLabel("Discounted price ($)", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByText("The discounted price must be lower than the original price.", {
      exact: true,
    })
    .waitFor();
  check(
    await page
      .getByText(
        "The discounted price must be lower than the original price.",
        { exact: true },
      )
      .isVisible(),
    "Client validation messages are translated.",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Studio phone", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Delete product?", exact: true })
    .waitFor();
  check(
    await page
      .getByRole("heading", { name: "Delete product?", exact: true })
      .isVisible(),
    "Delete confirmations are translated.",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "التبديل إلى العربية", exact: true })
    .click();
  await page.getByRole("heading", { name: /المنتجات/ }).waitFor();
  check(
    (await page.locator("html").getAttribute("dir")) === "rtl" &&
      (await page.getByRole("heading", { name: /المنتجات/ }).isVisible()),
    "The admin interface switches back to Arabic and RTL.",
  );
  check(
    (await page.locator(".resource-toolbar input").inputValue()) === "Studio",
    "Switching languages preserves the active search.",
  );
  await page
    .getByRole("button", { name: "Switch to English", exact: true })
    .click();
  await page.reload();
  await page.locator("table tbody tr").first().waitFor();
  check(
    (await page.title()) === "Madar | Dashboard",
    "The page title follows the selected language.",
  );
  await page.screenshot({
    path: path.join(artifacts, "admin-desktop-en.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:5174/admin");
  await page.locator(".stat-card").first().waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".admin-sidebar").getBoundingClientRect().right <=
      0,
  );
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "The English admin layout fits a mobile viewport.",
  );
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .locator(".admin-sidebar")
    .getByRole("link", { name: "Brands", exact: true })
    .click();
  await page.getByRole("heading", { name: /Brands/ }).waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".admin-sidebar").getBoundingClientRect().right <=
      0,
  );
  check(
    await page
      .getByRole("button", { name: "Add brand", exact: true })
      .isVisible(),
    "The LTR mobile menu opens, navigates, and closes correctly.",
  );
  await page.screenshot({
    path: path.join(artifacts, "admin-mobile-en.png"),
    fullPage: false,
  });
  failProducts(true);
  await page.goto("http://127.0.0.1:5174/");
  await page
    .getByRole("heading", { name: "Unable to load data", exact: true })
    .waitFor();
  check(
    await page
      .getByRole("button", { name: "Try again", exact: true })
      .isVisible(),
    "Error and retry states are translated.",
  );
  failProducts(false);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.locator(".product-card").first().waitFor();
}
