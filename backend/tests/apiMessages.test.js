/* eslint-disable no-await-in-loop, no-restricted-syntax -- Scenarios share fixtures and run sequentially. */
const assert = require('assert');
const mongoose = require('mongoose');
const { Writable } = require('stream');
const cloudinary = require('cloudinary').v2;
const Category = require('../models/CategoryModel');
const SubCategory = require('../models/SubCategoryModel');
const Brand = require('../models/BrandModel');
const Product = require('../models/productmodel');
const app = require('../app');

const categoryId = '507f1f77bcf86cd799439011';
const otherCategoryId = '507f1f77bcf86cd799439012';
const subCategoryId = '507f1f77bcf86cd799439021';
const otherSubCategoryId = '507f1f77bcf86cd799439022';
const brandId = '507f1f77bcf86cd799439031';
const otherBrandId = '507f1f77bcf86cd799439032';
const productId = '507f1f77bcf86cd799439041';
const otherProductId = '507f1f77bcf86cd799439042';
const missingId = '507f1f77bcf86cd799439099';
const categories = new Map();
const subCategories = new Map();
const brands = new Map();
const products = new Map();
const productBody = {
  title: 'Test phone',
  description: 'A detailed description of this test phone.',
  quantity: 5,
  price: 100,
  imageCover: 'phone.jpg',
  category: categoryId,
  subcategories: [subCategoryId],
  brand: brandId,
  colors: ['Black'],
  images: ['phone-back.jpg'],
};
let databaseError;
let writeCalls;
let checks = 0;
const originals = [];

function reset() {
  categories.clear();
  categories.set(categoryId, {
    _id: categoryId,
    name: 'Phones',
    slug: 'phones',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    __v: 0,
  });
  categories.set(otherCategoryId, { _id: otherCategoryId, name: 'Books', slug: 'books' });
  subCategories.clear();
  subCategories.set(subCategoryId, { _id: subCategoryId, name: 'Nokia', slug: 'nokia', category: categoryId });
  subCategories.set(otherSubCategoryId, { _id: otherSubCategoryId, name: 'Samsung', slug: 'samsung', category: categoryId });
  brands.clear();
  brands.set(brandId, { _id: brandId, name: 'Apple', slug: 'apple' });
  brands.set(otherBrandId, { _id: otherBrandId, name: 'Samsung', slug: 'samsung' });
  products.clear();
  products.set(productId, {
    _id: productId, ...productBody, slug: 'test-phone', priceAfterDiscount: 80,
    createdAt: '2026-01-02T00:00:00.000Z',
  });
  products.set(otherProductId, {
    _id: otherProductId, ...productBody, title: 'Other phone', slug: 'other-phone',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  databaseError = undefined;
  writeCalls = 0;
}

function checkDatabase() {
  if (databaseError) throw databaseError;
}

function duplicateError() {
  return Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyPattern: { name: 1 } });
}

function mockModel(Model, records) {
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const project = (record, options = {}) => {
    if (!record) return null;
    const result = copy(record);
    const projection = options.projection || {};
    const fields = Object.keys(projection).filter((field) => projection[field] === 1);
    if (!fields.length) return result;
    const selected = {};
    if (projection._id !== 0) selected._id = result._id;
    fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(result, field)) selected[field] = result[field];
    });
    return selected;
  };
  const replacements = {
    find: (filter, options = {}) => {
      checkDatabase();
      let matches = [...records.values()];
      if (filter._id) {
        const ids = filter._id.$in || [filter._id];
        matches = matches.filter((record) => ids.some((id) => String(id) === String(record._id)));
      }
      if (filter.category) {
        matches = matches.filter((record) => String(record.category) === String(filter.category));
      }
      if (filter.name) {
        const namePattern = new RegExp(filter.name.$regex, filter.name.$options);
        matches = matches.filter((record) => namePattern.test(record.name));
      }
      if (filter.$or) {
        matches = matches.filter((record) => filter.$or.some((condition) => (
          Object.entries(condition).every(([field, value]) => (
            new RegExp(value.$regex, value.$options).test(record[field] || '')
          ))
        )));
      }
      if (options.sort) {
        matches.sort((left, right) => {
          for (const [field, direction] of Object.entries(options.sort)) {
            const leftValue = left[field] === undefined ? null : left[field];
            const rightValue = right[field] === undefined ? null : right[field];
            if (leftValue !== rightValue) {
              if (leftValue === null) return -direction;
              if (rightValue === null) return direction;
              return (leftValue < rightValue ? -1 : 1) * direction;
            }
          }
          return 0;
        });
      }
      const offset = options.skip || 0;
      matches = matches.slice(offset, options.limit ? offset + options.limit : undefined);
      return {
        toArray: async () => matches.map((record) => project(record, options)),
      };
    },
    findOne: async (filter, options) => {
      checkDatabase();
      return project(records.get(String(filter._id).toLowerCase()), options);
    },
    insertOne: async (data) => {
      checkDatabase();
      writeCalls += 1;
      if (data.name !== undefined && [...records.values()].some((record) => record.name === data.name)) throw duplicateError();
      records.set(String(data._id), copy(data));
      return { acknowledged: true, insertedId: data._id };
    },
    findOneAndUpdate: async (filter, update, options) => {
      checkDatabase();
      const id = String(filter._id);
      const data = update.$set || {};
      const current = records.get(String(id).toLowerCase());
      if (!current) return null;
      if (data.name !== undefined
        && [...records.values()].some((record) => String(record._id) !== String(id) && record.name === data.name)) {
        throw duplicateError();
      }
      const updated = copy({ ...current, ...data });
      writeCalls += 1;
      records.set(id, updated);
      return copy(options.returnDocument === 'after' ? updated : current);
    },
    findOneAndDelete: async (filter) => {
      checkDatabase();
      const id = String(filter._id);
      const record = records.get(String(id).toLowerCase()) || null;
      if (record) { records.delete(String(id).toLowerCase()); writeCalls += 1; }
      return record ? copy(record) : null;
    },
  };
  Object.entries(replacements).forEach(([name, implementation]) => {
    const original = Model.collection[name];
    originals.push(() => { Model.collection[name] = original; });
    Model.collection[name] = implementation;
  });
}

