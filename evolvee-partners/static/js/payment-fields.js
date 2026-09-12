/**
 * Dynamic payout fields based on payment method + partner country.
 */
(function () {
    function getCountryCode(form) {
        const fromData = form.dataset.paymentCountry || "";
        const countrySelect = form.querySelector('[name="country_code"]');
        return (countrySelect && countrySelect.value) || fromData || "";
    }

    async function fetchSchema(method, countryCode) {
        const params = new URLSearchParams({ method, country: countryCode });
        const response = await fetch(`/api/payment-fields/?${params.toString()}`);
        if (!response.ok) {
            throw new Error("Unable to load payment fields");
        }
        return response.json();
    }

    function renderField(field, existingValue) {
        const row = document.createElement("div");
        row.className = "form-row";

        const label = document.createElement("label");
        label.textContent = field.label;
        if (field.required) {
            const req = document.createElement("span");
            req.className = "required";
            req.textContent = " *";
            label.appendChild(req);
        }
        row.appendChild(label);

        let input;
        if (field.type === "textarea") {
            input = document.createElement("textarea");
            input.rows = 3;
        } else if (field.type === "select") {
            input = document.createElement("select");
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Select…";
            input.appendChild(placeholder);
            (field.options || []).forEach((opt) => {
                const option = document.createElement("option");
                option.value = opt.value;
                option.textContent = opt.label;
                input.appendChild(option);
            });
        } else {
            input = document.createElement("input");
            input.type = field.type || "text";
        }

        input.name = field.name;
        input.required = Boolean(field.required);
        if (field.placeholder) input.placeholder = field.placeholder;
        if (existingValue) input.value = existingValue;

        row.appendChild(input);
        return row;
    }

    async function renderPaymentFields(form) {
        const methodSelect = form.querySelector('[name="payment_method"]');
        const container = form.querySelector("[data-payment-fields]");
        if (!methodSelect || !container) return;

        const method = methodSelect.value;
        const countryCode = getCountryCode(form);

        container.innerHTML = "";
        if (!method) {
            container.innerHTML = '<p class="muted">Select a payout method to see the required fields.</p>';
            return;
        }

        let initial = {};
        const initialId = form.dataset.paymentInitialId;
        if (initialId) {
            const el = document.getElementById(initialId);
            if (el) {
                try {
                    initial = JSON.parse(el.textContent);
                } catch (error) {
                    initial = {};
                }
            }
        } else {
            try {
                initial = JSON.parse(form.dataset.paymentInitial || "{}");
            } catch (error) {
                initial = {};
            }
        }
        const existing = (initial.fields || {});

        const data = await fetchSchema(method, countryCode);
        if (data.region_label) {
            const hint = document.createElement("p");
            hint.className = "muted payment-format-hint";
            hint.textContent = `Payout format for ${data.country_label || "your country"}: ${data.region_label}`;
            container.appendChild(hint);
        }

        data.fields.forEach((field) => {
            container.appendChild(renderField(field, existing[field.name] || ""));
        });
    }

    function initPaymentForm(form) {
        const methodSelect = form.querySelector('[name="payment_method"]');
        if (!methodSelect) return;

        methodSelect.addEventListener("change", () => renderPaymentFields(form));

        const locationForm = document.querySelector("[data-location-form]");
        const countrySelect = locationForm?.querySelector('[name="country_code"]');
        countrySelect?.addEventListener("change", () => {
            if (methodSelect.value) renderPaymentFields(form);
        });

        renderPaymentFields(form);
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-payment-form]").forEach(initPaymentForm);
    });
})();
