(function () {
    const ropUseWooSingle = true;

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
        currentProduct: null,
        productQty: 1,
        productLoading: false,
        selectedVariationId: 0,
        selectedAttributes: {},
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

    function formatBRL(price) {
        const n = Number(price || 0);
        return 'R$ ' + n.toFixed(2).replace('.', ',');
    }

    function stripTags(html) {
        const div = document.createElement('div');
        div.innerHTML = String(html || '');
        return (div.textContent || div.innerText || '').trim();
    }

    function ropQS(selectors, scope) {
        const root = scope || document;
        for (const sel of selectors) {
            const el = root.querySelector(sel);
            if (el) return el;
        }
        return null;
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

    function getProductScreen(appRoot) {
        return appRoot ? appRoot.querySelector('#product-screen') : null;
    }

    function setProductLoading(appRoot, loading) {
        const productScreen = getProductScreen(appRoot);
        if (!productScreen) return;

        state.productLoading = !!loading;
        if (loading) {
            productScreen.classList.add('rop-loading');
        } else {
            productScreen.classList.remove('rop-loading');
        }
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
            return formatBRL(product.price);
        }
        const stripped = String(product.price_html || '').replace(/<[^>]+>/g, '').trim();
        return stripped || '—';
    }

    async function addCurrentProductToCart(appRoot, options) {
        const opts = options || {};
        if (!state.currentProduct) return false;

        const cta = getProductCta(appRoot);
        const originalText = cta ? cta.textContent : '';

        if (state.currentProduct.is_variable) {
            if (!state.selectedVariationId) {
                if (cta && !opts.silentCTA) {
                    cta.textContent = 'Selecione opções';
                    setTimeout(function () { cta.textContent = originalText; }, 1200);
                }
                return false;
            }
        } else if (!state.currentProduct.is_simple) {
            if (cta && !opts.silentCTA) {
                cta.textContent = 'Selecione opções';
                setTimeout(function () { cta.textContent = originalText; }, 1200);
            }
            return false;
        }

        const extras = collectExtras(appRoot);
        const payload = {
            product_id: state.currentProduct.id,
            qty: state.productQty,
            extras: JSON.stringify(extras),
        };

        if (state.currentProduct.is_variable) {
            payload.variation_id = state.selectedVariationId;
            payload.attributes = JSON.stringify(state.selectedAttributes || {});
        }

        try {
            const response = await ropFetch('rop_add_to_cart', payload);

            if (!response || !response.success) {
                if (cta && !opts.silentCTA) {
                    cta.textContent = 'Erro ao adicionar';
                    setTimeout(function () { cta.textContent = originalText; }, 1200);
                }
                return false;
            }

            if (cta && !opts.silentCTA) {
                cta.textContent = 'Adicionado!';
                setTimeout(function () { cta.textContent = originalText; }, 900);
            }

            await refreshCartSummary(appRoot);

            if (opts.openCartAfter && typeof window.toggleModal === 'function') {
                window.toggleModal('cart-modal');
            }

            if (!opts.stayOnProduct) {
                goToCheckout(appRoot);
            }

            return true;
        } catch (err) {
            console.warn('ROP product add-to-cart failed', err);
            if (cta && !opts.silentCTA) {
                cta.textContent = 'Erro ao adicionar';
                setTimeout(function () { cta.textContent = originalText; }, 1200);
            }
            return false;
        }
    }

    function bindCardPlus(product, plusBtn) {
        plusBtn.onclick = null;
        plusBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (!product.is_simple || product.has_addons) {
                openProduct(product.id);
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
            card.dataset.productId = String(product.id || '');

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
                openProduct(product.id);
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

    function getProductQtyElements(appRoot) {
        const productScreen = getProductScreen(appRoot);
        if (!productScreen) return { minusBtn: null, plusBtn: null, qtyEl: null };

        const qtyWrapper = productScreen.querySelector('.flex.items-center.gap-4.bg-gray-50.p-2.rounded-2xl.border.border-gray-100');
        const buttons = qtyWrapper ? qtyWrapper.querySelectorAll('button') : [];

        return {
            minusBtn: buttons[0] || null,
            plusBtn: buttons[1] || null,
            qtyEl: qtyWrapper ? qtyWrapper.querySelector('span') : null,
        };
    }

    function getProductCta(appRoot) {
        const productScreen = getProductScreen(appRoot);
        if (!productScreen) return null;
        const checkoutBar = productScreen.querySelector('.checkout-bar');
        if (!checkoutBar) return null;
        return checkoutBar.querySelector('button');
    }

    function getProductPriceBox(appRoot) {
        const productScreen = getProductScreen(appRoot);
        if (!productScreen) return null;
        const checkoutBar = productScreen.querySelector('.checkout-bar');
        if (!checkoutBar) return null;
        return checkoutBar.querySelector('div');
    }


    function getFloatingPlusButton(appRoot) {
        return appRoot ? appRoot.querySelector('.plus-button-floating') : null;
    }

    function updateFloatingButtonVisibility(appRoot) {
        const btn = getFloatingPlusButton(appRoot);
        if (!btn) return;
        const productScreen = getProductScreen(appRoot);
        const isProductVisible = productScreen && !productScreen.classList.contains('hidden');
        btn.style.display = isProductVisible ? 'none' : '';
    }

    function getCheckoutScreen(appRoot) {
        return appRoot ? appRoot.querySelector('#checkout-screen') : null;
    }

    function goToCheckout(appRoot) {
        const checkoutScreen = getCheckoutScreen(appRoot);
        if (checkoutScreen && typeof window.navigateTo === 'function') {
            window.navigateTo('checkout-screen');
            checkoutScreen.innerHTML = '<div class="p-6 text-gray-500 text-sm">Carregando checkout...</div>';
            return;
        }

        if (typeof window.toggleModal === 'function') {
            window.toggleModal('cart-modal');
        }
    }

    async function refreshCartSummary(appRoot) {
        const priceBox = getProductPriceBox(appRoot);
        if (!priceBox) return;

        let total = 'R$ 0,00';
        try {
            const response = await ropFetch('rop_get_cart_summary');
            if (response && response.success && response.data) {
                total = stripTags(response.data.total_html || '') || total;
            }
        } catch (err) {
            console.warn('ROP cart summary failed', err);
        }

        priceBox.innerHTML = '<i data-lucide="shopping-bag" class="w-5 h-5 mr-2"></i> ' + total;
        priceBox.style.cursor = 'pointer';
        priceBox.onclick = function () {
            if (typeof window.toggleModal === 'function') {
                window.toggleModal('cart-modal');
            }
        };

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function findMatchingVariation(productData, selectedAttrs) {
        const list = Array.isArray(productData.variations) ? productData.variations : [];

        for (const variation of list) {
            if (!variation || !variation.is_in_stock) continue;
            const attrs = variation.attributes || {};
            let match = true;

            for (const key of Object.keys(selectedAttrs)) {
                const expected = String(selectedAttrs[key] || '').toLowerCase();
                const got = String(attrs[key] || '').toLowerCase();
                if (!expected || expected !== got) {
                    match = false;
                    break;
                }
            }

            if (match) return variation;
        }

        return null;
    }

    function getExtrasContainer(appRoot) {
        const productScreen = getProductScreen(appRoot);
        if (!productScreen) return null;

        const headings = productScreen.querySelectorAll('h3');
        let extrasHeading = null;
        headings.forEach(function (h) {
            if (h.textContent && h.textContent.toLowerCase().indexOf('adicionar extras') !== -1) {
                extrasHeading = h;
            }
        });

        if (!extrasHeading) return null;
        const scope = extrasHeading.parentElement;
        if (!scope) return null;

        return scope.querySelector('.space-y-4');
    }

    function collectExtras(appRoot) {
        const scope = appRoot ? appRoot.querySelector('#product-screen .rop-barn2-scope') : null;
        if (!scope) return [];

        const extras = [];
        const fields = scope.querySelectorAll('input[name], select[name], textarea[name]');

        fields.forEach(function (field) {
            const key = field.name;
            if (!key) return;

            if (field.type === 'checkbox') {
                if (field.checked) {
                    extras.push({ name: key, value: field.value || '1' });
                }
                return;
            }

            if (field.type === 'radio') {
                if (field.checked) {
                    extras.push({ name: key, value: field.value || '' });
                }
                return;
            }

            extras.push({ name: key, value: field.value || '' });
        });

        return extras;
    }

    function updateProductQtyUI(appRoot) {
        const elems = getProductQtyElements(appRoot);
        if (elems.qtyEl) {
            elems.qtyEl.textContent = String(state.productQty);
        }
    }

    function bindProductScreenControls(appRoot) {
        const elems = getProductQtyElements(appRoot);

        if (elems.minusBtn) {
            elems.minusBtn.onclick = function () {
                state.productQty = Math.max(1, state.productQty - 1);
                updateProductQtyUI(appRoot);
            };
        }

        if (elems.plusBtn) {
            elems.plusBtn.onclick = function () {
                state.productQty = Math.min(99, state.productQty + 1);
                updateProductQtyUI(appRoot);
            };
        }

        const cta = getProductCta(appRoot);
        if (cta) {
            cta.onclick = async function (e) {
                e.preventDefault();
                await addCurrentProductToCart(appRoot, { stayOnProduct: false });
            };
        }
    }

    function setWooSingleMode(appRoot, contentWrap, enabled) {
        if (!appRoot) return;

        const appDesc = ropQS(['#product-screen p.text-gray-500', '#product-screen .p-6 p']);
        const buyBlock = contentWrap ? contentWrap.querySelector('[data-rop-buyblock="1"]') : null;
        const extrasTitle = contentWrap
            ? Array.from(contentWrap.querySelectorAll('h3')).find(function (h) {
                return (h.textContent || '').trim().toLowerCase().indexOf('adicionar extras') !== -1;
            })
            : null;

        if (enabled) {
            appRoot.classList.add('rop-woo-single-active');
            if (appDesc) appDesc.style.display = 'none';
            if (buyBlock) buyBlock.style.display = 'none';
            if (extrasTitle) extrasTitle.style.display = 'none';
            return;
        }

        appRoot.classList.remove('rop-woo-single-active');
        if (appDesc) appDesc.style.display = '';
        if (buyBlock) buyBlock.style.display = '';
        if (extrasTitle) extrasTitle.style.display = '';
    }

    function setBuyBlockAddVisibility(contentWrap, visible) {
        if (!contentWrap) return;
        const buyBlock = contentWrap.querySelector('[data-rop-buyblock="1"]');
        if (!buyBlock) return;
        const addBtn = buyBlock.querySelector('[data-rop-add]');
        if (addBtn) {
            addBtn.style.display = visible ? '' : 'none';
        }
    }

    async function mountEmbeddedWooSingle(appRoot, product) {
        const productScreen = getProductScreen(appRoot);
        if (!productScreen) return;

        const contentWrap = ropQS([
            '#product-screen .p-6.pb-44',
            '#product-screen .p-6',
        ], productScreen);
        if (!contentWrap) return;

        let wooWrap = contentWrap.querySelector('[data-rop-woo-single="1"]');
        if (!wooWrap) {
            wooWrap = document.createElement('div');
            wooWrap.setAttribute('data-rop-woo-single', '1');
            wooWrap.className = 'rop-woo-single mt-6';
            const buyBlock = contentWrap.querySelector('[data-rop-buyblock="1"]');
            if (buyBlock) {
                contentWrap.insertBefore(wooWrap, buyBlock);
            } else {
                contentWrap.appendChild(wooWrap);
            }
        }

        const useEmbedded = !!(ropUseWooSingle && product && product.barn2_active);

        if (!useEmbedded) {
            wooWrap.innerHTML = '';
            setBuyBlockAddVisibility(contentWrap, true);
            setWooSingleMode(appRoot, contentWrap, false);
            return;
        }

        try {
            const response = await ropFetch('rop_render_single_product', { product_id: product.id });
            const html = response && response.success && response.data ? String(response.data.html || '') : '';
            wooWrap.innerHTML = html;
            wooWrap.style.display = '';
            setBuyBlockAddVisibility(contentWrap, false);
            setWooSingleMode(appRoot, contentWrap, true);

            const form = wooWrap.querySelector('form.cart');
            if (form) {
                form.onsubmit = async function (e) {
                    e.preventDefault();

                    const fd = new FormData(form);
                    const payload = {};
                    fd.forEach(function (v, k) {
                        if (Object.prototype.hasOwnProperty.call(payload, k)) {
                            if (!Array.isArray(payload[k])) payload[k] = [payload[k]];
                            payload[k].push(v);
                        } else {
                            payload[k] = v;
                        }
                    });

                    const res = await ropFetch('rop_add_to_cart_from_form', {
                        product_id: product.id,
                        form: JSON.stringify(payload),
                    });

                    if (res && res.success) {
                        await refreshCartSummary(appRoot);
                    }
                };
            }

            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        } catch (err) {
            console.warn('ROP embedded single render failed', err);
            wooWrap.innerHTML = '';
            setBuyBlockAddVisibility(contentWrap, true);
            setWooSingleMode(appRoot, contentWrap, false);
        }
    }

    function setProductMetaPrice(productScreen, product, variation) {
        const metaRow = ropQS([
            '#product-screen .mb-5 .flex.items-center.gap-3.mt-2',
            '#product-screen .mb-5 .flex',
        ], productScreen);

        if (!metaRow) return;

        let priceSpan = metaRow.querySelector('[data-rop-price]');
        if (!priceSpan) {
            priceSpan = document.createElement('span');
            priceSpan.setAttribute('data-rop-price', '1');
            priceSpan.className = 'text-gray-400 text-xs font-medium';
            metaRow.appendChild(priceSpan);
        }

        const variationText = variation
            ? (stripTags(variation.price_html || '') || formatBRL(variation.price || 0))
            : '';
        const text = variationText || product.formatted_price || stripTags(product.price_html || '') || 'R$ 0,00';
        priceSpan.textContent = '— ' + text;
    }

    function renderVariationSelectors(container, product, appRoot, productScreen) {
        (product.variable_attributes || []).forEach(function (attr) {
            const row = document.createElement('div');
            row.className = 'bg-gray-50 border border-gray-100 rounded-2xl p-3';

            const label = document.createElement('label');
            label.className = 'text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2';
            label.textContent = attr.name || attr.slug || 'Opção';

            const select = document.createElement('select');
            select.className = 'custom-input';
            select.style.paddingLeft = '16px';
            select.setAttribute('data-attr', attr.slug || '');

            const empty = document.createElement('option');
            empty.value = '';
            empty.textContent = 'Selecione';
            select.appendChild(empty);

            (attr.options || []).forEach(function (opt) {
                const option = document.createElement('option');
                option.value = opt.slug || '';
                option.textContent = opt.name || opt.slug || '';
                select.appendChild(option);
            });

            select.onchange = function () {
                const attrs = {};
                container.querySelectorAll('select[data-attr]').forEach(function (s) {
                    const key = s.getAttribute('data-attr');
                    const val = s.value || '';
                    if (key && val) attrs[key] = val;
                });

                state.selectedAttributes = attrs;
                const match = findMatchingVariation(product, attrs);
                const cta = getProductCta(appRoot);

                if (match) {
                    state.selectedVariationId = Number(match.variation_id || 0);
                    setProductMetaPrice(productScreen, product, match);
                    if (cta) {
                        cta.disabled = false;
                        cta.textContent = 'Finalizar Pedido';
                    }
                } else {
                    state.selectedVariationId = 0;
                    if (cta) {
                        cta.disabled = true;
                        cta.textContent = 'Selecione opções';
                    }
                }
            };

            row.appendChild(label);
            row.appendChild(select);
            container.appendChild(row);
        });
    }

    function renderProductScreen(appRoot, product) {
        const productScreen = getProductScreen(appRoot);
        if (!productScreen) return;

        productScreen.querySelectorAll('button').forEach(function (button) {
            if (button.querySelector('i[data-lucide="heart"]')) {
                button.remove();
            }
        });

        const image = ropQS([
            '#product-screen .product-image-container img',
            '#product-screen img',
        ], productScreen);
        if (image) {
            image.src = product.image || image.src;
            image.alt = product.name || image.alt || 'Produto';
        }

        const title = ropQS([
            '#product-screen h2',
            '#product-screen .p-6 h2',
        ], productScreen);
        if (title) title.textContent = product.name || '';

        const contentWrap = ropQS([
            '#product-screen .p-6.pb-44',
            '#product-screen .p-6',
        ], productScreen);
        if (!contentWrap) return;

        const descText = String(product.short_description || product.description || '').trim();
        let description = ropQS([
            '#product-screen p.text-gray-500',
            '#product-screen .p-6 p',
        ], productScreen);

        if (!description) {
            description = document.createElement('p');
            description.className = 'text-gray-500 text-sm md:text-base leading-relaxed mb-8';
            const mb5 = contentWrap.querySelector('.mb-5');
            if (mb5 && mb5.nextSibling) {
                contentWrap.insertBefore(description, mb5.nextSibling);
            } else {
                contentWrap.appendChild(description);
            }
        }

        description.textContent = descText || ' ';
        description.style.display = 'block';

        let buyBlock = contentWrap.querySelector('[data-rop-buyblock="1"]');
        if (!buyBlock) {
            buyBlock = document.createElement('div');
            buyBlock.setAttribute('data-rop-buyblock', '1');
            buyBlock.className = 'mb-8 bg-gray-50 rounded-2xl p-4 border border-gray-100';
            const extrasTitle = Array.from(contentWrap.querySelectorAll('h3')).find(function (h) {
                return (h.textContent || '').toLowerCase().indexOf('adicionar extras') !== -1;
            });
            if (extrasTitle) {
                const insertionAnchor = extrasTitle.parentElement || extrasTitle;
                contentWrap.insertBefore(buyBlock, insertionAnchor);
            } else {
                contentWrap.appendChild(buyBlock);
            }
        }

        const visiblePrice = stripTags(product.price_html || '') || product.formatted_price || 'R$ 0,00';
        buyBlock.innerHTML = ''
            + '<div class="flex items-center justify-between mb-4">'
            + '<div class="text-sm text-gray-500 font-medium">Preço</div>'
            + '<div class="text-xl font-bold text-gray-800" data-rop-product-price>' + visiblePrice + '</div>'
            + '</div>'
            + '<div class="flex items-center justify-between mb-4">'
            + '<span class="font-bold text-gray-800 text-lg">Quantidade</span>'
            + '<div class="flex items-center gap-4 bg-white p-2 rounded-2xl border border-gray-100">'
            + '<button type="button" class="bg-white shadow-sm w-10 h-10 flex items-center justify-center rounded-xl text-red-500 btn-active hover:shadow-md transition-all" data-rop-qty-minus><i data-lucide="minus" class="w-5 h-5"></i></button>'
            + '<span class="font-bold text-gray-800 text-lg w-6 text-center" data-rop-qty>1</span>'
            + '<button type="button" class="bg-red-500 shadow-md w-10 h-10 flex items-center justify-center rounded-xl text-white btn-active hover:bg-red-600 transition-all" data-rop-qty-plus><i data-lucide="plus" class="w-5 h-5"></i></button>'
            + '</div>'
            + '</div>'
            + '<button type="button" class="w-full bg-red-500 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-wider shadow-xl btn-active hover:bg-red-600 transition-colors" data-rop-add>Adicionar ao carrinho</button>';

        state.productQty = 1;
        const qtyEl = buyBlock.querySelector('[data-rop-qty]');
        const minusBtn = buyBlock.querySelector('[data-rop-qty-minus]');
        const plusBtn = buyBlock.querySelector('[data-rop-qty-plus]');
        const addBtn = buyBlock.querySelector('[data-rop-add]');

        if (qtyEl) qtyEl.textContent = '1';
        if (minusBtn) {
            minusBtn.onclick = function () {
                state.productQty = Math.max(1, state.productQty - 1);
                if (qtyEl) qtyEl.textContent = String(state.productQty);
            };
        }
        if (plusBtn) {
            plusBtn.onclick = function () {
                state.productQty = Math.min(99, state.productQty + 1);
                if (qtyEl) qtyEl.textContent = String(state.productQty);
            };
        }
        if (addBtn) {
            addBtn.onclick = async function () {
                const original = addBtn.textContent;
                const ok = await addCurrentProductToCart(appRoot, { openCartAfter: true, stayOnProduct: true, silentCTA: true });
                addBtn.textContent = ok ? 'Adicionado!' : 'Erro ao adicionar';
                setTimeout(function () { addBtn.textContent = original; }, 1000);
            };
        }

        setProductMetaPrice(productScreen, product, null);

        let extrasBlock = contentWrap.querySelector('[data-rop-extrasblock="1"]');
        if (!extrasBlock) {
            extrasBlock = document.createElement('div');
            extrasBlock.className = 'mb-6';
            extrasBlock.setAttribute('data-rop-extrasblock', '1');
            contentWrap.insertBefore(extrasBlock, buyBlock);
        } else {
            contentWrap.insertBefore(extrasBlock, buyBlock);
        }

        state.selectedVariationId = 0;
        state.selectedAttributes = {};

        extrasBlock.innerHTML = '';
        if (product.barn2_html || (product.is_variable && Array.isArray(product.variable_attributes) && product.variable_attributes.length)) {
            extrasBlock.innerHTML = '<div class="mb-3"><h3 class="font-bold text-gray-800 text-lg mb-4">Adicionar Extras</h3><div class="space-y-4 rop-barn2-scope"></div></div>';
            const extrasScope = extrasBlock.querySelector('.rop-barn2-scope');

            if (extrasScope && product.is_variable && Array.isArray(product.variable_attributes) && product.variable_attributes.length) {
                renderVariationSelectors(extrasScope, product, appRoot, productScreen);
            }

            if (extrasScope && product.barn2_html) {
                const wrap = document.createElement('div');
                wrap.innerHTML = product.barn2_html;
                extrasScope.appendChild(wrap);
            }
        }

        bindProductScreenControls(appRoot);
        refreshCartSummary(appRoot);

        const cta = getProductCta(appRoot);
        if (cta && product.is_variable) {
            cta.disabled = true;
            cta.textContent = 'Selecione opções';
        }

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    async function openProduct(productId) {
        const appRoot = getAppRoot();
        if (!appRoot) return;

        state.currentProduct = null;
        state.productQty = 1;
        state.selectedVariationId = 0;
        state.selectedAttributes = {};
        appRoot.classList.remove('rop-ready-product');

        if (typeof window.navigateTo === 'function') {
            window.navigateTo('product-screen');
        }

        updateFloatingButtonVisibility(appRoot);
        setProductLoading(appRoot, true);

        try {
            const response = await ropFetch('rop_get_product', { product_id: productId });
            const product = response && response.success && response.data
                ? (response.data.product || response.data)
                : null;

            if (!product || !product.id) {
                console.error('ROP product payload inválido', response);
                appRoot.classList.add('rop-ready-product');
                return;
            }

            state.currentProduct = product;
            renderProductScreen(appRoot, product);
            await mountEmbeddedWooSingle(appRoot, product);
            appRoot.classList.add('rop-ready-product');
        } catch (err) {
            console.warn('ROP get product failed', err);
            appRoot.classList.add('rop-ready-product');
        } finally {
            setProductLoading(appRoot, false);
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
        appRoot.classList.remove('rop-ready-product');

        const homeScreen = getHomeScreen(appRoot);
        if (homeScreen) prepareHomeContainers(homeScreen);

        const originalNavigate = typeof window.navigateTo === 'function' ? window.navigateTo : null;
        if (originalNavigate) {
            window.navigateTo = function (screenId) {
                originalNavigate(screenId);
                if (screenId !== 'product-screen') {
                    appRoot.classList.add('rop-ready-product');
                    appRoot.classList.remove('rop-woo-single-active');
                }
                updateFloatingButtonVisibility(appRoot);
            };
        }

        window.checkStoreAndCheckout = async function () {
            try {
                const status = await ropFetch('rop_get_store_status');
                const open = !!(status && status.success && status.data && status.data.is_open);
                if (!open) {
                    if (typeof window.openStoreClosedModal === 'function') window.openStoreClosedModal();
                    else openClosedModalFallback();
                    return;
                }

                const productScreen = getProductScreen(appRoot);
                const productVisible = productScreen && !productScreen.classList.contains('hidden');
                if (productVisible && state.currentProduct) {
                    const ok = await addCurrentProductToCart(appRoot, { stayOnProduct: true });
                    if (ok) goToCheckout(appRoot);
                    return;
                }

                goToCheckout(appRoot);
            } catch (e) {
                console.warn('ROP checkout override failed', e);
                goToCheckout(appRoot);
            }
        };

        appRoot.classList.add('rop-ready-product');
        updateFloatingButtonVisibility(appRoot);
        refreshCartSummary(appRoot);

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
