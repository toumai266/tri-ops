# Tri-ops

<div align="center">

![Generic badge](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)
![Generic badge](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript&logoColor=white)
![Generic badge](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=for-the-badge&logo=supabase&logoColor=white)
![Generic badge](https://img.shields.io/badge/Vercel-Deployment-black?style=for-the-badge&logo=vercel&logoColor=white)

### Team Operations Console for GitHub & Discord

</div>

---

## Introduction(소개)

Tri-ops는 구름톤 정보보호 16회차 Tri-Best 팀의 운영을 지원하기 위해 설계된
내부 운영 제품(Internal Product)으로,
팀 운영 규칙과 프로세스를 문서가 아닌 제품(Product)으로 관리하여
소규모 개발팀에서 발생하는 커뮤니케이션 비용과 운영 병목을 줄이는 것을 목표로 합니다.

## Purpose(목적)

6인 규모의 팀에서 발생하는 **이슈(Issue)→ PR(Pull Request) → 배포(Deploy) → 공지(Notice)** 의 흐름을 표준화합니다.
단순한 봇이 아닌 **Rule-as-Product** 개념을 도입하여, 팀의 운영 규칙을 제품 내에서 관리하고 병목 구간을 시각화하여 팀의 생산성을 극대화합니다.

## Key Features(주요기능)

### 1. Rule Engine Standardization
운영 지식을 관리자의 머릿속이 아닌 **DB기반(Database-based)** 룰로 관리합니다. 티켓의 상태, 라벨, 담당자 배정 규칙을 **Rule Engine**을 통해 자동화하여 휴먼 에러를 방지합니다.

### 2. Flow Visibility
**GitHub**과 **Discord**에 분산된 정보를 단일 대시보드에서 통합하여 보여줍니다. 현재 진행 중인 **Sprint**의 흐름, **PR**리뷰 대기 시간, **CI/CD**상태를 한눈에 파악하여 병목을 시각화합니다.

### 3. Actionable Notifications
단순한 이벤트 알림을 넘어, **Discord** 메시지를 통해 **Next Action(다음행동)** 을 유도합니다. 리뷰 요청, 머지 가능 상태, 배포 완료 공지 등 구성원이 즉시 반응해야 할 정보를 카드 형태로 전달합니다.

## Tech Stack(기술스택)

| Category | Technology |
| :--- | :--- |
| **Framework** | **Next.js 15 (App Router)** |
| **Language** | **TypeScript** |
| **Database** | **Supabase (PostgreSQL)** |
| **ORM** | **Drizzle ORM** |
| **Styling** | **TailwindCSS** |

---

<div align="center">

© 2026 **Tri-Best** Team. All rights reserved.
Maintainer: Heehyeon Yoo (hhkb.dev)

</div>
