/**
 * Cascading location selects: continent → country → state → city
 */
(function () {
    const OTHER_CITY = "__other__";

    function getSelect(form, name) {
        return form.querySelector(`[name="${name}"]`);
    }

    function clearOptions(select, placeholder) {
        if (!select) return;
        select.innerHTML = "";
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = placeholder;
        select.appendChild(opt);
    }

    function fillOptions(select, items, valueKey, labelKey, selectedValue) {
        if (!select) return;
        items.forEach((item) => {
            const opt = document.createElement("option");
            opt.value = typeof item === "string" ? item : item[valueKey];
            opt.textContent = typeof item === "string" ? item : item[labelKey];
            if (selectedValue && opt.value === selectedValue) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("Failed to load location data");
        }
        return response.json();
    }

    function toggleRow(row, visible) {
        if (!row) return;
        row.classList.toggle("hidden", !visible);
    }

    function initLocationCascade(form, initial) {
        const continentSelect = getSelect(form, "continent");
        const countrySelect = getSelect(form, "country_code");
        const regionSelect = getSelect(form, "region_code");
        const citySelect = getSelect(form, "city_select");
        const cityCustom = getSelect(form, "city_custom");
        const cityHidden = getSelect(form, "city");
        const regionRow = form.querySelector("[data-location-row='region']");
        const cityRow = form.querySelector("[data-location-row='city']");
        const cityCustomRow = form.querySelector("[data-location-row='city-custom']");

        if (!continentSelect || !countrySelect) return;

        async function loadCountries(continent, selectedCountry) {
            clearOptions(countrySelect, "Select country…");
            clearOptions(regionSelect, "Select state / region…");
            clearOptions(citySelect, "Select city…");
            toggleRow(regionRow, false);
            toggleRow(cityRow, false);
            toggleRow(cityCustomRow, false);

            if (!continent) return;

            const data = await fetchJson(`/api/locations/countries/?continent=${encodeURIComponent(continent)}`);
            fillOptions(countrySelect, data.countries, "code", "name", selectedCountry);
            if (selectedCountry) {
                await loadRegions(selectedCountry, initial.region_code || "");
            }
        }

        async function loadRegions(countryCode, selectedRegion) {
            clearOptions(regionSelect, "Select state / region…");
            clearOptions(citySelect, "Select city…");
            toggleRow(regionRow, false);
            toggleRow(cityRow, false);
            toggleRow(cityCustomRow, false);

            if (!countryCode) return;

            const data = await fetchJson(`/api/locations/subdivisions/?country=${encodeURIComponent(countryCode)}`);
            if (data.subdivisions.length) {
                toggleRow(regionRow, true);
                fillOptions(regionSelect, data.subdivisions, "code", "name", selectedRegion);
                if (selectedRegion) {
                    await loadCities(countryCode, selectedRegion, initial.city || "");
                }
            } else {
                await loadCities(countryCode, "", initial.city || "");
            }
        }

        async function loadCities(countryCode, regionCode, selectedCity) {
            clearOptions(citySelect, "Select city…");
            toggleRow(cityRow, false);
            toggleRow(cityCustomRow, false);

            if (!countryCode) return;

            const params = new URLSearchParams({ country: countryCode });
            if (regionCode) params.set("region", regionCode);
            const data = await fetchJson(`/api/locations/cities/?${params.toString()}`);

            toggleRow(cityRow, true);
            fillOptions(citySelect, data.cities, null, null, selectedCity);

            const otherOpt = document.createElement("option");
            otherOpt.value = OTHER_CITY;
            otherOpt.textContent = "Other (type my city)";
            citySelect.appendChild(otherOpt);

            if (selectedCity && !data.cities.includes(selectedCity)) {
                citySelect.value = OTHER_CITY;
                toggleRow(cityCustomRow, true);
                if (cityCustom) cityCustom.value = selectedCity;
            } else if (citySelect.value === OTHER_CITY) {
                toggleRow(cityCustomRow, true);
            }

            syncCityHidden();
        }

        function syncCityHidden() {
            if (!cityHidden) return;
            if (citySelect && citySelect.value === OTHER_CITY) {
                cityHidden.value = cityCustom ? cityCustom.value.trim() : "";
            } else if (citySelect) {
                cityHidden.value = citySelect.value;
            }
        }

        continentSelect.addEventListener("change", () => {
            loadCountries(continentSelect.value, "");
        });

        countrySelect.addEventListener("change", () => {
            loadRegions(countrySelect.value, "");
        });

        regionSelect?.addEventListener("change", () => {
            loadCities(countrySelect.value, regionSelect.value, "");
        });

        citySelect?.addEventListener("change", () => {
            const showCustom = citySelect.value === OTHER_CITY;
            toggleRow(cityCustomRow, showCustom);
            if (!showCustom && cityCustom) cityCustom.value = "";
            syncCityHidden();
        });

        cityCustom?.addEventListener("input", syncCityHidden);

        form.addEventListener("submit", syncCityHidden);

        if (initial.continent) {
            continentSelect.value = initial.continent;
            loadCountries(initial.continent, initial.country_code || "");
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-location-form]").forEach((form) => {
            let initial = {};
            const initialId = form.dataset.locationInitialId;
            if (initialId) {
                const el = document.getElementById(initialId);
                if (el) {
                    try {
                        initial = JSON.parse(el.textContent);
                    } catch (error) {
                        initial = {};
                    }
                }
            } else if (form.dataset.locationInitial) {
                try {
                    initial = JSON.parse(form.dataset.locationInitial);
                } catch (error) {
                    initial = {};
                }
            }
            initLocationCascade(form, initial);
        });
    });
})();
