export class IndexedDBSchemaHandler {

  setDefaultValues() {
    this.genralSetup = {
      versionOffset: 0,
    };
    this.tables = {};
    this.cryptoHelper = null;


    this.displayMessage = function (message) {
      alert(message);
    };
  }

  constructor(name, tableDefinitions, generalSetup) {
    if (this.checkBrowserSupport()) {
      this.name = name;
      this.setDefaultValues();
      this.setGeneralSetup(generalSetup);
      this.setTableDefinitions(tableDefinitions);
    }
  }

  checkBrowserSupport() {
    this.notSupportedMsg = null;
    if (!('indexedDB' in window)) {
      this.notSupportedMsg = 'This browser doesn\'t support IndexedDB';
      return false;
    }
    if (!window.Promise) {
      this.notSupportedMsg = 'This browser doesn\'t support Promises';
      return false;
    }
    return true;
  }

  canIUse() {
    return !this.notSupportedMsg;
  }

  setGeneralSetup(generalSetup) {
    for (let g in generalSetup) {
      if (generalSetup.hasOwnProperty(g)) {
        this.genralSetup[g] = generalSetup[g];
      }
    }

    if (this.genralSetup.cryptoHelper) {
      this.cryptoHelper = this.genralSetup.cryptoHelper;
      if (!this.cryptoHelper.encryptRecords) {
        throw new Error("CYPTOHELPER_MISSING_encryptRecords");
      }
      if (!this.cryptoHelper.decryptRecords) {
        throw new Error("CYPTOHELPER_MISSING_decryptRecords");
      }
      this.cryptoHelper.afterDatabaseOpen = this.cryptoHelper.afterDatabaseOpen || null;
    } else {
      this.cryptoHelper = {
        encryptRecords: null,
        decryptRecords: null,
        afterDatabaseOpen: null
      };
    }
  }

  setTableDefinitions(tableDefinitions) {
    let totalVersion = this.genralSetup.versionOffset;

    for(let t = 0; t < tableDefinitions.length; t++) {
      if (tableDefinitions[t].version) {
        totalVersion += tableDefinitions[t].version;
      }
      if (!Array.isArray(tableDefinitions[t].encrypt)) {
        tableDefinitions[t].encrypt = [];
      }

      tableDefinitions[t].encrypt = tableDefinitions[t].encrypt || [];
      tableDefinitions[t].decrypt = tableDefinitions[t].decrypt || [];

      this.tables[tableDefinitions[t].name] = tableDefinitions[t];

      //Default values
      this.tables[tableDefinitions[t].name].exists = false;
      this.tables[tableDefinitions[t].name].autoIncrement = false;

      if (!this.tables[tableDefinitions[t].name].primaryKey) {
        this.tables[tableDefinitions[t].name].primaryKey = '';
        this.tables[tableDefinitions[t].name].autoIncrement = true;
      }
    }

    this.totalVersion = totalVersion;
  }

  openDatabase() {
    let $this = this;
    return new Promise(function (resolve, reject) {
      if ($this.notSupportedMsg) {
        reject($this.notSupportedMsg);
      }
      var request = window.indexedDB.open($this.name, $this.totalVersion || null);

      request.onupgradeneeded = function (event) {
        console.log('upgrade', event);
        $this.db = request.result;
        $this.handleUpgradeNeeded(request, event);
      };
      request.onerror = function(errorEvent) {
        $this.db = null;
        reject(errorEvent);
      };
      request.onsuccess = function(event) {
        $this.setDatabaseAfterOpen(request.result);
        if ($this.cryptoHelper.afterDatabaseOpen) {
          $this.cryptoHelper.afterDatabaseOpen(function () {return resolve(event);},reject);
        } else {
          resolve(event);
        }
      };
    });

  }

  setDatabaseAfterOpen(db) {
    this.db = db;

    let saveUnsavedData = new Promise(function (success) {
      success();
    });

    this.db.onversionchange = function() {
      // First, save any unsaved data:
      saveUnsavedData.then(function() {
        // If the document isn’t being actively used, it could be appropriate to reload
        // the page without the user’s interaction.
        if (!document.hasFocus()) {
          location.reload();
        } else {
          // If the document has focus, it can be too disruptive to reload the page.
          // Maybe ask the user to do it manually:
          this.displayMessage("Please reload this page for the latest version.");
        }
      });
    };
  }

  handleUpgradeNeeded(request, event) {
    const existingTables = this.db.objectStoreNames;
    for (let e = 0; e < existingTables.length ; e++) {
      if (!this.tables[existingTables[e]]) {
        this.db.deleteObjectStore(existingTables[e]);
      } else {
        this.tables[existingTables[e]].exists = true;
      }
    }

    for (let t in this.tables) {
      const def = this.tables[t];
      let store = null;
      if (!def.exists) {
        store = this.db.createObjectStore(
          def.name,
          {
            keyPath: def.primaryKey,
            autoIncrement: def.autoIncrement
          }
          );
      } else {
        store = request.transaction.objectStore(def.name);
        if (def.primaryKey && !this.areIndexesSame(store.keyPath, def.primaryKey)) {
          //TODO: handle primary key change
        }
      }
      this.checkStoreIndexes(store, def.indexes);
    }
  }

  areIndexesSame(existing, provided) {
    if (typeof existing.keyPath !== typeof provided.key) {
      return false;
    } else if (Array.isArray(provided.key)) {
      if (provided.key.length !== existing.keyPath.length) {
        return false;
      } else {
        for (let a = 0; a < provided.key.length; a++) {
          if (provided.key[a] !== existing.keyPath[a]) {
            return false;
          }
        }
      }
    } else if (typeof provided.key === "string" && existing.keyPath !== provided.key) {
      return false;
    }
    return true;
  }

