async function loadFeedbacks() {
    const resp = await fetch('/feedbacks');
    const data = await resp.json();
    const listElem = document.getElementById('feedback-list');
    listElem.innerHTML = '';
    for (const fb of data.feedbacks) {
        const div = document.createElement('div');
        div.className = 'feedback-item';
        div.innerHTML = `<div>${fb.text}</div><div class="timestamp">${fb.timestamp}</div>`;
        listElem.appendChild(div);
    }
}

async function loadMotivation() {
    const resp = await fetch('/motivation');
    const data = await resp.json();
    document.getElementById('motivation').textContent = data.message || '';
}

async function loadPositiveFeedback() {
    const resp = await fetch('/positive');
    const data = await resp.json();
    document.getElementById('positive-feedback').textContent = data.message || '';
}

document.getElementById('form-feedback').addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedbackText = document.getElementById('feedback').value.trim();
    if (!feedbackText) return;
    const resp = await fetch('/feedback', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: feedbackText})
    });
    if (resp.ok) {
        document.getElementById('feedback').value = '';
        await loadFeedbacks();
        await loadPositiveFeedback();
        await loadMotivation();
    } else {
        alert('Erro ao enviar feedback.');
    }
});

// Inicializacao
loadFeedbacks();
loadMotivation();
loadPositiveFeedback();
