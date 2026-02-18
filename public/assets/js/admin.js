(function () {
    function parseInitial(root) {
        try {
            return JSON.parse(root.dataset.initial || '[]');
        } catch (e) {
            return [];
        }
    }

    function esc(text) {
        return String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function groupTemplate(group) {
        const data = group || { title: '', type: 'checkbox', min: 0, max: 1, options: [{ label: '', price: '0.00' }] };
        const options = Array.isArray(data.options) && data.options.length ? data.options : [{ label: '', price: '0.00' }];

        return '<div class="rop-preset-group">'
            + '<p><strong>Grupo</strong> <button type="button" class="button-link-delete rop-remove-group">Remover</button></p>'
            + '<p><input type="text" class="widefat rop-group-title" placeholder="Título do grupo" value="' + esc(data.title) + '"></p>'
            + '<p>'
            + '<label>Tipo <select class="rop-group-type"><option value="checkbox"' + (data.type === 'checkbox' ? ' selected' : '') + '>Checkbox</option><option value="radio"' + (data.type === 'radio' ? ' selected' : '') + '>Radio</option><option value="select"' + (data.type === 'select' ? ' selected' : '') + '>Select</option></select></label> '
            + '<label>Min <input type="number" class="small-text rop-group-min" min="0" value="' + Number(data.min || 0) + '"></label> '
            + '<label>Max <input type="number" class="small-text rop-group-max" min="0" value="' + Number(data.max || 0) + '"></label>'
            + '</p>'
            + '<div class="rop-options-list">'
            + options.map(function (option) {
                return '<div class="rop-option-row"><input type="text" class="rop-option-label" placeholder="Opção" value="' + esc(option.label) + '"><input type="number" class="rop-option-price" step="0.01" min="0" value="' + esc(option.price) + '"><button type="button" class="button rop-remove-option">-</button></div>';
            }).join('')
            + '</div>'
            + '<p><button type="button" class="button rop-add-option">Adicionar opção</button></p>'
            + '</div>';
    }

    function readGroups(editor) {
        const groups = [];
        editor.querySelectorAll('.rop-preset-group').forEach(function (groupEl) {
            const title = (groupEl.querySelector('.rop-group-title') || {}).value || '';
            const type = (groupEl.querySelector('.rop-group-type') || {}).value || 'checkbox';
            const min = parseInt((groupEl.querySelector('.rop-group-min') || {}).value || '0', 10) || 0;
            const max = parseInt((groupEl.querySelector('.rop-group-max') || {}).value || '0', 10) || 0;

            const options = [];
            groupEl.querySelectorAll('.rop-option-row').forEach(function (optionEl) {
                const label = ((optionEl.querySelector('.rop-option-label') || {}).value || '').trim();
                const price = (optionEl.querySelector('.rop-option-price') || {}).value || '0.00';
                if (label) options.push({ label: label, price: price });
            });

            if (title.trim() !== '' && options.length) {
                groups.push({ title: title.trim(), type: type, min: min, max: max, options: options });
            }
        });

        return groups;
    }

    function initializeEditor(config) {
        const form = document.getElementById(config.formId);
        const editor = document.getElementById(config.editorId);
        const addGroup = document.getElementById(config.addButtonId);
        const output = document.getElementById(config.outputId);

        if (!form || !editor || !addGroup || !output) {
            return;
        }

        const initial = parseInitial(editor);
        if (initial.length) {
            initial.forEach(function (group) {
                editor.insertAdjacentHTML('beforeend', groupTemplate(group));
            });
        } else {
            editor.insertAdjacentHTML('beforeend', groupTemplate());
        }

        addGroup.addEventListener('click', function () {
            editor.insertAdjacentHTML('beforeend', groupTemplate());
        });

        editor.addEventListener('click', function (event) {
            const addOption = event.target.closest('.rop-add-option');
            if (addOption) {
                const list = addOption.closest('.rop-preset-group').querySelector('.rop-options-list');
                list.insertAdjacentHTML('beforeend', '<div class="rop-option-row"><input type="text" class="rop-option-label" placeholder="Opção"><input type="number" class="rop-option-price" step="0.01" min="0" value="0.00"><button type="button" class="button rop-remove-option">-</button></div>');
                return;
            }

            const removeOption = event.target.closest('.rop-remove-option');
            if (removeOption) {
                removeOption.closest('.rop-option-row').remove();
                return;
            }

            const removeGroup = event.target.closest('.rop-remove-group');
            if (removeGroup) {
                removeGroup.closest('.rop-preset-group').remove();
            }
        });

        form.addEventListener('submit', function () {
            output.value = JSON.stringify(readGroups(editor));
        });
    }

    function initMediaPicker() {
        if (!window.wp || !window.wp.media) return;
        document.querySelectorAll('[data-rop-media-pick]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var target = btn.getAttribute('data-rop-media-pick');
                var input = document.getElementById(target);
                if (!input) return;

                var frame = wp.media({ title: 'Selecionar logo', multiple: false, library: { type: 'image' } });
                frame.on('select', function () {
                    var item = frame.state().get('selection').first();
                    if (!item) return;
                    var json = item.toJSON();
                    input.value = json.id || '';
                    var preview = btn.parentElement.querySelector('.rop-logo-preview');
                    if (preview) {
                        preview.innerHTML = json.url ? ('<img src="' + json.url + '" alt="logo"/>') : '';
                    }
                });
                frame.open();
            });
        });

        document.querySelectorAll('[data-rop-media-clear]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var target = btn.getAttribute('data-rop-media-clear');
                var input = document.getElementById(target);
                if (input) input.value = '';
                var preview = btn.parentElement.querySelector('.rop-logo-preview');
                if (preview) preview.innerHTML = '';
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initializeEditor({
            formId: 'rop-preset-form',
            editorId: 'rop-preset-editor',
            addButtonId: 'rop-add-group',
            outputId: 'preset_groups_json',
        });

        initializeEditor({
            formId: 'post',
            editorId: 'rop-product-extras-editor',
            addButtonId: 'rop-product-add-group',
            outputId: 'rop_product_extras_schema_json',
        });

        initMediaPicker();
    });
})();
