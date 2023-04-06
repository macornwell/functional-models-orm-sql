import omit from 'lodash/omit'
import flow from 'lodash/flow'
import groupBy from 'lodash/groupBy'
import merge from 'lodash/merge'
import { mapLimit } from 'modern-async'
import {
  DatastoreProvider,
  DatesAfterStatement,
  DatesBeforeStatement,
  OrmQuery,
  PropertyStatement,
} from 'functional-models-orm/interfaces'
import {
  FunctionalModel,
  PrimaryKeyType,
  Model,
  ModelInstance,
  JsonAble,
  JsonObj,
  ModelDefinition,
  PropertyInstance,
  ModelInstanceInputData,
  TypedJsonObj,
} from 'functional-models/interfaces'
import {
  PROPERTY_TYPES as DEFAULT_PROPERTY_TYPES
} from 'functional-models/constants'
import { EQUALITY_SYMBOLS } from 'functional-models-orm/constants'
import { 
  SimpleSqlOrmSearchResult,
  SimpleSqlObject,
  SimpleSqlValue,
  PropertyTypeToParser,
} from './interfaces'
import { 
  getTableNameForModel as defaultTableNameGetter,
  parsers,
  knex as knexLib,
} from './lib'

const {
  toSimpleSqlObject,
  BasicPropertyTypeToParser,
  toTypedJsonObj,
} = parsers

const {
  knexWrapper,
  ormQueryToKnex,
} = knexLib

const _equalitySymbolToMongoSymbol = {
  [EQUALITY_SYMBOLS.EQUALS]: '$eq',
  [EQUALITY_SYMBOLS.GT]: '$gt',
  [EQUALITY_SYMBOLS.GTE]: '$gte',
  [EQUALITY_SYMBOLS.LT]: '$lt',
  [EQUALITY_SYMBOLS.LTE]: '$lte',
}

const knexDatastoreProvider = ({
  knex,
  getTableNameForModel = defaultTableNameGetter,
  propertyTypeToParser = BasicPropertyTypeToParser
}: {
  knex: any,
  getTableNameForModel: <T extends FunctionalModel>(
    model: Model<T>) => string,
  propertyTypeToParser: PropertyTypeToParser
}): DatastoreProvider => {

  const wrappedKnex = knexWrapper(knex)
  const toJsonParser = toTypedJsonObj(propertyTypeToParser)

  const search = <T extends FunctionalModel>(
    model: Model<T>,
    ormQuery: OrmQuery
  ) => {
    return Promise.resolve().then(async () => {
      const definitions = model.getModelDefinition()
      const tableName = getTableNameForModel<T>(model)
      const results = await ormQueryToKnex(knex, tableName, ormQuery)
      const formatted = results.instances.map(instance => toJsonParser<T>(definitions, instance))
      return {
        instances: formatted,
        page: results.page
      }
    })
  }

  const retrieve = <T extends FunctionalModel>(
    model: Model<T>,
    id: PrimaryKeyType
  ) => {
    return Promise.resolve().then(async () => {
      const definitions = model.getModelDefinition()
      const tableName = getTableNameForModel<T>(model)
      const key = model.getPrimaryKeyName()
      const fromDb = await wrappedKnex.getByPrimaryKey(tableName, key, id)
      return toJsonParser<T>(definitions, fromDb) 
    })
  }

  const save = async <T extends FunctionalModel, TModel extends Model<T>>(
    instance: ModelInstance<T, TModel>
  ) => {
    return Promise.resolve().then(async () => {
      const model = instance.getModel()
      const tableName = getTableNameForModel<T>(model)

      const data = await instance.toObj()
      const formatted = toSimpleSqlObject(model.getModelDefinition(), data)
      const key = model.getPrimaryKeyName()
      await wrappedKnex.updateOrCreate(tableName, key, formatted)
      const id = await instance.getPrimaryKey()
      const fromDb = await wrappedKnex.getByPrimaryKey(tableName, key, id)
      const definitions = instance.getModel().getModelDefinition() 
      return toJsonParser<T>(definitions, fromDb) 
    })
  }

  const bulkInsert = async <T extends FunctionalModel, TModel extends Model<T>>(
    model: TModel,
    instances: readonly ModelInstance<T, TModel>[]
  ) => {
    return Promise.resolve().then(async () => {
      if (instances.length === 0) {
        return
      }
      const groups = groupBy(instances, x => x.getModel().getName())
      if (Object.keys(groups).length > 1) {
        throw new Error(`Cannot have more than one model type.`)
      }
      const model = instances[0].getModel()
      const definitions = model.getModelDefinition()
      const tableName = getTableNameForModel<T>(model)
      const readyToSend = await mapLimit(instances, async (instance: ModelInstance<T, TModel>) => {
        const obj = await instance.toObj()
        return toSimpleSqlObject(definitions, obj)
      }, 1)
      await knex.transaction((trx: any) => trx.insert(readyToSend).into(tableName))
      return
    })
  }

  const deleteObj = <T extends FunctionalModel, TModel extends Model<T>>(
    instance: ModelInstance<T, TModel>
  ) => {
    return Promise.resolve().then(async () => {
      const model = instance.getModel()
      const tableName = getTableNameForModel<T>(model)
      const primaryKey = instance.getPrimaryKey()
      const primaryKeyName = instance.getPrimaryKeyName()
      await knex(tableName)
        .where({[primaryKeyName]: primaryKey})
        .del(primaryKey)
      return
    })
  }

  return {
    bulkInsert,
    search,
    retrieve,
    save,
    delete: deleteObj,
  }
}

export default knexDatastoreProvider
