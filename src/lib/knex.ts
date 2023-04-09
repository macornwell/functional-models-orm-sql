import { PrimaryKeyType } from 'functional-models/interfaces'
import { 
  OrmQuery,
  DatesBeforeStatement,
  DatesAfterStatement,
  PropertyStatement,
} from 'functional-models-orm/interfaces'
import { EQUALITY_SYMBOLS } from 'functional-models-orm/constants'
import invoke from 'lodash/invoke'
import flow from 'lodash/flow'
import {
  SimpleSqlObject,
  SimpleSqlOrmSearchResult
} from '../interfaces'


export const ormQueryToKnex = (knex: any, table: string, ormQuery: OrmQuery) : Promise<SimpleSqlOrmSearchResult> => {
  return Promise.resolve()
    .then(async () => {
      const _ifExistsDo = (key: string, func: (knexInstance: any, value: any)=>any) => (knexInstance: any) => {
        // @ts-ignore
        if (ormQuery[key]) {
          // @ts-ignore
          return func(knexInstance, ormQuery[key])
        }
        return knexInstance
      }

      const pageQuery = _ifExistsDo('page', (knexInstance: any, page: any) => {
        return knexInstance.skip(page)
      })

      const takeQuery = _ifExistsDo('take', (knexInstance: any, take: any) => {
        return knexInstance.limit(take)
      })

      const datesBeforeQuery = _ifExistsDo('datesBefore', (knexInstance: any, datesBefore: any) => {
        return flow(Object.entries(datesBefore as any).map(([key, value]: [key: any, value: any]) => {
          const statement = value as DatesBeforeStatement
          const date = typeof statement.date === 'string'
            ? statement.date
            : statement.date.toISOString()
          const symbol = statement.options.equalToAndBefore
            ? '<='
            : '<'
          return (k: any) => {
            return k.where(statement.key, symbol, date)
          }
        }))(knexInstance)
      })

      const datesAfterQuery = _ifExistsDo('datesAfter', (knexInstance: any, datesAfter: any) => {
        return flow(Object.entries(datesAfter as any).map(([key, value]: [key: any, value: any]) => {
          const statement = value as DatesAfterStatement
          const date = typeof statement.date === 'string'
            ? statement.date
            : statement.date.toISOString()
          const symbol = statement.options.equalToAndAfter
            ? '>='
            : '>'
          return (k: any) => {
            return k.where(statement.key, symbol, date)
          }
        }))(knexInstance)
      })

      const sortQuery = _ifExistsDo('sort', (knexInstance: any, sort: any) => {
        const direction = sort.order
          ? undefined
          : 'desc'
        return knexInstance.orderBy(sort.key, direction)
      })

      const _createSearchString = (statement: PropertyStatement) => {
        const value = statement.value
        const value2 = statement.options.startsWith 
          ? `${value}%`
          : value
        const value3 = statement.options.endsWith
          ? `%${value2}`
          : value2
        return value3
      }

      const _getWhereFuncKey = (statement: PropertyStatement, andOr: string) => {
        if (statement.options.caseSensitive) {
          return andOr === 'and'
            ? 'whereILike'
            : 'orWhereILike'
        }
        if (statement.options.startsWith || statement.options.endsWith) {
          return andOr === 'or'
            ? 'orWhereLike'
            : 'whereLike'
        }
        return andOr === 'and'
          ? 'where'
          : 'orWhere'
      }

      const _whereArgs = (statement: PropertyStatement, searchString: string) => {
        if (!statement.options.equalitySymbol || statement.options.equalitySymbol === EQUALITY_SYMBOLS.EQUALS) {
          return [statement.name, searchString]
        }
        return [statement.name, statement.options.equalitySymbol, searchString]
      } 

      const propertyQueries = (knexInstance: any) => {
        const flowResults = flow(ormQuery.chain.map((statement) => {
          return ([k, andOr]:[k: any, andOr:string]) => {
            if (statement.type === 'and' ||
              statement.type === 'or' ||
              statement.type === 'property') {
              if (statement.type === 'property') {
                const propertyStatement = statement as PropertyStatement
                const searchString = _createSearchString(propertyStatement)
                const whereStatement = _getWhereFuncKey(propertyStatement, andOr)
                const whereArgs = _whereArgs(propertyStatement, searchString)
                return [invoke(k, whereStatement, ...whereArgs), andOr]
              } else if (statement.type === 'and') {
                return [k, 'and']
              } else if (statement.type === 'or') {
                return [k, 'or']
              }
            }
            // Do nothing, this statement isn't handled here.
            return [k, andOr]
          }
        }))([knexInstance, 'and'])
        return flowResults[0]
      }

      const selectEverythingQuery = (k: any) => k.select('*')
      const fromTable = (k: any) => k.table(table)

      const result = await flow([
        selectEverythingQuery,
        fromTable,
        propertyQueries,
        datesBeforeQuery,
        datesAfterQuery,
        takeQuery,
        pageQuery,
        sortQuery,
      ])(knex)

      return {
        instances: result,
      }
    })
}

export const knexWrapper = (knex: any) => {
  const getByPrimaryKey = async (table: string, key: string, id: PrimaryKeyType) => {
    return (await knex(table)
      .where({[key]: id})
      .first()) as SimpleSqlObject
  }
  const updateOrCreate = (table: string, idKey: string, data: SimpleSqlObject) => {
    return knex(table)
      .insert(data)
      .onConflict(idKey)
      .merge()
  }

  return {
    updateOrCreate,
    getByPrimaryKey,
  }
}


