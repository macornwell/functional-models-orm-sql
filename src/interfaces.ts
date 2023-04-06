import { JsonAble } from 'functional-models/interfaces'

export type SimpleSqlValue =
  | number
  | string
  | boolean
  | null
  | undefined
  | Date 

export type SimpleSqlObject = {
  readonly [key: string]: SimpleSqlValue
}

export type SimpleSqlOrmSearchResult = {
  instances: readonly SimpleSqlObject[],
  page?: any 
}

export type PropertyTypeToParser = {
  readonly [key: string]: (value: any) => JsonAble
}
