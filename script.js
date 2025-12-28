// Iwara検索式ジェネレーター - メインスクリプト

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('searchForm');
    const resetBtn = document.getElementById('resetBtn') ?? document.getElementById('resetBtnInline');
    const copyBtn = document.getElementById('copyBtn');
    const searchBtn = document.getElementById('searchBtn');
    const sortMode = document.getElementById('sortMode');
    const searchExpression = document.getElementById('searchExpression');
    const copyMessage = document.getElementById('copyMessage');
    const exampleButtons = document.querySelectorAll('.example-fill');
    const tagPickerBtn = document.getElementById('tagPickerBtn');
    const tagAddBtn = document.getElementById('tagAddBtn');
    const tagInput = document.getElementById('tagInput');
    const tagInputOr2 = document.getElementById('tagInputOr2');
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
    const tagChipsOr2 = document.getElementById('tagChipsOr2');
    const tagChipsNot = document.getElementById('tagChipsNot');
    const tagAddBtnNot = document.getElementById('tagAddBtnNot');
    const tagAddBtnOr2 = document.getElementById('tagAddBtnOr2');
    const uiLangInputs = document.querySelectorAll('input[name="uiLang"]');
    const savedList = document.getElementById('savedList');
    const savedEmpty = document.getElementById('savedEmpty');
    const savedName = document.getElementById('savedName');
    const savedAddBtn = document.getElementById('savedAddBtn');
    const tagDialogFrequent = document.getElementById('tagDialogFrequent');
    const tagDialogCloseButtons = tagDialog ? tagDialog.querySelectorAll('[data-close="true"]') : [];
    const STORAGE_KEY = 'iwara-search-form-state-v1';
    const TAG_USAGE_KEY = 'iwara-search-form-tag-usage-v1';
    const SAVED_KEY = 'iwara-search-form-saved-v1';
    const UI_LANG_KEY = 'iwara-search-form-ui-lang-v1';
    const TAG_PAGE_SIZE = 45;
    const SAVED_LIMIT = 20;
    let tagPage = 0;
    let tagLoading = false;
    let tagAll = null;
    let tagSensitiveMap = new Map();
    let tagSearchQuery = '';
    let selectedTags = [];
    let selectedTagsOr2 = [];
    let selectedTagsNot = [];
    let tagTargetMode = 'include';
    let tagPendingPage = null;
    let tagUsage = loadTagUsage();
    let savedItems = loadSavedItems();
    let uiLang = loadUiLang();
    const translations = buildTranslations();
    const emptyExpressionTexts = buildEmptyExpressionSet(translations);

    // リアルタイムプレビュー用のイベントリスナー
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('input', generateSearchExpression);
        input.addEventListener('change', generateSearchExpression);
    });

    if (uiLangInputs.length > 0) {
        const match = Array.from(uiLangInputs).find(input => input.value === uiLang);
        if (match) {
            match.checked = true;
        }
        uiLangInputs.forEach(input => {
            input.addEventListener('change', () => {
                if (!input.checked) {
                    return;
                }
                uiLang = input.value;
                saveUiLang();
                applyTranslations();
                generateSearchExpression();
                renderTagChips();
                renderTagChipsOr2();
                renderTagChipsNot();
                renderFrequentTags();
                renderSavedItems();
            });
        });
    }

    applyTranslations();
    restoreFormState();
    syncSelectedTagsFromInput();
    syncSelectedTagsOr2FromInput();
    syncSelectedTagsNotFromInput();
    renderTagChips();
    renderTagChipsOr2();
    renderTagChipsNot();
    renderSavedItems();
    generateSearchExpression();

    // リセットボタンのクリックイベント
    resetBtn.addEventListener('click', function(e) {
        e.preventDefault();
        form.reset();
        clearStoredState();
        searchExpression.textContent = getEmptyExpressionText();
        copyBtn.disabled = true;
        hideCopyMessage();
    });

    // コピーボタンのクリックイベント
    copyBtn.addEventListener('click', function() {
        const expression = searchExpression.textContent;
        if (expression && !isEmptyExpression(expression)) {
            copyToClipboard(expression);
        }
    });

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const expression = searchExpression.textContent;
            if (!expression || isEmptyExpression(expression)) {
                return;
            }
            const sortValue = sortMode ? sortMode.value : '';
            const sortParam = sortValue ? `&sort=${encodeURIComponent(sortValue)}` : '';
            const url = `https://www.iwara.tv/search?type=videos&page=0&query=${encodeURIComponent(expression)}${sortParam}`;
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
            if (target.dataset.action === 'remove') {
                removeSavedItem(itemId);
                return;
            }
            if (target.dataset.action === 'apply') {
                const item = savedItems.find(entry => entry.id === itemId);
                if (!item) {
                    return;
                }
                applySavedState(item);
            }
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
        if (target && target.id === 'tagAddBtnOr2') {
            event.preventDefault();
            openTagDialog('include2');
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
            tagsOr2: document.getElementById('tagsOr2').value.trim(),
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
                parts.push(`{tags: ${formatList(tags)}}`);
            }
        }

        if (formData.tagsOr2) {
            const tags = parseCommaSeparated(formData.tagsOr2);
            if (tags.length > 0) {
                parts.push(`{tags: ${formatList(tags)}}`);
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
            searchExpression.textContent = getEmptyExpressionText();
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
            tagsOr2: 'tagsOr2',
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
        if (dataset.localeMode) {
            const localeTarget = form.querySelector(`input[name="localeMode"][value="${dataset.localeMode}"]`);
            if (localeTarget) {
                localeTarget.checked = true;
            }
        }
    }

    function buildTranslations() {
        return {
            ja: {
                'app.title': 'Iwara検索フォーム',
                'app.subtitle': 'フォーム入力でビデオを検索します',
                'ui.language': '表示言語',
                'ui.langJa': '日本語',
                'ui.langEn': 'English',
                'ui.langZh': '中文',
                'label.locale': 'ロケール',
                'option.none': 'なし',
                'option.english': '英語',
                'option.japanese': '日本語',
                'option.chinese': '中国語',
                'button.clear': 'クリア',
                'label.title': 'タイトル',
                'label.detail': '詳細',
                'label.author': '作者',
                'option.userInclude': '絞り込む',
                'option.userExclude': '除外する',
                'label.rating': 'レーティング',
                'option.ratingAll': 'すべて',
                'option.ratingGeneral': '一般',
                'option.ratingEcchi': 'エッチ',
                'label.duration': '長さ（秒）',
                'label.likes': 'Likes',
                'label.views': 'Views',
                'label.comments': 'Comments',
                'label.tags': 'タグ',
                'label.tagsFilter': '絞り込み',
                'label.tagsExclude': 'タグ（除外）',
                'option.tagsAll': 'すべて含む',
                'option.tagsAny': 'いずれか含む',
                'button.add': '追加',
                'label.updatedAt': '更新日',
                'result.empty': 'ここに検索式が表示されます',
                'sort.relevance': '関連順に並べ替え',
                'sort.date': '更新日順',
                'sort.views': '再生数順',
                'sort.likes': 'いいね順',
                'button.search': '検索',
                'button.copy': 'コピー',
                'saved.title': '保存済み条件',
                'saved.placeholder': '名前を付けて保存',
                'saved.empty': '（まだありません）',
                'button.save': '保存',
                'button.apply': '適用',
                'button.close': '閉じる',
                'button.prev': '前',
                'button.next': '次',
                'tagDialog.title': 'タグを選択',
                'tagDialog.browse': 'タグを閲覧する',
                'tagDialog.source': 'source: tags_all.json',
                'tagDialog.searchLabel': '検索',
                'tagDialog.searchPlaceholder': '例: miku',
                'tagDialog.frequent': 'よく使うタグ',
                'tags.none': '（なし）',
                'tags.frequentEmpty': '（まだありません）',
                'tags.loading': '読み込み中...',
                'tags.noResults': 'タグがありません',
                'tags.loadFailed': '読み込みに失敗しました',
                'copy.success': 'コピーしました！',
                'copy.error': 'コピーに失敗しました',
                'reference.linkText': '検索式の使い方は掲示板をご覧ください',
                'placeholder.title': '例: miku',
                'placeholder.detail': '例: dance',
                'placeholder.author': '例: creator1, creator2',
                'placeholder.minSeconds': '60',
                'placeholder.maxSeconds': '120',
                'placeholder.minCount': '0',
                'placeholder.maxCount': '10000000',
                'placeholder.maxCountShort': '100'
            },
            en: {
                'app.title': 'Iwara Search Form',
                'app.subtitle': 'Search videos with a simple form',
                'ui.language': 'Language',
                'ui.langJa': 'Japanese',
                'ui.langEn': 'English',
                'ui.langZh': 'Chinese',
                'label.locale': 'Locale',
                'option.none': 'None',
                'option.english': 'English',
                'option.japanese': 'Japanese',
                'option.chinese': 'Chinese',
                'button.clear': 'Clear',
                'label.title': 'Title',
                'label.detail': 'Description',
                'label.author': 'Author',
                'option.userInclude': 'Include',
                'option.userExclude': 'Exclude',
                'label.rating': 'Rating',
                'option.ratingAll': 'All',
                'option.ratingGeneral': 'General',
                'option.ratingEcchi': 'Ecchi',
                'label.duration': 'Duration (sec)',
                'label.likes': 'Likes',
                'label.views': 'Views',
                'label.comments': 'Comments',
                'label.tags': 'Tags',
                'label.tagsFilter': 'Filter',
                'label.tagsExclude': 'Tags (Exclude)',
                'option.tagsAll': 'All',
                'option.tagsAny': 'Any',
                'button.add': 'Add',
                'label.updatedAt': 'Updated',
                'result.empty': 'Search expression will appear here',
                'sort.relevance': 'Sort by relevance',
                'sort.date': 'Newest',
                'sort.views': 'Most views',
                'sort.likes': 'Most likes',
                'button.search': 'Search',
                'button.copy': 'Copy',
                'saved.title': 'Saved filters',
                'saved.placeholder': 'Name and save',
                'saved.empty': '(none yet)',
                'button.save': 'Save',
                'button.apply': 'Apply',
                'button.close': 'Close',
                'button.prev': 'Prev',
                'button.next': 'Next',
                'tagDialog.title': 'Select tags',
                'tagDialog.browse': 'Browse tags',
                'tagDialog.source': 'source: tags_all.json',
                'tagDialog.searchLabel': 'Search',
                'tagDialog.searchPlaceholder': 'e.g. miku',
                'tagDialog.frequent': 'Frequent tags',
                'tags.none': '(none)',
                'tags.frequentEmpty': '(none yet)',
                'tags.loading': 'Loading...',
                'tags.noResults': 'No tags',
                'tags.loadFailed': 'Failed to load',
                'copy.success': 'Copied!',
                'copy.error': 'Copy failed',
                'reference.linkText': 'See the forum post for search syntax',
                'placeholder.title': 'e.g. miku',
                'placeholder.detail': 'e.g. dance',
                'placeholder.author': 'e.g. creator1, creator2',
                'placeholder.minSeconds': '60',
                'placeholder.maxSeconds': '120',
                'placeholder.minCount': '0',
                'placeholder.maxCount': '10000000',
                'placeholder.maxCountShort': '100'
            },
            zh: {
                'app.title': 'Iwara搜索表单',
                'app.subtitle': '通过表单搜索视频',
                'ui.language': '界面语言',
                'ui.langJa': '日语',
                'ui.langEn': '英语',
                'ui.langZh': '中文',
                'label.locale': '语言字段',
                'option.none': '无',
                'option.english': '英语',
                'option.japanese': '日语',
                'option.chinese': '中文',
                'button.clear': '清除',
                'label.title': '标题',
                'label.detail': '描述',
                'label.author': '作者',
                'option.userInclude': '筛选',
                'option.userExclude': '排除',
                'label.rating': '分级',
                'option.ratingAll': '全部',
                'option.ratingGeneral': '一般',
                'option.ratingEcchi': '工口',
                'label.duration': '时长(秒)',
                'label.likes': '点赞',
                'label.views': '播放',
                'label.comments': '评论',
                'label.tags': '标签',
                'label.tagsFilter': '筛选',
                'label.tagsExclude': '标签（排除）',
                'option.tagsAll': '全部包含',
                'option.tagsAny': '包含任一',
                'button.add': '添加',
                'label.updatedAt': '更新时间',
                'result.empty': '这里会显示搜索式',
                'sort.relevance': '按相关度排序',
                'sort.date': '按更新时间',
                'sort.views': '按播放量',
                'sort.likes': '按点赞',
                'button.search': '搜索',
                'button.copy': '复制',
                'saved.title': '已保存条件',
                'saved.placeholder': '命名并保存',
                'saved.empty': '（暂无）',
                'button.save': '保存',
                'button.apply': '应用',
                'button.close': '关闭',
                'button.prev': '上一页',
                'button.next': '下一页',
                'tagDialog.title': '选择标签',
                'tagDialog.browse': '浏览标签',
                'tagDialog.source': '来源: tags_all.json',
                'tagDialog.searchLabel': '搜索',
                'tagDialog.searchPlaceholder': '例如: miku',
                'tagDialog.frequent': '常用标签',
                'tags.none': '（无）',
                'tags.frequentEmpty': '（暂无）',
                'tags.loading': '加载中...',
                'tags.noResults': '没有标签',
                'tags.loadFailed': '加载失败',
                'copy.success': '已复制！',
                'copy.error': '复制失败',
                'reference.linkText': '查看论坛中的搜索语法说明',
                'placeholder.title': '例如: miku',
                'placeholder.detail': '例如: dance',
                'placeholder.author': '例如: creator1, creator2',
                'placeholder.minSeconds': '60',
                'placeholder.maxSeconds': '120',
                'placeholder.minCount': '0',
                'placeholder.maxCount': '10000000',
                'placeholder.maxCountShort': '100'
            }
        };
    }

    function buildEmptyExpressionSet(map) {
        const texts = Object.values(map)
            .map(value => value['result.empty'])
            .filter(Boolean);
        return new Set(texts);
    }

    function t(key) {
        return translations[uiLang]?.[key] ?? translations.ja[key] ?? '';
    }

    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.dataset.i18n;
            const text = t(key);
            if (text) {
                el.textContent = text;
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const key = el.dataset.i18nPlaceholder;
            const text = t(key);
            if (text) {
                el.placeholder = text;
            }
        });
        document.title = t('app.title');
        if (searchExpression && isEmptyExpression(searchExpression.textContent)) {
            searchExpression.textContent = getEmptyExpressionText();
        }
    }

    function isEmptyExpression(text) {
        return emptyExpressionTexts.has(text);
    }

    function getEmptyExpressionText() {
        return t('result.empty') || '...';
    }

    function loadUiLang() {
        try {
            const raw = localStorage.getItem(UI_LANG_KEY);
            return raw || 'ja';
        } catch (error) {
            return 'ja';
        }
    }

    function saveUiLang() {
        try {
            localStorage.setItem(UI_LANG_KEY, uiLang);
        } catch (error) {
            // ignore
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

        if (tagAddBtnOr2) {
            tagAddBtnOr2.addEventListener('click', () => {
                openTagDialog('include2');
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
        if (targetMode === 'exclude') {
            tagTargetMode = 'exclude';
        } else if (targetMode === 'include2') {
            tagTargetMode = 'include2';
        } else {
            tagTargetMode = 'include';
        }
        tagDialog.dataset.target = tagTargetMode;
        tagDialog.classList.remove('hidden');
        syncSelectedTagsFromInput();
        syncSelectedTagsOr2FromInput();
        syncSelectedTagsNotFromInput();
        renderTagChips();
        renderTagChipsOr2();
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
            tagDialogEmpty.textContent = t('tags.loading');
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
                    tagDialogEmpty.textContent = pageTags.length === 0 ? t('tags.noResults') : '';
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
                    tagDialogEmpty.textContent = t('tags.loadFailed');
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
                renderTagChipsOr2();
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
        if (currentTarget === 'include2') {
            appendTagOr2WithOptions(tagName, { closeDialog: true });
            return;
        }
        appendTagWithOptions(tagName, { closeDialog: true });
    }

    function appendTagOr2WithOptions(tagName, options) {
        const input = document.getElementById('tagsOr2');
        if (!input) {
            return;
        }
        if (!selectedTagsOr2.includes(tagName)) {
            selectedTagsOr2.push(tagName);
        }
        incrementTagUsage(tagName);
        input.value = selectedTagsOr2.join(', ');
        generateSearchExpression();
        renderTagChipsOr2();
        renderFrequentTags();
        loadTags(tagPage);
        if (options && options.closeDialog) {
            closeTagDialog();
        }
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

    function removeTagOr2(tagName) {
        selectedTagsOr2 = selectedTagsOr2.filter(tag => tag !== tagName);
        const input = document.getElementById('tagsOr2');
        if (input) {
            input.value = selectedTagsOr2.join(', ');
        }
        generateSearchExpression();
        renderTagChipsOr2();
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

    function syncSelectedTagsOr2FromInput() {
        const input = document.getElementById('tagsOr2');
        if (!input) {
            selectedTagsOr2 = [];
            return;
        }
        selectedTagsOr2 = parseCommaSeparated(input.value);
    }

    function renderTagChips() {
        if (!tagChips) {
            return;
        }
        tagChips.innerHTML = '';
        if (selectedTags.length === 0) {
            tagChips.textContent = t('tags.none');
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
            tagChipsNot.textContent = t('tags.none');
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

    function renderTagChipsOr2() {
        if (!tagChipsOr2) {
            return;
        }
        tagChipsOr2.innerHTML = '';
        if (selectedTagsOr2.length === 0) {
            tagChipsOr2.textContent = t('tags.none');
            return;
        }
        selectedTagsOr2.forEach(tag => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'tag-chip';
            chip.textContent = tag;
            if (isSensitiveTag(tag)) {
                chip.classList.add('tag-sensitive');
            }
            chip.addEventListener('click', () => {
                removeTagOr2(tag);
            });
            tagChipsOr2.appendChild(chip);
        });
    }

    function isTagSelected(tagName) {
        return selectedTags.includes(tagName) || selectedTagsOr2.includes(tagName) || selectedTagsNot.includes(tagName);
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
            tagDialogFrequent.textContent = t('tags.frequentEmpty');
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
                if (currentTarget === 'include2') {
                    appendTagOr2WithOptions(tag, { closeDialog: true });
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
        if (!expression || isEmptyExpression(expression)) {
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
            savedEmpty.textContent = t('saved.empty');
            savedEmpty.style.display = 'block';
            return;
        }
        savedEmpty.style.display = 'none';
        savedItems.forEach(item => {
            const chip = document.createElement('div');
            chip.className = 'saved-chip';
            const nameButton = document.createElement('button');
            nameButton.type = 'button';
            nameButton.className = 'saved-chip__name';
            nameButton.textContent = item.name;
            nameButton.title = item.expression;
            nameButton.dataset.savedId = item.id;
            nameButton.dataset.action = 'apply';
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'saved-chip__remove';
            removeButton.textContent = '×';
            removeButton.dataset.savedId = item.id;
            removeButton.dataset.action = 'remove';
            chip.appendChild(nameButton);
            chip.appendChild(removeButton);
            savedList.appendChild(chip);
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
            tagsOr2: 'tagsOr2',
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
        if (typeof state.tagsOr2 === 'string') {
            const field = document.getElementById('tagsOr2');
            if (field) {
                field.value = state.tagsOr2;
            }
        }
        syncSelectedTagsFromInput();
        syncSelectedTagsOr2FromInput();
        syncSelectedTagsNotFromInput();
        renderTagChips();
        renderTagChipsOr2();
        renderTagChipsNot();
        generateSearchExpression();
    }

    function removeSavedItem(itemId) {
        const nextItems = savedItems.filter(entry => entry.id !== itemId);
        if (nextItems.length === savedItems.length) {
            return;
        }
        savedItems = nextItems;
        saveSavedItems();
        renderSavedItems();
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
            tagsOr2: 'tagsOr2',
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
        if (sortMode && typeof state.sortMode === 'string') {
            sortMode.value = state.sortMode;
        }
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
            tagsOr2: document.getElementById('tagsOr2').value.trim(),
            tagsNot: document.getElementById('tagsNot').value.trim(),
            dateMin: document.getElementById('dateMin').value.trim(),
            dateMax: document.getElementById('dateMax').value.trim(),
            sortMode: sortMode ? sortMode.value : ''
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
                    showCopyMessage(t('copy.success'), 'success');
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
                showCopyMessage(t('copy.success'), 'success');
            } else {
                showCopyMessage(t('copy.error'), 'error');
            }
        } catch (err) {
            console.error('コピーに失敗しました:', err);
            showCopyMessage(t('copy.error'), 'error');
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
