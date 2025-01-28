Feature: Using SQLite3 as a Datastore Provider

  Scenario: Able to save a very simple Test Model
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreAdapter instance is created and an orm
    And data SIMPLE_MODEL_1_DATA is used
    And an instance of SIMPLE_MODEL_1 is created using the model data
    When save is called on the model instance
    Then the results matches the original model data

  Scenario: Able to save a Test model 
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreAdapter instance is created and an orm
    And data TEST_MODEL_1_DATA is used
    And an instance of TEST_MODEL_1 is created using the model data
    When save is called on the model instance
    Then the results matches the original model data

  Scenario: Able to save a model with a foreign key
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreAdapter instance is created and an orm
    And data TEST_MODEL_1_DATA is used
    And an instance of TEST_MODEL_1 is created using the model data and added to a models list
    And data TEST_MODEL_2_DATA is used
    And an instance of TEST_MODEL_2 is created using the model data and added to a models list
    When save is called on all the models in the model list
    And a knex select everything query is done on the table named TEST_MODEL_1
    Then the results has a length of 1
    When a knex select everything query is done on the table named TEST_MODEL_2
    Then the results has a length of 1

  Scenario: Able to CRUD a Test Model
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreAdapter instance is created and an orm
    And data TEST_MODEL_1_DATA is used
    And an instance of TEST_MODEL_1 is created using the model data
    When save is called on the model instance
    Then the results matches the original model data
    When retrieve is called on TEST_MODEL_1 with TEST_MODEL_1_ID
    Then the results matches the original model data
    When delete is called on the model instance with NOTHING_ARGS
    And retrieve is called on TEST_MODEL_1 with TEST_MODEL_1_ID
    Then the results matches UNDEFINED 


  Scenario: Searching properties of models
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreAdapter instance is created and an orm
    And loaded with models of DATED_MODEL using BULK_DATA_1
    When search on DATED_MODEL is called with QUERY_1
    Then the results has a length of 2
    When search on DATED_MODEL is called with QUERY_2
    Then the results has a length of 1
    When search on DATED_MODEL is called with QUERY_3
    Then the results has a length of 3

  Scenario: Searching models by dates
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreAdapter instance is created and an orm
    And loaded with models of DATED_MODEL using BULK_DATA_1
    When search on DATED_MODEL is called with QUERY_4
    Then the results has a length of 1 
    When search on DATED_MODEL is called with QUERY_5
    Then the results has a length of 2 
    When search on DATED_MODEL is called with QUERY_6
    Then the results has a length of 3 
    When search on DATED_MODEL is called with QUERY_7
    Then the results has a length of 4 

  Scenario: Can sort up and down by a property in a search
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreAdapter instance is created and an orm
    And loaded with models of DATED_MODEL using BULK_DATA_1
    When search on DATED_MODEL is called with ASCENDING_SORT_QUERY_1
    Then the results matches ASCENDING_SORT_RESULT_1 when ignoring id
    When search on DATED_MODEL is called with DESCENDING_SORT_QUERY_1
    Then the results matches DESCENDING_SORT_RESULT_1 when ignoring id
