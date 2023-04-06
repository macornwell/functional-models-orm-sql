const {Given, When, Then, After} = require('@cucumber/cucumber')
const merge = require('lodash/merge')
const {
  TextProperty,
  IntegerProperty,
  BooleanProperty,
  ArrayProperty,
  ObjectProperty,
} = require('functional-models')
const orm = require('functional-models-orm/orm').default
const { OrmModelReferenceProperty } = require('functional-models-orm/properties')
const { assert } = require('chai')
const { mapLimit } = require('modern-async')
const fs = require('fs')
const path = require('path')
const knexDatastoreProvider = require('../../dist/datastoreProvider').default

const DB_NAME = path.join(__dirname, '..', '..', 'cucumber-tests.sqlite3')


After(async function () {
  if (this.knex) {
    await this.knex.destroy()
  }
  await _clearPreviousCucumberDb()
})

const _clearPreviousCucumberDb = () => {
  if (fs.existsSync(DB_NAME)) {
    fs.unlinkSync(DB_NAME)
  }
}

const _createSqlite3Db = () => {
  fs.writeFileSync(DB_NAME, '')
  const knex = require('knex')({
    client: 'sqlite3',
    connection: {
      filename: DB_NAME,
    },
    useNullAsDefault: true,
  })
  return knex
}

const _nullToUndefined = (obj) => {
  return Object.entries(obj)
    .reduce((acc, [key, value]) => {
      if (value === null) {
        return acc
      }
      return merge(acc, {[key]: value})
    }, {})
}

const DB_SETUPS = {
  SETUP_1: async (knex) => {
  await knex.schema
    .createTable('TestModel', function (table) {
      table.uuid('id', { primaryKey: true }).primary();
      table.string('aString', 255).notNullable()
      table.boolean('aBoolean').notNullable()
      table.bigint('aNullableInt')
      table.text('anObject').notNullable()
      table.text('anArray').notNullable()
    })
    .createTable('TestModel2', function(table) {
      table.uuid('id', { primaryKey: true }).primary();
      table.string('name', 255).notNullable()
      table.uuid('testModel').notNullable()
      table.foreign('testModel').references('TestModel.id')
    })
    .createTable('SimpleModel', function(table) {
      table.uuid('id', { primaryKey: true }).primary();
      table.string('name', 255).notNullable()
    })
  }
}

const MODELS = {
  SIMPLE_MODEL_1: (orm) => {
    return orm.BaseModel('SimpleModel', {
      properties: {
        name: TextProperty({ required: true}),
      }
    })
  },
  TEST_MODEL_1: (orm) => {
    return orm.BaseModel('TestModel', {
      properties: {
        aString: TextProperty({ required: true}),
        aBoolean: BooleanProperty({ required: true}),
        aNullableInt: IntegerProperty({ required: false}),
        anObject: ObjectProperty({ required: true}),
        anArray: ArrayProperty({ required: true}),
      }
    })
  },
  TEST_MODEL_2: (orm) => {
    const TestModel = MODELS['TEST_MODEL_1'](orm)
    return orm.BaseModel('TestModel2', {
      properties: {
        name: TextProperty({ required: true}),
        testModel: OrmModelReferenceProperty(TestModel, { required: true, fetcher: (model, key) => model.retrieve(key) }),
      }
    })
  },
}

const DATA = {
  TEST_MODEL_1_DATA: () => ({
    id: '0c39b83b-b311-43c7-9b00-c78c07a11cc9',
    aString: 'test-string',
    aBoolean: true,
    anObject: { complex: [{object: 'inside'}]},
    anArray: [{more: 'complexity'}, {here: 'inside'}],
  }),
  TEST_MODEL_2_DATA: () => ({
    id: 'e4467b54-9769-4369-96be-5d69be8a2454',
    testModel: '0c39b83b-b311-43c7-9b00-c78c07a11cc9',
    name: 'model-2-name',
  }),
  SIMPLE_MODEL_1_DATA: () => ({
    id: '0c39b83b-b311-43c7-9b00-c78c07a11cc9',
    name: 'a-name',
  }),
  TEST_MODEL_1_TABLE: () => 'TestModel',
  TEST_MODEL_2_TABLE: () => 'TestModel2',
  SIMPLE_MODEL_1_TABLE: () => 'SimpleModel',
}


Given('a sqlite3 database is stood up with {word}', async function(setupKey) {
  _clearPreviousCucumberDb()
  const knex = await _createSqlite3Db()
  await DB_SETUPS[setupKey](knex)
  this.knex = knex
})

Given('a datastoreProvider instance is created', function() {
  this.datastoreProvider = knexDatastoreProvider({
    knex: this.knex,
  })
})

Given('an orm is created', function() {
  this.orm = orm({datastoreProvider: this.datastoreProvider})
})

Given('data {word} is used', function(modelDataKey) {
  this.modelData = DATA[modelDataKey](this.orm)
})

Given('an instance of {word} is created using the model data', function(modelName) {
  const model = MODELS[modelName](this.orm)
  this.instance = model.create(this.modelData)
})

When('save is called on the model instance', async function() {
  this.results = await this.instance.save()
})

When('a knex select everything query is done on the table named {word}', async function(tableNameKey){
  const tableName = DATA[tableNameKey]()
  this.results = await this.knex.select('*').from(tableName)
})

Then('the results matches the original model data', async function() {
  const actual = _nullToUndefined(await this.results.toObj())
  assert.deepEqual(actual, this.modelData)
})

Then('the results has a length of {int}', function(count) {
  assert.equal(this.results.length, count)
})

When('an instance of {word} is created using the model data and added to a models list', function(modelName) {
  if (!this.models) {
    this.models = []
  }
  const model = MODELS[modelName](this.orm).create(this.modelData)
  this.models.push(model)
})

When('save is called on all the models in the model list', async function() {
  this.results = await mapLimit(this.models, (m) => m.save(), 1)
})
