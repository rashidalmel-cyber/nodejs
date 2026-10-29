/* eslint-disable no-await-in-loop, no-restricted-syntax -- Scenarios share fixtures and run sequentially. */
const assert = require('assert');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Category = require('../models/CategoryModel');
const SubCategory = require('../models/SubCategoryModel');
const Brand = require('../models/BrandModel');
const Product = require('../models/productmodel');
const ApiError = require('../utils/apiError');
const categoryRoutes = require('../routes/CategoryRoutes');
const subCategoryRoutes = require('../routes/subCategoryRoutes');
const brandRoutes = require('../routes/brandroute');
const productRoutes = require('../routes/productRoutes');
const globalError = require('../middlewares/errorMiddleware');

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
  subcategory: [subCategoryId],
  brand: [brandId],
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
  });
  products.set(otherProductId, {
    _id: otherProductId, ...productBody, title: 'Other phone', slug: 'other-phone',
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
  // Exercise the real entry point with no database connection or listening port.
  const originalConnect = mongoose.connect;
  const originalListen = express.application.listen;
  const originalConfig = dotenv.config;
  try {
    let connected = false;
    let listening = false;
    dotenv.config = () => ({});
    mongoose.connect = async () => {
      connected = true;
      return { connection: { host: 'mock' }, disconnect: async () => {} };
    };
    express.application.listen = (port, callback) => {
      assert.strictEqual(connected, true);
      listening = true;
      callback();
    };
    // eslint-disable-next-line global-require -- Load the entry point after installing startup mocks.
    require('../server');
    await new Promise((resolve) => { setImmediate(resolve); });
    assert.strictEqual(listening, true, 'Server did not start');
  } finally {
    mongoose.connect = originalConnect;
    express.application.listen = originalListen;
    dotenv.config = originalConfig;
  }
  const missingNameError = await new SubCategory({ category: categoryId }).validate().catch((error) => error);
  assert.ok(missingNameError && missingNameError.errors.name);
  const originalMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  mockModel(Category, categories);
  mockModel(SubCategory, subCategories);
  mockModel(Brand, brands);
  mockModel(Product, products);
  const app = express();
  app.use(express.json());
  app.use('/api/v1/categories', categoryRoutes);
  app.use('/api/v1/subcategories', subCategoryRoutes);
  app.use('/api/v1/brands', brandRoutes);
  app.use('/api/v1/products', productRoutes);
  app.all('/{*splat}', (req, res, next) => next(new ApiError(`Route not found: ${req.method} ${req.originalUrl}.`, 404)));
  app.use(globalError);
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
      if (!options.listFormat) {
        assert.strictEqual(typeof body.message, 'string');
        assert.ok(body.message.length > 0);
      }
      if (expected >= 400) {
        assert.strictEqual(body.statusCode, expected);
        assert.strictEqual(body.status, expected < 500 ? 'fail' : 'error');
        assert.strictEqual(body.path, path);
        assert.strictEqual(body.method, method);
      } else if (!options.listFormat) {
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
      const validBody = { name: 'New name', categoryId };
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
            body: { name, categoryId }, message: /name/,
          });
          assert.ok(result.errors.some((error) => error.path === 'name'));
          assert.strictEqual(writeCalls, 0);
        }
        reset();
        await request(method, resource.path + (method === 'PUT' ? `/${resource.id}` : ''), 409, {
          body: { name: resource.duplicate, categoryId }, message: /already exists/,
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
        assert.strictEqual(empty.limit, 5);
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

    const productPath = '/api/v1/products';
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
        ['description', [null, 123, 'Short', ' '.repeat(25)]],
        ['quantity', [null, -1, 1.5, '5', true, Number.MAX_SAFE_INTEGER + 1]],
        ['price', [null, -1, '100', true]],
        ['priceAfterDiscount', [null, -1, '80', 101]],
        ['imageCover', [null, 123, ' ']],
        ['category', [null, 123, 'invalid', missingId]],
        ['subcategory', [null, subCategoryId, [123], ['invalid'], [missingId],
          [subCategoryId, subCategoryId.toUpperCase()]]],
        ['brand', [null, brandId, [123], ['invalid'], [missingId], [brandId, brandId]]],
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
      assert.strictEqual(wrongCategory.errors[0].path, 'subcategory');
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
    assert.deepStrictEqual(createdProduct.data.subcategory, [subCategoryId]);
    const singleProduct = await request('GET', `${productPath}/${createdProduct.data._id}`, 200);
    assert.strictEqual(singleProduct.data.title, 'New phone');
    await request('DELETE', `${productPath}/${createdProduct.data._id}`, 200);
    await request('GET', `${productPath}/${createdProduct.data._id}`, 404);

    reset();
    for (const query of ['page=-1', 'limit=1.5', 'page=1&page=2', 'page=1e2', 'limit=0']) {
      await request('GET', `${productPath}?${query}`, 400, { message: /positive whole numbers/ });
    }
    const productList = await request('GET', `${productPath}?page=2&limit=1`, 200);
    assert.strictEqual(productList.results, 1);
    assert.strictEqual(productList.data[0]._id, otherProductId);

    const stockUpdate = await request('PUT', `${productPath}/${productId}`, 200, { body: { quantity: 0 } });
    assert.strictEqual(stockUpdate.data.quantity, 0);
    assert.strictEqual(stockUpdate.data.title, productBody.title);
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
      body: { subcategory: [otherSubCategoryId] },
    });
    assert.deepStrictEqual(subcategoryUpdate.data.subcategory, [otherSubCategoryId]);
    const categoryUpdate = await request('PUT', `${productPath}/${productId}`, 200, {
      body: { category: otherCategoryId, subcategory: [], brand: [] },
    });
    assert.strictEqual(categoryUpdate.data.category, otherCategoryId);
    assert.deepStrictEqual(categoryUpdate.data.subcategory, []);

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

    const subPath = '/api/v1/subcategories';
    for (const method of ['POST', 'PUT']) {
      const path = subPath + (method === 'PUT' ? `/${subCategoryId}` : '');
      for (const value of ['', null, 123, [], [categoryId], {}, 'invalid']) {
        reset();
        await request(method, path, 400, { body: { name: 'New phone', categoryId: value }, message: /categoryId/ });
        assert.strictEqual(writeCalls, 0);
      }
      reset();
      await request(method, path, 404, {
        body: { name: 'New phone', categoryId: missingId }, message: /Parent category not found/,
      });
      assert.strictEqual(writeCalls, 0);
    }
    reset();
    await request('POST', subPath, 400, { body: { name: 'Nokia' }, message: /categoryId is required/ });
    const moved = await request('PUT', `${subPath}/${subCategoryId}`, 200, {
      body: { name: 'Moved phone', categoryId: otherCategoryId },
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
