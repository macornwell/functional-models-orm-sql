import { After, Given, Then, When } from '@cucumber/cucumber'
import invoke from 'lodash/invoke'
import merge from 'lodash/merge'
import omit from 'lodash/omit'
import {
  AdvancedModelReferenceProperty,
  ArrayProperty,
  BooleanProperty, createOrm,
  DateProperty, DatetimeProperty,
  IntegerProperty,
  ObjectProperty,
  Orm,
  OrmModelExtensions,
  OrmModelInstanceExtensions,
  PrimaryKeyUuidProperty,
  queryBuilder,
  SortOrder,
  TextProperty,
} from 'functional-models'
import { assert } from 'chai'
import { mapLimit } from 'modern-async'
import fs from 'node:fs'
import path from 'node:path'
import { create as sqlDatastore } from '../../src/datastoreAdapter'
import { getTableNameForModel } from '../../src/lib/index'

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

const _nullToUndefined = (obj: any) => {
  return Object.entries(obj)
    .reduce((acc, [key, value]) => {
      if (value === null) {
        return acc
      }
      return merge(acc, {[key]: value})
    }, {})
}

const DB_SETUPS = {
  SETUP_1: async (knex:any) => {
  await knex.schema
    .createTable('functional-models-orm-sql-test-model', function (table: any) {
      table.uuid('id', { primaryKey: true }).primary();
      table.string('aString', 255).notNullable()
      table.boolean('aBoolean').notNullable()
      table.bigint('aNullableInt')
      table.text('anObject').notNullable()
      table.text('anArray').notNullable()
    })
    .createTable('functional-models-orm-sql-test-model-2', function(table: any) {
      table.uuid('id', { primaryKey: true }).primary();
      table.string('name', 255).notNullable()
      table.uuid('testModel').notNullable()
      table.foreign('testModel').references('TestModel.id')
    })
    .createTable('functional-models-orm-sql-simple-model', function(table: any) {
      table.uuid('id', { primaryKey: true }).primary();
      table.string('name', 255).notNullable()
    })
    .createTable('functional-models-orm-sql-dated-model', function(table: any) {
      table.uuid('id', { primaryKey: true }).primary();
      table.string('name', 255).notNullable()
      table.datetime('myDate', { precision: 6 }).notNullable()
    })
  }
}

type TestModel1 = {
  id: string
  aString: string
  aBoolean: boolean
  aNullableInt?: number
  anObject: object
  anArray: any[]
}

const MODELS = {
  SIMPLE_MODEL_1: (orm: Orm) => {
    return orm.Model({
      pluralName: 'SimpleModel',
      namespace: 'functional-models-orm-sql',
      properties: {
        id: PrimaryKeyUuidProperty(),
        name: TextProperty({ required: true}),
      }
    })
  },
  TEST_MODEL_1: (orm: Orm) => {
    return orm.Model<TestModel1>({
      pluralName: 'TestModel',
      namespace: 'functional-models-orm-sql',
      properties: {
        id: PrimaryKeyUuidProperty(),
        aString: TextProperty({ required: true}),
        aBoolean: BooleanProperty({ required: true}),
        aNullableInt: IntegerProperty({ required: false}),
        anObject: ObjectProperty({ required: true}),
        anArray: ArrayProperty({ required: true}),
      }
    })
  },
  TEST_MODEL_2: (orm: Orm) => {
    const TestModel = MODELS['TEST_MODEL_1'](orm)
    return orm.Model({
      pluralName: 'TestModel2',
      namespace: 'functional-models-orm-sql',
      properties: {
        id: PrimaryKeyUuidProperty(),
        name: TextProperty({ required: true}),
        // @ts-ignore
        testModel: AdvancedModelReferenceProperty<TestModel1, OrmModelExtensions, OrmModelInstanceExtensions>(TestModel, { required: true, fetcher: (model, key) => model.retrieve(key) }),
      }
    })
  },
  DATED_MODEL: (orm: Orm) => {
    return orm.Model({
      pluralName: 'DatedModel',
      namespace: 'functional-models-orm-sql',
      properties: {
        id: PrimaryKeyUuidProperty(),
        name: TextProperty({ required: true}),
        myDate: DatetimeProperty({ required: true })
      }
    })
  },
}

