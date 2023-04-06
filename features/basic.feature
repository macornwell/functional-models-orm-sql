Feature: Using SQLite3 as a Datastore Provider

  Scenario: Able to save a very simple Test Model
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreProvider instance is created
    And an orm is created
    And data SIMPLE_MODEL_1_DATA is used
    And an instance of SIMPLE_MODEL_1 is created using the model data
    When save is called on the model instance
    Then the results matches the original model data

  Scenario: Able to save a Test model 
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreProvider instance is created
    And an orm is created
    And data TEST_MODEL_1_DATA is used
    And an instance of TEST_MODEL_1 is created using the model data
    When save is called on the model instance
    Then the results matches the original model data

  Scenario: Able to save a model with a foreign key
    Given a sqlite3 database is stood up with SETUP_1
    And a datastoreProvider instance is created
    And an orm is created
    And data TEST_MODEL_1_DATA is used
    And an instance of TEST_MODEL_1 is created using the model data and added to a models list
    And data TEST_MODEL_2_DATA is used
    And an instance of TEST_MODEL_2 is created using the model data and added to a models list
    When save is called on all the models in the model list
    And a knex select everything query is done on the table named TEST_MODEL_1_TABLE
    Then the results has a length of 1
    When a knex select everything query is done on the table named TEST_MODEL_2_TABLE
    Then the results has a length of 1
