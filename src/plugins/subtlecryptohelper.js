export default function SubtleCryptoHelper(encryptionKey, cryptoInitVector) {

  var cryptoKeyImportPromise = null;
  var cryptoKey = null;
  if (!cryptoInitVector) {
    cryptoInitVector = Uint8Array.from([194,247,133,101,219,42,6,42,42,209,136,9]);
  }

  var stringArrayHelpers = {
    str2array: function (str) {
      var bufView = new Uint16Array(str.length);
      for (var i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return bufView;
    },
    str2ab: function (str) {
      if (!str) {
        str = "";
      }
      var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
      var bufView = new Uint16Array(buf);
      for (var i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return buf;
    },
    ab2str: function (buf) {
      return String.fromCharCode.apply(null, new Uint16Array(buf));
    }
  };

  var doInit = function () {
    if (typeof encryptionKey !== "string") {
      throw new Error("ENCRYPTION_KEY_MUST_BE_STRING");
    }
    if (encryptionKey.length !== 16 && encryptionKey.length !== 32) {
      throw new Error("ENCRYPTION_KEY_LENGTH_16_OR_32_REQUIRED");
    }

    cryptoKeyImportPromise = window.crypto.subtle.importKey(
      "raw",
      stringArrayHelpers.str2ab(encryptionKey),
      "AES-GCM",
      true,
      ["encrypt", "decrypt"]
    );
  };
  doInit();


  this.afterKeyImport = function (success, onError) {
    if (cryptoKeyImportPromise) {
      cryptoKeyImportPromise.then(
        function (key) {
          cryptoKey = key;
          cryptoKeyImportPromise = null;
          success();
        },
        function (errorMsg) {
          onError(errorMsg);
        }
      );
    } else {
      success();
    }
  };



  async function runDecyption(records, fields)
  {
    for (let r = 0; r < records.length; r++) {
      for (let f = 0; f < fields.length; f++) {
        let name = fields[f];
        if (records[r].attributes[name]) {
          records[r].attributes[name] = stringArrayHelpers.ab2str(await window.crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: cryptoInitVector
            },
            cryptoKey,
            records[r].attributes[name]
          ));
        }
      }
    }
  }

  this.decryptRecords = function (records, fields) {
    var center = Math.floor(records.length / 2);
    var records1 = records.slice(0, center);
    var records2 = records.slice(center);
    var promises = [runDecyption(records1, fields)];
    promises.push(runDecyption(records2, fields));
    return Promise.all(promises);
  };


  async function runEncyption(records, fields)
  {
    for (let r = 0; r < records.length; r++) {
      for (let f = 0; f < fields.length; f++) {
        let name = fields[f];
        if (records[r].attributes[name]) {
          records[r].attributes[name] = await window.crypto.subtle.encrypt(
            {
              name: "AES-GCM",
              iv: cryptoInitVector
            },
            cryptoKey,
            stringArrayHelpers.str2ab(records[r].attributes[name])
          );
        }
      }
    }
  }

  this.encryptRecords = function (records, fields) {
    var center = Math.floor(records.length / 2);
    var records1 = records.slice(0, center);
    var records2 = records.slice(center);
    var promises = [runEncyption(records1, fields)];
    promises.push(runEncyption(records2, fields));
    return Promise.all(promises);
  };

  return {
    afterDatabaseOpen: this.afterKeyImport,
    encryptRecords: this.encryptRecords,
    decryptRecords: this.decryptRecords
  };
};