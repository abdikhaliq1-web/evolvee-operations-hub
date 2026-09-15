/**
 * Evolvée Radiance — Partner referral attribution for Shopify
 *
 * Captures ?ref=ER-XXXXXX (or partner / partner_code / discount_code) from the
 * URL, saves it in localStorage, and writes it to cart attributes so it appears
 * on the order as note_attributes for webhook attribution.
 *
 * Install:
 * 1. Upload this file to Shopify theme Assets
 * 2. Add to theme.liquid before </body>:
 *    <script src="{{ 'partner-attribution.js' | asset_url }}" defer></script>
 */
(function () {
  var STORAGE_KEY = "er_partner_ref";
  var PARAMS = ["ref", "partner", "partner_code", "discount_code"];

  function getRefFromUrl() {
    var params = new URLSearchParams(window.location.search);
    for (var i = 0; i < PARAMS.length; i++) {
      var value = params.get(PARAMS[i]);
      if (value && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  function saveRef(ref) {
    try {
      localStorage.setItem(STORAGE_KEY, ref);
    } catch (e) {}
  }

  function loadRef() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setCartAttributes(ref) {
    if (!ref) {
      return;
    }

    fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attributes: {
          ref: ref,
          partner_code: ref,
        },
      }),
    }).catch(function () {});
  }

  var ref = getRefFromUrl() || loadRef();
  if (!ref) {
    return;
  }

  saveRef(ref);
  setCartAttributes(ref);
})();