async function runTests() {
  const missingNameError = await new SubCategory({ category: categoryId }).validate().catch((error) => error);
  assert.ok(missingNameError && missingNameError.errors.name);
  const minimalProduct = new Product({
    ...productBody, slug: 'test-phone', subcategories: undefined, brand: undefined,
  });
  await minimalProduct.validate();
  assert.deepStrictEqual(minimalProduct.subcategories.toObject(), []);
  assert.strictEqual(minimalProduct.brand, undefined);
  const originalMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  mockModel(Category, categories);
  mockModel(SubCategory, subCategories);
  mockModel(Brand, brands);
  mockModel(Product, products);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, path, expected, options = {}) => {
      const response = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...options.headers },
        body: options.raw === undefined ? JSON.stringify(options.body) : options.raw,
        signal: AbortSignal.timeout(3000),
      });
      const body = await response.json();
      assert.strictEqual(response.status, expected, `${method} ${path}: ${JSON.stringify(body)}`);
      if (!options.listFormat && !options.uploadFormat) {
        assert.strictEqual(typeof body.message, 'string');
        assert.ok(body.message.length > 0);
      }
      if (expected >= 400) {
        assert.strictEqual(body.statusCode, expected);
        assert.strictEqual(body.status, expected < 500 ? 'fail' : 'error');
        assert.strictEqual(body.path, path);
        assert.strictEqual(body.method, method);
      } else if (!options.listFormat && !options.uploadFormat) {
        assert.strictEqual(body.status, 'success');
      }
      if (options.message) assert.match(body.message, options.message);
      checks += 1;
      return body;
    };

    for (const resource of [
      { path: '/api/v1/categories', id: categoryId, duplicate: 'Books', name: 'Category' },
      { path: '/api/v1/subcategories', id: subCategoryId, duplicate: 'Samsung', name: 'Subcategory' },
      { path: '/api/v1/brands', id: brandId, duplicate: 'Samsung', name: 'Brand' },
    ]) {
      const validBody = { name: 'New name', category: categoryId };
      for (const method of ['GET', 'PUT', 'DELETE']) {
        for (const invalidId of ['invalid', '123']) {
          reset();
          const result = await request(method, `${resource.path}/${invalidId}`, 400, {
            body: method === 'GET' ? undefined : validBody,
            message: /Expected 24 hexadecimal characters/,
          });
          assert.strictEqual(result.errors[0].path, 'id');
          assert.strictEqual(writeCalls, 0);
        }
        reset();
        await request(method, `${resource.path}/${missingId}`, 404, {
          body: method === 'GET' ? undefined : validBody,
          message: new RegExp(`${resource.name} not found`),
        });
        assert.strictEqual(writeCalls, 0);
      }
      for (const method of ['POST', 'PUT']) {
        for (const name of [undefined, '', '   ', 123, [], {}, 'A', 'x'.repeat(33)]) {
          reset();
          const result = await request(method, resource.path + (method === 'PUT' ? `/${resource.id}` : ''), 400, {
            body: { name, category: categoryId }, message: /name/,
          });
          assert.ok(result.errors.some((error) => error.path === 'name'));
          assert.strictEqual(writeCalls, 0);
        }
        reset();
        await request(method, resource.path + (method === 'PUT' ? `/${resource.id}` : ''), 409, {
          body: { name: resource.duplicate, category: categoryId }, message: /already exists/,
        });
      }
      reset();
      await request('GET', `${resource.path}?page=-1`, 400, { message: /positive whole numbers/ });
      await request('GET', `${resource.path}?limit=1.5`, 400, { message: /positive whole numbers/ });
      const listFormat = resource.name === 'Subcategory';
      const list = await request('GET', `${resource.path}?page=2&limit=1`, 200, { listFormat });
      assert.strictEqual(list.page, 2);
      assert.strictEqual(list.results, 1);
      if (resource.name === 'Subcategory') {
        assert.deepStrictEqual(Object.keys(list), ['results', 'page', 'data']);
        assert.deepStrictEqual(list.data[0].category, categories.get(categoryId));
      } else {
        assert.strictEqual(list.limit, 1);
      }
      const empty = await request('GET', `${resource.path}?page=10`, 200,
        listFormat ? { listFormat } : { message: /No .* found/ });
      if (listFormat) {
        assert.deepStrictEqual(empty, { results: 0, page: 10, data: [] });
        const firstPage = await request('GET', resource.path, 200, { listFormat });
        assert.strictEqual(firstPage.page, 1);
        assert.strictEqual(firstPage.results, 2);
        assert.strictEqual(firstPage.data.length, 2);
      } else {
        assert.strictEqual(empty.limit, 25);
      }
      assert.deepStrictEqual(empty.data, []);
      const single = await request('GET', `${resource.path}/${resource.id}`, 200, { message: /retrieved successfully/ });
      if (resource.name === 'Subcategory') {
        assert.deepStrictEqual(single.data.category, { _id: categoryId, name: 'Phones' });
      }
      const created = await request('POST', resource.path, 201, { body: validBody, message: /created successfully/ });
      assert.strictEqual(created.data.name, validBody.name);
      if (resource.name === 'Subcategory') {
        assert.deepStrictEqual(created.data.category, { _id: categoryId, name: 'Phones' });
        assert.strictEqual(subCategories.get(created.data._id).category, categoryId);
      }
      const updated = await request('PUT', `${resource.path}/${resource.id}`, 200, {
        body: { name: 'Updated name' }, message: /updated successfully/,
      });
      assert.strictEqual(updated.data.name, 'Updated name');
      assert.strictEqual(updated.data.slug, 'updated-name');
      if (resource.name === 'Subcategory') {
        assert.deepStrictEqual(updated.data.category, { _id: categoryId, name: 'Phones' });
        assert.strictEqual(subCategories.get(resource.id).category, categoryId);
      }
      await request('DELETE', `${resource.path}/${resource.id}`, 200, { message: /deleted successfully/ });
      await request('GET', `${resource.path}/${resource.id}`, 404, { message: /not found/ });
    }

    reset();
    const brandPath = '/api/v1/brands';
    const huaweiId = '507f1f77bcf86cd799439033';
    const huaweiPlusId = '507f1f77bcf86cd799439034';
    brands.set(huaweiId, { _id: huaweiId, name: 'Huawei', slug: 'huawei' });
    brands.set(huaweiPlusId, { _id: huaweiPlusId, name: 'Huawei+', slug: 'huawei-plus' });
    const searchBrands = async (keyword, suffix = '') => request(
      'GET', `${brandPath}?keyword=${encodeURIComponent(keyword)}${suffix}`, 200,
    );
    const matchedBrands = await searchBrands('Huawei', '&page=1&limit=10');
    assert.deepStrictEqual(matchedBrands.data.map((brand) => brand._id), [huaweiId, huaweiPlusId]);
    assert.strictEqual(matchedBrands.results, 2);
    assert.strictEqual(matchedBrands.limit, 10);
    const partialBrands = await searchBrands('  uAw  ');
    assert.deepStrictEqual(partialBrands.data.map((brand) => brand._id), [huaweiId, huaweiPlusId]);
    const brandPage = await searchBrands('Huawei', '&page=2&limit=1');
    assert.deepStrictEqual(brandPage.data.map((brand) => brand._id), [huaweiPlusId]);
    assert.strictEqual(brandPage.page, 2);
    assert.strictEqual(brandPage.results, 1);
    const emptyBrandPage = await searchBrands('Huawei', '&page=3&limit=1');
    assert.deepStrictEqual(emptyBrandPage.data, []);
    assert.strictEqual(emptyBrandPage.results, 0);
    const literalBrand = await searchBrands('Huawei+');
    assert.deepStrictEqual(literalBrand.data.map((brand) => brand._id), [huaweiPlusId]);
    for (const keyword of ['missing brand', '.*', '(a+)+$', '[']) {
      const noBrands = await searchBrands(keyword);
      assert.deepStrictEqual(noBrands.data, []);
      assert.strictEqual(noBrands.results, 0);
      assert.strictEqual(noBrands.message, 'No brands found.');
    }
    for (const keyword of ['', '   ']) {
      const allBrands = await searchBrands(keyword);
      assert.strictEqual(allBrands.results, 4);
      assert.strictEqual(allBrands.limit, 25);
    }
    const trimmedBrandKeyword = await searchBrands(`${' '.repeat(200)}Huawei${' '.repeat(200)}`);
    assert.strictEqual(trimmedBrandKeyword.results, 2);
    assert.strictEqual(writeCalls, 0);
    databaseError = new Error('Invalid search must be rejected before database access');
    for (const query of ['keyword=Huawei&keyword=Apple', 'keyword=&keyword=', `keyword=${'x'.repeat(201)}`]) {
      const invalidBrandSearch = await request('GET', `${brandPath}?${query}`, 400);
      assert.strictEqual(invalidBrandSearch.errors[0].path, 'keyword');
    }
    reset();

    const categoryPath = '/api/v1/categories';
    const printersId = '507f1f77bcf86cd799439013';
    const printersPlusId = '507f1f77bcf86cd799439014';
    categories.set(printersId, { _id: printersId, name: 'Printers', slug: 'printers' });
    categories.set(printersPlusId, { _id: printersPlusId, name: 'Printers+', slug: 'printers-plus' });
    const searchCategories = async (keyword, suffix = '') => request(
      'GET', `${categoryPath}?keyword=${encodeURIComponent(keyword)}${suffix}`, 200,
    );
    const matchedCategories = await searchCategories('pr', '&page=1&limit=10');
    assert.deepStrictEqual(matchedCategories.data.map((category) => category._id),
      [printersId, printersPlusId]);
    assert.strictEqual(matchedCategories.results, 2);
    assert.strictEqual(matchedCategories.page, 1);
    assert.strictEqual(matchedCategories.limit, 10);
    const partialCategories = await searchCategories('  RIN  ');
    assert.strictEqual(partialCategories.results, 2);
    const categoryPage = await searchCategories('pr', '&page=2&limit=1');
    assert.deepStrictEqual(categoryPage.data.map((category) => category._id), [printersPlusId]);
    assert.strictEqual(categoryPage.results, 1);
    const literalCategory = await searchCategories('Printers+');
    assert.deepStrictEqual(literalCategory.data.map((category) => category._id), [printersPlusId]);
    for (const keyword of ['missing category', '.*', '[']) {
      const noCategories = await searchCategories(keyword);
      assert.deepStrictEqual(noCategories.data, []);
      assert.strictEqual(noCategories.results, 0);
      assert.strictEqual(noCategories.message, 'No categories found.');
    }
    const allCategories = await searchCategories('   ');
    assert.strictEqual(allCategories.results, 4);
    assert.strictEqual(allCategories.limit, 25);
    assert.strictEqual(writeCalls, 0);
    databaseError = new Error('Invalid category search must be rejected before database access');
    for (const query of ['keyword=pr&keyword=Books', 'keyword=&keyword=', `keyword=${'x'.repeat(201)}`]) {
      const invalidCategorySearch = await request('GET', `${categoryPath}?${query}`, 400);
      assert.strictEqual(invalidCategorySearch.errors[0].path, 'keyword');
    }
    reset();

    const productPath = '/api/v1/products';

    for (const query of ['category=invalid', 'category=', `category=${categoryId}&category=${otherCategoryId}`]) {
      databaseError = new Error('Invalid category filters must be rejected before database access');
      const invalid = await request('GET', `${productPath}?${query}`, 400);
      assert.strictEqual(invalid.errors[0].path, 'category');
    }
    reset();
    products.get(otherProductId).category = otherCategoryId;
    const categoryProducts = await request('GET', `${productPath}?category=${categoryId}`, 200);
    assert.deepStrictEqual(categoryProducts.data.map((item) => item._id), [productId]);
    const searchedCategory = await request('GET', `${productPath}?category=${otherCategoryId}&keyword=Other&sort=price`, 200);
    assert.deepStrictEqual(searchedCategory.data.map((item) => item._id), [otherProductId]);
    const missingCategoryProducts = await request('GET', `${productPath}?category=${missingId}`, 200);
    assert.deepStrictEqual(missingCategoryProducts.data, []);
    reset();

    // Every list endpoint must reject malformed pagination before reading the database.
    for (const path of ['/api/v1/categories', '/api/v1/brands', '/api/v1/subcategories',
      `/api/v1/categories/${categoryId}/subcategories`, productPath]) {
      reset();
      databaseError = new Error('Pagination should be rejected before database access');
      for (const query of ['page=', 'limit=', 'page=0', 'page=1.0', 'page=1e2', 'page=0x10',
        'page=%20', 'page=%2B1', 'page=1&page=2', 'limit=1&limit=2',
        'page=9007199254740992', 'page=9007199254740991&limit=2']) {
        const invalid = await request('GET', `${path}?${query}`, 400, { message: /positive whole numbers/ });
        assert.ok(['page', 'limit'].includes(invalid.errors[0].path));
      }
      reset();
      const defaults = await request('GET', path, 200, { listFormat: path.includes('subcategories') });
      assert.strictEqual(defaults.page, 1);
      assert.strictEqual(defaults.results, 2);
      if (!path.includes('subcategories')) assert.strictEqual(defaults.limit, 25);
      const leadingZeros = await request('GET', `${path}?page=01&limit=01`, 200,
        { listFormat: path.includes('subcategories') });
      assert.strictEqual(leadingZeros.page, 1);
      assert.strictEqual(leadingZeros.results, 1);
    }

    reset();
    for (let index = 1; index <= 30; index += 1) {
      const id = index.toString(16).padStart(24, '0');
      categories.set(id, { _id: id, name: `Category ${index}` });
      brands.set(id, { _id: id, name: `Brand ${index}` });
      subCategories.set(id, { _id: id, name: `Subcategory ${index}`, category: categoryId });
    }
    for (const path of ['/api/v1/categories', '/api/v1/brands', '/api/v1/subcategories',
      `/api/v1/categories/${categoryId}/subcategories`]) {
      const listFormat = path.includes('subcategories');
      const firstPage = await request('GET', path, 200, { listFormat });
      assert.strictEqual(firstPage.results, 25);
      const secondPage = await request('GET', `${path}?page=2`, 200, { listFormat });
      assert.strictEqual(secondPage.results, 7);
      const customPage = await request('GET', `${path}?limit=3`, 200, { listFormat });
      assert.strictEqual(customPage.results, 3);
    }

    reset();
    products.clear();
    for (let index = 1; index <= 30; index += 1) {
      const id = index.toString(16).padStart(24, '0');
      products.set(id, {
        _id: id, ...productBody, title: `Product ${index}`, slug: `product-${index}`,
        price: index, createdAt: '2026-01-01T00:00:00.000Z',
      });
    }
    const defaultProducts = await request('GET', productPath, 200);
    assert.strictEqual(defaultProducts.limit, 25);
    assert.strictEqual(defaultProducts.results, 25);
    defaultProducts.data.forEach((product) => {
      assert.deepStrictEqual(product.category, { _id: categoryId, name: 'Phones' });
      assert.deepStrictEqual(product.subcategories, [{ _id: subCategoryId, name: 'Nokia' }]);
      assert.deepStrictEqual(product.brand, { _id: brandId, name: 'Apple' });
    });
    const sortedDefaults = await request('GET', `${productPath}?page=1&sort=-price,-ratingsAverage`, 200);
    assert.strictEqual(sortedDefaults.limit, 25);
    assert.strictEqual(sortedDefaults.results, 25);
    assert.deepStrictEqual(sortedDefaults.data.map((product) => product.price),
      Array.from({ length: 25 }, (_, index) => 30 - index));
    const nextProducts = await request('GET', `${productPath}?page=2&sort=-price`, 200);
    assert.strictEqual(nextProducts.limit, 25);
    assert.deepStrictEqual(nextProducts.data.map((product) => product.price), [5, 4, 3, 2, 1]);
    const explicitLimit = await request('GET', `${productPath}?limit=2&sort=-price`, 200);
    assert.strictEqual(explicitLimit.limit, 2);
    assert.deepStrictEqual(explicitLimit.data.map((product) => product.price), [30, 29]);

    reset();
    products.get(productId).subcategories = [subCategoryId, otherSubCategoryId];
    const productWithNames = await request('GET', `${productPath}/${productId}`, 200);
    assert.deepStrictEqual(productWithNames.data.category, { _id: categoryId, name: 'Phones' });
    assert.deepStrictEqual(productWithNames.data.subcategories, [
      { _id: subCategoryId, name: 'Nokia' }, { _id: otherSubCategoryId, name: 'Samsung' },
    ]);
    assert.deepStrictEqual(productWithNames.data.brand, { _id: brandId, name: 'Apple' });
    categories.get(categoryId).name = 'Renamed category';
    subCategories.get(subCategoryId).name = 'Renamed subcategory';
    brands.get(brandId).name = 'Renamed brand';
    const renamedReferences = await request('GET', `${productPath}/${productId}`, 200);
    assert.strictEqual(renamedReferences.data.category.name, 'Renamed category');
    assert.strictEqual(renamedReferences.data.subcategories[0].name, 'Renamed subcategory');
    assert.strictEqual(renamedReferences.data.brand.name, 'Renamed brand');
    categories.delete(categoryId);
    subCategories.delete(subCategoryId);
    brands.delete(brandId);
    const missingReferences = await request('GET', `${productPath}/${productId}`, 200);
    assert.strictEqual(missingReferences.data.category, null);
    assert.strictEqual(missingReferences.data.brand, null);
    assert.deepStrictEqual(missingReferences.data.subcategories,
      [{ _id: otherSubCategoryId, name: 'Samsung' }]);

    reset();
    const thirdProductId = '507f1f77bcf86cd799439043';
    const fourthProductId = '507f1f77bcf86cd799439044';
    Object.assign(products.get(productId), { title: 'Zeta phone', price: 100, ratingsAverage: 4 });
    Object.assign(products.get(otherProductId), { title: 'Alpha phone', price: 10, ratingsAverage: 3 });
    products.set(thirdProductId, {
      _id: thirdProductId, ...productBody, title: 'Beta phone', price: 10, ratingsAverage: 5,
      slug: 'beta-phone', createdAt: '2026-01-03T00:00:00.000Z',
    });
    products.set(fourthProductId, {
      _id: fourthProductId, ...productBody, title: 'Gamma laptop', price: 2, ratingsAverage: 5,
      description: 'A detailed description of this portable laptop.',
      slug: 'gamma-laptop', createdAt: '2026-01-03T00:00:00.000Z',
    });
    const sortedProductIds = async (query = '') => {
      const result = await request('GET', `${productPath}${query ? `?${query}` : ''}`, 200);
      assert.strictEqual(result.results, result.data.length);
      return result.data.map((product) => product._id);
    };
    const newestFirst = [fourthProductId, thirdProductId, productId, otherProductId];
    assert.deepStrictEqual(await sortedProductIds(), newestFirst);
    assert.deepStrictEqual(await sortedProductIds('sort='), newestFirst);
    assert.deepStrictEqual(await sortedProductIds('sort=%20%20'), newestFirst);
    assert.deepStrictEqual(await sortedProductIds('sort=price'),
      [fourthProductId, otherProductId, thirdProductId, productId]);
    assert.deepStrictEqual(await sortedProductIds('sort=-price'),
      [productId, otherProductId, thirdProductId, fourthProductId]);
    assert.deepStrictEqual(await sortedProductIds('sort=title'),
      [otherProductId, thirdProductId, fourthProductId, productId]);
    assert.deepStrictEqual(await sortedProductIds('sort=price,-ratingsAverage'),
      [fourthProductId, thirdProductId, otherProductId, productId]);
    assert.deepStrictEqual(await sortedProductIds('sort=%20price%20,%20-ratingsAverage%20'),
      [fourthProductId, thirdProductId, otherProductId, productId]);
    assert.deepStrictEqual(await sortedProductIds('sort=price,-_id'),
      [fourthProductId, thirdProductId, otherProductId, productId]);
    assert.deepStrictEqual(await sortedProductIds('sort=_id'),
      [productId, otherProductId, thirdProductId, fourthProductId]);
    assert.deepStrictEqual(await sortedProductIds('sort=price&page=2&limit=2'),
      [thirdProductId, productId]);
    assert.deepStrictEqual(await sortedProductIds('sort=price&page=2&limit=1'), [otherProductId]);
    assert.deepStrictEqual(await sortedProductIds('sort=price&page=3&limit=1'), [thirdProductId]);
    assert.deepStrictEqual(await sortedProductIds('keyword=phone&sort=-ratingsAverage,price&page=2&limit=1'),
      [productId]);
    assert.deepStrictEqual(await sortedProductIds('keyword=notfound&sort=price'), []);
    assert.deepStrictEqual(await sortedProductIds('sort=price&page=5&limit=1'), []);
    assert.strictEqual(writeCalls, 0);

    databaseError = new Error('Invalid sorting should be rejected before database access');
    for (const sort of ['unknown', 'category.name', '$natural', '__proto__', 'constructor',
      'price,', ',price', 'price,,title', '-', '--price', '+price', 'price title',
      'price,price', 'price,-price']) {
      const invalid = await request('GET', `${productPath}?sort=${encodeURIComponent(sort)}`, 400);
      assert.strictEqual(invalid.errors[0].path, 'sort');
    }
    const repeatedSort = await request('GET', `${productPath}?sort=price&sort=-price`, 400,
      { message: /sort must be a single string/ });
    assert.strictEqual(repeatedSort.errors[0].path, 'sort');
    assert.strictEqual(writeCalls, 0);

    // Scientific notation remains supported, but overflowing numbers cannot reach the database.
    for (const method of ['POST', 'PUT']) {
      const path = productPath + (method === 'PUT' ? `/${productId}` : '');
      for (const field of ['price', 'priceAfterDiscount', 'quantity', 'sold', 'ratingsAverage', 'ratingsQuantity']) {
        reset();
        databaseError = new Error('Invalid numbers should be rejected before database access');
        const invalid = await request(method, path, 400, { body: { ...productBody, [field]: '1e309' } });
        assert.ok(invalid.errors.some((error) => error.path === field));
        assert.strictEqual(writeCalls, 0);
      }
    }
    reset();
    const scientificNumbers = await request('POST', productPath, 201, {
      body: { ...productBody, price: '1e2', quantity: '5e0' },
    });
    assert.strictEqual(scientificNumbers.data.price, 100);
    assert.strictEqual(scientificNumbers.data.quantity, 5);

    for (const method of ['GET', 'PUT', 'DELETE']) {
      reset();
      const invalid = await request(method, `${productPath}/invalid`, 400, {
        body: method === 'GET' ? undefined : { price: 100 },
        message: /Invalid product ID/,
      });
      assert.strictEqual(invalid.errors[0].path, 'id');
      await request(method, `${productPath}/${missingId}`, 404, {
        body: method === 'GET' ? undefined : { price: 100 }, message: /Product not found/,
      });
      assert.strictEqual(writeCalls, 0);
    }

    for (const method of ['POST', 'PUT']) {
      const path = productPath + (method === 'PUT' ? `/${productId}` : '');
      for (const [field, values] of [
        ['title', [null, 123, ' ', 'ab', 'x'.repeat(101)]],
        ['description', [null, 123, 'Short', ' '.repeat(25), 'x'.repeat(2001)]],
        ['quantity', [null, -1, 1.5, 'invalid', true, Number.MAX_SAFE_INTEGER + 1]],
        ['price', [null, -1, 'invalid', true, 200001]],
        ['priceAfterDiscount', [null, -1, 'invalid', 100, 101]],
        ['imageCover', [null, 123, ' ']],
        ['category', [null, 123, 'invalid', missingId]],
        ['subcategories', [null, [], subCategoryId, [123], ['invalid'], [missingId],
          [subCategoryId, subCategoryId.toUpperCase()]]],
        ['brand', [null, [], [brandId], 123, 'invalid', missingId]],
        ['sold', [null, -1, 1.5, true, 'invalid']],
        ['ratingsAverage', [null, 0, 6, true, 'invalid']],
        ['ratingsQuantity', [null, -1, 1.5, true, 'invalid']],
        ['colors', [null, 'Black', [123], [' ']]],
        ['images', [null, 'phone.jpg', [123], [' ']]],
      ]) {
        for (const value of values) {
          reset();
          const invalid = await request(method, path, 400, { body: { ...productBody, [field]: value } });
          assert.ok(invalid.errors.some((error) => error.path === field || error.path.startsWith(`${field}[`)),
            `${method} ${field}=${JSON.stringify(value)}: ${JSON.stringify(invalid.errors)}`);
          assert.strictEqual(writeCalls, 0);
        }
      }
      for (const body of [undefined, [], {}]) {
        reset();
        await request(method, path, 400, { body });
        assert.strictEqual(writeCalls, 0);
      }
      reset();
      const wrongCategory = await request(method, path, 400, {
        body: { ...productBody, category: otherCategoryId },
      });
      assert.strictEqual(wrongCategory.errors[0].path, 'subcategories');
      assert.strictEqual(writeCalls, 0);
    }

    for (const field of ['title', 'description', 'quantity', 'price', 'imageCover', 'category']) {
      reset();
      const body = { ...productBody };
      delete body[field];
      const invalid = await request('POST', productPath, 400, { body });
      assert.ok(invalid.errors.some((error) => error.path === field));
      assert.strictEqual(writeCalls, 0);
    }

    reset();
    const createdProduct = await request('POST', productPath, 201, {
      body: { ...productBody, title: '  New phone  ', priceAfterDiscount: 80 },
    });
    assert.strictEqual(createdProduct.data.title, 'New phone');
    assert.strictEqual(createdProduct.data.slug, 'new-phone');
    assert.strictEqual(createdProduct.data.price, 100);
    assert.deepStrictEqual(createdProduct.data.category, { _id: categoryId, name: 'Phones' });
    assert.deepStrictEqual(createdProduct.data.subcategories, [{ _id: subCategoryId, name: 'Nokia' }]);
    assert.deepStrictEqual(createdProduct.data.brand, { _id: brandId, name: 'Apple' });
    assert.strictEqual(products.get(createdProduct.data._id).category, categoryId);
    assert.deepStrictEqual(products.get(createdProduct.data._id).subcategories, [subCategoryId]);
    assert.strictEqual(products.get(createdProduct.data._id).brand, brandId);
    const singleProduct = await request('GET', `${productPath}/${createdProduct.data._id}`, 200);
    assert.strictEqual(singleProduct.data.title, 'New phone');
    await request('DELETE', `${productPath}/${createdProduct.data._id}`, 200);
    await request('GET', `${productPath}/${createdProduct.data._id}`, 404);

    reset();
    const optionalReferences = { ...productBody };
    delete optionalReferences.subcategories;
    delete optionalReferences.brand;
    const withoutReferences = await request('POST', productPath, 201, { body: optionalReferences });
    assert.deepStrictEqual(withoutReferences.data.subcategories, []);
    assert.strictEqual(withoutReferences.data.brand, undefined);
    const readWithoutReferences = await request('GET', `${productPath}/${withoutReferences.data._id}`, 200);
    assert.deepStrictEqual(readWithoutReferences.data.subcategories, []);
    assert.strictEqual(readWithoutReferences.data.brand, undefined);
    const numericStrings = await request('POST', productPath, 201, {
      body: {
        ...productBody, quantity: '5', price: '100', priceAfterDiscount: '80',
        sold: '2', ratingsAverage: '4.5', ratingsQuantity: '3',
      },
    });
    assert.strictEqual(numericStrings.data.quantity, 5);
    assert.strictEqual(numericStrings.data.price, 100);
    assert.strictEqual(numericStrings.data.priceAfterDiscount, 80);
    assert.strictEqual(numericStrings.data.sold, 2);
    assert.strictEqual(numericStrings.data.ratingsAverage, 4.5);
    assert.strictEqual(numericStrings.data.ratingsQuantity, 3);
    await request('POST', productPath, 400, {
      body: { ...productBody, subcategory: [subCategoryId] }, message: /Use subcategories/,
    });

    reset();
    for (const query of ['page=-1', 'limit=1.5', 'page=1&page=2', 'page=1e2', 'limit=0']) {
      await request('GET', `${productPath}?${query}`, 400, { message: /positive whole numbers/ });
    }
    const productList = await request('GET', `${productPath}?page=2&limit=1`, 200);
    assert.strictEqual(productList.results, 1);
    assert.strictEqual(productList.data[0]._id, otherProductId);

    products.get(productId).title = 'Samsung Galaxy S24+';
    products.get(productId).description = 'An Android smartphone with a bright display.';
    products.get(otherProductId).title = 'Apple iPhone 15';
    products.get(otherProductId).description = 'An iOS smartphone with an advanced camera.';
    const search = async (keyword, suffix = '') => request(
      'GET', `${productPath}?keyword=${encodeURIComponent(keyword)}${suffix}`, 200,
    );
    const titleSearch = await search('  IPHONE  ');
    assert.deepStrictEqual(titleSearch.data.map((product) => product._id), [otherProductId]);
    const descriptionSearch = await search('ANDROID');
    assert.deepStrictEqual(descriptionSearch.data.map((product) => product._id), [productId]);
    const paginatedSearch = await search('smartphone', '&page=2&limit=1');
    assert.deepStrictEqual(paginatedSearch.data.map((product) => product._id), [otherProductId]);
    const filteredPage = await search('iphone', '&page=2&limit=1');
    assert.strictEqual(filteredPage.results, 0);
    assert.deepStrictEqual(filteredPage.data, []);
    const literalSearch = await search('S24+');
    assert.deepStrictEqual(literalSearch.data.map((product) => product._id), [productId]);
    for (const keyword of ['does not exist', '.*', '(a+)+$', '[']) {
      const noMatch = await search(keyword);
      assert.strictEqual(noMatch.results, 0);
      assert.deepStrictEqual(noMatch.data, []);
    }
    for (const keyword of ['', '   ']) {
      const allProducts = await search(keyword);
      assert.strictEqual(allProducts.results, 2);
    }
    for (const query of ['keyword=one&keyword=two', `keyword=${'x'.repeat(201)}`]) {
      const invalidSearch = await request('GET', `${productPath}?${query}`, 400);
      assert.strictEqual(invalidSearch.errors[0].path, 'keyword');
    }
    assert.strictEqual(writeCalls, 0);
    reset();

    // Verify the returned upload URL can be saved and retrieved through the product API.
    const cloudinaryKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const originalCloudinaryEnvironment = cloudinaryKeys.map((key) => [key, process.env[key]]);
    const originalUpload = cloudinary.uploader.upload_stream;
    try {
      cloudinaryKeys.forEach((key) => { process.env[key] = 'test-value'; });
      const uploadedUrl = 'https://res.cloudinary.com/test-cloud/image/upload/products/product-cover.png';
      cloudinary.uploader.upload_stream = (options, callback) => new Writable({
        write(chunk, encoding, next) { next(); },
        final(next) {
          callback(null, { secure_url: uploadedUrl, public_id: 'products/product-cover' });
          next();
        },
      });
      const uploadedCover = await request('POST', '/api/v1/images/upload-cover', 200, {
        uploadFormat: true,
        body: { base64Image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' },
      });
      assert.strictEqual(uploadedCover.success, true);
      const savedCover = await request('PUT', `${productPath}/${productId}`, 200,
        { body: { imageCover: uploadedCover.imageUrl } });
      assert.strictEqual(savedCover.data.imageCover, uploadedUrl);
      assert.strictEqual(products.get(productId).imageCover, uploadedUrl);
      const fetchedCover = await request('GET', `${productPath}/${productId}`, 200);
      assert.strictEqual(fetchedCover.data.imageCover, uploadedUrl);
      assert.deepStrictEqual(fetchedCover.data.category, { _id: categoryId, name: 'Phones' });
    } finally {
      cloudinary.uploader.upload_stream = originalUpload;
      originalCloudinaryEnvironment.forEach(([key, value]) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      });
    }
    reset();

    const stockUpdate = await request('PUT', `${productPath}/${productId}`, 200, { body: { quantity: 0 } });
    assert.strictEqual(stockUpdate.data.quantity, 0);
    assert.strictEqual(stockUpdate.data.title, productBody.title);
    assert.deepStrictEqual(stockUpdate.data.category, { _id: categoryId, name: 'Phones' });
    assert.deepStrictEqual(stockUpdate.data.subcategories, [{ _id: subCategoryId, name: 'Nokia' }]);
    assert.deepStrictEqual(stockUpdate.data.brand, { _id: brandId, name: 'Apple' });
    const priceUpdate = await request('PUT', `${productPath}/${productId}`, 200, {
      body: { price: 200, priceAfterDiscount: 180 },
    });
    assert.strictEqual(priceUpdate.data.priceAfterDiscount, 180);
    for (const body of [{ priceAfterDiscount: 201 }, { price: 170 }, { category: otherCategoryId }]) {
      const previousWrites = writeCalls;
      await request('PUT', `${productPath}/${productId}`, 400, { body });
      assert.strictEqual(writeCalls, previousWrites);
    }
    const subcategoryUpdate = await request('PUT', `${productPath}/${productId}`, 200, {
      body: { subcategories: [otherSubCategoryId] },
    });
    assert.deepStrictEqual(subcategoryUpdate.data.subcategories,
      [{ _id: otherSubCategoryId, name: 'Samsung' }]);
    const destinationSubcategoryId = '507f1f77bcf86cd799439023';
    subCategories.set(destinationSubcategoryId, {
      _id: destinationSubcategoryId, name: 'Fiction', slug: 'fiction', category: otherCategoryId,
    });
    const categoryUpdate = await request('PUT', `${productPath}/${productId}`, 200, {
      body: { category: otherCategoryId, subcategories: [destinationSubcategoryId], brand: otherBrandId },
    });
    assert.deepStrictEqual(categoryUpdate.data.category, { _id: otherCategoryId, name: 'Books' });
    assert.deepStrictEqual(categoryUpdate.data.subcategories,
      [{ _id: destinationSubcategoryId, name: 'Fiction' }]);
    assert.deepStrictEqual(categoryUpdate.data.brand, { _id: otherBrandId, name: 'Samsung' });

    reset();
    databaseError = Object.assign(new Error('Internal connection details'), { name: 'MongoNetworkError' });
    await request('POST', productPath, 503, { body: productBody, message: /Database is unavailable/ });
    assert.strictEqual(writeCalls, 0);

    reset();
    const categorySubPath = `/api/v1/categories/${categoryId}/subcategories`;
    const otherCategorySubPath = `/api/v1/categories/${otherCategoryId}/subcategories`;
    const emptyCategory = await request('GET', otherCategorySubPath, 200, { listFormat: true });
    assert.deepStrictEqual(emptyCategory, { results: 0, page: 1, data: [] });

    // Put another category's record first to verify filtering happens before pagination.
    const phoneRecords = [...subCategories.entries()];
    const bookSubCategoryId = '507f1f77bcf86cd799439023';
    subCategories.clear();
    subCategories.set(bookSubCategoryId, {
      _id: bookSubCategoryId, name: 'Fiction', slug: 'fiction', category: otherCategoryId,
    });
    phoneRecords.forEach(([id, record]) => subCategories.set(id, record));

    const phones = await request('GET', categorySubPath, 200, { listFormat: true });
    assert.deepStrictEqual(Object.keys(phones), ['results', 'page', 'data']);
    assert.strictEqual(phones.page, 1);
    assert.strictEqual(phones.results, 2);
    assert.deepStrictEqual(phones.data.map((record) => record._id), [subCategoryId, otherSubCategoryId]);
    phones.data.forEach((record) => assert.deepStrictEqual(record.category, categories.get(categoryId)));
    const books = await request('GET', otherCategorySubPath, 200, { listFormat: true });
    assert.strictEqual(books.results, 1);
    assert.strictEqual(books.data[0]._id, bookSubCategoryId);
    assert.deepStrictEqual(books.data[0].category, categories.get(otherCategoryId));
    const secondPhone = await request('GET', `${categorySubPath}?page=2&limit=1`, 200, { listFormat: true });
    assert.strictEqual(secondPhone.page, 2);
    assert.strictEqual(secondPhone.results, 1);
    assert.deepStrictEqual(secondPhone.data.map((record) => record._id), [otherSubCategoryId]);
    const noMorePhones = await request('GET', `${categorySubPath}?page=3&limit=1`, 200, { listFormat: true });
    assert.deepStrictEqual(noMorePhones, { results: 0, page: 3, data: [] });
    const allSubCategories = await request('GET', '/api/v1/subcategories', 200, { listFormat: true });
    assert.strictEqual(allSubCategories.results, 3);
    await request('GET', `${categorySubPath}?page=-1`, 400, { message: /positive whole numbers/ });
    await request('GET', `${categorySubPath}?limit=1.5`, 400, { message: /positive whole numbers/ });
    for (const invalidId of ['invalid', '123']) {
      const invalidCategory = await request('GET', `/api/v1/categories/${invalidId}/subcategories`, 400, {
        message: /Invalid category ID/,
      });
      assert.strictEqual(invalidCategory.errors[0].path, 'categoryId');
    }
    await request('GET', `/api/v1/categories/${missingId}/subcategories`, 404, { message: /Category not found/ });
    assert.strictEqual(writeCalls, 0);

    reset();
    const nestedCreated = await request('POST', categorySubPath, 201, { body: { name: 'Nested phones' } });
    assert.deepStrictEqual(nestedCreated.data.category, { _id: categoryId, name: 'Phones' });
    assert.strictEqual(subCategories.get(nestedCreated.data._id).category, categoryId);
    const explicitParent = await request('POST', categorySubPath, 201, {
      body: { name: 'Explicit parent', category: categoryId.toUpperCase() },
    });
    assert.strictEqual(explicitParent.data.category._id, categoryId);
    const nestedWrites = writeCalls;
    await request('POST', categorySubPath, 400, {
      body: { name: 'Wrong parent', category: otherCategoryId }, message: /must match/,
    });
    const invalidNestedParent = await request('POST', '/api/v1/categories/invalid/subcategories', 400, {
      body: { name: 'Invalid parent' }, message: /Invalid category ID/,
    });
    assert.strictEqual(invalidNestedParent.errors[0].path, 'categoryId');
    await request('POST', `/api/v1/categories/${missingId}/subcategories`, 404, {
      body: { name: 'Missing parent' }, message: /Parent category not found/,
    });
    await request('POST', categorySubPath, 400, { body: { name: ' ' }, message: /name/ });
    await request('POST', categorySubPath, 400, { message: /name/ });
    assert.strictEqual(writeCalls, nestedWrites);

    reset();
    const subPath = '/api/v1/subcategories';
    for (const method of ['POST', 'PUT']) {
      const path = subPath + (method === 'PUT' ? `/${subCategoryId}` : '');
      for (const value of ['', null, 123, [], [categoryId], {}, 'invalid']) {
        reset();
        await request(method, path, 400, { body: { name: 'New phone', category: value }, message: /category/ });
        assert.strictEqual(writeCalls, 0);
      }
      reset();
      await request(method, path, 404, {
        body: { name: 'New phone', category: missingId }, message: /Parent category not found/,
      });
      assert.strictEqual(writeCalls, 0);
    }
    reset();
    await request('POST', subPath, 400, { body: { name: 'Nokia' }, message: /category is required/ });
    const moved = await request('PUT', `${subPath}/${subCategoryId}`, 200, {
      body: { name: 'Moved phone', category: otherCategoryId },
    });
    assert.deepStrictEqual(moved.data.category, { _id: otherCategoryId, name: 'Books' });
    assert.strictEqual(subCategories.get(subCategoryId).category, otherCategoryId);
    categories.get(otherCategoryId).name = 'Renamed books';
    const refreshed = await request('GET', `${subPath}/${subCategoryId}`, 200);
    assert.deepStrictEqual(refreshed.data.category, { _id: otherCategoryId, name: 'Renamed books' });
    categories.delete(otherCategoryId);
    const orphan = await request('GET', `${subPath}/${subCategoryId}`, 200);
    assert.strictEqual(orphan.data.category, null);

    for (const raw of ['{"name":"Nokia" "categoryId":"invalid"}', '{', 'null']) {
      await request('POST', subPath, 400, { raw, message: /Invalid JSON body/ });
    }
    await request('POST', subPath, 413, { body: { name: 'x'.repeat(110000) }, message: /too large/ });
    await request('POST', subPath, 415, {
      body: { name: 'Nokia' }, headers: { 'Content-Type': 'application/json; charset=unsupported' },
      message: /Unsupported request encoding/,
    });
    await request('PUT', '/api/v1/missing', 404, { body: { name: 'Nokia' }, message: /Route not found/ });

    for (const name of ['MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkError',
      'MongoNetworkTimeoutError', 'MongoNotConnectedError', 'MongoTopologyClosedError']) {
      reset();
      databaseError = Object.assign(new Error('Internal connection details'), { name });
      await request('GET', subPath, 503, { message: /Database is unavailable/ });
    }
    reset();
    databaseError = Object.assign(new Error('Internal timeout details'), { code: 50 });
    await request('GET', subPath, 503, { message: /Database request timed out/ });
    databaseError = new mongoose.Error.CastError('ObjectId', 'invalid', '_id');
    await request('GET', subPath, 400, { message: /Invalid value for id/ });
    databaseError = await new SubCategory({ name: 'A', category: categoryId }).validate().catch((error) => error);
    const schemaError = await request('GET', subPath, 400);
    assert.ok(schemaError.errors.some((error) => error.path === 'name'));
    databaseError = new Error('Sensitive database internals');
    const unexpected = await request('GET', subPath, 500, { message: /unexpected server error/ });
    assert.doesNotMatch(unexpected.message, /Sensitive/);
    assert.strictEqual(unexpected.stack, undefined);
    console.log(`Passed ${checks} HTTP checks for success and error messages. All database operations mocked; no database records changed.`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => { server.close(resolve); });
    originals.reverse().forEach((restore) => restore());
    if (originalMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalMode;
  }
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
