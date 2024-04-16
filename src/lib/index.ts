import { FunctionalModel, Model } from 'functional-models/interfaces'
import * as knex from './knex'
import * as parsers from './parsers'

const getTableNameForModel = <T extends FunctionalModel>(model: Model<T>) => {
  return model.getName().toLowerCase().replace('_', '-').replace(' ', '-')
}

export { knex, parsers, getTableNameForModel }
