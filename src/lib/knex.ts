import {
  BooleanQuery,
  EqualitySymbol,
  isALinkToken,
  isPropertyBasedQuery,
  OrmSearch,
  PrimaryKeyType,
  PropertyQuery,
  Query,
  QueryTokens,
  SortOrder,
  validateOrmSearch,
} from 'functional-models'
import flow from 'lodash/flow'
import { SimpleSqlObject, SimpleSqlOrmSearchResult } from '../types'

export const ormQueryToKnex = (
  knex: any,
  table: string,
  ormSearch: OrmSearch
): Promise<SimpleSqlOrmSearchResult> => {
  return Promise.resolve().then(async () => {
    validateOrmSearch(ormSearch)
    const _ifExistsDo =
      (key: string, func: (knexInstance: any, value: any) => any) =>
      (knexInstance: any) => {
        // @ts-ignore
        if (ormSearch[key]) {
          // @ts-ignore
          return func(knexInstance, ormSearch[key])
        }
        return knexInstance
      }

    const pageQuery = _ifExistsDo('page', (knexInstance: any, page: any) => {
      return knexInstance.skip(page)
    })

    const takeQuery = _ifExistsDo('take', (knexInstance: any, take: any) => {
      return knexInstance.limit(take)
    })

    const sortQuery = _ifExistsDo('sort', (knexInstance: any, sort: any) => {
      const direction = sort.order === SortOrder.asc ? undefined : 'desc'
      return knexInstance.orderBy(sort.key, direction)
    })

    const _createSearchString = (statement: PropertyQuery) => {
      const value = statement.value
      const value2 = statement.options.startsWith ? `${value}%` : value
      const value3 = statement.options.endsWith ? `%${value2}` : value2
      return value3
    }

    const _getWhereFuncKey = (statement: PropertyQuery, andOr: string) => {
      if (statement.options.caseSensitive) {
        return andOr === 'and' ? 'whereILike' : 'orWhereILike'
      }
      if (statement.options.startsWith || statement.options.endsWith) {
        return andOr === 'or' ? 'orWhereLike' : 'whereLike'
      }
      return andOr === 'and' ? 'where' : 'orWhere'
    }

    const _whereArgs = (statement: PropertyQuery, searchString: string) => {
      if (statement.equalitySymbol === EqualitySymbol.eq) {
        return [statement.key, searchString]
      }
      return [statement.key, statement.equalitySymbol, searchString]
    }

    const _getPropertyArgs = (o: Query) => {
      if (o.type === 'property') {
        const value = _createSearchString(o)
        return _whereArgs(o, value)
      }
      if (o.type === 'datesBefore') {
        const symbol = o.options.equalToAndBefore ? '<=' : '<'
        return [o.key, symbol, o.date]
      }
      if (o.type === 'datesAfter') {
        const symbol = o.options.equalToAndAfter ? '>=' : '>'
        return [o.key, symbol, o.date]
      }
      throw new Error('Impossible situation')
    }

    const _getSimpleWhereFunc = (andOr: BooleanQuery) => {
      return andOr === 'AND' ? 'where' : 'orWhere'
    }

    const _processToken =
      (o: QueryTokens, andOr: 'AND' | 'OR') => (knexInstance: any) => {
        if (isPropertyBasedQuery(o)) {
          const whereKey =
            o.type === 'property'
              ? _getWhereFuncKey(o, andOr)
              : _getSimpleWhereFunc(andOr)
          return knexInstance[whereKey](..._getPropertyArgs(o as Query))
        }

        if (Array.isArray(o)) {
          // Are we dealing with just a string of queries?
          if (o.every(x => x !== 'AND' && x !== 'OR')) {
            // All ANDS
            return flow(
              o.map(s => (k: any) => {
                return _processToken(s, 'AND')(k)
              })
            )(knexInstance)
          }

          // We have a complex or intentional set of queries.
          return o.reduce(
            ([k, ao], a) => {
              // If we have a link, we are just going to continue on
              if (isALinkToken(a)) {
                return [k, a]
              }
              const wKey = _getSimpleWhereFunc(ao || 'AND')
              const k1 = k[wKey]((inner: any) => {
                return _processToken(a, 'AND')(inner)
              })
              return [k1, undefined]
            },
            [knexInstance, andOr]
          )[0]
        }
        throw new Error('Should never get here')
      }

    const selectEverythingQuery = (k: any) => k.select('*')
    const fromTable = (k: any) => k.table(table)

    const result = await flow([
      selectEverythingQuery,
      fromTable,
      _processToken(ormSearch.query, 'AND'),
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
  const getByPrimaryKey = async (
    table: string,
    key: string,
    id: PrimaryKeyType
  ) => {
    return (await knex(table)
      .where({ [key]: id })
      .first()) as SimpleSqlObject
  }
  const updateOrCreate = (
    table: string,
    idKey: string,
    data: SimpleSqlObject
  ) => {
    return knex(table).insert(data).onConflict(idKey).merge()
  }

  return {
    updateOrCreate,
    getByPrimaryKey,
  }
}
