import {
  DataDescription,
  JsonAble,
  JsonObj,
  ModelDefinition,
  PropertyInstance,
  PropertyType,
  ToObjectResult,
} from 'functional-models'
import merge from 'lodash/merge'
import { PropertyTypeToParser, SimpleSqlObject, SimpleSqlValue } from '../types'

export const toSimpleSqlValue = (
  propertyType: string,
  value: any
): SimpleSqlValue => {
  if (value === null || value === undefined) {
    return null
  }
  // Arrays to stringified arrays.
  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return value as SimpleSqlValue
}

export const toSimpleSqlObject = <T extends DataDescription>(
  definition: ModelDefinition<T>,
  obj: JsonObj
): SimpleSqlObject => {
  const properties = definition.properties
  if (!obj) {
    return {}
  }
  return Object.entries(properties)
    .map(([key, property]: [key: string, property: any]) => ({
      key,
      property: (property as PropertyInstance<any>).getPropertyType(),
    }))
    .reduce((acc, { key, property }) => {
      const value = obj[key]
      const sqlValue = toSimpleSqlValue(property, value)
      return merge(acc, { [key]: sqlValue })
    }, {} as SimpleSqlObject)
}

export const nullParser = (func: (value: any) => JsonAble) => (value: any) => {
  if (value === undefined || value === null) {
    return null
  }
  return func(value)
}

export const stringParser = nullParser((value: any) => `${value}`)
export const integerParser = nullParser(parseInt)
export const floatParser = nullParser(parseFloat)
export const jsonParser = nullParser((value: any) => JSON.parse(value))
export const booleanParser = nullParser((value: any) => {
  if (typeof value === 'boolean') {
    return value as boolean
  }
  return Boolean(value)
})
export const dateParser = nullParser((value: any) =>
  new Date(value).toISOString()
)
export const bestGuessParser = nullParser((value: any): JsonAble => {
  const theType = typeof value
  if (theType === 'number' || theType === 'boolean' || theType === 'object') {
    return value as JsonAble
  }
  // Could be a stringified json...
  if (theType === 'string') {
    // eslint-disable-next-line
    try {
      const asJson = JSON.parse(theType)
      return asJson as JsonAble
      // eslint-disable-next-line
    } catch {}
    return value as JsonAble
  }
  throw new Error(`Cannot determine type of ${value}! Type: ${theType}`)
})

export const BasicPropertyTypeToParser: PropertyTypeToParser = {
  [PropertyType.UniqueId]: stringParser,
  [PropertyType.Date]: dateParser,
  [PropertyType.Datetime]: dateParser,
  [PropertyType.Object]: jsonParser,
  [PropertyType.Array]: jsonParser,
  [PropertyType.ModelReference]: stringParser,
  [PropertyType.Integer]: integerParser,
  [PropertyType.Text]: stringParser,
  [PropertyType.BigText]: stringParser,
  [PropertyType.Number]: floatParser,
  [PropertyType.Email]: stringParser,
  [PropertyType.Boolean]: booleanParser,
}

export const toJsonAble =
  (propertyTypeToParser: PropertyTypeToParser) =>
  (propertyType: string, value: any): JsonAble => {
    if (value === undefined || value === null) {
      return null
    }
    const parser = propertyTypeToParser[propertyType]
    if (!parser) {
      return bestGuessParser(value)
    }
    return parser(value)
  }

export const toToObjectResult =
  (propertyTypeToParser: PropertyTypeToParser) =>
  <T extends DataDescription>(
    definition: ModelDefinition<T>,
    obj: any
  ): ToObjectResult<T> => {
    const properties = definition.properties
    const parsers = toJsonAble(propertyTypeToParser)
    return Object.entries(properties)
      .map(([key, property]: [key: string, property: any]) => ({
        key,
        property: (property as PropertyInstance<any>).getPropertyType(),
      }))
      .reduce((acc, { key, property }) => {
        const value = obj[key]
        const jsonAble = parsers(property, value)
        return merge(acc, { [key]: jsonAble })
      }, {} as ToObjectResult<T>)
  }
