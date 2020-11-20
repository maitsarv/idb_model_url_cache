# idb_model_url_cache
Wrapper for IndexedDB for storing json objects mapped to URLs

## Features
* Declarative database handling - define database structure and library handles IndexedDB specific structure upgrades.
* Main use case is for storing server request results that return json object array.
* Optional encyption - Allows to add encyption plugin and encypt defined object parameters.
* Promise based

## Usage



    var tableDefinitions = [
        // Only name is required. Will create a table with auto increment primary key
        {name: 'basicTables'},
        // With primary key. All objects must have 'id' property
        {name: 'basicTables', primaryKey: 'id'},
        // Every structure change on table must increase version
        {name: 'someUpdatedTable', primaryKey: 'id', version:2 },
        // Table with 2 indexes. If needed for some custom workflow.
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
    }
