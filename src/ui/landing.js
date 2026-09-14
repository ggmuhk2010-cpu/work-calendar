export function renderLanding(root, { missing, onCreate }) {
  root.innerHTML = `
    <main class="landing">
      <div class="landing-card">
        <h1>Work Calendar</h1>
        <p class="lead">여러 회사가 한 달력에서 작업을 요청하고 완료를 확인하는 도구입니다.</p>
        ${missing ? '<p class="error-banner">존재하지 않는 캘린더 링크입니다. 링크를 다시 확인하거나 새 캘린더를 만드세요.</p>' : ''}
        <form id="create-form" novalidate>
          <label for="room-name">캘린더 이름</label>
          <input id="room-name" name="name" maxlength="60" placeholder="예: 빅웨이브 × A사 촬영 프로젝트" autocomplete="off">
          <p class="field-error" data-error-for="name"></p>
          <button type="submit" class="btn btn-primary btn-block">새 캘린더 만들기</button>
        </form>
        <p class="hint">초대 링크를 받았다면 그 링크로 접속하세요.</p>
      </div>
    </main>`;
  const form = root.querySelector('#create-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    try { await onCreate(form.elements.name.value); } finally { btn.disabled = false; }
  });
  form.elements.name.focus();
}
