let questions = []; // 問題データ
let current = 0; // 現在の問題インデックス
let correct = 0; // 正解数
let missed = []; // 間違えた問題のリスト
let selectedVoice = null; // 選択された音声
let levelDelay = 2000; // レベルに応じた表示遅延時間 (デフォルト: ふつう2秒)
let speechUtterance = null; // SpeechSynthesisUtterance オブジェクトを保持

// ページ読み込み時に実行される初期設定
document.addEventListener('DOMContentLoaded', () => {
    // 今日の日付をデフォルトで設定
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('test-date').value = `${yyyy}-${mm}-${dd}`;

    // 音声の選択肢をロード
    loadVoices();

    // フォントの選択肢をロード（HTMLに直接記述済み）
    // 文字の色の選択肢をロード（HTMLに直接記述済み）

    // レベルのデフォルト設定
    document.getElementById('level').value = 'normal'; // ふつうをデフォルトに
});

// 音声が利用可能になったときに選択肢を更新
window.speechSynthesis.onvoiceschanged = loadVoices;

function loadVoices() {
    const voiceSelect = document.getElementById("voice-select");
    // 英語の音声のみをフィルタリング
    const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith("en"));
    voiceSelect.innerHTML = ""; // 既存の選択肢をクリア

    if (voices.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "音声が利用できません";
        voiceSelect.appendChild(option);
        voiceSelect.disabled = true;
        return;
    }

    voices.forEach(voice => {
        const option = document.createElement("option");
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(option);
    });

    // デフォルトの音声を選択 (もしあれば)
    if (!selectedVoice && voices.length > 0) {
        // 'Google US English' または 'Samantha' を優先的に選択
        const preferredVoice = voices.find(v => v.name === 'Google US English') || voices.find(v => v.name === 'Samantha');
        selectedVoice = preferredVoice || voices[0];
        voiceSelect.value = selectedVoice.name;
    } else if (selectedVoice) {
        // 以前選択されていた音声がまだ存在するか確認し、存在しない場合は最初の音声を選択
        const foundVoice = voices.find(v => v.name === selectedVoice.name);
        if (foundVoice) {
            voiceSelect.value = selectedVoice.name;
        } else {
            selectedVoice = voices[0];
            voiceSelect.value = voices[0].name;
        }
    }
    voiceSelect.disabled = false;
}

/**
 * カスタムアラート/コンファームダイアログを表示する関数
 * @param {string} message - 表示するメッセージ
 * @param {boolean} isConfirm - コンファームダイアログかどうか (true: はい/いいえ, false: OKのみ)
 * @returns {Promise<boolean>} - コンファームの場合、ユーザーの選択 (true: はい, false: いいえ)
 */
function showCustomModal(message, isConfirm = false) {
    return new Promise(resolve => {
        const modal = document.getElementById('custom-modal');
        const modalMessage = document.getElementById('modal-message');
        const modalOkButton = document.getElementById('modal-ok');
        const modalCancelButton = document.getElementById('modal-cancel');

        modalMessage.textContent = message;
        modalCancelButton.style.display = isConfirm ? 'inline-block' : 'none';

        modalOkButton.onclick = () => {
            modal.style.display = 'none';
            resolve(true);
        };

        modalCancelButton.onclick = () => {
            modal.style.display = 'none';
            resolve(false);
        };

        modal.style.display = 'flex';
    });
}

