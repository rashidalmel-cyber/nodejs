const assert = require('assert/strict');
const path = require('path');
const fs = require('fs/promises');
const mongoose = require('mongoose');
const slugify = require('slugify');
const dotenv = require('dotenv');
const Category = require('../models/CategoryModel');
const SubCategory = require('../models/SubCategoryModel');
const Brand = require('../models/BrandModel');
const Product = require('../models/productmodel');

dotenv.config({ path: path.join(__dirname, '..', 'config.env'), quiet: true });

const sourceUrl = 'https://dummyjson.com/products?limit=0';
const selection = [
  ['smartphones', 12, 'electronics', 'Phones'],
  ['laptops', 5, 'electronics', 'Laptops'],
  ['tablets', 3, 'electronics', 'Tablets'],
  ['mens-shirts', 5, 'Fashion', "Men's Shirts"],
  ['mens-shoes', 5, 'Fashion', "Men's Shoes"],
  ['womens-bags', 5, 'Fashion', "Women's Bags"],
  ['beauty', 5, 'Beauty & Personal Care', 'Makeup'],
  ['fragrances', 5, 'Beauty & Personal Care', 'Fragrances'],
  ['furniture', 5, 'furniture', null],
];
const furnitureTypes = {
  11: 'Beds',
  12: 'Sofas',
  13: 'Tables',
  14: 'Chairs',
  15: 'Bathroom Furniture',
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nameFilter = (name) => ({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });

async function prepareCatalogue() {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(20000) });
  assert.ok(response.ok, `Product source returned HTTP ${response.status}.`);
  const source = await response.json();
  const catalogue = selection.flatMap(([sourceCategory, count, category, subcategory]) => {
    const selected = source.products.filter((product) => product.category === sourceCategory
      && typeof product.brand === 'string' && product.brand.trim()).slice(0, count);
    assert.strictEqual(selected.length, count, `Not enough products in ${sourceCategory}.`);
    return selected.map((product) => {
      const priceAfterDiscount = Math.round(product.price
        * (1 - product.discountPercentage / 100) * 100) / 100;
      const data = {
        title: product.title,
        slug: slugify(product.title, { lower: true }),
        description: product.description,
        quantity: Math.max(1, product.stock),
        price: product.price,
        imageCover: product.thumbnail,
        images: [...new Set(product.images)],
        colors: [],
        sold: 0,
        ratingsQuantity: 0,
      };
      if (priceAfterDiscount >= 0 && priceAfterDiscount < product.price) {
        data.priceAfterDiscount = priceAfterDiscount;
      }
      return {
        sourceId: product.id,
        category,
        subcategory: subcategory || furnitureTypes[product.id],
        brand: product.brand.trim(),
        data,
      };
    });
  });
  assert.strictEqual(catalogue.length, 50);
  assert.strictEqual(new Set(catalogue.map((item) => item.data.slug)).size, 50);
  const placeholderId = new mongoose.Types.ObjectId();
  await Promise.all(catalogue.map(async (item) => {
    assert.ok(item.category && item.subcategory && item.brand, 'Missing product relationship.');
    await new Category({ name: item.category }).validate();
    await new SubCategory({ name: item.subcategory, category: placeholderId }).validate();
    await new Brand({ name: item.brand }).validate();
    await new Product({
      ...item.data, category: placeholderId, subcategories: [placeholderId], brand: placeholderId,
    }).validate();
  }));
  return catalogue;
}

async function checkImage(url) {
  assert.match(url, /^https:\/\/cdn\.dummyjson\.com\//, 'Unexpected image host.');
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Retry transient image failures sequentially.
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      assert.ok(response.ok, `Image returned HTTP ${response.status}: ${url}`);
      assert.match(response.headers.get('content-type') || '', /^image\//);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function checkImages(catalogue) {
  const urls = [...new Set(catalogue.flatMap((item) => [item.data.imageCover, ...item.data.images]))];
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < urls.length) {
      const url = urls[cursor];
      cursor += 1;
      // eslint-disable-next-line no-await-in-loop -- Limit concurrent image requests.
      await checkImage(url);
    }
  }));
  console.log(`Verified ${urls.length} public image URLs for ${catalogue.length} products.`);
  return urls.length;
}