const DATA = {
  NOTHING_ARGS: () => ([]),
  EMPTY_OBJECT: () => ({}),
  UNDEFINED: () => undefined,
  TEST_MODEL_1_DATA: () => ({
    id: '0c39b83b-b311-43c7-9b00-c78c07a11cc9',
    aString: 'test-string',
    aBoolean: true,
    anObject: { complex: [{object: 'inside'}]},
    anArray: [{more: 'complexity'}, {here: 'inside'}],
  }),
  TEST_MODEL_1_ID: () => ['0c39b83b-b311-43c7-9b00-c78c07a11cc9'],
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
  DATED_MODEL: () => 'DatedModel',
  COMPLEX_QUERY_1: () =>
    queryBuilder()
      .complex(b => b
        .property('name', 'a', {startsWith: true})
        .and()
        .datesBefore('myDate', new Date(Date.UTC(2022, 3, 3)), {equalToAndBefore: false})
      )
      .or()
      .complex(b => b
        .property('name', 'z', {endsWith: true})
        .and()
        .datesAfter('myDate', new Date(Date.UTC(2022, 3, 3)), {equalToAndAfter: true})
      )
      .compile(),
  BULK_DATA_1: () => ([{
    name: 'abcdef',
    myDate: new Date(Date.UTC(2022, 1, 3))
  },{
    name: 'abc',
    myDate: new Date(Date.UTC(2022, 3, 3))
  },{
    name: 'lmnxyz',
    myDate: new Date(Date.UTC(2022, 8, 3))
  },{
    name: 'xyz',
    myDate: new Date(Date.UTC(2022, 4, 3))
  },{
    name: 'ghixyz',
    myDate: new Date(Date.UTC(2022, 7, 3))
  }]),
  ASCENDING_SORT_RESULT_1: () => ([{
    name: 'abc',
    myDate: new Date(Date.UTC(2022, 3, 3)).toISOString(),
  },{
    name: 'abcdef',
    myDate: new Date(Date.UTC(2022, 1, 3)).toISOString(),
  },{
    name: 'ghixyz',
    myDate: new Date(Date.UTC(2022, 7, 3)).toISOString(),
  },{
    name: 'lmnxyz',
    myDate: new Date(Date.UTC(2022, 8, 3)).toISOString(),
  },{
    name: 'xyz',
    myDate: new Date(Date.UTC(2022, 4, 3)).toISOString(),
  }]),
  DESCENDING_SORT_RESULT_1: () => ([{
    name: 'xyz',
    myDate: new Date(Date.UTC(2022, 4, 3)).toISOString(),
  },{
    name: 'lmnxyz',
    myDate: new Date(Date.UTC(2022, 8, 3)).toISOString(),
  },{
    name: 'ghixyz',
    myDate: new Date(Date.UTC(2022, 7, 3)).toISOString(),
  },{
    name: 'abcdef',
    myDate: new Date(Date.UTC(2022, 1, 3)).toISOString()
  },{
    name: 'abc',
    myDate: new Date(Date.UTC(2022, 3, 3)).toISOString(),
  }]),
  QUERY_1: () => queryBuilder()
    .property('name', 'abc', { startsWith: true })
    .compile(),
  QUERY_2: () => queryBuilder()
    .property('name', 'abc')
    .compile(),
  QUERY_3: () => queryBuilder()
    .property('name', 'xyz', { endsWith: true })
    .compile(),
  QUERY_4: () => queryBuilder()
    .datesBefore('myDate', new Date(Date.UTC(2022, 3, 3)), {equalToAndBefore: false})
    .compile(),
  QUERY_5: () => queryBuilder()
    .datesBefore('myDate', new Date(Date.UTC(2022, 3, 3)), {equalToAndBefore: true})
    .compile(),
  QUERY_6: () => queryBuilder()
    .datesAfter('myDate', new Date(Date.UTC(2022, 3, 3)), {equalToAndAfter: false})
    .compile(),
  QUERY_7: () => queryBuilder()
    .datesAfter('myDate', new Date(Date.UTC(2022, 3, 3)), { equalToAndAfter: true})
    .compile(),
  ASCENDING_SORT_QUERY_1: () => queryBuilder()
    .sort('name')
    .compile(),
  DESCENDING_SORT_QUERY_1: () => queryBuilder()
    .sort('name', SortOrder.dsc)
    .compile(),
}


