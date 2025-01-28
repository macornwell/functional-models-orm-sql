import {
  DataDescription,
  DatastoreAdapter,
  ModelInstance,
  ModelType,
  OrmSearch,
  PrimaryKeyType,
} from 'functional-models'
import groupBy from 'lodash/groupBy'
import { mapLimit } from 'modern-async'
import {
  getTableNameForModel as defaultTableNameGetter,
  knex as knexLib,
  parsers,
} from './lib'
import { PropertyTypeToParser } from './types'

const { toSimpleSqlObject, BasicPropertyTypeToParser, toToObjectResult } =
  parsers

const { knexWrapper, ormQueryToKnex } = knexLib
type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }

const create = ({
  knex,
  getTableNameForModel = defaultTableNameGetter,
  propertyTypeToParser = BasicPropertyTypeToParser,
}: {
  knex: any
  getTableNameForModel?: <T extends DataDescription>(
    model: ModelType<T>
  ) => string
  propertyTypeToParser?: PropertyTypeToParser
}): WithRequired<DatastoreAdapter, 'bulkInsert' | 'count'> => {
  const wrappedKnex = knexWrapper(knex)
  const toJsonParser = toToObjectResult(propertyTypeToParser)

  const search = <T extends DataDescription>(
    model: ModelType<T>,
    ormQuery: OrmSearch
  ) => {
    return Promise.resolve().then(async () => {
      const definitions = model.getModelDefinition()
      const tableName = getTableNameForModel<T>(model)
      const results = await ormQueryToKnex(knex, tableName, ormQuery)
      const formatted = results.instances
        .map(instance => toJsonParser<T>(definitions, instance))
        .filter(x => x)
      return {
        instances: formatted,
        page: results.page,
      }
    })
  }

  const retrieve = <T extends DataDescription>(
    model: ModelType<T>,
    id: PrimaryKeyType
  ) => {
    return Promise.resolve().then(async () => {
      const definitions = model.getModelDefinition()
      const tableName = getTableNameForModel<T>(model)
      const key = definitions.primaryKeyName
      const fromDb = await wrappedKnex.getByPrimaryKey(tableName, key, id)
      if (!fromDb) {
        return undefined
      }
      return toJsonParser<T>(definitions, fromDb)
    })
  }

  const save = async <T extends DataDescription>(
    instance: ModelInstance<T>
  ) => {
    return Promise.resolve().then(async () => {
      const model = instance.getModel()
      const tableName = getTableNameForModel<T>(model)

      const data = await instance.toObj()
      const formatted = toSimpleSqlObject(model.getModelDefinition(), data)
      const key = model.getModelDefinition().primaryKeyName
      await wrappedKnex.updateOrCreate(tableName, key, formatted)
      const id = await instance.getPrimaryKey()
      const fromDb = await wrappedKnex.getByPrimaryKey(tableName, key, id)
      const definitions = instance.getModel().getModelDefinition()
      return toJsonParser<T>(definitions, fromDb)
    })
  }

  const bulkInsert = async <T extends DataDescription>(
    model: ModelType<T>,
    instances: readonly ModelInstance<T>[]
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
      const readyToSend = await mapLimit(
        instances,
        async (instance: ModelInstance<T>) => {
          const obj = await instance.toObj()
          return toSimpleSqlObject(definitions, obj)
        },
        1
      )
      await knex.transaction((trx: any) =>
        trx.insert(readyToSend).into(tableName)
      )
      return
    })
  }

  const deleteObj = <T extends DataDescription>(
    model: ModelType<T>,
    primaryKey: PrimaryKeyType
  ) => {
    return Promise.resolve().then(async () => {
      const tableName = getTableNameForModel<T>(model)
      const primaryKeyName = model.getModelDefinition().primaryKeyName
      await knex(tableName)
        .where({ [primaryKeyName]: primaryKey })
        .del(primaryKey)
      return
    })
  }

  const count = <T extends DataDescription>(model: ModelType<T>) => {
    const tableName = getTableNameForModel<T>(model)
    return knex(tableName).count()
  }

  return {
    bulkInsert,
    search,
    retrieve,
    save,
    delete: deleteObj,
    count,
  }
}

export { create }
