import { FunctionalModel, Model } from 'functional-models/interfaces'
import * as parsers from './parsers'
import * as knex from './knex'

const getTableNameForModel = <T extends FunctionalModel>(
  model: Model<T>
) => {
  return model.getName().toLowerCase().replace('_', '-').replace(' ', '-')
}

export {
  knex,
  parsers,
  getTableNameForModel,
}
