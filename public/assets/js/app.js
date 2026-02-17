(function () {
    const state = {
        store: null,
        homeCategory: '',
        modalCategory: '',
        q: '',
        orderby: 'recommended',
        onSale: 0,
        priceTier: '',
        page: 1,
        perPage: 10,
        hasMore: true,
        isLoading: false,
        categories: [],
        productById: {},
        searchTimer: null,
        suggestTimer: null,
        suggestionsOpen: false,
    };

    function esc(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    async function ropFetch(action, data = {}) {
        if (!window.ropAjax || !window.ropAjax.url || !window.ropAjax.nonce) {
            throw new Error('ropAjax config ausente');
        }

        const body = new URLSearchParams({ action, nonce: window.ropAjax.nonce, ...data });
        const res = await fetch(window.ropAjax.url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body,
        });

        return res.json();
    }

    function getAppRoot() {
        return document.querySelector('.rop-app[data-rop-app="1"]');
    }

    function getHomeScreen(appRoot) {
        return appRoot ? appRoot.querySelector('#home-screen') : null;
    }

    function getHomeSearchInput(homeScreen) {
        return homeScreen
            ? homeScreen.querySelector('input[placeholder="Pesquisar seu lanche..."]')
            : null;
    }

    function getHomeChipsContainer(homeScreen) {
        return homeScreen ? homeScreen.querySelector('.overflow-x-auto.no-scrollbar') : null;
    }

    function getHomeGrid(homeScreen) {
        return homeScreen ? homeScreen.querySelector('div.grid.grid-cols-2.md\\:grid-cols-3.lg\\:grid-cols-4.xl\\:grid-cols-5') : null;
    }

    function prepareHomeContainers(homeScreen) {
        const grid = getHomeGrid(homeScreen);
        if (grid) {
            grid.style.visibility = 'hidden';
            grid.innerHTML = '';
        }

        const chips = getHomeChipsContainer(homeScreen);
        if (chips) {
            chips.style.visibility = 'hidden';
            chips.innerHTML = '';
        }
    }

    function getFilterModal() {
        return document.getElementById('filter-modal');
    }

    function getFilterApplyButton(modal) {
        return modal ? modal.querySelector('button[onclick*="toggleModal(\'filter-modal\')"]') : null;
    }

    function applyStoreVars(appRoot, store) {
        appRoot.style.setProperty('--rop-primary', store.primary_color || '#EF4444');
        appRoot.style.setProperty('--rop-secondary', store.secondary_color || '#FFFFFF');
        appRoot.style.setProperty('--rop-dark', store.dark_color || '#2D2929');
    }

    function updateHomeTexts(appRoot, store) {
        const homeScreen = getHomeScreen(appRoot);
        if (!homeScreen) return;

        const nameEl = homeScreen.querySelector('h1.logo-font');
        if (nameEl && store.store_name) nameEl.textContent = store.store_name;

        const sloganEl = homeScreen.querySelector('p.text-gray-400.text-xs');
        if (sloganEl && store.slogan) sloganEl.textContent = store.slogan;
    }

    function updateInfoTexts(appRoot, store) {
        const infoScreen = appRoot.querySelector('#info-screen');
        if (!infoScreen) return;

        const badge = infoScreen.querySelector('.logo-font');
        if (badge && store.store_name) badge.textContent = store.store_name;

        const title = infoScreen.querySelector('h3.text-2xl.font-bold.text-gray-800');
        if (title && store.store_name) title.textContent = store.store_name;

        const slogan = infoScreen.querySelector('p.text-gray-400.text-sm');
        if (slogan && store.slogan) slogan.textContent = store.slogan;

        const addressLabel = Array.from(infoScreen.querySelectorAll('h4')).find((el) => el.textContent.trim() === 'Endereço');
        if (addressLabel && store.address) {
            const addressEl = addressLabel.parentElement ? addressLabel.parentElement.querySelector('p') : null;
            if (addressEl) addressEl.textContent = store.address;
        }

        const phoneLabel = Array.from(infoScreen.querySelectorAll('h4')).find((el) => el.textContent.trim() === 'Telefone');
        if (phoneLabel && store.phone) {
            const phoneEl = phoneLabel.parentElement ? phoneLabel.parentElement.querySelector('p') : null;
            if (phoneEl) phoneEl.textContent = store.phone;
        }
    }

    function openClosedModalFallback() {
        const modal = document.getElementById('store-closed-modal');
        if (!modal) return;

        modal.classList.remove('hidden');
        setTimeout(function () {
            modal.classList.add('modal-active');
        }, 10);
    }

    function updateClosedModalText(humanStatus) {
        const modal = document.getElementById('store-closed-modal');
        if (!modal) return;

        const p = modal.querySelector('p');
        if (!p) return;

        const base = 'Estamos fechados no momento. Navegue pelo cardápio!';
        p.textContent = humanStatus ? base + ' ' + humanStatus : base;
    }

    function productSubtext(product) {
        if (product.category_name) return product.category_name;
        return '—';
    }

    function productDisplayPrice(product) {
        if (typeof product.price === 'number' && !Number.isNaN(product.price)) {
            return 'R$ ' + product.price.toFixed(2).replace('.', ',');
        }

        const stripped = String(product.price_html || '').replace(/<[^>]+>/g, '').trim();
        return stripped || '—';
    }

    function makeChip(templateButton, label, active, onClick) {
        const btn = templateButton.cloneNode(true);
        btn.type = 'button';
        btn.textContent = label;
        btn.onclick = null;
        btn.className = active
            ? 'bg-red-500 text-white px-7 py-3 rounded-2xl text-sm font-semibold shrink-0 shadow-sm hover:shadow-md transition-shadow'
            : 'bg-gray-100/80 text-gray-500 px-7 py-3 rounded-2xl text-sm font-medium shrink-0 hover:bg-gray-200 transition-colors';
        btn.addEventListener('click', onClick);
        return btn;
    }

    function renderHomeCategoryChips(homeScreen) {
        const container = getHomeChipsContainer(homeScreen);
        if (!container) return;

        const templateButton = container.querySelector('button');
        if (!templateButton) return;

        container.innerHTML = '';

        const allBtn = makeChip(templateButton, 'Tudo', state.homeCategory === '', function () {
            state.homeCategory = '';
            state.modalCategory = '';
            resetAndLoadProducts(homeScreen);
            renderHomeCategoryChips(homeScreen);
        });
        container.appendChild(allBtn);

        state.categories.forEach(function (cat) {
            const btn = makeChip(templateButton, cat.name, state.homeCategory === cat.slug, function () {
                state.homeCategory = cat.slug;
                state.modalCategory = cat.slug;
                resetAndLoadProducts(homeScreen);
                renderHomeCategoryChips(homeScreen);
            });
            container.appendChild(btn);
        });

        container.style.visibility = 'visible';
    }

    function renderProducts(homeScreen, products, append) {
        const grid = getHomeGrid(homeScreen);
        if (!grid) return;

        const templateCard = grid.querySelector('.product-card');
        if (!templateCard) return;

        if (!append) {
            grid.innerHTML = '';
        }

        products.forEach(function (product) {
            state.productById[String(product.id)] = product;

            const card = templateCard.cloneNode(true);
            card.dataset.ropProductId = String(product.id);

            const img = card.querySelector('img');
            if (img) {
                img.src = product.image || img.src;
                img.alt = product.name || 'Produto';
            }

            const title = card.querySelector('h3');
            if (title) title.textContent = product.name || 'Produto';

            const subtitle = card.querySelector('p');
            if (subtitle) subtitle.textContent = productSubtext(product);

            const allParagraphs = card.querySelectorAll('p');
            allParagraphs.forEach(function (paragraph) {
                if (paragraph !== subtitle) {
                    paragraph.style.display = 'none';
                }
            });

            const price = card.querySelector('span');
            if (price) price.textContent = productDisplayPrice(product);

            card.onclick = null;
            card.addEventListener('click', function () {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo('product-screen');
                }
            });

            const plusBtn = card.querySelector('button');
            if (plusBtn) {
                plusBtn.onclick = null;
                plusBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePlusClick(product, plusBtn);
                });
            }

            grid.appendChild(card);
        });

        if (!append) {
            grid.style.visibility = 'visible';
        }

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    async function handlePlusClick(product, button) {
        const icon = button.querySelector('i');
        const original = icon ? icon.getAttribute('data-lucide') : null;

        if (!product.is_simple || product.has_addons) {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('product-screen');
            }
            return;
        }

        try {
            const response = await ropFetch('rop_add_to_cart_simple', { product_id: product.id, qty: 1 });
            if (!response || !response.success) return;

            if (icon) {
                icon.setAttribute('data-lucide', 'check');
                if (window.lucide && typeof window.lucide.createIcons === 'function') {
                    window.lucide.createIcons();
                }
                setTimeout(function () {
                    icon.setAttribute('data-lucide', original || 'plus');
                    if (window.lucide && typeof window.lucide.createIcons === 'function') {
                        window.lucide.createIcons();
                    }
                }, 800);
            }
        } catch (err) {
            console.warn('ROP add-to-cart failed', err);
        }
    }

    function activeFiltersPayload(page) {
        return {
            page,
            per_page: state.perPage,
            category: state.homeCategory || '',
            q: state.q || '',
            orderby: state.orderby,
            on_sale: state.onSale ? 1 : 0,
            price_tier: state.priceTier || '',
        };
    }

    async function loadProducts(homeScreen, append) {
        if (state.isLoading || !state.hasMore && append) return;
        state.isLoading = true;

        try {
            const response = await ropFetch('rop_list_products', activeFiltersPayload(state.page));
            if (!response || !response.success || !response.data) return;

            const data = response.data;
            const products = Array.isArray(data.products) ? data.products : [];
            if (!append && products.length === 0) {
                const grid = getHomeGrid(homeScreen);
                if (grid) grid.style.visibility = 'visible';
            }
            renderProducts(homeScreen, products, append);

            state.hasMore = !!data.has_more;
            state.page = (data.page || state.page) + 1;
        } catch (err) {
            console.warn('ROP list products failed', err);
        } finally {
            state.isLoading = false;
        }
    }

    function resetAndLoadProducts(homeScreen) {
        state.page = 1;
        state.hasMore = true;
        state.productById = {};
        loadProducts(homeScreen, false);
    }

    function closeSuggestions(box) {
        if (!box) return;
        box.style.display = 'none';
        box.innerHTML = '';
        state.suggestionsOpen = false;
    }

    function ensureSuggestionsDropdown(searchInput) {
        const parent = searchInput.parentElement;
        if (!parent) return null;

        parent.style.position = 'relative';
        let box = parent.querySelector('.rop-suggestions');
        if (box) return box;

        box = document.createElement('div');
        box.className = 'rop-suggestions';
        box.style.position = 'absolute';
        box.style.left = '0';
        box.style.right = '0';
        box.style.top = 'calc(100% + 8px)';
        box.style.background = '#fff';
        box.style.border = '1px solid #f3f4f6';
        box.style.borderRadius = '12px';
        box.style.boxShadow = '0 10px 30px rgba(0,0,0,.08)';
        box.style.zIndex = '130';
        box.style.display = 'none';
        box.style.maxHeight = '240px';
        box.style.overflowY = 'auto';

        parent.appendChild(box);
        return box;
    }

    function renderSuggestions(box, suggestions, homeScreen, searchInput) {
        if (!box) return;

        if (!suggestions.length) {
            closeSuggestions(box);
            return;
        }

        box.innerHTML = suggestions
            .map(function (item) {
                return '<button type="button" data-id="' + esc(item.id) + '" style="width:100%;text-align:left;padding:10px 12px;border:0;background:#fff;cursor:pointer;font-size:14px;color:#374151;">' + esc(item.name) + '</button>';
            })
            .join('');

        box.style.display = 'block';
        state.suggestionsOpen = true;

        Array.from(box.querySelectorAll('button[data-id]')).forEach(function (btn) {
            btn.addEventListener('click', function () {
                searchInput.value = btn.textContent || '';
                state.q = searchInput.value.trim();
                closeSuggestions(box);
                resetAndLoadProducts(homeScreen);
            });
        });
    }

    async function loadSuggestions(term, box, homeScreen, searchInput) {
        try {
            const response = await ropFetch('rop_search_suggestions', { q: term });
            if (!response || !response.success || !response.data) return;
            renderSuggestions(box, Array.isArray(response.data.suggestions) ? response.data.suggestions : [], homeScreen, searchInput);
        } catch (err) {
            console.warn('ROP suggestions failed', err);
        }
    }

    function bindSearch(homeScreen) {
        const input = getHomeSearchInput(homeScreen);
        if (!input) return;

        const suggestionsBox = ensureSuggestionsDropdown(input);

        input.addEventListener('input', function () {
            const term = input.value.trim();
            state.q = term;

            if (state.searchTimer) clearTimeout(state.searchTimer);
            if (state.suggestTimer) clearTimeout(state.suggestTimer);

            state.suggestTimer = setTimeout(function () {
                if (term.length >= 2) {
                    loadSuggestions(term, suggestionsBox, homeScreen, input);
                } else {
                    closeSuggestions(suggestionsBox);
                }
            }, 220);

            state.searchTimer = setTimeout(function () {
                resetAndLoadProducts(homeScreen);
            }, 300);
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                closeSuggestions(suggestionsBox);
                state.q = input.value.trim();
                resetAndLoadProducts(homeScreen);
            }
        });

        document.addEventListener('click', function (e) {
            if (!suggestionsBox) return;
            if (e.target === input || suggestionsBox.contains(e.target)) return;
            closeSuggestions(suggestionsBox);
        });
    }

    function bindInfiniteScroll(homeScreen) {
        window.addEventListener('scroll', function () {
            if (state.isLoading || !state.hasMore) return;

            const home = getHomeScreen(getAppRoot());
            if (!home || home.classList.contains('hidden')) return;

            const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300;
            if (nearBottom) {
                loadProducts(homeScreen, true);
            }
        });
    }

    function setFilterChipActive(chipContainer, activeText) {
        const chips = chipContainer ? chipContainer.querySelectorAll('.filter-chip') : [];
        chips.forEach(function (chip) {
            if (chip.textContent.trim() === activeText) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    function bindFilterModal(homeScreen) {
        const modal = getFilterModal();
        if (!modal) return;

        const sections = modal.querySelectorAll('.p-6.space-y-8 > div');
        const orderSection = sections[0];
        const categorySection = sections[1];
        const priceSection = sections[2];

        if (orderSection) {
            const chips = orderSection.querySelectorAll('.filter-chip');
            const map = {
                Recomendados: 'recommended',
                'Avaliação': 'rating',
                'Menor Preço': 'price_asc',
            };
            chips.forEach(function (chip) {
                chip.addEventListener('click', function () {
                    chips.forEach((c) => c.classList.remove('active'));
                    chip.classList.add('active');
                    const key = map[chip.textContent.trim()];
                    if (key) state.orderby = key;
                });
            });
        }

        if (categorySection) {
            const wrap = categorySection.querySelector('.flex.flex-wrap.gap-2');
            const template = wrap ? wrap.querySelector('.filter-chip') : null;
            if (wrap && template) {
                wrap.innerHTML = '';

                const all = template.cloneNode(true);
                all.textContent = 'Tudo';
                all.classList.add('active');
                all.addEventListener('click', function () {
                    setFilterChipActive(wrap, 'Tudo');
                    state.modalCategory = '';
                });
                wrap.appendChild(all);

                state.categories.forEach(function (cat) {
                    const chip = template.cloneNode(true);
                    chip.textContent = cat.name;
                    chip.classList.remove('active');
                    chip.addEventListener('click', function () {
                        setFilterChipActive(wrap, cat.name);
                        state.modalCategory = cat.slug;
                    });
                    wrap.appendChild(chip);
                });
            }
        }

        if (priceSection) {
            const chips = priceSection.querySelectorAll('.filter-chip');
            chips.forEach(function (chip) {
                chip.addEventListener('click', function () {
                    chips.forEach((c) => c.classList.remove('active'));
                    chip.classList.add('active');
                    const txt = chip.textContent.trim();
                    state.priceTier = txt === '$' || txt === '$$' || txt === '$$$' ? txt : '';
                });
            });
        }

        const applyBtn = getFilterApplyButton(modal);
        if (applyBtn) {
            applyBtn.addEventListener('click', function () {
                state.homeCategory = state.modalCategory || '';
                renderHomeCategoryChips(homeScreen);
                resetAndLoadProducts(homeScreen);
            });
        }
    }

    async function loadCategories() {
        try {
            const response = await ropFetch('rop_list_categories');
            if (!response || !response.success || !response.data) {
                state.categories = [];
                return;
            }
            state.categories = Array.isArray(response.data.categories) ? response.data.categories : [];
        } catch (err) {
            console.warn('ROP categories failed', err);
            state.categories = [];
        }
    }

    async function bootHomeRealData(appRoot) {
        const homeScreen = getHomeScreen(appRoot);
        if (!homeScreen) return;

        prepareHomeContainers(homeScreen);

        await loadCategories();
        renderHomeCategoryChips(homeScreen);
        bindSearch(homeScreen);
        bindFilterModal(homeScreen);
        bindInfiniteScroll(homeScreen);
        resetAndLoadProducts(homeScreen);
    }

    async function bootSettingsAndStatus(appRoot) {
        try {
            const settingsResponse = await ropFetch('rop_get_store_settings');
            if (settingsResponse && settingsResponse.success && settingsResponse.data && settingsResponse.data.store) {
                state.store = settingsResponse.data.store;
                applyStoreVars(appRoot, state.store);
                updateHomeTexts(appRoot, state.store);
                updateInfoTexts(appRoot, state.store);
            }
        } catch (error) {
            console.warn('ROP settings fetch failed', error);
        }

        try {
            const statusResponse = await ropFetch('rop_get_store_status');
            if (statusResponse && statusResponse.success && statusResponse.data) {
                const status = statusResponse.data;
                updateClosedModalText(status.human_status || '');

                if (!status.is_open) {
                    if (typeof window.openStoreClosedModal === 'function') {
                        window.openStoreClosedModal();
                    } else {
                        openClosedModalFallback();
                    }
                }
            }
        } catch (error) {
            console.warn('ROP status fetch failed', error);
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        const appRoot = getAppRoot();
        if (!appRoot || !window.ropAjax) return;

        const homeScreen = getHomeScreen(appRoot);
        if (homeScreen) {
            prepareHomeContainers(homeScreen);
        }

        await bootSettingsAndStatus(appRoot);
        await bootHomeRealData(appRoot);
    });
})();
