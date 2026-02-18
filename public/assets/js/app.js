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
        embedMessageBound: false,
        bootstrap: null,
        fulfillment: 'delivery',
    };



    const ROP_Checkout = {
        controller: null,
        destroy(appRoot) {
            if (this.controller) {
                this.controller.abort();
                this.controller = null;
            }
            const screen = appRoot ? appRoot.querySelector('#checkout-screen') : document.getElementById('checkout-screen');
            if (screen) {
                screen.innerHTML = '';
            }
        },
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

    function updateEtaTexts(appRoot, etaText) {
        if (!appRoot || !etaText) return;
        appRoot.querySelectorAll('p,span,div').forEach(function (el) {
            var txt = (el.textContent || '').trim();
            if (!txt) return;
            if (/^(26\s*mins?|previsão)/i.test(txt)) {
                el.textContent = 'Previsão: ' + etaText + ' min';
            }
        });
    }

    function renderInfoScreen(appRoot, bootstrap) {
        var info = appRoot ? appRoot.querySelector('#info-screen') : null;
        if (!info || !bootstrap) return;

        var store = bootstrap.store || {};
        var hours = bootstrap.hours || {};
        var list = Array.isArray(hours.schedule) ? hours.schedule : [];
        var rows = list.map(function (r) {
            return '<div class="flex justify-between py-2 border-b border-gray-100 text-sm"><span class="font-medium text-gray-700">' + (r.day || '') + '</span><span class="text-gray-500">' + (r.text || '') + '</span></div>';
        }).join('');

        info.innerHTML = ''
            + '<div class="p-6 pb-32">'
            + '<div class="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm">'
            + '<div class="flex items-center gap-4">'
            + (store.logo_url ? ('<img src="' + store.logo_url + '" class="w-14 h-14 rounded-2xl object-cover border border-gray-100"/>') : '<div class="w-14 h-14 rounded-2xl bg-gray-100"></div>')
            + '<div><h3 class="text-2xl font-bold text-gray-800">' + (store.store_name || 'Foodgo') + '</h3><p class="text-gray-400 text-sm">' + (store.slogan || '') + '</p></div>'
            + '</div>'
            + '<p class="mt-4 text-sm ' + (hours.is_open ? 'text-green-600' : 'text-red-500') + '"><strong>Status:</strong> ' + (hours.human_status || '') + '</p>'
            + '<p class="mt-2 text-sm text-gray-600"><strong>Telefone:</strong> ' + (store.phone || '—') + '</p>'
            + '<p class="mt-1 text-sm text-gray-600"><strong>WhatsApp:</strong> ' + (store.whatsapp || '—') + '</p>'
            + '<p class="mt-1 text-sm text-gray-600"><strong>Endereço:</strong> ' + (store.address || '—') + '</p>'
            + '<div class="mt-3 flex gap-3">'
            + (store.maps_url ? ('<a class="text-red-500 text-sm font-semibold" href="' + store.maps_url + '" target="_blank" rel="noopener">Maps</a>') : '')
            + (store.instagram_url ? ('<a class="text-red-500 text-sm font-semibold" href="' + store.instagram_url + '" target="_blank" rel="noopener">Instagram</a>') : '')
            + '</div>'
            + '</div>'
            + '<div class="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm mt-4">'
            + '<h4 class="font-bold text-gray-800 mb-2">Horários</h4>'
            + (rows || '<p class="text-sm text-gray-400">Sem horários cadastrados.</p>')
            + '</div>'
            + '</div>';
    }

    function applyCheckoutLabels(appRoot, checkoutCfg) {
        if (!appRoot || !checkoutCfg) return;
        state.fulfillment = checkoutCfg.default_fulfillment || 'delivery';
        var d = checkoutCfg.labels && checkoutCfg.labels.delivery ? checkoutCfg.labels.delivery : 'Entrega';
        var p = checkoutCfg.labels && checkoutCfg.labels.pickup ? checkoutCfg.labels.pickup : 'Retirada';
        appRoot.querySelectorAll('button,span,p,a').forEach(function (el) {
            var t = (el.textContent || '').trim();
            if (t === 'Entrega') el.textContent = d;
            if (t === 'Retirada') el.textContent = p;
        });
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
            showHomeAddFeedback(appRoot, 'Adicionado ao carrinho');

            if (opts.openCartAfter && typeof window.toggleModal === 'function') {
                window.toggleModal('cart-modal');
            }

            if (!opts.stayOnProduct) {
                await goToCheckout(appRoot);
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


    function showHomeAddFeedback(appRoot, text) {
        if (!appRoot) return;

        let toast = appRoot.querySelector('[data-rop-toast="1"]');
        if (!toast) {
            toast = document.createElement('div');
            toast.setAttribute('data-rop-toast', '1');
            toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 bg-[#2D2929] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg z-[220] opacity-0 pointer-events-none transition-opacity duration-200';
            appRoot.appendChild(toast);
        }

        toast.textContent = text || 'Adicionado ao carrinho';
        toast.style.opacity = '1';
        clearTimeout(toast._ropTimer);
        toast._ropTimer = setTimeout(function () {
            toast.style.opacity = '0';
        }, 1200);
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

                plusBtn.classList.add('scale-95');
                setTimeout(function () { plusBtn.classList.remove('scale-95'); }, 180);

                const icon = plusBtn.querySelector('i[data-lucide]');
                if (icon) {
                    icon.setAttribute('data-lucide', 'check');
                    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
                    setTimeout(function () {
                        icon.setAttribute('data-lucide', 'plus');
                        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
                    }, 800);
                }

                showHomeAddFeedback(getAppRoot(), 'Item adicionado ao carrinho');
                refreshCartSummary(getAppRoot());
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

    async function goToCheckout(appRoot) {
        const checkoutScreen = ensureCheckoutScreen(appRoot);
        if (typeof window.navigateTo === 'function' && checkoutScreen) {
            try {
                window.navigateTo('checkout-screen');
            } catch (e) {
                showScreenFallback('checkout-screen');
            }
            await loadCheckoutScreen(appRoot);
            return;
        }

        showScreenFallback('checkout-screen');
        await loadCheckoutScreen(appRoot);
    }

    async function refreshCartSummary(appRoot) {
        const priceBox = getProductPriceBox(appRoot);
        if (!priceBox) return;

        let total = 'R$ 0,00';
        try {
            const response = await ropFetch('rop_cart_summary');
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
            renderCartModal(appRoot);
        };

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }


    async function fetchCartData() {
        const response = await ropFetch('rop_cart_get');
        if (response && response.success && response.data) {
            return response.data;
        }

        throw new Error('cart_get_failed');
    }

    function renderCartError(list, message, retryFn) {
        if (!list) return;
        list.innerHTML = '<div class="text-center text-sm text-red-500 py-8">' + (message || 'Erro ao carregar carrinho.') + '</div>'
            + '<div class="text-center"><button type="button" data-rop-cart-retry class="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold">Tentar novamente</button></div>';
        const retry = list.querySelector('[data-rop-cart-retry]');
        if (retry && retryFn) {
            retry.onclick = retryFn;
        }
    }

    function updateCartTotalsUI(modal, data) {
        if (!modal) return;
        const summaryRows = modal.querySelectorAll('.space-y-3 .flex.justify-between');
        const totalRow = modal.querySelector('.space-y-3 .text-xl.font-bold.text-gray-800');

        if (summaryRows[0]) {
            summaryRows[0].innerHTML = '<span>Subtotal</span><span>' + ((data.totals && data.totals.subtotal_html) || 'R$ 0,00') + '</span>';
        }

        if (summaryRows[1]) {
            const shippingTxt = ((data.totals && data.totals.shipping_html) || 'Grátis') || 'Grátis';
            summaryRows[1].innerHTML = '<span>Entrega</span><span class="text-green-500">' + shippingTxt + '</span>';
        }

        if (totalRow) {
            totalRow.innerHTML = '<span>Total</span><span>' + ((data.totals && data.totals.total_html) || 'R$ 0,00') + '</span>';
        }
    }

    async function renderCartModal(appRoot) {
        const modal = document.getElementById('cart-modal');
        if (!modal) return;

        const list = modal.querySelector('.flex-1.overflow-y-auto.p-6.space-y-6');
        const couponInput = modal.querySelector('input[placeholder="Cupom"]');
        const applyBtn = modal.querySelector('button.bg-red-500.text-white.px-6.rounded-2xl.font-bold.text-sm.shadow-md.hover\:bg-red-600.transition-colors');

        if (list) {
            list.innerHTML = '<div class="text-center text-sm text-gray-400 py-8">Carregando carrinho...</div>';
        }

        let data;
        try {
            data = await fetchCartData();
        } catch (err) {
            renderCartError(list, 'Não foi possível carregar o carrinho.', function () { renderCartModal(appRoot); });
            updateCartTotalsUI(modal, { totals: {} });
            return;
        }

        if (list) {
            list.innerHTML = '';
            if (!Array.isArray(data.items) || !data.items.length) {
                list.innerHTML = '<div class="text-center text-sm text-gray-400 py-10">Seu carrinho está vazio.</div>';
            } else {
                data.items.forEach(function (item) {
                    const row = document.createElement('div');
                    row.className = 'flex gap-4 items-center group';
                    row.innerHTML = ''
                        + '<div class="w-20 h-20 bg-gray-50 rounded-2xl p-2 flex items-center justify-center shrink-0 border border-gray-100"><img src="' + (item.image_url || '') + '" class="w-full h-full object-contain"></div>'
                        + '<div class="flex-1">'
                        + '<div class="flex justify-between items-start mb-1">'
                        + '<h3 class="font-bold text-gray-800 text-sm leading-tight">' + (item.name || 'Item') + '</h3>'
                        + '<button type="button" data-remove="' + (item.key || '') + '" class="text-gray-300 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>'
                        + '</div>'
                        + '<p class="text-xs text-gray-400 mb-2">' + ((item.extras_text || '').trim() || '—') + '</p>'
                        + '<div class="flex justify-between items-center">'
                        + '<span class="font-bold text-red-500 text-sm">' + (item.line_total_html || 'R$ 0,00') + '</span>'
                        + '<div class="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-xl border border-gray-100">'
                        + '<button type="button" data-qty="' + (item.key || '') + '" data-action="minus" class="cart-qty-btn bg-white shadow-sm text-gray-400 hover:text-gray-600"><i data-lucide="minus" class="w-3 h-3"></i></button>'
                        + '<span class="text-sm font-bold w-4 text-center text-gray-800">' + Number(item.qty || 1) + '</span>'
                        + '<button type="button" data-qty="' + (item.key || '') + '" data-action="plus" class="cart-qty-btn bg-red-500 shadow-md text-white hover:bg-red-600"><i data-lucide="plus" class="w-3 h-3"></i></button>'
                        + '</div></div></div>';
                    list.appendChild(row);
                });
            }
        }

        if (couponInput) {
            couponInput.value = (Array.isArray(data.coupons) && data.coupons[0]) ? data.coupons[0] : '';
        }

        updateCartTotalsUI(modal, data);

        if (list) {
            list.querySelectorAll('[data-remove]').forEach(function (btn) {
                btn.onclick = async function () {
                    try {
                        await ropFetch('rop_cart_remove', { key: btn.getAttribute('data-remove') || '' });
                        await renderCartModal(appRoot);
                        await refreshCartSummary(appRoot);
                    } catch (err) {
                        renderCartError(list, 'Falha ao remover item.', function () { renderCartModal(appRoot); });
                    }
                };
            });

            list.querySelectorAll('[data-qty]').forEach(function (btn) {
                btn.onclick = async function () {
                    const key = btn.getAttribute('data-qty') || '';
                    const action = btn.getAttribute('data-action') || 'plus';
                    const currentEl = btn.parentElement ? btn.parentElement.querySelector('span') : null;
                    const currentQty = Number((currentEl && currentEl.textContent) || 1);
                    const nextQty = action === 'minus' ? Math.max(1, currentQty - 1) : Math.min(99, currentQty + 1);
                    try {
                        await ropFetch('rop_cart_set_qty', { key: key, qty: nextQty });
                        await renderCartModal(appRoot);
                        await refreshCartSummary(appRoot);
                    } catch (err) {
                        renderCartError(list, 'Falha ao atualizar quantidade.', function () { renderCartModal(appRoot); });
                    }
                };
            });
        }

        if (applyBtn && !applyBtn.dataset.boundCoupon) {
            applyBtn.dataset.boundCoupon = '1';
            applyBtn.addEventListener('click', async function () {
                const code = couponInput ? (couponInput.value || '') : '';
                try {
                    const res = await ropFetch('rop_cart_apply_coupon', { code: code });
                    if (res && res.success) showHomeAddFeedback(appRoot, 'Cupom aplicado');
                    else showHomeAddFeedback(appRoot, 'Cupom inválido');
                    await renderCartModal(appRoot);
                    await refreshCartSummary(appRoot);
                } catch (err) {
                    showHomeAddFeedback(appRoot, 'Cupom inválido');
                    renderCartError(list, 'Falha ao aplicar cupom.', function () { renderCartModal(appRoot); });
                }
            });
        }

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function bindCartOpenTriggers(appRoot) {
        const floating = getFloatingPlusButton(appRoot);
        if (floating) {
            floating.onclick = function (e) {
                e.preventDefault();
                if (typeof window.toggleModal === 'function') {
                    window.toggleModal('cart-modal');
                }
                renderCartModal(appRoot);
            };
        }

        const modal = document.getElementById('cart-modal');
        if (modal && !modal.dataset.ropObserved) {
            const observer = new MutationObserver(function () {
                if (!modal.classList.contains('hidden')) {
                    renderCartModal(appRoot);
                }
            });
            observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
            modal.dataset.ropObserved = '1';
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

    function removeProductHeartControls() {
        const ps = document.getElementById('product-screen');
        if (!ps) return;

        ps.querySelectorAll('button').forEach(function (button) {
            if (button.querySelector('i[data-lucide="heart"]')) {
                button.remove();
            }
        });

        ps.querySelectorAll('i[data-lucide="heart"]').forEach(function (icon) {
            icon.remove();
        });
    }

    function enhanceEmbeddedWooQty(wooWrap) {
        if (!wooWrap) return;

        const qtyWrap = wooWrap.querySelector('.quantity');
        const qtyInput = qtyWrap ? qtyWrap.querySelector('input.qty') : null;

        if (!qtyWrap || !qtyInput) return;

        qtyInput.style.position = 'absolute';
        qtyInput.style.opacity = '0';
        qtyInput.style.pointerEvents = 'none';
        qtyInput.style.width = '1px';
        qtyInput.style.height = '1px';

        let ui = qtyWrap.querySelector('.rop-qty-ui');
        if (!ui) {
            ui = document.createElement('div');
            ui.className = 'rop-qty-ui flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100';
            ui.innerHTML = ''
                + '<button type="button" class="bg-white shadow-sm w-10 h-10 flex items-center justify-center rounded-xl text-red-500 btn-active hover:shadow-md transition-all" data-rop-minus><i data-lucide="minus" class="w-5 h-5"></i></button>'
                + '<span class="font-bold text-gray-800 text-lg w-6 text-center" data-rop-val>' + (qtyInput.value || '1') + '</span>'
                + '<button type="button" class="bg-red-500 shadow-md w-10 h-10 flex items-center justify-center rounded-xl text-white btn-active hover:bg-red-600 transition-all" data-rop-plus><i data-lucide="plus" class="w-5 h-5"></i></button>';
            qtyWrap.appendChild(ui);
        }

        const valEl = ui.querySelector('[data-rop-val]');
        const minus = ui.querySelector('[data-rop-minus]');
        const plus = ui.querySelector('[data-rop-plus]');

        if (minus) {
            minus.onclick = function () {
                let v = parseInt(qtyInput.value || '1', 10);
                v = Math.max(1, v - 1);
                qtyInput.value = String(v);
                if (valEl) valEl.textContent = String(v);
            };
        }

        if (plus) {
            plus.onclick = function () {
                let v = parseInt(qtyInput.value || '1', 10);
                v = Math.min(99, v + 1);
                qtyInput.value = String(v);
                if (valEl) valEl.textContent = String(v);
            };
        }

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function setWooSingleMode(appRoot, contentWrap, enabled) {
        if (!appRoot) return;

        const appDesc = ropQS(['#product-screen p.text-gray-500', '#product-screen .p-6 p']);
        const buyBlock = contentWrap ? contentWrap.querySelector('[data-rop-buyblock="1"]') : null;
        const extrasBlock = contentWrap ? contentWrap.querySelector('[data-rop-extrasblock="1"]') : null;
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
            if (extrasBlock) extrasBlock.style.display = 'none';
            return;
        }

        appRoot.classList.remove('rop-woo-single-active');
        if (appDesc) appDesc.style.display = '';
        if (buyBlock) buyBlock.style.display = '';
        if (extrasTitle) extrasTitle.style.display = '';
        if (extrasBlock) extrasBlock.style.display = '';
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

    function bindEmbedMessageBridge(appRoot) {
        if (!appRoot || state.embedMessageBound) {
            return;
        }

        window.addEventListener('message', function (event) {
            const data = event && event.data ? event.data : null;
            if (!data || data.source !== 'rop-embed') {
                return;
            }

            if (data.type === 'added_to_cart' || data.type === 'add_to_cart_submitted') {
                refreshCartSummary(appRoot);
            }
        });

        state.embedMessageBound = true;
    }

    async function mountEmbeddedWooSingle(appRoot, product) {
        const productScreen = getProductScreen(appRoot);
        if (!productScreen) return;

        const contentWrap = ropQS([
            '#product-screen .p-6.pb-44',
            '#product-screen .p-6',
        ], productScreen);
        if (!contentWrap) return;

        const useEmbedded = !!(ropUseWooSingle && product && product.barn2_active && product.permalink);

        let frameWrap = contentWrap.querySelector('[data-rop-iframe="1"]');
        if (!frameWrap) {
            frameWrap = document.createElement('div');
            frameWrap.setAttribute('data-rop-iframe', '1');
            frameWrap.className = 'mt-4';
            contentWrap.appendChild(frameWrap);
        }

        if (!useEmbedded) {
            frameWrap.innerHTML = '';
            frameWrap.style.display = 'none';
            setBuyBlockAddVisibility(contentWrap, true);
            setWooSingleMode(appRoot, contentWrap, false);
            return;
        }

        bindEmbedMessageBridge(appRoot);

        const embedUrl = String(product.permalink).indexOf('?') === -1
            ? (product.permalink + '?rop_embed=1')
            : (product.permalink + '&rop_embed=1');

        frameWrap.innerHTML = '<iframe src="' + embedUrl + '" loading="lazy" style="width:100%;height:70vh;border:0;border-radius:24px;overflow:hidden;background:#fff;"></iframe>';
        frameWrap.style.display = '';

        setBuyBlockAddVisibility(contentWrap, false);
        setWooSingleMode(appRoot, contentWrap, true);

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
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

        removeProductHeartControls();

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
        const effectiveSchema = Array.isArray(product.rop_extras_schema) ? product.rop_extras_schema : [];
        const hasLegacyExtras = !!product.barn2_html || (product.is_variable && Array.isArray(product.variable_attributes) && product.variable_attributes.length);

        if (hasLegacyExtras || effectiveSchema.length) {
            extrasBlock.innerHTML = '<div class="mb-3"><h3 class="font-bold text-gray-800 text-lg mb-4">Adicionar Extras</h3><div class="space-y-4 rop-barn2-scope"></div></div>';
            const extrasScope = extrasBlock.querySelector('.rop-barn2-scope');

            if (extrasScope && effectiveSchema.length) {
                effectiveSchema.forEach(function (group, gIndex) {
                    const box = document.createElement('div');
                    box.className = 'bg-gray-50 border border-gray-100 rounded-2xl p-3';

                    const title = document.createElement('p');
                    title.className = 'text-xs font-bold text-gray-500 uppercase tracking-wide mb-2';
                    title.textContent = group.title || 'Grupo';
                    box.appendChild(title);

                    const type = group.type || 'checkbox';
                    const options = Array.isArray(group.options) ? group.options : [];

                    if (type === 'select') {
                        const select = document.createElement('select');
                        select.className = 'custom-input';
                        select.style.paddingLeft = '16px';
                        select.name = 'rop_extra_' + gIndex;
                        select.innerHTML = '<option value="">Selecione</option>';
                        options.forEach(function (option) {
                            const op = document.createElement('option');
                            op.value = option.label || '';
                            op.textContent = (option.label || '') + ' (+ ' + formatBRL(option.price || 0) + ')';
                            op.dataset.price = String(option.price || 0);
                            select.appendChild(op);
                        });
                        box.appendChild(select);
                    } else {
                        options.forEach(function (option, oIndex) {
                            const label = document.createElement('label');
                            label.className = 'flex justify-between items-center cursor-pointer p-2 rounded-xl hover:bg-white';

                            const left = document.createElement('span');
                            left.className = 'text-sm text-gray-700';
                            left.textContent = option.label || '';

                            const right = document.createElement('span');
                            right.className = 'text-sm font-bold text-red-500';
                            right.textContent = '+ ' + formatBRL(option.price || 0);

                            const input = document.createElement('input');
                            input.type = type === 'radio' ? 'radio' : 'checkbox';
                            input.name = type === 'radio' ? ('rop_extra_' + gIndex) : ('rop_extra_' + gIndex + '[]');
                            input.value = option.label || '';
                            input.dataset.price = String(option.price || 0);
                            input.style.marginRight = '8px';

                            const leftWrap = document.createElement('span');
                            leftWrap.className = 'flex items-center';
                            leftWrap.appendChild(input);
                            leftWrap.appendChild(left);

                            label.appendChild(leftWrap);
                            label.appendChild(right);
                            box.appendChild(label);
                        });
                    }

                    extrasScope.appendChild(box);
                });
            }

            if (extrasScope && product.is_variable && Array.isArray(product.variable_attributes) && product.variable_attributes.length) {
                renderVariationSelectors(extrasScope, product, appRoot, productScreen);
            }

            if (extrasScope && product.barn2_html) {
                const wrap = document.createElement('div');
                wrap.innerHTML = product.barn2_html;
                extrasScope.appendChild(wrap);
            }

            if (extrasScope) {
                extrasScope.addEventListener('change', function () {
                    const priceEl = buyBlock.querySelector('[data-rop-product-price]');
                    if (!priceEl) return;

                    const base = Number(product.price || 0);
                    let extrasTotal = 0;
                    extrasScope.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked, select option:checked').forEach(function (field) {
                        extrasTotal += Number((field.dataset && field.dataset.price) || 0);
                    });

                    const finalValue = base + extrasTotal;
                    priceEl.textContent = formatBRL(finalValue);
                    setProductMetaPrice(productScreen, { formatted_price: formatBRL(finalValue), price_html: formatBRL(finalValue) }, null);
                });
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

        removeProductHeartControls();
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


    function ensureCheckoutScreen(appRoot) {
        let checkoutScreen = getCheckoutScreen(appRoot);
        if (checkoutScreen) return checkoutScreen;

        const contentWrap = appRoot.querySelector('.content-wrapper');
        if (!contentWrap) return null;

        checkoutScreen = document.createElement('div');
        checkoutScreen.id = 'checkout-screen';
        checkoutScreen.className = 'hidden';
        contentWrap.appendChild(checkoutScreen);
        return checkoutScreen;
    }

    function showScreenFallback(screenId) {
        ['home-screen', 'product-screen', 'account-screen', 'info-screen', 'orders-screen', 'checkout-screen'].forEach(function (id) {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === screenId) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });

        if (screenId !== 'checkout-screen') {
            ROP_Checkout.destroy(getAppRoot());
        }

        window.scrollTo(0, 0);
    }

    function bindCheckoutForm(appRoot, checkoutScreen) {
        const form = checkoutScreen ? checkoutScreen.querySelector('form.checkout') : null;
        if (!form) return;

        if (ROP_Checkout.controller) {
            ROP_Checkout.controller.abort();
        }
        ROP_Checkout.controller = new AbortController();
        const signal = ROP_Checkout.controller.signal;

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const payload = {};
            const fd = new FormData(form);
            fd.forEach(function (value, key) {
                if (Object.prototype.hasOwnProperty.call(payload, key)) {
                    if (!Array.isArray(payload[key])) payload[key] = [payload[key]];
                    payload[key].push(value);
                } else {
                    payload[key] = value;
                }
            });

            payload.rop_fulfillment = state.fulfillment || 'delivery';

            const res = await ropFetch('rop_place_order', { form: JSON.stringify(payload) });
            if (!res || !res.success) {
                const msg = res && res.data && res.data.message ? res.data.message : 'Erro ao finalizar pedido.';
                let notice = checkoutScreen.querySelector('[data-rop-checkout-notice="1"]');
                if (!notice) {
                    notice = document.createElement('div');
                    notice.setAttribute('data-rop-checkout-notice', '1');
                    notice.className = 'p-4 text-sm text-red-500';
                    checkoutScreen.prepend(notice);
                }
                notice.innerHTML = msg;
                return;
            }

            await ropFetch('rop_cart_clear');
            await refreshCartSummary(appRoot);

            if (typeof window.toggleModal === 'function') {
                const success = document.getElementById('success-modal');
                if (success && success.classList.contains('hidden')) {
                    success.classList.remove('hidden');
                    setTimeout(function () { success.classList.add('modal-active'); }, 10);
                }
            }

            ROP_Checkout.destroy(appRoot);
            showScreenFallback('home-screen');

            try {
                const orders = await ropFetch('rop_orders_list');
                renderOrdersScreen(appRoot, (orders && orders.success && orders.data && orders.data.orders) ? orders.data.orders : []);
            } catch (err) {
                console.warn('ROP orders refresh failed', err);
            }
        }, { signal: signal });
    }

    async function loadCheckoutScreen(appRoot) {
        const checkoutScreen = ensureCheckoutScreen(appRoot);
        if (!checkoutScreen) return;

        ROP_Checkout.destroy(appRoot);

        checkoutScreen.innerHTML = '<div class="p-4"><div class="flex items-center justify-between mb-3"><button type="button" data-rop-checkout-back class="bg-white border border-gray-100 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700">Voltar</button><span class="text-sm font-bold text-gray-700">Checkout</span></div><div data-rop-checkout-content="1" class="p-2 text-gray-500 text-sm">Carregando checkout...</div></div>';

        const backBtn = checkoutScreen.querySelector('[data-rop-checkout-back]');
        if (backBtn) {
            backBtn.onclick = function () {
                ROP_Checkout.destroy(appRoot);
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo('home-screen');
                } else {
                    showScreenFallback('home-screen');
                }
            };
        }

        const content = checkoutScreen.querySelector('[data-rop-checkout-content="1"]');
        try {
            const response = await ropFetch('rop_checkout_html');
            if (!response || !response.success || !response.data) {
                if (content) content.innerHTML = '<div class="p-4 text-red-500 text-sm">Não foi possível carregar checkout.</div>';
                return;
            }

            if (content) content.innerHTML = String(response.data.html || '');
            bindCheckoutForm(appRoot, checkoutScreen);
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        } catch (e) {
            if (content) content.innerHTML = '<div class="p-4 text-red-500 text-sm">Falha ao carregar checkout.</div>';
        }
    }

    async function bootSettingsAndStatus(appRoot) {
        try {
            const bootstrap = await ropFetch('rop_app_bootstrap');
            if (bootstrap && bootstrap.success && bootstrap.data) {
                state.bootstrap = bootstrap.data;
                state.store = bootstrap.data.store || {};
                applyStoreVars(appRoot, state.store);
                updateHomeTexts(appRoot, state.store);
                renderInfoScreen(appRoot, bootstrap.data);
                updateClosedModalText((bootstrap.data.hours && bootstrap.data.hours.human_status) || '');
                updateEtaTexts(appRoot, (bootstrap.data.eta && bootstrap.data.eta.text) || '');
                applyCheckoutLabels(appRoot, bootstrap.data.checkout || {});

                if (bootstrap.data.hours && !bootstrap.data.hours.is_open) {
                    if (typeof window.openStoreClosedModal === 'function') window.openStoreClosedModal();
                    else openClosedModalFallback();
                }
                return;
            }
        } catch (err) {
            console.warn('ROP bootstrap fetch failed', err);
        }

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
                if (screenId === 'checkout-screen') {
                    showScreenFallback('checkout-screen');
                } else {
                    originalNavigate(screenId);
                    if (screenId === 'home-screen') {
                        ROP_Checkout.destroy(appRoot);
                    }
                }

                if (screenId !== 'product-screen') {
                    appRoot.classList.add('rop-ready-product');
                    appRoot.classList.remove('rop-woo-single-active');
                }

                if (screenId === 'orders-screen') {
                    ropFetch('rop_orders_list').then(function (res) {
                        if (res && res.success && res.data && Array.isArray(res.data.orders)) {
                            renderOrdersScreen(appRoot, res.data.orders);
                        }
                    }).catch(function () {});
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

                await goToCheckout(appRoot);
            } catch (e) {
                console.warn('ROP checkout override failed', e);
                await goToCheckout(appRoot);
            }
        };

        appRoot.classList.add('rop-ready-product');
        updateFloatingButtonVisibility(appRoot);
        bindCartOpenTriggers(appRoot);
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
