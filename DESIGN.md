---
version: "1.0"
theme:
  colors:
    background: "#F8FAF8"
    text_primary: "#1F2E5B"
    accent: "#00BCD4"
    fouc_prevention: "#1F2E5B"
  typography:
    display:
      family: "'Pretendard', 'Inter', sans-serif"
      style: "normal"
      weight: "900"
      letter_spacing: "-0.02em"
      line_height: "1.15"
      text_transform: "none"
    body:
      family: "'Pretendard', 'Inter', sans-serif"
      style: "normal"
      weight: "500;700"
      letter_spacing: "0em"
      line_height: "1.6"
---

## Brand Identity & Color Intent

한국사회복지협의회(SSN)의 디지털 트랜스포메이션(DX) 교육 정체성을 관통하는 두 가지 핵심 색상군을 디지털 대시보드 스키마로 이식한다. 신뢰와 정밀함을 상징하는 딥 트러스트 네이비(#1F2E5B)는 화면의 주 기둥이자 뼈대로서 정보의 무게감과 안정적인 정보 위계를 부여한다. 동시에 지자체 정보화교육과 디지털새싹사업 등 사회적 포용 혁신을 상징하는 디지털 트랜스포메이션 아쿠아 테일(#00BCD4)은 주요 상호작용 지점(CTA 버튼, 바텀 시트 토글러, 정산 상태 배지)에서 형광등을 켠 것처럼 생동감 넘치는 반응형 악센트로 작용한다. HTML 최상위 배경에는 FOUC(Flash of Unstyled Content) 방지용 컬러(#1F2E5B)를 결합하여 모바일 및 PC 브라우저 로딩 단계의 화면 깜빡임을 무결성 상태로 보존한다.

## Cinematic Typography

가독성과 현대적인 레이아웃의 완성도를 결정하는 'Pretendard' 단일 서체 시스템을 채택하고, 이를 기하학적인 스케일링으로 배치한다. 대시보드의 총 누적 통계치와 헤드라인은 유동적인 화면 너비에 반응하는 뷰포트 상대 단위(Viewport-Relative Units, 예: `text-[6vw] md:text-[3vw]`)와 초격차 굵기(Font-Weight 900)를 사용하여 데이터 자체가 UI 무드를 결정하는 '시네마틱 데이터 시각화'를 구현한다. 정보 전달용 본문 텍스트에는 자간 0em과 적절한 1.6 배율의 행간을 보장함으로써, 피로도가 높은 강사들의 모바일 전용 수령액 산출표 내역을 한눈에 식별 가능하도록 극도의 정보 가독성을 제공한다.

## Scroll-Linked Interactive Index

하위 코딩 에이전트는 복잡한 외부 그래픽스 라이브러리(Framer, Canvas 등)를 전혀 쓰지 않고, 오직 '순수 SVG 요소'와 'Tailwind CSS' 및 Vanilla JS 스크롤 리스너만을 사용하여 동적 스크롤 인디케이터 라인을 구축한다.
모바일 탭의 각 기록 리스트나 PC 대시보드의 메인 격자 테이블 측면에 세로 방향의 고정 SVG 궤적(선 굵기 3px, 배경 트랙 #1F2E5B 8% 불투명도, 채워지는 진행 게이지 #00BCD4)을 생성한다. 윈도우 스크롤 이벤트를 통해 현재 뷰포트의 진행률(0.00 ~ 1.00)을 실시간으로 추적 계산하고, 해당 연산 값을 SVG 패스의 `stroke-dashoffset` 속성에 CSS 변수 `--scroll-progress` 형태로 즉각 대입하여 게이지를 선형으로 밀어내며 채운다. 마우스나 손가락 커서가 인디케이터 반경 40px 내에 근접하면, 흡수(Magnetic) 가속도가 작동하여 라인의 일부 정점이 베지어 곡선(Cubic Bezier Path) 연산을 거쳐 손끝 방향으로 달라붙는 미세 유기적 물리 효과를 구현해 고급 모바일 앱의 햅틱 피드백 무드를 전달한다.

## Typography Ledger Grid

프리랜서 강사들의 정량적 수입 및 교통비 공제 데이터를 수학적으로 검증하고 시각적 통제를 부여하기 위하여 미니멀한 명세서(Ledger Grid) 격자 틀을 웹/앱 구조의 근본으로 정한다. 1px 두께의 초미세 라이트 네이비(#1F2E5B, 10% 불투명도) 테두리를 경계로 모든 행과 열을 수평/수직 분할한다.
이 격자 레이아웃은 사용자의 손길이 머무는 지점마다 정교한 물리적 피드백을 전달해야 한다. 각 셀에 마우스 호버(또는 모바일에서의 터치 다운 인터랙션)가 감지되는 순간, `hover:bg-[#1F2E5B]/5 hover:text-[#00BCD4] transition-all duration-150` 구문을 이용해 배경의 명도를 미세하게 밀어내면서 텍스트와 보더가 악센트 컬러로 부드럽게 반전되는 촉각적 시각 반응 시스템을 구축한다. 이를 통해 격자에 갇힌 차가운 텍스트 정보가 살아있는 디지털 장부의 신뢰감과 역동적인 미감을 갖추게 된다.
