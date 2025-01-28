import { assert } from 'chai'
import { create as sqlDatastore } from '../../src/datastoreAdapter'

describe('#/src/datastoreAdapter.ts', () => {
  describe('#create()', () => {
    it('should create an object with ...', () => {
      const instance = sqlDatastore({
        knex: {},
      })
      const actual = Object.keys(instance)
      const expected = ['search', 'save', 'delete', 'retrieve', 'bulkInsert']
      assert.includeMembers(actual, expected)
    })
  })
})
