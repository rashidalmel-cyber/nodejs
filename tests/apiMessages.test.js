/* eslint-disable no-await-in-loop, no-restricted-syntax -- Scenarios share fixtures and run sequentially. */
const assert = require('assert');
const express = require('express');
const mongoose = require('mongoose');
const Category = require('../models/CategoryModel');
const SubCategory = require('../models/SubCategoryModel');
const ApiError = require('../utils/apiError');
const categoryRoutes = require('../routes/CategoryRoutes');
const subCategoryRoutes = require('../routes/subCategoryRoutes');
const globalError = require('../middlewares/errorMiddleware');

const categoryId = '507f1f77bcf86cd799439011';
const otherCategoryId = '507f1f77bcf86cd799439012';
const subCategoryId = '507f1f77bcf86cd799439021';
const otherSubCategoryId = '507f1f77bcf86cd799439022';
const missingId = '507f1f77bcf86cd799439099';
const categories = new Map();
const subCategories = new Map();
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
      if ([...records.values()].some((record) => record.name === data.name)) throw duplicateError();
      records.set(String(data._id), copy(data));
      return { acknowledged: true, insertedId: data._id };
    },
    findOneAndUpdate: async (filter, update, options) => {
      checkDatabase();
      const id = String(filter._id);
      const data = update.$set || {};
      const current = records.get(String(id).toLowerCase());
      if (!current) return null;
      if ([...records.values()].some((record) => String(record._id) !== String(id) && record.name === data.name)) {
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
  const originalMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  mockModel(Category, categories);
  mockModel(SubCategory, subCategories);
  const app = express();
  app.use(express.json());
  app.use('/api/v1/categories', categoryRoutes);
  app.use('/api/v1/subcategories', subCategoryRoutes);
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
