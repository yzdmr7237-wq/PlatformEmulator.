(function () {
  "use strict";

  /*
   * Desktop Mode for Kettu
   * Changes only the Discord Gateway IDENTIFY platform properties:
   *   os      -> Windows
   *   browser -> Discord Client
   *   device  -> Discord Client
   *
   * It does not inspect incoming messages or channels.
   * Restart Discord after changing the setting so the next Gateway
   * connection sends a fresh IDENTIFY payload.
   */

  var storage = vendetta.plugin.storage;
  if (storage.enabled == null) storage.enabled = true;

  var originalSend = null;
  var installed = false;

  function log() {
    try {
      if (vendetta.logger && vendetta.logger.log) {
        vendetta.logger.log.apply(vendetta.logger, arguments);
      }
    } catch (_) {}
  }

  function getWebSocket() {
    try {
      if (typeof WebSocket !== "undefined") return WebSocket;
    } catch (_) {}
    return null;
  }

  function patchSend() {
    if (installed) return true;

    var WS = getWebSocket();
    if (!WS || !WS.prototype || typeof WS.prototype.send !== "function") {
      log("[Desktop Mode] WebSocket.send was not available");
      return false;
    }

    originalSend = WS.prototype.send;

    WS.prototype.send = function (data) {
      try {
        if (storage.enabled && typeof data === "string") {
          var packet = JSON.parse(data);

          // Gateway IDENTIFY is opcode 2.
          // Only modify the platform properties; leave everything else intact.
          if (
            packet &&
            packet.op === 2 &&
            packet.d &&
            packet.d.properties &&
            typeof packet.d.properties === "object"
          ) {
            var props = Object.assign({}, packet.d.properties);
            props.os = "Windows";
            props.browser = "Discord Client";
            props.device = "Discord Client";

            packet.d = Object.assign({}, packet.d, { properties: props });
            data = JSON.stringify(packet);
          }
        }
      } catch (_) {
        // Non-JSON / binary WebSocket traffic is passed through untouched.
      }

      return originalSend.call(this, data);
    };

    installed = true;
    return true;
  }

  function unpatchSend() {
    if (!installed) return;

    var WS = getWebSocket();
    if (WS && WS.prototype && originalSend) {
      try {
        WS.prototype.send = originalSend;
      } catch (_) {}
    }

    originalSend = null;
    installed = false;
  }

  function Settings() {
    var React = vendetta.metro.common.React;
    var RN = vendetta.metro.common.ReactNative;
    var View = RN.View;
    var Text = RN.Text;
    var Switch = RN.Switch;

    function update(value) {
      storage.enabled = !!value;
      try {
        vendetta.ui.toasts.showToast(
          storage.enabled
            ? "Desktop Mode enabled — restart Discord"
            : "Desktop Mode disabled — restart Discord"
        );
      } catch (_) {}
    }

    return React.createElement(
      View,
      { style: { padding: 16 } },
      React.createElement(
        Text,
        { style: { fontSize: 20, fontWeight: "700", marginBottom: 8 } },
        "Desktop Mode"
      ),
      React.createElement(
        Text,
        { style: { fontSize: 14, marginBottom: 16, opacity: 0.75 } },
        "Makes the Gateway IDENTIFY platform appear as Windows/Desktop. Restart Discord after changing this switch."
      ),
      React.createElement(
        View,
        {
          style: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          }
        },
        React.createElement(
          Text,
          { style: { fontSize: 16 } },
          "Desktop Mode"
        ),
        React.createElement(Switch, {
          value: !!storage.enabled,
          onValueChange: update
        })
      )
    );
  }

  return {
    onLoad: function () {
      patchSend();
      log("[Desktop Mode] loaded; enabled =", !!storage.enabled);
    },

    onUnload: function () {
      unpatchSend();
      log("[Desktop Mode] unloaded");
    },

    settings: Settings
  };
})()
