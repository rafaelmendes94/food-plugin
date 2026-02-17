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
        searchTimer: null,
        suggestTimer: null,
    };

    async function ropFetch(action, data) {
        if (!window.ropAjax || !window.ropAjax.url || !window.ropAjax.nonce) {
            throw new Error('ropAjax config ausente');
        }

        const body = new URLSearchParams({ action: action, nonce: window.ropAjax.nonce, ...(data || {}) });
        const res = await fetch(window.ropAjax.url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body,
        });

        return res.json();
    }

    function getAppRoot() {
        return document.querySelector('.rop-app[data-rop-app="1"]');
    }

    function getHomeScreen(appRoot) {
        return appRoot ? appRoot.querySelector('#home-screen') : null;
    }

    function getHomeGrid(homeScreen) {
        if (!homeScreen) return null;
        return homeScreen.querySelector('.grid[class*="grid-cols-2"]')
            || homeScreen.querySelector('div.grid.grid-cols-2.md\\:grid-cols-3.lg\\:grid-cols-4.xl\\:grid-cols-5')
            || homeScreen.querySelector('[class*="grid-cols-2"]');
    }

    function getHomeChipsContainer(homeScreen) {
        return homeScreen ? homeScreen.querySelector('.overflow-x-auto.no-scrollbar') : null;
    }

    function getHomeSearchInput(homeScreen) {
        return homeScreen ? homeScreen.querySelector('input[placeholder="Pesquisar seu lanche..."]') : null;
    }

    function getFilterModal() {
        return document.getElementById('filter-modal');
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
    }

    function updateClosedModalText(humanStatus) {
        const modal = document.getElementById('store-closed-modal');
        if (!modal) return;
        const p = modal.querySelector('p');
        if (!p) return;
        const base = 'Estamos fechados no momento. Navegue pelo cardápio!';
        p.textContent = humanStatus ? (base + ' ' + humanStatus) : base;
    }

    function openClosedModalFallback() {
        const modal = document.getElementById('store-closed-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        setTimeout(function () { modal.classList.add('modal-active'); }, 10);
    }

    function getTemplateCard(grid) {
        if (!grid) return null;

        let templateCard = grid.querySelector('.product-card');

        if (!templateCard) {
            templateCard = document.createElement('div');
            templateCard.className = 'product-card bg-white p-4 rounded-[32px] relative flex flex-col items-center cursor-pointer';
            templateCard.innerHTML = ''
                + '<div class="h-28 w-28 mb-3"><img src="" alt="" class="w-full h-full object-contain"></div>'
                + '<div class="w-full text-left">'
                + '<h3 class="font-bold text-gray-800 text-sm"></h3>'
                + '<p class="text-gray-400 text-[10px] mb-1"></p>'
                + '<span class="text-red-500 font-bold text-sm"></span>'
                + '</div>'
                + '<button class="absolute bottom-4 right-4 bg-red-500 text-white p-1.5 rounded-lg shadow-sm hover:bg-red-600 transition-colors">'
                + '<i data-lucide="plus" class="w-4 h-4"></i>'
                + '</button>';
        }

        return templateCard;
    }

    function prepareHomeContainers(homeScreen) {
        const grid = getHomeGrid(homeScreen);
        if (grid) grid.innerHTML = '';

        const chips = getHomeChipsContainer(homeScreen);
        if (chips) chips.innerHTML = '';
    }

    function makeHomeChip(templateButton, text, active, onClick) {
        const btn = templateButton.cloneNode(true);
        btn.type = 'button';
        btn.textContent = text;
        btn.onclick = null;
        btn.className = active
            ? 'bg-red-500 text-white px-7 py-3 rounded-2xl text-sm font-semibold shrink-0 shadow-sm hover:shadow-md transition-shadow'
            : 'bg-gray-100/80 text-gray-500 px-7 py-3 rounded-2xl text-sm font-medium shrink-0 hover:bg-gray-200 transition-colors';
        btn.addEventListener('click', onClick);
        return btn;
    }

    function renderHomeCategoryChips(appRoot, homeScreen) {
        const container = getHomeChipsContainer(homeScreen);
        if (!container) {
            if (appRoot) appRoot.classList.add('rop-ready-cats');
            return;
        }

        const templateButton = document.createElement('button');
        container.innerHTML = '';

        container.appendChild(makeHomeChip(templateButton, 'Tudo', state.homeCategory === '', function () {
            state.homeCategory = '';
            state.modalCategory = '';
            resetAndLoadProducts(homeScreen);
            renderHomeCategoryChips(appRoot, homeScreen);
        }));

        state.categories.forEach(function (cat) {
            container.appendChild(makeHomeChip(templateButton, cat.name, state.homeCategory === cat.slug, function () {
                state.homeCategory = cat.slug;
                state.modalCategory = cat.slug;
                resetAndLoadProducts(homeScreen);
                renderHomeCategoryChips(appRoot, homeScreen);
            }));
        });

        if (appRoot) appRoot.classList.add('rop-ready-cats');
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    function priceText(product) {
        if (typeof product.price === 'number' && !Number.isNaN(product.price)) {
            return 'R$ ' + product.price.toFixed(2).replace('.', ',');
        }
        const stripped = String(product.price_html || '').replace(/<[^>]+>/g, '').trim();
        return stripped || '—';
    }

    function bindCardPlus(product, plusBtn) {
        plusBtn.onclick = null;
        plusBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (!product.is_simple || product.has_addons) {
                if (typeof window.navigateTo === 'function') window.navigateTo('product-screen');
                return;
            }

            try {
                const response = await ropFetch('rop_add_to_cart_simple', { product_id: product.id, qty: 1 });
                if (!response || !response.success) return;

                const icon = plusBtn.querySelector('i[data-lucide]');
                if (icon) {
                    icon.setAttribute('data-lucide', 'check');
                    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
                    setTimeout(function () {
                        icon.setAttribute('data-lucide', 'plus');
                        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
                    }, 800);
                }
            } catch (err) {
                console.warn('ROP add-to-cart failed', err);
            }
        });
    }

    function renderProducts(homeScreen, products, append) {
        const grid = getHomeGrid(homeScreen);
        if (!grid) return;

        const templateCard = getTemplateCard(grid);
        if (!templateCard) return;

        if (!append) grid.innerHTML = '';

        products.forEach(function (product) {
            const card = templateCard.cloneNode(true);

            const img = card.querySelector('img');
            if (img) {
                img.src = product.image || img.src;
                img.alt = product.name || 'Produto';
            }

            const title = card.querySelector('h3');
            if (title) title.textContent = product.name || 'Produto';

            const subtitle = card.querySelector('p');
            if (subtitle) subtitle.textContent = product.category_name || '—';

            const allP = card.querySelectorAll('p');
            allP.forEach(function (p) {
                if (p !== subtitle) p.style.display = 'none';
            });

            const price = card.querySelector('span');
            if (price) price.textContent = priceText(product);

            card.onclick = null;
            card.addEventListener('click', function () {
                if (typeof window.navigateTo === 'function') window.navigateTo('product-screen');
            });

            const plusBtn = card.querySelector('button');
            if (plusBtn) bindCardPlus(product, plusBtn);

            grid.appendChild(card);
        });

        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    function currentFilters(page) {
        return {
            page: page,
            per_page: state.perPage,
            category: state.homeCategory || '',
            q: state.q || '',
            orderby: state.orderby,
            on_sale: state.onSale ? 1 : 0,
            price_tier: state.priceTier || '',
        };
    }

    async function loadProducts(homeScreen, append) {
        if (state.isLoading || (append && !state.hasMore)) return;
        state.isLoading = true;

        try {
            const response = await ropFetch('rop_list_products', currentFilters(state.page));
            if (!response || !response.success || !response.data) return;

            const products = Array.isArray(response.data.products) ? response.data.products : [];
            renderProducts(homeScreen, products, append);
            state.hasMore = !!response.data.has_more;
            state.page = (response.data.page || state.page) + 1;
        } catch (err) {
            console.warn('ROP list products failed', err);
        } finally {
            state.isLoading = false;
            const appRoot = getAppRoot();
            if (appRoot && !appRoot.classList.contains('rop-ready')) {
                appRoot.classList.add('rop-ready');
            appRoot.classList.add('rop-ready-cats');
                if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
            }
        }
    }

    function resetAndLoadProducts(homeScreen) {
        state.page = 1;
        state.hasMore = true;
        loadProducts(homeScreen, false);
    }

    function ensureSuggestionsBox(input) {
        const parent = input.parentElement;
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
        parent.appendChild(box);
        return box;
    }

    function renderSuggestions(box, list, homeScreen, input) {
        if (!box) return;
        if (!list.length) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }

        box.innerHTML = list.map(function (item) {
            return '<button type="button" style="width:100%;text-align:left;padding:10px 12px;border:0;background:#fff;cursor:pointer;font-size:14px;color:#374151;">'
                + String(item.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</button>';
        }).join('');
        box.style.display = 'block';

        Array.from(box.querySelectorAll('button')).forEach(function (btn) {
            btn.addEventListener('click', function () {
                input.value = btn.textContent || '';
                state.q = input.value.trim();
                box.style.display = 'none';
                box.innerHTML = '';
                resetAndLoadProducts(homeScreen);
            });
        });
    }

    function bindSearch(homeScreen) {
        const input = getHomeSearchInput(homeScreen);
        if (!input) return;
        const box = ensureSuggestionsBox(input);

        input.addEventListener('input', function () {
            const term = input.value.trim();
            state.q = term;

            if (state.searchTimer) clearTimeout(state.searchTimer);
            if (state.suggestTimer) clearTimeout(state.suggestTimer);

            state.suggestTimer = setTimeout(async function () {
                if (term.length < 2) {
                    if (box) {
                        box.style.display = 'none';
                        box.innerHTML = '';
                    }
                    return;
                }

                try {
                    const response = await ropFetch('rop_search_suggestions', { q: term });
                    const list = (response && response.success && response.data && Array.isArray(response.data.suggestions))
                        ? response.data.suggestions
                        : [];
                    renderSuggestions(box, list, homeScreen, input);
                } catch (err) {
                    console.warn('ROP suggestions failed', err);
                }
            }, 220);

            state.searchTimer = setTimeout(function () {
                resetAndLoadProducts(homeScreen);
            }, 300);
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                state.q = input.value.trim();
                if (box) {
                    box.style.display = 'none';
                    box.innerHTML = '';
                }
                resetAndLoadProducts(homeScreen);
            }
        });
    }

    function bindInfiniteScroll(homeScreen) {
        window.addEventListener('scroll', function () {
            if (state.isLoading || !state.hasMore) return;
            const home = getHomeScreen(getAppRoot());
            if (!home || home.classList.contains('hidden')) return;
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300) {
                loadProducts(homeScreen, true);
            }
        });
    }

    function bindFilterModal(appRoot, homeScreen) {
        const modal = getFilterModal();
        if (!modal) return;

        const sections = modal.querySelectorAll('.p-6.space-y-8 > div');
        const orderSection = sections[0];
        const categorySection = sections[1];
        const priceSection = sections[2];

        if (orderSection) {
            const chips = orderSection.querySelectorAll('.filter-chip');
            const map = { Recomendados: 'recommended', 'Avaliação': 'rating', 'Menor Preço': 'price_asc' };
            chips.forEach(function (chip) {
                chip.addEventListener('click', function () {
                    chips.forEach((c) => c.classList.remove('active'));
                    chip.classList.add('active');
                    state.orderby = map[chip.textContent.trim()] || 'recommended';
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
                    Array.from(wrap.querySelectorAll('.filter-chip')).forEach((c) => c.classList.remove('active'));
                    all.classList.add('active');
                    state.modalCategory = '';
                });
                wrap.appendChild(all);

                state.categories.forEach(function (cat) {
                    const chip = template.cloneNode(true);
                    chip.textContent = cat.name;
                    chip.classList.remove('active');
                    chip.addEventListener('click', function () {
                        Array.from(wrap.querySelectorAll('.filter-chip')).forEach((c) => c.classList.remove('active'));
                        chip.classList.add('active');
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
                    state.priceTier = (txt === '$' || txt === '$$' || txt === '$$$') ? txt : '';
                });
            });
        }

        const applyBtn = modal.querySelector('button[onclick*="toggleModal(\'filter-modal\')"]');
        if (applyBtn) {
            applyBtn.addEventListener('click', function () {
                state.homeCategory = state.modalCategory || '';
                renderHomeCategoryChips(appRoot, homeScreen);
                resetAndLoadProducts(homeScreen);
            });
        }
    }

    async function loadCategories() {
        try {
            const response = await ropFetch('rop_list_categories');
            if (!response || !response.success || !response.data || !Array.isArray(response.data.categories)) {
                state.categories = [];
                return;
            }
            state.categories = response.data.categories;
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
        renderHomeCategoryChips(appRoot, homeScreen);
        bindSearch(homeScreen);
        bindFilterModal(appRoot, homeScreen);
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
        } catch (err) {
            console.warn('ROP settings fetch failed', err);
        }

        try {
            const statusResponse = await ropFetch('rop_get_store_status');
            if (statusResponse && statusResponse.success && statusResponse.data) {
                updateClosedModalText(statusResponse.data.human_status || '');
                if (!statusResponse.data.is_open) {
                    if (typeof window.openStoreClosedModal === 'function') window.openStoreClosedModal();
                    else openClosedModalFallback();
                }
            }
        } catch (err) {
            console.warn('ROP status fetch failed', err);
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        const appRoot = getAppRoot();
        if (!appRoot || !window.ropAjax) return;

        appRoot.classList.remove('rop-ready');
        appRoot.classList.remove('rop-ready-cats');

        const homeScreen = getHomeScreen(appRoot);
        if (homeScreen) prepareHomeContainers(homeScreen);

        try {
            await bootSettingsAndStatus(appRoot);
            await bootHomeRealData(appRoot);
        } catch (err) {
            console.warn('ROP home boot failed', err);
            appRoot.classList.add('rop-ready');
            appRoot.classList.add('rop-ready-cats');
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
        }
    });
})();
