# 루트 추천 토이프로젝트의 데이터 수집모듈 입니다.
- nestJS의 스케줄 모듈을 통해 0.1초에 한번씩 이터널 api를 보내 데이터를 수집합니다.
- too many request 이면 다시한번 요청합니다.
- 비동기적으로 수집합니다. 
게임에 대한 정보를 수집이 끝나지 않아도 다음 게임에 대한 요청 합니다.
- api 요청에 대한 제한이 없다면 모듈을 클러스터 해도 정상 작동 하도록 했습니다.

.env.dev 파일이 존재해야 합니다. 내용은 다음과 같습니다.
DB_HOST=
DB_PORT=
DB_USERNAME=
DB_PASSWORD=
DB_NAME=
ETERNAL_API_KEY=
ETERNAL_API_GAME=https://open-api.bser.io/v1/games/
ETERNAL_API_ROUTE=https://open-api.bser.io/v1/weaponRoutes/recommend/
ETERNAL_API_INFO=https://d1wkxvul68bth9.cloudfront.net/l10n/l10n-Korean-20210916124215.txt

도커 허브 리포지터리 이름은
dlgyqja104/route-gg-worker 입니다.
