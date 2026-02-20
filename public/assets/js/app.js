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

    const ROP_UI = {
        refreshIcons(rootEl) {
            if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;
            requestAnimationFrame(function () {
                setTimeout(function () {
                    try {
                        window.lucide.createIcons({
                            icons: window.lucide.icons
                        });
                    } catch (e) {
                        window.lucide.createIcons();
                    }
                }, 0);
            });
        },
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

    async function ropPluginAddToCart(data) {
        const response = await ROP_API.post('rop_cart_add', data || {});
        if (!response || response.success !== true) {
            throw new Error((response && response.data && response.data.message) ? response.data.message : 'Não foi possível adicionar ao carrinho.');
        }
        return normalizeCartResponse(response) || ropCartState();
    }

    async function ropPluginRemoveFromCart(cartItemKey) {
        const response = await ROP_API.post('rop_cart_remove', { key: cartItemKey || '' });
        if (!response || response.success !== true) {
            throw new Error((response && response.data && response.data.message) ? response.data.message : 'Não foi possível remover o item.');
        }
        return normalizeCartResponse(response) || ropCartState();
    }

    async function ropCartState() {
        const response = await ROP_API.post('rop_cart_state');
        const payload = normalizeCartResponse(response);
        if (payload) return payload;
        throw new Error('cart_state_failed');
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

    function ensureFilterModalStructure(modal) {
        if (!modal) return;
        const content = modal.querySelector('.modal-content');
        if (!content) return;
        if (content.querySelector('.p-6.space-y-8')) return;

        content.insertAdjacentHTML('beforeend', ''
            + '<div class="p-6 space-y-8">'
            + '<div><h3 class="text-sm font-bold text-gray-700 mb-3">Ordenar por</h3><div class="flex flex-wrap gap-2">'
            + '<button type="button" class="filter-chip active">Recomendados</button>'
            + '<button type="button" class="filter-chip">Menor Preço</button>'
            + '<button type="button" class="filter-chip">Maior Preço</button>'
            + '<button type="button" class="filter-chip">Mais Recentes</button>'
            + '<button type="button" class="filter-chip">Em Promoção</button>'
            + '</div></div>'
            + '<div><h3 class="text-sm font-bold text-gray-700 mb-3">Categoria</h3><div class="flex flex-wrap gap-2">'
            + '<button type="button" class="filter-chip active">Tudo</button>'
            + '</div></div>'
            + '<div><h3 class="text-sm font-bold text-gray-700 mb-3">Faixa de preço</h3><div class="flex flex-wrap gap-2">'
            + '<button type="button" class="filter-chip">$</button>'
            + '<button type="button" class="filter-chip">$$</button>'
            + '<button type="button" class="filter-chip">$$$</button>'
            + '</div></div>'
            + '<button type="button" onclick="toggleModal(\'filter-modal\')" class="w-full bg-red-500 text-white py-3.5 rounded-2xl font-bold text-sm">Aplicar Filtros</button>'
            + '</div>');
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
        if (nameEl) {
            const hasLogo = !!(store && store.has_logo && store.logo_url);
            let logoImg = nameEl.querySelector('img.rop-store-logo');

            if (hasLogo) {
                if (!logoImg) {
                    logoImg = document.createElement('img');
                    logoImg.className = 'rop-store-logo';
                    logoImg.alt = (store.store_name || 'Foodgo');
                    logoImg.style.maxHeight = '44px';
                    logoImg.style.width = 'auto';
                    logoImg.style.objectFit = 'contain';
                    nameEl.innerHTML = '';
                    nameEl.appendChild(logoImg);
                }

                if (logoImg.src !== String(store.logo_url || '')) {
                    logoImg.src = String(store.logo_url || '');
                }
            } else {
                if (logoImg) {
                    logoImg.remove();
                }
                if (store && store.store_name) {
                    nameEl.textContent = store.store_name;
                }
            }
        }

        const sloganEl = homeScreen.querySelector('p.text-gray-400.text-xs');
        if (sloganEl && store.slogan) sloganEl.textContent = store.slogan;
    }


    function getBrandMarkup(store) {
        const hasLogo = !!(store && store.has_logo && store.logo_url);
        if (hasLogo) {
            return '<img class="rop-store-logo" src="' + (store.logo_url || '') + '" alt="' + (store.store_name || 'Foodgo') + '" style="max-height:44px;width:auto;object-fit:contain;"/>';
        }
        return (store && store.store_name) ? store.store_name : 'Foodgo';
    }

    function ensureAccountLayout(appRoot) {
        const screen = appRoot ? appRoot.querySelector('#account-screen') : null;
        if (!screen) return null;

        let body = screen.querySelector('[data-rop-account-body="1"]');
        if (!body) {
            body = document.createElement('div');
            body.setAttribute('data-rop-account-body', '1');
            body.className = 'p-6';
            const title = screen.querySelector('[data-rop-screen-title="1"]');
            if (title && title.nextSibling) {
                screen.insertBefore(body, title.nextSibling);
            } else if (title) {
                screen.appendChild(body);
            } else {
                screen.appendChild(body);
            }
        }

        return body;
    }

    function ensureScreenHeader(appRoot, screenId, title) {
        const screen = appRoot ? appRoot.querySelector('#' + screenId) : null;
        if (!screen) return;

        let header = screen.querySelector('[data-rop-screen-header="1"]');
        if (!header) {
            header = document.createElement('div');
            header.setAttribute('data-rop-screen-header', '1');
            header.className = 'p-6 flex justify-between items-center';
            screen.prepend(header);
        }

        header.innerHTML = ''
            + '<div><h1 class="text-2xl text-gray-800 logo-font">' + getBrandMarkup(state.store || {}) + '</h1><p class="text-gray-400 text-xs">' + ((state.store && state.store.slogan) || '') + '</p></div>'
            + '<div class="text-right"><button type="button" data-rop-logout-avatar class="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer active:scale-95 transition-transform hover:shadow-md"><img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150" alt="Usuário" class="w-full h-full object-cover"></button></div>';

        const btn = header.querySelector('[data-rop-logout-avatar]');
        if (btn) {
            btn.onclick = function () {
                if (typeof window.toggleModal === 'function') {
                    window.toggleModal('logout-modal');
                }
            };
        }

        if (screenId === 'account-screen') {
            ensureAccountLayout(appRoot);
        }

        if (title) {
            let t = screen.querySelector('[data-rop-screen-title="1"]');
            if (!t) {
                t = document.createElement('h2');
                t.setAttribute('data-rop-screen-title', '1');
                t.className = 'px-6 text-xl font-bold text-gray-800';
            }
            if (header.nextSibling !== t) {
                screen.insertBefore(t, header.nextSibling);
            }
            t.textContent = title;
        }
    }

    function fixAccountTitlePosition(appRoot) {
        const screen = appRoot ? appRoot.querySelector('#account-screen') : null;
        if (!screen) return;
        const header = screen.querySelector('[data-rop-screen-header="1"]');
        const title = screen.querySelector('[data-rop-screen-title="1"]');
        const area = ensureAccountLayout(appRoot);
        if (!header || !title || !area) return;
        if (header.nextSibling !== title) {
            screen.insertBefore(title, header.nextSibling);
        }
        if (title.nextSibling !== area) {
            screen.insertBefore(area, title.nextSibling);
        }
    }

    function setupStoreClosedModal(appRoot) {
        const modal = document.getElementById('store-closed-modal');
        if (!modal) return;
        const box = modal.querySelector('.center-modal-content');
        if (!box) return;

        if (!box.querySelector('[data-rop-close-x="1"]')) {
            const x = document.createElement('button');
            x.type = 'button';
            x.setAttribute('data-rop-close-x', '1');
            x.className = 'absolute top-4 right-4 text-gray-400 hover:text-gray-700';
            x.innerHTML = '<i data-lucide="x" class="w-5 h-5"></i>';
            x.onclick = function () { if (typeof window.closeStoreClosedModal === 'function') window.closeStoreClosedModal(); };
            box.appendChild(x);
        }

        let p = box.querySelector('p');
        if (!p) {
            p = document.createElement('p');
            p.className = 'text-sm text-gray-600 mb-4';
            box.insertBefore(p, box.querySelector('button'));
        }

        const action = box.querySelector('button');
        if (action) {
            action.textContent = 'Ver Cardápio';
            action.onclick = function () {
                if (typeof window.closeStoreClosedModal === 'function') window.closeStoreClosedModal();
                if (typeof window.navigateTo === 'function') window.navigateTo('home-screen');
            };
        }

        updateClosedModalText((state.bootstrap && state.bootstrap.hours && state.bootstrap.hours.human_status) || '');
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
        const base = 'Estamos fechados agora.';
        p.textContent = humanStatus ? (base + ' ' + humanStatus) : (base + ' Fechado — abrimos em breve.');
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
        ROP_UI.refreshIcons(appRoot);
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
            quantity: state.productQty,
        };

        if (state.currentProduct.is_variable) {
            payload.variation_id = state.selectedVariationId;
            Object.keys(state.selectedAttributes || {}).forEach(function (k) {
                payload[k] = state.selectedAttributes[k];
            });
        }

        if (extras && extras.length) {
            payload.rop_extras = JSON.stringify(extras);
        }

        try {
            await ropPluginAddToCart(payload);

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
                const cartPayload = await ropPluginAddToCart({ product_id: product.id, quantity: 1 });

                plusBtn.classList.add('scale-95');
                setTimeout(function () { plusBtn.classList.remove('scale-95'); }, 180);

                const icon = plusBtn.querySelector('i[data-lucide]');
                if (icon) {
                    icon.setAttribute('data-lucide', 'check');
                    ROP_UI.refreshIcons(getAppRoot());
                    setTimeout(function () {
                        icon.setAttribute('data-lucide', 'plus');
                        ROP_UI.refreshIcons(getAppRoot());
                    }, 800);
                }

                showHomeAddFeedback(getAppRoot(), 'Item adicionado ao carrinho');
                refreshCartSummary(getAppRoot(), cartPayload);
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

        ROP_UI.refreshIcons(getAppRoot());
    }

    function currentFilters(page) {
        return {
            page: page,
            per_page: state.perPage,
            category: state.homeCategory || '',
            q: state.q || '',
            orderby: state.orderby,
            price_bucket: state.priceTier || '',
        };
    }

    async function loadProducts(homeScreen, append) {
        if (state.isLoading || (append && !state.hasMore)) return;
        state.isLoading = true;

        try {
            const response = await ropFetch('rop_products_list', currentFilters(state.page));
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
                appRoot.classList.add('rop-hydrated');
                ROP_UI.refreshIcons(appRoot);
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
        ensureFilterModalStructure(modal);

        const sections = modal.querySelectorAll('.p-6.space-y-8 > div');
        const orderSection = sections[0];
        const categorySection = sections[1];
        const priceSection = sections[2];

        if (orderSection) {
            const chips = orderSection.querySelectorAll('.filter-chip');
            const map = {
                'Recomendados': 'recommended',
                'Menor Preço': 'price_asc',
                'Maior Preço': 'price_desc',
                'Mais Recentes': 'date',
                'Em Promoção': 'sale',
            };
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
                        state.modalCategory = String(cat.slug || cat.id || '');
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
        if (applyBtn && !applyBtn.dataset.ropApplyFilters) {
            applyBtn.dataset.ropApplyFilters = '1';
            applyBtn.addEventListener('click', function () {
                state.homeCategory = state.modalCategory || '';
                state.page = 1;
                state.hasMore = true;
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

    async function refreshCartSummary(appRoot, cartPayload) {
        const priceBox = getProductPriceBox(appRoot);
        if (!priceBox) return;

        let cart = cartPayload || null;
        if (!cart) {
            try {
                const response = await ROP_API.post('rop_cart_state');
                cart = normalizeCartResponse(response);
            } catch (err) {
                cart = null;
            }
        }

        const total = cart && cart.totals && cart.totals.total_html ? stripTags(cart.totals.total_html) : 'R$ 0,00';
        priceBox.innerHTML = '<i data-lucide="shopping-bag" class="w-5 h-5 mr-2"></i> ' + (total || 'R$ 0,00');
        priceBox.style.cursor = 'pointer';
        priceBox.onclick = function () {
            if (typeof window.toggleModal === 'function') window.toggleModal('cart-modal');
            renderCartModal(appRoot);
        };

        document.querySelectorAll('[data-rop-cart-badge]').forEach(function (el) {
            el.innerHTML = cart && cart.totals && cart.totals.total_html ? cart.totals.total_html : 'R$ 0,00';
        });

        ROP_UI.refreshIcons(appRoot);
    }

    const ROP_API = {
        async post(action, data) {
            const response = await ropFetch(action, data || {});
            if (!response || typeof response.success === 'undefined') {
                return { success: false, data: { message: 'Resposta inválida' } };
            }
            return response;
        },
    };

    function normalizeCartResponse(response) {
        if (!response || response.success !== true) return null;
        if (response.data && response.data.cart) return response.data.cart;
        return response.data || null;
    }

    async function fetchCartData() {
        const response = await ROP_API.post('rop_cart_state');
        const payload = normalizeCartResponse(response);
        if (payload) return payload;
        throw new Error('cart_state_failed');
    }

    function showCartInlineNotice(modal, message, isError) {
        if (!modal) return;
        let notice = modal.querySelector('[data-rop-cart-inline-notice]');
        if (!notice) {
            notice = document.createElement('div');
            notice.setAttribute('data-rop-cart-inline-notice', '1');
            notice.className = 'px-6 pt-2 text-xs';
            const header = modal.querySelector('.border-b.border-gray-50');
            if (header && header.parentElement) header.parentElement.insertBefore(notice, header.nextSibling);
        }
        notice.className = 'px-6 pt-2 text-xs ' + (isError ? 'text-red-500' : 'text-amber-600');
        notice.textContent = message || '';
    }

    function updateCartTotalsUI(modal, cart) {
        if (!modal) return;
        const totals = (cart && cart.totals) ? cart.totals : {};

        const subtotalEl = modal.querySelector('[data-rop-cart-subtotal]');
        const shippingEl = modal.querySelector('[data-rop-cart-shipping]');
        const totalEl = modal.querySelector('[data-rop-cart-total]');

        if (subtotalEl) subtotalEl.innerHTML = totals.subtotal_html || 'R$ 0,00';
        if (shippingEl) shippingEl.innerHTML = totals.shipping_html || 'Grátis';
        if (totalEl) totalEl.innerHTML = totals.total_html || 'R$ 0,00';

        if (!subtotalEl || !shippingEl || !totalEl) {
            const summaryRows = modal.querySelectorAll('.space-y-3 .flex.justify-between');
            const totalRow = modal.querySelector('.space-y-3 .text-xl.font-bold.text-gray-800');
            if (summaryRows[0]) summaryRows[0].innerHTML = '<span>Subtotal</span><span>' + (totals.subtotal_html || 'R$ 0,00') + '</span>';
            if (summaryRows[1]) summaryRows[1].innerHTML = '<span>Entrega</span><span class="text-green-500">' + (totals.shipping_html || 'Grátis') + '</span>';
            if (totalRow) totalRow.innerHTML = '<span>Total</span><span>' + (totals.total_html || 'R$ 0,00') + '</span>';
        }
    }

    function updateFreeShippingUI(modal, cart) {
        if (!modal) return;
        const box = modal.querySelector('[data-rop-free-shipping]');
        if (!box) return;
        const text = box.querySelector('div.text-xs') || box.firstElementChild;
        const bar = box.querySelector('[data-rop-free-shipping-bar]');
        const msg = (cart && cart.free_shipping_message) ? cart.free_shipping_message : '';
        const progress = Number((cart && cart.free_shipping_progress) || 0);
        if (text) text.textContent = msg || 'Frete grátis indisponível';
        if (bar) bar.style.width = Math.max(0, Math.min(100, progress * 100)) + '%';
    }

    function renderCouponPills(modal, cart) {
        if (!modal) return;
        let wrap = modal.querySelector('[data-rop-coupons]');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.setAttribute('data-rop-coupons', '1');
            wrap.className = 'mb-2 flex flex-wrap gap-2';
            const notice = modal.querySelector('[data-rop-cart-notices]');
            if (notice && notice.parentElement) notice.parentElement.insertBefore(wrap, notice.nextSibling);
        }
        const coupons = (cart && Array.isArray(cart.coupons)) ? cart.coupons : [];
        wrap.innerHTML = '';
        coupons.forEach(function (code) {
            const pill = document.createElement('span');
            pill.className = 'text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-700';
            pill.textContent = 'Cupom: ' + code;
            wrap.appendChild(pill);
        });
    }

    function getCartListContainer(modal) {
        if (!modal) return null;
        let list = modal.querySelector('#cart-modal .flex-1.overflow-y-auto') || modal.querySelector('.flex-1.overflow-y-auto') || modal.querySelector('.flex-1');
        if (list) return list;

        const content = modal.querySelector('.modal-content');
        if (!content) return null;

        content.insertAdjacentHTML('beforeend', ''
            + '<div class="flex-1 overflow-y-auto px-6 py-4 space-y-4"></div>'
            + '<div class="px-6 py-4 border-t border-gray-100">'
            + '<div data-rop-cart-notices class="text-xs mb-2"></div>'
            + '<div class="flex gap-2 mb-3"><input type="text" placeholder="Cupom" class="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm"><button type="button" class="bg-red-500 text-white px-6 rounded-2xl font-bold text-sm shadow-md hover:bg-red-600 transition-colors">Aplicar</button></div>'
            + '<div class="space-y-3 text-sm text-gray-500">'
            + '<div class="flex justify-between"><span>Subtotal</span><span data-rop-cart-subtotal>R$ 0,00</span></div>'
            + '<div class="flex justify-between"><span>Entrega</span><span class="text-green-500" data-rop-cart-shipping>Grátis</span></div>'
            + '<div class="flex justify-between text-xl font-bold text-gray-800"><span>Total</span><span data-rop-cart-total>R$ 0,00</span></div>'
            + '</div>'
            + '<button type="button" onclick="checkStoreAndCheckout()" class="w-full mt-4 bg-[#2D2929] text-white py-3.5 rounded-2xl font-bold text-sm uppercase shadow-lg">Confirmar Pedido</button>'
            + '</div>');

        return modal.querySelector('.flex-1.overflow-y-auto') || null;
    }

    async function handleCartItemAction(appRoot, modal, btn, worker) {
        const row = btn ? btn.closest('.group') : null;
        if (row) {
            row.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
        }

        try {
            await worker();
            const cartPayload = await ropCartState();
            await renderCartModal(appRoot, cartPayload);
            await refreshCartSummary(appRoot, cartPayload);
            showCartInlineNotice(modal, '', false);
        } catch (err) {
            showCartInlineNotice(modal, err && err.message ? err.message : 'Não foi possível atualizar, tente novamente.', true);
            try {
                const cartPayload = await ropCartState();
                await renderCartModal(appRoot, cartPayload);
                await refreshCartSummary(appRoot, cartPayload);
            } catch (e) {
                // ignore secondary errors
            }
        }
    }

    function bindCartActions(appRoot, modal, list) {
        list.querySelectorAll('[data-remove]').forEach(function (btn) {
            btn.onclick = async function () {
                const key = btn.getAttribute('data-remove') || '';
                await handleCartItemAction(appRoot, modal, btn, function () {
                    return ropPluginRemoveFromCart(key);
                });
            };
        });

        list.querySelectorAll('[data-qty]').forEach(function (btn) {
            btn.onclick = async function () {
                const key = btn.getAttribute('data-qty') || '';
                const action = btn.getAttribute('data-action') || 'plus';
                const currentEl = btn.parentElement ? btn.parentElement.querySelector('.rop-cart-qty-val') : null;
                const currentQty = Number((currentEl && currentEl.textContent) || 1);
                const nextQty = action === 'minus' ? Math.max(1, currentQty - 1) : Math.min(99, currentQty + 1);
                await handleCartItemAction(appRoot, modal, btn, function () {
                    return ROP_API.post('rop_cart_set_qty', { key: key, qty: nextQty }).then(function (res) {
                        if (!res || res.success !== true) {
                            throw new Error((res && res.data && res.data.message) ? res.data.message : 'Não foi possível atualizar, tente novamente.');
                        }
                    });
                });
            };
        });

        const couponInput = modal.querySelector('input[placeholder="Cupom"]');
        const applyBtn = modal.querySelector('button.bg-red-500.text-white.px-6.rounded-2xl.font-bold.text-sm.shadow-md.hover\:bg-red-600.transition-colors');
        if (applyBtn && !applyBtn.dataset.boundCoupon) {
            applyBtn.dataset.boundCoupon = '1';
            applyBtn.addEventListener('click', async function () {
                const code = couponInput ? (couponInput.value || '').trim() : '';
                const res = await ROP_API.post('rop_cart_apply_coupon', { code: code });
                if (!res || res.success !== true) {
                    showCartInlineNotice(modal, (res && res.data && res.data.message) ? res.data.message : 'Cupom inválido.', false);
                    return;
                }
                const cartPayload = await ropCartState();
                await renderCartModal(appRoot, cartPayload);
                await refreshCartSummary(appRoot, cartPayload);
            });
        }
    }

    async function renderCartModal(appRoot, providedCart) {
        const modal = document.getElementById('cart-modal');
        if (!modal) return;
        const list = getCartListContainer(modal);
        if (!list) return;

        list.innerHTML = '<div class="rop-cart-state">Carregando carrinho...</div>';

        let cart = providedCart || null;
        if (!cart) {
            try {
                cart = await fetchCartData();
            } catch (err) {
                showCartInlineNotice(modal, 'Não foi possível atualizar, tente novamente.', true);
                return;
            }
        }

        const noticesTarget = modal.querySelector('[data-rop-cart-notices]');
        if (noticesTarget) {
            noticesTarget.innerHTML = cart.notices_html || '';
        }

        list.innerHTML = '';
        if (!Array.isArray(cart.items) || cart.items.length === 0) {
            list.innerHTML = '<div class="rop-cart-state">Seu carrinho está vazio.</div><div class="text-center"><button type="button" data-rop-open-menu class="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold">Ver cardápio</button></div>';
            const btn = list.querySelector('[data-rop-open-menu]');
            if (btn) {
                btn.onclick = function () {
                    if (typeof window.toggleModal === 'function') window.toggleModal('cart-modal');
                    if (typeof window.navigateTo === 'function') window.navigateTo('home-screen');
                };
            }
        } else {
            cart.items.forEach(function (item) {
                const row = document.createElement('div');
                row.className = 'flex gap-4 items-center group mb-4';
                row.innerHTML = ''
                    + '<div class="w-20 h-20 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0"><img src="' + (item.thumb_url || item.image_url || '') + '" alt="' + (item.name || 'Produto') + '" class="w-full h-full object-cover"></div>'
                    + '<div class="flex-1 min-w-0"><h4 class="font-semibold text-gray-800 text-sm truncate">' + (item.name || 'Produto') + '</h4>'
                    + (item.meta_lines && item.meta_lines.length ? ('<p class="text-xs text-gray-400 mt-1 line-clamp-2">' + item.meta_lines.join(', ') + '</p>') : '')
                    + '<div class="flex items-center justify-between mt-2"><span class="font-bold text-sm text-gray-800">' + (item.line_total_html || 'R$ 0,00') + '</span>'
                    + '<div class="flex items-center gap-2"><button data-qty="' + (item.key || '') + '" data-action="minus" class="rop-cart-qty-btn rop-cart-minus" type="button">−</button>'
                    + '<span class="rop-cart-qty-val w-6 text-center text-sm font-semibold">' + Number(item.qty || 1) + '</span>'
                    + '<button data-qty="' + (item.key || '') + '" data-action="plus" class="rop-cart-qty-btn rop-cart-plus" type="button">+</button>'
                    + '<button data-remove="' + (item.key || '') + '" class="rop-cart-remove" type="button" aria-label="Remover">×</button></div></div></div>';
                list.appendChild(row);
            });
            bindCartActions(appRoot, modal, list);
        }

        updateCartTotalsUI(modal, cart);
        updateFreeShippingUI(modal, cart);
        renderCouponPills(modal, cart);
        ROP_UI.refreshIcons(modal);
    }

    function bindCartOpenTriggers(appRoot) {
        const floating = getFloatingPlusButton(appRoot);
        if (floating) {
            floating.onclick = function (e) {
                e.preventDefault();
                if (typeof window.toggleModal === 'function') window.toggleModal('cart-modal');
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

        ROP_UI.refreshIcons(appRoot);
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

        ROP_UI.refreshIcons(appRoot);
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

        ROP_UI.refreshIcons(appRoot);
    }

    async function openProduct(productId) {
        const appRoot = getAppRoot();
        if (!appRoot) return;

        state.currentProduct = null;
        state.productQty = 1;
        state.selectedVariationId = 0;
        state.selectedAttributes = {};
        appRoot.classList.remove('rop-ready-product');
        appRoot.classList.remove('rop-hydrated');

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


    async function loadAccountScreen(appRoot) {
        const screen = appRoot ? appRoot.querySelector('#account-screen') : null;
        if (!screen) return;

        ensureScreenHeader(appRoot, 'account-screen', 'Minha Conta');
        fixAccountTitlePosition(appRoot);
        const area = ensureAccountLayout(appRoot) || screen;
        area.innerHTML = '<div class="rop-cart-state">Carregando conta...</div>';

        try {
            const res = await ropFetch('rop_account_get');
            if (!res || !res.success || !res.data || !res.data.logged_in) {
                area.innerHTML = '<div class="rop-cart-state">Faça login para gerenciar sua conta.</div>';
                return;
            }

            const user = res.data.user || {};
            const billing = res.data.billing || {};
            const shipping = res.data.shipping || {};
            area.innerHTML = ''
                + '<div class="bg-white rounded-[24px] p-5 border border-gray-100 space-y-3">'
                + '<input data-rop-account="billing_first_name" class="custom-input" placeholder="Nome" value="' + (billing.billing_first_name || user.first_name || '') + '">'
                + '<input data-rop-account="billing_last_name" class="custom-input" placeholder="Sobrenome" value="' + (billing.billing_last_name || user.last_name || '') + '">'
                + '<input data-rop-account="billing_phone" class="custom-input" placeholder="Telefone" value="' + (billing.billing_phone || '') + '">'
                + '<input data-rop-account="billing_address_1" class="custom-input" placeholder="Rua e número" value="' + (billing.billing_address_1 || '') + '">'
                + '<input data-rop-account="billing_address_2" class="custom-input" placeholder="Complemento" value="' + (billing.billing_address_2 || '') + '">'
                + '<input data-rop-account="billing_city" class="custom-input" placeholder="Cidade" value="' + (billing.billing_city || '') + '">'
                + '<input data-rop-account="billing_postcode" class="custom-input" placeholder="CEP" value="' + (billing.billing_postcode || '') + '">'
                + '<input data-rop-account="shipping_first_name" class="custom-input" placeholder="Nome entrega" value="' + (shipping.shipping_first_name || '') + '">'
                + '<input data-rop-account="shipping_last_name" class="custom-input" placeholder="Sobrenome entrega" value="' + (shipping.shipping_last_name || '') + '">'
                + '<input data-rop-account="shipping_address_1" class="custom-input" placeholder="Endereço entrega" value="' + (shipping.shipping_address_1 || '') + '">'
                + '<button type="button" data-rop-account-save class="w-full bg-red-500 text-white rounded-2xl py-3 font-bold">Salvar</button>'
                + '<div class="pt-2 border-t border-gray-100">'
                + '<p class="text-sm font-semibold text-gray-700 mb-2">Trocar Senha</p>'
                + '<input type="password" data-rop-pass="current" class="custom-input" placeholder="Senha atual">'
                + '<input type="password" data-rop-pass="new" class="custom-input" placeholder="Nova senha">'
                + '<input type="password" data-rop-pass="confirm" class="custom-input" placeholder="Confirmar nova senha">'
                + '<button type="button" data-rop-pass-save class="w-full bg-[#2D2929] text-white rounded-2xl py-3 font-bold mt-2">Atualizar senha</button>'
                + '</div>'
                + '</div>';

            const passBtn = area.querySelector('[data-rop-pass-save]');
            if (passBtn) {
                passBtn.onclick = async function () {
                    const current = (area.querySelector('[data-rop-pass=\"current\"]') || {}).value || '';
                    const n1 = (area.querySelector('[data-rop-pass=\"new\"]') || {}).value || '';
                    const n2 = (area.querySelector('[data-rop-pass=\"confirm\"]') || {}).value || '';
                    if (!current || !n1 || n1 !== n2) {
                        showHomeAddFeedback(appRoot, 'Senha inválida');
                        return;
                    }
                    const pr = await ropFetch('rop_account_change_password', { current_password: current, new_password: n1 });
                    showHomeAddFeedback(appRoot, (pr && pr.success) ? 'Senha atualizada' : 'Erro ao atualizar senha');
                };
            }

            const saveBtn = area.querySelector('[data-rop-account-save]');
            if (saveBtn) {
                saveBtn.onclick = async function () {
                    const payload = {};
                    area.querySelectorAll('[data-rop-account]').forEach(function (el) {
                        payload[el.getAttribute('data-rop-account')] = el.value || '';
                    });
                    const up = await ropFetch('rop_account_update', payload);
                    showHomeAddFeedback(appRoot, (up && up.success) ? 'Salvo' : 'Erro ao salvar');
                };
            }
        } catch (err) {
            area.innerHTML = '<div class="rop-cart-state rop-cart-state--error">Erro ao carregar conta.</div>';
        }
    }


    function ensureOrdersLayout(appRoot) {
        const screen = appRoot ? appRoot.querySelector('#orders-screen') : null;
        if (!screen) return null;

        let headerHost = screen.querySelector('[data-rop-orders-header]');
        if (!headerHost) {
            headerHost = document.createElement('div');
            headerHost.setAttribute('data-rop-orders-header', '1');
            screen.prepend(headerHost);
        }

        let body = screen.querySelector('[data-rop-orders-body]');
        if (!body) {
            body = document.createElement('div');
            body.setAttribute('data-rop-orders-body', '1');
            body.className = 'px-6 pb-32 space-y-5';
            screen.appendChild(body);
        }

        return { screen: screen, body: body };
    }

    function renderOrdersScreen(appRoot, orders) {
        const layout = ensureOrdersLayout(appRoot);
        if (!layout) return;
        const list = layout.body;

        if (!Array.isArray(orders) || !orders.length) {
            list.innerHTML = '<div class="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 text-sm text-gray-400">Você ainda não fez pedidos.</div>';
            return;
        }

        list.innerHTML = '';
        orders.forEach(function (order) {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 relative overflow-hidden';
            const status = (order.status || '').toUpperCase();
            card.innerHTML = ''
                + '<div class="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">' + status + '</div>'
                + '<div class="flex justify-between items-center mb-4"><div><span class="text-xs text-gray-400 font-medium">Pedido #' + (order.number || order.id || '') + '</span><h3 class="font-bold text-gray-800 text-lg">' + ((state.store && state.store.store_name) || 'Pedido') + '</h3></div></div>'
                + '<div class="flex justify-between items-end border-t border-gray-50 pt-4"><div class="text-sm text-gray-500">' + (order.total_html || 'R$ 0,00') + ' • ' + (order.date || '') + '</div><button type="button" data-rop-order-detail="' + (order.id || '') + '" class="text-red-500 text-xs font-bold">Detalhes</button></div>';
            list.appendChild(card);
        });

        list.querySelectorAll('[data-rop-order-detail]').forEach(function (btn) {
            btn.onclick = async function () {
                const id = btn.getAttribute('data-rop-order-detail') || '';
                const modal = document.getElementById('order-details-modal');
                if (!modal) return;
                const content = modal.querySelector('.modal-content');
                if (!content) return;
                content.innerHTML = '<div class="p-6 text-sm text-gray-500">Carregando pedido...</div>';
                if (typeof window.toggleModal === 'function') window.toggleModal('order-details-modal');

                try {
                    const res = await ropFetch('rop_order_details', { order_id: id });
                    if (!res || !res.success || !res.data || !res.data.order) {
                        content.innerHTML = '<div class="p-6 text-sm text-red-500">Não foi possível carregar o pedido.</div>';
                        return;
                    }
                    const o = res.data.order;
                    const items = Array.isArray(o.items) ? o.items.map(function (it) {
                        return '<div class="flex justify-between text-sm py-1"><span>' + it.name + ' x' + it.qty + '</span><span>' + it.total_html + '</span></div>';
                    }).join('') : '';
                    content.innerHTML = '<div class="p-6"><h2 class="text-xl font-bold mb-2">Pedido #' + (o.number || o.id) + '</h2><p class="text-xs text-gray-500 mb-3">' + (o.date || '') + ' • ' + (o.status || '') + '</p><div class="border-t border-gray-100 pt-2">' + items + '</div><div class="mt-3 text-sm"><strong>Total:</strong> ' + (o.total_html || 'R$ 0,00') + '</div><div class="mt-2 text-xs text-gray-500">' + (o.address || '') + '</div></div>';
                } catch (e) {
                    content.innerHTML = '<div class="p-6 text-sm text-red-500">Erro ao carregar pedido.</div>';
                }
            };
        });
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
                if (typeof state.store.has_logo === 'undefined') { state.store.has_logo = !!state.store.logo_url; }
                applyStoreVars(appRoot, state.store);
                updateHomeTexts(appRoot, state.store);
                renderInfoScreen(appRoot, bootstrap.data);
                updateClosedModalText((bootstrap.data.hours && bootstrap.data.hours.human_status) || '');
                updateEtaTexts(appRoot, (bootstrap.data.eta && bootstrap.data.eta.text) || '');
                applyCheckoutLabels(appRoot, bootstrap.data.checkout || {});
                setupStoreClosedModal(appRoot);

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
        appRoot.classList.remove('rop-hydrated');

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
                    ensureOrdersLayout(appRoot);
                    ensureScreenHeader(appRoot, 'orders-screen', 'Meus Pedidos');
                    ropFetch('rop_orders_list').then(function (res) {
                        if (res && res.success && res.data && Array.isArray(res.data.orders)) {
                            renderOrdersScreen(appRoot, res.data.orders);
                        } else {
                            renderOrdersScreen(appRoot, []);
                        }
                    }).catch(function () { renderOrdersScreen(appRoot, []); });
                }

                if (screenId === 'account-screen') {
                    ensureScreenHeader(appRoot, 'account-screen', 'Minha Conta');
                    fixAccountTitlePosition(appRoot);
                    loadAccountScreen(appRoot);
                }

                if (screenId === 'info-screen') {
                    ensureScreenHeader(appRoot, 'info-screen', 'Informações');
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
            appRoot.classList.add('rop-hydrated');
            ROP_UI.refreshIcons(appRoot);
        }
    });
})();
