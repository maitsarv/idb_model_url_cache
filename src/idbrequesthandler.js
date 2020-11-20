import {IndexedDBSchemaHandler} from './indexeddbschemahandler.js';

export default class IdbRequestHandler {

  constructor(databaseName, tableDefinitions, generalSetup) {

    this.userTable = 'user_table_state';

    tableDefinitions.push({
      name: this.userTable,
      primaryKey: ['table'],
      version: 1
    });

    this.urlMap = {};
    for (let t = 0; t < tableDefinitions.length; t++) {
      if (tableDefinitions[t].url) {
        this.urlMap[tableDefinitions[t].url] = {
          table: tableDefinitions[t].name,
          url: tableDefinitions[t].url,
          enc: []
        };
      }
    }

    this.indexedDbHandler =  new IndexedDBSchemaHandler(databaseName, tableDefinitions, generalSetup);
  }

  openDatabase(callback) {
    let $this = this;
    let promise = new Promise(
      function (resolve, reject) {
        $this.indexedDbHandler.openDatabase().then(
          function (result) {
            $this.indexedDbHandler.getAll($this.userTable).then(
              function (data) {
                $this.parseUserTableData(data);
                resolve(result);
              },
              function (error) {
                reject(error);
              }
            );
          },
          function (error) {
            reject(error);
          }
        );
      });

    if (callback) {
      promise.finally(callback);
    } else {
      return promise;
    }
  }

  getUrlData(url) {
    let $this = this;
    return new Promise(
      function (resolve, reject) {
        if ($this.urlMap[url]) {
          let tableName = $this.urlMap[url].table;
          let expectVersion = $this.indexedDbHandler.tables[tableName].version;
          let dataVersion = $this.urlMap[url].version;
          if (expectVersion !== dataVersion) {
            resolve(null);
          }
          $this.indexedDbHandler.getAll($this.urlMap[url].table, $this.urlMap[url].enc).then(
            function (data) {
              resolve({
                lastUpdate: $this.urlMap[url].lastUpdate,
                data: data
              });
            },
            function (error) {
              reject(error);
            }
          );
        } else {
          resolve(null);
        }
      }
    );
  }

  replaceUrlData(url, data, timestamp) {
    let $this = this;
    if (!timestamp) {
      timestamp = Date.now();
    }
    return new Promise(
      function (resolve, reject) {
        if ($this.urlMap[url]) {
          $this.indexedDbHandler.clear($this.urlMap[url].table).then(function () {
            $this.indexedDbHandler.addRecords($this.urlMap[url].table, data).then(
              function (result) {
                $this.urlMap[url].version = $this.indexedDbHandler.tables[$this.urlMap[url].table].version;
                $this.urlMap[url].lastUpdate = timestamp;
                $this.urlMap[url].enc = $this.indexedDbHandler.tables[$this.urlMap[url].table].encrypt;
                $this.indexedDbHandler.addRecords($this.userTable, [$this.urlMap[url]]).then(
                  function () {
                    resolve(result);
                  },
                  function () {
                    reject('USER_TABLE_UPDATE_FAILED');
                  }
                );
              },
              function (error) {
                reject(error);
              }
            );
          },
          function (error)  {
            reject(error);
          });
        } else {
          resolve(null);
        }
      }
    );
  }

  parseUserTableData(data) {
    for (let d = 0; d < data.length; d++) {
      this.urlMap[data[d].url] = data[d];
    }
  }

  getAll(table) {
    return this.indexedDbHandler.getAll(table, this.indexedDbHandler.tables[table].enc);
  }

  addRecords(table, records, ignoreDuplicateKey) {
    return this.indexedDbHandler.addRecords(table, records, ignoreDuplicateKey);
  }

  deleteByPrimaryKey(table, ids) {
    return this.indexedDbHandler.deleteByPrimaryKey(table, ids);
  }
}