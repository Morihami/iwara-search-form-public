// Iwara検索式ジェネレーター - メインスクリプト

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('searchForm');
    const resetBtn = document.getElementById('resetBtn') ?? document.getElementById('resetBtnInline');
    const copyBtn = document.getElementById('copyBtn');
    const searchBtn = document.getElementById('searchBtn');
    const searchExpression = document.getElementById('searchExpression');
    const copyMessage = document.getElementById('copyMessage');
    const exampleButtons = document.querySelectorAll('.example-fill');
    const tagPickerBtn = document.getElementById('tagPickerBtn');
    const tagAddBtn = document.getElementById('tagAddBtn');
    const tagInput = document.getElementById('tagInput');
    const tagInputNot = document.getElementById('tagInputNot');
    const tagDialog = document.getElementById('tagDialog');
    const tagDialogList = document.getElementById('tagDialogList');
    const tagDialogEmpty = document.getElementById('tagDialogEmpty');
    const tagDialogPage = document.getElementById('tagDialogPage');
    const tagDialogPrev = document.getElementById('tagDialogPrev');
    const tagDialogNext = document.getElementById('tagDialogNext');
    const tagDialogPagerNumbers = document.getElementById('tagDialogPagerNumbers');
    const tagDialogSearch = document.getElementById('tagDialogSearch');
    const tagChips = document.getElementById('tagChips');
    const tagChipsNot = document.getElementById('tagChipsNot');
    const tagAddBtnNot = document.getElementById('tagAddBtnNot');
    const savedList = document.getElementById('savedList');
    const savedEmpty = document.getElementById('savedEmpty');
    const savedClearBtn = document.getElementById('savedClearBtn');
    const savedName = document.getElementById('savedName');
    const savedAddBtn = document.getElementById('savedAddBtn');
    const tagDialogFrequent = document.getElementById('tagDialogFrequent');
    const tagDialogCloseButtons = tagDialog ? tagDialog.querySelectorAll('[data-close="true"]') : [];
    const STORAGE_KEY = 'iwara-search-form-state-v1';
    const TAG_USAGE_KEY = 'iwara-search-form-tag-usage-v1';
    const SAVED_KEY = 'iwara-search-form-saved-v1';
    const TAG_PAGE_SIZE = 45;
    const SAVED_LIMIT = 20;
    let tagPage = 0;
    let tagLoading = false;
    let tagAll = null;
    let tagSensitiveMap = new Map();
    let tagSearchQuery = '';
    let selectedTags = [];
    let selectedTagsNot = [];
    let tagTargetMode = 'include';
    let tagPendingPage = null;
    let tagUsage = loadTagUsage();
    let savedItems = loadSavedItems();

    // リアルタイムプレビュー用のイベントリスナー
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('input', generateSearchExpression);
        input.addEventListener('change', generateSearchExpression);
    });

    restoreFormState();
    syncSelectedTagsFromInput();
    syncSelectedTagsNotFromInput();
    renderTagChips();
    renderTagChipsNot();
    renderSavedItems();
    generateSearchExpression();

    // リセットボタンのクリックイベント
    resetBtn.addEventListener('click', function(e) {
        e.preventDefault();
        form.reset();
        clearStoredState();
        searchExpression.textContent = 'ここに検索式が表示されます';
        copyBtn.disabled = true;
        hideCopyMessage();
    });

    // コピーボタンのクリックイベント
    copyBtn.addEventListener('click', function() {
        const expression = searchExpression.textContent;
        if (expression && expression !== 'ここに検索式が表示されます') {
            copyToClipboard(expression);
        }
    });

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const expression = searchExpression.textContent;
            if (!expression || expression === 'ここに検索式が表示されます') {
                return;
            }
            const url = `https://www.iwara.tv/search?type=videos&page=0&query=${encodeURIComponent(expression)}`;
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            link.remove();
        });
    }

    if (savedAddBtn) {
        savedAddBtn.addEventListener('click', () => {
            saveCurrentState();
        });
    }

    if (savedName) {
        savedName.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                saveCurrentState();
            }
        });
    }

    if (savedClearBtn) {
        savedClearBtn.addEventListener('click', () => {
            savedItems = [];
            saveSavedItems();
            renderSavedItems();
        });
    }

    if (savedList) {
        savedList.addEventListener('click', (event) => {
            const target = event.target;
            if (!target || !target.dataset) {
                return;
            }
            const itemId = target.dataset.savedId;
            if (!itemId) {
                return;
            }
            const item = savedItems.find(entry => entry.id === itemId);
            if (!item) {
                return;
            }
            applySavedState(item);
        });
    }

    // 使用例ボタンのクリックイベント
    exampleButtons.forEach(button => {
        button.addEventListener('click', () => {
            applyExampleValues(button.dataset);
            generateSearchExpression();
            const firstField = form.querySelector('input, select');
            if (firstField) {
                firstField.focus();
            }
        });
    });

    setupTagPicker();
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target && target.id === 'tagAddBtn') {
            event.preventDefault();
            openTagDialog('include');
        }
        if (target && target.id === 'tagAddBtnNot') {
            event.preventDefault();
            openTagDialog('exclude');
        }
    });

    /**
     * 検索式を生成する
     */
    function generateSearchExpression() {
        const formData = {
            localeMode: (form.querySelector('input[name="localeMode"]:checked')?.value) ?? '',
            titleFilter: document.getElementById('titleFilter').value.trim(),
            detailFilter: document.getElementById('detailFilter').value.trim(),
            users: document.getElementById('users').value.trim(),
            userMode: (form.querySelector('input[name="userMode"]:checked')?.value) ?? 'include',
            rating: (form.querySelector('input[name="ratingMode"]:checked')?.value) ?? '',
            durationMin: document.getElementById('durationMin').value.trim(),
            durationMax: document.getElementById('durationMax').value.trim(),
            likesMin: document.getElementById('likesMin').value.trim(),
            likesMax: document.getElementById('likesMax').value.trim(),
            viewsMin: document.getElementById('viewsMin').value.trim(),
            viewsMax: document.getElementById('viewsMax').value.trim(),
            commentsMin: document.getElementById('commentsMin').value.trim(),
            commentsMax: document.getElementById('commentsMax').value.trim(),
            tags: document.getElementById('tags').value.trim(),
            tagsMode: (form.querySelector('input[name="tagsMode"]:checked')?.value) ?? 'and',
            tagsNot: document.getElementById('tagsNot').value.trim(),
            dateMin: document.getElementById('dateMin').value.trim(),
            dateMax: document.getElementById('dateMax').value.trim()
        };

        const parts = [];

        // タイトル・詳細
        const localeSuffix = getLocaleSuffix(formData.localeMode);
        if (localeSuffix) {
            addTextFilter(parts, `title${localeSuffix}`, formData.titleFilter);
            addTextFilter(parts, `body${localeSuffix}`, formData.detailFilter);
        } else {
            addKeywordQuery(parts, formData.titleFilter);
            addKeywordQuery(parts, formData.detailFilter);
        }

        // タグ（すべて / いずれか）
        if (formData.tags) {
            const tags = parseCommaSeparated(formData.tags);
            if (tags.length > 0) {
                if (formData.tagsMode === 'and') {
                    tags.forEach(tag => {
                        parts.push(`{tags: ${formatList([tag])}}`);
                    });
                } else {
                    parts.push(`{tags: ${formatList(tags)}}`);
                }
            }
        }

        // タグ（NOT条件）
        if (formData.tagsNot) {
            const tags = parseCommaSeparated(formData.tagsNot);
            tags.forEach(tag => {
                parts.push(`{tags: !${formatList([tag])}}`);
            });
        }

        // ユーザー（絞り込み/除外）
        if (formData.users) {
            const users = parseCommaSeparated(formData.users);
            if (users.length > 0) {
                const prefix = formData.userMode === 'exclude' ? '!' : '';
                parts.push(`{author: ${prefix}${formatList(users)}}`);
            }
        }

        // レーティング
        if (formData.rating) {
            parts.push(`{rating=${formData.rating}}`);
        }

        // 長さ
        addRangeFilter(parts, 'duration', formData.durationMin, formData.durationMax);

        // Likes / Views / Comments
        addRangeFilter(parts, 'likes', formData.likesMin, formData.likesMax);
        addRangeFilter(parts, 'views', formData.viewsMin, formData.viewsMax);
        addRangeFilter(parts, 'comments', formData.commentsMin, formData.commentsMax);

        // 更新日
        const dateMinUnix = dateToUnixStart(formData.dateMin);
        const dateMaxUnix = dateToUnixEnd(formData.dateMax);
        addRangeFilter(
            parts,
            'date',
            dateMinUnix ? String(dateMinUnix) : '',
            dateMaxUnix ? String(dateMaxUnix) : ''
        );

        // 結果を表示
        if (parts.length > 0) {
            const expression = parts.join(' ');
            searchExpression.textContent = expression;
            copyBtn.disabled = false;
            if (searchBtn) {
                searchBtn.disabled = false;
            }
        } else {
            searchExpression.textContent = 'ここに検索式が表示されます';
            copyBtn.disabled = true;
            if (searchBtn) {
                searchBtn.disabled = true;
            }
        }

        hideCopyMessage();
        saveFormState();
    }

    /**
     * 使用例からフォーム値をセット
     * @param {DOMStringMap} dataset - data-* 属性の集合
     */
    function applyExampleValues(dataset) {
        const fieldIds = {
            titleFilter: 'titleFilter',
            detailFilter: 'detailFilter',
            users: 'users',
            durationMin: 'durationMin',
            durationMax: 'durationMax',
            likesMin: 'likesMin',
            likesMax: 'likesMax',
            viewsMin: 'viewsMin',
            viewsMax: 'viewsMax',
            commentsMin: 'commentsMin',
            commentsMax: 'commentsMax',
            tags: 'tags',
            tagsNot: 'tagsNot',
            dateMin: 'dateMin',
            dateMax: 'dateMax'
        };

        Object.entries(fieldIds).forEach(([key, id]) => {
            const value = dataset[key] ?? '';
            const field = document.getElementById(id);
            if (field) {
                field.value = value;
            }
        });

        if (dataset.userMode) {
            const target = form.querySelector(`input[name="userMode"][value="${dataset.userMode}"]`);
            if (target) {
                target.checked = true;
            }
        }
        if (dataset.ratingMode !== undefined) {
            const ratingTarget = form.querySelector(`input[name="ratingMode"][value="${dataset.ratingMode}"]`);
            if (ratingTarget) {
                ratingTarget.checked = true;
            }
        }
        if (dataset.tagsMode) {
            const tagsTarget = form.querySelector(`input[name="tagsMode"][value="${dataset.tagsMode}"]`);
            if (tagsTarget) {
                tagsTarget.checked = true;
            }
        }
        if (dataset.localeMode) {
            const localeTarget = form.querySelector(`input[name="localeMode"][value="${dataset.localeMode}"]`);
            if (localeTarget) {
                localeTarget.checked = true;
            }
        }
    }

    /**
     * カンマ区切りの文字列をパースして配列に変換
     * @param {string} str - カンマ区切りの文字列
     * @returns {Array<string>} - トリミングされた文字列の配列
     */
    function parseCommaSeparated(str) {
        return str.split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0);
    }

    /**
     * フィルター用の配列リテラルを生成（例: [a, b]）
     * @param {Array<string>} items
     * @returns {string}
     */
    function formatList(items) {
        const normalized = items
            .map(item => item.trim())
            .filter(item => item.length > 0);
        return `[${normalized.join(', ')}]`;
    }

    /**
     * テキストフィルターを生成して追加
     * @param {Array<string>} parts
     * @param {string} field
     * @param {string} value
     */
    function addTextFilter(parts, field, value) {
        if (!value) {
            return;
        }
        const terms = parseCommaSeparated(value);
        if (terms.length === 0) {
            return;
        }
        terms.forEach(term => {
            parts.push(`{${field}: ${escapeSearchTerm(term)}}`);
        });
    }

    function addKeywordQuery(parts, value) {
        if (!value) {
            return;
        }
        const terms = parseCommaSeparated(value);
        if (terms.length === 0) {
            return;
        }
        terms.forEach(term => {
            parts.push(escapeSearchTerm(term));
        });
    }

    function getLocaleSuffix(locale) {
        switch (locale) {
            case 'en':
                return '_en';
            case 'zh':
                return '_zh';
            case 'ja':
                return '_ja';
            default:
                return '';
        }
    }

    /**
     * 日付入力（YYYY-MM-DD）をUNIX秒へ（開始）
     * @param {string} value
     * @returns {number|null}
     */
    function dateToUnixStart(value) {
        if (!value) {
            return null;
        }
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return Math.floor(date.getTime() / 1000);
    }

    /**
     * 日付入力（YYYY-MM-DD）をUNIX秒へ（終了）
     * @param {string} value
     * @returns {number|null}
     */
    function dateToUnixEnd(value) {
        if (!value) {
            return null;
        }
        const date = new Date(`${value}T23:59:59`);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return Math.floor(date.getTime() / 1000);
    }

    /**
     * 範囲フィルターを生成して追加
     * @param {Array<string>} parts
     * @param {string} field
     * @param {string} min
     * @param {string} max
     */
    function addRangeFilter(parts, field, min, max) {
        if (min && max) {
            parts.push(`{${field}: [${min}..${max}]}`);
            return;
        }
        if (min) {
            parts.push(`{${field}>=${min}}`);
            return;
        }
        if (max) {
            parts.push(`{${field}<=${max}}`);
        }
    }

    /**
     * 日付ピッカーのショートカットボタン
     */
    function setupTagPicker() {
        if (tagPickerBtn && tagDialog) {
            tagPickerBtn.addEventListener('click', () => {
                openTagDialog('include');
            });
        }

        if (tagAddBtn) {
            tagAddBtn.addEventListener('click', () => {
                openTagDialog('include');
            });
        }

        if (tagAddBtnNot) {
            tagAddBtnNot.addEventListener('click', () => {
                openTagDialog('exclude');
            });
        }

        if (tagInput) {
            tagInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    addTagsFromInput();
                }
            });
        }

        if (!tagDialog) {
            return;
        }

        tagDialogCloseButtons.forEach(button => {
            button.addEventListener('click', () => {
                closeTagDialog();
            });
        });

        if (tagDialogPrev) {
            tagDialogPrev.addEventListener('click', () => {
                if (tagPage > 0) {
                    loadTags(tagPage - 1);
                }
            });
        }

        if (tagDialogNext) {
            tagDialogNext.addEventListener('click', () => {
                loadTags(tagPage + 1);
            });
        }

        if (tagDialogSearch) {
            tagDialogSearch.addEventListener('input', () => {
                tagSearchQuery = tagDialogSearch.value.trim().toLowerCase();
                loadTags(0);
            });
            tagDialogSearch.addEventListener('change', () => {
                tagSearchQuery = tagDialogSearch.value.trim().toLowerCase();
                loadTags(0);
            });
            tagDialogSearch.addEventListener('keyup', () => {
                tagSearchQuery = tagDialogSearch.value.trim().toLowerCase();
                loadTags(0);
            });
        }

    }

    function openTagDialog(targetMode) {
        if (!tagDialog) {
            return;
        }
        tagTargetMode = targetMode === 'exclude' ? 'exclude' : 'include';
        tagDialog.dataset.target = tagTargetMode;
        tagDialog.classList.remove('hidden');
        syncSelectedTagsFromInput();
        syncSelectedTagsNotFromInput();
        renderTagChips();
        renderTagChipsNot();
        renderFrequentTags();
        loadTags(0);
    }

    function closeTagDialog() {
        if (!tagDialog) {
            return;
        }
        tagDialog.classList.add('hidden');
    }

    function loadTags(page) {
        if (tagLoading) {
            tagPendingPage = page;
            return;
        }
        if (tagDialogSearch) {
            tagSearchQuery = tagDialogSearch.value.trim().toLowerCase();
        }
        tagLoading = true;
        tagPage = page;
        if (tagDialogList) {
            tagDialogList.innerHTML = '';
        }
        if (tagDialogEmpty) {
            tagDialogEmpty.textContent = '読み込み中...';
        }
        loadAllTags()
            .then(tags => {
                const filtered = filterTags(tags, tagSearchQuery);
                const totalPages = Math.max(1, Math.ceil(filtered.length / TAG_PAGE_SIZE));
                const safePage = Math.min(Math.max(page, 0), totalPages - 1);
                tagPage = safePage;
                const start = safePage * TAG_PAGE_SIZE;
                const pageTags = filtered.slice(start, start + TAG_PAGE_SIZE);
                renderTagList(pageTags);
                if (tagDialogEmpty) {
                    tagDialogEmpty.textContent = pageTags.length === 0 ? 'タグがありません' : '';
                }
                if (tagDialogPage) {
                    tagDialogPage.textContent = `${safePage + 1}/${totalPages}`;
                }
                if (tagDialogPrev) {
                    tagDialogPrev.disabled = safePage === 0;
                }
                if (tagDialogNext) {
                    tagDialogNext.disabled = safePage >= totalPages - 1;
                }
                renderTagPager(totalPages, safePage);
            })
            .catch(() => {
                if (tagDialogEmpty) {
                    tagDialogEmpty.textContent = '読み込みに失敗しました';
                }
            })
            .finally(() => {
                tagLoading = false;
                if (tagPendingPage !== null) {
                    const nextPage = tagPendingPage;
                    tagPendingPage = null;
                    loadTags(nextPage);
                }
            });
    }

    function loadAllTags() {
        if (Array.isArray(tagAll)) {
            return Promise.resolve(tagAll);
        }
        return fetch('tags_all.json')
            .then(response => response.ok ? response.json() : Promise.reject(new Error('fetch failed')))
            .then(payload => {
                const tags = extractTags(payload);
                tagAll = tags;
                buildTagSensitiveMap(tags);
                renderTagChips();
                renderTagChipsNot();
                return tags;
            });
    }

    function filterTags(tags, query) {
        if (!query) {
            return tags;
        }
        return tags
            .filter(tag => getTagLabel(tag).toLowerCase().includes(query))
            .sort((a, b) => {
                const labelA = getTagLabel(a).toLowerCase();
                const labelB = getTagLabel(b).toLowerCase();
                return labelA.localeCompare(labelB);
            });
    }

    function renderTagPager(totalPages, currentPage) {
        if (!tagDialogPagerNumbers) {
            return;
        }
        tagDialogPagerNumbers.innerHTML = '';
        const maxButtons = 7;
        const start = Math.max(0, currentPage - Math.floor(maxButtons / 2));
        const end = Math.min(totalPages, start + maxButtons);
        const adjustedStart = Math.max(0, end - maxButtons);
        for (let i = adjustedStart; i < end; i++) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tag-page-btn';
            button.textContent = String(i + 1);
            if (i === currentPage) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => {
                loadTags(i);
            });
            tagDialogPagerNumbers.appendChild(button);
        }
    }

    function extractTags(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }
        if (payload && Array.isArray(payload.results)) {
            return payload.results;
        }
        if (payload && Array.isArray(payload.data)) {
            return payload.data;
        }
        if (payload && Array.isArray(payload.items)) {
            return payload.items;
        }
        return [];
    }

    function renderTagList(tags) {
        if (!tagDialogList) {
            return;
        }
        tagDialogList.innerHTML = '';
        tags.forEach(tag => {
            const label = getTagLabel(tag);
            if (!label) {
                return;
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tag-link';
            button.textContent = label;
            if (isTagSelected(label)) {
                button.classList.add('selected');
            }
            if (isSensitiveTag(label)) {
                button.classList.add('tag-sensitive');
            }
            button.addEventListener('click', () => {
                appendTagForTarget(label);
            });
            tagDialogList.appendChild(button);
        });
    }

    function getTagLabel(tag) {
        if (!tag) {
            return '';
        }
        if (typeof tag === 'string') {
            return tag;
        }
        return tag.name || tag.tag || tag.slug || tag.id || '';
    }

    function appendTag(tagName) {
        appendTagWithOptions(tagName, { closeDialog: true });
    }

    function appendTagWithOptions(tagName, options) {
        const input = document.getElementById('tags');
        if (!input) {
            return;
        }
        if (!selectedTags.includes(tagName)) {
            selectedTags.push(tagName);
        }
        incrementTagUsage(tagName);
        input.value = selectedTags.join(', ');
        generateSearchExpression();
        renderTagChips();
        renderFrequentTags();
        loadTags(tagPage);
        if (options && options.closeDialog) {
            closeTagDialog();
        }
    }

    function appendTagForTarget(tagName) {
        const currentTarget = tagDialog?.dataset.target || tagTargetMode;
        if (currentTarget === 'exclude') {
            appendTagNotWithOptions(tagName, { closeDialog: true });
            return;
        }
        appendTagWithOptions(tagName, { closeDialog: true });
    }

    function appendTagNotWithOptions(tagName, options) {
        const input = document.getElementById('tagsNot');
        if (!input) {
            return;
        }
        if (!selectedTagsNot.includes(tagName)) {
            selectedTagsNot.push(tagName);
        }
        incrementTagUsage(tagName);
        input.value = selectedTagsNot.join(', ');
        generateSearchExpression();
        renderTagChipsNot();
        renderFrequentTags();
        loadTags(tagPage);
        if (options && options.closeDialog) {
            closeTagDialog();
        }
    }

    function addTagsFromInput() {
        if (!tagInput) {
            return;
        }
        syncSelectedTagsFromInput();
        const raw = tagInput.value.trim();
        if (!raw) {
            return;
        }
        const tagsToAdd = parseCommaSeparated(raw);
        tagsToAdd.forEach(tag => {
            appendTagWithOptions(tag, { closeDialog: false });
        });
        tagInput.value = '';
        renderTagChips();
        tagInput.focus();
    }

    function removeTag(tagName) {
        selectedTags = selectedTags.filter(tag => tag !== tagName);
        const input = document.getElementById('tags');
        if (input) {
            input.value = selectedTags.join(', ');
        }
        generateSearchExpression();
        renderTagChips();
        loadTags(tagPage);
    }

    function removeTagNot(tagName) {
        selectedTagsNot = selectedTagsNot.filter(tag => tag !== tagName);
        const input = document.getElementById('tagsNot');
        if (input) {
            input.value = selectedTagsNot.join(', ');
        }
        generateSearchExpression();
        renderTagChipsNot();
        loadTags(tagPage);
    }

    function syncSelectedTagsFromInput() {
        const input = document.getElementById('tags');
        if (!input) {
            selectedTags = [];
            return;
        }
        selectedTags = parseCommaSeparated(input.value);
    }

    function syncSelectedTagsNotFromInput() {
        const input = document.getElementById('tagsNot');
        if (!input) {
            selectedTagsNot = [];
            return;
        }
        selectedTagsNot = parseCommaSeparated(input.value);
    }

    function renderTagChips() {
        if (!tagChips) {
            return;
        }
        tagChips.innerHTML = '';
        if (selectedTags.length === 0) {
            tagChips.textContent = '（なし）';
            return;
        }
        selectedTags.forEach(tag => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'tag-chip';
            chip.textContent = tag;
            if (isSensitiveTag(tag)) {
                chip.classList.add('tag-sensitive');
            }
            chip.addEventListener('click', () => {
                removeTag(tag);
            });
            tagChips.appendChild(chip);
        });
    }

    function renderTagChipsNot() {
        if (!tagChipsNot) {
            return;
        }
        tagChipsNot.innerHTML = '';
        if (selectedTagsNot.length === 0) {
            tagChipsNot.textContent = '（なし）';
            return;
        }
        selectedTagsNot.forEach(tag => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'tag-chip';
            chip.textContent = tag;
            if (isSensitiveTag(tag)) {
                chip.classList.add('tag-sensitive');
            }
            chip.addEventListener('click', () => {
                removeTagNot(tag);
            });
            tagChipsNot.appendChild(chip);
        });
    }

    function isTagSelected(tagName) {
        return selectedTags.includes(tagName) || selectedTagsNot.includes(tagName);
    }

    function buildTagSensitiveMap(tags) {
        tagSensitiveMap = new Map();
        tags.forEach(tag => {
            if (!tag || typeof tag !== 'object') {
                return;
            }
            if (tag.sensitive !== true) {
                return;
            }
            const label = getTagLabel(tag);
            if (label) {
                tagSensitiveMap.set(label, true);
            }
        });
    }

    function isSensitiveTag(tagName) {
        if (!tagName) {
            return false;
        }
        return tagSensitiveMap.get(tagName) === true;
    }

    function renderFrequentTags() {
        if (!tagDialogFrequent) {
            return;
        }
        tagDialogFrequent.innerHTML = '';
        const currentTarget = tagDialog?.dataset.target || tagTargetMode;
        const topTags = Object.entries(tagUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([tag]) => tag);
        if (topTags.length === 0) {
            tagDialogFrequent.textContent = '（まだありません）';
            return;
        }
        topTags.forEach(tag => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tag-frequent';
            button.textContent = tag;
            if (isSensitiveTag(tag)) {
                button.classList.add('tag-sensitive');
            }
            button.addEventListener('click', () => {
                if (currentTarget === 'exclude') {
                    appendTagNotWithOptions(tag, { closeDialog: true });
                    return;
                }
                appendTagWithOptions(tag, { closeDialog: true });
            });
            tagDialogFrequent.appendChild(button);
        });
    }

    function loadTagUsage() {
        try {
            const raw = localStorage.getItem(TAG_USAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            return {};
        }
    }

    function saveTagUsage() {
        try {
            localStorage.setItem(TAG_USAGE_KEY, JSON.stringify(tagUsage));
        } catch (error) {
            // ignore
        }
    }

    function incrementTagUsage(tagName) {
        tagUsage[tagName] = (tagUsage[tagName] ?? 0) + 1;
        saveTagUsage();
    }

    function loadSavedItems() {
        try {
            const raw = localStorage.getItem(SAVED_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function saveSavedItems() {
        try {
            localStorage.setItem(SAVED_KEY, JSON.stringify(savedItems));
        } catch (error) {
            // ignore
        }
    }

    function saveCurrentState() {
        if (!savedName) {
            return;
        }
        const name = savedName.value.trim();
        if (!name) {
            return;
        }
        const state = getFormState();
        const expression = searchExpression.textContent;
        if (!expression || expression === 'ここに検索式が表示されます') {
            return;
        }
        const existingIndex = savedItems.findIndex(item => item.name === name);
        const entry = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name,
            expression,
            state
        };
        if (existingIndex >= 0) {
            savedItems[existingIndex] = entry;
        } else {
            savedItems.unshift(entry);
        }
        if (savedItems.length > SAVED_LIMIT) {
            savedItems = savedItems.slice(0, SAVED_LIMIT);
        }
        saveSavedItems();
        renderSavedItems();
        savedName.value = '';
    }

    function renderSavedItems() {
        if (!savedList || !savedEmpty) {
            return;
        }
        savedList.innerHTML = '';
        if (!savedItems.length) {
            savedEmpty.textContent = '（まだありません）';
            savedEmpty.style.display = 'block';
            return;
        }
        savedEmpty.style.display = 'none';
        savedItems.forEach(item => {
            const row = document.createElement('div');
            row.className = 'saved-item';
            const label = document.createElement('div');
            label.className = 'saved-expression';
            label.textContent = `${item.name}：${item.expression}`;
            const applyButton = document.createElement('button');
            applyButton.type = 'button';
            applyButton.className = 'btn btn-secondary btn-compact saved-apply';
            applyButton.textContent = '適用';
            applyButton.dataset.savedId = item.id;
            row.appendChild(label);
            row.appendChild(applyButton);
            savedList.appendChild(row);
        });
    }

    function applySavedState(item) {
        if (!item || !item.state) {
            return;
        }
        const state = item.state;
        const fieldIds = {
            titleFilter: 'titleFilter',
            detailFilter: 'detailFilter',
            users: 'users',
            durationMin: 'durationMin',
            durationMax: 'durationMax',
            likesMin: 'likesMin',
            likesMax: 'likesMax',
            viewsMin: 'viewsMin',
            viewsMax: 'viewsMax',
            commentsMin: 'commentsMin',
            commentsMax: 'commentsMax',
            tags: 'tags',
            tagsNot: 'tagsNot',
            dateMin: 'dateMin',
            dateMax: 'dateMax'
        };
        Object.entries(fieldIds).forEach(([key, id]) => {
            const field = document.getElementById(id);
            if (field && typeof state[key] === 'string') {
                field.value = state[key];
            }
        });
        setRadioValue('localeMode', state.localeMode ?? '');
        setRadioValue('userMode', state.userMode ?? 'include');
        setRadioValue('ratingMode', state.ratingMode ?? '');
        setRadioValue('tagsMode', state.tagsMode ?? 'and');
        syncSelectedTagsFromInput();
        syncSelectedTagsNotFromInput();
        renderTagChips();
        renderTagChipsNot();
        generateSearchExpression();
    }

    /**
     * 検索語句をエスケープ
     * @param {string} term - エスケープする文字列
     * @returns {string} - エスケープされた文字列
     */
    function escapeSearchTerm(term) {
        // 内部のクォートをエスケープ
        const escaped = term.replace(/"/g, '\\"');
        
        // スペースや特殊文字を含む場合はクォートで囲む
        if (term.includes(' ') || term.includes(':')) {
            return `"${escaped}"`;
        }
        
        return escaped;
    }

    function saveFormState() {
        const state = getFormState();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            // ignore
        }
    }

    function restoreFormState() {
        let state = null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            state = raw ? JSON.parse(raw) : null;
        } catch (error) {
            state = null;
        }
        if (!state) {
            return;
        }

        const fieldIds = {
            titleFilter: 'titleFilter',
            detailFilter: 'detailFilter',
            users: 'users',
            durationMin: 'durationMin',
            durationMax: 'durationMax',
            likesMin: 'likesMin',
            likesMax: 'likesMax',
            viewsMin: 'viewsMin',
            viewsMax: 'viewsMax',
            commentsMin: 'commentsMin',
            commentsMax: 'commentsMax',
            tags: 'tags',
            tagsNot: 'tagsNot',
            dateMin: 'dateMin',
            dateMax: 'dateMax'
        };

        Object.entries(fieldIds).forEach(([key, id]) => {
            const field = document.getElementById(id);
            if (field && typeof state[key] === 'string') {
                field.value = state[key];
            }
        });

        setRadioValue('localeMode', state.localeMode ?? '');
        setRadioValue('userMode', state.userMode ?? 'include');
        setRadioValue('ratingMode', state.ratingMode ?? '');
        setRadioValue('tagsMode', state.tagsMode ?? 'and');
    }

    function clearStoredState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            // ignore
        }
    }

    function setRadioValue(name, value) {
        const target = form.querySelector(`input[name="${name}"][value="${value}"]`);
        if (target) {
            target.checked = true;
        }
    }

    function getFormState() {
        return {
            localeMode: (form.querySelector('input[name="localeMode"]:checked')?.value) ?? '',
            titleFilter: document.getElementById('titleFilter').value.trim(),
            detailFilter: document.getElementById('detailFilter').value.trim(),
            users: document.getElementById('users').value.trim(),
            userMode: (form.querySelector('input[name="userMode"]:checked')?.value) ?? 'include',
            ratingMode: (form.querySelector('input[name="ratingMode"]:checked')?.value) ?? '',
            durationMin: document.getElementById('durationMin').value.trim(),
            durationMax: document.getElementById('durationMax').value.trim(),
            likesMin: document.getElementById('likesMin').value.trim(),
            likesMax: document.getElementById('likesMax').value.trim(),
            viewsMin: document.getElementById('viewsMin').value.trim(),
            viewsMax: document.getElementById('viewsMax').value.trim(),
            commentsMin: document.getElementById('commentsMin').value.trim(),
            commentsMax: document.getElementById('commentsMax').value.trim(),
            tags: document.getElementById('tags').value.trim(),
            tagsMode: (form.querySelector('input[name="tagsMode"]:checked')?.value) ?? 'and',
            tagsNot: document.getElementById('tagsNot').value.trim(),
            dateMin: document.getElementById('dateMin').value.trim(),
            dateMax: document.getElementById('dateMax').value.trim()
        };
    }

    /**
     * クリップボードにコピー
     * @param {string} text - コピーするテキスト
     */
    function copyToClipboard(text) {
        // モダンなClipboard APIを使用
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    showCopyMessage('コピーしました！', 'success');
                })
                .catch(err => {
                    console.error('コピーに失敗しました:', err);
                    // フォールバック
                    fallbackCopyToClipboard(text);
                });
        } else {
            // フォールバック
            fallbackCopyToClipboard(text);
        }
    }

    /**
     * クリップボードコピーのフォールバック処理
     * @param {string} text - コピーするテキスト
     */
    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showCopyMessage('コピーしました！', 'success');
            } else {
                showCopyMessage('コピーに失敗しました', 'error');
            }
        } catch (err) {
            console.error('コピーに失敗しました:', err);
            showCopyMessage('コピーに失敗しました', 'error');
        }

        document.body.removeChild(textArea);
    }

    /**
     * コピーメッセージを表示
     * @param {string} message - 表示するメッセージ
     * @param {string} type - メッセージタイプ ('success' or 'error')
     */
    function showCopyMessage(message, type) {
        copyMessage.textContent = message;
        copyMessage.className = `copy-message ${type} visible`;

        // 3秒後に非表示
        setTimeout(() => {
            hideCopyMessage();
        }, 3000);
    }

    /**
     * コピーメッセージを非表示
     */
    function hideCopyMessage() {
        copyMessage.className = 'copy-message';
    }

    // 初期表示時にも実行
    generateSearchExpression();
});
