import { JsonAble } from 'functional-models'

export type SimpleSqlValue = number | string | boolean | null | undefined | Date

export type SimpleSqlObject = Readonly<{
  [key: string]: SimpleSqlValue
}>

export type SimpleSqlOrmSearchResult = {
  instances: readonly SimpleSqlObject[]
  page?: any
}

export type PropertyTypeToParser = Readonly<{
  [key: string]: (value: any) => JsonAble
}>
