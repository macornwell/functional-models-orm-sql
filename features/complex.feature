Feature: Complex Queries

  Scenario: Able to perform complex nested queries
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreAdapter instance is created and an orm
    And loaded with models of DATED_MODEL using BULK_DATA_1
    When search on DATED_MODEL is called with COMPLEX_QUERY_1
    Then the results has a length of 4