async function seedCatalogue(catalogue) {
  await mongoose.connect(process.env.DB_URI, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([Category.init(), SubCategory.init(), Brand.init(), Product.init()]);
  return mongoose.connection.transaction(async (session) => {
    const created = { categories: 0, subcategories: 0, brands: 0, products: 0 };
    const cache = new Map();
    const getReference = async (Model, kind, name, extra = {}) => {
      const key = `${kind}:${name.toLowerCase()}`;
      if (cache.has(key)) return cache.get(key);
      let record = await Model.findOne(nameFilter(name)).session(session);
      if (!record) {
        [record] = await Model.create([{ name, slug: slugify(name, { lower: true }), ...extra }], { session });
        created[kind] += 1;
      }
      if (extra.category) {
        assert.strictEqual(String(record.category), String(extra.category),
          `Existing subcategory ${name} belongs to another category.`);
      }
      cache.set(key, record);
      return record;
    };
    const rows = [];
    // Transactions require sequential operations on their session.
    /* eslint-disable no-await-in-loop, no-restricted-syntax */
    for (const item of catalogue) {
      const category = await getReference(Category, 'categories', item.category);
      const subcategory = await getReference(SubCategory, 'subcategories', item.subcategory,
        { category: category._id });
      const brand = await getReference(Brand, 'brands', item.brand);
      let product = await Product.findOne({ slug: item.data.slug }).session(session);
      if (!product) {
        [product] = await Product.create([{
          ...item.data,
          category: category._id,
          subcategories: [subcategory._id],
          brand: brand._id,
        }], { session });
        created.products += 1;
      } else {
        assert.strictEqual(product.title, item.data.title, `Product slug conflict: ${item.data.slug}.`);
        assert.strictEqual(String(product.category), String(category._id));
        assert.strictEqual(String(product.brand), String(brand._id));
        assert.ok(product.subcategories.some((id) => String(id) === String(subcategory._id)));
      }
      rows.push({
        id: String(product._id), title: product.title,
        category: category.name, categoryId: String(category._id),
        subcategory: subcategory.name, subcategoryId: String(subcategory._id),
        brand: brand.name, brandId: String(brand._id),
      });
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */
    const stored = await Product.find({ _id: { $in: rows.map((row) => row.id) } })
      .populate('category').populate('subcategories').populate('brand').session(session);
    assert.strictEqual(stored.length, 50);
    stored.forEach((product) => {
      assert.ok(product.category && product.brand && product.subcategories.length);
      product.subcategories.forEach((subcategory) => {
        assert.ok(subcategory);
        assert.strictEqual(String(subcategory.category), String(product.category._id));
      });
    });
    return { created, products: rows };
  });
}

async function main() {
  const args = process.argv.slice(2);
  assert.ok(args.every((arg) => arg === '--apply'), 'Usage from the repository root: node backend/scripts/seedProducts.js [--apply]');
  console.log('Preparing 50 sample products with categories, subcategories and brands.');
  const catalogue = await prepareCatalogue();
  const verifiedImageUrls = await checkImages(catalogue);
  const dataDirectory = path.join(__dirname, 'data');
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(path.join(dataDirectory, 'sample-products.json'), `${JSON.stringify({
    source: sourceUrl, catalogue,
  }, null, 2)}\n`);
  if (!args.includes('--apply')) {
    console.log('Preview saved to backend/scripts/data/sample-products.json. No database writes.');
    return;
  }
  const result = await seedCatalogue(catalogue);
  const report = {
    completedAt: new Date().toISOString(), source: sourceUrl, verifiedImageUrls, ...result,
  };
  await fs.writeFile(path.join(dataDirectory, 'seed-products-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ created: result.created, verifiedProducts: result.products.length,
    verifiedImageUrls, report: 'backend/scripts/data/seed-products-report.json' }, null, 2));
}

main().catch((error) => {
  // Driver errors can contain connection details; keep credentials out of output.
  console.error(error instanceof assert.AssertionError ? error.message : `Seeding failed (${error.name}).`);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
