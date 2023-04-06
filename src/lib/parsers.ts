import merge from 'lodash/merge'
import {
  PropertyInstance,
  FunctionalModel,
  TypedJsonObj,
  JsonAble,
  JsonObj,
  ModelDefinition, 
}  from 'functional-models/interfaces'
import {
  PROPERTY_TYPES as DEFAULT_PROPERTY_TYPES,
} from 'functional-models/constants'
import {
}  from 'functional-models-orm/interfaces'
import {
  SimpleSqlValue,
  PropertyTypeToParser,
  SimpleSqlObject,
} from '../interfaces'

export const toSimpleSqlValue = (propertyType: string, value: any) : SimpleSqlValue => {
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

export const toSimpleSqlObject = <T extends FunctionalModel>(definition: ModelDefinition<T>, obj: JsonObj) : SimpleSqlObject => {
  const properties = definition.properties
  if (!obj) {
    return {} 
  }
  return Object.entries(properties)
    .map(([key, property]:[key: string, property: any]) => ({ key, property: (property as PropertyInstance<any>).getPropertyType()}))
    .reduce((acc, { key, property }) => {
      const value = obj[key]
      const sqlValue = toSimpleSqlValue(property, value)
      return merge(acc, {[key]: sqlValue})
    }, {} as SimpleSqlObject)
}

export const nullParser = (func: (value: any) => JsonAble) => (value: any) => {
  if (value === undefined || value === null) {
    return null
  }
  return func(value)
}

export const stringParser = nullParser((value: any) => `${value}`)
export const integerParser = nullParser((value: any) => parseInt(value))
export const floatParser = nullParser((value: any) => parseFloat(value))
export const jsonParser = nullParser((value: any) => JSON.parse(value))
export const booleanParser = nullParser((value: any) => {
  if (typeof value === 'boolean') {
    return value as boolean
  }
  return Boolean(value)
})
export const dateParser = nullParser((value: any) => new Date(value).toISOString())
export const bestGuessParser = nullParser((value: any) : JsonAble => {
  const theType = typeof value
  if (theType === 'number' ||
     theType === 'boolean' ||
     theType === 'object') {
    return value as JsonAble 
  }
  // Could be a stringified json...
  if (theType === 'string') {
    try {
      const asJson = JSON.parse(theType)
      return asJson as JsonAble
    } catch {
    }
    return value as JsonAble
  }
  throw new Error(`Cannot determine type of ${value}! Type: ${theType}`)
})


export const BasicPropertyTypeToParser : PropertyTypeToParser = {
  [DEFAULT_PROPERTY_TYPES.UniqueId]: stringParser,
  [DEFAULT_PROPERTY_TYPES.DateProperty]: dateParser,
  [DEFAULT_PROPERTY_TYPES.ObjectProperty]: jsonParser,
  [DEFAULT_PROPERTY_TYPES.ArrayProperty]: jsonParser,
  [DEFAULT_PROPERTY_TYPES.ReferenceProperty]: stringParser,
  [DEFAULT_PROPERTY_TYPES.IntegerProperty]: integerParser,
  [DEFAULT_PROPERTY_TYPES.TextProperty]: stringParser, 
  [DEFAULT_PROPERTY_TYPES.ConstantValueProperty]: bestGuessParser,
  [DEFAULT_PROPERTY_TYPES.NumberProperty]: floatParser,
  [DEFAULT_PROPERTY_TYPES.EmailProperty]: stringParser,
  [DEFAULT_PROPERTY_TYPES.BooleanProperty]: booleanParser,
}




export const toJsonAble = (propertyTypeToParser: PropertyTypeToParser) => (propertyType: string, value: any) : JsonAble => {
  if (value === undefined || value === null) {
    return null
  }
  const parser = propertyTypeToParser[propertyType]
  if (!parser) {
    return bestGuessParser(value)
  }
  return parser(value)
}


export const toTypedJsonObj = (propertyTypeToParser: PropertyTypeToParser) => <T extends FunctionalModel>(definition: ModelDefinition<T>, obj: any) : TypedJsonObj<T> => {
  const properties = definition.properties
  if (!obj) {
    return {}  as TypedJsonObj<T>
  }
  const parsers = toJsonAble(propertyTypeToParser)
  return Object.entries(properties)
    .map(([key, property]:[key: string, property: any]) => ({ key, property: (property as PropertyInstance<any>).getPropertyType()}))
    .reduce((acc, { key, property }) => {
      const value = obj[key]
      const jsonAble = parsers(property, value)
      return merge(acc, {[key]: jsonAble})
    }, {} as TypedJsonObj<T>)
}
