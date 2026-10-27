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
  categories.set(categoryId, { _id: categoryId, name: 'Phones', slug: 'phones' });
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
  const replacements = {
    find: () => {
      checkDatabase();
      let offset = 0;
      return {
        skip(value) { offset = value; return this; },
        limit(value) { return [...records.values()].slice(offset, offset + value); },
      };
    },
    findById: async (id) => {
      checkDatabase();
      return records.get(String(id).toLowerCase()) || null;
    },
    create: async (data) => {
      checkDatabase();
      writeCalls += 1;
      if ([...records.values()].some((record) => record.name === data.name)) throw duplicateError();
      const document = new Model(data);
      await document.validate();
      records.set(String(document._id), document.toObject());
      return document;
    },
    findByIdAndUpdate: async (id, data, options) => {
      checkDatabase();
      const current = records.get(String(id).toLowerCase());
      if (!current) return null;
      if ([...records.values()].some((record) => String(record._id) !== String(id) && record.name === data.name)) {
        throw new mongoose.Error('Name must be unique', { cause: duplicateError() });
      }
      const document = new Model({ ...current, ...data });
      await document.validate();
      writeCalls += 1;
      records.set(String(id), document.toObject());
      return options.returnDocument === 'after' ? document : current;
    },
    findByIdAndDelete: async (id) => {
      checkDatabase();
      const record = records.get(String(id).toLowerCase()) || null;
      if (record) { records.delete(String(id).toLowerCase()); writeCalls += 1; }
      return record;
    },
  };
  Object.entries(replacements).forEach(([name, implementation]) => {
    const original = Model[name];
    originals.push(() => { Model[name] = original; });
    Model[name] = implementation;
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
      assert.strictEqual(typeof body.message, 'string');
      assert.ok(body.message.length > 0);
      if (expected >= 400) {
        assert.strictEqual(body.statusCode, expected);
        assert.strictEqual(body.status, expected < 500 ? 'fail' : 'error');
        assert.strictEqual(body.path, path);
        assert.strictEqual(body.method, method);
      } else {
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
      const list = await request('GET', `${resource.path}?page=2&limit=1`, 200);
      assert.strictEqual(list.page, 2);
      assert.strictEqual(list.results, 1);
      const empty = await request('GET', `${resource.path}?page=10`, 200, { message: /No .* found/ });
      assert.deepStrictEqual(empty.data, []);
      await request('GET', `${resource.path}/${resource.id}`, 200, { message: /retrieved successfully/ });
      const created = await request('POST', resource.path, 201, { body: validBody, message: /created successfully/ });
      assert.strictEqual(created.data.name, validBody.name);
      const updated = await request('PUT', `${resource.path}/${resource.id}`, 200, {
        body: { name: 'Updated name' }, message: /updated successfully/,
      });
      assert.strictEqual(updated.data.name, 'Updated name');
      assert.strictEqual(updated.data.slug, 'updated-name');
      await request('DELETE', `${resource.path}/${resource.id}`, 200, { message: /deleted successfully/ });
      await request('GET', `${resource.path}/${resource.id}`, 404, { message: /not found/ });
    }

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
    assert.strictEqual(moved.data.category, otherCategoryId);

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