  checkStoreIndexes(store, indexes) {
    const existingIndexes = store.indexNames;
    let existing = {};

    let recreateIndex = function (store, index) {
      store.deleteIndex(index.name);
      store.createIndex(index.name, index.key, index.options);
    };

    for (let e = 0; e < existingIndexes.length ; e++) {
      if (!indexes[existingIndexes[e]]) {
        store.deleteIndex(existingIndexes[e]);
      } else {
        existing[existingIndexes[e]] = true;
      }
    }

    for (let i in indexes) {
      if (!existing[i]) {
        store.createIndex(indexes[i].name,indexes[i].key, indexes[i].options);
      }
      else if (indexes[i].key) {
        if (!this.areIndexesSame(existing[i], indexes[i])) {
          recreateIndex(store, indexes[i]);
        }
      }
    }
  }

  // Transactions and queries
  getStore(tableName, mode, resolve, reject) {
    if (!this.tables[tableName]) {
      throw new Error("Table '" + tableName + "' not found");
    }
    if (!this.db) {
      reject('database not open');
      return;
    }
    let tx = this.db.transaction(tableName, mode);

    if (reject) {
      tx.onabort = function() {
        reject(tx.error);
      };
    }
    if (resolve) {
      tx.oncomplete = function() {
        resolve();
      };
    }

    return tx.objectStore(tableName);
  }

  getAll(table, encrypted) {
    let $this = this;
    return new Promise(function (resolve, reject) {
      let objectStore = $this.getStore(table, "readonly", null, reject);
      var request = null;

      request = objectStore.getAll();

      request.onerror = function(event) {
        reject(event);
      };
      request.onsuccess = function() {
        if (encrypted && encrypted.length > 0) {
          if ($this.cryptoHelper.decryptRecords) {
            $this.cryptoHelper.decryptRecords(request.result, encrypted).then(
              function ()  {
                resolve(request.result);
              },
              function (error) {
                reject(error);
              }
            );
          } else {
            reject('NEEDS_DECRYPT_CRYPTO_FUNCTIONS_UNKNOWN');
          }
        } else {
          resolve(request.result);
        }
      };
    });
  }

  getByKey(table, indexName, keys, sorted) {
    let $this = this;

    var findIndexRecords = function (index, records, resolve, reject) {
      var cursorRequest = index.openCursor(records[0], records[records.length-1]);
      var i = 0;
      var found = [];

      cursorRequest.onsuccess = function (event) {
        var cursor = event.target.result;

        if (!cursor) {
          resolve([]);
          return;
        }

        var key = cursor.key;

        while (key > records[i]) {
          i++;
          if (i === records.length) {
            // All found
            resolve(found);
            return;
          }
        }

        if (key === records[i]) {
          found.push(cursor.value);
          cursor.continue();
        } else {
          cursor.continue(records[i]);
        }
      };
      cursorRequest.onerror = function (event) {
        reject(event.target.errorCode);
      };
    };

    return new Promise(function (resolve, reject) {
      if (!keys) {
        resolve([]);
      }

      if (!sorted) {
        if (Array.isArray(keys[0])) {
          keys.sort(function (a, b) {
            for (let i = 0; i < a.length; i++) {
              if (a[i] > b[i]) return 1;
              if (a[i] < b[i]) return -1;
            }
            return 0;
          });
        } else {
          keys.sort();
        }
      }
      let objectStore = $this.getStore(table, "readonly", resolve, reject);
      if (indexName) {
        findIndexRecords(objectStore.index(indexName), keys, resolve, reject);
      } else {
        findIndexRecords(objectStore, keys, resolve, reject);
      }
    });
  }


  addRecordsToStore(store, records, ignoreDuplicateKey) {
    if (ignoreDuplicateKey) {
      for (let o = 0; o < records.length; o++) {
        let request = store.add(records[o]);
        request.onerror = function(event) {
          if (this.error && this.error.name === "ConstraintError") {
            event.preventDefault();
          }
        };
      }
    } else {
      for (let o = 0; o < records.length; o++) {
        store.add(records[o]);
      }
    }
  }

  addRecords(table, records, ignoreDuplicateKey) {
    let $this = this;
    return new Promise(function (resolve, reject) {
      if (!Array.isArray(records)) {
        reject("Parameter 'records' should be an array");
      }

      if ($this.cryptoHelper.encryptRecords && $this.tables[table].encrypt.length > 0) {
        $this.cryptoHelper.encryptRecords(records, $this.tables[table].encrypt).then(
          function () {
            let store = $this.getStore(table, "readwrite", resolve, reject);
            $this.addRecordsToStore(store, records, ignoreDuplicateKey);
          },
          function (err) {
            reject(err);
          }
        );
      } else {
        let store = $this.getStore(table, "readwrite", resolve, reject);
        $this.addRecordsToStore(store, records, ignoreDuplicateKey);
      }
    });
  }

  clear(table) {
    let $this = this;
    return new Promise(function (resolve, reject) {
      var objectStore = $this.getStore(table, "readwrite", resolve, reject);
      var request = null;

      request = objectStore.clear();

      request.onerror = function(event) {
        reject(event);
      };
      request.onsuccess = function() {
        resolve();
      };
    });
  }

  deleteByPrimaryKey(table, ids) {
    let $this = this;
    return new Promise(function (resolve, reject) {
      if (!Array.isArray(ids) || ids.length === 0) {
        reject("Parameter 'records' should be an array with at least one element");
      }
      var store = $this.getStore(table, "readwrite", resolve, reject);

      for (let o = 0; o < ids.length; o++) {
        store.delete(ids[o]);
      }
    });
  }
}