(function () {
    async function ropFetch(action, data = {}) {
        if (!window.ropAjax || !window.ropAjax.url || !window.ropAjax.nonce) {
            throw new Error('ropAjax config ausente');
        }

        const body = new URLSearchParams({
            action,
            nonce: window.ropAjax.nonce,
            ...data,
        });

        const response = await fetch(window.ropAjax.url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body,
        });

        return response.json();
    }

    function applyStoreVars(appRoot, store) {
        appRoot.style.setProperty('--rop-primary', store.primary_color || '#EF4444');
        appRoot.style.setProperty('--rop-secondary', store.secondary_color || '#FFFFFF');
        appRoot.style.setProperty('--rop-dark', store.dark_color || '#2D2929');
    }

    function updateHomeTexts(appRoot, store) {
        const homeScreen = appRoot.querySelector('#home-screen');

        if (!homeScreen) {
            return;
        }

        const nameEl = homeScreen.querySelector('h1.logo-font');
        if (nameEl && store.store_name) {
            nameEl.textContent = store.store_name;
        }

        const sloganEl = homeScreen.querySelector('p.text-gray-400.text-xs');
        if (sloganEl && store.slogan) {
            sloganEl.textContent = store.slogan;
        }
    }

    function updateInfoTexts(appRoot, store) {
        const infoScreen = appRoot.querySelector('#info-screen');

        if (!infoScreen) {
            return;
        }

        const brandBadge = infoScreen.querySelector('.logo-font');
        if (brandBadge && store.store_name) {
            brandBadge.textContent = store.store_name;
        }

        const title = infoScreen.querySelector('h3.text-2xl.font-bold.text-gray-800');
        if (title && store.store_name) {
            title.textContent = store.store_name;
        }

        const slogan = infoScreen.querySelector('p.text-gray-400.text-sm');
        if (slogan && store.slogan) {
            slogan.textContent = store.slogan;
        }

        const addressLabel = Array.from(infoScreen.querySelectorAll('h4')).find((el) =>
            el.textContent.trim() === 'Endereço'
        );

        if (addressLabel && store.address) {
            const addressEl = addressLabel.parentElement ? addressLabel.parentElement.querySelector('p') : null;
            if (addressEl) {
                addressEl.textContent = store.address;
            }
        }

        const phoneLabel = Array.from(infoScreen.querySelectorAll('h4')).find((el) =>
            el.textContent.trim() === 'Telefone'
        );

        if (phoneLabel && store.phone) {
            const phoneEl = phoneLabel.parentElement ? phoneLabel.parentElement.querySelector('p') : null;
            if (phoneEl) {
                phoneEl.textContent = store.phone;
            }
        }
    }

    function openClosedModalFallback() {
        const modal = document.getElementById('store-closed-modal');

        if (!modal) {
            return;
        }

        modal.classList.remove('hidden');
        setTimeout(function () {
            modal.classList.add('modal-active');
        }, 10);
    }

    function updateClosedModalText(humanStatus) {
        const modal = document.getElementById('store-closed-modal');

        if (!modal) {
            return;
        }

        const paragraph = modal.querySelector('p');

        if (!paragraph) {
            return;
        }

        const fallbackText = 'Estamos fechados no momento. Navegue pelo cardápio!';
        paragraph.textContent = humanStatus ? fallbackText + ' ' + humanStatus : fallbackText;
    }

    document.addEventListener('DOMContentLoaded', async function () {
        const appRoot = document.querySelector('.rop-app[data-rop-app="1"]');

        if (!appRoot || !window.ropAjax) {
            return;
        }

        try {
            const settingsResponse = await ropFetch('rop_get_store_settings');

            if (settingsResponse && settingsResponse.success && settingsResponse.data && settingsResponse.data.store) {
                const store = settingsResponse.data.store;
                applyStoreVars(appRoot, store);
                updateHomeTexts(appRoot, store);
                updateInfoTexts(appRoot, store);
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
    });
})();
