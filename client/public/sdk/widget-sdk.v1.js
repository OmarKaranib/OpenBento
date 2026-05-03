/* OpenBento Widget SDK v1 — dependency-free, ~3 KB.
 * Drop into your widget's HTML:
 *   <script src="https://YOUR-OPENBENTO-HOST/sdk/widget-sdk.v1.js"></script>
 *
 * Then in your widget script:
 *   OpenBento.ready({ name: 'My Widget', version: '1.0.0' });
 *   const state = await OpenBento.getState();
 *   await OpenBento.setState({ count: 1 });
 *   OpenBento.onTheme(t => applyTheme(t));
 *   OpenBento.onResize(({w, h}) => relayout(w, h));
 *   OpenBento.requestRefresh();
 *
 * Protocol envelope: { v: 1, id, type, payload? }. See /dev/widgets for
 * the full contract. Messages with v !== 1 or unknown type are ignored.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.OpenBento) return;

  var V = 1;
  var pending = Object.create(null);
  var seq = 1;
  var cbResize = null;
  var cbTheme = null;
  var cbRefresh = null;
  var TIMEOUT_MS = 5000;

  function genId() { return 'm' + (seq++) + '_' + Date.now().toString(36); }

  function send(type, payload, id) {
    var msg = { v: V, id: id || genId(), type: type };
    if (payload !== undefined) msg.payload = payload;
    try { parent.postMessage(msg, '*'); } catch (_e) { /* host gone */ }
    return msg.id;
  }

  function request(type, payload) {
    return new Promise(function (resolve, reject) {
      var id = send(type, payload);
      var to = setTimeout(function () {
        if (pending[id]) {
          delete pending[id];
          reject(new Error('OpenBento: timeout waiting for ' + type));
        }
      }, TIMEOUT_MS);
      pending[id] = {
        resolve: function (v) { clearTimeout(to); resolve(v); },
        reject:  function (e) { clearTimeout(to); reject(e); }
      };
    });
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object' || d.v !== V || typeof d.type !== 'string') return;

    // Correlated responses
    if (d.type === 'state' || d.type === 'ack') {
      var p = d.id && pending[d.id];
      if (p) { delete pending[d.id]; p.resolve(d.payload); }
      return;
    }
    if (d.type === 'error') {
      var pe = d.id && pending[d.id];
      if (pe) {
        delete pending[d.id];
        pe.reject(new Error((d.payload && d.payload.message) || 'OpenBento error'));
      }
      return;
    }
    // Push notifications
    if (d.type === 'theme' && cbTheme) { try { cbTheme(d.payload); } catch (_e) {} return; }
    if (d.type === 'resize' && cbResize) { try { cbResize(d.payload); } catch (_e) {} return; }
    if (d.type === 'refresh' && cbRefresh) { try { cbRefresh(); } catch (_e) {} return; }
  });

  var OpenBento = {
    PROTOCOL_VERSION: V,
    ready: function (meta) {
      var payload = {};
      if (meta && typeof meta === 'object') {
        if (typeof meta.name    === 'string') payload.name    = meta.name.slice(0, 64);
        if (typeof meta.version === 'string') payload.version = meta.version.slice(0, 32);
      }
      send('ready', payload);
    },
    getState: function () { return request('getState'); },
    setState: function (patch) {
      if (!patch || typeof patch !== 'object') patch = {};
      return request('setState', patch);
    },
    onResize:  function (cb) { cbResize  = (typeof cb === 'function') ? cb : null; },
    onTheme:   function (cb) { cbTheme   = (typeof cb === 'function') ? cb : null; },
    onRefresh: function (cb) { cbRefresh = (typeof cb === 'function') ? cb : null; },
    requestRefresh: function () { send('refresh'); }
  };

  // Freeze so widgets can't mutate the contract.
  try { Object.freeze(OpenBento); } catch (_e) {}
  window.OpenBento = OpenBento;
})();
