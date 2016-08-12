module.exports = (() => {

  'use strict';

  const https = require('https');
  const http = require('http');

  class APIResourceRequest {

    constructor(parent, path) {

      this.parent = parent;
      this.path = path[0] === '/' ? path : `/${path}`;
      this._headers = {};

    }

    headers(obj) {
      this._headers = obj;
      return this;
    }

    /* CRUD Methods */

    index(params, callback) {
      return this.get(null, params, callback);
    }

    show(id, params, callback) {
      return this.get(id, params, callback);
    }

    destroy(id, params, callback) {
      return this.del(id, params, callback);
    }

    update(id, params, data, callback) {
      return this.put(id, params, data, callback);
    }

    create(params, data, callback) {
      return this.post(null, params, data, callback);
    }

    /* HTTP methods */

    put(id, params, data, callback) {
      this.requestJSON('PUT', id, params, data, callback);
    }

    post(id, params, data, callback) {
      this.requestJSON('POST', id, params, data, callback);
    }

    del(id, params, callback) {
      this.requestJSON('DELETE', id, params, null, callback);
    }

    get(id, params, callback) {
      this.requestJSON('GET', id, params, null, callback);
    }

    /* Request methods */

    requestJSON(method, id, params, data, callback) {
      return this.__request__(true, method, id, params, data, callback);
    }

    request(method, id, params, data, callback) {
      return this.__request__(false, method, id, params, data, callback);
    }

    __request__(expectJSON, method, id, params, data, callback) {

      params = this.parent.serialize(params);

      let path = this.path;
      let headers = {};

      Object.keys(this.parent._headers).forEach(k => headers[k] = this.parent._headers[k]);
      Object.keys(this._headers).forEach(k => headers[k] = this._headers[k]);

      if (data && typeof data === 'object' && !(data instanceof Buffer)) {
        try {
          if (data.hasOwnProperty('__serialize__')) {
            delete data.__serialize__;
            data = this.parent.serialize(data);
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
          } else {
            data = JSON.stringify(data);
            headers['Content-Type'] = 'application/json; charset=utf-8';
          }
        } catch (e) {
          // do nothing
        }
      }

      let url = `${path}${id ? '/' + id : ''}?${params}`;

      (this.parent.ssl ? https : http).request({
        headers: headers,
        host: this.parent.host,
        method: method,
        port: this.parent.port,
        path: url
      }, (res) => {

        let buffers = [];
        res
          .on('data', (chunk) => buffers.push(chunk))
          .on('end', () => {

            let response;

            if (expectJSON) {

              let str = Buffer.concat(buffers).toString();

              try {
                response = JSON.parse(str);
              } catch (e) {
                return callback(new Error(['Unexpected server response:', str].join('\n')), {});
              }

              if (response.meta && response.meta.error) {
                let error = new Error(response.meta.error.message);
                if (response.meta.error.details) {
                  error.details = response.meta.error.details;
                }
                return callback(error, response, res.headers, res.statusCode);
              }

            } else {

              response = Buffer.concat(buffer);

            }

            return callback(null, response, res.headers, res.statusCode);

          });

      })
      .on('error', (e) => callback(new Error('Server unavailable'), {}, {}, 0))
      .end(data || null);

    }

  }

  class APIResource {

    constructor(host, port, ssl) {

      if (host.indexOf('https://') === 0) {
        host = host.substr(8);
        port = parseInt(port) || 443;
        ssl = true;
      } else if (host.indexOf('http://') === 0) {
        host = host.substr(7);
        port = parseInt(port) || 80;
        ssl = false;
      } else {
        port = parseInt(port) || 80;
        ssl = false;
      }

      if (port === 443) {
        ssl = true;
      }

      if (host.split(':').length > 1) {
        let split = host.split(':');
        host = split[0];
        port = parseInt(split[1]);
      }

      this.host = host;
      this.port = port;
      this.ssl = ssl;
      this._headers = {};

    }

    authorize(accessToken) {
      this._headers.Authorization = `Bearer ${accessToken}`;
    }

    __convert__(keys, isArray, v) {
      isArray = ['', '[]'][isArray | 0];
      return (keys.length < 2) ? (
        [keys[0], isArray, '=', v].join('')
      ) : (
        [keys[0], '[' + keys.slice(1).join(']['), ']', isArray, '=', v].join('')
      );
    }

    __serialize__(obj, keys, key, i) {

      keys = keys.concat([key]);
      let datum = obj;

      keys.forEach(key => datum = datum[key]);

      if (datum instanceof Date) {

        datum = [datum.getFullYear(), datum.getMonth() + 1, datum.getDate()].join('-');

      }

      if (datum instanceof Array) {

        return datum.map(fnConvert.bind(null, keys, true)).join('&');

      } else if (typeof datum === 'object' && datum !== null) {

        return Object.keys(datum).map(this.__serialize__.bind(null, obj, keys)).join('&');

      }

      return this.__convert__(keys, false, datum);

    }

    serialize(obj) {

      obj = obj || {};

      let newObj = {};
      Object.keys(obj).forEach(k => newObj[k] = obj[k]);

      return Object.keys(newObj).map(this.__serialize__.bind(this, newObj, [])).join('&');

    }

    request(path) {

      return new APIResourceRequest(this, path);

    }

  }

  return APIResource;

})();