// テスト開始ボタンが押されたときの処理
async function startTest() {
    const saved = JSON.parse(localStorage.getItem("englishTestProgress"));
    if (saved) {
        const confirmResume = await showCustomModal("前回の途中から再開しますか？", true);
        if (confirmResume) {
            loadSavedProgress(saved);
            return;
        } else {
            localStorage.removeItem("englishTestProgress");
        }
    }

    const gradeSet = document.getElementById("grade-set").value;
    const mode = document.getElementById("mode").value;
    const level = document.getElementById("level").value;
    const voiceSelect = document.getElementById("voice-select");
    selectedVoice = speechSynthesis.getVoices().find(v => v.name === voiceSelect.value);

    // レベルに応じた遅延時間を設定
    switch (level) {
        case 'easy':
            levelDelay = 3000; // 3秒
            break;
        case 'normal':
            levelDelay = 2000; // 2秒
            break;
        case 'hard':
            levelDelay = 1000; // 1秒
            break;
    }

    if (!gradeSet) {
        await showCustomModal("学年とセットを選んでください");
        return;
    }
    if (!selectedVoice) {
        await showCustomModal("英語の音声が利用できません。ブラウザの設定を確認してください。");
        return;
    }

    fetch(`data/${gradeSet}.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load ${gradeSet}.json: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            questions = data;
            if (mode === "random") {
                questions = shuffleArray(questions);
            }
            current = 0;
            correct = 0;
            missed = [];
            document.getElementById("setup").style.display = "none";
            document.getElementById("quiz").style.display = "flex"; // flexに変更
            document.getElementById("result").style.display = "none";
            showQuestion();
        })
        .catch(error => {
            console.error("データの読み込みエラー:", error);
            showCustomModal(`問題データの読み込みに失敗しました: ${error.message}`);
        });
}

// 保存された進捗をロードする
function loadSavedProgress(saved) {
    current = saved.current;
    correct = saved.correct;
    missed = saved.missed;
    questions = saved.questions;
    document.getElementById("test-date").value = saved.date || "";
    document.getElementById("grade-set").value = saved.gradeSet;
    document.getElementById("mode").value = saved.mode;
    document.getElementById("level").value = saved.level; // レベルもロード
    levelDelay = saved.levelDelay; // 遅延時間もロード
    document.getElementById("voice-select").value = saved.voiceName;
    selectedVoice = speechSynthesis.getVoices().find(v => v.name === saved.voiceName);
    document.getElementById("font-select").value = saved.fontFamily;
    document.getElementById("color-picker").value = saved.textColor;

    document.getElementById("setup").style.display = "none";
    document.getElementById("quiz").style.display = "flex"; // flexに変更
    document.getElementById("result").style.display = "none";
    showQuestion();
}

// 現在の進捗を保存する
function saveCurrentProgress() {
    const progress = {
        current,
        correct,
        missed,
        questions,
        gradeSet: document.getElementById("grade-set").value,
        mode: document.getElementById("mode").value,
        date: document.getElementById("test-date").value,
        level: document.getElementById("level").value,
        levelDelay: levelDelay,
        voiceName: selectedVoice ? selectedVoice.name : '',
        fontFamily: document.getElementById("font-select").value,
        textColor: document.getElementById("color-picker").value
    };
    localStorage.setItem("englishTestProgress", JSON.stringify(progress));
}

// 問題を表示する
function showQuestion() {
    if (current >= questions.length) {
        showResult();
        return;
    }

    const question = questions[current];
    const questionImage = document.getElementById("question-image");
    const textA = document.getElementById("text-A");
    const textB = document.getElementById("text-B");

    // まず画像を表示
    questionImage.src = `images/${question.image}`;
    questionImage.style.display = 'block'; // 画像を表示

    // AとBのテキストは非表示にしておく
    textA.textContent = "";
    textB.textContent = "";
    textA.style.display = 'none';
    textB.style.display = 'none';

    applyFontAndColor(); // フォントと色を適用
    updateProgressBar(); // 進捗バーを更新

    // レベルに応じた秒数後にAとBのテキストと音声を再生
    setTimeout(() => {
        textA.textContent = question.A;
        textA.style.display = 'block'; // Aを表示
        speak(question.A, () => {
            // Aの音声再生後にBのテキストと音声を再生
            setTimeout(() => {
                textB.textContent = question.B;
                textB.style.display = 'block'; // Bを表示
                speak(question.B);
            }, 500); // AとBの音声の間に少し間隔を空ける
        });
    }, levelDelay);
}

// ユーザーが回答したときの処理
function answer(isCorrect) {
    // 現在再生中の音声があれば停止
    if (speechUtterance && speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }

    if (isCorrect) {
        correct++;
    } else {
        missed.push(questions[current]);
    }
    saveCurrentProgress(); // 進捗を保存
    current++;
    showQuestion();
}

// テスト中断ボタンが押されたときの処理
async function interruptTest() {
    const confirmInterrupt = await showCustomModal("テストを中断しますか？現在の進捗は保存されます。", true);
    if (confirmInterrupt) {
        saveCurrentProgress();
        location.reload(); // ページをリロードしてメニューに戻る
    }
}

// 進捗バーを更新する
function updateProgressBar() {
    const percent = Math.round((current / questions.length) * 100);
    document.getElementById("progress-bar").value = percent;
}

// テキストを音声で読み上げる
function speak(text, callback = () => {}) {
    if (!selectedVoice) {
        console.warn("音声が選択されていません。");
        callback();
        return;
    }
    // 既存の音声があればキャンセル
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    speechUtterance = new SpeechSynthesisUtterance(text);
    speechUtterance.voice = selectedVoice;
    speechUtterance.lang = selectedVoice.lang; // 選択された音声の言語を使用
    speechUtterance.rate = 1; // 音声速度は固定 (必要に応じて設定項目を追加)
    speechUtterance.onend = callback; // 音声再生終了後にコールバックを実行
    speechUtterance.onerror = (event) => {
        console.error('SpeechSynthesisUtterance.onerror', event);
        callback(); // エラー時もコールバックを実行
    };
    speechSynthesis.speak(speechUtterance);
}

// フォントと文字の色を適用する
function applyFontAndColor() {
    const font = document.getElementById("font-select").value;
    const color = document.getElementById("color-picker").value;
    document.getElementById("text-A").style.fontFamily = font;
    document.getElementById("text-A").style.color = color;
    document.getElementById("text-B").style.fontFamily = font;
    document.getElementById("text-B").style.color = color;
}

// 配列をシャッフルする（Fisher-Yatesアルゴリズム）
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 結果画面を表示する
function showResult() {
    localStorage.removeItem("englishTestProgress"); // 保存された進捗を削除
    document.getElementById("quiz").style.display = "none";
    document.getElementById("result").style.display = "block";
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    document.getElementById("score").textContent = `得点: ${score}点 (${correct}/${questions.length})`;
    
    let missedHtml = "";
    if (missed.length > 0) {
        missedHtml = "読めなかった問題: ";
        missed.forEach((item, index) => {
            missedHtml += `${item.A} / ${item.B}${index < missed.length - 1 ? ", " : ""}`;
        });
    } else {
        missedHtml = "すべての問題が読めました！";
    }
    document.getElementById("missed-list").textContent = missedHtml;

    showHistoryTable(); // 履歴テーブルを更新
    showCurrentResultTable(score); // 現在の結果テーブルを表示
}

// 現在のテスト結果をテーブルで表示する
function showCurrentResultTable(score) {
    const date = document.getElementById("test-date").value;
    const gradeSet = document.getElementById("grade-set").options[document.getElementById("grade-set").selectedIndex].text; // 表示テキストを取得
    const mode = document.getElementById("mode").options[document.getElementById("mode").selectedIndex].text;
    const missedKanjiList = missed.map(item => `${item.A} / ${item.B}`).join(", "); // 英語の問題形式に合わせる

    const html = `
        <table border="1">
            <tr><th>実施日</th><th>学年</th><th>モード</th><th>点数</th><th>読めなかった問題</th></tr>
            <tr><td>${date}</td><td>${gradeSet}</td><td>${mode}</td><td>${score}点</td><td>${missedKanjiList}</td></tr>
        </table>`;
    document.getElementById("current-result-table").innerHTML = html;
}

// 結果を保存する
async function saveResult() {
    const date = document.getElementById("test-date").value;
    const gradeSet = document.getElementById("grade-set").options[document.getElementById("grade-set").selectedIndex].text;
    const mode = document.getElementById("mode").options[document.getElementById("mode").selectedIndex].text;
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const history = JSON.parse(localStorage.getItem("englishTestHistory") || "[]");
    
    // missed配列はオブジェクトのまま保存
    history.push({ date, gradeSet, mode, score, missed });
    localStorage.setItem("englishTestHistory", JSON.stringify(history));
    await showCustomModal("記録を保存しました");
}

// 過去の記録を表示する
function showHistory() {
    document.getElementById("setup").style.display = "none";
    document.getElementById("history").style.display = "block";
    const history = JSON.parse(localStorage.getItem("englishTestHistory") || "[]");
    const area = document.getElementById("history-list-table");
    
    if (!history.length) {
        area.innerHTML = "<p>まだ記録がありません。</p>";
        return;
    }

    let html = "<table border='1'><tr><th>実施日</th><th>学年</th><th>モード</th><th>点数</th><th>読めなかった問題</th></tr>";
    // 最新の記録が上に来るように逆順にする
    history.reverse().forEach(h => {
        const missedItems = h.missed.map(item => `${item.A} / ${item.B}`).join(", ");
        html += `<tr><td>${h.date}</td><td>${h.gradeSet}</td><td>${h.mode}</td><td>${h.score}点</td><td>${missedItems}</td></tr>`;
    });
    html += "</table>";
    area.innerHTML = html;
}
