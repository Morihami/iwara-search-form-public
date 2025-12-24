// Iwara検索式ジェネレーター - メインスクリプト

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('searchForm');
    const resetBtn = document.getElementById('resetBtn') ?? document.getElementById('resetBtnInline');
    const copyBtn = document.getElementById('copyBtn');
    const searchExpression = document.getElementById('searchExpression');
    const copyMessage = document.getElementById('copyMessage');
    const exampleButtons = document.querySelectorAll('.example-fill');
    const datePickerButtons = document.querySelectorAll('.date-picker-btn');

    // リアルタイムプレビュー用のイベントリスナー
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('input', generateSearchExpression);
        input.addEventListener('change', generateSearchExpression);
    });

    // リセットボタンのクリックイベント
    resetBtn.addEventListener('click', function(e) {
        e.preventDefault();
        form.reset();
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

    setupDatePickerButtons();

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
        } else {
            searchExpression.textContent = 'ここに検索式が表示されます';
            copyBtn.disabled = true;
        }

        hideCopyMessage();
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
    function setupDatePickerButtons() {
        datePickerButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.dateTarget;
                const input = targetId ? document.getElementById(targetId) : null;
                if (!input) {
                    return;
                }
                if (typeof input.showPicker === 'function') {
                    try {
                        input.showPicker();
                    } catch (error) {
                        // ignore
                    }
                }
                input.focus();
            });
        });
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
