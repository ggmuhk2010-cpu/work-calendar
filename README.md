# work-calendar

여러 회사가 한 달력에서 작업을 요청하고 "완료"를 누르는 협업 캘린더입니다. 로그인 없이 초대 링크(`#r=키`)만으로 씁니다.

- 기능: 작업 요청과 일정(시간 포함), 본문(최대 5,000자), 첨부(파일 700KB·링크·유튜브 재생·HTML 열기), 회사별 색·필터, 실시간 반영
- 호스팅: GitHub Pages · 데이터: Firebase Firestore (무료 플랜) · 디자인: Apple iOS/iPadOS 27 UI kit 기준
- 사용: 페이지를 열어 "새 캘린더 만들기" → 초대 링크를 팀에 공유 → 각자 이름·회사 입력
- 개발: `npm test` (단위), `npm run test:rules` (규칙, 실제 프로젝트), 로컬 미리보기 `python3 -m http.server 8765`
- 설계서: `docs/superpowers/specs/2026-09-14-work-calendar-design.md`
