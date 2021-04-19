# idb_model_url_cache
Wrapper for IndexedDB for storing json objects mapped to URLs

## Features
* Declarative database handling - define database structure and library handles IndexedDB specific structure upgrades.
* Allows to easily store server request results that return json object array.
* Optional encyption - Allows to add encyption plugin and encypt defined object parameters.
* Promise based
* Optimized multi record requests

#### Declarative database
All table definitions (with table version numbers) should be provided to the library on initialization. All versions numbers are added together and when IndexedDB needs to update based on version number, then tables will be updated according to the provided definitions.
This allows to easily see the up to date version of the database and prevents long version check chains in IndexedDB onUpgradeNeeded method. Probably in most cases users are updating from version 0, this allows to create new database optimally.

(If there is need for some custom data conversion on the database, then every table definition can have conversion function where parameters are version from and version to.)

#### Server request cache
There is additonal `user_table_state` table created automatically. This tracks when data was last pulled from server, on what table version was it and stores any meta data regarding encryption
When URL is provided to the defintion, then `replaceUrlData` and `getUrlData` allow to save and get the url specific data from database.
If database version is changed, then previous cached that is discarded.
`fetchData` method gets the last update timestamp, fetches updates from backend based on timestamp, gets data from indexedDB, merges updates and returns the records.

## Usage



    var tableDefinitions = [
        // Only name is required. Will create a table with auto increment primary key
        {name: 'basicTables'},
        // With primary key. All objects must have 'id' property
        {name: 'basicTables', primaryKey: 'id'},
        // Table version must increase on every structure change 
        {name: 'someUpdatedTable', primaryKey: 'id', version:2 },
        // Table with 2 indexes.
        {name: 'tableWithIndexes', primaryKey: 'id', version:1, indexes: ['timestamp,lastname', ['lastname', 'DOB']] },
        // Encrypts firstname and lastname when cryptoHelper is provided.
        // Note: No point to encrypt indexed fields when you need to query range
        {name: 'encyptedTable', version:1, encrypted:['firstname', 'lastname'] },
    ];
    var additionalParameters = {
        // When deleting a table add table version + 1 to offset
        versionOffset: 0,
        // Library that handles encryption. Must provide encryptRecords(records, fields) and decryptRecords(records, fields) methods
        cryptoHelper: null
    };
    //Initialize database
    var myIdb = new indexedDBModelCache('testDatabase', tableDefinitions, additionalParameters);
    myIdb.openDatabase().then(
        function (successEvent) {
            //Database opened and upgrades made successfully.
            continueMyCode();
        },
        function (error) {
            //Error on database open
        }
    );


    //Some functions called after database is opened.
    function beforeRequestToServer(url) {
        myIdb.getUrlData(url).then(
            function (cachedData) {
                // cachedData = null when version id IndexedDB is old, or database is deleted
                if (cachedData) {
                    var timestamp = cachedData.lastUpdate;
                    var records = cachedData.data;
                }
            },
            function (error) {
                // Some transaction error
            }
        );

        myIdb.replaceUrlData(url, data, timestamp).then(
            function () {
               // Success
            },
            function (error) {
                // Some transaction error
            }
        )
    }
    
    
    
    //Not recommended in usual flow.
    function doOtherRequestsDirectlyOnTables(table) {
        myIdb.getAll(table).then( function (records) {

        });

        myIdb.addRecords(table, records, ignoreDuplicateKey).then(function () {
            //Transaction complete
        });

        myIdb.deleteByPrimaryKey(table, ids).then(function () {
            //Transaction complete
        });

        myIdb.getByKey(table, indexName, keys, areKeysSorted).then(function (records) {
            //Transaction complete
        });
    }
