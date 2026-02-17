(function () {
  const state = {
    page: 1,
    perPage: 10,
    isLoading: false,
    hasMore: true,
    products: [],
    categories: [],
    filters: {
      category: '',
      q: '',
      orderby: 'recommended',
      on_sale: 0,
      price_tier: ''
    }
  };

  let searchDebounce;
  let suggestDebounce;
  let templateCard = null;
  let templateChip = null;

  const config = window.ropApp || {};
  const ajaxUrl = config.ajaxUrl || window.ajaxurl || '/wp-admin/admin-ajax.php';
  const nonce = config.nonce || '';

  function post(action, payload) {
    const body = new URLSearchParams({ action, nonce, ...payload });
    return fetch(ajaxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString()
    }).then((r) => r.json());
  }

  function getHomeElements() {
    const home = document.querySelector('#home-screen');
    if (!home) return {};

    const searchInput = home.querySelector('input[placeholder*="Pesquisar"]');
    const chipsContainer = home.querySelector('div.overflow-x-auto');
    const grid = home.querySelector('div.grid.pb-32');
    const filterModal = document.querySelector('#filter-modal');
    const applyFiltersButton = filterModal
      ? Array.from(filterModal.querySelectorAll('button')).find((btn) => /aplicar filtros/i.test((btn.textContent || '').trim()))
      : null;

    return { home, searchInput, chipsContainer, grid, filterModal, applyFiltersButton };
  }

  function ensureTemplates(elements) {
    if (!templateChip && elements.chipsContainer) {
      templateChip = elements.chipsContainer.querySelector('button');
    }
    if (!templateCard && elements.grid) {
      templateCard = elements.grid.querySelector('.product-card');
    }
  }

  function createChip(label, value, active, onClick) {
    if (!templateChip) return null;
    const chip = templateChip.cloneNode(true);
    chip.textContent = label;
    chip.dataset.value = value;
    chip.classList.toggle('bg-primary', !!active);
    chip.classList.toggle('text-white', !!active);
    chip.addEventListener('click', () => onClick(value));
    return chip;
  }

  function renderCategoryChips(elements) {
    if (!elements.chipsContainer || !templateChip) return;
    elements.chipsContainer.innerHTML = '';

    const allChip = createChip('Tudo', '', !state.filters.category, onCategoryChange);
    if (allChip) elements.chipsContainer.appendChild(allChip);

    state.categories.forEach((cat) => {
      const chip = createChip(cat.name, cat.slug, state.filters.category === cat.slug, onCategoryChange);
      if (chip) elements.chipsContainer.appendChild(chip);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function fillCard(card, product) {
    card.dataset.productId = String(product.id);
    card.dataset.productSimple = product.is_simple ? '1' : '0';

    const img = card.querySelector('img');
    if (img) {
      img.src = product.image || img.src;
      img.alt = product.name || 'Produto';
    }

    const title = card.querySelector('h3');
    if (title) title.textContent = product.name || 'Produto';

    const subtitle = card.querySelector('p');
    if (subtitle) subtitle.textContent = (product.short || '—').trim() || '—';

    const price = Array.from(card.querySelectorAll('*')).find((el) => (el.textContent || '').trim().startsWith('$'));
    if (price) price.innerHTML = product.price_html || `$${(product.price || 0).toFixed(2)}`;

    const plusButton = Array.from(card.querySelectorAll('button')).find((btn) => (btn.textContent || '').trim() === '+');
    if (plusButton) {
      plusButton.addEventListener('click', (e) => {
        e.stopPropagation();
        onAddProduct(product, plusButton);
      });
    }

    card.addEventListener('click', () => {
      if (typeof window.navigateTo === 'function') {
        window.navigateTo('product-screen');
      }
    });
  }

  function renderProducts(elements, products, append = false) {
    if (!elements.grid || !templateCard) return;
    if (!append) elements.grid.innerHTML = '';

    products.forEach((product) => {
      const card = templateCard.cloneNode(true);
      fillCard(card, product);
      elements.grid.appendChild(card);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function onCategoryChange(category) {
    state.filters.category = category;
    resetAndLoad();
  }

  function resetAndLoad() {
    state.page = 1;
    state.hasMore = true;
    state.products = [];
    loadProducts(false);
  }

  function loadProducts(append = true) {
    const elements = getHomeElements();
    ensureTemplates(elements);
    if (!elements.grid || state.isLoading || !state.hasMore) return;

    state.isLoading = true;

    post('rop_list_products', {
      page: state.page,
      per_page: state.perPage,
      category: state.filters.category,
      q: state.filters.q,
      orderby: state.filters.orderby,
      on_sale: state.filters.on_sale,
      price_tier: state.filters.price_tier
    })
      .then((res) => {
        if (!res || !res.success || !res.data) return;
        const incoming = res.data.products || [];
        state.hasMore = !!res.data.has_more;
        state.products = append ? state.products.concat(incoming) : incoming;
        renderProducts(elements, incoming, append);
      })
      .finally(() => {
        state.isLoading = false;
      });
  }

  function fetchCategories() {
    const elements = getHomeElements();
    ensureTemplates(elements);

    post('rop_list_categories', {})
      .then((res) => {
        if (!res || !res.success || !res.data) return;
        state.categories = res.data.categories || [];
        renderCategoryChips(elements);
      });
  }

  function ensureSuggestionBox(input) {
    const parent = input.parentElement;
    if (!parent) return null;

    let box = parent.querySelector('.rop-suggestions');
    if (!box) {
      box = document.createElement('div');
      box.className = 'rop-suggestions absolute left-0 right-0 z-20 mt-1 rounded-lg border bg-white shadow';
      box.style.display = 'none';
      parent.style.position = 'relative';
      parent.appendChild(box);
    }

    return box;
  }

  function renderSuggestions(input, suggestions) {
    const box = ensureSuggestionBox(input);
    if (!box) return;

    if (!suggestions.length) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    box.innerHTML = '';
    suggestions.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'block w-full px-3 py-2 text-left text-sm hover:bg-gray-100';
      btn.textContent = item.name;
      btn.addEventListener('click', () => {
        input.value = item.name;
        state.filters.q = item.name;
        box.style.display = 'none';
        resetAndLoad();
      });
      box.appendChild(btn);
    });
    box.style.display = 'block';
  }

  function bindSearch(elements) {
    if (!elements.searchInput) return;

    elements.searchInput.addEventListener('input', (e) => {
      const value = (e.target.value || '').trim();

      clearTimeout(suggestDebounce);
      suggestDebounce = setTimeout(() => {
        if (value.length < 2) {
          renderSuggestions(elements.searchInput, []);
          return;
        }

        post('rop_search_suggestions', { q: value }).then((res) => {
          const suggestions = res && res.success && res.data ? res.data.suggestions || [] : [];
          renderSuggestions(elements.searchInput, suggestions);
        });
      }, 300);

      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.filters.q = value;
        resetAndLoad();
      }, 300);
    });

    elements.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.filters.q = (e.target.value || '').trim();
        resetAndLoad();
      }
    });
  }

  function bindInfiniteScroll() {
    window.addEventListener('scroll', () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
      if (nearBottom && !state.isLoading && state.hasMore) {
        state.page += 1;
        loadProducts(true);
      }
    });
  }

  function bindFilterModal(elements) {
    if (!elements.filterModal) return;

    const chipGroups = Array.from(elements.filterModal.querySelectorAll('div'));

    chipGroups.forEach((group) => {
      const text = (group.textContent || '').toLowerCase();
      if (text.includes('ordenar')) {
        Array.from(group.querySelectorAll('button')).forEach((btn, idx) => {
          const mapping = ['recommended', 'rating', 'price_asc', 'price_desc', 'newest'];
          btn.addEventListener('click', () => {
            state.filters.orderby = mapping[idx] || 'recommended';
          });
        });
      }

      if (text.includes('categori')) {
        Array.from(group.querySelectorAll('button')).forEach((btn) => {
          btn.addEventListener('click', () => {
            const value = (btn.dataset.slug || btn.textContent || '').trim();
            state.filters.category = /tudo/i.test(value) ? '' : value.toLowerCase();
          });
        });
      }

      if (text.includes('preço') || text.includes('preco')) {
        Array.from(group.querySelectorAll('button')).forEach((btn) => {
          btn.addEventListener('click', () => {
            const value = (btn.textContent || '').trim();
            state.filters.price_tier = ['$','$$','$$$'].includes(value) ? value : '';
          });
        });
      }
    });

    const onSaleToggle = Array.from(elements.filterModal.querySelectorAll('input[type="checkbox"],button')).find((el) => /promo|sale|oferta/i.test((el.textContent || '').toLowerCase()));
    if (onSaleToggle) {
      onSaleToggle.addEventListener('click', () => {
        state.filters.on_sale = state.filters.on_sale ? 0 : 1;
      });
    }

    if (elements.applyFiltersButton) {
      elements.applyFiltersButton.addEventListener('click', () => {
        if (typeof window.toggleModal === 'function') {
          window.toggleModal('filter-modal');
        }
        resetAndLoad();
      });
    }
  }

  function onAddProduct(product, button) {
    if (!product.is_simple) {
      if (typeof window.navigateTo === 'function') {
        window.navigateTo('product-screen');
      }
      return;
    }

    post('rop_add_to_cart_simple', { product_id: product.id, qty: 1 }).then((res) => {
      if (!res || !res.success) return;

      const previous = button.innerHTML;
      button.innerHTML = '✓';
      button.classList.add('bg-green-500');
      setTimeout(() => {
        button.innerHTML = previous;
        button.classList.remove('bg-green-500');
      }, 800);

      if (typeof window.updateCartCount === 'function') {
        window.updateCartCount(res.data.cart_count || 0);
      }
    });
  }

  function initHomeRealData() {
    const elements = getHomeElements();
    if (!elements.home) return;

    ensureTemplates(elements);
    bindSearch(elements);
    bindFilterModal(elements);
    bindInfiniteScroll();

    fetchCategories();
    resetAndLoad();
  }

  document.addEventListener('DOMContentLoaded', initHomeRealData);
})();