Given('a sqlite3 database is stood up with {word}', async function(setupKey) {
  _clearPreviousCucumberDb()
  const knex = await _createSqlite3Db()
  await DB_SETUPS[setupKey](knex)
  this.knex = knex
})

Given('a datastoreAdapter instance is created and an orm', function() {
  this.datastoreAdapter = sqlDatastore({
    knex: this.knex,
  })
  this.orm = createOrm({datastoreAdapter: this.datastoreAdapter})
})

Given('data {word} is used', function(modelDataKey: string) {
  this.modelData = DATA[modelDataKey](this.orm)
})

Given('an instance of {word} is created using the model data', function(modelName: string) {
  const model = MODELS[modelName](this.orm)
  this.instance = model.create(this.modelData)
})

When('save is called on the model instance', async function() {
  this.results = await this.instance.save()
})

When('a knex select everything query is done on the table named {word}', async function(tableNameKey: string){
  const model = MODELS[tableNameKey](this.orm)
  const tableName = getTableNameForModel(model)
  this.results = await this.knex.select('*').from(tableName)
})

Then('the results matches the original model data', async function() {
  const actual = _nullToUndefined(await this.results.toObj())
  assert.deepEqual(actual, this.modelData)
})

Then('the results has a length of {int}', function(count) {
  assert.equal(this.results.length, count)
})

When('an instance of {word} is created using the model data and added to a models list', function(modelName: string) {
  if (!this.models) {
    this.models = []
  }
  const model = MODELS[modelName](this.orm).create(this.modelData)
  this.models.push(model)
})

When('save is called on all the models in the model list', async function() {
  // @ts-ignore
  this.results = await mapLimit(this.models, (m) => m.save(), 1)
})

When('{word} is called on {word} with {word}', async function(functionKey: string, modelKey: string, dataKey: string) {
  const model = MODELS[modelKey](this.orm)
  const args = DATA[dataKey]()
  this.results = await invoke(model, functionKey, ...args)
})


When('{word} is called on the model instance with {word}', async function(functionKey: string, dataKey: string) {
  const args = DATA[dataKey]()
  this.results = await invoke(this.instance, functionKey, ...args)
})

Then('the results matches {word}', function(dataKey) {
  const expected = DATA[dataKey]()
  assert.deepEqual(this.results, expected)
})

Given('loaded with models of {word} using {word}', async function(modelKey, dataKey) {
  const data = DATA[dataKey]()
  const model = MODELS[modelKey](this.orm)
  this.models = await mapLimit(data, d => model.create(d).save(), 1)
})

When('search on {word} is called with {word}', async function(modelKey, dataKey) {
  const data = DATA[dataKey]()
  const model = MODELS[modelKey](this.orm)
  this.results = (await model.search(data)).instances
})

Then('the results matches {word} when ignoring {word}', async function(dataKey, omitKey) {
  // @ts-ignore
  const objResults = await mapLimit(this.results, x=>x.toObj(), 1)
  const actual = objResults.map(obj => omit(obj, [omitKey]))
  const expected = DATA[dataKey]()
  assert.deepEqual(actual, expected)
})
