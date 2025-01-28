import { DataDescription, ModelType } from 'functional-models'
import kebabCase from 'lodash/kebabCase'
import * as knex from './knex'
import * as parsers from './parsers'

const getTableNameForModel = <T extends DataDescription>(
  model: ModelType<T>
) => {
  return kebabCase(model.getName()).toLowerCase()
}

export { getTableNameForModel, knex, parsers }
